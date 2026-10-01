// server/services/title-review.js
//
// Revue humaine des titres Beatboxdle.
//
// scripts/beatboxdle/enrich.js propose, pour chaque beatboxer, le titre le
// plus marquant de son palmarès complet. L'administrateur valide la
// proposition, garde l'indice actuel ou choisit une alternative ; les
// décisions vont dans beatboxdle/reviewed-titles.json, que build.js relit.
//
// « Reconstruire la base » refait beatboxdle.json en mémoire, le valide, et
// ne l'écrit que si le tirage du jour reste identique : changer la réponse en
// pleine journée invaliderait les grilles déjà commencées par les joueurs.

const fs = require('fs');
const path = require('path');
const config = require('../scripts/beatboxdle/config');
const { buildDataset, writeDataset, writeIncompleteReport } = require('../scripts/beatboxdle/builder');
const { validateDataset } = require('../scripts/beatboxdle/validate');
const { normalizeName } = require('../scripts/shared/names');
const dataset = require('./beatboxdle-dataset');
const { HttpError, writeJsonAtomic } = require('./photo-review');

const FILTERS = ['todo', 'changed', 'reviewed', 'all'];

let proposalsCache = { mtimeMs: 0, data: null };

function readProposals() {
    if (!fs.existsSync(config.TITLE_PROPOSALS_FILE)) return null;
    const { mtimeMs } = fs.statSync(config.TITLE_PROPOSALS_FILE);
    if (proposalsCache.mtimeMs !== mtimeMs) {
        proposalsCache = { mtimeMs, data: JSON.parse(fs.readFileSync(config.TITLE_PROPOSALS_FILE, 'utf8')) };
    }
    return proposalsCache.data;
}

const readDecisions = () =>
    (fs.existsSync(config.REVIEWED_TITLES_FILE) ? JSON.parse(fs.readFileSync(config.REVIEWED_TITLES_FILE, 'utf8')) : {});

function writeDecisions(decisions) {
    fs.mkdirSync(path.dirname(config.REVIEWED_TITLES_FILE), { recursive: true });
    writeJsonAtomic(config.REVIEWED_TITLES_FILE, decisions);
}

/** Titre en base pour ce beatboxer, s'il est déjà dans la base en ligne. */
const liveTitle = (slug) => dataset.findBySlug(slug)?.bestTitle || null;

function decorate(item, decisions) {
    const decision = decisions[item.slug] || null;
    return {
        ...item,
        live: liveTitle(item.slug),
        decision: decision
            ? {
                choice: decision.choice,
                title: decision.title,
                reviewedAt: decision.reviewedAt,
                reviewedBy: decision.reviewedBy,
                // La proposition a bougé depuis la décision (nouveau crawl) : à revoir.
                stale: decision.choice === 'proposed' && item.proposed && decision.title?.key !== item.proposed.key,
            }
            : null,
    };
}

function summary() {
    const proposals = readProposals();
    const decisions = readDecisions();
    if (!proposals) return { ready: false, total: 0, changed: 0, reviewed: Object.keys(decisions).length, todo: 0 };
    const changed = proposals.items.filter((item) => item.changed);
    return {
        ready: true,
        generatedAt: proposals.generatedAt,
        total: proposals.items.length,
        changed: changed.length,
        reviewed: Object.keys(decisions).length,
        todo: changed.filter((item) => !decisions[item.slug]).length,
        weights: proposals.weights,
        datasetLoadedAt: dataset.getStatus().loadedAt,
        decisionsUpdatedAt: fs.existsSync(config.REVIEWED_TITLES_FILE)
            ? fs.statSync(config.REVIEWED_TITLES_FILE).mtimeMs
            : null,
    };
}

/**
 * @param {{ filter?: 'todo'|'changed'|'reviewed'|'all', offset?: number, limit?: number, query?: string }} options
 *   todo     = proposition différente de l'indice actuel, pas encore tranchée
 */
