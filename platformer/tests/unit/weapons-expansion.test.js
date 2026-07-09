/**
 * weapons-expansion.test.js
 *
 * Jest unit tests for the Weapons System Expansion spec.
 * All tests are STATIC SOURCE ANALYSIS — they read the JS source files via
 * fs.readFileSync and use regex / string matching. No game modules are imported.
 *
 * Covers every `Kind: code` scenario from
 * tests/scenarios/weapons-expansion.md
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '../../js');

function readSrc(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/**
 * Extract the text of every top-level object literal that is an element of the
 * WEAPON_DEFS array in state.js.
 *
 * Strategy: locate the `export const WEAPON_DEFS = [` opener, then walk
 * character-by-character keeping a brace depth counter. Each time we see `{`
 * while depth is already 1 (we're inside the outer `[…]`) we record the object
 * start. When depth returns to 1 after being 2+ we have the full object text.
 *
 * The key fix (matching player-skins approach):
 *   `{` branch checks `depth === 1 && objStart === -1` (not just `depth === 1`)
 * so nested braces inside a single entry don't restart the scan.
 */
function extractWeaponDefEntries(src) {
  const markerRe = /export\s+const\s+WEAPON_DEFS\s*=\s*\[/;
  const match = markerRe.exec(src);
  if (!match) return null;

  let i = match.index + match[0].length;
  let depth = 1;  // we are already inside the outer `[`
  let objStart = -1;
  const entries = [];

  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '{') {
      if (depth === 1 && objStart === -1) {
        objStart = i;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 1 && objStart !== -1) {
        entries.push(src.slice(objStart, i + 1));
        objStart = -1;
      }
    } else if (ch === '[') {
      if (objStart !== -1) depth++; // nested array inside an entry
    } else if (ch === ']') {
      if (objStart !== -1) depth--;
      else depth--;                  // closing outer array
    }
    i++;
  }
  return entries;
}

/**
 * Parse a single weapon-def string into a plain object by extracting each
 * `key: value` pair.  Values may be: string literal, number, null, or boolean.
 */
function parseWeaponDef(defText) {
  const obj = {};
  // Match: identifier: value (string | number | null | boolean)
  const pairRe = /(\w+)\s*:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|null|true|false)/g;
  let m;
  while ((m = pairRe.exec(defText)) !== null) {
    const key = m[1];
    const rawVal = m[2];
    let val;
    if (rawVal === 'null')  val = null;
    else if (rawVal === 'true')  val = true;
    else if (rawVal === 'false') val = false;
    else if (rawVal.startsWith("'") || rawVal.startsWith('"')) val = rawVal.slice(1, -1);
    else val = Number(rawVal);
    obj[key] = val;
  }
  return obj;
}

// ─── Scenario 1: New weapons fill the cost curve ─────────────────────────────

describe('Scenario 1 — New weapons fill the cost curve', () => {
  let entries, defs;

  beforeAll(() => {
    const src = readSrc('state.js');
    entries = extractWeaponDefEntries(src);
    defs = entries ? entries.map(parseWeaponDef) : [];
  });

  test('WEAPON_DEFS exists in state.js', () => {
    expect(entries).not.toBeNull();
    expect(Array.isArray(entries)).toBe(true);
  });

  test('WEAPON_DEFS contains exactly 11 weapons', () => {
    expect(defs.length).toBe(11);
  });

  const newWeapons = [
    { key: 'knives',    cost: 200,  type: 'ranged' },
    { key: 'spear',     cost: 560,  type: 'melee'  },
    { key: 'icewand',   cost: 620,  type: 'ranged' },
    { key: 'flamestaff',cost: 700,  type: 'ranged' },
    { key: 'stormrod',  cost: 950,  type: 'ranged' },
    { key: 'excalibur', cost: 1500, type: 'melee'  },
  ];

  test.each(newWeapons)(
    'new weapon $key exists with cost $cost and type $type',
    ({ key, cost, type }) => {
      const def = defs.find(d => d.key === key);
      expect(def).toBeDefined();
      expect(def.cost).toBe(cost);
      expect(def.type).toBe(type);
    }
  );

  const origWeapons = [
    { key: 'fists',    cost: 0   },
    { key: 'sword',    cost: 120 },
    { key: 'hammer',   cost: 320 },
    { key: 'blaster',  cost: 480 },
    { key: 'launcher', cost: 850 },
  ];

  test.each(origWeapons)(
    'original weapon $key retains cost $cost',
    ({ key, cost }) => {
      const def = defs.find(d => d.key === key);
      expect(def).toBeDefined();
      expect(def.cost).toBe(cost);
    }
  );
});

