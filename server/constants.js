/**
 * Configuration centralisée du serveur
 * Support des environnements : production, staging, development
 * ✅ VERSION CORRIGÉE - Erreur CONFIG résolue
 */

// ✅ Détection de l'environnement
const getEnvironment = () => {
    if (process.env.STAGING === 'true') return 'staging';
    if (process.env.NODE_ENV === 'staging') return 'staging';
    if (process.env.NODE_ENV === 'development') return 'development';
    if (process.env.NODE_ENV === 'production') return 'production';
    return 'development';
};

const ENVIRONMENT = getEnvironment();

// ✅ Configuration par environnement
const ENV_CONFIGS = {
    production: {
        BASE_URL: process.env.BASE_URL || 'https://beatboxgames.com',
        CLIENT_URL: process.env.CLIENT_URL || 'https://beatboxgames.com',
        LOG_LEVEL: 'INFO',
        ENABLE_DEBUG: false,
        CONSOLE_LOGS: false
    },
    staging: {
        BASE_URL: process.env.BASE_URL || 'https://dev.beatboxgames.com',
        CLIENT_URL: process.env.CLIENT_URL || 'https://dev.beatboxgames.com',
        LOG_LEVEL: process.env.LOG_LEVEL || 'DEBUG',
        ENABLE_DEBUG: true,
        CONSOLE_LOGS: true
    },
    development: {
        BASE_URL: 'http://localhost:4000',
        CLIENT_URL: 'http://localhost:3000',
        LOG_LEVEL: 'DEBUG',
        ENABLE_DEBUG: true,
        CONSOLE_LOGS: false // désactivé pour dev
    }
};

const ACTIVE_ENV_CONFIG = ENV_CONFIGS[ENVIRONMENT];

const CONFIG = {
    // Informations d'environnement
    ENVIRONMENT,
    IS_PRODUCTION: ENVIRONMENT === 'production',
    IS_STAGING: ENVIRONMENT === 'staging',
    IS_DEVELOPMENT: ENVIRONMENT === 'development',

    // URLs de base selon l'environnement
    BASE_URL: ACTIVE_ENV_CONFIG.BASE_URL,
    CLIENT_URL: ACTIVE_ENV_CONFIG.CLIENT_URL,

    // Configuration des logs selon l'environnement
    LOGGING: {
        LEVEL: ACTIVE_ENV_CONFIG.LOG_LEVEL,
        ENABLE_DEBUG: ACTIVE_ENV_CONFIG.ENABLE_DEBUG,
        CONSOLE_LOGS: ACTIVE_ENV_CONFIG.CONSOLE_LOGS,
        STAGING_EXTRA_LOGS: ENVIRONMENT === 'staging',
        PREFIX: ENVIRONMENT === 'production' ? '🎵 PROD' :
            ENVIRONMENT === 'staging' ? '🔧 DEV' : '💻 LOCAL'
    },

    // Limites du jeu
    LIMITS: {
        ROOM_CODE_LENGTH: 5,
        MIN_PLAYERS_TO_START: 1,
        MAX_PLAYERS_PER_ROOM: 10,
        MIN_PSEUDO_LENGTH: 2,
        MAX_PSEUDO_LENGTH: 30
    },

    // Temps de réponse (réduits en développement)
    ANSWER_TIME: {
        MIN: 5,
        MAX: 60,
        DEFAULT: ENVIRONMENT === 'development' ? 15 : 30
    },

    // Durées audio estimées (en secondes)
    AUDIO_DURATIONS: {
        'Level 1': ENVIRONMENT === 'development' ? 15 : 30,
        'Level 2': ENVIRONMENT === 'development' ? 25 : 45,
        'Level 3': ENVIRONMENT === 'development' ? 35 : 60,
        FALLBACK: ENVIRONMENT === 'development' ? 30 : 60
    },

    // Points par niveau
    POINTS: {
        LEVEL_1: 5,
        LEVEL_2: 3,
        LEVEL_3: 1
    },

    // TIMEOUTS adaptés par environnement
    TIMEOUTS: {
        ROOM_INACTIVITY: ENVIRONMENT === 'development' ? 10 * 60 * 1000 : 60 * 60 * 1000,
        PLAYER_RECONNECTION: ENVIRONMENT === 'development' ? 5 * 60 * 1000 : 15 * 60 * 1000,
        PLAYER_LOBBY_RECONNECTION: ENVIRONMENT === 'development' ? 3 * 60 * 1000 : 10 * 60 * 1000,
        ALL_DISCONNECTED_GRACE: ENVIRONMENT === 'development' ? 2 * 60 * 1000 : 5 * 60 * 1000,
        QUICK_RECONNECTION_GRACE: 60 * 1000,
        GAME_RESET_DELAY: 30 * 1000
    },

    // NETTOYAGE moins fréquent en développement
    CLEANUP: {
        ROOM_CLEANUP_INTERVAL: ENVIRONMENT === 'development' ? 30 * 60 * 1000 : 10 * 60 * 1000,
        STATS_LOG_INTERVAL: ENVIRONMENT === 'development' ? 60 * 60 * 1000 : 15 * 60 * 1000
    },

    // Configuration de reconnexion
    RECONNECTION: {
        MAX_AUTO_RECONNECT: ENVIRONMENT === 'development' ? 10 : 3,
        RECONNECT_DELAYS: ENVIRONMENT === 'development' ?
            [500, 1000, 2000] : [2000, 5000, 10000],
        CONNECTION_TIMEOUT: ENVIRONMENT === 'development' ? 10000 : 30000,
        SESSION_PERSISTENCE: ENVIRONMENT === 'development' ? 60 * 60 * 1000 : 20 * 60 * 1000,
        PLAYER_CLEANUP_DELAY: ENVIRONMENT === 'development' ? 2 * 60 * 1000 : 5 * 60 * 1000
    }
};

