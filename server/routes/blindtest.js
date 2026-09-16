// server/routes/blindtest.js
const express = require('express');
const audioManager = require('../services/audioManager');

const router = express.Router();

/**
 * GET /api/blindtest/artists
 * Liste triée de tous les artistes qui peuvent sortir dans le Blind Test.
 * Utilisée par le jeu pour la liste des artistes et l'autocomplétion des réponses.
 */
router.get('/artists', (req, res) => {
    try {
        const artists = audioManager.getArtistNames();
        res.set('Cache-Control', 'public, max-age=300');
        res.json({ success: true, count: artists.length, artists });
    } catch (error) {
        console.error('❌ Erreur récupération liste des artistes:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur lors de la récupération des artistes' });
    }
});

module.exports = router;