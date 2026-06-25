import { getTheme } from './renderer.js';

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GW = 800;
export const GH = 500;
export const GROUND_Y = 430;

// Vertical bounds for placing standable surfaces.
const TOP = 80;            // ceiling clearance
const FLOOR = GROUND_Y - 20; // 410 — comfortable baseline platform top
// Most you can climb in a single jump (keeps every required leap reachable).
const MAX_RISE = 95;

// Crumble timing (seconds): how long after you land before it drops, and
// how long until it regenerates so retries stay possible.
const CRUMBLE_DELAY = 0.42;
const CRUMBLE_REGEN = 2.8;

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─── PER-STAGE CHARACTER ─────────────────────────────────────────────────────
// Each biome plays differently, not just recolored:
//   grounded — lay a continuous floor so a missed jump lands on terrain instead
//              of an endless death-void (fields, cave floor, desert, forest).
//   low      — keep platforms near that floor as rolling terrain (paired w/ grounded).
//   pool     — which segments may appear (by id). Terrain stages get hills/spikes;
//              floating stages also get the moving/crumbling "vehicle" segments.
//   flyerFreq — how common the stage's air species are (cave bats, sky birds…).
//   (Enemy species themselves live in SPECIES / STAGE_ROSTER below.)
const TERRAIN_POOL = ['gap', 'stairsUp', 'stairsDown', 'coinVault', 'pillars',
  'zigzag', 'longLeap', 'descent', 'spikePath', 'spikeLeap', 'gauntlet'];

const STAGE_PROFILES = [
  { grounded: true,  low: true,  pool: TERRAIN_POOL, flyerFreq: 1.0 }, // 0 Meadow — grassy field
  { grounded: true,  low: true,  pool: TERRAIN_POOL, flyerFreq: 1.7 }, // 1 Cave — stalagmites + bats
  { grounded: false, low: false, pool: null,         flyerFreq: 0.5 }, // 2 Icy Peaks — floating & slippery
  { grounded: true,  low: true,  pool: TERRAIN_POOL, flyerFreq: 1.0 }, // 3 Desert — dunes & cacti
  { grounded: false, low: false, pool: null,         flyerFreq: 0.9 }, // 4 Lava — islands over magma
  { grounded: false, low: false, pool: null,         flyerFreq: 1.9 }, // 5 Sky — birds everywhere
  { grounded: true,  low: true,  pool: TERRAIN_POOL, flyerFreq: 0.9 }, // 6 Forest — woodland floor
  { grounded: false, low: false, pool: null,         flyerFreq: 1.7 }, // 7 Space — drones & turrets
  { grounded: false, low: false, pool: null,         flyerFreq: 1.0 }, // 8 Crystal — shards over abyss
  { grounded: false, low: false, pool: null,         flyerFreq: 1.2 }, // 9 Dark Fortress — ramparts
];
function getProfile(stageIdx) { return STAGE_PROFILES[((stageIdx % 10) + 10) % 10] || STAGE_PROFILES[0]; }

// ─── ENEMY SPECIES ───────────────────────────────────────────────────────────
// Every stage fields its own bespoke species with DIFFERENT BEHAVIOR, not a
// reskin. behavior ∈ walk / hop / charge / fly / swoop / float / orbit / drop /
// spider / shoot — implemented in entities.js `updateEnemies`, drawn per-species
// in `drawEnemies`. `air` foes skip knockback clamping; `color` tints particles.
const SPECIES = {
  slime:    p => ({ species: 'slime',    behavior: 'hop',    w: 26, h: 20, hp: 1 + Math.floor(p * 2), dmg: 5,  color: '#58b94a', speed: lerp(28, 55, p), jumpForce: lerp(230, 300, p), jumpEvery: lerp(1.2, 0.8, p) }),
  bee:      p => ({ species: 'bee',      behavior: 'fly',    air: true, w: 24, h: 20, hp: 1, dmg: 4, color: '#f9ca24', chase: 80 }),
  crawler:  p => ({ species: 'crawler',  behavior: 'walk',   w: 30, h: 20, hp: 2 + Math.floor(p * 2), dmg: 6,  color: '#7f8c8d', speed: lerp(35, 70, p) }),
  bat:      p => ({ species: 'bat',      behavior: 'swoop',  air: true, w: 30, h: 22, hp: 1 + Math.floor(p * 2), dmg: 6, color: '#786fa6', swoopRange: 170, swoopSpeed: lerp(230, 310, p) }),
  slider:   p => ({ species: 'slider',   behavior: 'walk',   w: 30, h: 24, hp: 2 + Math.floor(p * 2), dmg: 7,  color: '#82ccdd', speed: lerp(100, 160, p) }),
  icicle:   p => ({ species: 'icicle',   behavior: 'drop',   air: true, w: 18, h: 30, hp: 1, dmg: 12, color: '#aee3ff' }),
  scorpion: p => ({ species: 'scorpion', behavior: 'charge', w: 34, h: 20, hp: 2 + Math.floor(p * 3), dmg: 8,  color: '#cc8e35', speed: lerp(30, 55, p), chargeRange: 180, chargeSpeed: lerp(260, 340, p) }),
  vulture:  p => ({ species: 'vulture',  behavior: 'orbit',  air: true, w: 34, h: 24, hp: 1 + Math.floor(p * 2), dmg: 6, color: '#935116', orbitR: lerp(50, 85, p), orbitSpd: lerp(1.5, 2.2, p) }),
  lavablob: p => ({ species: 'lavablob', behavior: 'hop',    w: 30, h: 24, hp: 2 + Math.floor(p * 3), dmg: 9,  color: '#ff793f', speed: lerp(38, 66, p), jumpForce: lerp(420, 520, p), jumpEvery: 0.15 }),
  ember:    p => ({ species: 'ember',    behavior: 'fly',    air: true, w: 20, h: 24, hp: 1, dmg: 5, color: '#ffb142', chase: 95 }),
  bird:     p => ({ species: 'bird',     behavior: 'swoop',  air: true, w: 34, h: 24, hp: 1 + Math.floor(p * 2), dmg: 6, color: '#f5f6fa', swoopRange: 210, swoopSpeed: lerp(270, 350, p) }),
  puff:     p => ({ species: 'puff',     behavior: 'float',  air: true, w: 30, h: 24, hp: 1 + Math.floor(p * 2), dmg: 5, color: '#dfe6e9', floatSpeed: lerp(42, 70, p) }),
  spider:   p => ({ species: 'spider',   behavior: 'spider', air: true, w: 26, h: 20, hp: 1 + Math.floor(p * 2), dmg: 7, color: '#8d6e4a', dropSpeed: 330 }),
  shroom:   p => ({ species: 'shroom',   behavior: 'hop',    w: 26, h: 24, hp: 2 + Math.floor(p * 2), dmg: 6, color: '#e17055', speed: lerp(24, 48, p), jumpForce: lerp(380, 460, p), jumpEvery: lerp(1.7, 1.1, p) }),
  drone:    p => ({ species: 'drone',    behavior: 'orbit',  air: true, w: 28, h: 18, hp: 2 + Math.floor(p * 2), dmg: 6, color: '#00d2d3', orbitR: lerp(45, 75, p), orbitSpd: lerp(2.1, 2.9, p) }),
  turret:   p => ({ species: 'turret',   behavior: 'shoot',  w: 30, h: 22, hp: 3 + Math.floor(p * 3), dmg: 8, color: '#4834d4', shotDmg: 8, range: 430, fireEvery: lerp(2.6, 1.9, p) }),
  golem:    p => ({ species: 'golem',    behavior: 'walk',   w: 42, h: 38, hp: 6 + Math.floor(p * 6), dmg: 12, color: '#48dbfb', speed: lerp(20, 42, p) }),
  shard:    p => ({ species: 'shard',    behavior: 'orbit',  air: true, w: 22, h: 26, hp: 1 + Math.floor(p * 2), dmg: 7, color: '#00ffe5', orbitR: lerp(55, 90, p), orbitSpd: lerp(1.8, 2.6, p) }),
  knight:   p => ({ species: 'knight',   behavior: 'charge', w: 32, h: 34, hp: 5 + Math.floor(p * 6), dmg: 12, color: '#8854d0', speed: lerp(24, 44, p), chargeRange: 210, chargeSpeed: lerp(300, 380, p) }),
  wraith:   p => ({ species: 'wraith',   behavior: 'float',  air: true, w: 30, h: 32, hp: 2 + Math.floor(p * 3), dmg: 8, color: '#9b59b6', floatSpeed: lerp(50, 85, p) }),
};

