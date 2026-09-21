// server/routes/beatboxdle.js
const express = require('express');
const { authenticateDiscord } = require('../middleware/auth');
const dataset = require('../services/beatboxdle-dataset');
const daily = require('../services/beatboxdle-daily');
const { compareLetters, compareClues, revealAnswer } = require('../services/beatboxdle-compare');
const { getDatabase } = require('../services/database');

const router = express.Router();

// Garde-fou : tant que beatboxdle.json n'est pas déposé, le jeu répond 503
// plutôt que de renvoyer des grilles vides.
const requireDataset = (req, res, next) => {
    if (!dataset.isReady()) {
        return res.status(503).json({ success: false, error: 'Base Beatboxdle indisponible', ready: false });
    }
    next();
};

/**
 * Compteurs de relances du jour, posés par l'administration. 0 en temps normal.
 *
 * Les deux modes sont lus ensemble : le tirage d'un mode doit connaître la
 * réponse de l'autre pour ne jamais tomber dessus, et donc son reroll aussi.
 */
const currentRerolls = () => {
    const date = daily.localDate();
    try {
        const db = getDatabase();
        return Object.keys(daily.MODES).reduce((all, mode) => {
            all[mode] = db.getBeatboxdleReroll(mode, date);
            return all;
        }, {});
    } catch (error) {
        // Une base indisponible ne doit pas empêcher de jouer : tirage normal
        console.error('❌ Lecture des rerolls Beatboxdle:', error.message);
        return {};
    }
};

// Limiteur mémoire : une énigme par jour, personne n'a besoin de 200 essais
// à la minute. Suffisant pour freiner un script sans peser sur le serveur.
const hits = new Map();
const rateLimit = (max, windowMs) => (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return next();
    }
    if (entry.count >= max) {
        return res.status(429).json({ success: false, error: 'Trop de tentatives, réessaie dans un instant' });
    }
    entry.count += 1;
    next();
};

// Purge périodique des compteurs expirés
setInterval(() => {
    const now = Date.now();
    hits.forEach((entry, key) => {
        if (now > entry.resetAt) hits.delete(key);
    });
}, 60000).unref();

/**
 * GET /api/beatboxdle/daily/:mode
 * Énigme du jour sans la réponse, plus la liste des propositions acceptées.
 */
