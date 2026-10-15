// Bruitages et musique de Beatbox Party, synthétisés en direct (aucun fichier à charger).
// Suit le réglage « son coupé » commun aux jeux (gameSfx).
//
// Deux bus : les bruitages, et la musique du plateau (une boucle de beatbox plus
// discrète, qu'on peut couper séparément).

import { isSfxMuted } from '../../utils/gameSfx';

let ctx = null;
let noiseBuffer = null;
let sfxBus = null;
let musicBus = null;

export function audioContext() {
    if (ctx) return ctx;
    const AudioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.22;
    musicBus.connect(ctx.destination);
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

function tone(c, out, at, { from, to = from, dur, type = 'square', gain = 0.15 }) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.02);
}

function hiss(c, out, at, { dur, gain = 0.2, freq = 6000, q = 0.8, type = 'highpass' }) {
    const src = c.createBufferSource();
    src.buffer = noise(c);
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(g).connect(out);
    src.start(at);
    src.stop(at + dur + 0.02);
}

// Les sons de base du beatbox
const DRUMS = {
    kick: (c, o, at) => tone(c, o, at, { from: 150, to: 45, dur: 0.22, type: 'sine', gain: 0.7 }),
    snare: (c, o, at) => { hiss(c, o, at, { dur: 0.16, gain: 0.35, freq: 1800, type: 'bandpass', q: 0.7 }); tone(c, o, at, { from: 220, to: 160, dur: 0.08, type: 'triangle', gain: 0.2 }); },
    hat: (c, o, at) => hiss(c, o, at, { dur: 0.05, gain: 0.18, freq: 7000 }),
};

const note = (n) => 440 * 2 ** ((n - 69) / 12);

const SOUNDS = {
    tick: (c, o, at) => tone(c, o, at, { from: 880, dur: 0.04, gain: 0.06 }),
    roll: (c, o, at) => { tone(c, o, at, { from: 520, to: 1040, dur: 0.12, gain: 0.12 }); tone(c, o, at + 0.1, { from: 1040, dur: 0.12, gain: 0.1 }); },
    hit: (c, o, at) => { DRUMS.kick(c, o, at); tone(c, o, at, { from: 1200, to: 600, dur: 0.12, gain: 0.08 }); },
    hop: (c, o, at) => tone(c, o, at, { from: 330, to: 660, dur: 0.07, gain: 0.07 }),
    step: (c, o, at) => tone(c, o, at, { from: 760, dur: 0.05, type: 'triangle', gain: 0.08 }),
    coin: (c, o, at) => { tone(c, o, at, { from: 988, dur: 0.07, gain: 0.1 }); tone(c, o, at + 0.07, { from: 1319, dur: 0.16, gain: 0.1 }); },
    loss: (c, o, at) => { tone(c, o, at, { from: 1800, to: 2600, dur: 0.35, type: 'sine', gain: 0.06 }); tone(c, o, at, { from: 330, to: 160, dur: 0.3, gain: 0.08 }); },
    star: (c, o, at) => [523, 659, 784, 1047].forEach((f, i) => tone(c, o, at + i * 0.09, { from: f, dur: 0.18, type: 'triangle', gain: 0.16 })),
    reveal: (c, o, at) => [784, 988, 1175, 1568].forEach((f, i) => tone(c, o, at + i * 0.12, { from: f, dur: 0.3, type: 'triangle', gain: 0.12 })),
    drop: (c, o, at) => { DRUMS.kick(c, o, at); hiss(c, o, at, { dur: 0.6, gain: 0.12, freq: 900, type: 'lowpass' }); },
    turn: (c, o, at) => { tone(c, o, at, { from: 660, dur: 0.08, gain: 0.08 }); tone(c, o, at + 0.09, { from: 880, dur: 0.1, gain: 0.08 }); },
    count: (c, o, at) => tone(c, o, at, { from: 660, dur: 0.12, type: 'triangle', gain: 0.14 }),
    go: (c, o, at) => tone(c, o, at, { from: 1320, dur: 0.3, type: 'triangle', gain: 0.16 }),
    fail: (c, o, at) => tone(c, o, at, { from: 300, to: 110, dur: 0.35, type: 'sawtooth', gain: 0.1 }),
    win: (c, o, at) => [523, 659, 784, 659, 1047].forEach((f, i) => tone(c, o, at + i * 0.12, { from: f, dur: 0.2, type: 'triangle', gain: 0.15 })),
    banner: (c, o, at) => { hiss(c, o, at, { dur: 0.35, gain: 0.08, freq: 3000, type: 'bandpass', q: 0.5 }); tone(c, o, at, { from: 300, to: 900, dur: 0.3, type: 'triangle', gain: 0.06 }); },
    ...DRUMS,
};