// What each stage fields: ground patrollers, air dwellers (placed over gaps),
// and hang species (anchored above walkways — falling icicles, web spiders).
const STAGE_ROSTER = [
  { ground: [['slime', 1]],    air: [['bee', 1]],                 hang: [] },              // 0 Meadow
  { ground: [['crawler', 1]],  air: [['bat', 1]],                 hang: [] },              // 1 Cave
  { ground: [['slider', 1]],   air: [],                           hang: [['icicle', 1]] }, // 2 Icy Peaks
  { ground: [['scorpion', 1]], air: [['vulture', 1]],             hang: [] },              // 3 Desert
  { ground: [['lavablob', 1]], air: [['ember', 1]],               hang: [] },              // 4 Lava
  { ground: [],                air: [['bird', 1], ['puff', 0.7]], hang: [] },              // 5 Sky
  { ground: [['shroom', 1]],   air: [],                           hang: [['spider', 1]] }, // 6 Forest
  { ground: [['turret', 1]],   air: [['drone', 1]],               hang: [] },              // 7 Space
  { ground: [['golem', 1]],    air: [['shard', 1]],               hang: [] },              // 8 Crystal
  { ground: [['knight', 1]],   air: [['wraith', 1]],              hang: [] },              // 9 Dark Fortress
];

function pickSpecies(list, rng) {
  let total = 0;
  for (const s of list) total += s[1];
  let r = rng() * total;
  for (const s of list) { r -= s[1]; if (r <= 0) return s[0]; }
  return list[0][0];
}

// ─── BOSSES ──────────────────────────────────────────────────────────────────
// Every 10th level fields the stage's signature species scaled up ×3 on a huge
// arena. Ground bosses use the 'boss' leap-chase behavior; sky/space bosses are
// giant swoopers. The exit is locked until the boss dies.
const BOSS_SPECIES = ['slime', 'crawler', 'slider', 'scorpion', 'lavablob',
  'bird', 'shroom', 'drone', 'golem', 'knight'];