router.get('/daily/:mode', requireDataset, (req, res) => {
    const { mode } = req.params;
    if (!daily.isMode(mode)) {
        return res.status(400).json({ success: false, error: 'Mode inconnu (letters ou clues)' });
    }

    try {
        const puzzle = daily.getPublicPuzzle(mode, new Date(), currentRerolls());
        if (!puzzle) {
            return res.status(503).json({ success: false, error: `Aucun beatboxer jouable en mode ${mode}` });
        }

        res.set('Cache-Control', 'no-store');
        res.json({
            success: true,
            puzzle,
            // En mode lettres on ne propose que les noms de la bonne longueur :
            // la grille reste lisible et l'autocomplétion reste utile.
            candidates: dataset.candidates(mode, { length: puzzle.length }),
        });
    } catch (error) {
        console.error('❌ Erreur Beatboxdle daily:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

/**
 * POST /api/beatboxdle/guess
 * Body : { mode, guess, attempt }
 * `attempt` est le numéro de la tentative courante (1..maxAttempts) ; il sert
 * uniquement à savoir s'il faut révéler la réponse. Le client garde son
 * historique en local, le serveur reste sans état.
 */
router.post('/guess', requireDataset, rateLimit(60, 60000), (req, res) => {
    const { mode, guess, attempt } = req.body || {};

    if (!daily.isMode(mode)) {
        return res.status(400).json({ success: false, error: 'Mode inconnu (letters ou clues)' });
    }
    if (typeof guess !== 'string' || !guess.trim()) {
        return res.status(400).json({ success: false, error: 'Proposition manquante' });
    }

    try {
        const puzzle = daily.getPuzzle(mode, new Date(), currentRerolls());
        if (!puzzle) return res.status(503).json({ success: false, error: 'Énigme indisponible' });

        const proposed = dataset.findByName(guess);
        if (!proposed) {
            return res.status(422).json({ success: false, error: 'Ce beatboxer n\'est pas dans la liste', unknown: true });
        }
        if (!proposed.modes.includes(mode)) {
            return res.status(422).json({ success: false, error: `Ce beatboxer n'est pas jouable en mode ${mode}`, unknown: true });
        }
        if (mode === 'letters' && proposed.length !== puzzle.answer.length) {
            return res.status(422).json({
                success: false,
                error: `Il faut un nom de ${puzzle.answer.length} lettres`,
                unknown: true,
            });
        }

        const correct = proposed.slug === puzzle.answer.slug;
        const attemptNumber = Number(attempt) || 1;
        const finished = correct || attemptNumber >= puzzle.maxAttempts;

        res.set('Cache-Control', 'no-store');
        res.json({
            success: true,
            mode,
            puzzleNumber: puzzle.puzzleNumber,
            reroll: puzzle.reroll,
            // La photo voyage avec la proposition : la grille du mode indices
            // affiche le visage à côté du nom, comme le Buzzer Battle.
            guess: { name: proposed.name, slug: proposed.slug, photo: proposed.photo || null },
            correct,
            finished,
            result: mode === 'letters'
                ? compareLetters(proposed.letters, puzzle.answer.letters)
                : compareClues(proposed, puzzle.answer),
            answer: finished ? revealAnswer(puzzle.answer) : null,
        });
    } catch (error) {
        console.error('❌ Erreur Beatboxdle guess:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

/**
 * POST /api/beatboxdle/result
 * Enregistre le résultat du jour pour un joueur connecté (séries, historique).
 * Une seule écriture par joueur / mode / jour : recommencer ne réécrit rien.
 */
router.post('/result', requireDataset, authenticateDiscord, (req, res) => {
    const { mode, solved, attempts } = req.body || {};

    if (!daily.isMode(mode)) {
        return res.status(400).json({ success: false, error: 'Mode inconnu (letters ou clues)' });
    }

    try {
        const puzzle = daily.getPuzzle(mode, new Date(), currentRerolls());
        if (!puzzle) return res.status(503).json({ success: false, error: 'Énigme indisponible' });

        const attemptCount = Math.min(Math.max(parseInt(attempts, 10) || 1, 1), puzzle.maxAttempts);
        const recorded = getDatabase().recordBeatboxdleResult({
            discordId: req.user.discordId,
            mode,
            puzzleNumber: puzzle.puzzleNumber,
            puzzleDate: puzzle.date,
            solved: Boolean(solved),
            attempts: attemptCount,
            answerSlug: puzzle.answer.slug,
        });

        res.json({
            success: true,
            recorded,
            stats: getDatabase().getBeatboxdleStats(req.user.discordId, mode),
        });
    } catch (error) {
        console.error('❌ Erreur Beatboxdle result:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

/**
 * GET /api/beatboxdle/stats/me?mode=letters
 * Séries, taux de réussite et répartition des essais du joueur connecté.
 */
router.get('/stats/me', authenticateDiscord, (req, res) => {
    const mode = daily.isMode(req.query.mode) ? req.query.mode : null;

    try {
        res.json({
            success: true,
            stats: mode
                ? { [mode]: getDatabase().getBeatboxdleStats(req.user.discordId, mode) }
                : {
                    letters: getDatabase().getBeatboxdleStats(req.user.discordId, 'letters'),
                    clues: getDatabase().getBeatboxdleStats(req.user.discordId, 'clues'),
                },
        });
    } catch (error) {
        console.error('❌ Erreur Beatboxdle stats:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

/**
 * GET /api/beatboxdle/summary
 * Les deux énigmes du jour, sans réponse ni liste de propositions. Sert
 * l'écran de choix du mode : une requête au lieu de deux, et de quoi
 * retrouver dans le navigateur les parties déjà jouées.
 */
router.get('/summary', requireDataset, (req, res) => {
    try {
        const rerolls = currentRerolls();
        const modes = {};

        Object.keys(daily.MODES).forEach((mode) => {
            const puzzle = daily.getPublicPuzzle(mode, new Date(), rerolls);
            if (puzzle) modes[mode] = puzzle;
        });

        res.set('Cache-Control', 'no-store');
        res.json({ success: true, modes });
    } catch (error) {
        console.error('❌ Erreur Beatboxdle summary:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

/**
 * GET /api/beatboxdle/status
 * État de la base, pour le tableau d'administration.
 */
router.get('/status', (req, res) => {
    res.json({ success: true, ...dataset.getStatus() });
});

module.exports = router;
