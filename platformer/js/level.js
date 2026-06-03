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
  { fn: segGapRun, tier: 0, gate: 0 },
  { fn: segStairsUp, tier: 0, gate: 0 },
  { fn: segStairsDown, tier: 0, gate: 0 },
  { fn: segCoinVault, tier: 0, gate: 0 },
  { fn: segPillars, tier: 1, gate: 0 },
  { fn: segZigzag, tier: 1, gate: 0 },
  { fn: segLongLeap, tier: 1, gate: 0 },
  { fn: segDescentDrop, tier: 1, gate: 0 },
  { fn: segSpikePath, tier: 1, gate: 0.03 },
  { fn: segMovingBridge, tier: 2, gate: 0.06 },
  { fn: segElevator, tier: 2, gate: 0.06 },
  { fn: segGauntlet, tier: 2, gate: 0.10 },
  { fn: segCrumbleRun, tier: 2, gate: 0.16 },
  { fn: segSpikeLeap, tier: 2, gate: 0.20 },
];

function pickSegment(b, e, last) {
  const desired = e < 0.34 ? 0 : e < 0.66 ? 1 : 2;
  let pool = SEGMENTS.filter(s => b.p >= s.gate && s.tier <= desired && s.tier >= desired - 1 && s.fn !== last);
  if (!pool.length) pool = SEGMENTS.filter(s => b.p >= s.gate && s.tier <= desired && s.fn !== last);
  if (!pool.length) pool = SEGMENTS.filter(s => b.p >= s.gate);
  if (!pool.length) pool = [SEGMENTS[0]];
  return pool[Math.floor(b.rng() * pool.length)];
}

// ─── LEVEL ASSEMBLY ──────────────────────────────────────────────────────────
// Builds the level as an intentional arc: warm-up → escalating challenges
// (paced with breathers) → a hard climax → the exit approach. Difficulty ramps
// both across the 500 levels (global `p`) and within each level (local `e`).
function buildLevel(rng, p) {
  const b = { rng, p, x: 220, y: FLOOR, plats: [], coins: [], hazards: [] };
  const targetW = lerp(5500, 24000, p); // 5× the old 1100→4800 range

  segRest(b, 0.08); // gentle landing right after the start pad

  let last = null;
  let sinceRest = 0;
  let guard = 0;
  while (b.x < targetW - 900 && guard++ < 600) {
    const f = clamp(b.x / targetW, 0, 1);
    const localE = lerp(0.12, 1.0, f);
    const e = clamp(p * 0.45 + localE * 0.55, 0, 1);

    // Insert a breather every few segments so the level has rhythm.
    if (sinceRest >= 2 + Math.floor(rng() * 2)) {
      segRest(b, e); sinceRest = 0; continue;
    }

    const seg = pickSegment(b, e, last);
    seg.fn(b, e);
    last = seg.fn;
    sinceRest++;
  }

  // Climax: a deliberately hard set piece right before the finish.
  const climaxE = clamp(p * 0.5 + 0.88, 0, 1);
  const climax = pickSegment(b, climaxE, last);
  climax.fn(b, climaxE);

  segFinish(b);
  return b;
}

// ─── ENEMY PLACEMENT ─────────────────────────────────────────────────────
// Scatters enemies across the finished geometry. Ground-bound foes patrol the
// platform they spawn on; flyers hover in wide gaps. Count, HP and type variety
// all scale with global progress `p`, and the start pad + exit platform stay
// clear so spawns and finishes are safe.
function makeGroundEnemy(pl, rng, p) {
  const top = pl.y; // player-stand height of this platform
  const roll = rng();
  let type, w, h, hp, speed, color, jumpForce, jumpEvery;
  if (p > 0.40 && roll < 0.18) {
    type = 'brute'; w = 40; h = 38; hp = 5 + Math.floor(p * 7);
    speed = lerp(28, 66, p); color = '#6c5ce7';
  } else if (p > 0.25 && roll < 0.42) {
    type = 'jumper'; w = 24; h = 24; hp = 2 + Math.floor(p * 3);
    speed = lerp(30, 70, p); color = '#16a085';
    jumpForce = lerp(360, 480, p); jumpEvery = lerp(1.8, 1.0, p);
  } else {
    type = 'walker'; w = 26; h = 24; hp = 1 + Math.floor(p * 3);
    speed = lerp(45, 108, p); color = '#c0392b';
  }
  if (pl.w < w + 24) return null; // platform too small to patrol
  const min = pl.x + 4;
  const max = pl.x + pl.w - 4 - w;
  const e = {
    type, x: Math.round(lerp(min, max, rng())), y: Math.round(top - h),
    w, h, hp, dir: rng() < 0.5 ? -1 : 1, speed, color,
    patrolMin: Math.round(min), patrolMax: Math.round(max),
  };
  if (type === 'jumper') { e.baseY = e.y; e.jumpForce = jumpForce; e.jumpEvery = jumpEvery; e.phase = rng() * jumpEvery; }
  return e;
}

function placeEnemies(platforms, rng, p, exitPlat) {
  const enemies = [];
  if (p < 0.012) return enemies; // very first level stays enemy-free
  const density = lerp(0.12, 0.6, p);
  const CAP = 46;

  // Ground-bound enemies on solid platforms / ground runs.
  for (const pl of platforms) {
    if (enemies.length >= CAP) break;
    if (pl === exitPlat) continue;
    if (pl.x < 320) continue;            // keep the opening safe
    if (pl.type === 'move' || pl.type === 'crumble') continue; // unstable footing
    if (pl.type !== 'ground' && pl.type !== 'normal') continue;
    if (pl.w < 50) continue;
    if (rng() >= density) continue;
    const e = makeGroundEnemy(pl, rng, p);
    if (e) enemies.push(e);
  }

  // Flyers hovering in wide gaps.
  if (p >= 0.12) {
    const sorted = platforms.filter(pl => pl.type !== 'move').slice().sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length && enemies.length < CAP; i++) {
      const a = sorted[i - 1], b = sorted[i];
      const gap = b.x - (a.x + a.w);
      if (gap < 200) continue;
      if (rng() >= lerp(0.1, 0.5, p)) continue;
      const midX = a.x + a.w + gap / 2;
      const baseY = clamp(Math.min(a.y, b.y) - lerp(45, 95, p), TOP + 30, FLOOR - 40);
      enemies.push({
        type: 'flyer', x: Math.round(midX), y: Math.round(baseY), w: 34, h: 26,
        hp: 1 + Math.floor(p * 2), dir: 1, color: '#8e44ad',
        baseX: Math.round(midX), baseY: Math.round(baseY),
        ampX: Math.min(gap * 0.3, 120), ampY: lerp(15, 42, p),
        sx: 0.8 + rng() * 0.9, sy: 1.4 + rng() * 1.1, phase: rng() * 6.28,
        patrolMin: 0, patrolMax: 0,
      });
    }
  }

  return enemies;
}

export function generateLevel(stageIdx, levelIdx) {
  const seed = stageIdx * 50 + levelIdx + 1;
  const rng = mulberry32(seed);
  const p = (stageIdx * 50 + levelIdx) / 499;

  const { plats, coins, hazards } = buildLevel(rng, p);

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

  const enemies = placeEnemies(platforms, rng, p, lastPlat);

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
  for (const h of hazards) {
    const x = h.x, y = h.y, w = h.w, hh = h.h;
    ctx.fillStyle = '#c0392b';
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
