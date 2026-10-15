// Langue du site, commune à « la chaîne » et aux jeux.
//
// Ordre de priorité : ?lang= dans l'adresse (liens indexés et liens d'invitation),
// puis le choix enregistré, puis la langue du navigateur.

export const SUPPORTED_LANGUAGES = ['fr', 'en'];
export const LANGUAGE_STORAGE_KEY = 'beatbox_language';

/** Langue imposée par l'adresse (?lang=fr|en), sinon null. */
export function languageFromUrl() {
    try {
        const value = new URLSearchParams(window.location.search).get('lang');
        return SUPPORTED_LANGUAGES.includes(value) ? value : null;
    } catch (error) {
        return null;
    }
}

export function readLanguage() {
    const fromUrl = languageFromUrl();
    if (fromUrl) {
        // Retenue pour la suite de la visite : les pages suivantes n'ont plus ?lang= dans l'adresse
        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, fromUrl);
        } catch (error) {
            // localStorage indisponible : la langue vaut pour cette page
        }
        return fromUrl;
    }
    try {
        const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (SUPPORTED_LANGUAGES.includes(saved)) return saved;
    } catch (error) {
        // localStorage indisponible (navigation privée stricte) : on se rabat sur le navigateur
    }
    const browser = (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage)) || 'fr';
    return browser.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
