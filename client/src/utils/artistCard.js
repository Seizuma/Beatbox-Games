// client/src/utils/artistCard.js
//
// Fiche courte d'un artiste (photo, pays, meilleur titre) pour la révélation de
// fin de manche. Mise en cache par nom : une même partie révèle souvent les
// mêmes artistes d'une salle à l'autre, et la fiche ne change pas en cours de jeu.

import { useEffect, useState } from 'react';
import { API_BASE_URL } from './useApi';

const cache = new Map();

const absolute = (url) => (url && !/^(https?:|data:|blob:)/.test(url) ? `${API_BASE_URL}${url}` : url);

export function loadArtistCard(name) {
    const key = (name || '').trim().toLowerCase();
    if (!key) return Promise.resolve(null);
    if (!cache.has(key)) {
        const request = fetch(`${API_BASE_URL}/api/blindtest/card?name=${encodeURIComponent(name.trim())}`)
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => (payload && payload.card ? { ...payload.card, photoUrl: absolute(payload.card.photoUrl) } : null))
            .catch(() => {
                cache.delete(key);
                return null;
            });
        cache.set(key, request);
    }
    return cache.get(key);
}

/** Fiche de l'artiste, ou null tant qu'elle charge (ou si elle n'existe pas). */
export function useArtistCard(name) {
    const [card, setCard] = useState(null);

    useEffect(() => {
        let active = true;
        setCard(null);
        if (!name) return undefined;
        loadArtistCard(name).then((result) => {
            if (active) setCard(result);
        });
        return () => {
            active = false;
        };
    }, [name]);

    return card;
}
