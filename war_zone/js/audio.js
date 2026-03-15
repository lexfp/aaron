// Simple audio system using Web Audio API

let audioCtx;

function getAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    return audioCtx;
}

export function playSound(freq, duration, type = 'square', volume = 0.1) {
    try {
        const ctx = getAudio();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = volume;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) { }
}

export function playGunshot() { playSound(150, 0.1, 'sawtooth', 0.15); }
export function playHit() { playSound(300, 0.05, 'square', 0.1); }
export function playExplosion() { playSound(60, 0.4, 'sawtooth', 0.2); }
export function playPickup() { playSound(800, 0.1, 'sine', 0.1); }
