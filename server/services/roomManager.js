/**
 * Gestionnaire des rooms en ligne
 * Centralise la gestion des rooms, leur création, nettoyage, etc.
 */

const { CONFIG, ROOM_STATES, GAME_MODES } = require('../constants');

class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.startCleanupInterval();
        this.startStatsInterval();
    }

    /**
     * Génère un code de room unique
     */
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code;
        do {
            code = Array.from({ length: CONFIG.LIMITS.ROOM_CODE_LENGTH }, () =>
                chars.charAt(Math.floor(Math.random() * chars.length))
            ).join('');
        } while (this.rooms.has(code));
        return code;
    }

    /**
     * Crée une nouvelle room
     */
    createRoom(creatorPseudo, creatorSocketId, gameMode = GAME_MODES.NORMAL) {
        const code = this.generateRoomCode();
        const room = new OnlineRoom(code, creatorPseudo, creatorSocketId, gameMode);
        this.rooms.set(code, room);

        console.log(`🏠 Room créée: ${code} par ${creatorPseudo} (${gameMode})`);
        return room;
    }

    /**
     * Récupère une room par son code
     */
    getRoom(code) {
        return this.rooms.get(code);
    }

    /**
     * Supprime une room
     */
    deleteRoom(code, reason = 'inconnue') {
        const room = this.rooms.get(code);
        if (room) {
            if (room.game) {
                room.game.cleanup();
            }
            this.rooms.delete(code);
            console.log(`🗑️ Room ${code} supprimée (${reason})`);
            return true;
        }
        return false;
    }

    /**
     * ✅ NOUVEAU : Nettoyage intelligent des rooms
     */
    cleanupExpiredRooms() {
        const now = Date.now();
        const expiredRooms = [];
        const disconnectedRooms = [];
        const emptyRooms = [];

        this.rooms.forEach((room, code) => {
            const connectedPlayers = room.getConnectedPlayers();
            const allPlayers = room.getAllPlayers();

            // Rooms complètement vides
            if (room.isEmpty()) {
                emptyRooms.push({ code, reason: 'vide' });
                return;
            }

            // Rooms expirées par inactivité
            if (room.isExpired()) {
                expiredRooms.push({ code, reason: 'expirée' });
                return;
            }

            // Rooms où tous les joueurs sont déconnectés
            if (allPlayers.length > 0 && connectedPlayers.length === 0) {
                const gracePeriod = CONFIG.TIMEOUTS.ALL_DISCONNECTED_GRACE;
                const oldestDisconnection = Math.min(
                    ...allPlayers
                        .filter(p => !p.connected && p.disconnectedAt)
                        .map(p => p.disconnectedAt)
                );

                if (oldestDisconnection && (now - oldestDisconnection) > gracePeriod) {
                    disconnectedRooms.push({ code, reason: 'tous déconnectés' });
                }
            }
        });

        // Supprimer toutes les rooms identifiées
        const allRoomsToDelete = [...emptyRooms, ...expiredRooms, ...disconnectedRooms];

        allRoomsToDelete.forEach(({ code, reason }) => {
            this.deleteRoom(code, reason);
        });

        if (allRoomsToDelete.length > 0) {
            console.log(`🧹 Nettoyage: ${allRoomsToDelete.length} rooms supprimées`);
        }

        return {
            deleted: allRoomsToDelete.length,
            remaining: this.rooms.size
        };
    }

    /**
     * ✅ NOUVEAU : Vérifie une room après déconnexion
     */
    checkRoomAfterDisconnection(room, io) {
        const connectedPlayers = room.getConnectedPlayers();

        if (connectedPlayers.length === 0 && room.getAllPlayers().length > 0) {
            console.log(`⚠️ Room ${room.code}: Plus aucun joueur connecté`);

            // Délai de grâce rapide pour reconnexion
            setTimeout(() => {
                const currentRoom = this.rooms.get(room.code);
                if (currentRoom && currentRoom.getConnectedPlayers().length === 0) {
                    console.log(`🧹 Suppression immédiate room ${room.code}: Aucune reconnexion`);
                    this.deleteRoom(room.code, 'abandon rapide');
                }
            }, CONFIG.TIMEOUTS.QUICK_RECONNECTION_GRACE);
        }
    }

    /**
     * ✅ NOUVEAU : Statistiques des rooms
     */
    getStats() {
        const stats = {
            totalRooms: this.rooms.size,
            activeRooms: 0,
            playingRooms: 0,
            totalPlayers: 0,
            modesBreakdown: {
                [GAME_MODES.NORMAL]: 0,
                [GAME_MODES.QUICK]: 0
            },
            averagePlayersPerRoom: 0
        };

        this.rooms.forEach(room => {
            const connectedPlayers = room.getConnectedPlayers().length;
            stats.totalPlayers += connectedPlayers;

            if (connectedPlayers > 0) {
                stats.activeRooms++;
            }

            if (room.state === ROOM_STATES.PLAYING) {
                stats.playingRooms++;
            }

            stats.modesBreakdown[room.gameMode]++;
        });

        if (stats.activeRooms > 0) {
            stats.averagePlayersPerRoom = (stats.totalPlayers / stats.activeRooms).toFixed(1);
        }

        return stats;
    }

    /**
     * ✅ NOUVEAU : Démarre l'intervalle de nettoyage automatique
     */
    startCleanupInterval() {
        setInterval(() => {
            this.cleanupExpiredRooms();
        }, CONFIG.CLEANUP.ROOM_CLEANUP_INTERVAL);

        console.log('🕒 Nettoyage automatique des rooms démarré');
    }

    /**
     * ✅ NOUVEAU : Logs périodiques des statistiques
     */
    startStatsInterval() {
        setInterval(() => {
            const stats = this.getStats();
            const audioManager = require('./audioManager');
            const audioStats = audioManager.getAudioStats();

            console.log('📊 STATS SERVEUR:', {
                rooms: `${stats.activeRooms}/${stats.totalRooms}`,
                players: stats.totalPlayers,
                playing: stats.playingRooms,
                audio: `${audioStats.completeArtists} artistes`,
                modes: `N:${stats.modesBreakdown.normal || 0} Q:${stats.modesBreakdown.quick || 0}`
            });
        }, CONFIG.CLEANUP.STATS_LOG_INTERVAL);
    }

    /**
     * ✅ NOUVEAU : Force la suppression d'une room (admin)
     */
    forceDeleteRoom(code, reason = 'suppression forcée') {
        return this.deleteRoom(code, reason);
    }

    /**
     * ✅ NOUVEAU : Obtient toutes les rooms (pour debug/admin)
     */
    getAllRooms() {
        return Array.from(this.rooms.entries()).map(([code, room]) => ({
            code,
            state: room.state,
            gameMode: room.gameMode,
            players: room.getConnectedPlayers().length,
            creator: room.creatorPseudo,
            created: room.createdAt,
            lastActivity: room.lastActivity
        }));
    }
}

