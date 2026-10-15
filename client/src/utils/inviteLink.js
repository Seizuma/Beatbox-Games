// Lien d'invitation d'une salle : https://beatboxgames.com/invite/K7Q2M?lang=fr
//
// Il passe par le serveur, qui renvoie un aperçu personnalisé (hôte, nombre de
// joueurs, réglages) aux applications qui affichent les liens (Discord,
// WhatsApp, Messenger…), puis redirige aussitôt le joueur vers la salle.
// La langue est celle de l'hôte : c'est lui qui écrit à ses amis.
//
// En développement local, le serveur de React ne connaît pas /invite :
// on garde alors le lien direct vers la salle.
const GAME_PATHS = { blindtest: '/blindtest-online', buzzer: '/buzzer-battle' };

export function inviteLink(game, code, language) {
    if (!code) return '';
    const { origin, hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${origin}${GAME_PATHS[game] || '/'}?room=${encodeURIComponent(code)}`;
    }
    const lang = language === 'en' ? 'en' : 'fr';
    return `${origin}/invite/${encodeURIComponent(code)}?lang=${lang}`;
}
