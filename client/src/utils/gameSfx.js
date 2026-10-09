// client/src/utils/gameSfx.js
//
// Bruitages courts des jeux (buzz, bonne et mauvaise réponse, révélation) et
// vibrations sur téléphone. Les sons sont synthétisés avec la Web Audio API :
// aucun fichier à charger ni à héberger, et ils partent sans latence.
//
// iOS et Safari n'autorisent le son qu'après un geste de l'utilisateur : le
// contexte audio se débloque au premier toucher sur la page, puis reste actif.
// Les sons déclenchés par les autres joueurs (un buzz adverse) passent donc dès
// que le joueur a touché l'écran une fois, ce qui est toujours le cas en partie.

const MUTED_KEY = 'beatbox_sfx_muted';

let context = null;
let unlockInstalled = false;

const readMuted = () => {
    try {
        return localStorage.getItem(MUTED_KEY) === '1';
    } catch (error) {
        return false;
    }
};

let muted = readMuted();
const listeners = new Set();

function getContext() {
    if (context) return context;
    const AudioContextClass = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioContextClass) return null;
    try {
        context = new AudioContextClass();
    } catch (error) {
        context = null;
    }
    return context;
}

/** Débloque le son au premier geste. Sans effet si déjà fait. */
export function installSfxUnlock() {
    if (unlockInstalled || typeof document === 'undefined') return;
    unlockInstalled = true;
    const unlock = () => {
        const ctx = getContext();
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { });
    };
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
}

/** Bruitages coupés par le joueur (réglage gardé d'une partie à l'autre). */
export function isSfxMuted() {
    return muted;
}

export function setSfxMuted(value) {
    muted = Boolean(value);
    try {
        localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
    } catch (error) {
        // Le réglage vaut pour cette visite
    }
    listeners.forEach((listener) => listener(muted));
}

export function onSfxMutedChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

// Une note : fréquence de départ, d'arrivée, durée, forme d'onde, décalage
const SOUNDS = {
    buzz: [{ from: 190, to: 150, duration: 0.28, type: 'square', gain: 0.22 }],
    correct: [
        { from: 660, to: 660, duration: 0.12, type: 'triangle', gain: 0.32 },
        { from: 990, to: 990, duration: 0.22, type: 'triangle', gain: 0.32, delay: 0.11 },
    ],
    wrong: [{ from: 240, to: 120, duration: 0.32, type: 'sawtooth', gain: 0.16 }],
    reveal: [
        { from: 523, to: 523, duration: 0.16, type: 'sine', gain: 0.28 },
        { from: 784, to: 784, duration: 0.3, type: 'sine', gain: 0.24, delay: 0.12 },
    ],
};

/**
 * Joue un bruitage. `volume` (0 à 1) suit le réglage du jeu quand il en a un.
 * Silencieux si le son est coupé, bloqué par le navigateur ou indisponible.
 */
export function playSfx(name, { volume = 0.7 } = {}) {
    if (muted || volume <= 0) return;
    const notes = SOUNDS[name];
    const ctx = getContext();
    if (!notes || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });

    const now = ctx.currentTime;
    notes.forEach((note) => {
        const start = now + (note.delay || 0);
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = note.type;
        oscillator.frequency.setValueAtTime(note.from, start);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(note.to, 1), start + note.duration);

        const peak = note.gain * Math.min(1, volume);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);

        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + note.duration + 0.02);
    });
}

const PATTERNS = {
    buzz: 35,
    correct: [40, 60, 40],
    wrong: 140,
};

/** Vibration courte sur téléphone, pour les actions du joueur lui-même. */
export function vibrate(name) {
    if (muted || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try {
        navigator.vibrate(PATTERNS[name] || 30);
    } catch (error) {
        // Navigateur qui refuse : rien à faire
    }
}
