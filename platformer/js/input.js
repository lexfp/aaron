const held = new Set();
let _jumpJustPressed = false;
let _escJustPressed = false;

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
  });
  window.addEventListener('keyup', e => {
    held.delete(e.code);
  });
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

export function clearAll() {
  held.clear();
  _jumpJustPressed = false;
  _escJustPressed = false;
}
