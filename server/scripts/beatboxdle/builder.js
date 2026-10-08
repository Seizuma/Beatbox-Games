// server/scripts/beatboxdle/builder.js
//
// Construction de la base Beatboxdle, sous forme de fonctions : build.js
// l'appelle en ligne de commande, l'administration l'appelle après une
// revue de titres (routes/admin-review.js).
//
// Transforme les profils bruts en la base que le jeu consomme : un pays, un
// genre, une catégorie principale, un meilleur titre, et de quoi jouer le mode
// lettres. Applique les corrections manuelles d'overrides.json et les titres
// validés en administration, classe par notoriété, garde les N premiers.

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { frenchName, continentOf, codeFromEnglishName } = require('./countries');
const { legacyMajorTitle, baseTier } = require('./titles');

/** Nom réduit aux lettres A–Z, accents retirés : c'est ce que le joueur tape. */
const toLetters = (name) =>
    (name || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '');

const normalizeName = (name) => toLetters(name).toLowerCase();

const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback);

/** Catégorie principale : celle où il a le plus concouru, départage par priorité. */
function mainCategory(entries) {
    const counts = new Map();
    entries.forEach((entry) => {
        if (!entry.discipline) return;
        counts.set(entry.discipline, (counts.get(entry.discipline) || 0) + 1);
    });
    if (counts.size === 0) return null;

    const max = Math.max(...counts.values());
    const tied = [...counts.entries()].filter(([, count]) => count === max).map(([id]) => id);
    return config.CATEGORY_PRIORITY.find((id) => tied.includes(id)) || tied[0];
}

/** Rang (1-6) du meilleur placement sur un major : ne sert qu'à la notoriété. */
function majorPlacementTier(entries) {
    const tiers = entries.filter((entry) => entry.series).map((entry) => entry.tier);
    return tiers.length ? Math.max(...tiers) : 0;
}

/** Première ou dernière année de compétition, null si aucune entrée datée. */
function yearBound(entries, pick) {
    const years = entries.map((entry) => entry.year).filter(Boolean);
    return years.length ? pick(...years) : null;
}

/** Genre déduit des catégories genrées ; conflit ou absence -> null. */
function inferGender(entries) {
    const votes = entries.map((entry) => entry.gender).filter(Boolean);
    if (votes.length === 0) return null;
    const male = votes.filter((vote) => vote === 'M').length;
    const female = votes.filter((vote) => vote === 'F').length;
    if (male > 0 && female > 0) return null; // ambigu : à trancher dans overrides.json
    return male > female ? 'M' : 'F';
}

/**
 * Score de notoriété : sert uniquement à ordonner le roster pour garder les
 * plus connus. Volontairement grossier — un titre mondial pèse plus qu'une
 * longue carrière sans résultat.
 *
 * Il ne dépend QUE des majors, jamais du titre affiché : l'ordre de la base
 * détermine le tirage du jour, et valider un titre en administration ne doit
 * pas changer la réponse que les joueurs cherchent déjà.
 */
function fameScore(profile) {
    const majorEntries = profile.entries.filter((entry) => entry.series).length;
    return (
        majorPlacementTier(profile.entries) * 12 +
        majorEntries * 6 +
        (profile.titleCount || 0) * 3 +
        (profile.eventCount || 0) +
        (profile.elo ? Math.max(0, (profile.elo - 1400) / 20) : 0)
    );
}

/** Photos déjà rapatriées pour le Buzzer Battle : réutilisées pour la révélation. */
function loadBuzzerPhotos() {
    const list = readJson(config.BUZZER_DATA_FILE, []);
    const photos = new Map();
    list.forEach((item) => {
        if (item.local_image && item.title) photos.set(normalizeName(item.title), item.local_image);
    });
    return photos;
}

/** Titre forcé dans overrides.json (ancien format : un simple identifiant de major). */
function overrideTitle(base, bestTitleId) {
    const [level, ...rest] = bestTitleId.split('-');
    const placementId = rest.join('-');
    return {
        ...base,
        id: bestTitleId,
        key: bestTitleId,
        level,
        placementId,
        series: level,
        tier: baseTier(level, placementId),
        label: config.TITLE_LABELS[bestTitleId] || bestTitleId,
    };
}

/** Titre retenu en administration, débarrassé de ce qui ne sert qu'à la revue. */
function reviewedTitle(decision) {
    if (!decision || !decision.title) return null;
    const { sources, score, years, ...title } = decision.title;
    return { ...title, years: years || [] };
}

/**
 * Lignes qui ne sont pas jouables dans les deux modes, avec la raison.
 * C'est la feuille de route du travail manuel.
 */
function incompleteRows(incomplete) {
    return [
        'slug;nom;longueur;pays;genre;categorie;meilleur_titre;manque;source',
        ...incomplete.map((beatboxer) => {
            const missing = [];
            if (!beatboxer.gender) missing.push('genre');
            if (!beatboxer.country) missing.push('pays');
            if (!beatboxer.firstYear) missing.push('annee');
            if (!beatboxer.bestTitle) missing.push('titre');
            if (!beatboxer.modes.includes('letters')) missing.push(`longueur:${beatboxer.length}`);

            return [
                beatboxer.slug,
                beatboxer.name,
                beatboxer.length,
                beatboxer.country || '',
                beatboxer.gender || '',
                beatboxer.category || '',
                beatboxer.bestTitle ? beatboxer.bestTitle.key || beatboxer.bestTitle.id : '',
                missing.join('+'),
                beatboxer.source,
            ].join(';');
        }),
    ];
}

