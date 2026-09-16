// Lecteur unique des extraits d'artistes du Blind Test.
//
// Pourquoi un seul élément <audio> réutilisé :
// les navigateurs mobiles (Safari iOS en particulier) n'autorisent la lecture qu'après un geste
// de l'utilisateur, et cette autorisation est liée à l'élément audio. Recréer un new Audio() à
// chaque extrait faisait perdre l'autorisation : le premier extrait passait, les suivants étaient
// bloqués. Ici, l'élément est débloqué au premier toucher et garde son autorisation pour toute la partie.

// WAV silencieux de quelques octets, utilisé pour débloquer l'élément
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
const GESTURE_EVENTS = ['pointerdown', 'touchend', 'keydown'];

let element = null;
let unlocked = false;
let currentUrl = null;
let pending = null;
let listening = false;

function getElement() {
    if (!element && typeof Audio !== 'undefined') {
        element = new Audio();
        element.preload = 'auto';
        element.setAttribute('playsinline', '');
    }
    return element;
}

function savedVolume(fallback = 0.7) {
    try {
        const value = parseFloat(localStorage.getItem('beatbox_audio_volume'));
        if (!Number.isNaN(value)) return Math.min(1, Math.max(0, value));
    } catch (error) {
        // localStorage indisponible
    }
    return fallback;
}

function unlockWithSilence() {
    const audio = getElement();
    if (!audio || unlocked || currentUrl) return;

    audio.muted = true;
    audio.src = SILENCE;
    const attempt = audio.play();
    if (attempt && typeof attempt.then === 'function') {
        attempt
            .then(() => {
                unlocked = true;
                if (!currentUrl) audio.pause();
            })
            .catch(() => {})
            .finally(() => {
                audio.muted = false;
            });
    }
}

function handleGesture() {
    if (pending) {
        const { url } = pending;
        const audio = getElement();
        if (audio && currentUrl === url) {
            audio.play()
                .then(() => {
                    unlocked = true;
                    pending = null;
                })
                .catch(() => {});
        } else {
            pending = null;
        }
        return;
    }
    unlockWithSilence();
}

// Écoute les gestes de l'utilisateur pour débloquer ou relancer la lecture
export function listenForAudioUnlock() {
    if (listening || typeof document === 'undefined') return;
    listening = true;
    GESTURE_EVENTS.forEach((type) => {
        document.addEventListener(type, handleGesture, { capture: true, passive: true });
    });
}

/**
 * Joue un extrait. Retourne l'élément audio (pour le contrôle du volume).
 * - onEnded : fin de l'extrait
 * - onBlocked : lecture refusée par le navigateur, elle reprendra au prochain toucher
 * - onError : fichier illisible ou introuvable
 */
export function playArtistClip(url, { volume, onEnded, onBlocked, onError } = {}) {
    const audio = getElement();
    if (!audio || !url) return null;

    listenForAudioUnlock();

    audio.onended = null;
    audio.onerror = null;
    audio.pause();

    currentUrl = url;
    pending = null;
    audio.muted = false;
    audio.volume = savedVolume(volume);
    audio.src = url;

    audio.onended = () => {
        if (currentUrl === url && onEnded) onEnded();
    };
    audio.onerror = () => {
        if (currentUrl === url && onError) onError(audio.error);
    };

    const attempt = audio.play();
    if (attempt && typeof attempt.then === 'function') {
        attempt
            .then(() => {
                unlocked = true;
            })
            .catch((error) => {
                if (currentUrl !== url) return;
                if (error && error.name === 'NotAllowedError') {
                    console.warn('🔇 Lecture bloquée par le navigateur, reprise au prochain toucher');
                    pending = { url };
                    if (onBlocked) onBlocked();
                } else if (error && error.name !== 'AbortError') {
                    console.error('❌ Erreur lecture extrait:', error);
                    if (onError) onError(error);
                }
            });
    }

    return audio;
}

// Arrête l'extrait en cours sans détruire l'élément (il reste débloqué)
export function stopArtistClip() {
    const audio = getElement();
    pending = null;
    currentUrl = null;
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
}

export function getArtistAudioElement() {
    return getElement();
}