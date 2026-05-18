// Jest setup for platformer unit tests.
// Stubs canvas + AudioContext APIs that JSDOM doesn't ship.
// The test-writer agent extends this as needed per spec.

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function () {
    return {
      fillRect: () => {}, clearRect: () => {}, getImageData: () => ({ data: [] }),
      putImageData: () => {}, createImageData: () => ({}), setTransform: () => {},
      drawImage: () => {}, save: () => {}, restore: () => {}, beginPath: () => {},
      moveTo: () => {}, lineTo: () => {}, closePath: () => {}, stroke: () => {},
      fill: () => {}, arc: () => {}, rect: () => {}, translate: () => {},
      rotate: () => {}, scale: () => {}, fillText: () => {}, measureText: () => ({ width: 0 }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
    };
  };
}

if (typeof globalThis.AudioContext === 'undefined') {
  globalThis.AudioContext = class { constructor() {} createOscillator() { return { connect: () => {}, start: () => {}, stop: () => {}, frequency: { value: 0 } }; } createGain() { return { connect: () => {}, gain: { value: 0 } }; } get destination() { return {}; } };
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
