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

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function ri(rng, lo, hi) { return Math.round(lerp(lo, hi, rng())); }

function mkPlat(x, y, w) {
  return { x: Math.round(x), y: Math.round(y), w: Math.max(28, Math.round(w)), h: 20, type: 'normal' };
}
function mkGround(x, w) {
  return { x: Math.round(x), y: GROUND_Y, w: Math.max(1, Math.round(w)), h: GH - GROUND_Y, type: 'ground' };
}
function mkCoin(x, y, spin) {
  return { x: Math.round(x), y: Math.round(y), collected: false, spinAngle: spin };
}

function platCoins(coins, plat, rng, chance) {
  if (rng() >= chance) return;
  const n = 1 + Math.floor(rng() * 4);
  const sp = plat.w / (n + 1);
  for (let c = 0; c < n; c++) {
    coins.push(mkCoin(plat.x + sp * (c + 1) - 8, plat.y - 36, rng() * Math.PI * 2));
  }
}

function nCoins(coins, plat, n, rng) {
  const sp = plat.w / (n + 1);
  for (let c = 0; c < n; c++) {
    coins.push(mkCoin(plat.x + sp * (c + 1) - 8, plat.y - 36, rng() * Math.PI * 2));
  }
}

// Parabolic arc of coins from (x1,y1) to (x2,y2), peaking upward by arcH px
function arcCoins(coins, x1, y1, x2, y2, n, rng, arcH = 55) {
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    const x = lerp(x1, x2, t) - 8;
    const y = lerp(y1, y2, t) - arcH * Math.sin(Math.PI * t) - 8;
    coins.push(mkCoin(x, y, rng() * Math.PI * 2));
  }
}

// ─── ARCHETYPE GENERATORS ────────────────────────────────────────────────────
// Each returns { platforms, coins, needsGround, forcedWidth? }
// Caller adds ground and starting platform separately.
// Generators begin placing platforms after x=220 (right edge of starting pad).

// 1. STANDARD — random walk, varied heights
function genStandard(rng, p, lw) {
  const minW = lerp(170, 60, p), maxW = lerp(250, 95, p);
  const minG = lerp(70, 90, p), maxG = lerp(140, 210, p);
  const dy = lerp(50, 140, p);
  const ceil = GROUND_Y - lerp(130, 280, p);
  const platforms = [], coins = [];
  let cx = 220, cy = GROUND_Y - 20;

  while (cx < lw - 380) {
    const gap = lerp(minG, maxG, rng()), w = lerp(minW, maxW, rng());
    const ny = clamp(cy + (rng() - 0.5) * dy * 2, ceil, GROUND_Y - 20);
    const pl = mkPlat(cx + gap, ny, w);
    platforms.push(pl);
    platCoins(coins, pl, rng, 0.65);
    cx = pl.x + pl.w; cy = ny;
  }
  return { platforms, coins, needsGround: true };
}

// 2. STAIRCASE — rhythmic ascending/descending steps, coin arcs show the path
function genStaircase(rng, p, lw) {
  const stepW = lerp(100, 55, p), gap = lerp(70, 100, p), rise = lerp(35, 55, p);
  const ceil = GROUND_Y - lerp(160, 310, p);
  const platforms = [], coins = [];
  let cx = 220, cy = GROUND_Y - 20, ascending = true;

  while (cx < lw - 380) {
    const g = gap + rng() * 22, w = stepW + rng() * 38;
    const ny = ascending
      ? Math.max(ceil, cy - rise - rng() * 18)
      : Math.min(GROUND_Y - 20, cy + rise + rng() * 18);
    const pl = mkPlat(cx + g, ny, w);
    platforms.push(pl);

    // Coin arc from previous platform right edge to new platform centre
    arcCoins(coins, cx, cy, pl.x + w / 2, ny, 3, rng, 38);

    cx = pl.x + pl.w; cy = ny;
    if (ascending && cy <= ceil + 45) ascending = false;
    else if (!ascending && cy >= GROUND_Y - 35) ascending = true;
  }
  return { platforms, coins, needsGround: true };
}

// 3. ZIGZAG — strict high/low alternation, coins at each jump peak
function genZigzag(rng, p, lw) {
  const hiY = GROUND_Y - lerp(155, 305, p);
  const loY = GROUND_Y - lerp(42, 88, p);
  const w = lerp(115, 62, p), gap = lerp(95, 148, p);
  const platforms = [], coins = [];
  let cx = 220, high = false, prevCX = 220, prevCY = GROUND_Y - 20;

  while (cx < lw - 380) {
    const g = gap + rng() * 38, pw = w + rng() * 45;
    const ny = high ? hiY + rng() * 28 : loY + rng() * 22;
    const pl = mkPlat(cx + g, ny, pw);
    platforms.push(pl);

    // Coins forming the jump arc
    arcCoins(coins, prevCX, prevCY, pl.x + pw / 2, ny, 4, rng, high ? 75 : 38);

    prevCX = pl.x + pw / 2; prevCY = ny;
    cx = pl.x + pl.w;
    high = !high;
  }
  return { platforms, coins, needsGround: true };
}

