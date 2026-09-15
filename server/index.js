/**
 * Point d'entrée principal du serveur de jeu
 * Exporte tous les modules nécessaires
 */

// Services principaux
const { handleOnlineSocketConnection, initializeServer, adminUtils } = require('./onlineGame-Refactored');
const { roomManager } = require('./services/roomManager');
const { GameManager } = require('./services/gameManager');
const audioManager = require('./services/audioManager');

const crypto = require('crypto');

// Configuration et constantes
const { CONFIG, ROOM_STATES, GAME_STATES, GAME_MODES } = require('./constants');

// Utilitaires (si vous en avez)
// const utils = require('./utils');

/**
 * ✅ NOUVEAU : Configuration du serveur avec express (exemple)
 */
function setupExpress(app) {
    // Endpoint de santé
    app.get('/health', (req, res) => {
        const health = adminUtils.getServerStats();
        res.json({
            status: 'ok',
            ...health
        });
    });

    // Auth admin : header (jamais en query string) + comparaison timing-safe
    const requireAdmin = (req, res, next) => {
        const expected = process.env.ADMIN_SECRET;
        const provided = req.get('x-admin-secret') || '';

        if (!expected) {
            return res.status(503).json({ error: 'Admin endpoints disabled' });
        }

        const a = Buffer.from(provided);
        const b = Buffer.from(expected);

        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        next();
    };

    app.get('/admin/rooms', requireAdmin, (req, res) => {
        res.json({
            rooms: adminUtils.getRoomsList(),
            stats: adminUtils.getServerStats()
        });
    });

    // Endpoint pour refresh du cache audio
    app.post('/admin/refresh-audio', requireAdmin, (req, res) => {
        adminUtils.refreshAudioCache();
        res.json({ message: 'Cache audio rafraîchi' });
    });

    console.log('🌐 Endpoints Express configurés');
}

/**
 * ✅ NOUVEAU : Configuration complète du serveur
 */
function setupServer(io, app = null) {
    // Initialiser le serveur de jeu
    const { healthCheck } = initializeServer();

    // Configurer les endpoints Express si fourni
    if (app) {
        setupExpress(app);
    }

    // Gestionnaire de connexions Socket.IO
    io.on('connection', (socket) => {
        handleOnlineSocketConnection(socket, io);
    });

    console.log('🎮 Serveur de jeu configuré et prêt');

    return {
        healthCheck,
        adminUtils,
        managers: {
            rooms: roomManager,
            game: GameManager,
            audio: audioManager
        }
    };
}

module.exports = {
    // Fonction principale
    setupServer,

    // Gestionnaire de connexions (pour compatibilité)
    handleOnlineSocketConnection,

    // Services
    roomManager,
    GameManager,
    audioManager,

    // Configuration
    CONFIG,
    ROOM_STATES,
    GAME_STATES,
    GAME_MODES,

    // Utilitaires admin
    adminUtils,

    // Pour migration progressive
    legacy: {
        handleOnlineSocketConnection
    }
};