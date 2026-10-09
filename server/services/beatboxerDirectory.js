// server/services/beatboxerDirectory.js
//
// Annuaire des beatboxers, pour les fiches publiques du site.
//
// Trois sources se recoupent, chacune avec ses forces :
//   - la base Beatboxdle (beatbox.world) : pays, catégorie, meilleur titre,
//     années de compétition, nombre d'événements ;
//   - les données du Buzzer Battle : la photo et les événements cités ;
//   - les extraits du Blind Test : le beatboxer s'écoute sur le site.
// Le palmarès détaillé vient du cache de crawl (raw/profiles.json) quand il
// est présent sur la machine ; sinon la fiche s'en passe.
//
// L'index se reconstruit tout seul quand une source change (rechargement de
// la base, photo validée en administration) : il est recalculé au plus une
// fois par minute, à la demande.

const fs = require('fs');
const path = require('path');
const { normalize } = require('../utils');
const dataset = require('./beatboxdle-dataset');
const buzzerBeatboxers = require('./buzzer-beatboxerManager');
const audioManager = require('./audioManager');
const exclusions = require('./artist-exclusions');

let countries = null;
try {
    // Correspondance « France » → FR, déjà écrite pour la construction de la base
    countries = require('../scripts/beatboxdle/countries');
} catch (error) {
    countries = null;
}

const PROFILES_FILE = path.join(process.cwd(), 'beatbox_artists', 'beatboxdle', 'raw', 'profiles.json');
const REBUILD_MS = 60 * 1000;
const PALMARES_LIMIT = 15;