function makeBoss(stageIdx, p, arena) {
  const sp = BOSS_SPECIES[((stageIdx % 10) + 10) % 10];
  const base = SPECIES[sp](p);
  const scale = 3;
  const w = base.w * scale, h = base.h * scale;
  const flying = sp === 'bird' || sp === 'drone';
  const e = {
    ...base, boss: true, bossScale: scale, w, h,
    hp: 24 + Math.round(p * 36), dmg: Math.max(14, (base.dmg || 8) + 8),
    x: Math.round(arena.x + arena.w * 0.6), dir: -1, phase: 0,
    patrolMin: arena.x + 6, patrolMax: arena.x + arena.w - 6 - w,
  };
  if (flying) {
    e.behavior = 'swoop'; e.air = true;
    e.baseX = Math.round(arena.x + arena.w / 2);
    e.baseY = Math.max(TOP + 50, arena.y - 215);
    e.y = e.baseY;
    e.swoopRange = 560; e.swoopSpeed = 300 + p * 90;
  } else {
    e.behavior = 'boss'; e.air = false;
    e.y = arena.y - h;
    e.baseY = arena.y - h;
    e.speed = 60 + p * 60;
    e.leapForce = 660; e.leapEvery = Math.max(1.3, 2.3 - p);
  }
  // Per-species special attack cooldowns
  const SP_CD = { slime: 4.0, crawler: 5.0, slider: 3.5, scorpion: 4.2, lavablob: 3.0,
                  bird: 4.0, shroom: 4.5, drone: 3.8, golem: 5.5, knight: 4.0 };
  e._baseCD = SP_CD[sp] || 4.0;
  e._specialCD = e._baseCD * 0.45; // first special fires sooner so players see it quickly

  // Per-species signature fields
  e._split = false;            // slime: one-shot split flag
  e._burrowState = 0;          // crawler: burrow state machine (0=idle,1=telegraph,2=underground)
  e._burrowT = 0;              // crawler: timer for current burrow phase
  e._burrowTargetX = 0;        // crawler: player x captured at telegraph start
  e._burrowed = false;         // crawler: non-collidable while underground
  e._iceTrailT = 0;            // slider: ice trail deposit timer
  e.shieldHp = 0;              // drone: active shield HP (0 = no shield)
  e._shieldT = 0;              // drone: remaining shield duration
  e._shieldCD = 0;             // drone: cooldown after shield drops
  e.parryT = 0;                // knight: parry window timer
  e._parryCD = 0;              // knight: cooldown after parry ends
  e._windTelegraph = 0;        // bird: wind gust telegraph timer
  // Per-species signature cooldowns (initial delay before first trigger)
  const SIG_CD = { crawler: 8.0, scorpion: 7.0, lavablob: 6.0, bird: 6.5,
                   shroom: 7.5, drone: 6.0, golem: 8.0, knight: 6.0 };
  e._sigCD = SIG_CD[sp] || 0;
  return e;
}

function mkP(x, y, w, type = 'normal') {
  return { x: Math.round(x), y: Math.round(y), w: Math.max(40, Math.round(w)), h: 20, type };
}
function mkGround(x, w) {
  return { x: Math.round(x), y: GROUND_Y, w: Math.max(1, Math.round(w)), h: GH - GROUND_Y, type: 'ground' };
}
function mkCoin(x, y, spin) {
  return { x: Math.round(x), y: Math.round(y), collected: false, spinAngle: spin };
}

function nCoins(coins, plat, n, rng) {
  const sp = plat.w / (n + 1);
  for (let c = 0; c < n; c++) {
    coins.push(mkCoin(plat.x + sp * (c + 1) - 8, plat.y - 36, rng() * Math.PI * 2));
  }
}

// Parabolic arc of coins from (x1,y1) to (x2,y2), peaking upward by arcH px.
// Doubles as a readable "this is the path" hint over every jump.
function arcCoins(coins, x1, y1, x2, y2, n, rng, arcH = 55) {
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    const x = lerp(x1, x2, t) - 8;
    const y = lerp(y1, y2, t) - arcH * Math.sin(Math.PI * t) - 8;
    coins.push(mkCoin(x, y, rng() * Math.PI * 2));
  }
}

// ─── BUILDER ───────────────────────────────────────────────────────────────
// A cursor that walks left→right. `x` is the right edge of the last placed
// surface, `y` is the top of that surface (where the player would stand).
// Segments append to it and leave the cursor on their final landing spot, so
// any two segments connect cleanly — that's what gives levels a deliberate,
// hand-built flow instead of one long random walk.

// Place a single platform `gap` px past the cursor, at height `y`, with a coin
// arc tracing the jump. Returns the platform.
function connect(b, gap, y, w, type, arcH, coinN) {
  y = clamp(y, TOP, FLOOR);
  y = Math.max(y, b.y - MAX_RISE); // never demand more than one jump's worth of climb
  if (b.low) y = Math.max(y, FLOOR - 175); // terrain stages: keep platforms near the ground
  const fromX = b.x, fromY = b.y;
  const pl = mkP(b.x + gap, y, w, type || 'normal');
  b.plats.push(pl);
  if (coinN > 0) arcCoins(b.coins, fromX, fromY, pl.x + pl.w / 2, y, coinN, b.rng, arcH == null ? 50 : arcH);
  b.x = pl.x + pl.w; b.y = y;
  return pl;
}

// Add a row of spikes. dir 'up' sits on a surface (jump over it); dir 'down'
// hangs from a ceiling (don't jump into it).
function addSpikes(b, x, topY, count, dir, size) {
  size = size || 20;
  for (let i = 0; i < count; i++) {
    const y = dir === 'down' ? topY : topY - size;
    b.hazards.push({ x: Math.round(x + i * size), y: Math.round(y), w: size, h: size, dir });
  }
}

// ─── SEGMENTS ────────────────────────────────────────────────────────────────
// Each segment is one recognizable, intentional challenge. They are tuned by an
// effective difficulty `e` (0..1) so the same segment reads as gentle early and
// brutal late. Signature: (b, e).

// Safe breather — used to pace the level so it has rhythm, not a wall of hazards.
function segRest(b, e) {
  const gap = lerp(70, 95, e);
  const w = lerp(195, 150, e);
  const y = clamp(b.y + (b.rng() - 0.5) * 36, TOP + 130, FLOOR);
  const pl = connect(b, gap, y, w, 'normal', 38, 0);
  nCoins(b.coins, pl, 3, b.rng);
}

// Rhythm jumps — evenly spaced equal platforms. Clean, metronomic.
function segGapRun(b, e) {
  const n = 3 + Math.floor(b.rng() * 3);
  const gap = lerp(115, 200, e);
  const w = lerp(135, 80, e);
  const baseY = clamp(b.y - lerp(0, 45, e), TOP + 90, FLOOR);
  for (let i = 0; i < n; i++) {
    connect(b, gap + b.rng() * 18, baseY + (b.rng() - 0.5) * 32, w, 'normal', 52, 2);
  }
}

// Ascending staircase — uniform steps, one coin per step.
function segStairsUp(b, e) {
  const n = 4 + Math.floor(b.rng() * 3);
  const rise = lerp(48, 78, e);
  const gap = lerp(78, 116, e);
  const w = lerp(120, 74, e);
  for (let i = 0; i < n; i++) connect(b, gap, b.y - rise, w, 'normal', 28, 1);
}

