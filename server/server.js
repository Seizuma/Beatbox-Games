const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { handleOnlineSocketConnection } = require('./onlineGame');
const { handleBuzzerSocketConnection } = require('./buzzer-socketHandler');
const { CONFIG, LOG_CONFIG, ENVIRONMENT } = require('./constants');
const fs = require('fs');

// ✅ NOUVEAU : Import des routes d'authentification
const authRoutes = require('./routes/auth');
const { discordAuth } = require('./services/discordAuth');

const app = express();
const server = http.createServer(app);

// Log de démarrage avec environnement
if (CONFIG.IS_STAGING) {
    console.log(`${LOG_CONFIG.COLORS.SUCCESS} BeatBox Games Server - ${ENVIRONMENT.toUpperCase()}${LOG_CONFIG.COLORS.RESET}`);
    console.log(`${LOG_CONFIG.COLORS.INFO} Base URL: ${CONFIG.BASE_URL}${LOG_CONFIG.COLORS.RESET}`);
    console.log(`${LOG_CONFIG.COLORS.INFO} Client URL: ${CONFIG.CLIENT_URL}${LOG_CONFIG.COLORS.RESET}`);
}


// Configuration CORS adaptée à l'environnement
const corsOptions = {
    origin: [
        CONFIG.CLIENT_URL,
        'https://beatboxgames.com',
        'https://www.beatboxgames.com',
        ...(CONFIG.DEV_FEATURES.ALLOW_LOCALHOST ? [
            'https://dev.beatboxgames.com',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:8080',
            'http://localhost:8081'
        ] : [])
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
//test
app.use(cors(corsOptions));
app.use(express.json()); // ✅ NOUVEAU : Parser JSON pour les API
app.use(express.static('public'));

const contactService = require('./services/contactService');

// ✅ Route pour servir les images des beatboxers
app.get('/api/beatboxer-images/:filename', (req, res) => {
    const filename = req.params.filename;
    const imagePath = path.join(__dirname, 'beatbox_artists', filename);

    console.log('🖼️ Requête image:', filename);
    console.log('📂 Chemin complet:', imagePath);
    console.log('🌐 Headers:', req.headers);
    console.log('🔗 Origin:', req.headers.origin || 'No origin');

    // Vérifier que le fichier existe
    if (fs.existsSync(imagePath)) {
        console.log('✅ Image trouvée:', filename);

        // ✅ AJOUT : Headers CORS explicites
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24h

        res.sendFile(imagePath);
    } else {
        console.warn(`⚠️ Image non trouvée: ${filename}`);

        // ✅ AJOUT : Lister TOUS les fichiers pour debug
        const allFiles = fs.readdirSync(path.join(__dirname, 'beatbox_artists'))
            .filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

        console.log('🔍 Fichiers disponibles (total:', allFiles.length, ')');
        console.log('🔍 Premiers 10:', allFiles.slice(0, 10));

        // Chercher des noms similaires
        const similar = allFiles.filter(f =>
            f.toLowerCase().includes(filename.toLowerCase().replace(/[_\s]/g, ''))
        );
        if (similar.length > 0) {
            console.log('💡 Fichiers similaires trouvés:', similar);
        }

        res.status(404).json({
            error: 'Image non trouvée',
            requested: filename,
            similar: similar,
            total: allFiles.length
        });
    }
});

// Route pour récupérer les parties récentes d'un utilisateur
app.get('/api/stats/recent-games/:discordId', (req, res) => {
    const { discordId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    try {
        const games = db.getUserRecentGames(discordId, limit);
        res.json({ success: true, games });
    } catch (error) {
        console.error('Erreur récupération parties récentes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ NOUVEAU : Route de debug pour Buzzer Battle
app.get('/api/buzzer/debug', (req, res) => {
    const buzzerBeatboxerManager = require('./services/buzzer-beatboxerManager');

    const stats = buzzerBeatboxerManager.getStats();
    const countries = buzzerBeatboxerManager.getAllCountries();
    const events = buzzerBeatboxerManager.getAllEvents();

    res.json({
        status: 'ok',
        dataLoaded: stats.totalBeatboxers > 0,
        stats,
        countries: countries.slice(0, 20),
        events: events.slice(0, 20),
        sampleBeatboxer: buzzerBeatboxerManager.beatboxersData[0] || null
    });
});

// ✅ NOUVEAU : Routes d'authentification Discord
app.use('/auth', authRoutes);

// ✅ NOUVEAU : Routes de statistiques
const statsRoutes = require('./routes/stats');
app.use('/api/stats', statsRoutes);

// Classement compétitif (cote Elo, parties à plusieurs comptes Discord)
const rankingRoutes = require('./routes/ranking');
app.use('/api/ranking', rankingRoutes);
// Middleware pour vérifier l'authentification Discord
const requireDiscordAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Discord authentication required',
                requireAuth: true
            });
        }

        const token = authHeader.substring(7);
        const decoded = discordAuth.verifyJWT(token);

        req.discordUser = {
            discordId: decoded.discordId,
            username: decoded.username,
            discriminator: decoded.discriminator,
            avatar: decoded.avatar,
            email: decoded.email
        };

        next();
    } catch (error) {
        console.error('Auth verification error:', error.message);
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired Discord token',
            requireAuth: true
        });
    }
};

