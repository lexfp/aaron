/**
 * enemy-animations.test.js
 *
 * Static source-analysis tests for the `enemy-animations` feature.
 * All tests read entities.js (and main.js for Scenario 6) via fs.readFileSync
 * and assert structural / behavioral contracts via regex / text search.
 *
 * Jest config uses CJS (no transform), so this file uses CommonJS require.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ENTITIES_SRC = fs.readFileSync(path.join(ROOT, 'js', 'entities.js'), 'utf8');
const MAIN_SRC = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the body of a top-level function declaration or expression assigned
 * to a variable by name.  Returns the raw source text between the first `{`
 * and its matching `}` (greedy — returns the full function body including
 * nested braces).  Returns null if not found.
 */
function extractFunctionBody(src, fnName) {
  // Match: function fnName(   OR   const fnName = function(   OR arrow forms
  const patterns = [
    new RegExp(`function\\s+${fnName}\\s*\\(`),
    new RegExp(`(?:const|let|var)\\s+${fnName}\\s*=\\s*function\\s*\\(`),
    new RegExp(`(?:const|let|var)\\s+${fnName}\\s*=\\s*\\([^)]*\\)\\s*=>`),
  ];

  let startIdx = -1;
  for (const pat of patterns) {
    const m = src.search(pat);
    if (m !== -1 && (startIdx === -1 || m < startIdx)) startIdx = m;
  }
  if (startIdx === -1) return null;

  // Walk forward to the opening brace
  let braceIdx = src.indexOf('{', startIdx);
  if (braceIdx === -1) return null;

  let depth = 0;
  let end = braceIdx;
  for (let i = braceIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  return src.slice(braceIdx, end + 1);
}

/**
 * Extract the body of drawEnemies (exported function).
 */
function getDrawEnemiesBody() {
  return extractFunctionBody(ENTITIES_SRC, 'drawEnemies');
}

/**
 * Extract the per-enemy loop body from drawEnemies.
 * Assumes the loop iterates `enemies` with a `for` statement.
 */
function getPerEnemyLoopBody() {
  const drawBody = getDrawEnemiesBody();
  if (!drawBody) return null;
  // Find 'for (const e of enemies)' or similar
  const loopStart = drawBody.search(/for\s*\(\s*const\s+e\s+of\s+enemies\s*\)/);
  if (loopStart === -1) return null;
  const braceIdx = drawBody.indexOf('{', loopStart);
  if (braceIdx === -1) return null;
  let depth = 0;
  let end = braceIdx;
  for (let i = braceIdx; i < drawBody.length; i++) {
    if (drawBody[i] === '{') depth++;
    else if (drawBody[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  return drawBody.slice(braceIdx, end + 1);
}

// ---------------------------------------------------------------------------
// Scenario 1: Hop squash/stretch from vy
// ---------------------------------------------------------------------------

describe('Scenario 1 — Hop squash/stretch keyed to e.vy', () => {
  const hopSpecies = ['drawSlime', 'drawShroom', 'drawLavaBlob'];

  hopSpecies.forEach(fnName => {
    test(`${fnName} reads e.vy to derive a squash/stretch scale`, () => {
      const body = extractFunctionBody(ENTITIES_SRC, fnName);
      expect(body).not.toBeNull();
      // Must reference e.vy (possibly inside Math.abs or conditional)
      expect(body).toMatch(/e\.vy/);
    });

    test(`${fnName} uses vy-derived value to scale width or height`, () => {
      const body = extractFunctionBody(ENTITIES_SRC, fnName);
      expect(body).not.toBeNull();
      // Should derive a squash/stretch scalar from vy (air flag or direct scale).
      // Patterns accepted:
      //   Math.abs(e.vy ...) > threshold
      //   e.vy > threshold  /  e.vy !== 0  /  e.vy < ...
      //   air = ... e.vy ...  (boolean derived from vy, then used in scale)
      const hasVyConditional =
        /Math\.abs\(e\.vy/.test(body) ||           // Math.abs(e.vy || 0)
        /e\.vy\s*[><!]=?\s*[0-9]/.test(body) ||   // e.vy > 30, e.vy !== 0
        /e\.vy\s*\|\|/.test(body);                 // e.vy || 0 in some expression
      expect(hasVyConditional).toBe(true);
    });

    test(`${fnName} does not assign to e.x, e.y, e.w, e.h, or e.vy`, () => {
      const body = extractFunctionBody(ENTITIES_SRC, fnName);
      expect(body).not.toBeNull();
      // Assignment patterns: e.x = , e.y = , e.w = , e.h = , e.vy =
      // Allow reads (e.vy used in expressions) but not writes
      const assignPattern = /\be\.(x|y|w|h|vy)\s*=[^=]/;
      expect(body).not.toMatch(assignPattern);
    });
  });

  test('drawSlime squash/stretch: sx and sy are derived from vy-based air flag', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'drawSlime');
    expect(body).not.toBeNull();
    // Expect: air = Math.abs(e.vy || 0) > threshold, then sx/sy defined from it
    expect(body).toMatch(/air\s*=.*e\.vy/);
    // The scale variables (sx, sy) or equivalent used in ellipse/rect calls
    expect(body).toMatch(/sx|sy|sq|scaleX|scaleY|stretch/);
  });

  test('drawShroom squash/stretch: uses vy-based air flag for cap scale', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'drawShroom');
    expect(body).not.toBeNull();
    expect(body).toMatch(/air\s*=.*e\.vy/);
    // A scale variable (sq or similar) applied to ellipse dimensions
    expect(body).toMatch(/sq|sx|sy|stretch/);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Charge telegraph shake is render-only
// ---------------------------------------------------------------------------

describe('Scenario 2 — Charge telegraph shake is render-only', () => {
  test('drawScorpion references _st to detect winding/telegraph state', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'drawScorpion');
    expect(body).not.toBeNull();
    expect(body).toMatch(/e\._st/);
    // Should detect winding state (e._st === 1)
    expect(body).toMatch(/e\._st\s*===?\s*1|_st\s*===?\s*1/);
  });

  test('drawKnight references _st to detect winding/telegraph state', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'drawKnight');
    expect(body).not.toBeNull();
    expect(body).toMatch(/e\._st/);
    expect(body).toMatch(/e\._st\s*===?\s*1|_st\s*===?\s*1/);
  });

  test('drawScorpion does not assign to e.x inside the draw function', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'drawScorpion');
    expect(body).not.toBeNull();
    expect(body).not.toMatch(/\be\.x\s*=[^=]/);
  });

  test('drawKnight does not assign to e.x inside the draw function', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'drawKnight');
    expect(body).not.toBeNull();
    expect(body).not.toMatch(/\be\.x\s*=[^=]/);
  });

  test('charge species shake uses ctx.translate (not e.x mutation) for telegraph effect', () => {
    // The shake for _st===1 must be implemented via ctx.translate, not e.x write.
    // We verify this by checking that drawScorpion or drawKnight calls ctx.translate
    // when _st is considered, AND does not assign e.x.
    const scorpion = extractFunctionBody(ENTITIES_SRC, 'drawScorpion');
    const knight = extractFunctionBody(ENTITIES_SRC, 'drawKnight');

    // At least one of them must use ctx.translate for the shake animation
    const scorpionHasTranslate = scorpion && /ctx\.translate/.test(scorpion);
    const knightHasTranslate = knight && /ctx\.translate/.test(knight);
    expect(scorpionHasTranslate || knightHasTranslate).toBe(true);

    // Neither should write e.x
    if (scorpion) expect(scorpion).not.toMatch(/\be\.x\s*=[^=]/);
    if (knight) expect(knight).not.toMatch(/\be\.x\s*=[^=]/);
  });

  test('no species draw function assigns to e.x', () => {
    const speciesFns = [
      'drawSlime', 'drawBee', 'drawCrawler', 'drawBat', 'drawSlider',
      'drawIcicle', 'drawScorpion', 'drawVulture', 'drawLavaBlob', 'drawEmber',
      'drawBird', 'drawPuff', 'drawSpider', 'drawShroom', 'drawDrone',
      'drawTurret', 'drawGolem', 'drawShard', 'drawKnight', 'drawWraith',
    ];
    for (const fn of speciesFns) {
      const body = extractFunctionBody(ENTITIES_SRC, fn);
      if (body) {
        expect({ fn, assigns: /\be\.x\s*=[^=]/.test(body) }).toEqual({ fn, assigns: false });
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Dying enemy non-interactive
// ---------------------------------------------------------------------------

describe('Scenario 3 — Dying enemy non-interactive', () => {
  test('damageEnemy sets e._deathT when e.alive becomes false', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'damageEnemy');
    expect(body).not.toBeNull();
    // After e.alive = false, _deathT must be set
    expect(body).toMatch(/e\._deathT\s*=/);
  });

  test('damageEnemy sets e.alive = false when hp drops to 0', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'damageEnemy');
    expect(body).not.toBeNull();
    expect(body).toMatch(/e\.alive\s*=\s*false/);
  });

  test('updateEnemies loop is gated on e.alive (not a dying state)', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'updateEnemies');
    expect(body).not.toBeNull();
    // The main per-enemy loop should gate on e.alive === false (skip) not e._deathT
    // Pattern: if (!e.alive) continue  — the primary skip guard
    expect(body).toMatch(/if\s*\(\s*!e\.alive\s*\)\s*continue/);
  });

  test('combat collision check (rectsOverlap) is only reached when e.alive is true', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'updateEnemies');
    expect(body).not.toBeNull();
    // The stomp / contact damage block should not separately check _deathT
    // The e.alive gate at the top of the loop is sufficient
    // Verify no secondary e._deathT gate in the collision block
    // (a dying enemy with _deathT set but alive=false should already be skipped)
    const aliveGatePos = body.search(/if\s*\(\s*!e\.alive\s*\)\s*continue/);
    const rectsOverlapPos = body.search(/rectsOverlap\s*\(/);
    if (aliveGatePos !== -1 && rectsOverlapPos !== -1) {
      // rectsOverlap is called after the alive gate, so alive=false enemies never reach it
      expect(aliveGatePos).toBeLessThan(rectsOverlapPos);
    }
  });

  test('playerMeleeAttack loop is gated on e.alive', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'playerMeleeAttack');
    expect(body).not.toBeNull();
    expect(body).toMatch(/if\s*\(\s*!e\.alive\s*\)\s*continue/);
  });

  test('detonate function checks e.alive before applying damage', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'detonate');
    expect(body).not.toBeNull();
    expect(body).toMatch(/e\.alive/);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Death visual elapses then stops rendering