// Descending staircase — quick drops are free, so this is a tempo break.
function segStairsDown(b, e) {
  const n = 4 + Math.floor(b.rng() * 3);
  const drop = lerp(42, 92, e);
  const gap = lerp(82, 124, e);
  const w = lerp(122, 76, e);
  for (let i = 0; i < n; i++) connect(b, gap, b.y + drop, w, 'normal', 24, 1);
}

// Precision pillars — narrow posts alternating around a center line.
function segPillars(b, e) {
  const n = 4 + Math.floor(b.rng() * 4);
  const w = lerp(74, 44, e);
  const gap = lerp(96, 150, e);
  const amp = lerp(28, 70, e);
  const center = clamp(b.y - 18, TOP + 130, FLOOR - 40);
  for (let i = 0; i < n; i++) {
    connect(b, gap, center + (i % 2 ? amp : -amp), w, 'normal', 58, 1);
  }
}

// Zigzag climb — alternating up/down while gaining altitude.
function segZigzag(b, e) {
  const n = 4 + Math.floor(b.rng() * 3);
  const w = lerp(96, 60, e);
  const gap = lerp(90, 140, e);
  let up = true;
  for (let i = 0; i < n; i++) {
    const dy = up ? -lerp(40, 72, e) : lerp(20, 42, e);
    connect(b, gap, b.y + dy, w, 'normal', 54, 1);
    up = !up;
  }
}

// Long leaps — a couple of near-max double-jump gaps with a fat coin trail.
function segLongLeap(b, e) {
  const n = 2 + Math.floor(b.rng() * 2);
  const gap = lerp(185, 248, e);
  const w = lerp(140, 92, e);
  for (let i = 0; i < n; i++) {
    connect(b, gap + b.rng() * 8, b.y + (b.rng() - 0.5) * 56, w, 'normal', 82, 4);
  }
}

// Descent shaft — controlled drop down a stack of ledges.
function segDescentDrop(b, e) {
  const n = 2 + Math.floor(b.rng() * 2);
  const w = lerp(112, 72, e);
  for (let i = 0; i < n; i++) {
    connect(b, lerp(58, 92, e), b.y + lerp(70, 120, e), w, 'normal', 22, 1);
  }
}

// Ground run studded with spike clusters you must hop over.
function segSpikePath(b, e) {
  connect(b, lerp(42, 72, e), FLOOR, 92, 'normal', 30, 1); // step down to ground level
  const runLen = lerp(520, 820, e);
  const gx = b.x + 8;
  b.plats.push(mkGround(gx, runLen));
  const clusters = 2 + Math.floor(e * 3 + b.rng() * 2);
  for (let k = 0; k < clusters; k++) {
    const cxk = gx + runLen * (k + 1) / (clusters + 1) - 20;
    const cnt = 1 + Math.floor(e * 2 + b.rng() * 2);
    addSpikes(b, cxk, GROUND_Y, cnt, 'up', 20);
    arcCoins(b.coins, cxk - 22, GROUND_Y - 20, cxk + cnt * 20 + 22, GROUND_Y - 20, 3, b.rng, 62);
  }
  b.x = gx + runLen; b.y = GROUND_Y;
}

// Horizontal moving platform ferrying you across a void. Timing puzzle.
function segMovingBridge(b, e) {
  connect(b, lerp(80, 110, e), b.y + (b.rng() - 0.5) * 28, lerp(120, 90, e), 'normal', 40, 1);
  const range = lerp(140, 240, e);
  const mw = lerp(96, 64, e);
  const my = clamp(b.y + (b.rng() - 0.5) * 18, TOP + 80, FLOOR);
  const baseX = b.x + lerp(40, 70, e);
  const mp = mkP(baseX, my, mw, 'move');
  mp.move = { axis: 'x', baseX, baseY: my, max: baseX + range, speed: lerp(1.4, 2.4, e), phase: b.rng() * 6.28 };
  b.plats.push(mp);
  const landX = baseX + range + lerp(150, 230, e);
  const ly = clamp(my + (b.rng() - 0.5) * 28, TOP + 80, FLOOR);
  const lp = mkP(landX, ly, lerp(130, 92, e), 'normal');
  b.plats.push(lp);
  arcCoins(b.coins, baseX, my, landX, ly, 4, b.rng, 50);
  nCoins(b.coins, lp, 2, b.rng);
  b.x = lp.x + lp.w; b.y = ly;
}

// Vertical elevator lifting you up a shaft to a higher ledge.
function segElevator(b, e) {
  connect(b, lerp(80, 110, e), Math.min(FLOOR, b.y + lerp(0, 40, e)), lerp(120, 90, e), 'normal', 40, 1);
  const bottom = b.y;
  const rise = lerp(120, 205, e);
  const top = clamp(bottom - rise, TOP + 40, FLOOR);
  const mw = lerp(102, 70, e);
  const baseX = b.x + lerp(50, 80, e);
  const mp = mkP(baseX, bottom, mw, 'move');
  mp.move = { axis: 'y', baseX, baseY: bottom, max: top, speed: lerp(1.0, 1.7, e), phase: 0 };
  b.plats.push(mp);
  const lp = mkP(baseX + mw + lerp(40, 70, e), top, lerp(122, 86, e), 'normal');
  b.plats.push(lp);
  for (let i = 0; i < 4; i++) {
    b.coins.push(mkCoin(baseX + mw / 2 - 8, bottom - (i + 1) * (rise / 5), b.rng() * 6.28));
  }
  nCoins(b.coins, lp, 2, b.rng);
  b.x = lp.x + lp.w; b.y = top;
}

