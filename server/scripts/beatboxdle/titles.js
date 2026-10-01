// server/scripts/beatboxdle/titles.js
//
// Du palmarès brut (beatbox.world + wiki) au titre affiché dans l'indice
// « Meilleur titre ».
//
// 1. classer chaque événement : mondial (wbc, gbb), continental, national,
//    international, autre — ou exclu (qualifications) ;
// 2. fusionner les deux sources : un même résultat cité deux fois compte une
//    fois, mais gagne en crédibilité ;
// 3. regrouper les résultats identiques (« champion de Bulgarie » 2015,
//    2017, 2019) et pondérer : niveau × placement × discipline, bonus de
//    répétition ;
// 4. garder le groupe le plus fort.
//
// Ce que le jeu compare ensuite (beatboxdle-compare.js) :
//   key  — identité exacte du titre, pour le vert (national-champion:BG) ;
//   tier — prestige de base, pour l'orange (rang équivalent) et la flèche.
// Le tier ne dépend ni de la discipline ni des répétitions : deux champions
// nationaux sont à rang égal, quel que soit leur nombre de couronnes.

const config = require('./config');
const { codeFromPlaceWord, continentFromWord, placeWords } = require('./countries');

const LEVEL_ORDER = ['wbc', 'gbb', 'continental', 'intl', 'national', 'other'];

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// « 5th Bulgarian Beatbox Battle 2019 » -> place = « Bulgarian »
let placeRegExp = null;
function placePattern() {
    if (!placeRegExp) {
        const words = placeWords().map(escapeRegExp).join('|');
        placeRegExp = new RegExp(
            `^(?:the\\s+)?(?:\\d+(?:st|nd|rd|th)\\s+)?(${words})\\s+(?:national\\s+)?(?:human\\s+)?(?:beat ?box|loop ?station|vocal)\\b`,
            'i',
        );
    }
    return placeRegExp;
}

/** Nom d'événement sans année ni numéro d'édition : « Vokal Total 2015 » -> « Vokal Total ». */
function baseEventName(name) {
    return String(name || '')
        .replace(/\b(19|20)\d{2}\b/g, '')
        .replace(/^\s*\d+(?:st|nd|rd|th)\s+/i, '')
        .replace(/:\s*(world|second)\s+league\b.*$/i, '')
        .replace(/\s+/g, ' ')
        .replace(/[\s:–—-]+$/, '')
        .trim();
}

/**
 * Classe un événement.
 * @returns {{ level: string, region: string|null, regionType: string|null, event: string } | { level: 'excluded' }}
 */
function classifyEvent(eventName) {
    const name = String(eventName || '').trim();
    const event = baseEventName(name);
    if (!name) return { level: 'other', region: null, regionType: 'event', event: '?' };

    if (config.TITLE_EXCLUDED_EVENTS.test(name)) return { level: 'excluded', event };
    if (config.TITLE_SIDE_EVENTS.test(name)) return { level: 'other', region: null, regionType: 'event', event, side: true };

    for (const series of config.MAJOR_SERIES) {
        if (series.match.test(name) && !(series.exclude && series.exclude.test(name))) {
            return { level: series.id, region: null, regionType: null, event };
        }
    }

    const place = (event.match(placePattern()) || [])[1];
    if (place) {
        const continent = continentFromWord(place);
        // « European Beatbox Masters » n'est pas le championnat d'Europe :
        // le niveau continental exige le mot « championship ».
        if (continent && /championships?/i.test(event)) {
            return { level: 'continental', region: continent, regionType: 'continent', event };
        }
        const country = codeFromPlaceWord(place);
        if (country && !continent) return { level: 'national', region: country, regionType: 'country', event };
    }

    if (config.TITLE_INTL_EVENTS.test(name)) return { level: 'intl', region: null, regionType: 'event', event };
    return { level: 'other', region: null, regionType: 'event', event };
}

const eventKey = (event) => event.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Identifiants d'un titre : id pour le libellé, key pour l'égalité stricte. */
function titleIdentity(classification, placementId) {
    const id = `${classification.level}-${placementId}`;
    if (classification.level === 'wbc' || classification.level === 'gbb') return { id, key: id };
    if (classification.regionType === 'event') return { id, key: `${id}:${eventKey(classification.event)}` };
    return { id, key: `${id}:${classification.region}` };
}