// 4. PIT — ground runs with lethal gaps, coins arc over each chasm
function genPit(rng, p, lw) {
  const numPits = 3 + Math.floor(p * 5 + rng() * 2);
  const groundLen = lerp(175, 105, p);
  const pitW = lerp(125, 230, p);
  const midPlatChance = lerp(0.7, 0.2, p); // fewer mid-pit platforms as it gets harder

  const platforms = [], coins = [];
  let cx = 0;

  // Starting ground
  platforms.push(mkGround(0, 240));

  for (let i = 0; i < numPits; i++) {
    cx = 240 + i * (groundLen + pitW + rng() * 60);

    // Ground run
    const gl = groundLen + rng() * 70;
    platforms.push(mkGround(cx, gl));
    // Coins on the ground run
    const nc = 2 + Math.floor(rng() * 3);
    for (let c = 0; c < nc; c++) {
      coins.push(mkCoin(cx + gl * (c + 1) / (nc + 1) - 8, GROUND_Y - 36, rng() * Math.PI * 2));
    }

    // Pit
    const pw = pitW + rng() * 65;
    const pitX = cx + gl;
    if (rng() < midPlatChance) {
      // Small floating platform mid-pit
      const py = GROUND_Y - lerp(85, 165, p) - rng() * 45;
      const mpw = 48 + rng() * 38;
      const mpl = mkPlat(pitX + (pw - mpw) / 2, py, mpw);
      platforms.push(mpl);
      nCoins(coins, mpl, 2 + Math.floor(rng() * 2), rng);
    } else {
      // Just coins in arc over the void
      arcCoins(coins, pitX, GROUND_Y - 20, pitX + pw, GROUND_Y - 20, 5, rng, 90);
    }
  }

  // Final ground + end pad
  const endX = 240 + numPits * (groundLen + pitW + 60) + 60;
  platforms.push(mkGround(endX, 240));
  const endPl = mkPlat(endX + 50, GROUND_Y - 20, 120);
  platforms.push(endPl);
  nCoins(coins, endPl, 3, rng);

  const fw = endX + 260;
  return { platforms, coins, needsGround: false, forcedWidth: fw };
}

// 5. HIGHRISE — all platforms packed near the ceiling, deadly fall below
function genHighrise(rng, p, lw) {
  const zTop = GROUND_Y - lerp(185, 340, p);
  const zH = lerp(85, 50, p);
  const w = lerp(112, 55, p), gap = lerp(82, 152, p);
  const platforms = [], coins = [];
  let cx = 220, cy = zTop + zH * 0.5;

  while (cx < lw - 380) {
    const g = gap + rng() * 55, pw = w + rng() * 42;
    const ny = clamp(cy + (rng() - 0.5) * zH * 2, zTop, zTop + zH);
    const pl = mkPlat(cx + g, ny, pw);
    platforms.push(pl);

    // Coin above (normal)
    if (rng() < 0.8) coins.push(mkCoin(pl.x + pw / 2 - 8, pl.y - 36, rng() * Math.PI * 2));
    // Coin below platform (risky — must hop off and land on platform below or die)
    if (rng() < 0.28) coins.push(mkCoin(pl.x + pw / 2 - 8, pl.y + 65, rng() * Math.PI * 2));

    cx = pl.x + pl.w; cy = ny;
  }
  return { platforms, coins, needsGround: true };
}

// 6. LONG JUMP — very few platforms, each needs near-maximum jump distance
function genLongJump(rng, p, lw) {
  const gap = lerp(168, 245, p); // near max double-jump range
  const w = lerp(148, 80, p);
  const ceil = GROUND_Y - lerp(135, 265, p);
  const platforms = [], coins = [];
  let cx = 220, cy = GROUND_Y - 20;

  while (cx < lw - 380) {
    const g = gap + rng() * 32, pw = w + rng() * 55;
    const ny = clamp(cy + (rng() - 0.5) * 115, ceil, GROUND_Y - 20);
    const pl = mkPlat(cx + g, ny, pw);
    platforms.push(pl);

    // Generous coin reward on the platform
    nCoins(coins, pl, 3 + Math.floor(rng() * 4), rng);
    // Coin trail showing the jump trajectory
    arcCoins(coins, cx, cy, pl.x + pw / 2, ny, 4, rng, 65);

    cx = pl.x + pl.w; cy = ny;
  }
  return { platforms, coins, needsGround: true };
}