/**
 * Classe OnlineRoom (refactorisée pour être plus modulaire)
 */
class OnlineRoom {
    constructor(code, creatorPseudo, creatorSocketId, gameMode = GAME_MODES.NORMAL) {
        this.code = code;
        this.state = ROOM_STATES.WAITING;
        this.players = new Map();
        this.scores = new Map();
        this.game = null;
        this.playedSongs = new Set();
        this.quickModeSelection = null;
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
        this.shareLink = `${CONFIG.CLIENT_URL}/#/blindtest-online?room=${code}`;
        this.gameMode = gameMode;

        // Configuration du nombre d'artistes
        this.customArtistCount = null;

        // ✅ CORRECTION : Utiliser DEFAULT_ROUNDS défini dans constants.js
        const modeSettings = CONFIG.GAME_MODE_SETTINGS || {};
        const gameSettings = modeSettings[gameMode] || modeSettings[GAME_MODES.NORMAL];
        this.maxRounds = gameSettings?.DEFAULT_ROUNDS || 20;

        this.creatorPseudo = creatorPseudo;

        this.answerTimeSettings = {
            min: CONFIG.ANSWER_TIME.MIN,
            max: CONFIG.ANSWER_TIME.MAX,
            current: CONFIG.ANSWER_TIME.DEFAULT
        };

        this.addPlayer(creatorPseudo, creatorSocketId);
    }

    // ✅ AMÉLIORATION : Validation plus stricte
    updateArtistCount(count) {
        if (this.state !== ROOM_STATES.WAITING) {
            return { success: false, error: 'Impossible de modifier pendant une partie' };
        }

        const range = this.getArtistCountRange();
        if (count < range.min || count > range.max) {
            return {
                success: false,
                error: `Nombre invalide (${range.min}-${range.max})`
            };
        }

        this.customArtistCount = count;
        this.maxRounds = count;
        this.updateActivity();

        console.log(`⚙️ Room ${this.code}: Artistes mis à jour: ${count}`);
        return { success: true };
    }

    updateAnswerTime(seconds) {
        if (this.state !== ROOM_STATES.WAITING) {
            return { success: false, error: 'Impossible de modifier pendant une partie' };
        }

        if (seconds < this.answerTimeSettings.min || seconds > this.answerTimeSettings.max) {
            return {
                success: false,
                error: `Temps invalide (${this.answerTimeSettings.min}-${this.answerTimeSettings.max}s)`
            };
        }

        this.answerTimeSettings.current = seconds;
        this.updateActivity();

        console.log(`⚙️ Room ${this.code}: Temps de réponse mis à jour: ${seconds}s`);
        return { success: true };
    }

    getArtistCountRange() {
        const audioManager = require('./audioManager');
        const modeSettings = CONFIG.GAME_MODE_SETTINGS || {};
        const gameSettings = modeSettings[this.gameMode] || modeSettings[GAME_MODES.NORMAL];

        const maxPossible = audioManager.getTotalArtistsCount(GAME_MODES.NORMAL);

        return {
            min: gameSettings?.MIN_ARTISTS || 5,
            max: gameSettings?.MAX_ARTISTS || maxPossible,
            current: this.maxRounds
        };
    }

    getAnswerTimeSettings() {
        return { ...this.answerTimeSettings };
    }