/** Prestige de base : ce que compare le jeu. */
const baseTier = (level, placementId) =>
    Math.round((config.TITLE_LEVEL_WEIGHTS[level] || 0) * (config.TITLE_PLACEMENT_FACTORS[placementId] || 0));

/** Poids d'un résultat isolé, pour choisir parmi les titres d'un même beatboxer. */
function resultWeight(result) {
    const discipline = config.TITLE_DISCIPLINE_FACTORS[result.discipline] ?? 0.9;
    const side = config.TITLE_SIDE_CATEGORY.match.test(result.categoryText || '') ? config.TITLE_SIDE_CATEGORY.factor : 1;
    return baseTier(result.level, result.placementId) * discipline * side;
}

// --- Normalisation des deux sources ----------------------------------------

/** Entrée de profiles.json (beatbox.world) -> résultat normalisé. */
function fromBeatboxWorld(entry) {
    // Les profils lus avant l'ajout de eventName n'ont que le slug : on en
    // refait un nom lisible, suffisant pour la classification.
    const eventName = entry.eventName || entry.eventSlug.replace(/-/g, ' ');
    const categoryText = entry.eventName
        ? entry.text.slice(entry.text.indexOf(entry.eventName) + entry.eventName.length)
        : entry.text;
    return {
        source: 'beatboxworld',
        eventName,
        categoryText,
        placementId: entry.placementId,
        discipline: entry.discipline,
        year: entry.year,
    };
}

/** Ligne de palmarès du wiki -> résultat normalisé. */
const fromWiki = (achievement) => ({
    source: 'wiki',
    eventName: achievement.eventName,
    categoryText: achievement.categoryText,
    placementId: achievement.placementId,
    discipline: achievement.discipline,
    year: achievement.year,
});

/**
 * Fusionne et classe les résultats des deux sources.
 * Deux résultats sont le même s'ils partagent titre, discipline et année
 * (une année manquante d'un côté s'accorde avec n'importe laquelle).
 */
function mergeResults(results) {
    const merged = [];
    const unclassified = new Set();

    for (const result of results) {
        if (!result.placementId) continue;
        const classification = classifyEvent(result.eventName);
        if (classification.level === 'excluded') continue;
        // Les soirées annexes sont « autres » par choix, pas faute de règle.
        if (classification.level === 'other' && !classification.side) unclassified.add(classification.event);

        const { id, key } = titleIdentity(classification, result.placementId);
        const candidate = { ...result, ...classification, id, key, sources: new Set([result.source]) };

        const twin = merged.find((other) =>
            other.key === key
            && (other.discipline || null) === (candidate.discipline || null)
            && (!other.year || !candidate.year || other.year === candidate.year));

        if (twin) {
            twin.sources.add(result.source);
            if (!twin.year && candidate.year) twin.year = candidate.year;
            if (!twin.categoryText && candidate.categoryText) twin.categoryText = candidate.categoryText;
        } else {
            merged.push(candidate);
        }
    }

    return { merged, unclassified: [...unclassified] };
}

/** Catégorie lisible d'un résultat (« 7 To Smoke », « Tag Team, with Alem »), pour la revue. */
const categoryDetail = (result) =>
    String(result.categoryText || '')
        .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
        .replace(/[+-]\d+\b/g, '')
        .replace(/\s*official account/gi, '')
        .replace(/\b(champion|runner-?up|3rd place|semi-?finalist|quarter-?finalist|top \d+|participant)\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60) || null;

/** Variante d'un titre : même discipline, même type de catégorie (principale ou annexe). */
const variantOf = (result) =>
    `${result.discipline || '-'}|${config.TITLE_SIDE_CATEGORY.match.test(result.categoryText || '') ? 'side' : 'main'}`;

/**
 * Regroupe les résultats par titre et calcule le score de chaque groupe.
 *
 * Le bonus de répétition ne cumule que des couronnes comparables : trois
 * 7 To Smoke du GBB font un « champion GBB ×3 », mais un 7 To Smoke et un
 * tag team ne font pas un double champion. Chaque titre est donc noté sur sa
 * meilleure variante (discipline + catégorie principale ou annexe).
 * @returns {Array<object>} titres, du plus fort au plus faible
 */
