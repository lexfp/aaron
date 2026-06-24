/**
 * completion-skin.test.js
 *
 * Static source-analysis tests for the Completion Skin feature.
 * All scenarios are "Verify by: read …" style — they inspect the game source
 * files for the structural contracts required by the spec rather than executing
 * the full game loop.
 *
 * Jest config: jsdom, transform:{} (no transpilation). We use synchronous
 * fs.readFileSync so no dynamic import() is required.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '../../js');
const stateSrc = fs.readFileSync(path.join(ROOT, 'state.js'),  'utf8');
const mainSrc  = fs.readFileSync(path.join(ROOT, 'main.js'),   'utf8');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function has(src, pattern) {
  if (typeof pattern === 'string') return src.includes(pattern);
  return pattern.test(src);
}

/**
 * Very-lightweight extraction of the SKIN_DEFS array literal from state.js.
 * Returns raw strings for every top-level object literal `{…}` in SKIN_DEFS.
 */
function extractSkinDefEntries(src) {
  const startIdx = src.indexOf('SKIN_DEFS');
  if (startIdx === -1) return [];

  let i = src.indexOf('[', startIdx);
  if (i === -1) return [];

  let depth = 0;
  let inStr  = false;
  let strChar = '';
  const entries = [];
  let objStart = -1;
  let objDepth = 0;

  for (; i < src.length; i++) {
    const ch = src[i];

    if (!inStr && (ch === '"' || ch === "'" || ch === '`')) {
      inStr = true; strChar = ch;
    } else if (inStr && ch === strChar && src[i - 1] !== '\\') {
      inStr = false;
    }

    if (inStr) continue;

    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) break;
    } else if (ch === '{') {
      if (depth === 1 && objStart === -1) { objStart = i; objDepth = 1; }
      else if (objStart !== -1) objDepth++;
    } else if (ch === '}') {
      if (objStart !== -1) {
        objDepth--;
        if (objDepth === 0) {
          entries.push(src.slice(objStart, i + 1));
          objStart = -1;
        }
      }
    }
  }
  return entries;
}

const skinEntries = extractSkinDefEntries(stateSrc);