    addPlayer(pseudo, socketId) {
        this.players.set(pseudo, {
            pseudo,
            socketId,
            ready: false,
            connected: true,
            joinedAt: Date.now(),
            currentRoundAnswer: null,
            hasFoundThisRound: false
        });
        this.scores.set(pseudo, 0);
        this.updateActivity();

        console.log(`➕ Room ${this.code}: ${pseudo} rejoint (${this.players.size}/${CONFIG.LIMITS.MAX_PLAYERS_PER_ROOM})`);
    }

    removePlayer(pseudo) {
        const player = this.getPlayer(pseudo);
        if (player) {
            player.connected = false;
            player.socketId = null;
            player.disconnectedAt = Date.now();

            console.log(`➖ Room ${this.code}: ${pseudo} déconnecté`);

            // Gestion automatique du transfert de host
            if (this.creatorPseudo === pseudo) {
                const newHost = this.transferHostToNextPlayer();
                if (newHost) {
                    console.log(`👑 Room ${this.code}: Host transféré automatiquement à ${newHost}`);
                }
            }

            // ✅ AMÉLIORATION : Timeout adaptatif selon l'état
            const reconnectionTimeout = this.state === ROOM_STATES.PLAYING
                ? CONFIG.TIMEOUTS.PLAYER_RECONNECTION
                : CONFIG.TIMEOUTS.PLAYER_LOBBY_RECONNECTION;

            setTimeout(() => {
                if (this.players.has(pseudo)) {
                    const currentPlayer = this.getPlayer(pseudo);
                    if (currentPlayer && !currentPlayer.connected) {
                        this.players.delete(pseudo);
                        this.scores.delete(pseudo);
                        console.log(`🗑️ Room ${this.code}: ${pseudo} supprimé définitivement`);
                    }
                }
            }, reconnectionTimeout);
        }
        this.updateActivity();
    }

    // ✅ AMÉLIORATION : Transfert de host plus robuste
    transferHost(newHostPseudo) {
        const newHost = this.getPlayer(newHostPseudo);
        if (!newHost || !newHost.connected) {
            return { success: false, error: 'Joueur introuvable ou déconnecté' };
        }

        const oldHost = this.creatorPseudo;
        this.creatorPseudo = newHostPseudo;
        this.updateActivity();

        console.log(`👑 Room ${this.code}: Transfert manuel ${oldHost} → ${newHostPseudo}`);
        return { success: true, oldHost, newHost: newHostPseudo };
    }

    transferHostToNextPlayer() {
        const connectedPlayers = this.getConnectedPlayers();

        if (connectedPlayers.length === 0) {
            return null;
        }

        // Prendre le joueur connecté le plus ancien
        const newHost = connectedPlayers.sort((a, b) => a.joinedAt - b.joinedAt)[0];
        this.creatorPseudo = newHost.pseudo;
        this.updateActivity();

        return newHost.pseudo;
    }

    // Méthodes utilitaires (conservées)
    getPlayer(pseudo) {
        return this.players.get(pseudo);
    }

    getConnectedPlayers() {
        return Array.from(this.players.values()).filter(p => p.connected);
    }

    getAllPlayers() {
        return Array.from(this.players.values());
    }

    updateActivity() {
        this.lastActivity = Date.now();
    }

    allPlayersReady() {
        const connectedPlayers = this.getConnectedPlayers();
        return connectedPlayers.length >= CONFIG.LIMITS.MIN_PLAYERS_TO_START &&
            connectedPlayers.every(p => p.ready);
    }

    isCreator(pseudo) {
        return pseudo === this.creatorPseudo;
    }

    isEmpty() {
        return this.getConnectedPlayers().length === 0;
    }

    isExpired() {
        return Date.now() - this.lastActivity > CONFIG.TIMEOUTS.ROOM_INACTIVITY;
    }

    reset() {
        this.state = ROOM_STATES.WAITING;
        this.game = null;
        this.players.forEach(player => {
            player.ready = false;
            player.currentRoundAnswer = null;
            player.hasFoundThisRound = false;
        });
        this.updateActivity();
        console.log(`🔄 Room ${this.code} reset`);
    }

    resetForNewRound() {
        this.players.forEach(player => {
            player.currentRoundAnswer = null;
            player.hasFoundThisRound = false;
        });
    }

    // ✅ NOUVEAU : Validation avant démarrage de partie
    canStartGame() {
        const connectedPlayers = this.getConnectedPlayers();

        if (connectedPlayers.length < CONFIG.LIMITS.MIN_PLAYERS_TO_START) {
            return { valid: false, reason: `Minimum ${CONFIG.LIMITS.MIN_PLAYERS_TO_START} joueurs requis` };
        }

        if (!this.allPlayersReady()) {
            return { valid: false, reason: 'Tous les joueurs doivent être prêts' };
        }

        if (this.state !== ROOM_STATES.WAITING) {
            return { valid: false, reason: 'Partie déjà en cours' };
        }

        return { valid: true };
    }
}

// Singleton pour le gestionnaire de rooms
const roomManager = new RoomManager();

module.exports = {
    roomManager,
    OnlineRoom
};