// Route pour envoyer un message de contact
app.post('/api/contact', requireDiscordAuth, async (req, res) => {
    try {
        const { type, category, details } = req.body;

        // Validation des données
        if (!type || !category || !details) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: type, category, details'
            });
        }

        // Validation que details est une string
        if (typeof details !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Details must be a string'
            });
        }

        if (!['bug', 'suggestion'].includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid type. Must be "bug" or "suggestion"'
            });
        }

        if (!['blindtest', 'buzzer', 'other'].includes(category)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid category. Must be "blindtest", "buzzer", or "other"'
            });
        }

        if (details.trim().length < 10) {
            return res.status(400).json({
                success: false,
                error: 'Details must be at least 10 characters long'
            });
        }

        if (details.length > 2000) {
            return res.status(400).json({
                success: false,
                error: 'Details must not exceed 2000 characters'
            });
        }

        // Envoyer le message
        await contactService.sendContactMessage({ type, category, details }, req.discordUser);

        res.json({
            success: true,
            message: 'Contact message sent successfully'
        });

    } catch (error) {
        console.error('Contact API error:', error);

        if (error.rateLimited) {
            return res.status(429).json({
                success: false,
                error: 'Daily submission limit reached for this category',
                rateLimited: true
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to send contact message'
        });
    }
});

// Route pour récupérer les limites de soumission de l'utilisateur
app.get('/api/contact/limits', requireDiscordAuth, async (req, res) => {
    try {
        const limits = contactService.getUserSubmissionLimits(req.discordUser.discordId);

        res.json({
            success: true,
            limits: limits,
            maxPerCategory: 10
        });
    } catch (error) {
        console.error('Contact limits API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get submission limits'
        });
    }
});

