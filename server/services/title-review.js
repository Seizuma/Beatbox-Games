// server/services/title-review.js
//
// Revue humaine des fiches Beatboxdle.
//
// scripts/beatboxdle/enrich.js propose, pour chaque beatboxer, le titre le
// plus marquant de son palmarès complet, et les données d'indice que le wiki
// permet de compléter (genre, première apparition, pays). L'administrateur
// valide, garde l'existant ou choisit une alternative ; les décisions vont
// dans beatboxdle/reviewed-titles.json, que build.js relit.
//
// « Reconstruire la base » refait beatboxdle.json en mémoire, le valide, et
// ne l'écrit que si le tirage du jour reste identique : changer la réponse en
// pleine journée invaliderait les grilles déjà commencées par les joueurs.
// Quand le tirage doit changer (un beatboxer entre dans le mode indices),
// la reconstruction se programme pour le prochain minuit.

const fs = require('fs');
const path = require('path');
const config = require('../scripts/beatboxdle/config');
const { buildDataset, writeDataset, writeIncompleteReport } = require('../scripts/beatboxdle/builder');
const { validateDataset } = require('../scripts/beatboxdle/validate');
const { normalizeName } = require('../scripts/shared/names');
const dataset = require('./beatboxdle-dataset');
const daily = require('./beatboxdle-daily');
const { HttpError, writeJsonAtomic } = require('./photo-review');

const FILTERS = ['todo', 'changed', 'reviewed', 'all'];
const FIX_FIELDS = ['gender', 'firstYear', 'countryCode'];
const SCHEDULE_FILE = path.join(config.DATA_DIR, 'rebuild-scheduled.json');

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

/** Fiche à revoir : titre différent ou données à compléter (anciens fichiers : titre seul). */
const needsReview = (item) => (item.needsReview !== undefined ? item.needsReview : item.changed);

/** Ce que la base en ligne affiche aujourd'hui pour ce beatboxer. */
function liveData(slug) {
    const live = dataset.findBySlug(slug);
    if (!live) return null;
    return { title: live.bestTitle || null, gender: live.gender, firstYear: live.firstYear, countryCode: live.countryCode, modes: live.modes };
}

