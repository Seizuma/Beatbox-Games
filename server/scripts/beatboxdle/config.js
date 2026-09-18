// server/scripts/beatboxdle/config.js
//
// Configuration du pipeline de constitution de la base Beatboxdle.
// Tout ce qui est susceptible de bouger (séries retenues, seuils, chemins)
// est ici : les scripts eux-mêmes n'ont aucune valeur en dur.

const path = require('path');

const ROOT = path.join(__dirname, '..', '..');                    // server/
const DATA_DIR = path.join(ROOT, 'beatbox_artists', 'beatboxdle'); // monté par docker compose

module.exports = {
    // ----- Source -----
    BASE_URL: 'https://beatbox.world',
    // Identifie clairement le robot : si l'auteur du site veut nous joindre ou
    // nous limiter, il sait qui passe. Mets une adresse de contact réelle.
    USER_AGENT: 'BeatBoxGamesBot/1.0 (+https://beatboxgames.com; contact@beatboxgames.com)',
    REQUEST_DELAY_MS: 1200,   // 1 requête toutes les 1,2 s : lent, mais poli
    MAX_RETRIES: 3,
    TIMEOUT_MS: 20000,

    // ----- Périmètre du crawl -----
    // Années balayées sur /events?year=YYYY pour retrouver les éditions.
    YEARS: Array.from({ length: 2027 - 2004 }, (_, i) => 2004 + i),

    // Les deux « majors » qui définissent le roster : GBB et championnat du monde.
    // `match` est testé sur le titre de l'événement, `exclude` le retire.
    MAJOR_SERIES: [
        {
            id: 'gbb',
            label: 'Grand Beatbox Battle',
            match: /grand beatbox battle/i,
            exclude: /second league/i,
        },
        {
            id: 'wbc',
            label: 'Championnat du monde',
            match: /beatbox battle world championship|world beatbox championship/i,
            exclude: null,
        },
    ],

    // ----- Classement des titres (indice « Meilleur titre ») -----
    // `tier` sert au orange (titres équivalents), `id` sert au vert (même titre).
    // Ex. Julard = gbb-champion (tier 6), Alexinho = wbc-champion (tier 6)
    //     -> même tier, id différent -> orange.
    PLACEMENTS: [
        { id: 'champion', tier: 6, match: /champion$/i },
        { id: 'runner-up', tier: 5, match: /runner-?up$/i },
        { id: 'third', tier: 4, match: /3rd place$/i },
        { id: 'semi', tier: 3, match: /semi-?finalist$/i },
        { id: 'quarter', tier: 2, match: /quarter-?finalist$/i },
        { id: 'entrant', tier: 1, match: /top (?:4|8|16|32|64)$|participant$/i },
    ],

    // Libellés français affichés dans la grille d'indices.
    TITLE_LABELS: {
        'wbc-champion': 'Champion du monde',
        'wbc-runner-up': 'Finaliste du championnat du monde',
        'wbc-third': '3e au championnat du monde',
        'wbc-semi': 'Demi-finaliste au championnat du monde',
        'wbc-quarter': 'Quart de finaliste au championnat du monde',
        'wbc-entrant': 'Participant au championnat du monde',
        'gbb-champion': 'Champion GBB',
        'gbb-runner-up': 'Finaliste GBB',
        'gbb-third': '3e au GBB',
        'gbb-semi': 'Demi-finaliste GBB',
        'gbb-quarter': 'Quart de finaliste GBB',
        'gbb-entrant': 'Participant au GBB',
    },

    // ----- Catégories principales -----
    CATEGORY_LABELS: {
        solo: 'Solo',
        loopstation: 'Loopstation',
        'tag-team': 'Tag team',
        crew: 'Crew',
    },
    // Départage quand un beatboxer a autant d'entrées dans deux disciplines.
    CATEGORY_PRIORITY: ['solo', 'loopstation', 'tag-team', 'crew'],

    // ----- Sélection finale -----
    TARGET_SIZE: 420,       // 365 jours + marge pour les retraits manuels
    MIN_SIZE: 365,          // en dessous, validate.js échoue
    LETTERS_MIN: 3,         // longueur de nom jouable en mode lettres
    LETTERS_MAX: 12,

    // ----- Chemins -----
    DATA_DIR,
    CACHE_DIR: path.join(DATA_DIR, 'cache'),
    RAW_DIR: path.join(DATA_DIR, 'raw'),
    ROSTER_FILE: path.join(DATA_DIR, 'raw', 'roster.json'),
    PROFILES_FILE: path.join(DATA_DIR, 'raw', 'profiles.json'),
    DATASET_FILE: path.join(DATA_DIR, 'beatboxdle.json'),
    REPORT_DIR: path.join(DATA_DIR, 'reports'),
    OVERRIDES_FILE: path.join(__dirname, 'overrides.json'),
    // Photos déjà présentes pour le Buzzer Battle : réutilisées pour la révélation.
    BUZZER_DATA_FILE: path.join(ROOT, 'beatbox_artists', 'beatboxers.json'),
};