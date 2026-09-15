/**
 * Service de validation des réponses
 * ✅ Version sécurisée avec protection anti-triche Discord
 */

const { normalize } = require('../utils');

const ALTERNATIVE_ANSWERS = {
    // A
    "AelMight": ["Ael", "Ael Might", "Gio Melchior"],

    // B

    "Ball-Zee": ["Ball Zee", "Ballzee"],

    // C
    "Chris TheOdian": ["Chris The Odian", "ChrisTheOdian"],
    // D
    "D-low": ["Dlow", "D low"],

    "Dr Koopa": ["Koopa"],

    // E

    // F,

    // G
    "Gene Shinozaki": ["Gene"],

    "Gene": ["Gene Shinozaki"],
    // H
    "Petr Sarancha (Helium)": ["Petr Sarancha", "Helium"],

    // I
    "Jarno Ibarra": ["Ibarra"],
    // K
    "King Inertia": ["Inertia"],

    // L

    // M
    "me0ne": ["Meone"],

    // N

    // P

    // R

    // S

    "Show-Go": ["Show Go", "Showgo"],

    // T

    // V
    "Saint Villain": ["Villain"],

    // W

    // Y
    "YA NA HA": ["YANAHA"],

    // Z
    "Zer0": ["Zero"],

};

/**
 * ✅ NOUVEAU : Récupère toutes les réponses acceptables pour un artiste
 * @param {string} artistName - Nom officiel de l'artiste
 * @returns {Array} - Liste des réponses acceptables (incluant le nom officiel)
 */
function getAcceptableAnswers(artistName) {
    if (!artistName) return [];

    const acceptable = [artistName];

    // Ajouter les alternatives du dictionnaire
    if (ALTERNATIVE_ANSWERS[artistName]) {
        acceptable.push(...ALTERNATIVE_ANSWERS[artistName]);
    }

    // Ajouter les variations automatiques (The, &, etc.)
    const autoVariations = getArtistVariations(artistName);
    acceptable.push(...autoVariations);

    return [...new Set(acceptable)]; // Supprimer les doublons
}

/**
 * Vérifie si une réponse est correcte
 * @param {string} userAnswer - Réponse de l'utilisateur
 * @param {string} correctAnswer - Réponse correcte (nom de l'artiste)
 * @returns {boolean} - True si la réponse est correcte
 */
function isAnswerCorrect(userAnswer, correctAnswer) {
    if (!userAnswer || !correctAnswer) return false;

    const normalizedUser = normalize(userAnswer);
    const normalizedCorrect = normalize(correctAnswer);

    if (!normalizedUser || !normalizedCorrect) return false;

    // ✅ NOUVEAU : Vérifier d'abord les réponses alternatives
    const acceptableAnswers = getAcceptableAnswers(correctAnswer);
    for (const acceptable of acceptableAnswers) {
        const normalizedAcceptable = normalize(acceptable);

        // Correspondance exacte avec une alternative
        if (normalizedUser === normalizedAcceptable) {
            console.log(`✅ Réponse alternative acceptée: "${userAnswer}" pour "${correctAnswer}"`);
            return true;
        }

        // Correspondance partielle avec une alternative (tolérance de typo)
        if (levenshteinDistance(normalizedUser, normalizedAcceptable) <= 1) {
            console.log(`✅ Réponse alternative (typo) acceptée: "${userAnswer}" pour "${correctAnswer}"`);
            return true;
        }
    }

    // Correspondance partielle (au moins 80% des mots)
    const userWords = normalizedUser.split(' ').filter(w => w.length > 0);
    const correctWords = normalizedCorrect.split(' ').filter(w => w.length > 0);

    if (userWords.length === 0 || correctWords.length === 0) return false;

    // ✅ PROTECTION INTELLIGENTE : Adapter le minimum requis selon la longueur du nom correct
    // Si le nom correct est court (≤ 3 caractères), accepter les réponses courtes
    // Sinon, exiger au moins 40% du nom ou minimum 3 caractères
    let minLength;
    if (normalizedCorrect.length <= 3) {
        // Noms courts comme "K", "3H", "DC" → accepter 1+ caractères
        minLength = 1;
    } else if (normalizedCorrect.length <= 5) {
        // Noms moyens comme "Wing", "Dlow" → accepter 2+ caractères
        minLength = 2;
    } else {
        // Noms longs → exiger au moins 3 caractères OU 40% du nom
        minLength = Math.max(3, Math.floor(normalizedCorrect.length * 0.4));
    }

    if (normalizedUser.length < minLength) {
        console.log(`❌ Réponse trop courte: "${userAnswer}" pour "${correctAnswer}" (min: ${minLength} caractères)`);
        return false;
    }

    // Vérifier si au moins 80% des mots correspondent
    let matchCount = 0;
    userWords.forEach(userWord => {
        if (correctWords.some(correctWord => {
            // ✅ Correspondance exacte d'un mot
            if (userWord === correctWord) {
                return true;
            }

            // ✅ Pour les noms courts (≤3 caractères), accepter la correspondance partielle
            if (correctWord.length <= 3) {
                if (correctWord.includes(userWord) || userWord.includes(correctWord)) {
                    return true;
                }
            }

            // ✅ Pour les noms longs, exiger au moins 3 caractères pour la correspondance partielle
            if (correctWord.length > 3) {
                if (correctWord.includes(userWord) && userWord.length >= 3) {
                    return true;
                }
                if (userWord.includes(correctWord) && correctWord.length >= 3) {
                    return true;
                }
            }

            // ✅ Tolérance typo (1 caractère de différence)
            if (levenshteinDistance(userWord, correctWord) <= 1) {
                return true;
            }

            return false;
        })) {
            matchCount++;
        }
    });

    const matchPercentage = matchCount / Math.max(userWords.length, correctWords.length);
    return matchPercentage >= 0.8;
}

