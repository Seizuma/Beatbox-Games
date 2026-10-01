// server/scripts/sources/beatboxworld.js
//
// beatbox.world vu comme source de photos : retrouver la fiche d'un
// beatboxer à partir d'un simple nom, puis en tirer photo, vidéos et chaîne.
// Le parsing HTML reste dans beatboxdle/parse.js, seul endroit à reprendre
// le jour où le site change de gabarit.

const { parseProfile, parseSearchResults } = require('../beatboxdle/parse');
const { normalizeName, looseName, guessSlug } = require('../shared/names');

const BASE_URL = 'https://beatbox.world';

/**
 * Retrouve la fiche d'un beatboxer.
 *
 * Les homonymes sont légion (« Max » existe en Russie, à Taïwan, au Viêt Nam,
 * en Israël…) : le pays connu, quand il y en a un, départage. Sans pays et
 * avec plusieurs homonymes, on ne choisit pas — mieux vaut aucune photo
 * qu'une photo de quelqu'un d'autre.
 *
 * @param {object} client     client HTTP partagé
 * @param {string} name
 * @param {string|null} countryCode code ISO connu, ou null
 * @returns {Promise<{ slug, match: 'exact'|'loose', countryMatch: boolean|null } | null>}
 */
async function findBeatboxer(client, name, countryCode = null) {
    const html = await client.fetchText(`${BASE_URL}/search?${new URLSearchParams({ q: name })}`);
    const results = html ? parseSearchResults(html) : [];

    const pick = (candidates, match) => {
        if (candidates.length === 0) return null;
        if (countryCode) {
            const sameCountry = candidates.filter((candidate) => candidate.code === countryCode);
            if (sameCountry.length === 1) return { slug: sameCountry[0].slug, match, countryMatch: true };
            if (sameCountry.length > 1) return null;
            // Personne du bon pays : un candidat unique reste proposé, signalé.
            if (candidates.length === 1) return { slug: candidates[0].slug, match, countryMatch: false };
            return null;
        }
        return candidates.length === 1 ? { slug: candidates[0].slug, match, countryMatch: null } : null;
    };

    const exact = pick(results.filter((result) => normalizeName(result.name) === normalizeName(name)), 'exact');
    if (exact) return exact;
    const loose = pick(results.filter((result) => looseName(result.name) === looseName(name)), 'loose');
    if (loose) return loose;

    // Dernier recours : l'URL devinée. Le site redirige les anciens slugs
    // (max0 -> maxo), et une 404 est mise en cache.
    if (results.length === 0) {
        const slug = guessSlug(name);
        if (slug && (await client.fetchText(`${BASE_URL}/beatboxers/${slug}`))) {
            return { slug, match: 'guess', countryMatch: null };
        }
    }
    return null;
}

/** Fiche complète : palmarès, photo, vidéos, chaîne YouTube. */
async function fetchProfile(client, slug) {
    const url = `${BASE_URL}/beatboxers/${slug}`;
    const html = await client.fetchText(url);
    if (!html) return null;
    return { ...parseProfile(html, slug), url };
}

module.exports = { BASE_URL, findBeatboxer, fetchProfile };
