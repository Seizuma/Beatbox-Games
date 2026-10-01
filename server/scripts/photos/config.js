// server/scripts/photos/config.js
//
// Configuration du pipeline photos du Buzzer Battle.
//
//   Google Sheet (cases blanches)  ─┐
//   beatboxers.json (sans photo)   ─┴─> collect.js ─> faces.py ─> /admin (revue humaine)
//
// collect.js interroge beatbox.world, le Beatbox Wiki et YouTube, dépose les
// photos candidates dans beatbox_artists/review/photos/<clé>/, et c'est
// l'administrateur qui choisit — rien n'arrive dans le jeu sans validation.

const path = require('path');

const ROOT = path.join(__dirname, '..', '..');            // server/
const ARTISTS_DIR = path.join(ROOT, 'beatbox_artists');   // monté par docker compose

module.exports = {
    // ----- Google Sheet (mêmes valeurs que les scripts Python) -----
    CREDENTIALS_FILE: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(ROOT, '..', 'credentials.json'),
    SPREADSHEET_ID: process.env.BATTLE_SHEET_ID || '1TQtZiMrKfIeciuTFCCVlPQygkDtKiGYwycnrdjd-_u0',
    SHEET_NAMES: ['Battles nationales', 'Battles internationales'],

    // ----- Réseau -----
    USER_AGENT: 'BeatBoxGamesBot/1.0 (+https://beatboxgames.com; contact@beatboxgames.com)',
    DELAY_MS: 1200,
    // Le wiki et les CDN d'images encaissent sans peine un rythme plus soutenu ;
    // la recherche YouTube, elle, se ferme vite aux robots trop pressés.
    HOST_DELAYS: {
        'beatbox.world': 1200,
        'beatbox.fandom.com': 400,
        'static.wikia.nocookie.net': 150,
        'world-beatbox-cdn.pivotass.com': 150,
        'www.youtube.com': 2500,
        'i.ytimg.com': 100,
        'yt3.googleusercontent.com': 150,
    },

    // ----- Sélection des candidates -----
    VIDEOS_PER_BEATBOXER: 2,  // vidéos dont on extrait miniature + 3 images clés
    MIN_IMAGE_SIZE: 160,      // px, en dessous la photo est inutilisable en jeu

    // Confiance a priori de chaque source, affinée ensuite par le contexte
    // (pays concordant, nom exact…) puis par la détection de visage.
    CONFIDENCE: {
        beatboxworld: 0.9,
        wiki: 0.85,
        'youtube-avatar': 0.7,
        'youtube-thumbnail': 0.4,
        'youtube-frame': 0.3,
    },

    // ----- Chemins -----
    ARTISTS_DIR,
    BUZZER_DATA_FILE: path.join(ARTISTS_DIR, 'beatboxers.json'),
    REVIEW_DIR: path.join(ARTISTS_DIR, 'review', 'photos'),
    CACHE_DIR: path.join(ARTISTS_DIR, 'review', 'cache'),
};