function list({ filter = 'todo', offset = 0, limit = 20, query = '' } = {}) {
    const proposals = readProposals();
    if (!proposals) return { ready: false, total: 0, items: [] };
    const decisions = readDecisions();
    const wanted = FILTERS.includes(filter) ? filter : 'todo';
    const needle = normalizeName(query);

    const items = proposals.items
        .filter((item) => {
            if (needle && !normalizeName(item.name).includes(needle)) return false;
            if (wanted === 'todo') return item.changed && !decisions[item.slug];
            if (wanted === 'changed') return item.changed;
            if (wanted === 'reviewed') return Boolean(decisions[item.slug]);
            return true;
        });

    return {
        ready: true,
        total: items.length,
        offset,
        items: items.slice(offset, offset + limit).map((item) => decorate(item, decisions)),
    };
}

/**
 * Enregistre une décision.
 * @param {string} choice 'proposed' | 'current' | 'alt:<key>'
 */
function decide(slug, choice, reviewer) {
    const proposals = readProposals();
    const item = proposals?.items.find((candidate) => candidate.slug === slug);
    if (!item) throw new HttpError(404, 'title_not_found');

    let title = null;
    if (choice === 'proposed') title = item.proposed;
    else if (choice === 'current') title = item.current;
    else if (typeof choice === 'string' && choice.startsWith('alt:')) {
        title = item.alternatives.find((alternative) => alternative.key === choice.slice(4)) || null;
    }
    if (!title) throw new HttpError(400, 'invalid_choice');

    const decisions = readDecisions();
    decisions[slug] = {
        name: item.name,
        choice: choice.startsWith('alt:') ? 'alternative' : choice,
        title,
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewer,
    };
    writeDecisions(decisions);
    return { slug, name: item.name, title };
}

function decideMany(slugs, reviewer) {
    return (Array.isArray(slugs) ? slugs : []).slice(0, 200).map((slug) => decide(String(slug), 'proposed', reviewer));
}

function undo(slug) {
    const decisions = readDecisions();
    if (!decisions[slug]) return { slug, removed: false };
    delete decisions[slug];
    writeDecisions(decisions);
    return { slug, removed: true };
}

/** Ordre des viviers de chaque mode : c'est lui qui fixe le tirage du jour. */
const poolOrder = (beatboxers, mode) =>
    beatboxers.filter((beatboxer) => beatboxer.modes.includes(mode)).map((beatboxer) => beatboxer.slug).join('|');

/**
 * Reconstruit la base avec les titres validés.
 * @returns {{ ok: boolean, reason?: string, errors?: string[], warnings?: string[], ... }}
 */
function rebuild({ force = false } = {}) {
    let result;
    try {
        result = buildDataset();
    } catch (error) {
        return { ok: false, reason: error.code || 'build_failed', errors: [error.message] };
    }

    const { errors, warnings, cycle } = validateDataset(result.dataset);
    if (errors.length) return { ok: false, reason: 'invalid_dataset', errors, warnings };

    const before = dataset.beatboxers;
    const drawChanged = ['letters', 'clues'].filter(
        (mode) => before.length > 0 && poolOrder(before, mode) !== poolOrder(result.dataset.beatboxers, mode),
    );
    if (drawChanged.length && !force) {
        // Les profils ont changé depuis la dernière construction (nouveau crawl) :
        // l'ordre du tirage n'est plus le même. À faire juste après minuit, ou
        // en connaissance de cause.
        return { ok: false, reason: 'draw_changed', modes: drawChanged, warnings };
    }

    const changedTitles = result.dataset.beatboxers.filter((beatboxer) => {
        const previous = dataset.findBySlug(beatboxer.slug)?.bestTitle;
        const next = beatboxer.bestTitle;
        return (previous?.key || previous?.id || null) !== (next?.key || next?.id || null);
    }).length;

    writeIncompleteReport(result.incomplete);
    writeDataset(result.dataset);
    dataset.reload();

    return {
        ok: true,
        count: result.dataset.count,
        reviewedCount: result.reviewedCount,
        changedTitles,
        drawChanged,
        cycle,
        warnings,
    };
}

module.exports = { summary, list, decide, decideMany, undo, rebuild };
