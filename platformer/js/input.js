import { getKeybinds } from './state.js';

const held = new Set();
let _jumpJustPressed = false;
let _escJustPressed = false;
let _dashJustPressed = false;
let _mouseDown = false;
// 5 active slots mapped to special1..special5 — consumed on press
const _specials = [false, false, false, false, false];
const SPECIAL_ACTIONS = ['special1', 'special2', 'special3', 'special4', 'special5'];

export function initInput() {
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    held.add(e.code);
    const kb = getKeybinds();
    if (kb.jump.includes(e.code)) {
      _jumpJustPressed = true;
    }
    if (e.code === 'Escape') {
      _escJustPressed = true;
    }
    if (kb.dash.includes(e.code)) {
      _dashJustPressed = true;
    }
    for (let i = 0; i < SPECIAL_ACTIONS.length; i++) {
      if (kb[SPECIAL_ACTIONS[i]].includes(e.code)) _specials[i] = true;
    }
  });
  window.addEventListener('keyup', e => {
    held.delete(e.code);
  });
  // Left mouse button also attacks (click on the canvas).
  window.addEventListener('mousedown', e => { if (e.button === 0) _mouseDown = true; });
  window.addEventListener('mouseup', e => { if (e.button === 0) _mouseDown = false; });
}

export function isLeft() {
  const codes = getKeybinds().moveLeft;
  for (const c of codes) if (held.has(c)) return true;
  return false;
}

export function isRight() {
  const codes = getKeybinds().moveRight;
  for (const c of codes) if (held.has(c)) return true;
  return false;
}

export function consumeJump() {
  const j = _jumpJustPressed;
  _jumpJustPressed = false;
  return j;
}

export function consumeEsc() {
  const e = _escJustPressed;
  _escJustPressed = false;
  return e;
}

// Attack is held-based (cooldown-gated in the game loop) so holding the key or
// mouse fires repeatedly at the weapon's rate.
export function isAttack() {
  if (_mouseDown) return true;
  for (const k of getKeybinds().attack) if (held.has(k)) return true;
  return false;
}

// Returns true once then resets — consume on the frame the key is pressed.
export function consumeSpecial(idx) {
  const v = _specials[idx];
  _specials[idx] = false;
  return v;
}

export function isDown() {
  const codes = getKeybinds().slide;
  for (const c of codes) if (held.has(c)) return true;
  return false;
}

export function consumeDash() {
  const v = _dashJustPressed;
  _dashJustPressed = false;
  return v;
}

export function clearAll() {
  held.clear();
  _jumpJustPressed = false;
  _escJustPressed = false;
  _dashJustPressed = false;
  _mouseDown = false;
  for (let i = 0; i < _specials.length; i++) _specials[i] = false;
}
