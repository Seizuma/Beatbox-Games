// Le site est passé d'adresses en « #/page » à de vraies adresses « /page »,
// que les moteurs de recherche indexent. Les anciens liens (favoris, liens de
// salle déjà partagés, retour de connexion Discord) restent valables : on les
// réécrit sur place, sans recharger, avant que le routeur ne lise l'adresse.
//
//   /#/beatboxdle             → /beatboxdle
//   /#/blindtest-online?room=K7Q2M → /blindtest-online?room=K7Q2M
//   /?lang=en#/stats          → /stats?lang=en
export function migrateLegacyHashUrl() {
    try {
        const { hash, search } = window.location;
        if (!hash.startsWith('#/')) return;

        const target = new URL(hash.slice(1), window.location.origin);
        // Les paramètres placés avant le # (rares) s'ajoutent à ceux du hash
        new URLSearchParams(search).forEach((value, key) => {
            if (!target.searchParams.has(key)) target.searchParams.set(key, value);
        });
        window.history.replaceState(window.history.state, '', `${target.pathname}${target.search}`);
    } catch (error) {
        // Adresse illisible : on laisse le routeur afficher ce qu'il peut
    }
}