/**
 * Calcule la distance de Levenshtein entre deux mots
 */
function levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + cost
            );
        }
    }

    return matrix[str2.length][str1.length];
}

/**
 * ✅ NOUVEAU : Validation sécurisée avec protection Discord
 * Vérifie qu'une réponse provient du bon utilisateur Discord
 */
function validateSecureAnswer(answerData) {
    const { userAnswer, correctAnswer, pseudo, discordId, socketDiscordId, isDiscordUser } = answerData;

    // Validation basique de la réponse
    const isCorrect = isAnswerCorrect(userAnswer, correctAnswer);

    // ✅ SÉCURITÉ DISCORD : Vérifier l'identité
    let securityChecks = {
        isCorrect,
        answerValid: true,
        identityValid: true,
        securityFlags: []
    };

    // Si l'utilisateur prétend être Discord, vérifier l'ID
    if (isDiscordUser) {
        if (!discordId || !socketDiscordId) {
            securityChecks.identityValid = false;
            securityChecks.securityFlags.push('MISSING_DISCORD_ID');
        } else if (discordId !== socketDiscordId) {
            securityChecks.identityValid = false;
            securityChecks.securityFlags.push('DISCORD_ID_MISMATCH');
        }
    }

    // Validation supplémentaire : réponse suspecte
    if (userAnswer.length > 100) {
        securityChecks.securityFlags.push('ANSWER_TOO_LONG');
    }

    if (userAnswer.includes(correctAnswer) && userAnswer.length > correctAnswer.length * 2) {
        securityChecks.securityFlags.push('SUSPICIOUS_ANSWER_PATTERN');
    }

    return securityChecks;
}

/**
 * ✅ NOUVEAU : Anti-spam et limitation de taux
 */
class AnswerLimiter {
    constructor() {
        this.playerAnswers = new Map(); // pseudo -> { count, lastAnswer, timestamps }
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Nettoyer toutes les minutes
    }

    /**
     * Vérifie si un joueur peut soumettre une réponse
     */
    canSubmitAnswer(pseudo, discordId = null) {
        const key = discordId || pseudo;
        const now = Date.now();
        const playerData = this.playerAnswers.get(key) || {
            count: 0,
            lastAnswer: 0,
            timestamps: []
        };

        // Limite de temps entre réponses (anti-spam)
        if (now - playerData.lastAnswer < 1000) { // 1 seconde minimum
            return { allowed: false, reason: 'TOO_FAST' };
        }

        // Limite de réponses par minute
        const recentAnswers = playerData.timestamps.filter(t => now - t < 60000);
        if (recentAnswers.length >= 10) {
            return { allowed: false, reason: 'RATE_LIMIT' };
        }

        return { allowed: true };
    }

    /**
     * Enregistre une réponse soumise
     */
    recordAnswer(pseudo, discordId = null) {
        const key = discordId || pseudo;
        const now = Date.now();
        const playerData = this.playerAnswers.get(key) || {
            count: 0,
            lastAnswer: 0,
            timestamps: []
        };

        playerData.count++;
        playerData.lastAnswer = now;
        playerData.timestamps.push(now);

        // Garder seulement les timestamps des 5 dernières minutes
        playerData.timestamps = playerData.timestamps.filter(t => now - t < 300000);

        this.playerAnswers.set(key, playerData);
    }

    /**
     * Nettoie les anciennes données
     */
    cleanup() {
        const now = Date.now();
        for (const [key, data] of this.playerAnswers.entries()) {
            // Supprimer les entrées inactives depuis plus de 10 minutes
            if (now - data.lastAnswer > 600000) {
                this.playerAnswers.delete(key);
            }
        }
    }