// 7. FLAT BURST — densely packed small platforms at similar heights, fast-paced
function genFlat(rng, p, lw) {
  const baseY = GROUND_Y - lerp(85, 205, p);
  const w = lerp(68, 38, p), gap = lerp(38, 68, p);
  const wobble = lerp(22, 55, p);
  const ceil = GROUND_Y - lerp(250, 360, p);
  const platforms = [], coins = [];
  let cx = 220;

  while (cx < lw - 380) {
    const g = gap + rng() * 28, pw = w + rng() * 42;
    const ny = clamp(baseY + (rng() - 0.5) * wobble * 2, ceil, GROUND_Y - 22);
    const pl = mkPlat(cx + g, ny, pw);
    platforms.push(pl);
    if (rng() < 0.55) coins.push(mkCoin(pl.x + pw / 2 - 8, pl.y - 36, rng() * Math.PI * 2));
    cx = pl.x + pl.w;
  }
  return { platforms, coins, needsGround: true };
}

// 8. TOWER — approach run, then zigzag vertical climb, coin jackpot at top
function genTower(rng, p, lw) {
  const tW = lerp(95, 58, p); // horizontal spread
  const stepH = lerp(55, 33, p);
  const pw = lerp(80, 46, p);
  const platforms = [], coins = [];
  let cx = 220;

  while (cx < lw - 420) {
    // Approach gap
    cx += lerp(120, 75, p) + rng() * 60;

    const tTop = GROUND_Y - lerp(200, 368, p) - rng() * 40;
    let ty = GROUND_Y - 20, side = rng() > 0.5 ? 1 : -1;
    const txC = cx;

    while (ty > tTop) {
      const sx = txC + side * (tW / 2) - pw / 2 + (rng() - 0.5) * 12;
      const pl = mkPlat(sx, ty, pw + rng() * 22);
      platforms.push(pl);
      coins.push(mkCoin(pl.x + pl.w / 2 - 8, pl.y - 36, rng() * Math.PI * 2));
      ty -= stepH + rng() * 14;
      side = -side;
    }

    // Top landing with bonus coins
    const topPl = mkPlat(txC - pw, tTop, pw * 2.5);
    platforms.push(topPl);
    nCoins(coins, topPl, 4 + Math.floor(rng() * 3), rng);

    cx = txC + tW + lerp(88, 55, p);
  }
  return { platforms, coins, needsGround: true };
}

// 9. DESCENT — start high via a launch pad, descend, then climb back
function genDescent(rng, p, lw) {
  const startY = GROUND_Y - lerp(185, 315, p);
  const sw = lerp(110, 60, p), gap = lerp(75, 112, p), step = lerp(35, 62, p);
  const platforms = [], coins = [];

  // High launch pad
  const launchPl = mkPlat(300, startY, lerp(165, 90, p));
  platforms.push(launchPl);
  nCoins(coins, launchPl, 3, rng);

  let cx = launchPl.x + launchPl.w, cy = startY;
  let phase = 'down';
  const bot = GROUND_Y - 28;

  while (cx < lw - 380) {
    const g = gap + rng() * 30, w = sw + rng() * 38;
    let ny;
    if (phase === 'down') {
      ny = Math.min(bot, cy + step + rng() * 22);
      if (ny >= bot - 20) phase = 'bottom';
    } else if (phase === 'bottom') {
      ny = clamp(cy + (rng() - 0.5) * 30, bot - 28, bot);
      if (rng() > 0.55) phase = 'up';
    } else {
      ny = Math.max(startY, cy - step - rng() * 22);
      if (ny <= startY + 22) phase = 'down';
    }

    const pl = mkPlat(cx + g, ny, w);
    platforms.push(pl);
    coins.push(mkCoin(pl.x + pl.w / 2 - 8, pl.y - 36, rng() * Math.PI * 2));
    cx = pl.x + pl.w; cy = ny;
  }
  return { platforms, coins, needsGround: true };
}

// 10. SPRINT — shorter level, tiny rapid-fire platforms, punishing gaps
function genSprint(rng, p, lw) {
  const sw = lerp(58, 35, p), gap = lerp(52, 82, p);
  const ceil = GROUND_Y - lerp(105, 225, p);
  const bw = lerp(45, 95, p); // vertical band
  const sprintW = Math.round(lerp(750, 1700, p)); // always shorter than lw
  const platforms = [], coins = [];
  let cx = 220, cy = GROUND_Y - 20;

  while (cx < sprintW - 280) {
    const g = gap + rng() * 32, pw = sw + rng() * 38;
    const ny = clamp(cy + (rng() - 0.5) * bw * 2, ceil, GROUND_Y - 20);
    const pl = mkPlat(cx + g, ny, pw);
    platforms.push(pl);
    if (rng() < 0.62) coins.push(mkCoin(pl.x + pw / 2 - 8, pl.y - 36, rng() * Math.PI * 2));
    cx = pl.x + pl.w; cy = ny;
  }
  return { platforms, coins, needsGround: true, forcedWidth: sprintW + 100 };
}