// Route de test pour la configuration email — jamais exposée en production
app.get('/api/contact/test', async (req, res) => {
    if (CONFIG.IS_PRODUCTION) {
        return res.status(404).json({ success: false, error: 'Not found' });
    }

    try {
        const emailTest = await contactService.testEmailConfiguration();

        const debugInfo = {
            emailConfigured: !!process.env.SMTP_USER && !!process.env.SMTP_PASS,
            smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
            smtpPort: process.env.SMTP_PORT || 587,
            smtpUser: process.env.SMTP_USER ? 'set' : 'Not set',
            smtpPass: process.env.SMTP_PASS ? 'set' : 'Not set',
            contactEmail: process.env.CONTACT_EMAIL ? 'set' : 'Not set',
            emailTest: emailTest
        };

        res.json({
            success: true,
            message: 'Email configuration tested',
            debug: debugInfo
        });

    } catch (error) {
        console.error('Test configuration error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/health', (req, res) => {
    // En production : réponse minimale, suffisante pour le healthcheck Docker
    if (CONFIG.IS_PRODUCTION) {
        return res.json({
            status: 'OK',
            timestamp: new Date().toISOString()
        });
    }

    const healthData = {
        status: 'OK',
        environment: ENVIRONMENT,
        timestamp: new Date().toISOString(),
        connections: io ? io.sockets.sockets.size : 0,
        version: '2.1.0',
        socketio: 'active',
        discord: {
            configured: !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
            usersInCache: discordAuth.userCache.size,
            usersWithStats: discordAuth.userStats.size
        },
        config: {
            baseUrl: CONFIG.BASE_URL,
            clientUrl: CONFIG.CLIENT_URL,
            debugMode: CONFIG.DEV_FEATURES.DEBUG_ERRORS
        }
    };

    if (!CONFIG.IS_PRODUCTION) {
        healthData.debug = {
            nodeEnv: process.env.NODE_ENV,
            staging: process.env.STAGING,
            corsOrigins: corsOptions.origin,
            timeouts: CONFIG.TIMEOUTS,
            devFeatures: CONFIG.DEV_FEATURES
        };
    }

    res.json(healthData);
});

// NOUVEAU : Endpoints de développement
if (CONFIG.DEV_FEATURES.ENABLE_ADMIN_ENDPOINTS) {
    app.get('/dev/config', (req, res) => {
        res.json({
            environment: ENVIRONMENT,
            config: {
                ...CONFIG,
                TIMEOUTS: CONFIG.TIMEOUTS,
                LIMITS: CONFIG.LIMITS,
                DEV_FEATURES: CONFIG.DEV_FEATURES
            }
        });
    });

    app.post('/dev/broadcast', (req, res) => {
        io.emit('dev:force-refresh', {
            reason: 'Developer refresh',
            timestamp: Date.now()
        });
        res.json({ message: 'Broadcast envoyé', clients: io.sockets.sockets.size });
    });

    // ✅ NOUVEAU : Endpoints de debug Discord
    app.get('/dev/discord/users', (req, res) => {
        res.json({
            cacheSize: discordAuth.userCache.size,
            statsSize: discordAuth.userStats.size,
            users: Array.from(discordAuth.userCache.entries()).map(([id, user]) => ({
                discordId: id,
                username: user.username,
                lastSeen: user.lastSeen,
                cacheTime: user.cacheTime
            }))
        });
    });

    app.post('/dev/discord/clear-cache', (req, res) => {
        discordAuth.userCache.clear();
        discordAuth.userStats.clear();
        res.json({ message: 'Cache Discord vidé' });
    });

    if (CONFIG.ENVIRONMENT === 'development') {
        app.get('/dev/test-error', (req, res) => {
            throw new Error('Test error endpoint');
        });
    }

    console.log(`${LOG_CONFIG.COLORS.DEBUG} Endpoints de développement activés${LOG_CONFIG.COLORS.RESET}`);
}

// Configuration Socket.io adaptée à l'environnement
const socketConfig = {
    cors: corsOptions,
    allowEIO3: true,
    transports: ['polling'],
    pingTimeout: CONFIG.ENVIRONMENT === 'development' ? 30000 : 60000,
    pingInterval: CONFIG.ENVIRONMENT === 'development' ? 15000 : 25000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6,
    allowUpgrades: false,
    serveClient: false
};

const io = new Server(server, socketConfig);

// ✅ NOUVEAU : Middleware Socket.io pour l'authentification Discord
io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.auth?.discord_token;

    console.log(`🔹 Nouveau socket: ${socket.id}`);
    console.log(`🔐 Token reçu:`, token ? `${token.substring(0, 20)}...` : 'undefined/null');
    console.log(`🔍 Auth object complet:`, socket.handshake.auth);
    console.log(`🔍 Headers auth:`, socket.handshake.headers?.authorization);

    if (token) {
        try {
            const decoded = discordAuth.verifyJWT(token);
            socket.discordUser = decoded;
            console.log(`✅ Socket authentifié Discord:`, {
                id: socket.id,
                username: decoded.username,
                discriminator: decoded.discriminator,
                discordId: decoded.discordId?.substring(0, 8) + '...'
            });
        } catch (error) {
            console.log(`❌ Token Discord invalide pour socket: ${socket.id}`, {
                error: error.message,
                tokenPreview: token.substring(0, 20) + '...'
            });
            socket.discordUser = null;
        }
    } else {
        console.log(`⚪ Socket sans authentification Discord: ${socket.id}`);
        socket.discordUser = null;
    }

    next();
});



// Monitoring des connexions avec logs adaptés
io.on('connection', (socket) => {
    const logPrefix = CONFIG.LOGGING.PREFIX;

    if (CONFIG.IS_STAGING) {
        console.log(`${CONFIG.LOGGING.PREFIX} Connexion socket: ${socket.id}`);
        if (socket.discordUser) {
            console.log(`${CONFIG.LOGGING.PREFIX} Utilisateur Discord: ${socket.discordUser.username}`);
        }
    }

    if (CONFIG.LOGGING.ENABLE_DEBUG) {
        console.log(`${logPrefix} 📡 Transport: ${socket.conn.transport.name}`);
        console.log(`${logPrefix} 🌐 Origin: ${socket.handshake.headers.origin}`);
        console.log(`${logPrefix} 👥 Total connexions: ${io.sockets.sockets.size}`);
    }

    socket.on('disconnect', (reason) => {
        if (CONFIG.IS_STAGING) {
            console.log(`${CONFIG.LOGGING.PREFIX} Déconnexion socket: ${socket.id} (${reason})`);
        }

        if (CONFIG.LOGGING.STAGING_EXTRA_LOGS) {
            console.log(`${logPrefix} 📊 Connexions restantes: ${io.sockets.sockets.size - 1}`);
        }
    });

    socket.on('error', (error) => {
        console.error(`${logPrefix} 🚨 Erreur socket: ${socket.id}`, error);

        if (CONFIG.DEV_FEATURES.DEBUG_ERRORS && error.stack) {
            console.error(`${logPrefix} 📋 Stack trace:`, error.stack);
        }
    });

    // ✅ NOUVEAU : Événements Discord spécifiques
    socket.on('discord:update-profile', async (data, callback) => {
        if (!socket.discordUser) {
            return callback({ error: 'Non authentifié' });
        }

        try {
            // Mettre à jour le cache utilisateur
            const updatedUser = {
                ...socket.discordUser,
                lastActivity: new Date(),
                ...data // Permettre certaines mises à jour
            };

            discordAuth.updateUserCache(socket.discordUser.discordId, updatedUser);

            if (callback) {
                callback({ success: true, user: updatedUser });
            }
        } catch (error) {
            console.error('Erreur mise à jour profil Discord:', error);
            if (callback) {
                callback({ error: 'Erreur serveur' });
            }
        }
    });

    socket.on('update-game-stats', async (statsData, callback) => {
        if (!socket.discordUser) {
            return callback?.({ error: 'Non authentifié Discord' });
        }

        try {
            const userId = socket.discordUser.discordId;

            // Mettre à jour les statistiques dans discordAuth
            const updatedStats = await discordAuth.updateGameStats(userId, statsData);

            console.log(`📊 Stats mises à jour pour ${socket.discordUser.username}:`, statsData);

            if (callback) {
                callback({ success: true, stats: updatedStats });
            }
        } catch (error) {
            console.error('Erreur mise à jour stats Discord:', error);
            if (callback) {
                callback({ error: 'Erreur serveur' });
            }
        }
    });


    socket.on('game-ended-stats', async (gameData) => {
        console.log('📊 RÉCEPTION game-ended-stats:', {
            hasDiscordUser: !!socket.discordUser,
            username: socket.discordUser?.username,
            gameData: gameData
        });

        if (!socket.discordUser) {
            console.warn('⚠️ game-ended-stats reçu mais pas de discordUser');
            return;
        }

        try {
            // Auto-update des stats Discord
            const statsUpdate = {
                totalGames: 1,
                totalCorrect: gameData.playerStats?.correctAnswers || 0,
                totalAnswers: gameData.playerStats?.totalAnswers || 0,
                bestStreak: gameData.playerStats?.bestStreak || 0,
                gameMode: gameData.gameMode,
                playerScore: gameData.playerStats?.score || 0,
                timestamp: new Date().toISOString()
            };

            console.log('📊 Mise à jour stats Discord:', {
                discordId: socket.discordUser.discordId,
                username: socket.discordUser.username,
                stats: statsUpdate
            });

            const updatedStats = await discordAuth.updateGameStats(socket.discordUser.discordId, statsUpdate);

            console.log('✅ Stats mises à jour avec succès:', updatedStats);

            socket.emit('discord-stats-updated', updatedStats);

        } catch (error) {
            console.error('❌ Erreur auto-update stats:', error);
        }
    });

    // Événement spécial développement
    if (CONFIG.DEV_FEATURES.ENABLE_TEST_ROUTES) {
        socket.on('dev:ping', (data, callback) => {
            console.log(`${logPrefix} 🔍 Dev ping reçu:`, data);
            if (callback) callback({
                pong: true,
                timestamp: Date.now(),
                environment: ENVIRONMENT,
                socketId: socket.id,
                discordUser: socket.discordUser ? {
                    username: socket.discordUser.username,
                    discriminator: socket.discordUser.discriminator
                } : null
            });
        });
    }

    // Gestionnaire Online existant
    handleOnlineSocketConnection(socket, io);
    handleBuzzerSocketConnection(socket, io);
});

// Port adapté selon l'environnement
const PORT = process.env.PORT || (CONFIG.IS_STAGING ? 4000 : 4000);

server.listen(PORT, '0.0.0.0', () => {
    const logPrefix = CONFIG.LOGGING.PREFIX;

    console.log(`${logPrefix} 🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`${logPrefix} 🔗 URL: ${CONFIG.CLIENT_URL}`);
    console.log(`${logPrefix} 📡 Socket.io prêt (polling uniquement)`);
    console.log(`${logPrefix} 🎮 Mode Online disponible`);
    console.log(`${logPrefix} 🔐 Authentification Discord: ${!!(process.env.DISCORD_CLIENT_ID) ? 'Activée' : 'Désactivée'}`);
    console.log(`${logPrefix} 🏥 Health: ${CONFIG.CLIENT_URL}/health`);
    console.log(`${logPrefix} 🔗 Auth Discord: ${CONFIG.BASE_URL}/auth/discord`);

    if (CONFIG.DEV_FEATURES.ENABLE_ADMIN_ENDPOINTS) {
        console.log(`${logPrefix} 🛠️  Dev endpoints: /dev/config, /dev/broadcast, /dev/discord/*`);
    }

    if (CONFIG.IS_STAGING) {
        console.log(`${LOG_CONFIG.COLORS.STAGING} 🔧 STAGING MODE - Authentification requise${LOG_CONFIG.COLORS.RESET}`);
    }

    // ✅ NOUVEAU : Vérifier la configuration Discord
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
        console.warn(`${logPrefix} ⚠️  Variables Discord manquantes: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET`);
    }
});

// Gestion d'arrêt propre avec logs
process.on('SIGTERM', () => {
    console.log(`${CONFIG.LOGGING.PREFIX} 🔴 SIGTERM reçu, arrêt du serveur...`);
    server.close(() => {
        console.log(`${CONFIG.LOGGING.PREFIX} ✅ Serveur arrêté proprement`);
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log(`${CONFIG.LOGGING.PREFIX} 🔴 Ctrl+C détecté, arrêt...`);
    server.close(() => {
        console.log(`${CONFIG.LOGGING.PREFIX} ✅ Serveur arrêté`);
        process.exit(0);
    });
});

// Gestion des erreurs non capturées avec logs détaillés
process.on('uncaughtException', (error) => {
    if (CONFIG.IS_STAGING) {
        console.error(`${CONFIG.LOGGING.PREFIX} Erreur non capturée:`, error);
    }

    if (CONFIG.DEV_FEATURES.DEBUG_ERRORS) {
        console.error(`${CONFIG.LOGGING.PREFIX} 📋 Stack trace:`, error.stack);
    }

    if (!CONFIG.IS_PRODUCTION) {
        console.log(`${CONFIG.LOGGING.PREFIX} 🔄 Continuing execution in ${ENVIRONMENT} mode...`);
        return;
    }

    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`${CONFIG.LOGGING.PREFIX} 💥 Promise rejetée:`, reason);

    if (CONFIG.DEV_FEATURES.DEBUG_ERRORS) {
        console.error(`${CONFIG.LOGGING.PREFIX} 📋 Promise:`, promise);
    }

    if (!CONFIG.IS_PRODUCTION) {
        console.log(`${CONFIG.LOGGING.PREFIX} 🔄 Continuing execution in ${ENVIRONMENT} mode...`);
        return;
    }
});

module.exports = { app, server, io };