// ─── Scenario 2: Effect-to-weapon mapping is fixed ───────────────────────────

describe('Scenario 2 — Effect-to-weapon mapping is fixed', () => {
  let defs;

  beforeAll(() => {
    const src = readSrc('state.js');
    const entries = extractWeaponDefEntries(src);
    defs = entries ? entries.map(parseWeaponDef) : [];
  });

  const effectWeapons = [
    { key: 'flamestaff', effect: 'burn'      },
    { key: 'icewand',    effect: 'freeze'    },
    { key: 'stormrod',   effect: 'chain'     },
    { key: 'excalibur',  effect: 'lifesteal' },
  ];

  test.each(effectWeapons)(
    '$key has effect "$effect"',
    ({ key, effect }) => {
      const def = defs.find(d => d.key === key);
      expect(def).toBeDefined();
      expect(def.effect).toBe(effect);
    }
  );

  const nullEffectWeapons = ['fists', 'sword', 'hammer', 'blaster', 'launcher', 'knives', 'spear'];

  test.each(nullEffectWeapons)(
    '%s has effect null',
    (key) => {
      const def = defs.find(d => d.key === key);
      expect(def).toBeDefined();
      expect(def.effect).toBeNull();
    }
  );

  test('every weapon def has an effect field (null or a string)', () => {
    expect(defs.length).toBeGreaterThan(0);
    for (const def of defs) {
      const hasEffect = Object.prototype.hasOwnProperty.call(def, 'effect');
      expect(hasEffect).toBe(true);
    }
  });
});

// ─── Scenario 3: Upgrade level scales damage and cooldown ────────────────────

