import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../utils/useApi';

// Liste chargée une seule fois par session, partagée entre les écrans
let cachedArtists = null;
let pendingRequest = null;

function loadArtists() {
    if (!pendingRequest) {
        pendingRequest = fetch(`${API_BASE_URL}/api/blindtest/artists`)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((data) => {
                cachedArtists = Array.isArray(data.artists) ? data.artists : [];
                return cachedArtists;
            })
            .catch((error) => {
                pendingRequest = null;
                throw error;
            });
    }
    return pendingRequest;
}

/**
 * Artistes du Blind Test.
 * status : loading | ready | error (en cas d'erreur, la réponse libre reste possible)
 */
export function useBlindTestArtists() {
    const [artists, setArtists] = useState(() => cachedArtists || []);
    const [status, setStatus] = useState(() => (cachedArtists ? 'ready' : 'loading'));

    useEffect(() => {
        if (cachedArtists) return undefined;
        let active = true;

        loadArtists()
            .then((list) => {
                if (!active) return;
                setArtists(list);
                setStatus('ready');
            })
            .catch((error) => {
                console.warn('⚠️ Liste des artistes indisponible:', error);
                if (active) setStatus('error');
            });

        return () => {
            active = false;
        };
    }, []);

    return { artists, status };
}