// Low corridor with ceiling spikes — a single jump clears each gap, but a
// double jump skewers you. Punishes panic-jumping.
function segGauntlet(b, e) {
  const n = 3 + Math.floor(b.rng() * 2);
  const w = lerp(112, 78, e);
  const gap = lerp(80, 120, e);
  for (let i = 0; i < n; i++) {
    const pl = connect(b, gap, clamp(b.y + (b.rng() - 0.5) * 18, FLOOR - 70, FLOOR), w, 'normal', 26, 1);
    const ceilY = pl.y - lerp(178, 150, e); // high enough that a single jump clears, a double doesn't
    addSpikes(b, pl.x + 6, ceilY, Math.max(2, Math.floor(pl.w / 20) - 1), 'down', 18);
  }
}

// Crumbling platforms that fall away seconds after you touch them — keep moving.
function segCrumbleRun(b, e) {
  const n = 3 + Math.floor(b.rng() * 3);
  const w = lerp(98, 66, e);
  const gap = lerp(95, 148, e);
  for (let i = 0; i < n; i++) {
    connect(b, gap, b.y + (b.rng() - 0.5) * 28, w, 'crumble', 50, 1);
  }
  connect(b, gap, b.y, lerp(122, 92, e), 'normal', 40, 2); // solid landing to recover
}

// One big leap over an open spike pit — miss and you're impaled.
function segSpikeLeap(b, e) {
  connect(b, lerp(80, 110, e), b.y, lerp(110, 82, e), 'normal', 28, 1);
  const gap = lerp(190, 250, e);
  const pitX = b.x + 30;
  const pitW = gap - 30;
  const sCount = Math.max(2, Math.floor(pitW / 22));
  addSpikes(b, pitX, GROUND_Y, sCount, 'up', 22);
  connect(b, gap, b.y + (b.rng() - 0.5) * 28, lerp(122, 92, e), 'normal', 86, 4);
}

// Reward vault — a wide safe platform with a patterned coin payout. Adds
// authored "set piece" flavor and a moment to breathe.
function segCoinVault(b, e) {
  const pl = connect(b, lerp(70, 100, e), clamp(b.y + (b.rng() - 0.5) * 28, TOP + 130, FLOOR), lerp(210, 160, e), 'normal', 40, 0);
  arcCoins(b.coins, pl.x + 12, pl.y - 8, pl.x + pl.w - 12, pl.y - 8, 6, b.rng, 72);
  nCoins(b.coins, pl, 4, b.rng);
}

// Final approach — a generous platform that hosts the exit door.
function segFinish(b) {
  const pl = connect(b, 105, clamp(b.y, TOP + 130, FLOOR), 210, 'normal', 45, 0);
  nCoins(b.coins, pl, 5, b.rng);
}

// ─── SEGMENT TABLE & SELECTION ───────────────────────────────────────────────
// tier: 0 easy, 1 medium, 2 hard. gate: minimum global progress before a
// mechanic is allowed to appear (so stage 1 doesn't open with crumble + spikes).
const SEGMENTS = [
  { id: 'gap', fn: segGapRun, tier: 0, gate: 0 },
  { id: 'stairsUp', fn: segStairsUp, tier: 0, gate: 0 },
  { id: 'stairsDown', fn: segStairsDown, tier: 0, gate: 0 },
  { id: 'coinVault', fn: segCoinVault, tier: 0, gate: 0 },
  { id: 'pillars', fn: segPillars, tier: 1, gate: 0 },
  { id: 'zigzag', fn: segZigzag, tier: 1, gate: 0 },
  { id: 'longLeap', fn: segLongLeap, tier: 1, gate: 0 },
  { id: 'descent', fn: segDescentDrop, tier: 1, gate: 0 },
  { id: 'spikePath', fn: segSpikePath, tier: 1, gate: 0.03 },
  { id: 'movingBridge', fn: segMovingBridge, tier: 2, gate: 0.06 },
  { id: 'elevator', fn: segElevator, tier: 2, gate: 0.06 },
  { id: 'gauntlet', fn: segGauntlet, tier: 2, gate: 0.10 },
  { id: 'crumble', fn: segCrumbleRun, tier: 2, gate: 0.16 },
  { id: 'spikeLeap', fn: segSpikeLeap, tier: 2, gate: 0.20 },
];

function pickSegment(b, e, last, prof) {
  const allow = prof && prof.pool;
  const ok = s => b.p >= s.gate && s.fn !== last && (!allow || allow.includes(s.id));
  const desired = e < 0.34 ? 0 : e < 0.66 ? 1 : 2;
  let pool = SEGMENTS.filter(s => ok(s) && s.tier <= desired && s.tier >= desired - 1);
  if (!pool.length) pool = SEGMENTS.filter(s => ok(s) && s.tier <= desired);
  if (!pool.length) pool = SEGMENTS.filter(s => b.p >= s.gate && (!allow || allow.includes(s.id)));
  if (!pool.length) pool = SEGMENTS.filter(s => b.p >= s.gate);
  if (!pool.length) pool = [SEGMENTS[0]];
  return pool[Math.floor(b.rng() * pool.length)];
}