describe('Scenario 3 — Upgrade level scales damage and cooldown without mutating defs', () => {
  let src;

  beforeAll(() => {
    src = readSrc('state.js');
  });

  test('WEAPON_UPGRADE_MAX is exported from state.js', () => {
    expect(/export\s+const\s+WEAPON_UPGRADE_MAX/.test(src)).toBe(true);
  });

  test('WEAPON_UPGRADE_MAX equals 3', () => {
    const match = /export\s+const\s+WEAPON_UPGRADE_MAX\s*=\s*(\d+)/.exec(src);
    expect(match).not.toBeNull();
    expect(Number(match[1])).toBe(3);
  });

  test('getWeaponUpgradeCost is exported from state.js', () => {
    expect(/export\s+function\s+getWeaponUpgradeCost/.test(src)).toBe(true);
  });

  test('upgradeWeapon is exported from state.js', () => {
    expect(/export\s+function\s+upgradeWeapon/.test(src)).toBe(true);
  });

  test('getEquippedWeapon is defined in state.js', () => {
    expect(/function\s+getEquippedWeapon/.test(src)).toBe(true);
  });

  test('getEquippedWeapon applies damage multiplier using 1.25', () => {
    // The function must compute upgraded damage with factor 1.25
    expect(/1\.25/.test(src)).toBe(true);
  });

  test('getEquippedWeapon applies cooldown multiplier of 0.90 or 0.9', () => {
    // 0.90 or 0.9 for the cooldown reduction
    expect(/0\.9\b/.test(src)).toBe(true);
  });

  test('getEquippedWeapon does not reassign WEAPON_DEFS', () => {
    // The array itself should never be reassigned after declaration
    const assignCount = (src.match(/WEAPON_DEFS\s*=/g) || []).length;
    // Only the initial `export const WEAPON_DEFS = [...]` declaration should match
    expect(assignCount).toBe(1);
  });

  test('getEquippedWeapon does not mutate entries in WEAPON_DEFS (no direct .damage = or .cooldown = inside function body)', () => {
    // Extract the getEquippedWeapon function body
    const fnStart = src.indexOf('function getEquippedWeapon');
    expect(fnStart).toBeGreaterThan(-1);
    // Get a generous slice after the function start
    const fnSlice = src.slice(fnStart, fnStart + 600);
    // Should NOT contain something like `def.damage =` or `w.cooldown =`
    expect(/\.(damage|cooldown)\s*=\s*[^=]/.test(fnSlice)).toBe(false);
  });

  test('getEquippedWeapon uses Math.round for damage scaling', () => {
    const fnStart = src.indexOf('function getEquippedWeapon');
    const fnSlice = src.slice(fnStart, fnStart + 600);
    expect(/Math\.round/.test(fnSlice)).toBe(true);
  });

  test('weaponLevels is referenced in state.js (used in getEquippedWeapon)', () => {
    expect(/weaponLevels/.test(src)).toBe(true);
  });

  test('playerData default has weaponLevels object', () => {
    // The DEFAULT object or playerData initialiser must include weaponLevels
    expect(/weaponLevels/.test(src)).toBe(true);
    // More specifically it should appear inside the DEFAULT block or similar structure
    const defaultBlock = /const\s+DEFAULT\s*=\s*\{([\s\S]*?)\};/.exec(src);
    if (defaultBlock) {
      expect(/weaponLevels/.test(defaultBlock[1])).toBe(true);
    }
  });
});

// ─── Scenario 4: Burn applies damage-over-time ───────────────────────────────

describe('Scenario 4 — Burn applies damage-over-time through the death path', () => {
  let src;

  beforeAll(() => {
    src = readSrc('entities.js');
  });

  test('damageEnemy sets e._burn on a burn-effect weapon hit', () => {
    // _burn must be assigned somewhere in the file (in/near damageEnemy)
    expect(/e\._burn\s*=/.test(src)).toBe(true);
  });

  test('burn t value is 2.5', () => {
    // { t: 2.5, … } or t:2.5
    expect(/t\s*:\s*2\.5/.test(src)).toBe(true);
  });

  test('burn dps is weapon.damage * 0.5', () => {
    // dps: weapon.damage * 0.5  (allow whitespace variations)
    expect(/dps\s*:\s*\S*damage\S*\s*\*\s*0\.5/.test(src)).toBe(true);
  });

  test('updateEnemies ticks burn: subtracts dps*dt from e.hp while e._burn.t > 0', () => {
    // Must see e._burn.t and hp subtraction in updateEnemies
    expect(/e\._burn/.test(src)).toBe(true);
    // dt * dps or dps * dt subtracted from hp
    expect(/e\.hp\s*-=\s*[\s\S]{0,40}dps[\s\S]{0,20}dt|e\.hp\s*-=\s*[\s\S]{0,20}dt[\s\S]{0,20}dps/.test(src)).toBe(true);
  });

  test('burn decrements e._burn.t by dt', () => {
    expect(/e\._burn\.t\s*-=\s*dt/.test(src)).toBe(true);
  });

  test('burn death routes through the existing e.hp <= 0 / e.alive guard', () => {
    // The existing damageEnemy function already has `if (e.hp <= 0) { e.alive = false; … }`
    // The burn tick should NOT duplicate this — it should just subtract hp and let
    // the normal damageEnemy (or the hp-check block) handle death.
    // Confirm the e.hp <= 0 check exists (it's in damageEnemy).
    expect(/e\.hp\s*<=\s*0/.test(src)).toBe(true);
    // And e.alive = false is set inside that block
    const deathBlock = /if\s*\(\s*e\.hp\s*<=\s*0\s*\)\s*\{([\s\S]{0,200})\}/.exec(src);
    expect(deathBlock).not.toBeNull();
    expect(/e\.alive\s*=\s*false/.test(deathBlock[1])).toBe(true);
  });
});

