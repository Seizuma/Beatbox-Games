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
            // L'« Online World Beatbox Championship » (OWBC) est un autre
            // événement : il compte comme battle international, pas comme le mondial.
            exclude: /\bonline\b|\bowbc\b/i,
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

    // ----- Palmarès élargi (indice « Meilleur titre ») -----
    // Le roster reste défini par les majors, mais le titre affiché peut venir
    // de n'importe quel événement : « Top 8 mondial » dit moins de MaxO que
    // « champion d'Europe ». Voir titles.js pour le calcul.
    //
    // Poids d'un titre = niveau × placement × discipline × catégorie annexe,
    // puis bonus de répétition (triple champion national) et de double source.
    TITLE_LEVEL_WEIGHTS: {
        wbc: 100,
        gbb: 100,
        continental: 70,  // European / Asia / African… Beatbox Championship
        intl: 50,         // grands battles internationaux (liste ci-dessous)
        national: 40,     // championnat d'un pays
        other: 20,        // tout le reste, à classer si un titre en dépend
    },
    TITLE_PLACEMENT_FACTORS: {
        champion: 1,
        'runner-up': 0.7,
        third: 0.6,
        semi: 0.5,
        quarter: 0.35,
        entrant: 0.2,
    },
    TITLE_DISCIPLINE_FACTORS: { solo: 1, loopstation: 0.85, 'tag-team': 0.8, crew: 0.7 },
    // Catégories annexes d'un grand événement : 7 To Smoke du GBB, Draft…
    TITLE_SIDE_CATEGORY: { match: /7 ?to ?smoke|shootout|draft|showcase|battle royale|vocobox|world cup|crowd/i, factor: 0.6 },
    TITLE_REPEAT_BONUS: 0.1,    // par titre identique supplémentaire (autre année)
    TITLE_REPEAT_MAX: 3,        // bonus plafonné à +30 %
    TITLE_CONFIRMED_BONUS: 0.05, // titre présent sur beatbox.world ET au wiki

    // Ni des titres ni des participations : qualifications, soirées annexes.
    TITLE_EXCLUDED_EVENTS: /qualif|wild ?card|try-?out|audition|preliminar|\bdivision\b|\bregional\b|elimination round/i,
    TITLE_SIDE_EVENTS: /after ?party|warm-?up|open mic|side battle|fan battle/i,

    // Grands battles internationaux hors championnats officiels. La liste se
    // complète avec reports/evenements-non-classes.csv (écrit par enrich.js).
    TITLE_INTL_EVENTS: new RegExp([
        'swissbeatbox', 'beatbox masters', 'one ?one battle', 'florida beatbox', 'vokal ?total',
        'world beatbox camp', 'sbx camp', 'great north battle', 'la cup', 'bayreuth beatbox battle',
        'multiverse beatbox battle', 'beatbox of the year', 'nothing ?2 ?looz', '7 ?to ?smoke', 'die to die',
        'vocal combat', 'clip\\b.*loop ?station', 'haten', 'owbc', 'sbx kickback', 'draft tag team',
        'all star beatbox', 'online world beatbox', 'lyon beatbox battle', 'beatbox battle tv', 'mascaret beatbox battle',
        'maestro beatbox', 'astro beatbox battle', 'nue beatbox battle', 'balkan beatbox',
        'king of the beats?', 'tag team beatbox championship', 'world loop ?station',
    ].join('|'), 'i'),

    // ----- Catégories principales -----
    CATEGORY_LABELS: {
        solo: 'Solo',
        loopstation: 'Loopstation',
        'tag-team': 'Tag team',
        crew: 'Crew',
    },
    // Départage quand un beatboxer a autant d'entrées dans deux disciplines.
    CATEGORY_PRIORITY: ['solo', 'loopstation', 'tag-team', 'crew'],

    TARGET_SIZE: 500,       // plafond ; on garde tout ce qui est jouable
    MIN_SIZE: 120,          // v1 : cycle d'environ quatre mois. En dessous, validate.js échoue
    LETTERS_MIN: 3,         // longueur de nom jouable en mode lettres
    LETTERS_MAX: 12,
    // Une longueur n'est tirable que s'il existe assez d'autres noms de la même
    // longueur à proposer. Doit rester aligné sur BEATBOXDLE_MIN_CANDIDATES,
    // le seuil appliqué par beatboxdle-daily.js au moment du tirage.
    LETTERS_MIN_CANDIDATES: 12,

    // ----- Chemins -----
    DATA_DIR,
    CACHE_DIR: path.join(DATA_DIR, 'cache'),
    RAW_DIR: path.join(DATA_DIR, 'raw'),
    ROSTER_FILE: path.join(DATA_DIR, 'raw', 'roster.json'),
    PROFILES_FILE: path.join(DATA_DIR, 'raw', 'profiles.json'),
    WIKI_FILE: path.join(DATA_DIR, 'raw', 'wiki.json'),
    // Propositions de titres en attente de revue (écrit par enrich.js) et
    // décisions de l'administrateur (lues par build.js).
    TITLE_PROPOSALS_FILE: path.join(ROOT, 'beatbox_artists', 'review', 'titles.json'),
    REVIEWED_TITLES_FILE: path.join(DATA_DIR, 'reviewed-titles.json'),
    DATASET_FILE: path.join(DATA_DIR, 'beatboxdle.json'),
    REPORT_DIR: path.join(DATA_DIR, 'reports'),
    OVERRIDES_FILE: path.join(__dirname, 'overrides.json'),
    // Photos déjà présentes pour le Buzzer Battle : réutilisées pour la révélation.
    BUZZER_DATA_FILE: path.join(ROOT, 'beatbox_artists', 'beatboxers.json'),
};
