/**
 * Espace d'administration.
 *
 * Toutes les routes exigent une session Discord dont l'identifiant figure dans
 * ADMIN_DISCORD_IDS. Aucune ne modifie une partie en cours : ce sont des vues,
 * plus deux actions de maintenance clairement identifiées.
 */

const express = require('express');
const os = require('os');
const { getDatabase } = require('../services/database');
const { requireAdmin, isAdmin } = require('../middleware/adminAuth');
const { authenticateDiscord } = require('../middleware/auth');
const { roomManager } = require('../services/roomManager');
const buzzerGameManager = require('../services/buzzer-gameManager');
const rankingService = require('../services/rankingService');

const router = express.Router();

const avatarUrl = (discordId, avatar, size = 64) =>
    (avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=${size}` : null);

/**
 * GET /api/admin/session
 * Dit au client s'il doit afficher le lien d'administration.
 * Répond toujours 200 : ce n'est pas une porte, juste un interrupteur d'affichage.
 *
 * `discordId` est celui du demandeur, lu dans son propre jeton : il ne révèle
 * rien qu'il ne sache déjà, et c'est la valeur à reporter dans ADMIN_DISCORD_IDS
 * pour s'accorder l'accès.
 */
router.get('/session', authenticateDiscord, (req, res) => {
    const discordId = req.user?.discordId || null;
    res.json({ success: true, isAdmin: isAdmin(discordId), discordId });
});

// Tout ce qui suit est réservé aux administrateurs
router.use(requireAdmin);

/**
 * GET /api/admin/overview
 * Chiffres de la plateforme, activité des 30 derniers jours et santé du processus.
 */
router.get('/overview', (req, res) => {
    try {
        const db = getDatabase();
        const memory = process.memoryUsage();

        res.json({
            success: true,
            counts: db.getAdminOverview(),
            activity: db.getActivityByDay(30),
            tables: db.getTableCounts(),
            system: {
                environment: process.env.NODE_ENV || 'development',
                nodeVersion: process.version,
                uptimeSeconds: Math.round(process.uptime()),
                memoryUsedMb: Math.round(memory.rss / 1024 / 1024),
                heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
                loadAverage: os.loadavg().map((value) => Number(value.toFixed(2))),
                databaseBytes: db.getDatabaseFileSize(),
                serverTime: Date.now(),
            },
        });
    } catch (error) {
        console.error('❌ Erreur overview admin:', error);
        res.status(500).json({ success: false, error: 'server_error' });
    }
});

/**
 * GET /api/admin/rooms
 * Salles vivantes en mémoire, tous jeux confondus. Utile pour repérer une salle
 * fantôme ou comprendre une partie bloquée sans ouvrir les logs.
 */
router.get('/rooms', (req, res) => {
    try {
        const blindtest = Array.from(roomManager.rooms.entries()).map(([code, room]) => ({
            code,
            game: 'blindtest',
            state: room.state,
            gameMode: room.gameMode,
            createdAt: room.createdAt || null,
            players: Array.from(room.players?.values?.() || []).map((player) => ({
                name: player.pseudo,
                connected: player.connected !== false,
                isDiscordUser: Boolean(player.isDiscordUser),
            })),
        }));

        const buzzer = Array.from(buzzerGameManager.games.entries()).map(([code, game]) => ({
            code,
            game: 'buzzer',
            state: game.status,
            gameMode: game.mode,
            currentRound: game.currentRound,
            totalRounds: game.totalRounds,
            players: Object.values(game.players || {}).map((player) => ({
                name: player.username,
                connected: player.connected !== false,
                isDiscordUser: Boolean(player.isDiscordUser),
            })),
        }));

        res.json({ success: true, rooms: [...blindtest, ...buzzer] });
    } catch (error) {
        console.error('❌ Erreur salles admin:', error);
        res.status(500).json({ success: false, error: 'server_error' });
    }
});

/**
 * GET /api/admin/players?q=&limit=
 * Recherche de profils, profils masqués compris.
 */
router.get('/players', (req, res) => {
    try {
        const db = getDatabase();
        const query = String(req.query.q || '').trim();
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

        const results = db.searchUsers(query, { limit, includeHidden: true }).map((user) => ({
            ...user,
            avatar: avatarUrl(user.discordId, user.avatar),
            isPublic: user.publicProfile === 1,
        }));

        res.json({ success: true, query, results });
    } catch (error) {
        console.error('❌ Erreur recherche admin:', error);
        res.status(500).json({ success: false, error: 'server_error' });
    }
});

/**
 * GET /api/admin/players/:discordId
 * Dossier complet d'un joueur, y compris ce que le profil public ne montre pas.
 */
router.get('/players/:discordId', (req, res) => {
    try {
        const db = getDatabase();
        const { discordId } = req.params;
        const user = db.getUserByDiscordId(discordId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'player_not_found' });
        }

        res.json({
            success: true,
            player: {
                ...user,
                avatar: avatarUrl(discordId, user.avatar, 128),
                isPublic: user.publicProfile === 1,
                isAdmin: isAdmin(discordId),
            },
            stats: {
                global: db.getUserStats(discordId),
                blindtest: db.getUserStatsByGameMode(discordId, 'blindtest'),
                buzzer: db.getUserStatsByGameMode(discordId, 'buzzer'),
                buzzerRecord: db.getUserBuzzerRecord(discordId),
            },
            ranking: {
                all: rankingService.getPlayerRanking('all', discordId),
                blindtest: rankingService.getPlayerRanking('blindtest', discordId),
                buzzer: rankingService.getPlayerRanking('buzzer', discordId),
            },
            artists: db.getUserArtistRecord(discordId, { limit: 10 }),
            opponents: db.getFrequentOpponents(discordId, 10),
            recentGames: db.getRecentGames({ limit: 20, discordId }),
            log: db.getActivityLog({ limit: 50 }).filter((entry) => entry.discordId === discordId),
        });
    } catch (error) {
        console.error('❌ Erreur dossier joueur:', error);
        res.status(500).json({ success: false, error: 'server_error' });
    }
});

/**
 * GET /api/admin/games?limit=
 * Dernières parties terminées, avec leurs participants.
 */
router.get('/games', (req, res) => {
    try {
        const db = getDatabase();
        const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
        res.json({ success: true, games: db.getRecentGames({ limit }) });
    } catch (error) {
        console.error('❌ Erreur parties admin:', error);
        res.status(500).json({ success: false, error: 'server_error' });
    }
});

/**
 * GET /api/admin/log?limit=&type=&level=
 * Journal d'activité : connexions, parties, messages de contact, erreurs, actions d'admin.
 */
router.get('/log', (req, res) => {
    try {
        const db = getDatabase();
        res.json({
            success: true,
            types: db.getLogTypes(),
            entries: db.getActivityLog({
                limit: Math.min(parseInt(req.query.limit, 10) || 100, 500),
                type: req.query.type || null,
                level: req.query.level || null,
            }),
        });
    } catch (error) {
        console.error('❌ Erreur journal admin:', error);
        res.status(500).json({ success: false, error: 'server_error' });
    }
});

/**
 * DELETE /api/admin/players/:discordId
 * Supprime toutes les données d'un joueur. Irréversible, journalisé.
 */
router.delete('/players/:discordId', (req, res) => {
    try {
        const db = getDatabase();
        const { discordId } = req.params;

        if (discordId === req.user.discordId) {
            return res.status(400).json({ success: false, error: 'cannot_delete_self' });
        }

        const user = db.getUserByDiscordId(discordId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'player_not_found' });
        }

        const deleted = db.deleteUserData(discordId);
        db.logEvent({
            level: 'warn',
            type: 'admin',
            message: `Données de ${user.username} supprimées par ${req.user.username}`,
            discordId: req.user.discordId,
            context: { target: discordId, deleted },
        });

        res.json({ success: true, deleted });
    } catch (error) {
        console.error('❌ Erreur suppression joueur:', error);
        res.status(500).json({ success: false, error: 'server_error' });
    }
});

/**
 * POST /api/admin/reset-stats  { confirm: "RESET", keepUsers: true }
 * Remise à zéro de l'historique de jeu. La confirmation textuelle est exigée
 * pour qu'un appel accidentel ne puisse pas passer.
 */
router.post('/reset-stats', (req, res) => {
    try {
        if (req.body?.confirm !== 'RESET') {
            return res.status(400).json({ success: false, error: 'confirmation_required' });
        }

        const db = getDatabase();
        const keepUsers = req.body?.keepUsers !== false;
        const result = db.resetStatistics({ keepUsers, keepLog: true });

        db.logEvent({
            level: 'warn',
            type: 'admin',
            message: `Remise à zéro des statistiques par ${req.user.username} (comptes ${keepUsers ? 'conservés' : 'supprimés'})`,
            discordId: req.user.discordId,
            context: result,
        });

        console.warn(`🧨 Statistiques remises à zéro par ${req.user.username}`);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('❌ Erreur remise à zéro:', error);
        res.status(500).json({ success: false, error: 'server_error' });
    }
});

module.exports = router;
