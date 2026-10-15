import { useEffect } from 'react';
import { useDiscordAuth } from './discordAuth';

// Récupère le token renvoyé par le serveur après la connexion Discord : /page#token=...&success=true.
// Le fragment (#) n'est jamais envoyé à un serveur, le token ne finit donc pas dans les journaux.
// Ancien format accepté le temps du déploiement : #/page?token=..., réécrit en /page?token=...
// au démarrage (legacyHashUrl).
export function useDiscordCallback() {
    const { handleAuthCallback } = useDiscordAuth();

    useEffect(() => {
        const fromHash = new URLSearchParams(window.location.hash.startsWith('#token=') ? window.location.hash.slice(1) : '');
        const fromSearch = new URLSearchParams(window.location.search);
        const params = fromHash.get('token') ? fromHash : fromSearch;
        const token = params.get('token');

        if (token && params.get('success')) {
            // Le token ne doit pas rester dans l'adresse (historique, partage d'écran), même si sa
            // vérification échoue : on nettoie avant de le transmettre
            fromSearch.delete('token');
            fromSearch.delete('success');
            const rest = fromSearch.toString();
            window.history.replaceState(window.history.state, document.title, `${window.location.pathname}${rest ? `?${rest}` : ''}`);
            handleAuthCallback(token);
        } else if (params.get('error')) {
            console.error('Erreur d’authentification Discord:', params.get('error'));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
