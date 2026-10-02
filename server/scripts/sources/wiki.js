// server/scripts/sources/wiki.js
//
// Beatbox Wiki (beatbox.fandom.com), lu par l'API MediaWiki plutôt que par le
// HTML : les réponses JSON ne bougent pas quand Fandom change de thème.
//
// Ce que le wiki apporte :
//   - la photo principale de la page (prop=pageimages), souvent une photo de
//     scène récente en haute définition ;
//   - un palmarès rédigé à la main, plus complet que beatbox.world sur les
//     championnats nationaux (MaxO : trois titres bulgares au wiki, un seul
//     sur beatbox.world).

const { looseName } = require('../shared/names');
const { codeFromEnglishName, codeFromPlaceWord } = require('../beatboxdle/countries');
const { detectDiscipline, detectGender } = require('../beatboxdle/parse');

const WIKI_BASE = 'https://beatbox.fandom.com';
const API = `${WIKI_BASE}/api.php`;
const BATCH = 50; // plafond MediaWiki pour titles=

const apiUrl = (params) => `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
const pageUrl = (title) => `${WIKI_BASE}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

/** Pays d'après les catégories (« Category:France »). */
function countryFromCategories(categories = []) {
    for (const category of categories) {
        const name = (category.title || category).replace(/^Category:/, '');
        const code = codeFromEnglishName(name) || codeFromPlaceWord(name);
        if (code) return code;
    }
    return null;
}

/**
 * Cherche les pages de plusieurs beatboxers d'un coup (50 par requête).
 * Suit les redirections et la normalisation de casse du wiki.
 *
 * @returns {Promise<Map<string, { title, url, image, isBeatboxer, isGroup, countryCode }>>}
 *          clé = nom demandé, absent si la page n'existe pas
 */
async function lookupPages(client, names) {
    const found = new Map();

    for (let start = 0; start < names.length; start += BATCH) {
        const batch = names.slice(start, start + BATCH);
        const data = await client.fetchJson(apiUrl({
            action: 'query',
            titles: batch.join('|'),
            prop: 'pageimages|categories',
            piprop: 'original',
            cllimit: 'max',
            redirects: '1',
        }));
        if (!data?.query) continue;

        // nom demandé -> titre final, en suivant normalisation puis redirection
        const hop = new Map();
        (data.query.normalized || []).forEach((item) => hop.set(item.from, item.to));
        (data.query.redirects || []).forEach((item) => hop.set(item.from, item.to));
        const resolve = (title) => {
            let current = title;
            for (let i = 0; i < 4 && hop.has(current); i += 1) current = hop.get(current);
            return current;
        };

        const pages = new Map((data.query.pages || []).filter((page) => !page.missing).map((page) => [page.title, page]));
        batch.forEach((name) => {
            const page = pages.get(resolve(name));
            if (!page) return;
            const categories = (page.categories || []).map((category) => category.title);
            found.set(name, {
                title: page.title,
                url: pageUrl(page.title),
                image: page.original ? { url: page.original.source, width: page.original.width, height: page.original.height } : null,
                isBeatboxer: categories.some((category) => /beatboxers|loopers/i.test(category)),
                // Duos, tag teams et crews : « Category:Groups » sur ce wiki.
                isGroup: categories.some((category) => /groups|crews|tag teams/i.test(category)),
                countryCode: countryFromCategories(categories),
            });
        });
    }

    return found;
}

/**
 * Recherche plein texte quand le titre exact n'existe pas (« Max0 » -> « MaxO »).
 * N'accepte qu'un résultat dont le nom correspond, à 0/O et 1/l près.
 */
async function searchPage(client, name) {
    const data = await client.fetchJson(apiUrl({ action: 'opensearch', search: name, limit: '10', namespace: '0' }));
    if (!Array.isArray(data) || !Array.isArray(data[1])) return null;
    const target = looseName(name);
    return data[1].find((title) => looseName(title) === target) || null;
}

// --- Palmarès ---------------------------------------------------------------