function rankTitles(merged) {
    const groups = new Map();
    merged.forEach((result) => {
        const group = groups.get(result.key) || [];
        group.push(result);
        groups.set(result.key, group);
    });

    const titles = [...groups.values()].map((group) => {
        const variants = new Map();
        group.forEach((result) => {
            const variant = variants.get(variantOf(result)) || [];
            variant.push(result);
            variants.set(variantOf(result), variant);
        });

        const scored = [...variants.values()].map((variant) => {
            const best = variant.reduce((winner, result) => (resultWeight(result) > resultWeight(winner) ? result : winner));
            const years = [...new Set(variant.map((result) => result.year).filter(Boolean))].sort((a, b) => a - b);
            const count = Math.max(1, years.length);
            const confirmed = variant.some((result) => result.sources.size > 1);
            const repeat = 1 + config.TITLE_REPEAT_BONUS * Math.min(count - 1, config.TITLE_REPEAT_MAX);
            const score = resultWeight(best) * repeat * (confirmed ? 1 + config.TITLE_CONFIRMED_BONUS : 1);
            return { best, years, count, score };
        });
        const { best, years, count, score } = scored.reduce((winner, variant) => (variant.score > winner.score ? variant : winner));

        return {
            id: best.id,
            key: best.key,
            level: best.level,
            placementId: best.placementId,
            tier: baseTier(best.level, best.placementId),
            score: Math.round(score * 10) / 10,
            series: best.level === 'wbc' || best.level === 'gbb' ? best.level : null,
            region: best.region || null,
            regionType: best.regionType || null,
            event: best.regionType === 'event' ? best.event : null,
            discipline: best.discipline || null,
            detail: categoryDetail(best),
            year: years.length ? years[years.length - 1] : best.year || null,
            years,
            count,
            sources: [...new Set(group.flatMap((result) => [...result.sources]))].sort(),
        };
    });

    return titles.sort((a, b) =>
        b.score - a.score
        || LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
        || (b.year || 0) - (a.year || 0));
}

/**
 * Tous les titres d'un beatboxer, à partir de son profil beatbox.world et,
 * s'il existe, de sa page wiki.
 */
function titlesFor(profile, wikiProfile = null) {
    const results = [
        ...(profile.entries || []).map(fromBeatboxWorld),
        ...((wikiProfile && wikiProfile.achievements) || []).map(fromWiki),
    ];
    const { merged, unclassified } = mergeResults(results);
    return { titles: rankTitles(merged), unclassified };
}

/**
 * Titre « historique » : l'entrée de major retenue par l'ancien calcul
 * (meilleur placement, championnat du monde prioritaire à égalité, puis la
 * plus récente), exprimée dans le nouveau format. C'est ce qu'affiche le jeu
 * tant qu'un administrateur n'a pas validé autre chose.
 */
function legacyMajorTitle(profile) {
    const majors = (profile.entries || []).filter((entry) => entry.series);
    if (majors.length === 0) return null;

    const best = majors.reduce((winner, entry) => {
        if (!winner) return entry;
        if (entry.tier !== winner.tier) return entry.tier > winner.tier ? entry : winner;
        if (entry.series === 'wbc' && winner.series !== 'wbc') return entry;
        return (entry.year || 0) > (winner.year || 0) ? entry : winner;
    }, null);

    const id = `${best.series}-${best.placementId}`;
    const years = [...new Set(
        majors
            .filter((entry) => entry.series === best.series && entry.placementId === best.placementId
                && entry.discipline === best.discipline && entry.year)
            .map((entry) => entry.year),
    )].sort((a, b) => a - b);

    return {
        id,
        key: id,
        level: best.series,
        placementId: best.placementId,
        tier: baseTier(best.series, best.placementId),
        series: best.series,
        region: null,
        regionType: null,
        event: null,
        discipline: best.discipline || null,
        year: best.year,
        years,
        count: Math.max(1, years.length),
        sources: ['beatboxworld'],
        label: config.TITLE_LABELS[id] || id,
    };
}

module.exports = {
    LEVEL_ORDER,
    baseEventName,
    classifyEvent,
    baseTier,
    titlesFor,
    legacyMajorTitle,
};