// ─── ARCHETYPE SELECTION ──────────────────────────────────────────────────────
const ARCHETYPE_NAMES = [
  'standard', 'staircase', 'zigzag', 'pit',
  'highrise', 'longjump', 'flat', 'tower',
  'descent', 'sprint',
];
const GENERATORS = {
  standard: genStandard, staircase: genStaircase, zigzag: genZigzag, pit: genPit,
  highrise: genHighrise, longjump: genLongJump, flat: genFlat, tower: genTower,
  descent: genDescent, sprint: genSprint,
};

function selectArchetype(stageIdx, levelIdx) {
  // Each stage has a phase-shifted rotation so consecutive levels differ
  // AND same levelIdx in different stages gets a different archetype
  const idx = (levelIdx + stageIdx * 3) % ARCHETYPE_NAMES.length;
  return ARCHETYPE_NAMES[idx];
}

// ─── MAIN GENERATOR ──────────────────────────────────────────────────────────

export function generateLevel(stageIdx, levelIdx) {
  const seed = stageIdx * 50 + levelIdx + 1;
  const rng = mulberry32(seed);
  const progress = (stageIdx * 50 + levelIdx) / 499;
  const archetype = selectArchetype(stageIdx, levelIdx);

  const lw = Math.round(lerp(1100, 4800, progress));
  const { platforms: genPlats, coins, needsGround, forcedWidth } = GENERATORS[archetype](rng, progress, lw);

  const actualWidth = forcedWidth || lw;

  // Starting safe platform (always present)
  const startPlat = { x: 40, y: GROUND_Y - 20, w: 180, h: 20, type: 'normal' };

  // Assemble all platforms
  const allPlatforms = [];
  if (needsGround) allPlatforms.push({ x: 0, y: GROUND_Y, w: actualWidth, h: GH - GROUND_Y, type: 'ground' });
  allPlatforms.push(startPlat);
  allPlatforms.push(...genPlats);

  // Exit door on the rightmost normal platform
  const normals = allPlatforms.filter(p => p.type === 'normal' && p.x > 200);
  normals.sort((a, b) => (b.x + b.w) - (a.x + a.w));
  const lastPlat = normals[0] || startPlat;
  const exit = {
    x: Math.round(lastPlat.x + lastPlat.w / 2 - 20),
    y: Math.round(lastPlat.y - 60),
    w: 40, h: 60,
  };

  return { width: actualWidth, height: GH, platforms: allPlatforms, coins, enemies: [], exit, stageIdx, levelIdx, archetype };
}

export function getPlayerSpawn(levelData) {
  const sp = levelData.platforms.find(p => p.x === 40 && p.type === 'normal');
  if (sp) return { x: sp.x + 20, y: sp.y - 42 };
  return { x: 80, y: GROUND_Y - 42 };
}

// ─── RENDERING ───────────────────────────────────────────────────────────────

export function drawPlatforms(ctx, platforms, stage) {
  const theme = getTheme(stage);
  for (const p of platforms) {
    if (p.type === 'ground') {
      ctx.fillStyle = theme.groundColor;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    } else {
      ctx.fillStyle = theme.platColor;
      ctx.fillRect(p.x, p.y + 5, p.w, p.h - 5);
      ctx.fillStyle = theme.platTopColor;
      ctx.fillRect(p.x, p.y, p.w, 6);
      ctx.fillStyle = theme.platSide;
      ctx.fillRect(p.x, p.y, 4, p.h);
      ctx.fillRect(p.x + p.w - 4, p.y, 4, p.h);
    }
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
    if (!aabbOverlap(player, p)) continue;
    const mid = player.x + player.w / 2;
    if (mid < p.x + p.w / 2) player.x = p.x - player.w;
    else player.x = p.x + p.w;
    player.vx = 0;
  }
}

export function resolveY(player, platforms) {
  let onGround = false;
  const prevBottom = player._prevY + player.h;

  for (const p of platforms) {
    if (player.x + player.w <= p.x || player.x >= p.x + p.w) continue;
    const platTop = p.y, platBottom = p.y + p.h;

    if (player.vy >= 0) {
      if (prevBottom <= platTop + 4 && player.y + player.h >= platTop) {
        player.y = platTop - player.h;
        player.vy = 0;
        onGround = true;
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
