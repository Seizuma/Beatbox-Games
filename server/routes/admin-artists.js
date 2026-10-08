/**
 * Artistes : catalogue commun aux trois jeux et désactivation globale.
 * Monté sous /api/admin/artists, derrière requireAdmin (voir admin.js).
 *
 * Un même artiste porte des noms légèrement différents selon le jeu
 * (« Max0 » en Blind Test, « MaxO » au Beatboxdle) : le catalogue les
 * regroupe par nom normalisé, comme la liste d'exclusion.
 */

const express = require('express');
const { getDatabase } = require('../services/database');
const exclusions = require('../services/artist-exclusions');
const audioManager = require('../services/audioManager');
const buzzerBeatboxerManager = require('../services/buzzer-beatboxerManager');
const beatboxdleDataset = require('../services/beatboxdle-dataset');
const daily = require('../services/beatboxdle-daily');

const router = express.Router();

const reviewer = (req) => req.user?.username || req.user?.discordId || 'admin';

function currentRerolls(db) {
    const date = daily.localDate();
    return Object.keys(daily.MODES).reduce((all, mode) => {
        all[mode] = db.getBeatboxdleReroll(mode, date);
        return all;
    }, {});
}

/**
 * Beatboxdle : si la réponse du jour change à cause de la liste (artiste du
 * jour désactivé, ou réactivé alors qu'il avait été sauté), on relance
 * l'énigme comme le bouton « Relancer le tirage » : nouveau compteur, pour
 * que les navigateurs jettent leur grille, et résultats du jour effacés.
 */
exclusions.onChange((change) => {
    const db = getDatabase();
    const now = new Date();
    const rerolls = currentRerolls(db);
    const wasExcluded = (beatboxer) => change.before.has(exclusions.keyOf(beatboxer.name));
    const relaunched = [];

    Object.keys(daily.MODES).forEach((mode) => {
        const before = daily.getPuzzle(mode, now, rerolls, { isExcluded: wasExcluded });
        const after = daily.getPuzzle(mode, now, rerolls);
        if (!before || !after || before.answer.slug === after.answer.slug) return;

        const reroll = db.bumpBeatboxdleReroll(mode, before.date);
        const cleared = db.clearBeatboxdleResults(mode, before.puzzleNumber);
        relaunched.push({ mode, reroll, cleared });
    });

    return relaunched.length ? { game: 'beatboxdle', relaunched } : null;
});

/**
 * GET /api/admin/artists
 * Tous les artistes connus des jeux, regroupés par nom normalisé, avec les
 * jeux où ils apparaissent et leur état. Les noms désactivés absents de tout
 * jeu (désactivés par avance) y figurent aussi.
 */
router.get('/', (req, res) => {
    try {
        const catalogue = new Map(); // clé -> { key, names:Set, games:Set }
        const add = (name, game) => {
            const key = exclusions.keyOf(name);
            if (!key) return;
            const entry = catalogue.get(key) || { key, names: new Set(), games: new Set() };
            entry.names.add(name);
            entry.games.add(game);
            catalogue.set(key, entry);
        };

        audioManager.getAllArtistNames().forEach((name) => add(name, 'blindtest'));
        (buzzerBeatboxerManager.allWithImages || []).forEach((beatboxer) => add(beatboxer.title, 'buzzer'));
        beatboxdleDataset.beatboxers.forEach((beatboxer) => add(beatboxer.name, 'beatboxdle'));

        const disabled = new Map(exclusions.list().map((entry) => [entry.key, entry]));
        disabled.forEach((entry, key) => {
            if (!catalogue.has(key)) catalogue.set(key, { key, names: new Set([entry.name]), games: new Set() });
        });

        const artists = [...catalogue.values()]
            .map((entry) => {
                const exclusion = disabled.get(entry.key) || null;
                return {
                    key: entry.key,
                    names: [...entry.names].sort((a, b) => a.localeCompare(b, 'fr')),
                    games: ['blindtest', 'buzzer', 'beatboxdle'].filter((game) => entry.games.has(game)),
                    disabled: Boolean(exclusion),
                    reason: exclusion?.reason || '',
                    disabledAt: exclusion?.at || null,
                    disabledBy: exclusion?.by || null,
                };
            })
            .sort((a, b) => a.names[0].localeCompare(b.names[0], 'fr', { sensitivity: 'base' }));

        res.json({ success: true, artists, disabledCount: disabled.size });
    } catch (error) {
        console.error('❌ Catalogue des artistes :', error);
        res.status(500).json({ success: false, error: 'server_error' });
    }
});

function logAdmin(req, message, context) {
    try {
        getDatabase().logEvent({ level: 'warn', type: 'admin', message, discordId: req.user?.discordId, context });
    } catch (error) {
        // Le journal est un plus.
    }
}

/** POST /api/admin/artists/exclusions  { name, reason } */
router.post('/exclusions', (req, res) => {
    try {
        const { entry, effects } = exclusions.exclude(req.body?.name, { reason: req.body?.reason, by: reviewer(req) });
        logAdmin(req, `Artiste désactivé dans tous les jeux : ${entry.name} (par ${reviewer(req)})`, { entry, effects });
        res.json({ success: true, entry, effects });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, error: error.message });
        console.error('❌ Désactivation artiste :', error);
        return res.status(500).json({ success: false, error: 'server_error' });
    }
});

/** DELETE /api/admin/artists/exclusions/:key */
router.delete('/exclusions/:key', (req, res) => {
    try {
        const { entry, effects } = exclusions.include(String(req.params.key));
        if (!entry) return res.status(404).json({ success: false, error: 'not_found' });
        logAdmin(req, `Artiste réactivé : ${entry.name} (par ${reviewer(req)})`, { entry, effects });
        return res.json({ success: true, entry, effects });
    } catch (error) {
        console.error('❌ Réactivation artiste :', error);
        return res.status(500).json({ success: false, error: 'server_error' });
    }
});

module.exports = router;