// ✅ CORRECTION CRITIQUE : Features de développement définies APRÈS CONFIG
CONFIG.DEV_FEATURES = {
    ENABLE_ADMIN_ENDPOINTS: ENVIRONMENT === 'staging',
    ALLOW_LOCALHOST: ENVIRONMENT !== 'production',
    VERBOSE_SOCKET_LOGS: ENVIRONMENT === 'development',
    ENABLE_TEST_ROUTES: ENVIRONMENT === 'staging',
    DEBUG_ERRORS: ENVIRONMENT === 'staging'
};

// États des rooms
const ROOM_STATES = {
    WAITING: 'waiting',
    STARTING: 'starting',
    PLAYING: 'playing',
    FINISHED: 'finished'
};

// États du jeu
const GAME_STATES = {
    COUNTDOWN: 'countdown',
    LISTENING: 'listening',
    ANSWERING: 'answering',
    RESULTS: 'results'
};

// Modes de jeu
const GAME_MODES = {
    NORMAL: 'normal',
    QUICK: 'quick',
    BUZZER_COUNTRY: 'buzzer_country',
    BUZZER_EVENT: 'buzzer_event'
};

// ✅ NOUVEAU : Configuration Buzzer Battle
// ✅ Configuration Buzzer Battle
const BUZZER_CONFIG = {
    PIXEL_LEVELS: [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0],  // Progression de 100% à 0%
    PIXEL_INTERVAL: 2500,                      // Intervalle total pour -5% (2.5 secondes)
    GUESS_TIME_LIMIT: 10000,                   // Temps pour deviner après avoir buzzé (10 secondes)
    POINTS_FIRST_BUZZ: 100,                    // Points pour avoir buzzé en premier
    POINTS_CORRECT_GUESS: 100,                 // Points pour bonne réponse
    POINTS_PENALTY_WRONG: -100                 // Pénalité pour mauvaise réponse
};

// Configuration par mode de jeu (adaptée par environnement)
const GAME_MODE_SETTINGS = {
    [GAME_MODES.NORMAL]: {
        MIN_ARTISTS: ENVIRONMENT === 'development' ? 3 : 10,
        MAX_ARTISTS: null,
        DEFAULT_ROUNDS: ENVIRONMENT === 'development' ? 5 : 20
    },
    [GAME_MODES.QUICK]: {
        MIN_ARTISTS: ENVIRONMENT === 'development' ? 2 : 5,
        MAX_ARTISTS: ENVIRONMENT === 'development' ? 10 : 20,
        DEFAULT_ROUNDS: ENVIRONMENT === 'development' ? 3 : 10
    }
};