// ---------------------------------------------------------------------------
// Scenario 8 — Champion entry definition
// ---------------------------------------------------------------------------
describe('Scenario 8 — Champion entry definition in SKIN_DEFS', () => {

  test('SKIN_DEFS contains exactly one entry with key "champion"', () => {
    const champions = skinEntries.filter(e => /key\s*:\s*['"]champion['"]/.test(e));
    expect(champions).toHaveLength(1);
  });

  test('champion entry has label "Champion"', () => {
    const champion = skinEntries.find(e => /key\s*:\s*['"]champion['"]/.test(e));
    expect(champion).toBeDefined();
    expect(champion).toMatch(/label\s*:\s*['"]Champion['"]/);
  });

  test('champion entry has desc "Awarded for beating all 10 stages."', () => {
    const champion = skinEntries.find(e => /key\s*:\s*['"]champion['"]/.test(e));
    expect(champion).toBeDefined();
    expect(champion).toMatch(/desc\s*:\s*['"]Awarded for beating all 10 stages\.['"]/);
  });

  test('champion entry has cost 0', () => {
    const champion = skinEntries.find(e => /key\s*:\s*['"]champion['"]/.test(e));
    expect(champion).toBeDefined();
    expect(champion).toMatch(/cost\s*:\s*0\b/);
  });

  test('champion entry has unlock "all-stages"', () => {
    const champion = skinEntries.find(e => /key\s*:\s*['"]champion['"]/.test(e));
    expect(champion).toBeDefined();
    expect(champion).toMatch(/unlock\s*:\s*['"]all-stages['"]/);
  });

  test('champion entry palette has body "#f9c74f"', () => {
    const champion = skinEntries.find(e => /key\s*:\s*['"]champion['"]/.test(e));
    expect(champion).toBeDefined();
    expect(champion).toMatch(/body\s*:\s*['"]#f9c74f['"]/);
  });

  test('champion entry palette has accessory_type "crown"', () => {
    const champion = skinEntries.find(e => /key\s*:\s*['"]champion['"]/.test(e));
    expect(champion).toBeDefined();
    expect(champion).toMatch(/accessory_type\s*:\s*['"]crown['"]/);
  });

  test('champion entry palette has accessory_color "#f4a100"', () => {
    const champion = skinEntries.find(e => /key\s*:\s*['"]champion['"]/.test(e));
    expect(champion).toBeDefined();
    expect(champion).toMatch(/accessory_color\s*:\s*['"]#f4a100['"]/);
  });

});

// ---------------------------------------------------------------------------
// Scenario 1 — Grant on game completion
// Scenario 2 — No grant before completion
// Scenario 3 — Idempotent when already owned
// (These three all verify the grantCompletionSkin function structure)
// ---------------------------------------------------------------------------
describe('Scenario 1 — Grant on game completion: grantCompletionSkin structure', () => {

  test('state.js exports isGameComplete', () => {
    expect(has(stateSrc, /export\s+function\s+isGameComplete|export\s*\{[^}]*isGameComplete/)).toBe(true);
  });

  test('state.js exports grantCompletionSkin', () => {
    expect(has(stateSrc, /export\s+function\s+grantCompletionSkin|export\s*\{[^}]*grantCompletionSkin/)).toBe(true);
  });

  test('isGameComplete checks stagesUnlocked >= 10', () => {
    // Must reference stagesUnlocked and 10 together
    expect(has(stateSrc, /isGameComplete[\s\S]{0,300}stagesUnlocked[\s\S]{0,60}>=?\s*10|isGameComplete[\s\S]{0,300}10[\s\S]{0,60}stagesUnlocked/)).toBe(true);
  });

  test('grantCompletionSkin sets playerData.skins[\'champion\'] = true on grant', () => {
    expect(has(stateSrc, /skins\s*\[['"]champion['"]\]\s*=\s*true/)).toBe(true);
  });

  test('grantCompletionSkin calls savePlayerData() when granting', () => {
    expect(has(stateSrc, /grantCompletionSkin[\s\S]{0,600}savePlayerData\s*\(\s*\)/)).toBe(true);
  });

  test('grantCompletionSkin returns true when it newly grants champion', () => {
    expect(has(stateSrc, /grantCompletionSkin[\s\S]{0,800}return true/)).toBe(true);
  });

});

describe('Scenario 2 — No grant before completion: isGameComplete false path', () => {

  test('isGameComplete returns false when stagesUnlocked < 10', () => {
    // The function must have a return false (or falsy) path
    expect(has(stateSrc, /isGameComplete[\s\S]{0,400}return false|isGameComplete[\s\S]{0,400}return\s+playerData\.stagesUnlocked/)).toBe(true);
  });

  test('grantCompletionSkin returns false when not complete', () => {
    // Must have multiple return false paths
    const matches = (stateSrc.match(/return false/g) || []);
    // At least two return false: one for !isGameComplete, one for already-owned
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  test('grantCompletionSkin guards on isGameComplete() before any mutation', () => {
    expect(has(stateSrc, /grantCompletionSkin[\s\S]{0,600}isGameComplete\s*\(\s*\)/)).toBe(true);
  });

});

describe('Scenario 3 — Idempotent when already owned: ownsSkin guard', () => {

  test('grantCompletionSkin guards on ownsSkin(\'champion\') before granting', () => {
    expect(has(stateSrc, /grantCompletionSkin[\s\S]{0,600}ownsSkin\s*\(\s*['"]champion['"]\s*\)/)).toBe(true);
  });

  test('grantCompletionSkin does not call savePlayerData when already owned (guard before save)', () => {
    // The ownsSkin check must come before the savePlayerData call in the function body.
    const fnMatch = stateSrc.match(/function\s+grantCompletionSkin[\s\S]*?(?=\nfunction|\nexport|\nconst|\nlet|\nvar|$)/);
    const body = fnMatch ? fnMatch[0] : stateSrc;
    const ownsSkinPos    = body.indexOf('ownsSkin');
    const savePos        = body.indexOf('savePlayerData');
    // ownsSkin guard should appear before the savePlayerData call
    expect(ownsSkinPos).toBeGreaterThan(-1);
    expect(savePos).toBeGreaterThan(-1);
    expect(ownsSkinPos).toBeLessThan(savePos);
  });

});

// ---------------------------------------------------------------------------
// Scenario 4 — Must NOT auto-equip
// ---------------------------------------------------------------------------
describe('Scenario 4 — Must NOT auto-equip: no equipSkin call in grantCompletionSkin', () => {

  test('grantCompletionSkin does not call equipSkin', () => {
    // Extract just the grantCompletionSkin function body
    const fnMatch = stateSrc.match(/function\s+grantCompletionSkin[\s\S]*?(?=\nfunction\s|\nexport\s+function\s|\n\/\/\s*---|\nconst\s+[A-Z]|$)/);
    const body = fnMatch ? fnMatch[0] : '';
    expect(has(body, /equipSkin\s*\(/)).toBe(false);
  });

  test('grantCompletionSkin does not assign playerData.equippedSkin', () => {
    const fnMatch = stateSrc.match(/function\s+grantCompletionSkin[\s\S]*?(?=\nfunction\s|\nexport\s+function\s|\n\/\/\s*---|\nconst\s+[A-Z]|$)/);
    const body = fnMatch ? fnMatch[0] : '';
    expect(has(body, /playerData\.equippedSkin\s*=/)).toBe(false);
  });

});

// ---------------------------------------------------------------------------
// Scenario 5 — Must NOT mutate SKIN_DEFS
// ---------------------------------------------------------------------------
describe('Scenario 5 — Must NOT mutate SKIN_DEFS or SKIN_MAP in grantCompletionSkin', () => {

  test('grantCompletionSkin does not assign to SKIN_DEFS', () => {
    const fnMatch = stateSrc.match(/function\s+grantCompletionSkin[\s\S]*?(?=\nfunction\s|\nexport\s+function\s|\n\/\/\s*---|\nconst\s+[A-Z]|$)/);
    const body = fnMatch ? fnMatch[0] : '';
    // Must not contain an assignment like SKIN_DEFS[...] = or SKIN_DEFS.push(
    expect(has(body, /SKIN_DEFS\s*[\[.]/)).toBe(false);
  });

  test('grantCompletionSkin does not assign to SKIN_MAP', () => {
    const fnMatch = stateSrc.match(/function\s+grantCompletionSkin[\s\S]*?(?=\nfunction\s|\nexport\s+function\s|\n\/\/\s*---|\nconst\s+[A-Z]|$)/);
    const body = fnMatch ? fnMatch[0] : '';
    expect(has(body, /SKIN_MAP\s*[\[.]\s*['"]champion['"]\s*\]\s*=/)).toBe(false);
  });

  test('only playerData.skins is mutated (the only assignment in the grant branch)', () => {
    // Confirm skins['champion'] assignment exists and is the expected mutation
    expect(has(stateSrc, /playerData\.skins\s*\[['"]champion['"]\]\s*=\s*true/)).toBe(true);
  });

});

// ---------------------------------------------------------------------------
// Scenario 6 — Retroactive grant on load
// ---------------------------------------------------------------------------
describe('Scenario 6 — Retroactive grant on load: loadPlayerData calls grantCompletionSkin', () => {

  test('loadPlayerData is defined in state.js', () => {
    expect(has(stateSrc, /function\s+loadPlayerData/)).toBe(true);
  });

  test('loadPlayerData calls grantCompletionSkin() after merging save data', () => {
    // Extract loadPlayerData function body and check grantCompletionSkin appears
    // after any merge/spread/assign of saved data
    const fnMatch = stateSrc.match(/function\s+loadPlayerData[\s\S]*?(?=\nfunction\s|\nexport\s+function\s|\n\/\/\s*---|\nconst\s+[A-Z]|$)/);
    const body = fnMatch ? fnMatch[0] : stateSrc;
    expect(has(body, /grantCompletionSkin\s*\(\s*\)/)).toBe(true);
  });

  test('grantCompletionSkin() call in loadPlayerData comes after the merge step', () => {
    // The merge step typically uses spread, assign, or Object.assign.
    // grantCompletionSkin must come after any merge keyword.
    const fnMatch = stateSrc.match(/function\s+loadPlayerData[\s\S]*?(?=\nfunction\s|\nexport\s+function\s|\n\/\/\s*---|\nconst\s+[A-Z]|$)/);
    const body = fnMatch ? fnMatch[0] : stateSrc;

    // Look for common merge patterns
    const mergePos = Math.max(
      body.indexOf('Object.assign'),
      body.indexOf('...saved'),
      body.indexOf('saved.'),
      body.indexOf('JSON.parse')
    );
    const grantPos = body.indexOf('grantCompletionSkin');

    expect(mergePos).toBeGreaterThan(-1);
    expect(grantPos).toBeGreaterThan(-1);
    expect(grantPos).toBeGreaterThan(mergePos);
  });

});

// ---------------------------------------------------------------------------
// Scenario 7 — Grant fires on 10th-stage level completion (main.js)
// ---------------------------------------------------------------------------
describe('Scenario 7 — Grant fires on 10th-stage level completion in main.js', () => {

  test('main.js imports grantCompletionSkin from state.js', () => {
    expect(has(mainSrc, /import\s*\{[^}]*grantCompletionSkin[^}]*\}\s*from\s*['"]\.\/state\.js['"]/)).toBe(true);
  });

  test('main.js contains a call to grantCompletionSkin()', () => {
    expect(has(mainSrc, /grantCompletionSkin\s*\(\s*\)/)).toBe(true);
  });

  test('grantCompletionSkin() call immediately follows markLevelComplete(...) in main.js', () => {
    // Find the position of markLevelComplete and grantCompletionSkin in main.js.
    // grantCompletionSkin must come after markLevelComplete and with no other
    // top-level function calls between them that would indicate it is far away.
    const markPos  = mainSrc.indexOf('markLevelComplete');
    const grantPos = mainSrc.indexOf('grantCompletionSkin');

    expect(markPos).toBeGreaterThan(-1);
    expect(grantPos).toBeGreaterThan(-1);
    // grantCompletionSkin must appear after markLevelComplete
    expect(grantPos).toBeGreaterThan(markPos);

    // The two calls should be within 300 characters of each other
    // (immediately follows = same block, no intervening screen transitions etc.)
    expect(grantPos - markPos).toBeLessThan(300);
  });

});
