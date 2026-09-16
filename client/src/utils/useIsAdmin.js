import { useEffect, useState } from 'react';
import { API_BASE_URL, getStoredDiscordToken } from './useApi';

/**
 * Indique si le compte connecté fait partie des administrateurs.
 * Sert uniquement à afficher ou masquer le lien : chaque route d'administration
 * revérifie le droit côté serveur.
 */
export function useIsAdmin() {
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const token = getStoredDiscordToken();
        if (!token) {
            setIsAdmin(false);
            return undefined;
        }

        const controller = new AbortController();

        fetch(`${API_BASE_URL}/api/admin/session`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => setIsAdmin(Boolean(data?.isAdmin)))
            .catch(() => setIsAdmin(false));

        return () => controller.abort();
    }, []);

    return isAdmin;
}

export default useIsAdmin;
