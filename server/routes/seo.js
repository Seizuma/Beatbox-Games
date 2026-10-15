/**
 * Plan du site pour les moteurs de recherche : GET /sitemap.xml
 *
 * Généré à la demande pour inclure toutes les fiches beatboxer. Chaque page
 * existe en français (?lang=fr) et en anglais (?lang=en) ; l'adresse sans
 * paramètre suit la langue du visiteur (x-default). Le client nginx transmet
 * /sitemap.xml à ce serveur (client/nginx/default.conf.template).
 */

const express = require('express');
const directory = require('../services/beatboxerDirectory');

const router = express.Router();

const SITE_URL = 'https://beatboxgames.com';
const LANGUAGES = ['fr', 'en'];

// Pages publiques et indexables (profil, admin, salles et joueurs restent hors du plan)
const PAGES = [
    '/',
    '/beatboxdle',
    '/beatboxdle/letters',
    '/beatboxdle/clues',
    '/blindtest-online',
    '/buzzer-battle',
    '/stats',
    '/credits',
    '/contact',
    '/legal',
    '/privacy',
];

const CACHE_MS = 60 * 60 * 1000;
let cached = { xml: null, at: 0 };

const withLang = (url, lang) => `${url}?lang=${lang}`;

function urlEntries(path) {
    const base = `${SITE_URL}${path}`;
    const alternates = [
        ...LANGUAGES.map((lang) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${withLang(base, lang)}"/>`),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${base}"/>`,
    ].join('\n');
    return LANGUAGES.map((lang) => `  <url>\n    <loc>${withLang(base, lang)}</loc>\n${alternates}\n  </url>`);
}

function buildSitemap() {
    // Les slugs sont faits de [a-z0-9-] : rien à échapper, mais on filtre par prudence
    const beatboxers = directory.slugs()
        .filter((slug) => /^[a-z0-9-]+$/.test(slug))
        .map((slug) => `/beatboxer/${slug}`);
    const entries = [...PAGES, ...beatboxers].flatMap(urlEntries);
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;
}

router.get('/sitemap.xml', (req, res) => {
    try {
        if (!cached.xml || Date.now() - cached.at > CACHE_MS) {
            cached = { xml: buildSitemap(), at: Date.now() };
        }
        res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
        res.send(cached.xml);
    } catch (error) {
        console.error('❌ Erreur génération du sitemap:', error);
        res.status(500).type('text/plain').send('Sitemap indisponible');
    }
});

module.exports = router;
