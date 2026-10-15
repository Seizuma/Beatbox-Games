import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useOptionalSiteLanguage } from '../utils/siteI18n';
import { languageFromUrl, readLanguage } from '../utils/language';

// Balises de la page courante : titre, description, adresse canonique, versions
// fr / en, aperçus de partage (Open Graph, X) et données structurées.
//
// Les pages existent en deux langues à la même adresse : ?lang=fr et ?lang=en
// les rendent adressables, et l'adresse sans paramètre (x-default) suit la
// langue du visiteur. Chacune de ces adresses est sa propre version canonique.

export const SITE_URL = 'https://beatboxgames.com';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-beatbox-image.jpg`;
export const GAME_OG_IMAGES = {
    blindtest: `${SITE_URL}/og/blindtest.jpg`,
    buzzer: `${SITE_URL}/og/buzzer.jpg`,
    beatboxdle: `${SITE_URL}/og/beatboxdle.jpg`,
};

// Couleur de la barre du navigateur sur mobile : encre de la marque, commune au site et aux jeux
const THEME_COLOR = '#0F1B3D';
const LOCALES = { fr: 'fr_FR', en: 'en_US' };
const JSON_LD_ID = 'seo-jsonld';

// Seul le site de production est indexé : dev et preprod restent hors des moteurs
const isProductionHost = () => /^(www\.)?beatboxgames\.com$/.test(window.location.hostname);

const withLang = (url, language) => `${url}${url.includes('?') ? '&' : '?'}lang=${language}`;

function setMeta(attribute, key, content) {
    let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
    if (content == null || content === '') {
        if (element) element.remove();
        return;
    }
    if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
    }
    element.setAttribute('content', content);
}

function setLink(rel, href, hreflang) {
    const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`;
    let element = document.head.querySelector(selector);
    if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        if (hreflang) element.setAttribute('hreflang', hreflang);
        document.head.appendChild(element);
    }
    element.setAttribute('href', href);
}

function setJsonLd(data) {
    let element = document.getElementById(JSON_LD_ID);
    if (!data) {
        if (element) element.remove();
        return;
    }
    if (!element) {
        element = document.createElement('script');
        element.type = 'application/ld+json';
        element.id = JSON_LD_ID;
        document.head.appendChild(element);
    }
    element.textContent = JSON.stringify(data);
}

/**
 * @param {string}  title        Titre de l'onglet et des aperçus
 * @param {string}  description  Résumé affiché par les moteurs et les aperçus de liens
 * @param {string}  [path]       Chemin canonique (« /beatboxdle »), par défaut celui de la page
 * @param {string}  [image]      Image d'aperçu absolue (1200 × 630)
 * @param {string}  [imageAlt]   Texte alternatif de l'image d'aperçu
 * @param {boolean} [noindex]    Page à garder hors des moteurs (profil, salle, admin…)
 * @param {string}  [language]   Langue affichée, si la page n'est pas dans « la chaîne »
 * @param {object}  [jsonLd]     Données structurées schema.org propres à la page
 */
const SEO = ({
    title,
    description,
    path,
    image = DEFAULT_OG_IMAGE,
    imageAlt = 'BeatBox Games — jeux de beatbox en ligne',
    noindex = false,
    language,
    type = 'website',
    jsonLd = null,
}) => {
    const location = useLocation();
    const siteLanguage = useOptionalSiteLanguage();
    const lang = language || siteLanguage || readLanguage();
    const canonicalPath = path || location.pathname;
    const jsonLdText = jsonLd ? JSON.stringify(jsonLd) : '';

    useEffect(() => {
        const base = `${SITE_URL}${canonicalPath === '/' ? '/' : canonicalPath}`;
        // Une version de langue (?lang=) est sa propre adresse canonique ; l'adresse sans paramètre
        // (x-default, langue du visiteur) aussi, pour rester cohérente avec les liens hreflang
        const canonical = languageFromUrl() ? withLang(base, lang) : base;
        const indexable = !noindex && isProductionHost();

        if (title) document.title = title;
        setMeta('name', 'description', description);
        setMeta('name', 'robots', indexable
            ? 'index, follow, max-snippet:-1, max-image-preview:large'
            : 'noindex, follow');

        setLink('canonical', canonical);
        setLink('alternate', withLang(base, 'fr'), 'fr');
        setLink('alternate', withLang(base, 'en'), 'en');
        setLink('alternate', base, 'x-default');

        setMeta('property', 'og:title', title);
        setMeta('property', 'og:description', description);
        setMeta('property', 'og:url', canonical);
        setMeta('property', 'og:type', type);
        setMeta('property', 'og:image', image);
        setMeta('property', 'og:image:alt', imageAlt);
        setMeta('property', 'og:locale', LOCALES[lang] || LOCALES.fr);
        setMeta('property', 'og:locale:alternate', lang === 'fr' ? LOCALES.en : LOCALES.fr);

        setMeta('name', 'twitter:title', title);
        setMeta('name', 'twitter:description', description);
        setMeta('name', 'twitter:image', image);
        setMeta('name', 'twitter:image:alt', imageAlt);

        setMeta('name', 'theme-color', THEME_COLOR);
        setMeta('name', 'msapplication-TileColor', THEME_COLOR);

        setJsonLd(jsonLdText ? JSON.parse(jsonLdText) : null);
    }, [title, description, canonicalPath, image, imageAlt, noindex, lang, type, jsonLdText]);

    // Une page sans données structurées ne doit pas hériter de celles de la précédente
    useEffect(() => () => setJsonLd(null), []);

    return null;
};

export default SEO;
