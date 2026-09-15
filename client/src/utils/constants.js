/**
 * Constantes de l'application
 * Centralisées pour éviter la duplication et faciliter la maintenance
 */

export const VIEWS = {
    LOADING: 'loading',
    CREATE: 'create',
    LOBBY: 'lobby',
    GAME: 'game',
    RESULTS: 'results',
    ERROR: 'error'
};

export const STORAGE_KEYS = {
    USER_SESSION: 'beatbox_user_session',
    AUDIO_VOLUME: 'beatbox_audio_volume'
};

export const AUDIO_SETTINGS = {
    DEFAULT_VOLUME: 0.7,
    COUNTDOWN_READY_VOLUME_MULTIPLIER: 0.8,
    COUNTDOWN_GO_VOLUME_MULTIPLIER: 0.9,
    TENSION_VOLUME_MULTIPLIER: 0.25
};

export const SESSION_SETTINGS = {
    MAX_AGE: 5 * 60 * 1000, // 5 minutes
    MAX_RECENT_AGE: 2 * 60 * 1000 // 2 minutes pour auto-join
};

export const GAME_SETTINGS = {
    DEFAULT_ARTIST_COUNT: 10,
    DEFAULT_ANSWER_TIME: 30,
    ARTIST_COUNT_RANGE: { min: 10, max: 50 },
    ANSWER_TIME_RANGE: { min: 5, max: 60 }
};

export const BROWSER_DETECTION = {
    isFirefox: typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('firefox')
};

export const URLS = {
    BASE_URL: "https://beatboxgames.com/#/blindtest-online"
};