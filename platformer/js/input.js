const held = new Set();
let _jumpJustPressed = false;
let _escJustPressed = false;
let _dashJustPressed = false;
let _mouseDown = false;
// 5 active slots mapped to Q/E/R/T/G — consumed on press
const _specials = [false, false, false, false, false];
const SPECIAL_CODES = ['KeyQ', 'KeyE', 'KeyR', 'KeyT', 'KeyG'];

const ATTACK_KEYS = new Set(['KeyJ', 'KeyX', 'KeyK', 'KeyF', 'Enter']);

export function initInput() {
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    held.add(e.code);
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      _jumpJustPressed = true;
    }
    if (e.code === 'Escape') {
      _escJustPressed = true;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      _dashJustPressed = true;
    }
    const si = SPECIAL_CODES.indexOf(e.code);
    if (si !== -1) _specials[si] = true;
  });
  window.addEventListener('keyup', e => {
    held.delete(e.code);
  });
  // Left mouse button also attacks (click on the canvas).
  window.addEventListener('mousedown', e => { if (e.button === 0) _mouseDown = true; });
  window.addEventListener('mouseup', e => { if (e.button === 0) _mouseDown = false; });
}

export function isLeft() {
  return held.has('ArrowLeft') || held.has('KeyA');
}

export function isRight() {
  return held.has('ArrowRight') || held.has('KeyD');
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
  for (const k of ATTACK_KEYS) if (held.has(k)) return true;
  return false;
}

// Returns true once then resets — consume on the frame the key is pressed.
export function consumeSpecial(idx) {
  const v = _specials[idx];
  _specials[idx] = false;
  return v;
}

export function isDown() {
  return held.has('ArrowDown') || held.has('KeyS');
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