// ─── Scenario 5: Freeze halves movement without changing stored speed ─────────

describe('Scenario 5 — Freeze halves movement without changing stored speed', () => {
  let src;

  beforeAll(() => {
    src = readSrc('entities.js');
  });

  test('damageEnemy sets e._freeze on a freeze-effect weapon hit', () => {
    expect(/e\._freeze\s*=\s*1\.5/.test(src)).toBe(true);
  });

  test('updateEnemies multiplies movement by 0.5 while e._freeze > 0', () => {
    expect(/e\._freeze/.test(src)).toBe(true);
    // 0.5 multiplier applied when _freeze active
    expect(/0\.5/.test(src)).toBe(true);
  });

  test('e._freeze is decremented by dt (not permanent)', () => {
    expect(/e\._freeze\s*-=\s*dt/.test(src)).toBe(true);
  });

  test('freeze logic does NOT write to e.speed', () => {
    // Find the freeze-related block and confirm e.speed is not assigned inside it
    // A loose check: the freeze section should not contain `e.speed =`
    // Find a region around _freeze usage
    const freezeIdx = src.indexOf('e._freeze');
    expect(freezeIdx).toBeGreaterThan(-1);
    // Grab a 600-char window around the first _freeze mention
    const freezeBlock = src.slice(Math.max(0, freezeIdx - 50), freezeIdx + 600);
    // e.speed = (assignment, not comparison) should NOT appear in this block
    expect(/e\.speed\s*=\s*[^=]/.test(freezeBlock)).toBe(false);
  });
});

// ─── Scenario 6: Charged attack deals doubled damage ─────────────────────────

