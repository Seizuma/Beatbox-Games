import { useEffect, useState } from 'react';
import { useDiscordAuth } from './discordAuth';
import { API_BASE_URL } from './useApi';

/**
 * Indique si le compte connecté fait partie des administrateurs.
 * Sert uniquement à afficher ou masquer le lien : chaque route d'administration
 * revérifie le droit côté serveur.
 *
 * Le jeton vient du client Discord plutôt que de localStorage : la vérification
 * est donc refaite au retour de connexion et à la déconnexion, sans recharger
 * la page.
 */
export function useIsAdmin() {
    const { token } = useDiscordAuth();
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
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
    }, [token]);

    return isAdmin;
}

export default useIsAdmin;
