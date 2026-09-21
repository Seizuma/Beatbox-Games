// client/src/utils/beatboxdleApi.js
//
// Accès REST au Beatboxdle. Volontairement sans état : le serveur ne garde
// rien d'une partie en cours, c'est le client qui conserve son historique
// (beatboxdleStorage) et renvoie le numéro d'essai à chaque proposition.

import { API_BASE_URL, getStoredDiscordToken } from './useApi';

const authHeaders = () => {
    const token = getStoredDiscordToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Erreur porteuse du code HTTP et du drapeau `unknown`, pour que l'appelant
 * distingue « nom hors liste » (on ne consomme pas d'essai) d'une vraie panne.
 */
class BeatboxdleError extends Error {
    constructor(message, { status = 0, unknown = false } = {}) {
        super(message);
        this.name = 'BeatboxdleError';
        this.status = status;
        this.unknown = unknown;
    }
}

async function parse(response) {
    let payload = null;
    try {
        payload = await response.json();
    } catch (error) {
        // Réponse illisible : on retombe sur le code HTTP
    }

    if (!response.ok || (payload && payload.success === false)) {
        throw new BeatboxdleError((payload && payload.error) || `HTTP ${response.status}`, {
            status: response.status,
            unknown: Boolean(payload && payload.unknown),
        });
    }

    return payload;
}

/** Énigme du jour, sans la réponse, plus la liste des propositions acceptées. */
export async function fetchDaily(mode, signal) {
    const response = await fetch(`${API_BASE_URL}/api/beatboxdle/daily/${mode}`, { signal });
    return parse(response);
}

/** Envoie une proposition. `attempt` est le numéro de l'essai courant (1…max). */
export async function submitGuess({ mode, guess, attempt }, signal) {
    const response = await fetch(`${API_BASE_URL}/api/beatboxdle/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, guess, attempt }),
        signal,
    });
    return parse(response);
}

/**
 * Enregistre la journée pour un joueur connecté. Silencieux en cas d'échec :
 * une série perdue ne doit jamais casser l'écran de fin.
 */
export async function reportResult({ mode, solved, attempts }) {
    const token = getStoredDiscordToken();
    if (!token) return null;

    try {
        const response = await fetch(`${API_BASE_URL}/api/beatboxdle/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ mode, solved, attempts }),
        });
        return await parse(response);
    } catch (error) {
        return null;
    }
}

export { BeatboxdleError };