// « 1st Place », « Winner », « Top 8 »… -> identifiants de config.PLACEMENTS
const PLACEMENT_PATTERNS = [
    { id: 'champion', match: /^(1st|first)\b|^winner|^champion/i },
    { id: 'runner-up', match: /^(2nd|second)\b|^runner-?up|^finalist/i },
    { id: 'third', match: /^(3rd|third)\b/i },
    { id: 'semi', match: /^(4th|fourth)\b|^top 4\b|^semi-?final/i },
    { id: 'quarter', match: /^([5-8]th)\b|^top [5-8]\b|^quarter-?final/i },
    { id: 'entrant', match: /^top \d+|^\d+th\b|^participant|^competitor/i },
];

/** [[Cible|Libellé]] -> Cible ; [[Cible]] -> Cible. */
const linkTarget = (text) => text.replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, '$1');
/** [[Cible|Libellé]] -> Libellé, pour l'affichage. */
const linkLabel = (text) => text.replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1');

const stripMarkup = (text) =>
    text
        .replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/'''?/g, '')
        .replace(/\{\{-\}\}/g, ' — ')
        .replace(/\{\{[^}]*\}\}/g, '')
        .replace(/\s+/g, ' ')
        .trim();

/**
 * Une ligne de palmarès du wiki, ex. :
 *   *1st Place (Tag Team, with [[Alem]] as Uniteam) {{-}} [[Grand Beatbox Battle 2019]]
 *   * Top 8 (Solo) - [[Grand Beatbox Battle 2024]]
 */
function parseAchievementLine(line, headingYear) {
    const body = line.replace(/^\*+\s*/, '');
    // Séparateur placement / événement : {{-}}, tiret ou tiret long entouré d'espaces
    const parts = body.split(/\s*\{\{-\}\}\s*|\s+[-–—]\s+/);
    if (parts.length < 2) return null;

    const head = stripMarkup(linkLabel(parts[0]));
    const eventRaw = parts.slice(1).join(' - ');
    const eventName = stripMarkup(linkTarget(eventRaw)) || null;
    if (!eventName) return null;

    const placementText = head.replace(/\(.*$/, '').trim();
    const placement = PLACEMENT_PATTERNS.find((pattern) => pattern.match.test(placementText));
    if (!placement) return null; // « Wildcard winner », « Judge »… : pas un résultat

    const categoryText = (head.match(/\(([^)]*)\)/) || [])[1] || '';
    const yearMatch = eventName.match(/\b(19|20)\d{2}\b/);

    return {
        placementId: placement.id,
        categoryText,
        discipline: detectDiscipline(categoryText || eventName),
        gender: detectGender(categoryText),
        eventName,
        year: yearMatch ? Number(yearMatch[0]) : headingYear,
        raw: stripMarkup(linkLabel(body)),
    };
}

/**
 * Wikitext d'une page beatboxer -> { countryCode, achievements }.
 * Le palmarès est la section de niveau 2 dont le titre parle de résultats ;
 * les sous-titres de niveau 3 donnent l'année quand l'événement ne la porte pas.
 */
function parseWikitext(wikitext) {
    const countryMatch = wikitext.match(/\|\s*country\s*=\s*([a-z]{2})\b/i);
    const countryCode = countryMatch ? countryMatch[1].toUpperCase() : null;

    const achievements = [];
    let inSection = false;
    let headingYear = null;

    for (const rawLine of wikitext.split('\n')) {
        const line = rawLine.trim();
        const level2 = line.match(/^==\s*([^=].*?)\s*==$/);
        if (level2) {
            inSection = /achievement|title|result|competition|palmar/i.test(level2[1]);
            headingYear = null;
            continue;
        }
        if (!inSection) continue;

        const level3 = line.match(/^={3,}\s*(.*?)\s*={3,}$/);
        if (level3) {
            const year = (level3[1].match(/\b(19|20)\d{2}\b/) || [])[0];
            headingYear = year ? Number(year) : null;
            continue;
        }

        if (line.startsWith('*')) {
            const achievement = parseAchievementLine(line, headingYear);
            if (achievement) achievements.push(achievement);
        }
    }

    return { countryCode, achievements };
}

async function fetchProfile(client, title) {
    const data = await client.fetchJson(apiUrl({ action: 'parse', page: title, prop: 'wikitext', redirects: '1' }));
    const wikitext = data?.parse?.wikitext;
    if (typeof wikitext !== 'string') return null;
    return { title: data.parse.title, url: pageUrl(data.parse.title), ...parseWikitext(wikitext) };
}

module.exports = { WIKI_BASE, lookupPages, searchPage, fetchProfile, parseWikitext, parseAchievementLine };