/** Adresse lisible d'une fiche : « Mr. Androide » → « mr-androide ». */
function slugify(name) {
    return String(name || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const photoUrl = (file) => (file ? `/api/beatboxer-images/${encodeURIComponent(file)}` : null);

let index = null;
let builtAt = 0;
let builtFrom = '';
let palmares = null;
let palmaresMtime = 0;

/** Signature des sources : quand elle change, l'index est périmé. */
function sourcesSignature() {
    const status = dataset.getStatus();
    return [
        status.loadedAt || 0,
        status.count || 0,
        (buzzerBeatboxers.beatboxersData || []).length,
        (audioManager.getArtistNames ? audioManager.getArtistNames().length : 0),
    ].join(':');
}

/** Palmarès par slug beatbox.world, lu dans le cache de crawl s'il existe. */
function loadPalmares() {
    try {
        if (!fs.existsSync(PROFILES_FILE)) return null;
        const mtime = fs.statSync(PROFILES_FILE).mtimeMs;
        if (palmares && mtime === palmaresMtime) return palmares;

        const raw = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
        palmares = new Map();
        (raw.profiles || []).forEach((profile) => {
            const entries = (profile.entries || [])
                .filter((entry) => entry.eventName)
                .map((entry) => ({
                    event: entry.eventName,
                    placement: entry.placementId || null,
                    tier: entry.tier || 0,
                    year: entry.year || null,
                    discipline: entry.discipline || null,
                }));
            palmares.set(profile.slug, entries);
        });
        palmaresMtime = mtime;
        return palmares;
    } catch (error) {
        console.error('❌ Palmarès des fiches beatboxers illisible:', error.message);
        return null;
    }
}

function build() {
    const byKey = new Map();
    const bySlug = new Map();

    const blank = (name) => ({
        key: normalize(name),
        name: name.trim(),
        slug: null,
        profile: null,
        buzzer: null,
        blindtest: false,
    });

    // Une fiche par profil de la base, sous son propre slug : deux beatboxers
    // dont les noms se ressemblent (« Akinde », « Akindé ») gardent chacun la leur.
    // La base est triée par notoriété : à nom égal, le plus connu reçoit le nom.
    (dataset.beatboxers || []).forEach((profile) => {
        if (!profile.slug || exclusions.isExcluded(profile.name)) return;
        const entry = { ...blank(profile.name), profile, slug: profile.slug };
        bySlug.set(entry.slug, entry);
        if (entry.key && !byKey.has(entry.key)) byKey.set(entry.key, entry);
    });

    // Photo du Buzzer et extraits du Blind Test : rattachés par le nom, sinon fiche à part
    const entryFor = (name) => {
        const key = normalize(name);
        if (!key || exclusions.isExcluded(name)) return null;
        if (!byKey.has(key)) byKey.set(key, blank(name));
        return byKey.get(key);
    };

    (buzzerBeatboxers.beatboxersData || []).forEach((beatboxer) => {
        const entry = entryFor(beatboxer.title || '');
        if (entry && !entry.buzzer) entry.buzzer = beatboxer;
    });

    (audioManager.getArtistNames ? audioManager.getArtistNames() : []).forEach((name) => {
        const entry = entryFor(name);
        if (entry) entry.blindtest = true;
    });

    byKey.forEach((entry) => {
        if (entry.slug) return;
        let slug = slugify(entry.name);
        if (!slug) return;
        // Deux graphies qui donnent la même adresse : la seconde prend un suffixe
        if (bySlug.has(slug)) slug = `${slug}-${bySlug.size}`;
        entry.slug = slug;
        bySlug.set(slug, entry);
    });

    index = { byKey, bySlug };
    builtAt = Date.now();
    builtFrom = sourcesSignature();
}

function ensureIndex() {
    if (!index) {
        build();
    } else if (Date.now() - builtAt > REBUILD_MS) {
        // Vérification au plus une fois par minute ; reconstruction seulement si une source a bougé
        if (sourcesSignature() !== builtFrom) build();
        else builtAt = Date.now();
    }
    return index;
}

/** Fiche par adresse : le slug, à défaut le nom tapé dans l'adresse. */
function find(keyOrSlug) {
    const { byKey, bySlug } = ensureIndex();
    const raw = String(keyOrSlug || '').trim();
    return bySlug.get(raw) || bySlug.get(slugify(raw)) || byKey.get(normalize(raw)) || null;
}

/** Slug de la fiche d'un nom, pour relier les jeux aux fiches. Null si inconnu. */
function slugFor(name) {
    const entry = find(name);
    return entry ? entry.slug : null;
}

function countryOf(entry) {
    if (entry.profile && entry.profile.countryCode) return entry.profile.countryCode;
    const nationality = entry.buzzer && entry.buzzer.nationality;
    if (nationality && countries && countries.codeFromEnglishName) {
        return countries.codeFromEnglishName(nationality) || null;
    }
    return null;
}

function photoOf(entry) {
    return (entry.profile && entry.profile.photo) || (entry.buzzer && entry.buzzer.local_image) || null;
}

/** Résumé pour une liste ou une recherche. */
function summary(entry) {
    return {
        slug: entry.slug,
        name: entry.name,
        photoUrl: photoUrl(photoOf(entry)),
        countryCode: countryOf(entry),
        category: entry.profile ? entry.profile.category || null : null,
    };
}

/** Fiche complète. */
function detail(entry) {
    const profile = entry.profile;
    const games = {
        blindtest: entry.blindtest,
        buzzer: Boolean(entry.buzzer && entry.buzzer.local_image),
        beatboxdle: profile ? profile.modes || [] : [],
    };

    let results = [];
    const allPalmares = profile ? loadPalmares() : null;
    if (allPalmares && allPalmares.has(profile.slug)) {
        results = allPalmares.get(profile.slug)
            .slice()
            .sort((a, b) => (b.tier - a.tier) || ((b.year || 0) - (a.year || 0)))
            .slice(0, PALMARES_LIMIT);
    }

    // Faute de palmarès détaillé, les événements cités par les données du Buzzer
    const events = !results.length && entry.buzzer
        ? [...new Set((entry.buzzer.achievements || []).map((achievement) => achievement.event).filter(Boolean))].slice(0, PALMARES_LIMIT)
        : [];

    return {
        ...summary(entry),
        bestTitle: profile ? profile.bestTitle || null : null,
        gender: profile ? profile.gender || null : null,
        firstYear: profile ? profile.firstYear || null : null,
        lastYear: profile ? profile.lastYear || null : null,
        eventCount: profile ? profile.events || null : null,
        titleCount: profile ? profile.titles || null : null,
        source: profile && profile.source ? profile.source : null,
        games,
        results,
        events,
    };
}

/** Recherche par début de mot, puis par contenu. Les fiches avec photo d'abord. */
function search(query, limit = 8) {
    const needle = normalize(query);
    if (needle.length < 2) return [];
    const { bySlug } = ensureIndex();
    const starts = [];
    const contains = [];

    bySlug.forEach((entry) => {
        if (!entry.slug) return;
        if (entry.key.startsWith(needle) || entry.key.split(' ').some((word) => word.startsWith(needle))) starts.push(entry);
        else if (entry.key.includes(needle)) contains.push(entry);
    });

    const rank = (a, b) => (Number(Boolean(photoOf(b))) - Number(Boolean(photoOf(a))))
        || ((b.profile ? b.profile.fame || 0 : 0) - (a.profile ? a.profile.fame || 0 : 0))
        || a.name.localeCompare(b.name, 'fr');

    return [...starts.sort(rank), ...contains.sort(rank)].slice(0, limit).map(summary);
}

module.exports = { slugify, find, slugFor, summary, detail, search };
