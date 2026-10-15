// Bruitages de Beatbox Party, synthétisés en direct (aucun fichier à charger).
// Suit le réglage « son coupé » commun aux jeux (gameSfx).

import { isSfxMuted } from '../../utils/gameSfx';

let ctx = null;
let noiseBuffer = null;

export function audioContext() {
    if (ctx) return ctx;
    const AudioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    return ctx;
}

// À appeler sur un geste du joueur (iOS)
export function unlockAudio() {
    const c = audioContext();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function noise(c) {
    if (noiseBuffer) return noiseBuffer;
    noiseBuffer = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
}

function tone(c, at, { from, to = from, dur, type = 'square', gain = 0.15 }) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(c.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
}

function hiss(c, at, { dur, gain = 0.2, freq = 6000, q = 0.8, type = 'highpass' }) {
    const src = c.createBufferSource();
    src.buffer = noise(c);
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(g).connect(c.destination);
    src.start(at);
    src.stop(at + dur + 0.02);
}

// Les trois sons de base du beatbox
const DRUMS = {
    kick: (c, at) => tone(c, at, { from: 150, to: 45, dur: 0.22, type: 'sine', gain: 0.7 }),
    snare: (c, at) => { hiss(c, at, { dur: 0.16, gain: 0.35, freq: 1800, type: 'bandpass', q: 0.7 }); tone(c, at, { from: 220, to: 160, dur: 0.08, type: 'triangle', gain: 0.2 }); },
    hat: (c, at) => hiss(c, at, { dur: 0.05, gain: 0.18, freq: 7000 }),
};

const SOUNDS = {
    tick: (c, at) => tone(c, at, { from: 880, dur: 0.04, gain: 0.06 }),
    roll: (c, at) => { tone(c, at, { from: 520, to: 1040, dur: 0.12, gain: 0.12 }); tone(c, at + 0.1, { from: 1040, dur: 0.12, gain: 0.1 }); },
    hop: (c, at) => tone(c, at, { from: 330, to: 660, dur: 0.07, gain: 0.07 }),
    coin: (c, at) => { tone(c, at, { from: 988, dur: 0.07, gain: 0.1 }); tone(c, at + 0.07, { from: 1319, dur: 0.16, gain: 0.1 }); },
    loss: (c, at) => { tone(c, at, { from: 1800, to: 2600, dur: 0.35, type: 'sine', gain: 0.06 }); tone(c, at, { from: 330, to: 160, dur: 0.3, gain: 0.08 }); },
    star: (c, at) => [523, 659, 784, 1047].forEach((f, i) => tone(c, at + i * 0.09, { from: f, dur: 0.18, type: 'triangle', gain: 0.16 })),
    drop: (c, at) => { DRUMS.kick(c, at); hiss(c, at, { dur: 0.6, gain: 0.12, freq: 900, type: 'lowpass' }); },
    turn: (c, at) => { tone(c, at, { from: 660, dur: 0.08, gain: 0.08 }); tone(c, at + 0.09, { from: 880, dur: 0.1, gain: 0.08 }); },
    count: (c, at) => tone(c, at, { from: 660, dur: 0.12, type: 'triangle', gain: 0.14 }),
    go: (c, at) => tone(c, at, { from: 1320, dur: 0.3, type: 'triangle', gain: 0.16 }),
    fail: (c, at) => tone(c, at, { from: 300, to: 110, dur: 0.35, type: 'sawtooth', gain: 0.1 }),
    win: (c, at) => [523, 659, 784, 659, 1047].forEach((f, i) => tone(c, at + i * 0.12, { from: f, dur: 0.2, type: 'triangle', gain: 0.15 })),
    ...DRUMS,
};

/** Joue un son tout de suite, ou à `delay` secondes. */
export function sfx(name, delay = 0) {
    if (isSfxMuted()) return;
    const c = audioContext();
    if (!c || !SOUNDS[name]) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    SOUNDS[name](c, c.currentTime + Math.max(0, delay));
}