// ---------------------------------------------------------------------------

describe('Scenario 4 — Death visual elapses then stops rendering', () => {
  test('drawEnemies decrements e._deathT for dying enemies', () => {
    const body = getDrawEnemiesBody();
    expect(body).not.toBeNull();
    // Should decrement: e._deathT -= dt  OR  e._deathT--  OR similar
    expect(body).toMatch(/e\._deathT\s*[-][-=]/);
  });

  test('drawEnemies skips rendering when e._deathT <= 0', () => {
    const body = getDrawEnemiesBody();
    expect(body).not.toBeNull();
    // Should have a guard: if (e._deathT <= 0) continue / skip / return
    expect(body).toMatch(/_deathT\s*<=\s*0/);
  });

  test('drawEnemies handles dying enemies separately from alive enemies', () => {
    const body = getDrawEnemiesBody();
    expect(body).not.toBeNull();
    // Must reference _deathT for the death animation
    expect(body).toMatch(/e\._deathT/);
    // Must still have the alive check for normal enemies
    expect(body).toMatch(/e\.alive/);
  });

  test('initEntities clone objects do NOT include _deathT', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'initEntities');
    expect(body).not.toBeNull();
    // The spread or explicit fields in the enemy push should not set _deathT
    // Find the enemies.push block
    const pushIdx = body.indexOf('enemies.push(');
    expect(pushIdx).toBeGreaterThan(-1);
    // Extract from push to the matching closing paren
    const pushSlice = body.slice(pushIdx, pushIdx + 400);
    expect(pushSlice).not.toMatch(/_deathT/);
  });

  test('damageEnemy sets _deathT to a positive number when enemy dies', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'damageEnemy');
    expect(body).not.toBeNull();
    // _deathT should be assigned a positive constant or expression, not 0 or false
    // Pattern: e._deathT = <something positive>
    const match = body.match(/e\._deathT\s*=\s*([^;,\n]+)/);
    expect(match).not.toBeNull();
    // The right-hand side should not be 0 or false
    if (match) {
      expect(match[1].trim()).not.toMatch(/^0$|^false$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Boss animations compose with scale/aura/HP bar
// ---------------------------------------------------------------------------

describe('Scenario 5 — Boss animations compose with scale/aura/HP bar', () => {
  test('drawEnemies wraps the species draw call in a nested ctx.save/restore', () => {
    const body = getDrawEnemiesBody();
    expect(body).not.toBeNull();
    // Should have at least 2 ctx.save() calls (outer + inner for species art)
    const saveMatches = body.match(/ctx\.save\s*\(\s*\)/g) || [];
    expect(saveMatches.length).toBeGreaterThanOrEqual(2);
  });

  test('drawEnemies has matching ctx.restore calls for each ctx.save', () => {
    const body = getDrawEnemiesBody();
    expect(body).not.toBeNull();
    const saves = (body.match(/ctx\.save\s*\(\s*\)/g) || []).length;
    const restores = (body.match(/ctx\.restore\s*\(\s*\)/g) || []).length;
    // Saves and restores should balance (within the enemy loop context)
    expect(saves).toBeGreaterThanOrEqual(2);
    expect(restores).toBeGreaterThanOrEqual(2);
    expect(saves).toBe(restores);
  });

  test('boss aura drawing code (createRadialGradient for aura) is present', () => {
    const body = getDrawEnemiesBody();
    expect(body).not.toBeNull();
    // Boss aura uses a radial gradient
    expect(body).toMatch(/createRadialGradient/);
    // And references e.boss or e._rage
    expect(body).toMatch(/e\.boss|e\._rage/);
  });

  test('boss HP bar drawing code is present outside the species draw block', () => {
    const body = getDrawEnemiesBody();
    expect(body).not.toBeNull();
    // HP bar uses e.hp / e.maxHp
    expect(body).toMatch(/e\.hp\s*\/\s*e\.maxHp/);
    // And e.boss check
    expect(body).toMatch(/e\.boss/);
  });

  test('bossScale scaling uses ctx.scale inside the inner save/restore block', () => {
    const body = getDrawEnemiesBody();
    expect(body).not.toBeNull();
    // bossScale applied via ctx.scale
    expect(body).toMatch(/e\.bossScale/);
    expect(body).toMatch(/ctx\.scale\s*\(/);
  });

  test('HP bar code appears after the inner ctx.restore (not inside scaling block)', () => {
    const body = getDrawEnemiesBody();
    expect(body).not.toBeNull();
    // The inner ctx.restore() for the species art block should appear before the HP bar code
    // We check positional ordering: inner restore < HP bar fill
    const innerRestoreMatch = body.match(/ctx\.restore\s*\(\s*\)/g);
    expect(innerRestoreMatch).not.toBeNull();

    // Find positions
    const restoreIdx = body.lastIndexOf('ctx.restore()');
    const hpBarIdx = body.search(/e\.hp\s*\/\s*e\.maxHp/);

    // HP bar code should come after the final restore in the per-enemy section
    // (indicating it's outside the transform block)
    expect(hpBarIdx).toBeGreaterThan(restoreIdx);
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: Flier flap rate from player proximity
// ---------------------------------------------------------------------------

describe('Scenario 6 — Flier flap rate keyed to player proximity', () => {
  test('drawEnemies function signature accepts a player parameter', () => {
    // Check the export line / function declaration for drawEnemies
    const exportMatch = ENTITIES_SRC.match(/export\s+function\s+drawEnemies\s*\(([^)]*)\)/);
    expect(exportMatch).not.toBeNull();
    if (exportMatch) {
      const params = exportMatch[1];
      // Should have a player parameter (5th param or named 'player')
      expect(params).toMatch(/player/);
    }
  });

  test('drawBee uses player proximity or distance to modulate flap rate', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'drawBee');
    expect(body).not.toBeNull();
    // Should reference player or a proximity/distance variable for flap rate
    // Either accepts player directly or reads a proximity value from e or passed param
    const hasProximityFlap = /player|dist|prox|near|range/.test(body);
    expect(hasProximityFlap).toBe(true);
  });

  test('drawEmber uses player proximity or distance to modulate flap/flutter rate', () => {
    const body = extractFunctionBody(ENTITIES_SRC, 'drawEmber');
    expect(body).not.toBeNull();
    // Should reference player or proximity for animation rate
    const hasProximityFlap = /player|dist|prox|near|range/.test(body);
    expect(hasProximityFlap).toBe(true);
  });

  test('main.js passes player to drawEnemies call site', () => {
    // Find the drawEnemies(...) call in main.js
    const callMatch = MAIN_SRC.match(/drawEnemies\s*\(([^)]+)\)/);
    expect(callMatch).not.toBeNull();
    if (callMatch) {
      const args = callMatch[1];
      // Should include 'player' in the argument list
      expect(args).toMatch(/player/);
    }
  });

  test('drawEnemies passes player (or derived proximity) to flier species draw calls', () => {
    const body = getDrawEnemiesBody();
    expect(body).not.toBeNull();
    // The body should reference player when calling sd() or the specific draw functions
    // Since species draws are called via sd(ctx, e, t) or sd(ctx, e, t, player),
    // or player is used to compute a proximity value passed in
    expect(body).toMatch(/player/);
  });
});

// ---------------------------------------------------------------------------
// Scenario 7: No per-frame allocations in draw loop
// ---------------------------------------------------------------------------

describe('Scenario 7 — No per-frame allocations in enemy draw loop', () => {
  test('per-enemy loop body contains no plain array literal allocations for animation', () => {
    const loopBody = getPerEnemyLoopBody();
    expect(loopBody).not.toBeNull();

    // Strip out known-OK gradient calls: createLinearGradient, createRadialGradient
    // (these pre-existed for boss/lava rendering)
    const strippedBody = loopBody
      .replace(/ctx\.create(?:Linear|Radial)Gradient[^;]+;/g, '/* gradient */')
      .replace(/grad\.[^;]+;/g, '/* grad */')
      .replace(/g\.[^;]+;/g, '/* g */');

    // No new Array(...) or [] literal used for animation purposes inside the loop
    // We allow [] inside method calls like Math.max(), but not standalone allocation
    // Pattern: something = [] or = new Array
    const hasArrayAlloc = /=\s*\[\s*\]|new\s+Array\s*\(/.test(strippedBody);
    expect(hasArrayAlloc).toBe(false);
  });

  test('per-enemy loop body contains no plain object literal allocations for animation', () => {
    const loopBody = getPerEnemyLoopBody();
    expect(loopBody).not.toBeNull();

    // No new plain objects created for animation: = {}
    // Exclude gradient objects (already filtered) and property access chains
    const strippedBody = loopBody
      .replace(/ctx\.create(?:Linear|Radial)Gradient[^;]+;/g, '/* gradient */')
      .replace(/\{[^}]*addColorStop[^}]*\}/g, '/* colorstop */');

    // Standalone object literal assignment inside the loop
    const hasObjAlloc = /=\s*\{\s*[a-zA-Z_$]/.test(strippedBody);
    expect(hasObjAlloc).toBe(false);
  });

  test('per-enemy loop body does not call new Array() for animation state', () => {
    const loopBody = getPerEnemyLoopBody();
    expect(loopBody).not.toBeNull();
    expect(loopBody).not.toMatch(/new\s+Array\s*\(/);
  });

  test('per-enemy loop body does not call new Object() for animation state', () => {
    const loopBody = getPerEnemyLoopBody();
    expect(loopBody).not.toBeNull();
    expect(loopBody).not.toMatch(/new\s+Object\s*\(/);
  });

  test('SPECIES_DRAW map is defined (lookup table, not per-frame alloc)', () => {
    // The SPECIES_DRAW object is defined at module level (not inside the loop)
    // so it is a one-time allocation, not a per-frame one.
    expect(ENTITIES_SRC).toMatch(/const\s+SPECIES_DRAW\s*=/);
    // And it should NOT appear inside the drawEnemies function body
    const drawBody = getDrawEnemiesBody();
    expect(drawBody).not.toBeNull();
    // SPECIES_DRAW declaration should not be inside drawEnemies
    expect(drawBody).not.toMatch(/const\s+SPECIES_DRAW\s*=/);
  });

  test('species draw functions are referenced from SPECIES_DRAW, not re-created per frame', () => {
    // Each species draw function is declared once at module level
    const speciesFns = ['drawSlime', 'drawBee', 'drawShroom', 'drawScorpion', 'drawKnight'];
    for (const fn of speciesFns) {
      // Function declaration exists at module level
      const fnDecl = new RegExp(`function\\s+${fn}\\s*\\(`);
      expect(ENTITIES_SRC).toMatch(fnDecl);
    }
    // SPECIES_DRAW map references them by name
    expect(ENTITIES_SRC).toMatch(/SPECIES_DRAW\s*=\s*\{[^}]*slime\s*:/);
  });
});

// ---------------------------------------------------------------------------
// Additional integration assertions
// ---------------------------------------------------------------------------

describe('Source structure integrity', () => {
  test('entities.js exports drawEnemies', () => {
    expect(ENTITIES_SRC).toMatch(/export\s+function\s+drawEnemies/);
  });

  test('entities.js exports damageEnemy or damageEnemy is defined', () => {
    // damageEnemy is an internal helper (not exported), but must be defined
    expect(ENTITIES_SRC).toMatch(/function\s+damageEnemy\s*\(/);
  });

  test('entities.js exports initEntities', () => {
    expect(ENTITIES_SRC).toMatch(/export\s+function\s+initEntities/);
  });

  test('SPECIES_DRAW map includes all expected species', () => {
    const expected = [
      'slime', 'bee', 'crawler', 'bat', 'slider', 'icicle',
      'scorpion', 'vulture', 'lavablob', 'ember', 'bird', 'puff',
      'spider', 'shroom', 'drone', 'turret', 'golem', 'shard', 'knight', 'wraith',
    ];
    for (const species of expected) {
      expect(ENTITIES_SRC).toMatch(new RegExp(`${species}\\s*:`));
    }
  });

  test('main.js imports drawEnemies from entities.js', () => {
    expect(MAIN_SRC).toMatch(/drawEnemies/);
    expect(MAIN_SRC).toMatch(/from\s+['"].*entities/);
  });
});
