/**
 * keybindings-menu.test.js
 *
 * Jest unit tests for the Keybindings Menu spec.
 * All tests are STATIC SOURCE ANALYSIS — they read the JS source files via
 * fs.readFileSync and use regex / string matching, matching the convention
 * used by tests/unit/weapons-expansion.test.js (this Jest setup can't run
 * ESM `import`/dynamic `import()` without --experimental-vm-modules, which
 * in turn breaks the CommonJS-style suites, so behavior is verified against
 * source text rather than by importing the modules).
 *
 * Covers every `Kind: code` scenario from
 * platformer/darkfactory/specs/keybindings-menu.md
 */

'use strict';

const fs = require('fs');
const path = require('path');

const JS_ROOT = path.resolve(__dirname, '../../js');
const HTML_ROOT = path.resolve(__dirname, '../..');

function readJs(file) {
  return fs.readFileSync(path.join(JS_ROOT, file), 'utf8');
}

function readHtml() {
  return fs.readFileSync(path.join(HTML_ROOT, 'platformer.html'), 'utf8');
}

// ─── Requirement 1/2: DEFAULT_KEYBINDS and KEYBIND_ACTIONS ───────────────────

describe('state.js exports DEFAULT_KEYBINDS with the 11 actions and correct defaults', () => {
  let src;
  beforeAll(() => { src = readJs('state.js'); });

  test('DEFAULT_KEYBINDS is exported', () => {
    expect(/export\s+const\s+DEFAULT_KEYBINDS/.test(src)).toBe(true);
  });

  const expected = {
    moveLeft: ['ArrowLeft', 'KeyA'],
    moveRight: ['ArrowRight', 'KeyD'],
    jump: ['Space', 'ArrowUp', 'KeyW'],
    dash: ['ShiftLeft', 'ShiftRight'],
    slide: ['ArrowDown', 'KeyS'],
    attack: ['KeyJ', 'KeyX', 'KeyK', 'KeyF', 'Enter'],
    special1: ['KeyQ'],
    special2: ['KeyE'],
    special3: ['KeyR'],
    special4: ['KeyT'],
    special5: ['KeyG'],
  };

  test.each(Object.entries(expected))('DEFAULT_KEYBINDS.%s contains each default code', (action, codes) => {
    const block = new RegExp(`${action}\\s*:\\s*\\[([^\\]]*)\\]`).exec(src);
    expect(block).not.toBeNull();
    for (const code of codes) {
      expect(block[1]).toMatch(new RegExp(`['"]${code}['"]`));
    }
  });

  test('KEYBIND_ACTIONS is exported as an ordered array of 11 entries', () => {
    expect(/export\s+const\s+KEYBIND_ACTIONS/.test(src)).toBe(true);
    const arrMatch = /KEYBIND_ACTIONS\s*=\s*\[([\s\S]*?)\];/.exec(src);
    expect(arrMatch).not.toBeNull();
    const keyCount = (arrMatch[1].match(/key:\s*'/g) || []).length;
    expect(keyCount).toBe(11);
  });

  test('KEYBIND_ACTIONS lists actions in the same order as the table', () => {
    const arrMatch = /KEYBIND_ACTIONS\s*=\s*\[([\s\S]*?)\];/.exec(src);
    const order = [...arrMatch[1].matchAll(/key:\s*'(\w+)'/g)].map(m => m[1]);
    expect(order).toEqual([
      'moveLeft', 'moveRight', 'jump', 'dash', 'slide', 'attack',
      'special1', 'special2', 'special3', 'special4', 'special5',
    ]);
  });
});

// ─── Requirements 3/4: load merge behavior ────────────────────────────────────

describe('loadPlayerData deep-merges keybinds per-action against DEFAULT_KEYBINDS', () => {
  let src, fnSlice;
  beforeAll(() => {
    src = readJs('state.js');
    const fnStart = src.indexOf('function loadPlayerData');
    fnSlice = src.slice(fnStart, fnStart + 1200);
  });

  test('loadPlayerData references KEYBIND_ACTIONS and DEFAULT_KEYBINDS', () => {
    expect(/KEYBIND_ACTIONS/.test(fnSlice)).toBe(true);
    expect(/DEFAULT_KEYBINDS/.test(fnSlice)).toBe(true);
  });

  test('loadPlayerData builds playerData.keybinds fresh (not spread from DEFAULT directly)', () => {
    expect(/playerData\.keybinds\s*=\s*\{\}/.test(fnSlice)).toBe(true);
  });

  test('loadPlayerData falls back to DEFAULT_KEYBINDS per-action when a saved binding is missing/invalid', () => {
    expect(/Array\.isArray\(savedBinding\)/.test(fnSlice) || /Array\.isArray\([\s\S]{0,20}\.keybinds/.test(fnSlice)).toBe(true);
    expect(/DEFAULT_KEYBINDS\[key\]/.test(fnSlice)).toBe(true);
  });

  test('the default save object (DEFAULT) includes a keybinds field seeded from DEFAULT_KEYBINDS', () => {
    const defaultBlock = /const\s+DEFAULT\s*=\s*\{([\s\S]*?)\n\};/.exec(src);
    expect(defaultBlock).not.toBeNull();
    expect(/keybinds:\s*JSON\.parse\(JSON\.stringify\(DEFAULT_KEYBINDS\)\)/.test(defaultBlock[1])).toBe(true);
  });
});

// ─── Requirements 5-9: getKeybinds / setKeybind / resetKeybinds ──────────────

describe('getKeybinds / setKeybind / resetKeybinds interface', () => {
  let src, setKeybindBody, resetBody;
  beforeAll(() => {
    src = readJs('state.js');
    const setStart = src.indexOf('function setKeybind');
    setKeybindBody = src.slice(setStart, setStart + 800);
    const resetStart = src.indexOf('function resetKeybinds');
    resetBody = src.slice(resetStart, resetStart + 300);
  });

  test('getKeybinds is exported', () => {
    expect(/export\s+function\s+getKeybinds/.test(src)).toBe(true);
  });

  test('getKeybinds reads the live playerData.keybinds (not a cached copy)', () => {
    const fnStart = src.indexOf('function getKeybinds');
    const fnSlice = src.slice(fnStart, fnStart + 300);
    expect(/playerData\.keybinds/.test(fnSlice)).toBe(true);
  });

  test('setKeybind is exported', () => {
    expect(/export\s+function\s+setKeybind/.test(src)).toBe(true);
  });

  test('setKeybind rejects binding the Escape code', () => {
    expect(/code\s*===\s*'Escape'/.test(setKeybindBody)).toBe(true);
    expect(/return\s*\{\s*ok:\s*false/.test(setKeybindBody)).toBe(true);
  });

  test('setKeybind checks for a conflicting action before writing', () => {
    expect(/conflictAction/.test(setKeybindBody)).toBe(true);
    expect(/\.includes\(code\)/.test(setKeybindBody)).toBe(true);
  });

  test('setKeybind replaces the action with a single-element array on success', () => {
    expect(/\[action\]\s*=\s*\[code\]|kb\[action\]\s*=\s*\[code\]/.test(setKeybindBody)).toBe(true);
  });

  test('setKeybind calls savePlayerData on success', () => {
    expect(/savePlayerData\(\)/.test(setKeybindBody)).toBe(true);
  });

  test('resetKeybinds is exported and restores DEFAULT_KEYBINDS then saves', () => {
    expect(/export\s+function\s+resetKeybinds/.test(src)).toBe(true);
    expect(/DEFAULT_KEYBINDS/.test(resetBody)).toBe(true);
    expect(/savePlayerData\(\)/.test(resetBody)).toBe(true);
  });
});

// ─── Requirements 10-13: input.js reads live bindings ────────────────────────

describe('input.js reads all actions from getKeybinds() instead of literal codes', () => {
  let src;
  beforeAll(() => { src = readJs('input.js'); });

  test('input.js imports getKeybinds from state.js', () => {
    expect(/import\s*\{\s*getKeybinds\s*\}\s*from\s*'\.\/state\.js'/.test(src)).toBe(true);
  });

  test('the old hardcoded ATTACK_KEYS/SPECIAL_CODES constants are gone', () => {
    expect(/ATTACK_KEYS/.test(src)).toBe(false);
    expect(/SPECIAL_CODES/.test(src)).toBe(false);
  });

  test('isLeft() and isRight() consult getKeybinds()', () => {
    const leftFn = src.slice(src.indexOf('function isLeft'), src.indexOf('function isLeft') + 200);
    const rightFn = src.slice(src.indexOf('function isRight'), src.indexOf('function isRight') + 200);
    expect(/getKeybinds\(\)\.moveLeft/.test(leftFn)).toBe(true);
    expect(/getKeybinds\(\)\.moveRight/.test(rightFn)).toBe(true);
  });

  test('isDown() (slide) consults getKeybinds().slide', () => {
    const fn = src.slice(src.indexOf('function isDown'), src.indexOf('function isDown') + 200);
    expect(/getKeybinds\(\)\.slide/.test(fn)).toBe(true);
  });

  test('isAttack() consults getKeybinds().attack and still allows mouse click', () => {
    const fn = src.slice(src.indexOf('function isAttack'), src.indexOf('function isAttack') + 300);
    expect(/getKeybinds\(\)\.attack/.test(fn)).toBe(true);
    expect(/_mouseDown/.test(fn)).toBe(true);
  });

  test('jump keydown handling consults getKeybinds().jump', () => {
    expect(/kb\.jump\.includes\(e\.code\)|getKeybinds\(\)\.jump\.includes\(e\.code\)/.test(src)).toBe(true);
  });

  test('dash keydown handling consults getKeybinds().dash', () => {
    expect(/kb\.dash\.includes\(e\.code\)|getKeybinds\(\)\.dash\.includes\(e\.code\)/.test(src)).toBe(true);
  });

  test('consumeSpecial maps idx 0-4 to special1..special5 via getKeybinds()', () => {
    expect(/special1.*special2.*special3.*special4.*special5|SPECIAL_ACTIONS/.test(src)).toBe(true);
  });

  test('consumeEsc/Escape handling stays hardcoded to the literal Escape code (not driven by getKeybinds)', () => {
    const escLine = /if\s*\(\s*e\.code\s*===\s*'Escape'\s*\)/.exec(src);
    expect(escLine).not.toBeNull();
  });

  test('exported function names are unchanged', () => {
    for (const fn of ['isLeft', 'isRight', 'consumeJump', 'consumeEsc', 'isAttack', 'consumeSpecial', 'isDown', 'consumeDash', 'clearAll', 'initInput']) {
      expect(new RegExp(`export\\s+function\\s+${fn}\\b`).test(src)).toBe(true);
    }
  });
});

// ─── Requirements 14-23: UI wiring ────────────────────────────────────────────

describe('ui.js wires the keybinds menu screen, capture mode, and navigation', () => {
  let src;
  beforeAll(() => { src = readJs('ui.js'); });

  test('SCREENS includes keybinds-menu', () => {
    const arrMatch = /const\s+SCREENS\s*=\s*\[([\s\S]*?)\];/.exec(src);
    expect(arrMatch).not.toBeNull();
    expect(arrMatch[1]).toMatch(/'keybinds-menu'/);
  });

  test('ui.js imports the keybind exports from state.js', () => {
    for (const name of ['KEYBIND_ACTIONS', 'getKeybinds', 'setKeybind', 'resetKeybinds']) {
      expect(new RegExp(name).test(src)).toBe(true);
    }
  });

  test('openKeybindsMenu renders the list and shows the keybinds-menu screen', () => {
    const fnStart = src.indexOf('function openKeybindsMenu');
    expect(fnStart).toBeGreaterThan(-1);
    const fnSlice = src.slice(fnStart, fnStart + 250);
    expect(/renderKeybindsList\(\)/.test(fnSlice)).toBe(true);
    expect(/showScreen\('keybinds-menu'\)/.test(fnSlice)).toBe(true);
  });

  test('renderKeybindsList renders one row per KEYBIND_ACTIONS entry with a Rebind button', () => {
    const fnStart = src.indexOf('function renderKeybindsList');
    const fnSlice = src.slice(fnStart, fnStart + 900);
    expect(/KEYBIND_ACTIONS/.test(fnSlice)).toBe(true);
    expect(/kb-rebind-btn/.test(fnSlice)).toBe(true);
  });

  test('startKeybindCapture cancels on Escape without calling setKeybind', () => {
    const fnStart = src.indexOf('function startKeybindCapture');
    const fnSlice = src.slice(fnStart, fnStart + 500);
    const escBlock = /if\s*\(\s*e\.code\s*===\s*'Escape'\s*\)\s*\{([\s\S]{0,120})\}/.exec(fnSlice);
    expect(escBlock).not.toBeNull();
    expect(/setKeybind/.test(escBlock[1])).toBe(false);
  });

  test('startKeybindCapture calls setKeybind for non-Escape keys and re-renders', () => {
    const fnStart = src.indexOf('function startKeybindCapture');
    const fnSlice = src.slice(fnStart, fnStart + 700);
    expect(/setKeybind\(action,\s*e\.code\)/.test(fnSlice)).toBe(true);
    expect(/renderKeybindsList\(\)/.test(fnSlice)).toBe(true);
  });

  test('a conflict result surfaces the conflicting action name in the message area', () => {
    const fnStart = src.indexOf('function startKeybindCapture');
    const fnSlice = src.slice(fnStart, fnStart + 700);
    expect(/conflictAction/.test(fnSlice)).toBe(true);
    expect(/kb-conflict-msg/.test(fnSlice)).toBe(true);
  });

  test('Back button returns to the originating screen tracked by _kbReturnScreen', () => {
    expect(/_kbReturnScreen/.test(src)).toBe(true);
    expect(/btn-kb-back[\s\S]{0,150}showScreen\(_kbReturnScreen\)/.test(src)).toBe(true);
  });

  test('Reset button calls resetKeybinds and re-renders', () => {
    expect(/btn-kb-reset[\s\S]{0,150}resetKeybinds\(\)/.test(src)).toBe(true);
  });

  test('main menu keybinds button opens the menu with returnScreen main-menu', () => {
    expect(/btn-keybinds[\s\S]{0,80}openKeybindsMenu\('main-menu'\)/.test(src)).toBe(true);
  });

  test('pause menu keybinds button opens the menu with returnScreen pause-menu', () => {
    expect(/btn-pause-keybinds[\s\S]{0,80}openKeybindsMenu\('pause-menu'\)/.test(src)).toBe(true);
  });

  test('rendered key codes are converted to human-readable names', () => {
    expect(/codeLabel/.test(src)).toBe(true);
    expect(/Left Arrow|Right Arrow/.test(src)).toBe(true);
  });
});

// ─── Requirement 23: HTML entry points and screen markup ─────────────────────

describe('platformer.html has the keybinds screen and entry-point buttons', () => {
  let html;
  beforeAll(() => { html = readHtml(); });

  test('main menu has a #btn-keybinds button', () => {
    expect(/id="btn-keybinds"/.test(html)).toBe(true);
  });

  test('pause menu has a #btn-pause-keybinds button', () => {
    expect(/id="btn-pause-keybinds"/.test(html)).toBe(true);
  });

  test('#keybinds-menu screen exists with a list container, conflict message area, reset and back buttons', () => {
    expect(/id="keybinds-menu"/.test(html)).toBe(true);
    expect(/id="keybinds-list"/.test(html)).toBe(true);
    expect(/id="kb-conflict-msg"/.test(html)).toBe(true);
    expect(/id="btn-kb-reset"/.test(html)).toBe(true);
    expect(/id="btn-kb-back"/.test(html)).toBe(true);
  });
});

// ─── Edge cases ────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  test('loadPlayerData is wrapped in try/catch so corrupt save JSON falls back to defaults without throwing', () => {
    const src = readJs('state.js');
    const fnStart = src.indexOf('function loadPlayerData');
    const fnEnd = src.indexOf('\n}', fnStart);
    const fnSlice = src.slice(fnStart, fnEnd + 2);
    expect(/try\s*\{/.test(fnSlice)).toBe(true);
    expect(/catch/.test(fnSlice)).toBe(true);
  });

  test('setKeybind guards against an unknown action key', () => {
    const src = readJs('state.js');
    const fnStart = src.indexOf('function setKeybind');
    const fnSlice = src.slice(fnStart, fnStart + 200);
    expect(/DEFAULT_KEYBINDS\[action\]/.test(fnSlice)).toBe(true);
  });
});