    /**
     * Reset pour un joueur spécifique
     */
    resetPlayer(pseudo, discordId = null) {
        const key = discordId || pseudo;
        this.playerAnswers.delete(key);
    }

    /**
     * Obtient les stats d'un joueur
     */
    getPlayerStats(pseudo, discordId = null) {
        const key = discordId || pseudo;
        const playerData = this.playerAnswers.get(key);

        if (!playerData) {
            return { totalAnswers: 0, lastAnswer: null, recentActivity: [] };
        }

        const now = Date.now();
        const recentAnswers = playerData.timestamps.filter(t => now - t < 300000); // 5 minutes

        return {
            totalAnswers: playerData.count,
            lastAnswer: new Date(playerData.lastAnswer),
            recentAnswers: recentAnswers.length,
            averageInterval: recentAnswers.length > 1 ?
                (recentAnswers[recentAnswers.length - 1] - recentAnswers[0]) / (recentAnswers.length - 1) : 0
        };
    }

    /**
     * Détection de comportement suspect
     */
    detectSuspiciousActivity(pseudo, discordId = null) {
        const stats = this.getPlayerStats(pseudo, discordId);
        const suspiciousFlags = [];

        // Réponses trop fréquentes
        if (stats.recentAnswers > 8) {
            suspiciousFlags.push('HIGH_FREQUENCY');
        }

        // Intervalle trop régulier (bot détection)
        if (stats.averageInterval > 0 && stats.averageInterval < 2000 && stats.recentAnswers > 3) {
            suspiciousFlags.push('REGULAR_INTERVAL');
        }

        return {
            isSuspicious: suspiciousFlags.length > 0,
            flags: suspiciousFlags,
            stats
        };
    }
}

// Instance globale du limiteur
const answerLimiter = new AnswerLimiter();

/**
 * Fonctions utilitaires pour les artistes
 */
function getArtistVariations(artistName) {
    if (!artistName) return [];

    const variations = [artistName.toLowerCase()];

    // Supprimer "the" au début
    if (artistName.toLowerCase().startsWith('the ')) {
        variations.push(artistName.slice(4).toLowerCase());
    }

    // Ajouter variantes avec "the"
    if (!artistName.toLowerCase().startsWith('the ')) {
        variations.push('the ' + artistName.toLowerCase());
    }

    // Remplacer & par "and" et vice versa
    if (artistName.includes('&')) {
        variations.push(artistName.replace(/&/g, 'and').toLowerCase());
    }
    if (artistName.includes('and')) {
        variations.push(artistName.replace(/and/g, '&').toLowerCase());
    }

    return variations;
}

/**
 * Normalisation avancée pour les noms d'artistes
 */
function normalizeArtistName(name) {
    if (!name) return '';

    return name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
        .replace(/[^\w\s]/g, ' ') // Remplacer la ponctuation par des espaces
        .replace(/\s+/g, ' ') // Normaliser les espaces multiples
        .trim();
}

/**
 * Fonction principale d'export avec toutes les vérifications de sécurité
 */
function processAnswerWithSecurity(answerData) {
    const { userAnswer, correctAnswer, pseudo, discordId, socketDiscordId, isDiscordUser } = answerData;

    // 1. Vérifier les limites de taux
    const rateLimitCheck = answerLimiter.canSubmitAnswer(pseudo, discordId);
    if (!rateLimitCheck.allowed) {
        return {
            success: false,
            reason: 'RATE_LIMITED',
            details: rateLimitCheck.reason
        };
    }

    // 2. Détecter l'activité suspecte
    const suspiciousActivity = answerLimiter.detectSuspiciousActivity(pseudo, discordId);
    if (suspiciousActivity.isSuspicious) {
        console.warn(`🚫 Activité suspecte détectée pour ${pseudo}:`, suspiciousActivity.flags);
    }

    // 3. Validation sécurisée
    const securityCheck = validateSecureAnswer(answerData);

    if (!securityCheck.identityValid) {
        return {
            success: false,
            reason: 'IDENTITY_INVALID',
            details: securityCheck.securityFlags
        };
    }

    // 4. Enregistrer la réponse
    answerLimiter.recordAnswer(pseudo, discordId);

    // 5. Retourner le résultat
    return {
        success: true,
        isCorrect: securityCheck.isCorrect,
        securityFlags: securityCheck.securityFlags,
        suspiciousActivity: suspiciousActivity.isSuspicious ? suspiciousActivity.flags : null
    };
}

module.exports = {
    isAnswerCorrect,
    validateSecureAnswer,
    processAnswerWithSecurity,
    AnswerLimiter,
    answerLimiter,
    normalizeArtistName,
    getArtistVariations,
    getAcceptableAnswers,      // ✅ NOUVEAU
    ALTERNATIVE_ANSWERS         // ✅ NOUVEAU (pour pouvoir le modifier si besoin)
};