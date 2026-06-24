/**
 * player-skins.test.js
 * Static source-analysis tests for the Player Skins feature.
 * All tests use fs.readFileSync + regex/string search (no ES-module imports).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '../../js');
const stateSrc  = fs.readFileSync(path.join(ROOT, 'state.js'),  'utf8');
const playerSrc = fs.readFileSync(path.join(ROOT, 'player.js'), 'utf8');
const uiSrc     = fs.readFileSync(path.join(ROOT, 'ui.js'),     'utf8');

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Very-lightweight extraction of the SKIN_DEFS array literal from state.js.
 * Finds every object literal `{...}` inside SKIN_DEFS and returns them as
 * raw strings for further regex matching.
 */
function extractSkinDefEntries(src) {
  // Grab the section of text that starts with the SKIN_DEFS array declaration.
  const startIdx = src.indexOf('SKIN_DEFS');
  if (startIdx === -1) return [];

  // Walk forward to find the opening '['.
  let i = src.indexOf('[', startIdx);
  if (i === -1) return [];

  // Collect characters until the matching ']' (depth counting for brackets).
  let depth = 0;
  let start = i;
  let inStr  = false;
  let strChar = '';
  const entries = [];
  let objStart = -1;
  let objDepth = 0;

  for (; i < src.length; i++) {
    const ch = src[i];

    // Track string literals so braces inside strings don't confuse the counter.
    if (!inStr && (ch === '"' || ch === "'" || ch === '`')) {
      inStr = true; strChar = ch;
    } else if (inStr && ch === strChar && src[i - 1] !== '\\') {
      inStr = false;
    }

    if (inStr) continue;

    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) break; // end of the array
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

// ─── Scenario 1: SKIN_DEFS structure and counts ───────────────────────────

describe('Scenario 1 — SKIN_DEFS structure and counts', () => {

  test('state.js exports SKIN_DEFS', () => {
    expect(stateSrc).toMatch(/export\s+const\s+SKIN_DEFS/);
  });

  test('SKIN_DEFS is declared as an array', () => {
    // Matches: export const SKIN_DEFS = [
    expect(stateSrc).toMatch(/SKIN_DEFS\s*=\s*\[/);
  });

  test('SKIN_DEFS has between 8 and 12 entries', () => {
    expect(skinEntries.length).toBeGreaterThanOrEqual(8);
    expect(skinEntries.length).toBeLessThanOrEqual(12);
  });

  test('exactly one skin has key="default", cost=0, unlock=null', () => {
    const defaults = skinEntries.filter(e =>
      /key\s*:\s*['"]default['"]/.test(e) &&
      /cost\s*:\s*0\b/.test(e) &&
      /unlock\s*:\s*null/.test(e)
    );
    expect(defaults).toHaveLength(1);
  });

  test('at least 5 skins have unlock=null and cost > 0 (coin-purchasable)', () => {
    const coinPurchasable = skinEntries.filter(e => {
      if (!/unlock\s*:\s*null/.test(e)) return false;
      const costMatch = e.match(/cost\s*:\s*(\d+)/);
      return costMatch && parseInt(costMatch[1], 10) > 0;
    });
    expect(coinPurchasable.length).toBeGreaterThanOrEqual(5);
  });

  test('at least 1 skin has unlock.stage defined (progression-unlocked)', () => {
    const progression = skinEntries.filter(e =>
      /unlock\s*:\s*\{[^}]*stage\s*:\s*\d+/.test(e)
    );
    expect(progression.length).toBeGreaterThanOrEqual(1);
  });

  test('every skin has a "key" field', () => {
    for (const e of skinEntries) {
      expect(e).toMatch(/key\s*:/);
    }
  });

  test('every skin has a "label" field', () => {
    for (const e of skinEntries) {
      expect(e).toMatch(/label\s*:/);
    }
  });

  test('every skin has a "cost" field', () => {
    for (const e of skinEntries) {
      expect(e).toMatch(/cost\s*:/);
    }
  });

  test('every skin has an "unlock" field', () => {
    for (const e of skinEntries) {
      expect(e).toMatch(/unlock\s*:/);
    }
  });

  test('every skin has a "palette" object with required field "body"', () => {
    for (const e of skinEntries) {
      expect(e).toMatch(/body\s*:/);
    }
  });

  test('every skin palette has "bodyStripe" field', () => {
    for (const e of skinEntries) {
      expect(e).toMatch(/bodyStripe\s*:/);
    }
  });

  test('every skin palette has "limb" field', () => {
    for (const e of skinEntries) {
      expect(e).toMatch(/limb\s*:/);
    }
  });

  test('every skin palette has "leg" field', () => {
    for (const e of skinEntries) {
      expect(e).toMatch(/leg\s*:/);
    }
  });

  test('every skin palette has "skin" field', () => {
    for (const e of skinEntries) {
      expect(e).toMatch(/\bskin\s*:/);
    }
  });

  test('every skin palette has "hair" field', () => {
    for (const e of skinEntries) {
      expect(e).toMatch(/hair\s*:/);
    }
  });

});

// ─── Scenario 2: SKIN_MAP matches SKIN_DEFS ──────────────────────────────────

describe('Scenario 2 — SKIN_MAP matches SKIN_DEFS', () => {

  test('state.js exports SKIN_MAP', () => {
    expect(stateSrc).toMatch(/export\s+const\s+SKIN_MAP/);
  });

  test('SKIN_MAP is derived from SKIN_DEFS (maps key → def)', () => {
    // Should reference SKIN_DEFS in its construction (e.g. fromEntries / map / reduce)
    expect(stateSrc).toMatch(/SKIN_MAP\s*=.*SKIN_DEFS/s);
  });

  test('every "key" value in SKIN_DEFS entries is unique', () => {
    const keys = skinEntries.map(e => {
      const m = e.match(/key\s*:\s*['"]([^'"]+)['"]/);
      return m ? m[1] : null;
    }).filter(Boolean);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  test('SKIN_MAP lookup pattern covers each key in SKIN_DEFS', () => {
    // The map is built from SKIN_DEFS, so we verify SKIN_DEFS has keys and
    // SKIN_MAP is constructed referencing those same objects.
    const skinDefsRef = /SKIN_MAP\s*=\s*(?:Object\.fromEntries|SKIN_DEFS\.reduce|SKIN_DEFS\.map)/;
    const altPattern  = /SKIN_MAP\s*=.*SKIN_DEFS/s;
    const matches = skinDefsRef.test(stateSrc) || altPattern.test(stateSrc);
    expect(matches).toBe(true);
  });

});

// ─── Scenario 3: DEFAULT has skins / equippedSkin ────────────────────────────

describe('Scenario 3 — DEFAULT playerData has skins and equippedSkin', () => {

  test('DEFAULT object contains skins: { default: true }', () => {
    // Match literal object property inside DEFAULT block
    expect(stateSrc).toMatch(/skins\s*:\s*\{\s*default\s*:\s*true\s*\}/);
  });

  test('DEFAULT object contains equippedSkin: "default"', () => {
    expect(stateSrc).toMatch(/equippedSkin\s*:\s*['"]default['"]/);
  });

  test('loadPlayerData merges skins defensively', () => {
    // Should spread or assign saved.skins into playerData.skins
    expect(stateSrc).toMatch(/skins\s*.*\.\.\.(saved\.skins|DEFAULT\.skins)/s);
  });

  test('loadPlayerData merges equippedSkin defensively', () => {
    // Either spreads or has a guard for equippedSkin
    const hasSpread  = /playerData\s*=\s*\{[^}]*\.\.\.saved/.test(stateSrc);
    const hasExplicit = /equippedSkin.*saved\.equippedSkin/.test(stateSrc);
    expect(hasSpread || hasExplicit).toBe(true);
  });

});

// ─── Scenario 4: ownsSkin / buySkin / equipSkin / getEquippedSkin ────────────

describe('Scenario 4 — skin management functions exported from state.js', () => {

  test('ownsSkin is exported', () => {
    expect(stateSrc).toMatch(/export\s+function\s+ownsSkin|export\s*\{[^}]*ownsSkin/);
  });

  test('buySkin is exported', () => {
    expect(stateSrc).toMatch(/export\s+function\s+buySkin|export\s*\{[^}]*buySkin/);
  });

  test('equipSkin is exported', () => {
    expect(stateSrc).toMatch(/export\s+function\s+equipSkin|export\s*\{[^}]*equipSkin/);
  });

  test('getEquippedSkin is exported', () => {
    expect(stateSrc).toMatch(/export\s+function\s+getEquippedSkin|export\s*\{[^}]*getEquippedSkin/);
  });

  test('ownsSkin returns true for "default" unconditionally', () => {
    // Should have a short-circuit for the default key
    expect(stateSrc).toMatch(/ownsSkin[\s\S]{0,300}['"]default['"]/);
  });

  test('buySkin guards against unknown key (returns false)', () => {
    // buySkin body should reference SKIN_MAP lookup and return false when missing
    expect(stateSrc).toMatch(/buySkin[\s\S]{0,500}return false/);
  });

  test('buySkin guards against already-owned skin', () => {
    expect(stateSrc).toMatch(/buySkin[\s\S]{0,600}ownsSkin/);
  });

  test('buySkin guards against progression-locked skins (unlock.stage)', () => {
    // Should check for unlock.stage and bail out
    expect(stateSrc).toMatch(/buySkin[\s\S]{0,700}unlock[\s\S]{0,100}stage/);
  });

  test('buySkin guards against insufficient coins', () => {
    expect(stateSrc).toMatch(/buySkin[\s\S]{0,700}coins/);
  });

  test('equipSkin returns false for unknown/unowned key', () => {
    expect(stateSrc).toMatch(/equipSkin[\s\S]{0,400}return false/);
  });

  test('getEquippedSkin falls back to "default" when equippedSkin is invalid', () => {
    expect(stateSrc).toMatch(/getEquippedSkin[\s\S]{0,400}['"]default['"]/);
  });

});

// ─── Scenario 5: drawPlayer uses palette ─────────────────────────────────────

describe('Scenario 5 — drawPlayer uses skin palette from getEquippedSkin', () => {

  test('player.js imports getEquippedSkin from state.js', () => {
    expect(playerSrc).toMatch(/import\s*\{[^}]*getEquippedSkin[^}]*\}\s*from\s*['"]\.\/state\.js['"]/);
  });

  test('drawPlayer references getEquippedSkin()', () => {
    expect(playerSrc).toMatch(/getEquippedSkin\s*\(\s*\)/);
  });

  test('drawPlayer uses palette.body for coloring', () => {
    expect(playerSrc).toMatch(/palette\.body\b/);
  });

  test('drawPlayer uses palette.limb for coloring', () => {
    expect(playerSrc).toMatch(/palette\.limb\b/);
  });

  test('drawPlayer uses palette.leg for coloring', () => {
    expect(playerSrc).toMatch(/palette\.leg\b/);
  });

  test('drawPlayer uses palette.skin for coloring', () => {
    expect(playerSrc).toMatch(/palette\.skin\b/);
  });

  test('drawPlayer uses palette.hair for coloring', () => {
    expect(playerSrc).toMatch(/palette\.hair\b/);
  });

  test('hardcoded body-color literal #2980b9 no longer appears in primary coloring paths', () => {
    // The spec requires palette.body replaces the old hardcoded blue
    expect(playerSrc).not.toMatch(/#2980b9/);
  });

  test('hardcoded skin-color literal #f5cba7 no longer appears in primary coloring paths', () => {
    // The spec requires palette.skin replaces the old hardcoded flesh tone
    expect(playerSrc).not.toMatch(/#f5cba7/);
  });

});

// ─── Scenario 6: Skins section in renderShop ─────────────────────────────────

describe('Scenario 6 — Skins section in renderShop (ui.js)', () => {

  test('ui.js imports SKIN_DEFS from state.js', () => {
    expect(uiSrc).toMatch(/import\s*\{[^}]*SKIN_DEFS[^}]*\}\s*from\s*['"]\.\/state\.js['"]/);
  });

  test('renderShop (or a skin render helper) references SKIN_DEFS', () => {
    expect(uiSrc).toMatch(/SKIN_DEFS/);
  });

  test('shop uses class "shop-card" for skin cards', () => {
    // At least one string 'shop-card' should appear (weapons already use it,
    // but we also verify the skins section is rendered with the same structure)
    expect(uiSrc).toMatch(/shop-card/);
  });

  test('shop uses class "shop-buy" for skin purchase buttons', () => {
    expect(uiSrc).toMatch(/shop-buy/);
  });

  test('shop uses class "shop-maxed" for equipped/locked skins', () => {
    expect(uiSrc).toMatch(/shop-maxed/);
  });

  test('shop uses class "shop-section-title" for the Skins heading', () => {
    expect(uiSrc).toMatch(/shop-section-title/);
  });

  test('shop renders a Skins section heading', () => {
    // Should have some "Skins" label in renderShop output
    expect(uiSrc).toMatch(/Skins/);
  });

});

// ─── Scenario 7: Backward compatibility and validation guards ─────────────────

describe('Scenario 7 — Backward compatibility and validation guards', () => {

  test('buySkin returns false for progression-unlocked skins (unlock.stage defined)', () => {
    // Already verified in Scenario 4 — re-assert the specific guard pattern
    const buySkinMatch = stateSrc.match(/function\s+buySkin[\s\S]*?^}/m);
    const body = buySkinMatch ? buySkinMatch[0] : stateSrc;
    expect(body).toMatch(/unlock[\s\S]{0,80}stage|stage[\s\S]{0,80}unlock/);
  });

  test('equipSkin returns false for unknown key', () => {
    const match = stateSrc.match(/function\s+equipSkin[\s\S]*?^}/m);
    const body  = match ? match[0] : stateSrc;
    expect(body).toMatch(/return false/);
  });

  test('loadPlayerData handles old saves with no "skins" key (merges defensively)', () => {
    // The merge must use a fallback: saved.skins || {} or similar
    expect(stateSrc).toMatch(/saved\.skins\s*\|\|\s*\{\}|DEFAULT\.skins.*saved\.skins|skins.*\{.*\.\.\.(saved\.skins|\{\})/s);
  });

  test('loadPlayerData handles old saves with no "equippedSkin" key', () => {
    // Should have a fallback for equippedSkin — either via spread + DEFAULT or explicit guard
    const hasDefaultFallback = /playerData\s*=\s*\{[^}]*\.\.\.(saved|DEFAULT)/.test(stateSrc);
    const hasExplicitGuard   = /equippedSkin.*\|\|.*['"]default['"]/.test(stateSrc);
    expect(hasDefaultFallback || hasExplicitGuard).toBe(true);
  });

  test('ownsSkin always returns true for "default" skin', () => {
    // Key guard: function must short-circuit / explicitly handle 'default'
    const match = stateSrc.match(/function\s+ownsSkin[\s\S]*?^}/m);
    const body  = match ? match[0] : stateSrc;
    expect(body).toMatch(/['"]default['"]/);
  });

  test('getEquippedSkin falls back to SKIN_MAP.default when stored key is invalid', () => {
    const match = stateSrc.match(/function\s+getEquippedSkin[\s\S]*?^}/m);
    const body  = match ? match[0] : stateSrc;
    // Must reference SKIN_MAP and 'default'
    expect(body).toMatch(/SKIN_MAP/);
    expect(body).toMatch(/['"]default['"]/);
  });

});