// ─── LEVEL ASSEMBLY ──────────────────────────────────────────────────────────
// Builds the level as an intentional arc: warm-up → escalating challenges
// (paced with breathers) → a hard climax → the exit approach. Difficulty ramps
// both across the 500 levels (global `p`) and within each level (local `e`).
function buildLevel(rng, p, stageIdx) {
  const prof = getProfile(stageIdx);
  const b = { rng, p, x: 220, y: FLOOR, plats: [], coins: [], hazards: [], low: !!prof.low };

  // Gentle on-ramp for the opening levels: the first ~15 levels (the start of
  // Meadow) begin short and easy, then ramp up to the full length/difficulty
  // curve. `introT` is 0 on level 1 and reaches 1 by ~level 16.
  const idx = Math.round(p * 499);            // global level index 0..499
  const introT = clamp(idx / 15, 0, 1);
  const baseW = lerp(5500, 24000, p);         // full-curve length for this progress
  const targetW = lerp(1800, baseW, introT);  // much shorter while easing in

  // Boss levels: every 10th level (10/20/30/40/50 of each stage) is a short
  // approach into a very large arena platform holding the stage boss. The exit
  // stays locked until the boss is defeated (gated in entities.js/main.js).
  if (idx % 10 === 9) {
    segRest(b, 0.15);
    const seg = pickSegment(b, 0.3, null, prof);
    seg.fn(b, 0.3);
    segRest(b, 0.2);
    const arena = mkP(b.x + 100, clamp(b.y + 40, TOP + 150, FLOOR), 1150, 'normal');
    b.plats.push(arena);
    arcCoins(b.coins, b.x, b.y, arena.x + 90, arena.y, 3, rng, 55);
    b.x = arena.x + arena.w; b.y = arena.y;
    b.arena = arena;
    segFinish(b);
    return b;
  }

  segRest(b, 0.08); // gentle landing right after the start pad

  let last = null;
  let sinceRest = 0;
  let guard = 0;
  while (b.x < targetW - 900 && guard++ < 600) {
    const f = clamp(b.x / targetW, 0, 1);
    const localE = lerp(0.12, 1.0, f);
    let e = clamp(p * 0.45 + localE * 0.55, 0, 1);
    e *= 0.5 + 0.5 * introT; // hold the opening levels down in the easy tier

    // Insert a breather every few segments so the level has rhythm.
    if (sinceRest >= 2 + Math.floor(rng() * 2)) {
      segRest(b, e); sinceRest = 0; continue;
    }

    const seg = pickSegment(b, e, last, prof);
    seg.fn(b, e);
    last = seg.fn;
    sinceRest++;
  }

  // Climax: a deliberately hard set piece right before the finish — but eased
  // way down during the on-ramp, and skipped entirely on the first few levels
  // so they stay short and end gently instead of on a wall.
  if (introT >= 0.2) {
    const climaxE = clamp((p * 0.5 + 0.88) * (0.35 + 0.65 * introT), 0, 1);
    const climax = pickSegment(b, climaxE, last, prof);
    climax.fn(b, climaxE);
  }

  segFinish(b);
  return b;
}

// ─── ENEMY PLACEMENT ─────────────────────────────────────────────────────
// Scatters enemies across the finished geometry. Ground-bound foes patrol the
// platform they spawn on; flyers hover in wide gaps. Count, HP and type variety
// all scale with global progress `p`, and the start pad + exit platform stay
// clear so spawns and finishes are safe.
function makeGroundFoe(pl, rng, p, roster) {
  if (!roster.ground.length) return null;
  const base = SPECIES[pickSpecies(roster.ground, rng)](p);
  if (pl.w < base.w + 24) return null; // platform too small to patrol
  const min = pl.x + 4;
  const max = pl.x + pl.w - 4 - base.w;
  const e = {
    ...base, x: Math.round(lerp(min, max, rng())), y: Math.round(pl.y - base.h),
    dir: rng() < 0.5 ? -1 : 1, phase: rng() * 6.28,
    patrolMin: Math.round(min), patrolMax: Math.round(max),
  };
  if (base.behavior === 'hop') e.baseY = e.y;
  if (base.behavior === 'shoot') { e.patrolMin = e.patrolMax = e.x; } // emplaced gun
  return e;
}

function placeEnemies(platforms, rng, p, exitPlat, stageIdx) {
  const prof = getProfile(stageIdx);
  const roster = STAGE_ROSTER[((stageIdx % 10) + 10) % 10];
  const enemies = [];
  if (p < 0.012) return enemies; // very first level stays enemy-free
  const density = lerp(0.12, 0.6, p);
  const CAP = 46;
  const exitCx = exitPlat.x + exitPlat.w / 2;

  // Builders for air dwellers (hover over gaps) and hang species (anchored
  // above a walkway: falling icicles, thread spiders).
  const mkAir = (sp, midX, baseY, gap) => {
    const base = SPECIES[sp](p);
    const e = {
      ...base, x: Math.round(midX), y: Math.round(baseY),
      dir: 1, phase: rng() * 6.28, patrolMin: 0, patrolMax: 0,
      baseX: Math.round(midX), baseY: Math.round(baseY),
    };
    if (base.behavior === 'fly') {
      e.ampX = Math.min(gap * 0.3, 120); e.ampY = lerp(15, 42, p);
      e.sx = 0.8 + rng() * 0.9; e.sy = 1.4 + rng() * 1.1;
    }
    return e;
  };
  const mkHang = (sp, cx, platTop) => {
    const base = SPECIES[sp](p);
    const anchorY = Math.round(clamp(platTop - lerp(160, 215, rng()), TOP + 8, platTop - 120));
    return {
      ...base, x: Math.round(cx - base.w / 2), y: anchorY,
      dir: 1, phase: rng() * 6.28, patrolMin: 0, patrolMax: 0,
      baseX: Math.round(cx), baseY: anchorY, anchorY,
      dropY: Math.round(platTop - base.h - 6),
    };
  };

  // Ground patrollers on solid platforms / ground runs.
  for (const pl of platforms) {
    if (enemies.length >= CAP || !roster.ground.length) break;
    if (pl === exitPlat) continue;
    if (pl.type === 'move' || pl.type === 'crumble') continue; // unstable footing
    if (pl.type !== 'ground' && pl.type !== 'normal') continue;

    // A wide continuous floor (grounded stages) gets several foes spaced along it
    // rather than a single one, so terrain levels feel populated.
    if (pl.type === 'ground' && pl.w > 360) {
      const slots = Math.min(8, Math.floor(pl.w / 360));
      for (let s = 0; s < slots && enemies.length < CAP; s++) {
        const cx = pl.x + pl.w * (s + 0.5) / slots;
        if (cx < 340) continue;                          // keep the opening safe
        if (Math.abs(cx - exitCx) < 200) continue;        // keep the finish safe
        if (rng() >= density) continue;
        const e = makeGroundFoe({ x: Math.round(cx - 60), y: pl.y, w: 120 }, rng, p, roster);
        if (e) enemies.push(e);
      }
      continue;
    }

    if (pl.x < 320) continue;            // keep the opening safe
    if (pl.w < 50) continue;
    if (rng() >= density) continue;
    const e = makeGroundFoe(pl, rng, p, roster);
    if (e) enemies.push(e);
  }

  // Hang species anchored above walkways (drop on / descend at the player).
  if (roster.hang.length) {
    for (const pl of platforms) {
      if (enemies.length >= CAP) break;
      if (pl === exitPlat) continue;
      if (pl.type === 'ground' && pl.w > 480) {
        const slots = Math.min(6, Math.floor(pl.w / 480));
        for (let s = 0; s < slots && enemies.length < CAP; s++) {
          const cx = pl.x + pl.w * (s + 0.5) / slots;
          if (cx < 380 || Math.abs(cx - exitCx) < 220) continue;
          if (rng() >= density * 0.55) continue;
          enemies.push(mkHang(pickSpecies(roster.hang, rng), cx, pl.y));
        }
      } else if (pl.type === 'normal' && pl.w >= 70 && pl.x > 360) {
        if (rng() >= density * 0.5) continue;
        const cx = pl.x + pl.w * (0.25 + rng() * 0.5);
        if (Math.abs(cx - exitCx) < 220) continue;
        enemies.push(mkHang(pickSpecies(roster.hang, rng), cx, pl.y));
      }
    }
  }

  // Air dwellers over gaps — frequency and gap tolerance scale with the stage's
  // flyerFreq (cave bats and sky birds are common; desert vultures rare).
  const flyFreq = prof.flyerFreq || 1;
  if (roster.air.length && p >= 0.04 && flyFreq > 0) {
    const minGap = 200 / Math.max(0.6, flyFreq);
    const sorted = platforms.filter(pl => pl.type !== 'move' && pl.type !== 'ground').slice().sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length && enemies.length < CAP; i++) {
      const a = sorted[i - 1], b = sorted[i];
      const gap = b.x - (a.x + a.w);
      if (gap < minGap) continue;
      if (rng() >= clamp(lerp(0.1, 0.5, p) * flyFreq, 0, 0.85)) continue;
      const midX = a.x + a.w + gap / 2;
      const baseY = clamp(Math.min(a.y, b.y) - lerp(45, 95, p), TOP + 30, FLOOR - 40);
      enemies.push(mkAir(pickSpecies(roster.air, rng), midX, baseY, gap));
    }
  }

  return enemies;
}