/**
 * Construit la base en mémoire.
 * @param {{ targetSize?: number, keepAll?: boolean }} options
 * @returns {{ dataset: object, built: object[], incomplete: object[], reviewedCount: number }}
 */
function buildDataset({ targetSize = config.TARGET_SIZE, keepAll = false } = {}) {
    if (!fs.existsSync(config.PROFILES_FILE)) {
        const error = new Error(`${config.PROFILES_FILE} introuvable. Lance d'abord npm run beatboxdle:profiles`);
        error.code = 'profiles_missing';
        throw error;
    }

    const { profiles } = readJson(config.PROFILES_FILE, { profiles: [] });
    const overrides = readJson(config.OVERRIDES_FILE, { exclude: [], patch: {} });
    const reviewed = readJson(config.REVIEWED_TITLES_FILE, {});
    const excluded = new Set(overrides.exclude || []);
    const photos = loadBuzzerPhotos();
    let reviewedCount = 0;

    const built = profiles
        .filter((profile) => profile.name && !excluded.has(profile.slug))
        .map((profile) => {
            const patch = (overrides.patch || {})[profile.slug] || {};
            // Données complétées par le wiki et validées en administration.
            const fixes = reviewed[profile.slug]?.fixes || {};
            const code = patch.countryCode || profile.code || codeFromEnglishName(profile.countryEn) || fixes.countryCode;
            const letters = toLetters(patch.name || profile.name);

            // Priorité : correction manuelle d'overrides.json, puis titre validé
            // en administration, sinon le calcul historique sur les majors.
            const legacy = legacyMajorTitle(profile);
            const fromReview = reviewedTitle(reviewed[profile.slug]);
            if (fromReview) reviewedCount += 1;
            const bestTitle = patch.bestTitleId
                ? overrideTitle(legacy, patch.bestTitleId)
                : fromReview || legacy;

            return {
                slug: profile.slug,
                name: patch.name || profile.name,
                letters,
                length: letters.length,
                countryCode: code || null,
                country: frenchName(code),
                continent: continentOf(code),
                gender: patch.gender || inferGender(profile.entries) || fixes.gender || null,
                category: patch.category || mainCategory(profile.entries),
                categoryLabel: null, // rempli juste après, une fois la catégorie arrêtée
                bestTitle,
                titleReviewed: Boolean(fromReview && !patch.bestTitleId),
                majorSeries: profile.majorSeries,
                events: profile.eventCount,
                titles: profile.titleCount,
                elo: profile.elo,
                firstYear: fixes.firstYear || yearBound(profile.entries, Math.min),
                lastYear: yearBound(profile.entries, Math.max),
                photo: photos.get(normalizeName(profile.name)) || null,
                source: `${config.BASE_URL}/beatboxers/${profile.slug}`,
                fame: fameScore(profile),
            };
        })
        .map((beatboxer) => ({
            ...beatboxer,
            categoryLabel: config.CATEGORY_LABELS[beatboxer.category] || null,
            // Le mode lettres a besoin d'un nom d'une longueur raisonnable ;
            // le mode indices n'a besoin que des quatre champs d'indices.
            modes: [
                beatboxer.length >= config.LETTERS_MIN && beatboxer.length <= config.LETTERS_MAX ? 'letters' : null,
                beatboxer.country && beatboxer.gender && beatboxer.firstYear && beatboxer.bestTitle ? 'clues' : null,
            ].filter(Boolean),
        }))
        .sort((a, b) => b.fame - a.fame);

    // Une entrée entre dans la base dès qu'elle est jouable dans UN mode : un nom
    // au genre inconnu sert quand même au mode lettres, un nom de quinze lettres
    // sert quand même au mode indices. Le tirage du jour filtre ensuite par mode,
    // donc les deux jeux ne se mélangent jamais.
    const playable = built.filter((beatboxer) => beatboxer.modes.length > 0);
    const selection = keepAll ? built : playable.slice(0, targetSize);

    return {
        built,
        incomplete: built.filter((beatboxer) => beatboxer.modes.length < 2),
        reviewedCount,
        dataset: {
            version: 2,
            generatedAt: new Date().toISOString(),
            source: config.BASE_URL,
            criteria: 'Au moins un résultat au Grand Beatbox Battle ou au championnat du monde',
            count: selection.length,
            beatboxers: selection,
        },
    };
}

function writeIncompleteReport(incomplete) {
    fs.mkdirSync(config.REPORT_DIR, { recursive: true });
    const file = path.join(config.REPORT_DIR, 'a-completer.csv');
    fs.writeFileSync(file, `${incompleteRows(incomplete).join('\n')}\n`, 'utf8');
    return file;
}

/** Écriture atomique : le serveur ne doit jamais lire une base à moitié écrite. */
function writeDataset(dataset) {
    fs.mkdirSync(path.dirname(config.DATASET_FILE), { recursive: true });
    const temp = `${config.DATASET_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(dataset, null, 2));
    fs.renameSync(temp, config.DATASET_FILE);
}

module.exports = { buildDataset, writeDataset, writeIncompleteReport, toLetters, normalizeName, inferGender, yearBound };
