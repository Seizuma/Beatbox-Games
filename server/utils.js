/**
 * Utilitaires du serveur
 * Fonctions d'aide réutilisables
 */

/**
 * Normalise une chaîne pour la comparaison (existant)
 */
function normalize(str) {
    if (!str) return '';

    return str.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
        .replace(/['']/g, '') // Supprimer les apostrophes
        .replace(/[.]/g, '') // Supprimer les points (Mr. → mr)
        .replace(/[-_]/g, ' ') // Remplacer tirets et underscores par espaces
        .replace(/[^a-z0-9\s]/g, '') // Supprimer toute autre ponctuation
        .replace(/\s+/g, ' ') // Normaliser les espaces multiples
        .trim();
}

/**
 * ✅ NOUVEAU : Valide un pseudo
 */
function validatePseudo(pseudo) {
    if (!pseudo || typeof pseudo !== 'string') {
        return { valid: false, reason: 'Pseudo manquant' };
    }

    const cleaned = pseudo.trim();

    if (cleaned.length < 2) {
        return { valid: false, reason: 'Pseudo trop court (minimum 2 caractères)' };
    }

    if (cleaned.length > 20) {
        return { valid: false, reason: 'Pseudo trop long (maximum 20 caractères)' };
    }

    // Vérifier les caractères autorisés
    const allowedCharsRegex = /^[a-zA-Z0-9\s\-_À-ÿ]+$/;
    if (!allowedCharsRegex.test(cleaned)) {
        return { valid: false, reason: 'Caractères non autorisés dans le pseudo' };
    }

    return { valid: true, cleaned };
}

/**
 * ✅ NOUVEAU : Valide un code de room
 */
function validateRoomCode(code) {
    if (!code || typeof code !== 'string') {
        return { valid: false, reason: 'Code room manquant' };
    }

    const cleaned = code.toUpperCase().trim();

    if (cleaned.length !== 5) {
        return { valid: false, reason: 'Code room doit faire 5 caractères' };
    }

    const allowedCharsRegex = /^[A-Z0-9]+$/;
    if (!allowedCharsRegex.test(cleaned)) {
        return { valid: false, reason: 'Code room invalide' };
    }

    return { valid: true, cleaned };
}

/**
 * ✅ NOUVEAU : Formatage des durées
 */
function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}min`;
    } else if (minutes > 0) {
        return `${minutes}min ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * ✅ NOUVEAU : Calcul de pourcentage
 */
function calculatePercentage(value, total, decimals = 1) {
    if (total === 0) return 0;
    return Number(((value / total) * 100).toFixed(decimals));
}

/**
 * ✅ NOUVEAU : Génération d'ID unique
 */
function generateId(prefix = '', length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = prefix;

    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
}

/**
 * ✅ NOUVEAU : Debounce pour éviter le spam
 */
function createDebounce(delay = 1000) {
    const lastCalls = new Map();

    return function debounce(key, callback) {
        const now = Date.now();
        const lastCall = lastCalls.get(key);

        if (!lastCall || now - lastCall > delay) {
            lastCalls.set(key, now);
            return callback();
        }

        return false; // Appel bloqué
    };
}

/**
 * ✅ NOUVEAU : Logger structuré
 */
function createLogger(context = 'SERVER') {
    return {
        info: (message, data = {}) => {
            console.log(`ℹ️ [${context}] ${message}`, data);
        },

        success: (message, data = {}) => {
            console.log(`✅ [${context}] ${message}`, data);
        },

        warning: (message, data = {}) => {
            console.warn(`⚠️ [${context}] ${message}`, data);
        },

        error: (message, error = null, data = {}) => {
            console.error(`❌ [${context}] ${message}`, { error, ...data });
        },

        debug: (message, data = {}) => {
            if (process.env.NODE_ENV === 'development') {
                console.log(`🐛 [${context}] ${message}`, data);
            }
        }
    };
}

/**
 * ✅ NOUVEAU : Limitation de taux (rate limiting)
 */
function createRateLimiter(maxAttempts = 5, windowMs = 60000) {
    const attempts = new Map();

    return function rateLimit(key) {
        const now = Date.now();
        const userAttempts = attempts.get(key) || [];

        // Nettoyer les tentatives anciennes
        const validAttempts = userAttempts.filter(time => now - time < windowMs);

        if (validAttempts.length >= maxAttempts) {
            return {
                allowed: false,
                resetTime: Math.min(...validAttempts) + windowMs,
                remaining: 0
            };
        }

        validAttempts.push(now);
        attempts.set(key, validAttempts);

        return {
            allowed: true,
            remaining: maxAttempts - validAttempts.length
        };
    };
}

/**
 * ✅ NOUVEAU : Utilitaires de sécurité
 */
const security = {
    // Nettoie une entrée utilisateur
    sanitizeInput: (input) => {
        if (typeof input !== 'string') return '';
        return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    },

    // Vérifie si une IP est en liste noire (exemple)
    isBlacklisted: (ip) => {
        const blacklist = process.env.IP_BLACKLIST?.split(',') || [];
        return blacklist.includes(ip);
    },

    // Hash simple pour les mots de passe admin
    simpleHash: (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }
};

/**
 * ✅ NOUVEAU : Statistiques en temps réel
 */
function createStatsCollector() {
    const stats = {
        requests: 0,
        errors: 0,
        startTime: Date.now(),
        roomsCreated: 0,
        gamesPlayed: 0,
        playersTotal: 0
    };

    return {
        increment: (key) => {
            if (stats.hasOwnProperty(key)) {
                stats[key]++;
            }
        },

        get: () => ({
            ...stats,
            uptime: Date.now() - stats.startTime,
            avgRequestsPerMinute: Math.round(stats.requests / ((Date.now() - stats.startTime) / 60000))
        }),

        reset: () => {
            Object.keys(stats).forEach(key => {
                if (key !== 'startTime') stats[key] = 0;
            });
        }
    };
}

module.exports = {
    normalize,
    validatePseudo,
    validateRoomCode,
    formatDuration,
    calculatePercentage,
    generateId,
    createDebounce,
    createLogger,
    createRateLimiter,
    security,
    createStatsCollector
};