export function generateLevel(stageIdx, levelIdx) {
  const seed = stageIdx * 50 + levelIdx + 1;
  const rng = mulberry32(seed);
  const p = (stageIdx * 50 + levelIdx) / 499;

  const { plats, coins, hazards, arena } = buildLevel(rng, p, stageIdx);
  const prof = getProfile(stageIdx);

  // Starting safe platform (always present; player spawns here).
  const startPlat = { x: 40, y: FLOOR, w: 180, h: 20, type: 'normal' };
  const platforms = [startPlat, ...plats];

  let maxRight = 0;
  for (const pl of platforms) maxRight = Math.max(maxRight, pl.x + pl.w);
  const width = Math.round(maxRight + 240);

  // Exit on the rightmost solid (normal) platform — segFinish guarantees one.
  const normals = platforms.filter(pl => pl.type === 'normal' && pl.x > 200);
  normals.sort((a, b) => (b.x + b.w) - (a.x + a.w));
  const lastPlat = normals[0] || startPlat;
  const exit = {
    x: Math.round(lastPlat.x + lastPlat.w / 2 - 20),
    y: Math.round(lastPlat.y - 60),
    w: 40, h: 60,
  };

  // Grounded biomes get a continuous floor so a missed jump lands on terrain
  // instead of falling into a death-void (added after exit/width are fixed so it
  // doesn't affect either; it only catches falls and hosts ground-patrol foes).
  if (prof.grounded) platforms.push(mkGround(0, width));

  const enemies = placeEnemies(platforms, rng, p, lastPlat, stageIdx);

  // Boss levels: clear the arena of regular foes and field the stage boss.
  if (arena) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].x > arena.x - 60 && enemies[i].x < arena.x + arena.w + 60) enemies.splice(i, 1);
    }
    enemies.push(makeBoss(stageIdx, p, arena));
  }

  return { width, height: GH, platforms, coins, hazards, enemies, exit, stageIdx, levelIdx };
}

export function getPlayerSpawn(levelData) {
  const sp = levelData.platforms.find(p => p.x === 40 && p.type === 'normal');
  if (sp) return { x: sp.x + 20, y: sp.y - 42 };
  return { x: 80, y: GROUND_Y - 42 };
}

// ─── DYNAMIC PLATFORMS (moving + crumbling) ──────────────────────────────────

function movingPos(m, t) {
  const osc = Math.sin(t * m.speed) * 0.5 + 0.5; // 0..1, eases at the ends
  if (m.axis === 'x') return { x: m.baseX + osc * (m.max - m.baseX), y: m.baseY };
  return { x: m.baseX, y: m.baseY + osc * (m.max - m.baseY) };
}

// Reset every moving/crumbling platform to its starting state. Call on level
// start and on every respawn so a death gives a clean slate.
export function resetDynamics(levelData) {
  for (const p of levelData.platforms) {
    if (p.type === 'move' && p.move) {
      const t0 = p.move.phase || 0;
      const pos = movingPos(p.move, t0);
      p.x = Math.round(pos.x); p.y = Math.round(pos.y);
      p._t = t0; p._dx = 0; p._dy = 0;
    } else if (p.type === 'crumble') {
      p._crumbleState = 0; p._crumbleT = 0;
    }
  }
}

