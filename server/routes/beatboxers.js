// server/routes/beatboxers.js
//
// Fiches publiques des beatboxers : une page par beatboxer, reliée depuis
// les révélations du Blind Test, le Beatboxdle et la recherche du site.

const express = require('express');
const fs = require('fs');
const path = require('path');
const audioManager = require('../services/audioManager');
const { normalize } = require('../utils');
const directory = require('../services/beatboxerDirectory');
const { getDatabase } = require('../services/database');

const router = express.Router();

/**
 * GET /api/beatboxers/search?q=ale&limit=8
 * Beatboxers dont le nom commence par (ou contient) la recherche.
 */
router.get('/search', (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.slice(0, 60) : '';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);

    try {
        res.set('Cache-Control', 'public, max-age=60');
        res.json({ success: true, beatboxers: directory.search(query, limit) });
    } catch (error) {
        console.error('❌ Erreur recherche beatboxers:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

/** Manches du Blind Test où l'artiste est sorti, et combien ont été trouvées. */
function blindtestStats(name) {
    try {
        const row = getDatabase().db.prepare(`
            SELECT COUNT(DISTINCT rp.game_id || ':' || rp.round_number) AS rounds,
                   COUNT(DISTINCT CASE WHEN rp.level_found > 0 THEN rp.game_id || ':' || rp.round_number END) AS found
            FROM round_performances rp
            WHERE rp.artist_name = ? COLLATE NOCASE
        `).get(name);
        return row && row.rounds ? { rounds: row.rounds, found: row.found } : null;
    } catch (error) {
        return null;
    }
}

/** Troisième extrait du Blind Test, le plus reconnaissable, pour l'écouter sur la fiche. */
function clipUrl(name) {
    try {
        const key = normalize(name);
        const audioDir = audioManager.audioCache.get('audio_dir');
        const file = audioManager.getPlayableFiles()
            .filter((item) => normalize(audioManager.extractArtistFromFilename(item).trim()) === key)
            .map((item) => item.replace('Level 1 -', 'Level 3 -'))
            .find((item) => !audioDir || fs.existsSync(path.join(audioDir, item)));
        return file ? audioManager.generateAudioUrl(file) : null;
    } catch (error) {
        return null;
    }
}

/**
 * GET /api/beatboxers/:key
 * Fiche complète. `key` est le slug, ou à défaut un nom (lien venu d'un jeu).
 */
router.get('/:key', (req, res) => {
    try {
        const entry = directory.find(req.params.key);
        if (!entry) return res.status(404).json({ success: false, error: 'not_found' });

        res.set('Cache-Control', 'public, max-age=300');
        res.json({
            success: true,
            beatboxer: {
                ...directory.detail(entry),
                blindtestStats: entry.blindtest ? blindtestStats(entry.name) : null,
                clipUrl: entry.blindtest ? clipUrl(entry.name) : null,
            },
        });
    } catch (error) {
        console.error('❌ Erreur fiche beatboxer:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