/** Joue un bruitage tout de suite, ou à `delay` secondes. */
export function sfx(name, delay = 0) {
    if (isSfxMuted()) return;
    const c = audioContext();
    if (!c || !SOUNDS[name]) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    SOUNDS[name](c, sfxBus, c.currentTime + Math.max(0, delay));
}

// Petite mélodie de début de tour, différente pour chaque personnage
const JINGLES = {
    nova: { notes: [72, 76, 79, 84], wave: 'square' },
    grizz: { notes: [48, 55, 52, 60], wave: 'sawtooth' },
    kick: { notes: [74, 77, 81, 86], wave: 'square' },
    lila: { notes: [69, 72, 76, 74], wave: 'triangle' },
    robox: { notes: [60, 72, 60, 84], wave: 'square' },
    mamie: { notes: [67, 64, 67, 72], wave: 'triangle' },
    flex: { notes: [65, 69, 72, 77], wave: 'sawtooth' },
    mimi: { notes: [79, 83, 86, 91], wave: 'triangle' },
};

export function jingle(characterId) {
    if (isSfxMuted()) return;
    const c = audioContext();
    if (!c) return;
    const j = JINGLES[characterId] || JINGLES.nova;
    const at = c.currentTime + 0.02;
    j.notes.forEach((n, i) => tone(c, sfxBus, at + i * 0.11, { from: note(n), dur: i === 3 ? 0.32 : 0.12, type: j.wave, gain: j.wave === 'sawtooth' ? 0.07 : 0.1 }));
    DRUMS.kick(c, sfxBus, at);
    DRUMS.snare(c, sfxBus, at + 0.33);
}

// ---------------------------------------------------------------------------
// Musique du plateau : boucle de beatbox (kick, caisse claire, charley) et basse
// ---------------------------------------------------------------------------

const MUSIC_KEY = 'party_music_off';
const STEPS = 16;
const BASS_ROOTS = [45, 41, 48, 43]; // la, fa, do, sol
const music = { timer: null, step: 0, nextAt: 0, bpm: 96, bar: 0, startedAt: 0, finale: false };

export function isMusicOn() {
    try { return localStorage.getItem(MUSIC_KEY) !== '1'; } catch (error) { return true; }
}

export function setMusicOn(on) {
    try { localStorage.setItem(MUSIC_KEY, on ? '0' : '1'); } catch (error) { /* navigation privée */ }
    if (on) startMusic(); else stopMusic();
}

function scheduleStep(c, step, at) {
    const out = musicBus;
    const finale = music.finale;
    if ([0, 6, 10].includes(step) || (finale && step === 14)) DRUMS.kick(c, out, at);
    if (step === 4 || step === 12) DRUMS.snare(c, out, at);
    if (step % 2 === 0 || (finale && step % 2 === 1)) hiss(c, out, at, { dur: 0.04, gain: step % 4 === 2 ? 0.16 : 0.09, freq: 8000 });
    if (music.bar % 4 === 3 && step >= 12) DRUMS.snare(c, out, at); // roulement en fin de cycle
    if ([0, 3, 6, 10].includes(step)) {
        const root = BASS_ROOTS[music.bar % 4] + (step === 10 ? 7 : 0);
        tone(c, out, at, { from: note(root), dur: 0.22, type: 'triangle', gain: 0.35 });
    }
}

function tickMusic() {
    const c = audioContext();
    if (!c || c.state !== 'running') return;
    const stepDur = 60 / music.bpm / 4;
    if (music.nextAt < c.currentTime) music.nextAt = c.currentTime + 0.05;
    while (music.nextAt < c.currentTime + 0.25) {
        scheduleStep(c, music.step, music.nextAt);
        music.step = (music.step + 1) % STEPS;
        if (music.step === 0) music.bar += 1;
        music.nextAt += stepDur;
    }
}

export function startMusic() {
    if (music.timer || !isMusicOn() || isSfxMuted()) return;
    const c = audioContext();
    if (!c) return;
    music.startedAt = performance.now();
    music.nextAt = 0;
    music.timer = setInterval(tickMusic, 90);
}

export function stopMusic() {
    if (music.timer) clearInterval(music.timer);
    music.timer = null;
}

export function setMusicFinale(on) {
    music.finale = on;
    music.bpm = on ? 112 : 96;
}

/** Position dans la mesure (0 à 1 par temps), pour faire bouger la foule et les lumières en rythme. */
export function beatPhase(nowMs) {
    const beatMs = 60000 / music.bpm;
    return ((nowMs % beatMs) / beatMs);
}
export function beatIndex(nowMs) {
    return Math.floor(nowMs / (60000 / music.bpm));
}