// Advance moving platforms (storing per-frame delta for player carry) and tick
// crumble timers. Must run before updatePlayer each frame.
export function updateDynamics(dt, levelData) {
  for (const p of levelData.platforms) {
    if (p.type === 'move' && p.move) {
      p._t = (p._t || 0) + dt;
      const prevX = p.x, prevY = p.y;
      const pos = movingPos(p.move, p._t);
      p.x = pos.x; p.y = pos.y;
      p._dx = p.x - prevX; p._dy = p.y - prevY;
    } else if (p.type === 'crumble') {
      if (p._crumbleState === 1) {
        p._crumbleT -= dt;
        if (p._crumbleT <= 0) { p._crumbleState = 2; p._crumbleT = CRUMBLE_REGEN; }
      } else if (p._crumbleState === 2) {
        p._crumbleT -= dt;
        if (p._crumbleT <= 0) { p._crumbleState = 0; }
      }
    }
  }
}

// ─── HAZARDS ─────────────────────────────────────────────────────────────────

// Slightly forgiving spike collision (inset hitbox) so near-misses survive.
export function hazardHit(player, hazards) {
  if (!hazards) return false;
  const px = player.x + 4, pw = player.w - 8;
  const py = player.y + 3, ph = player.h - 5;
  for (const h of hazards) {
    const hx = h.x + 4, hw = h.w - 8;
    const hy = h.dir === 'down' ? h.y : h.y + 5;
    const hh = h.h - 6;
    if (px < hx + hw && px + pw > hx && py < hy + hh && py + ph > hy) return true;
  }
  return false;
}

// ─── RENDERING ───────────────────────────────────────────────────────────────

export function drawPlatforms(ctx, platforms, stage, t = 0) {
  const theme = getTheme(stage);
  for (const p of platforms) {
    if (p.type === 'ground') {
      ctx.fillStyle = theme.groundColor;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      continue;
    }
    if (p.type === 'crumble') {
      if (p._crumbleState === 2) continue; // gone
      const shake = p._crumbleState === 1 ? (Math.sin(t * 60) * 1.5) : 0;
      const x = p.x + shake;
      ctx.fillStyle = p._crumbleState === 1 ? '#8a5a3a' : '#7a6a52';
      ctx.fillRect(x, p.y + 5, p.w, p.h - 5);
      ctx.fillStyle = p._crumbleState === 1 ? '#b07a4a' : '#9a8a6a';
      ctx.fillRect(x, p.y, p.w, 6);
      // crack lines
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + p.w * 0.3, p.y); ctx.lineTo(x + p.w * 0.4, p.y + p.h);
      ctx.moveTo(x + p.w * 0.7, p.y); ctx.lineTo(x + p.w * 0.62, p.y + p.h);
      ctx.stroke();
      continue;
    }
    if (p.type === 'move') {
      // metallic platform with bolt studs + a directional tint
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(p.x, p.y + 5, p.w, p.h - 5);
      ctx.fillStyle = '#7a8aa0';
      ctx.fillRect(p.x, p.y, p.w, 6);
      ctx.fillStyle = theme.accentColor;
      ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3);
      ctx.fillStyle = '#2e3744';
      for (let bx = p.x + 6; bx < p.x + p.w - 4; bx += 16) {
        ctx.fillRect(bx, p.y + 9, 3, 3);
      }
      continue;
    }
    // normal
    ctx.fillStyle = theme.platColor;
    ctx.fillRect(p.x, p.y + 5, p.w, p.h - 5);
    ctx.fillStyle = theme.platTopColor;
    ctx.fillRect(p.x, p.y, p.w, 6);
    ctx.fillStyle = theme.platSide;
    ctx.fillRect(p.x, p.y, 4, p.h);
    ctx.fillRect(p.x + p.w - 4, p.y, 4, p.h);
  }
}

export function drawHazards(ctx, hazards, stage) {
  if (!hazards || !hazards.length) return;
  const spikeCol = getTheme(stage).spikeColor || '#c0392b';
  for (const h of hazards) {
    const x = h.x, y = h.y, w = h.w, hh = h.h;
    ctx.fillStyle = spikeCol;
    ctx.beginPath();
    if (h.dir === 'down') {
      ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w / 2, y + hh);
    } else {
      ctx.moveTo(x, y + hh); ctx.lineTo(x + w, y + hh); ctx.lineTo(x + w / 2, y);
    }
    ctx.closePath();
    ctx.fill();
    // metallic highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    if (h.dir === 'down') {
      ctx.moveTo(x + w * 0.5, y); ctx.lineTo(x + w * 0.62, y); ctx.lineTo(x + w / 2, y + hh);
    } else {
      ctx.moveTo(x + w * 0.5, y + hh); ctx.lineTo(x + w * 0.5, y); ctx.lineTo(x + w * 0.62, y + hh);
    }
    ctx.closePath();
    ctx.fill();
  }
}

// ─── COLLISION ───────────────────────────────────────────────────────────────

function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

export function resolveX(player, platforms) {
  for (const p of platforms) {
    if (p.type === 'ground') continue;
    if (p._crumbleState === 2) continue; // crumbled away
    if (!aabbOverlap(player, p)) continue;
    const mid = player.x + player.w / 2;
    if (mid < p.x + p.w / 2) player.x = p.x - player.w;
    else player.x = p.x + p.w;
    player.vx = 0;
  }
}

export function resolveY(player, platforms) {
  let onGround = false;
  player._groundPlat = null;
  const prevBottom = player._prevY + player.h;

  for (const p of platforms) {
    if (p._crumbleState === 2) continue; // crumbled away
    if (player.x + player.w <= p.x || player.x >= p.x + p.w) continue;
    const platTop = p.y, platBottom = p.y + p.h;

    if (player.vy >= 0) {
      if (prevBottom <= platTop + 4 && player.y + player.h >= platTop) {
        player.y = platTop - player.h;
        player.vy = 0;
        onGround = true;
        player._groundPlat = p;
        if (p.type === 'crumble' && p._crumbleState === 0) {
          p._crumbleState = 1; p._crumbleT = CRUMBLE_DELAY;
        }
      }
    } else {
      if (player.y < platBottom && player.y + player.h > platBottom) {
        player.y = platBottom;
        player.vy = Math.max(0, player.vy);
      }
    }
  }
  return onGround;
}
