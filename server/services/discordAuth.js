// services/discordAuth.js
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { CONFIG } = require('../constants');


class DiscordAuthService {
    constructor() {
        this.clientId = process.env.DISCORD_CLIENT_ID;
        this.clientSecret = process.env.DISCORD_CLIENT_SECRET;
        this.redirectUri = process.env.DISCORD_REDIRECT_URI || `${CONFIG.BASE_URL}/auth/discord/callback`;
        this.jwtSecret = process.env.JWT_SECRET;

        if (!this.jwtSecret || this.jwtSecret.length < 32) {
            throw new Error(
                'JWT_SECRET absent ou trop court (32 caractères minimum). ' +
                'Définis-le dans le fichier .env de l\'environnement avant de démarrer le serveur.'
            );
        }

        // Base URLs Discord
        this.discordApiBase = 'https://discord.com/api/v10';
        this.discordOAuthBase = 'https://discord.com/api/oauth2';

        // Cache des utilisateurs en mémoire (en production, utilisez Redis/DB)
        this.userCache = new Map();
        this.userStats = new Map(); // Stockage des stats utilisateur
    }

    /**
     * Génère l'URL d'autorisation Discord
     */
    getAuthUrl(state = null) {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: 'identify guilds',
            state: state || this.generateState()
        });

        return `${this.discordOAuthBase}/authorize?${params.toString()}`;
    }

    /**
     * Génère un state aléatoire pour la sécurité OAuth
     */
    generateState() {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }

    /**
     * Échange le code d'autorisation contre un token d'accès
     */
    async exchangeCodeForToken(code) {
        try {
            const payload = new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: this.redirectUri
            });

            console.log('🔹 Exchange code payload:', payload.toString());

            const response = await axios.post(
                `${this.discordOAuthBase}/token`,
                payload.toString(),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                }
            );

            console.log('✅ Token obtenu:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Erreur lors de l\'échange du code:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers
            });
            throw new Error('Impossible d\'obtenir le token Discord');
        }
    }

    async getUserInfo(accessToken) {
        try {
            console.log('🔹 Récupération infos utilisateur avec token:', accessToken);

            const response = await axios.get(`${this.discordApiBase}/users/@me`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            console.log('✅ Infos utilisateur récupérées:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Erreur lors de la récupération des infos utilisateur:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers
            });
            throw new Error('Impossible de récupérer les informations utilisateur');
        }
    }

    /**
     * Récupère les serveurs Discord de l'utilisateur
     */
    async getUserGuilds(accessToken) {
        try {
            const response = await axios.get(`${this.discordApiBase}/users/@me/guilds`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return response.data;
        } catch (error) {
            console.error('Erreur lors de la récupération des serveurs:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Génère un JWT pour l'utilisateur authentifié
     */
    generateJWT(discordUser, guilds = []) {
        const payload = {
            discordId: discordUser.id,
            username: discordUser.username,
            discriminator: discordUser.discriminator,
            avatar: discordUser.avatar,
            email: discordUser.email,
            guilds: guilds.map(guild => ({
                id: guild.id,
                name: guild.name,
                icon: guild.icon
            })),
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 jours
        };

        return jwt.sign(payload, this.jwtSecret);
    }

    /**
     * Vérifie et décode un JWT
     */
    verifyJWT(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            throw new Error('Token invalide ou expiré');
        }
    }

    /**
     * Met à jour le cache utilisateur
     */
    updateUserCache(discordId, userData) {
        this.userCache.set(discordId, {
            ...userData,
            lastSeen: new Date(),
            cacheTime: Date.now()
        });
    }

    /**
     * Récupère un utilisateur du cache
     */
    getUserFromCache(discordId) {
        const user = this.userCache.get(discordId);
        if (user && (Date.now() - user.cacheTime) < 3600000) { // Cache 1h
            return user;
        }
        return null;
    }

    /**
     * Enregistre les statistiques de jeu pour un utilisateur
     */
    updateUserStats(discordId, gameStats) {
        const existing = this.userStats.get(discordId) || {
            totalGames: 0,
            totalCorrect: 0,
            totalAnswers: 0,
            bestStreak: 0,
            favoriteArtists: {},
            lastPlayed: null
        };

        // Mise à jour des stats
        existing.totalGames++;
        existing.totalCorrect += gameStats.correct || 0;
        existing.totalAnswers += gameStats.total || 0;
        existing.bestStreak = Math.max(existing.bestStreak, gameStats.streak || 0);
        existing.lastPlayed = new Date();

        // Compter les artistes favoris
        if (gameStats.artistsPlayed) {
            gameStats.artistsPlayed.forEach(artist => {
                existing.favoriteArtists[artist] = (existing.favoriteArtists[artist] || 0) + 1;
            });
        }

        this.userStats.set(discordId, existing);
        return existing;
    }

    async updateGameStats(discordId, gameStats) {
        try {
            if (!discordId || !gameStats) {
                throw new Error('Discord ID et données de statistiques requis');
            }

            let currentStats = this.userStats.get(discordId) || this.getDefaultStats();

            // Mise à jour cumulative des statistiques
            const updatedStats = {
                totalGames: currentStats.totalGames + (gameStats.totalGames || 0),
                totalCorrect: currentStats.totalCorrect + (gameStats.totalCorrect || 0),
                totalAnswers: currentStats.totalAnswers + (gameStats.totalAnswers || 0),
                bestStreak: Math.max(currentStats.bestStreak, gameStats.bestStreak || 0),
                lastPlayed: gameStats.timestamp || new Date().toISOString(),

                // Historique des parties
                gamesHistory: [
                    ...(currentStats.gamesHistory || []).slice(-49), // Garder les 49 dernières
                    {
                        date: gameStats.timestamp || new Date().toISOString(),
                        score: gameStats.playerScore || 0,
                        rank: gameStats.finalRank || 0,
                        totalPlayers: gameStats.totalPlayers || 0,
                        gameMode: gameStats.gameMode || 'normal',
                        correctAnswers: gameStats.totalCorrect || 0
                    }
                ]
            };

            // Sauvegarder dans le cache
            this.userStats.set(discordId, updatedStats);

            console.log(`📊 Stats mises à jour pour ${discordId}:`, {
                games: updatedStats.totalGames,
                correct: updatedStats.totalCorrect,
                answers: updatedStats.totalAnswers,
                streak: updatedStats.bestStreak
            });

            return updatedStats;

        } catch (error) {
            console.error('Erreur mise à jour stats Discord:', error);
            throw error;
        }
    }
    getDefaultStats() {
        return {
            totalGames: 0,
            totalCorrect: 0,
            totalAnswers: 0,
            bestStreak: 0,
            favoriteArtists: {},
            gamesHistory: [],
            lastPlayed: null
        };
    }

    /**
     * Récupère les statistiques d'un utilisateur
     */
    async getUserStats(discordId) {
        try {
            const stats = this.userStats.get(discordId) || this.getDefaultStats();

            // Calculs dérivés
            const winRate = stats.totalAnswers > 0
                ? Math.round((stats.totalCorrect / stats.totalAnswers) * 100)
                : 0;

            return {
                ...stats,
                winRate,
                averageScore: stats.totalGames > 0
                    ? Math.round(stats.totalCorrect / stats.totalGames * 10) / 10
                    : 0
            };

        } catch (error) {
            console.error('Erreur récupération stats:', error);
            return this.getDefaultStats();
        }
    }

    /**
     * Récupère le classement des utilisateurs
     */
    async getLeaderboard(limit = 10) {
        try {
            const allStats = Array.from(this.userStats.entries())
                .map(([discordId, stats]) => {
                    const user = this.getUserFromCache(discordId);
                    if (!user || stats.totalGames === 0) return null;

                    return {
                        discordId,
                        username: user.username,
                        discriminator: user.discriminator,
                        avatar: user.avatar,
                        totalGames: stats.totalGames,
                        totalCorrect: stats.totalCorrect,
                        totalAnswers: stats.totalAnswers,
                        winRate: stats.totalAnswers > 0
                            ? Math.round((stats.totalCorrect / stats.totalAnswers) * 100)
                            : 0,
                        bestStreak: stats.bestStreak,
                        lastPlayed: stats.lastPlayed
                    };
                })
                .filter(Boolean)
                .sort((a, b) => {
                    // Tri par taux de réussite, puis par nombre de bonnes réponses
                    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
                    return b.totalCorrect - a.totalCorrect;
                })
                .slice(0, limit);

            return {
                leaderboard: allStats,
                totalPlayers: this.userStats.size,
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Erreur génération leaderboard:', error);
            return { leaderboard: [], totalPlayers: 0 };
        }
    }


    /**
     * Middleware d'authentification pour Express
     */
    authenticateMiddleware() {
        return (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Token manquant' });
            }

            const token = authHeader.substring(7);
            try {
                const decoded = this.verifyJWT(token);
                req.user = decoded;
                next();
            } catch (error) {
                return res.status(401).json({ error: 'Token invalide' });
            }
        };
    }

    /**
     * Nettoie le cache périodiquement
     */
    cleanupCache() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24h

        for (const [key, value] of this.userCache.entries()) {
            if (now - value.cacheTime > maxAge) {
                this.userCache.delete(key);
            }
        }

        console.log(`🧹 Cache nettoyé: ${this.userCache.size} utilisateurs en cache`);
    }
}

// Instance singleton
const discordAuth = new DiscordAuthService();

// Nettoyer le cache toutes les heures
setInterval(() => discordAuth.cleanupCache(), 60 * 60 * 1000);

module.exports = { discordAuth, DiscordAuthService };