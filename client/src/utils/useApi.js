import { useCallback, useEffect, useState } from 'react';

export const API_BASE_URL = process.env.REACT_APP_API_URL || '';

export const getStoredDiscordToken = () => {
    try {
        return localStorage.getItem('discord_token');
    } catch (error) {
        return null;
    }
};

// Chargement JSON avec états loading / ready / error. Passer path = null pour ne rien charger.
export function useApi(path, { auth = false } = {}) {
    const [state, setState] = useState({ status: path ? 'loading' : 'idle', data: null });
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!path) {
            setState({ status: 'idle', data: null });
            return undefined;
        }

        const controller = new AbortController();
        const headers = {};
        if (auth) {
            const token = getStoredDiscordToken();
            if (token) headers.Authorization = `Bearer ${token}`;
        }

        setState((previous) => ({ status: 'loading', data: previous.data }));

        fetch(`${API_BASE_URL}${path}`, { headers, signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((data) => setState({ status: 'ready', data }))
            .catch((error) => {
                if (error.name !== 'AbortError') setState({ status: 'error', data: null });
            });

        return () => controller.abort();
    }, [path, auth, reloadKey]);

    const reload = useCallback(() => setReloadKey((key) => key + 1), []);

    return { ...state, reload };
}