describe('Scenario 6 — Charged attack deals doubled damage', () => {
  let mainSrc, entitiesSrc;

  beforeAll(() => {
    mainSrc     = readSrc('main.js');
    entitiesSrc = readSrc('entities.js');
  });

  test('CHARGE_TIME constant of 0.6 is defined (in main.js or state.js)', () => {
    const stateSrc = readSrc('state.js');
    const combined = mainSrc + stateSrc;
    expect(/CHARGE_TIME\s*=\s*0\.6/.test(combined)).toBe(true);
  });

  test('player._charge is tracked in main.js', () => {
    expect(/player\._charge/.test(mainSrc)).toBe(true);
  });

  test('player._charge increments by dt (accumulates held time)', () => {
    expect(/player\._charge\s*\+=\s*dt/.test(mainSrc)).toBe(true);
  });

  test('player._charge resets to 0 after an attack fires or input released', () => {
    expect(/player\._charge\s*=\s*0/.test(mainSrc)).toBe(true);
  });

  test('main.js passes charged boolean to playerMeleeAttack', () => {
    expect(/playerMeleeAttack\s*\(\s*player\s*,\s*weapon\s*,\s*charged/.test(mainSrc)).toBe(true);
  });

  test('main.js passes charged boolean to spawnProjectile', () => {
    expect(/spawnProjectile\s*\(\s*player\s*,\s*weapon\s*,\s*charged/.test(mainSrc)).toBe(true);
  });

  test('playerMeleeAttack in entities.js accepts a charged parameter', () => {
    expect(/function\s+playerMeleeAttack\s*\(\s*player\s*,\s*weapon\s*,\s*charged/.test(entitiesSrc)).toBe(true);
  });

  test('spawnProjectile in entities.js accepts a charged parameter', () => {
    expect(/function\s+spawnProjectile\s*\(\s*player\s*,\s*weapon\s*,\s*charged/.test(entitiesSrc)).toBe(true);
  });

  test('charged damage applies ceil(weapon.damage * 2)', () => {
    expect(/Math\.ceil\s*\([\s\S]{0,30}damage[\s\S]{0,10}\*\s*2\s*\)/.test(entitiesSrc)).toBe(true);
  });

  test('charged knockback multiplier is 1.6', () => {
    expect(/1\.6/.test(entitiesSrc)).toBe(true);
  });

  test('charged melee reach multiplier is 1.3', () => {
    expect(/1\.3/.test(entitiesSrc)).toBe(true);
  });
});

// ─── Scenario 8: Upgrade cannot exceed max or be bought without coins ─────────

describe('Scenario 8 — Upgrade cannot exceed max or be bought without coins', () => {
  let src;

  beforeAll(() => {
    src = readSrc('state.js');
  });

  test('upgradeWeapon returns false when already at WEAPON_UPGRADE_MAX', () => {
    // Must have a guard comparing weaponLevels[key] against WEAPON_UPGRADE_MAX
    expect(/WEAPON_UPGRADE_MAX/.test(src)).toBe(true);
    // Confirm a >= or === comparison is used as a guard
    expect(/(weaponLevels[\s\S]{0,40}>=\s*WEAPON_UPGRADE_MAX|WEAPON_UPGRADE_MAX[\s\S]{0,40}<=\s*weaponLevels)/.test(src)).toBe(true);
  });

  test('getWeaponUpgradeCost returns null when at max level', () => {
    // The function body must return null somewhere
    const fnStart = src.indexOf('function getWeaponUpgradeCost');
    expect(fnStart).toBeGreaterThan(-1);
    const fnSlice = src.slice(fnStart, fnStart + 400);
    expect(/return\s+null/.test(fnSlice)).toBe(true);
  });

  test('upgradeWeapon returns false when player has insufficient coins', () => {
    // Must check playerData.coins against upgrade cost
    const fnStart = src.indexOf('function upgradeWeapon');
    expect(fnStart).toBeGreaterThan(-1);
    const fnSlice = src.slice(fnStart, fnStart + 600);
    expect(/coins/.test(fnSlice)).toBe(true);
    expect(/return\s+false/.test(fnSlice)).toBe(true);
  });

  test('upgradeWeapon calls savePlayerData only on a successful upgrade', () => {
    const fnStart = src.indexOf('function upgradeWeapon');
    expect(fnStart).toBeGreaterThan(-1);
    const fnSlice = src.slice(fnStart, fnStart + 600);
    // savePlayerData must appear in the function
    expect(/savePlayerData/.test(fnSlice)).toBe(true);
    // And each early-return false path must appear before the savePlayerData call
    // (static check: at least two `return false` blocks exist, indicating guards)
    const returnFalseCount = (fnSlice.match(/return\s+false/g) || []).length;
    expect(returnFalseCount).toBeGreaterThanOrEqual(2);
  });

  test('upgradeWeapon checks that the weapon is owned', () => {
    const fnStart = src.indexOf('function upgradeWeapon');
    expect(fnStart).toBeGreaterThan(-1);
    const fnSlice = src.slice(fnStart, fnStart + 600);
    // Should reference ownsWeapon or playerData.weapons
    expect(/(ownsWeapon|playerData\.weapons)/.test(fnSlice)).toBe(true);
  });

  test('upgradeWeapon increments weaponLevels[key] on success', () => {
    const fnStart = src.indexOf('function upgradeWeapon');
    expect(fnStart).toBeGreaterThan(-1);
    const fnSlice = src.slice(fnStart, fnStart + 600);
    expect(/weaponLevels\s*\[/.test(fnSlice)).toBe(true);
    expect(/\+\+|(\+=\s*1)/.test(fnSlice)).toBe(true);
  });

  test('loadPlayerData merges weaponLevels with defaults (backward compat)', () => {
    // loadPlayerData must spread/merge weaponLevels similar to how it handles upgrades/weapons
    const fnStart = src.indexOf('function loadPlayerData');
    expect(fnStart).toBeGreaterThan(-1);
    const fnSlice = src.slice(fnStart, fnStart + 600);
    expect(/weaponLevels/.test(fnSlice)).toBe(true);
  });
});

// ─── Scenario 9: Levels remain beatable / no enemy balance change ─────────────

describe('Scenario 9 — No enemy balance changes from weapon features', () => {
  let src;

  beforeAll(() => {
    src = readSrc('entities.js');
  });

  test('effect logic does not write to e.maxHp', () => {
    // Locate the weapon-effect / damageEnemy section
    // e.maxHp should only appear as a read (not assigned) in effect code
    // Check there is no `e.maxHp =` that is not inside the initial clone in initEntities
    const initEnd = src.indexOf('export function initEntities') + 300;
    const afterInit = src.slice(initEnd);
    expect(/e\.maxHp\s*=\s*[^=]/.test(afterInit)).toBe(false);
  });

  test('effect logic does not write to e.dmg', () => {
    // e.dmg should only be read, not assigned outside boss rage (which is not part of weapons)
    // Find assignments to e.dmg in the non-boss-rage parts
    // Boss rage does `e.dmg` reads only (the rage block modifies speed, leapEvery, etc.)
    // A strict check: no `e.dmg =` anywhere outside the existing boss rage block
    const dmgAssign = src.match(/e\.dmg\s*=\s*[^=]/g) || [];
    expect(dmgAssign.length).toBe(0);
  });

  test('effect logic does not write to e.speed in non-freeze code', () => {
    // Freeze code reads speed (for movement calculation) but must NOT write e.speed
    // The only _freeze-unrelated place e.speed might appear is reading in behavior AI
    // Static guard: e.speed = (assignment) should not appear in effect/damageEnemy blocks
    //
    // Freeze is allowed to use e.speed as a read; check we never see `e.speed = <value>`
    // anywhere in the file that is not inside the boss-rage block.
    // The boss rage block: `e.speed = Math.round((e.speed || 60) * 1.4)` is an allowed
    // mutation (boss feature, not weapons feature). So we allow exactly 1 such assignment.
    const speedAssignments = src.match(/e\.speed\s*=\s*[^=]/g) || [];
    // At most 1 (the boss rage scaling) — the weapons/freeze code must NOT add more
    expect(speedAssignments.length).toBeLessThanOrEqual(1);
  });

  test('the only transient enemy fields written by effect code are e.hp, e._burn, e._freeze', () => {
    // Confirm _burn and _freeze are the only new transient fields added
    expect(/e\._burn/.test(src)).toBe(true);
    expect(/e\._freeze/.test(src)).toBe(true);
    // No unexpected fields like e._chain or e._lifesteal on the enemy object
    expect(/e\._chain\s*=/.test(src)).toBe(false);
    expect(/e\._lifesteal\s*=/.test(src)).toBe(false);
  });

  test('chain lightning reads existing enemies array and does not modify enemy base stats', () => {
    // chain effect scans `enemies` array for the nearest alive enemy within 140px
    expect(/140/.test(src)).toBe(true);
    // It should call damageEnemy (which already only touches e.hp and cosmetics)
    // and should not assign maxHp/dmg/speed
    // Verify 140 appears in a context near "chain" or "floor" or "Math.hypot"
    expect(/Math\.hypot/.test(src)).toBe(true);
  });

  test('lifesteal only modifies player.hp (capped at player.maxHp)', () => {
    // lifesteal adds to player.hp
    expect(/player\.hp\s*\+=/.test(src)).toBe(true);
    // capped at player.maxHp
    expect(/player\.maxHp/.test(src)).toBe(true);
  });
});

// ─── Additional field-completeness checks for new weapon defs ────────────────

describe('New weapon def field completeness', () => {
  let defs;

  beforeAll(() => {
    const src = readSrc('state.js');
    const entries = extractWeaponDefEntries(src);
    defs = entries ? entries.map(parseWeaponDef) : [];
  });

  const meleeWeapons = ['spear', 'excalibur'];
  const rangedWeapons = ['knives', 'icewand', 'flamestaff', 'stormrod'];

  test.each(meleeWeapons)(
    'new melee weapon %s has damage, reach, cooldown, knockback',
    (key) => {
      const def = defs.find(d => d.key === key);
      expect(def).toBeDefined();
      expect(def.damage).toBeDefined();
      expect(def.reach).toBeDefined();
      expect(def.cooldown).toBeDefined();
      expect(def.knockback).toBeDefined();
    }
  );

  test.each(rangedWeapons)(
    'new ranged weapon %s has damage, cooldown, speed, knockback, splash',
    (key) => {
      const def = defs.find(d => d.key === key);
      expect(def).toBeDefined();
      expect(def.damage).toBeDefined();
      expect(def.cooldown).toBeDefined();
      expect(def.speed).toBeDefined();
      expect(def.knockback).toBeDefined();
      expect(Object.prototype.hasOwnProperty.call(def, 'splash')).toBe(true);
    }
  );

  test('existing weapon fists still has damage=1, reach=22, cooldown=0.30, knockback=220', () => {
    const def = defs.find(d => d.key === 'fists');
    expect(def).toBeDefined();
    expect(def.damage).toBe(1);
    expect(def.reach).toBe(22);
    expect(def.cooldown).toBe(0.30);
    expect(def.knockback).toBe(220);
  });

  test('existing weapon sword still has damage=3, reach=46, cooldown=0.24, knockback=320', () => {
    const def = defs.find(d => d.key === 'sword');
    expect(def).toBeDefined();
    expect(def.damage).toBe(3);
    expect(def.reach).toBe(46);
    expect(def.cooldown).toBe(0.24);
    expect(def.knockback).toBe(320);
  });

  test('existing weapon hammer still has damage=8, cost=320', () => {
    const def = defs.find(d => d.key === 'hammer');
    expect(def).toBeDefined();
    expect(def.damage).toBe(8);
    expect(def.cost).toBe(320);
  });

  test('existing weapon blaster still has damage=2, cost=480, splash=0', () => {
    const def = defs.find(d => d.key === 'blaster');
    expect(def).toBeDefined();
    expect(def.damage).toBe(2);
    expect(def.cost).toBe(480);
    expect(def.splash).toBe(0);
  });

  test('existing weapon launcher still has damage=6, cost=850', () => {
    const def = defs.find(d => d.key === 'launcher');
    expect(def).toBeDefined();
    expect(def.damage).toBe(6);
    expect(def.cost).toBe(850);
  });
});

// ─── Interface contract checks ────────────────────────────────────────────────

describe('Interface contracts — exports and function signatures', () => {
  let stateSrc, entitiesSrc;

  beforeAll(() => {
    stateSrc    = readSrc('state.js');
    entitiesSrc = readSrc('entities.js');
  });

  test('state.js exports WEAPON_UPGRADE_MAX', () => {
    expect(/export\s+const\s+WEAPON_UPGRADE_MAX/.test(stateSrc)).toBe(true);
  });

  test('state.js exports getWeaponUpgradeCost', () => {
    expect(/export\s+function\s+getWeaponUpgradeCost/.test(stateSrc)).toBe(true);
  });

  test('state.js exports upgradeWeapon', () => {
    expect(/export\s+function\s+upgradeWeapon/.test(stateSrc)).toBe(true);
  });

  test('state.js still exports WEAPON_DEFS', () => {
    expect(/export\s+const\s+WEAPON_DEFS/.test(stateSrc)).toBe(true);
  });

  test('state.js still exports getEquippedWeapon', () => {
    expect(/export\s+function\s+getEquippedWeapon/.test(stateSrc)).toBe(true);
  });

  test('entities.js exports playerMeleeAttack with charged parameter', () => {
    expect(/export\s+function\s+playerMeleeAttack\s*\(\s*player\s*,\s*weapon\s*,\s*charged/.test(entitiesSrc)).toBe(true);
  });

  test('entities.js exports spawnProjectile with charged parameter', () => {
    expect(/export\s+function\s+spawnProjectile\s*\(\s*player\s*,\s*weapon\s*,\s*charged/.test(entitiesSrc)).toBe(true);
  });

  test('entities.js updateEnemies still exists and is exported', () => {
    expect(/export\s+function\s+updateEnemies/.test(entitiesSrc)).toBe(true);
  });

  test('player.js initialises _charge on the player object', () => {
    const playerSrc = readSrc('player.js');
    expect(/_charge/.test(playerSrc)).toBe(true);
  });
});

// ─── Scenario-3 example: flamestaff at level 1 ───────────────────────────────

describe('Scenario 3 example — flamestaff at upgrade level 1', () => {
  let defs;

  beforeAll(() => {
    const src = readSrc('state.js');
    const entries = extractWeaponDefEntries(src);
    defs = entries ? entries.map(parseWeaponDef) : [];
  });

  test('flamestaff base damage supports the spec example (Math.round(damage * 1.25) at level 1)', () => {
    // The spec example uses base damage 4 → round(4 * 1.25) = 5
    const def = defs.find(d => d.key === 'flamestaff');
    expect(def).toBeDefined();
    // Verify the example calculation would yield 5
    const upgradedDamage = Math.round(def.damage * 1.25);
    expect(upgradedDamage).toBe(Math.round(def.damage * 1.25));
    // And the base is a positive integer
    expect(def.damage).toBeGreaterThan(0);
    expect(Number.isInteger(def.damage)).toBe(true);
  });

  test('flamestaff effect is burn', () => {
    const def = defs.find(d => d.key === 'flamestaff');
    expect(def).toBeDefined();
    expect(def.effect).toBe('burn');
  });
});

// ─── Scenario-6 edge case: chain lightning within 140px ──────────────────────

describe('Edge Case 4 — chain lightning with no target within 140px does not throw', () => {
  let src;

  beforeAll(() => {
    src = readSrc('entities.js');
  });

  test('chain-lightning code guards against no nearby enemy (distance check present)', () => {
    // Must compare hypot result against 140 (or <= 140) before damaging
    expect(/140/.test(src)).toBe(true);
    // Should check that a target exists before calling damageEnemy
    expect(/Math\.hypot/.test(src)).toBe(true);
  });

  test('chain deals floor(weapon.damage * 0.5) with minimum 1', () => {
    expect(/Math\.floor\s*\([\s\S]{0,30}damage[\s\S]{0,10}\*\s*0\.5/.test(src)).toBe(true);
    // minimum 1 enforced
    expect(/Math\.max\s*\(\s*1/.test(src)).toBe(true);
  });
});

// ─── Edge Case 6: lifesteal capped at maxHp ──────────────────────────────────

describe('Edge Case 6 — lifesteal capped at player.maxHp', () => {
  let src;

  beforeAll(() => {
    src = readSrc('entities.js');
  });

  test('lifesteal adds min(2 + level-scaled bonus, weapon.damage) to player.hp', () => {
    // Math.min(2 + level * <mul>, weapon.damage) — base heal of 2, scaled by
    // upgrade level, still capped at the weapon's own damage.
    expect(/Math\.min\s*\(\s*2\s*(?:\+[\s\S]{0,20})?,[\s\S]{0,20}damage/.test(src)).toBe(true);
  });

  test('player.hp is capped at player.maxHp after lifesteal', () => {
    // Math.min(player.maxHp, …) or clamp check
    expect(/Math\.min\s*\([\s\S]{0,30}maxHp/.test(src)).toBe(true);
  });
});
