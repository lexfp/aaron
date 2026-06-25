/**
 * Jest tests for dice-unlock-cheat spec.
 * All scenarios verify source code structure (Kind: code).
 */

const fs = require('fs');
const path = require('path');

const stateSource = fs.readFileSync(
  path.resolve(__dirname, '../../js/state.js'), 'utf8'
);
const uiSource = fs.readFileSync(
  path.resolve(__dirname, '../../js/ui.js'), 'utf8'
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractFunction(src, name) {
  const idx = src.indexOf(`function ${name}`);
  if (idx === -1) return null;
  let depth = 0, i = idx;
  while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(idx, i + 1); }
    i++;
  }
  return null;
}

function extractSetupMenuEffects(src) {
  return extractFunction(src, 'setupMenuEffects');
}

// ── Scenario 1 — unlockEverything grants all weapons and levels ───────────────

describe('Scenario 1 — unlockEverything grants all weapons and levels', () => {
  test('state.js exports unlockEverything', () => {
    expect(stateSource).toMatch(/export\s+function\s+unlockEverything/);
  });

  const fn = extractFunction(stateSource, 'unlockEverything');

  test('unlockEverything iterates WEAPON_DEFS and sets each key true in playerData.weapons', () => {
    expect(fn).not.toBeNull();
    // Must reference WEAPON_DEFS and set weapons[...] = true
    expect(fn).toMatch(/WEAPON_DEFS/);
    expect(fn).toMatch(/playerData\.weapons/);
    expect(fn).toMatch(/=\s*true/);
  });

  test('unlockEverything sets playerData.stagesUnlocked = 10', () => {
    expect(fn).not.toBeNull();
    expect(fn).toMatch(/playerData\.stagesUnlocked\s*=\s*10/);
  });

  test('unlockEverything loops s 0–9 and l 1–50 setting levelProgress entries', () => {
    expect(fn).not.toBeNull();
    expect(fn).toMatch(/playerData\.levelProgress/);
    // Should have nested loops covering s 0-9 and l 1-50
    expect(fn).toMatch(/for/);
  });

  test('unlockEverything calls savePlayerData() once after mutations', () => {
    expect(fn).not.toBeNull();
    const saveMatches = (fn.match(/savePlayerData\s*\(\)/g) || []);
    expect(saveMatches.length).toBe(1);
  });
});

// ── Scenario 2 — unlockEverything never changes equippedWeapon (must-NOT) ────

