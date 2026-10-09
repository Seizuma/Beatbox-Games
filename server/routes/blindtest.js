// server/routes/blindtest.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const audioManager = require('../services/audioManager');
const beatboxdleDataset = require('../services/beatboxdle-dataset');
const buzzerBeatboxers = require('../services/buzzer-beatboxerManager');
const { normalize } = require('../utils');

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

/**
 * GET /api/blindtest/demo
 * Un extrait au hasard pour l'accueil : le troisième, le plus reconnaissable.
 * Le nom de l'artiste est renvoyé avec : la démo le dévoile après l'écoute.
 */
router.get('/demo', (req, res) => {
    try {
        const audioDir = audioManager.audioCache.get('audio_dir');
        // Le nom se lit sur le fichier du premier extrait, le seul que l'extraction connaît
        const candidates = audioManager.getPlayableFiles()
            .map((file) => ({ artist: audioManager.extractArtistFromFilename(file).trim(), file: file.replace('Level 1 -', 'Level 3 -') }))
            .filter(({ artist, file }) => artist && (!audioDir || fs.existsSync(path.join(audioDir, file))));

        if (candidates.length === 0) {
            return res.status(404).json({ success: false, error: 'Aucun extrait disponible' });
        }

        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        res.set('Cache-Control', 'no-store');
        res.json({
            success: true,
            artist: pick.artist,
            audioUrl: audioManager.generateAudioUrl(pick.file),
        });
    } catch (error) {
        console.error('❌ Erreur extrait de démonstration:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

/**
 * GET /api/blindtest/card?name=Alexinho
 * Fiche courte d'un artiste pour la révélation de fin de manche : photo, pays,
 * meilleur titre. Tout est facultatif : un artiste absent de la base Beatboxdle
 * ou sans photo garde une fiche réduite à son nom.
 */
router.get('/card', (req, res) => {
    const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    if (!name) {
        return res.status(400).json({ success: false, error: 'Nom manquant' });
    }

    try {
        const profile = beatboxdleDataset.findByName(name);
        const key = normalize(name);
        const withPhoto = (buzzerBeatboxers.beatboxersData || []).find((beatboxer) => normalize(beatboxer.title || '') === key);
        const photo = (profile && profile.photo) || (withPhoto && withPhoto.local_image) || null;

        res.set('Cache-Control', 'public, max-age=3600');
        res.json({
            success: true,
            card: {
                name: profile ? profile.name : name,
                photoUrl: photo ? `/api/beatboxer-images/${encodeURIComponent(photo)}` : null,
                countryCode: profile ? profile.countryCode || null : null,
                category: profile ? profile.category || null : null,
                bestTitle: profile ? profile.bestTitle || null : null,
            },
        });
    } catch (error) {
        console.error('❌ Erreur fiche artiste:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
