import { useEffect } from 'react';
import { useDiscordAuth } from './discordAuth';

// Récupère le token renvoyé par le serveur après la connexion Discord (#/page?token=...&success=true)
export function useDiscordCallback() {
    const { handleAuthCallback } = useDiscordAuth();

    useEffect(() => {
        const [route, query] = window.location.hash.split('?');
        if (!query) return;

        const params = new URLSearchParams(query);
        const token = params.get('token');

        if (token && params.get('success')) {
            handleAuthCallback(token);
            window.history.replaceState({}, document.title, `${window.location.pathname}${route}`);
        } else if (params.get('error')) {
            console.error('Erreur d’authentification Discord:', params.get('error'));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}