describe('Scenario 2 — unlockEverything never changes equippedWeapon (must-NOT)', () => {
  const fn = extractFunction(stateSource, 'unlockEverything');

  test('unlockEverything contains no assignment to playerData.equippedWeapon', () => {
    expect(fn).not.toBeNull();
    expect(fn).not.toMatch(/playerData\.equippedWeapon\s*=/);
  });

  test('unlockEverything does not call equipWeapon or equipSkin', () => {
    expect(fn).not.toBeNull();
    expect(fn).not.toMatch(/equipWeapon\s*\(/);
    expect(fn).not.toMatch(/equipSkin\s*\(/);
  });
});

// ── Scenario 3 — Dice counter is closure-scoped, not module-level ─────────────

describe('Scenario 3 — Dice counter is closure-scoped, not module-level', () => {
  const setupFn = extractSetupMenuEffects(uiSource);

  test('setupMenuEffects exists in ui.js', () => {
    expect(setupFn).not.toBeNull();
  });

  test('_diceHits is declared with let inside setupMenuEffects body', () => {
    expect(setupFn).toMatch(/let\s+_diceHits/);
  });

  test('_diceUnlocked is declared with let inside setupMenuEffects body', () => {
    expect(setupFn).toMatch(/let\s+_diceUnlocked/);
  });

  test('_diceHits is NOT declared at module top level', () => {
    // Find index of setupMenuEffects in the full source
    const setupIdx = uiSource.indexOf('function setupMenuEffects');
    // Everything before the function should not declare _diceHits
    const beforeFn = uiSource.slice(0, setupIdx);
    expect(beforeFn).not.toMatch(/let\s+_diceHits/);
    expect(beforeFn).not.toMatch(/var\s+_diceHits/);
  });

  test('_diceUnlocked is NOT declared at module top level', () => {
    const setupIdx = uiSource.indexOf('function setupMenuEffects');
    const beforeFn = uiSource.slice(0, setupIdx);
    expect(beforeFn).not.toMatch(/let\s+_diceUnlocked/);
    expect(beforeFn).not.toMatch(/var\s+_diceUnlocked/);
  });
});

// ── Scenario 4 — 500 clicks triggers the cheat the first time ────────────────

describe('Scenario 4 — 500 clicks triggers the cheat the first time', () => {
  const setupFn = extractSetupMenuEffects(uiSource);

  test('dice handler increments _diceHits on click', () => {
    expect(setupFn).toMatch(/_diceHits\+\+|_diceHits\s*\+=\s*1/);
  });

  test('threshold condition checks _diceHits >= 500 and !_diceUnlocked', () => {
    expect(setupFn).toMatch(/_diceHits\s*>=\s*500/);
    expect(setupFn).toMatch(/!\s*_diceUnlocked/);
  });

  test('cheat branch calls unlockEverything()', () => {
    expect(setupFn).toMatch(/unlockEverything\s*\(\)/);
  });

  test('cheat branch sets _diceUnlocked = true', () => {
    expect(setupFn).toMatch(/_diceUnlocked\s*=\s*true/);
  });

  test('cheat branch resets _diceHits to 0', () => {
    expect(setupFn).toMatch(/_diceHits\s*=\s*0/);
  });
});

// ── Scenario 5 — 499 clicks does not trigger the cheat ───────────────────────

describe('Scenario 5 — 499 clicks does not trigger the cheat (threshold is >= 500)', () => {
  const setupFn = extractSetupMenuEffects(uiSource);

  test('trigger condition uses >= 500, not > 499 or == 500', () => {
    // The condition must be >= 500 to satisfy the ">= 500" spec requirement
    expect(setupFn).toMatch(/_diceHits\s*>=\s*500/);
  });
});

// ── Scenario 6 — No visual announcement beyond existing burst (must-NOT) ──────

describe('Scenario 6 — No toast/alert/log on the cheat path (must-NOT)', () => {
  const setupFn = extractSetupMenuEffects(uiSource);

  // Extract just the block where _diceUnlocked is set true (the cheat branch)
  // We check the entire setupMenuEffects body doesn't add announcements near unlockEverything
  test('cheat branch adds no console.* call', () => {
    // Find the unlockEverything call and grab surrounding context
    const unlockIdx = setupFn ? setupFn.indexOf('unlockEverything') : -1;
    expect(unlockIdx).toBeGreaterThan(-1);
    const context = setupFn.slice(Math.max(0, unlockIdx - 50), unlockIdx + 200);
    expect(context).not.toMatch(/console\./);
  });

  test('cheat branch adds no alert() call', () => {
    const unlockIdx = setupFn ? setupFn.indexOf('unlockEverything') : -1;
    const context = setupFn.slice(Math.max(0, unlockIdx - 50), unlockIdx + 200);
    expect(context).not.toMatch(/\balert\s*\(/);
  });
});

// ── Scenario 7 — Does not conflict with luckyRun easter egg (must-NOT) ────────

describe('Scenario 7 — Does not conflict with luckyRun easter egg (must-NOT)', () => {
  // luckyRun locals live in wireToyBox (called by setupMenuEffects), not inline in setupMenuEffects
  const wireFn = extractFunction(uiSource, 'wireToyBox') || extractSetupMenuEffects(uiSource);

  test('luckyRun call is still present in the dice handler area', () => {
    expect(uiSource).toMatch(/luckyRun/);
  });

  test('_diceHits and _diceUnlocked do not replace streak, prev, done, goal', () => {
    // The original luckyRun locals must still exist somewhere in the dice-handling code
    expect(wireFn).toMatch(/\bstreak\b/);
    expect(wireFn).toMatch(/\bprev\b/);
    expect(wireFn).toMatch(/\bdone\b/);
    expect(wireFn).toMatch(/\bgoal\b/);
  });
});

// ── Scenario 9 — Second 500 clicks does nothing (must-NOT re-fire) ────────────

describe('Scenario 9 — Second 500 clicks does nothing (must-NOT re-fire)', () => {
  const setupFn = extractSetupMenuEffects(uiSource);

  test('when _diceUnlocked is true, threshold branch resets counter but skips unlockEverything', () => {
    // There must be a separate else/else-if branch for the already-unlocked case
    // OR the !_diceUnlocked guard means only one branch calls unlockEverything
    // Both patterns are valid; we verify _diceHits = 0 appears unconditionally at >= 500
    // and that unlockEverything only appears inside the !_diceUnlocked branch
    expect(setupFn).toMatch(/_diceHits\s*>=\s*500/);
    expect(setupFn).toMatch(/!\s*_diceUnlocked/);
    // unlockEverything must appear only INSIDE the !_diceUnlocked guarded block
    // (i.e., not outside it). We verify it's guarded by checking the source structure.
    const guarded = setupFn.match(/if\s*\([^)]*!\s*_diceUnlocked[^)]*\)[^{]*\{[^}]*unlockEverything/s) ||
                    setupFn.match(/!\s*_diceUnlocked[\s\S]{0,200}unlockEverything/);
    expect(guarded).not.toBeNull();
  });

  test('_diceHits reset to 0 occurs on >= 500 regardless of _diceUnlocked', () => {
    // _diceHits = 0 must be reachable when _diceUnlocked is true too
    expect(setupFn).toMatch(/_diceHits\s*=\s*0/);
  });
});

// ── Scenario 8 — Idempotent when everything already unlocked ─────────────────

describe('Scenario 8 — unlockEverything is idempotent (unconditional overwrites)', () => {
  const fn = extractFunction(stateSource, 'unlockEverything');

  test('weapon assignments are unconditional (no early return before WEAPON_DEFS loop)', () => {
    expect(fn).not.toBeNull();
    // Should not have a guard like "if already unlocked, return"
    // The function must always run through WEAPON_DEFS, stagesUnlocked, and levelProgress
    expect(fn).toMatch(/WEAPON_DEFS/);
    expect(fn).toMatch(/playerData\.stagesUnlocked\s*=\s*10/);
    expect(fn).toMatch(/playerData\.levelProgress/);
  });

  test('savePlayerData is always called once (unconditional)', () => {
    const saveMatches = (fn.match(/savePlayerData\s*\(\)/g) || []);
    expect(saveMatches.length).toBe(1);
  });
});