// Messages d'erreur standardisés
const ERROR_MESSAGES = {
    CONNECTION_FAILED: 'Échec de connexion au serveur',
    CONNECTION_TIMEOUT: 'Timeout de connexion - Veuillez réessayer',
    ALREADY_CONNECTED: 'Déjà connecté au serveur',
    SERVER_DISCONNECTED: 'Serveur déconnecté',
    ROOM_NOT_FOUND: 'Room introuvable ou expirée',
    ROOM_FULL: 'Room pleine (maximum 8 joueurs)',
    ROOM_IN_GAME: 'Partie en cours - impossible de rejoindre',
    INVALID_ROOM_CODE: 'Code de room invalide (5 caractères requis)',
    ROOM_EXPIRED: 'Room expirée par inactivité',
    PSEUDO_REQUIRED: 'Pseudo requis',
    PSEUDO_TOO_SHORT: 'Pseudo trop court (minimum 2 caractères)',
    PSEUDO_TOO_LONG: 'Pseudo trop long (maximum 20 caractères)',
    PSEUDO_ALREADY_USED: 'Pseudo déjà utilisé dans cette room',
    PSEUDO_INVALID_CHARS: 'Caractères invalides dans le pseudo',
    NOT_CREATOR: 'Seul le créateur peut effectuer cette action',
    NOT_IN_ROOM: 'Vous n\'êtes pas dans une room',
    GAME_NOT_ACTIVE: 'Aucune partie en cours',
    ALREADY_READY: 'Vous êtes déjà prêt',
    INVALID_ARTIST_COUNT: 'Nombre d\'artistes invalide',
    INVALID_ANSWER_TIME: 'Temps de réponse invalide (5-60 secondes)',
    ALREADY_ANSWERED: 'Vous avez déjà répondu à ce niveau',
    CANNOT_ANSWER: 'Impossible de répondre maintenant',
    SERVER_ERROR: 'Erreur serveur temporaire',
    NETWORK_ERROR: 'Problème de connexion réseau',
    UNKNOWN_ERROR: 'Erreur inconnue'
};

// Configuration des logs avec support multi-environnement
const LOG_CONFIG = {
    LEVELS: {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3
    },

    DEFAULT_LEVEL: ACTIVE_ENV_CONFIG.LOG_LEVEL,

    COLORS: {
        ERROR: '\x1b[31m❌',
        WARN: '\x1b[33m⚠️ ',
        INFO: '\x1b[36m📝',
        DEBUG: '\x1b[90m🔍',
        SUCCESS: '\x1b[32m✅',
        STAGING: '\x1b[35m🔧',
        RESET: '\x1b[0m'
    },

    MODULES: {
        ROOM_MANAGER: 'ROOM_MGR',
        GAME_MANAGER: 'GAME_MGR',
        AUDIO_MANAGER: 'AUDIO_MGR',
        SOCKET_HANDLER: 'SOCKET',
        CLEANUP: 'CLEANUP',
        ENV: 'ENVIRONMENT'
    }
};

// Configuration de reconnexion
const RECONNECTION_CONFIG = {
    STRATEGIES: {
        QUICK: {
            maxAttempts: 3,
            delays: [1000, 2000, 3000],
            timeout: 10000
        },
        STANDARD: {
            maxAttempts: 5,
            delays: [2000, 5000, 10000, 15000, 30000],
            timeout: 30000
        },
        PERSISTENT: {
            maxAttempts: 10,
            delays: [1000, 2000, 5000, 10000, 15000, 30000, 60000],
            timeout: 60000
        }
    },
    CONDITIONS: {
        QUICK: ['network_glitch', 'temporary_disconnect'],
        STANDARD: ['user_disconnect', 'browser_refresh'],
        PERSISTENT: ['room_creator', 'game_in_progress']
    }
};

// Log de démarrage avec informations d'environnement
if (CONFIG.LOGGING.CONSOLE_LOGS && CONFIG.IS_STAGING) {
    console.log(`${LOG_CONFIG.COLORS.SUCCESS} BeatBox Games Server`);
    console.log(`${LOG_CONFIG.COLORS.INFO} Environment: ${ENVIRONMENT}`);
    console.log(`${LOG_CONFIG.COLORS.INFO} Base URL: ${CONFIG.BASE_URL}`);
    console.log(`${LOG_CONFIG.COLORS.INFO} Client URL: ${CONFIG.CLIENT_URL}`);
    console.log(`${LOG_CONFIG.COLORS.INFO} Debug Mode: ${CONFIG.DEV_FEATURES.DEBUG_ERRORS}`);
    console.log(`${LOG_CONFIG.COLORS.RESET}`);
}


module.exports = {
    CONFIG,
    ROOM_STATES,
    BUZZER_CONFIG,
    GAME_STATES,
    GAME_MODES,
    GAME_MODE_SETTINGS,
    ERROR_MESSAGES,
    LOG_CONFIG,
    RECONNECTION_CONFIG,
    ENVIRONMENT
};