function decorate(item, decisions) {
    const decision = decisions[item.slug] || null;
    const live = liveData(item.slug);
    return {
        ...item,
        fixes: item.fixes || {},
        live: live ? live.title : null,
        liveData: live,
        decision: decision
            ? {
                choice: decision.choice,
                title: decision.title,
                fixes: decision.fixes || {},
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
    const base = { schedule: readSchedule(), lastScheduled };
    if (!proposals) return { ...base, ready: false, total: 0, changed: 0, reviewed: Object.keys(decisions).length, todo: 0 };

    const toReview = proposals.items.filter(needsReview);
    const countFix = (field) => proposals.items.filter((item) => item.fixes?.[field]).length;
    return {
        ...base,
        ready: true,
        generatedAt: proposals.generatedAt,
        total: proposals.items.length,
        changed: toReview.length,
        reviewed: Object.keys(decisions).length,
        todo: toReview.filter((item) => !decisions[item.slug]).length,
        fixes: Object.fromEntries(FIX_FIELDS.map((field) => [field, countFix(field)])),
        weights: proposals.weights,
        datasetLoadedAt: dataset.getStatus().loadedAt,
    };
}

/**
 * @param {{ filter?: 'todo'|'changed'|'reviewed'|'all', offset?: number, limit?: number, query?: string }} options
 *   todo    = fiche à revoir (titre différent ou données à compléter), pas encore tranchée
 *   changed = toutes les fiches à revoir, tranchées ou non
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
            if (wanted === 'todo') return needsReview(item) && !decisions[item.slug];
            if (wanted === 'changed') return needsReview(item);
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
 * @param {string[]|null} acceptedFixes champs complétés acceptés ; null = tous
 */
function decide(slug, choice, reviewer, acceptedFixes = null) {
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

    // Seules les valeurs proposées par enrich.js sont acceptées : l'écran ne
    // peut pas injecter une valeur arbitraire, il ne fait que trier.
    const proposedFixes = item.fixes || {};
    const fields = (acceptedFixes === null ? Object.keys(proposedFixes) : acceptedFixes)
        .filter((field) => FIX_FIELDS.includes(field) && proposedFixes[field]);
    const fixes = Object.fromEntries(fields.map((field) => [field, proposedFixes[field].value]));

    const decisions = readDecisions();
    decisions[slug] = {
        name: item.name,
        choice: choice.startsWith('alt:') ? 'alternative' : choice,
        title,
        fixes,
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewer,
    };
    writeDecisions(decisions);
    return { slug, name: item.name, title, fixes };
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

// --- Reconstruction ----------------------------------------------------------

const pool = (beatboxers, mode) => beatboxers.filter((beatboxer) => beatboxer.modes.includes(mode)).map((beatboxer) => beatboxer.slug);

/**
 * Ce qui change dans le vivier de chaque mode. L'ordre du vivier fixe le
 * tirage : une entrée, une sortie ou un simple déplacement changent la
 * réponse du jour.
 */
function drawImpact(before, after) {
    const impact = {};
    ['letters', 'clues'].forEach((mode) => {
        const previous = pool(before, mode);
        const next = pool(after, mode);
        if (previous.join('|') === next.join('|')) return;
        impact[mode] = {
            added: next.filter((slug) => !previous.includes(slug)).length,
            removed: previous.filter((slug) => !next.includes(slug)).length,
            size: next.length,
        };
    });
    return impact;
}

/**
 * Reconstruit la base avec les décisions validées.
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
    const impact = before.length > 0 ? drawImpact(before, result.dataset.beatboxers) : {};
    const drawChanged = Object.keys(impact);
    if (drawChanged.length && !force) {
        return { ok: false, reason: 'draw_changed', modes: drawChanged, impact, warnings };
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
        impact,
        cycle,
        warnings,
    };
}

// --- Reconstruction programmée à minuit -------------------------------------
// Le seul moment où changer le tirage ne casse la partie de personne : la
// nouvelle énigme commence. L'échéance est écrite sur disque pour survivre à
// un redémarrage du serveur.

let scheduleTimer = null;
let lastScheduled = null; // résultat de la dernière reconstruction programmée

function readSchedule() {
    if (!fs.existsSync(SCHEDULE_FILE)) return null;
    try {
        return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    } catch (error) {
        return null;
    }
}

function runScheduled() {
    scheduleTimer = null;
    const schedule = readSchedule();
    if (!schedule) return;
    fs.rmSync(SCHEDULE_FILE, { force: true });

    const result = rebuild({ force: true });
    lastScheduled = { at: new Date().toISOString(), requestedBy: schedule.requestedBy, ...result };
    console.log(`🌙 Beatboxdle : reconstruction de minuit ${result.ok ? 'faite' : `échouée (${result.reason})`}`);
    try {
        require('./database').getDatabase().logEvent({
            level: result.ok ? 'info' : 'error',
            type: 'admin',
            message: `Reconstruction Beatboxdle de minuit ${result.ok ? 'effectuée' : 'échouée'} (demandée par ${schedule.requestedBy})`,
            context: { reason: result.reason || null, impact: result.impact || null, changedTitles: result.changedTitles || 0 },
        });
    } catch (error) {
        // Le journal est un plus.
    }
}

function armSchedule() {
    if (scheduleTimer) clearTimeout(scheduleTimer);
    scheduleTimer = null;
    const schedule = readSchedule();
    if (!schedule) return;

    const delay = Date.parse(schedule.at) - Date.now();
    const MAX_TIMEOUT = 2 ** 31 - 1; // ~24,8 jours, limite de setTimeout
    scheduleTimer = delay > MAX_TIMEOUT
        ? setTimeout(armSchedule, MAX_TIMEOUT)
        : setTimeout(runScheduled, Math.max(0, delay));
    // Une échéance ne doit pas empêcher le processus de s'arrêter proprement.
    if (scheduleTimer.unref) scheduleTimer.unref();
}

/** Programme la reconstruction juste après le prochain changement de jour. */
function scheduleRebuild(reviewer) {
    // Deux secondes après minuit plutôt qu'avant : au pire, une énigme ouverte
    // dans ces deux secondes change, alors qu'avant minuit ce seraient les
    // dernières grilles de la veille.
    const at = new Date(Date.parse(daily.nextResetAt()) + 2000).toISOString();
    fs.mkdirSync(path.dirname(SCHEDULE_FILE), { recursive: true });
    writeJsonAtomic(SCHEDULE_FILE, { at, requestedBy: reviewer, requestedAt: new Date().toISOString() });
    armSchedule();
    return { at };
}

function cancelSchedule() {
    fs.rmSync(SCHEDULE_FILE, { force: true });
    armSchedule();
    return { cancelled: true };
}

armSchedule();

module.exports = { summary, list, decide, decideMany, undo, rebuild, scheduleRebuild, cancelSchedule };
