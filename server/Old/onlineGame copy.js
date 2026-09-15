// server/onlineGame.js - Version complète avec toutes les fonctionnalités
const fs = require('fs');
const path = require('path');
const { normalize } = require('./utils');

const onlineRooms = new Map();
const BASE_URL = 'https://beatboxgames.com/audio';
const CLIENT_URL = 'https://beatboxgames.com';
const MIN_ANSWER_TIME = 60; // 60s minimum
const ROOM_TIMEOUT = 30 * 60 * 1000;

const ROOM_STATES = {
    WAITING: 'waiting',
    STARTING: 'starting',
    PLAYING: 'playing',
    FINISHED: 'finished'
};

const GAME_STATES = {
    COUNTDOWN: 'countdown',
    LISTENING: 'listening',
    ANSWERING: 'answering',
    RESULTS: 'results'
};

// ✅ NOUVEAU : Modes de jeu
const GAME_MODES = {
    NORMAL: 'normal',
    QUICK: 'quick'
};

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    do {
        code = Array.from({ length: 5 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    } while (onlineRooms.has(code));
    return code;
}

function getTotalArtistsCount(gameMode = GAME_MODES.NORMAL) {
    try {
        const audioDir = path.join(__dirname, 'public', 'audio');
        const files = fs.readdirSync(audioDir);
        const level1Files = files.filter(f => f.startsWith('Level 1 -') && f.endsWith('.mp3'));

        // ✅ NOUVEAU : Limitation pour mode rapide
        if (gameMode === GAME_MODES.QUICK) {
            return Math.min(10, level1Files.length);
        }

        return level1Files.length;
    } catch (error) {
        return gameMode === GAME_MODES.QUICK ? 5 : 10;
    }
}

function getAudioDuration(filename) {
    const estimatedDurations = {
        'Level 1': 30,  // 30 secondes pour niveau 1
        'Level 2': 45,  // 45 secondes pour niveau 2  
        'Level 3': 60   // 60 secondes pour niveau 3
    };

    if (filename.includes('Level 1')) return estimatedDurations['Level 1'];
    if (filename.includes('Level 2')) return estimatedDurations['Level 2'];
    if (filename.includes('Level 3')) return estimatedDurations['Level 3'];

    return 60; // Fallback
}

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
        this.shareLink = `${CLIENT_URL}/#/blindtest-online?room=${code}`;
        this.gameMode = gameMode;

        // ✅ NOUVEAU : Configuration personnalisée du nombre d'artistes
        this.customArtistCount = null; // null = utiliser la valeur par défaut du mode
        this.maxRounds = getTotalArtistsCount(gameMode);
        this.creatorPseudo = creatorPseudo;

        // ✅ NOUVEAU : Configuration du temps de réponse
        this.answerTimeSettings = {
            min: 5,
            max: 60,
            current: 30 // Temps par défaut : 30 secondes
        };

        this.addPlayer(creatorPseudo, creatorSocketId);
    }

    // ✅ NOUVEAU : Méthode pour mettre à jour le nombre d'artistes
    updateArtistCount(count) {
        if (this.state !== ROOM_STATES.WAITING) {
            return false; // Ne peut pas changer pendant une partie
        }

        const maxPossible = getTotalArtistsCount('normal'); // Maximum possible
        const minCount = this.gameMode === GAME_MODES.QUICK ? 5 : 10;
        const maxCount = this.gameMode === GAME_MODES.QUICK ? 20 : maxPossible;

        if (count < minCount || count > maxCount) {
            return false;
        }

        this.customArtistCount = count;
        this.maxRounds = count;
        this.updateActivity();
        return true;
    }

    // ✅ NOUVEAU : Méthode pour mettre à jour le temps de réponse
    updateAnswerTime(seconds) {
        if (this.state !== ROOM_STATES.WAITING) {
            return false; // Ne peut pas changer pendant une partie
        }

        if (seconds < this.answerTimeSettings.min || seconds > this.answerTimeSettings.max) {
            return false;
        }

        this.answerTimeSettings.current = seconds;
        this.updateActivity();
        return true;
    }

    // ✅ NOUVEAU : Obtenir la plage de valeurs autorisées
    getArtistCountRange() {
        const maxPossible = getTotalArtistsCount('normal');
        const minCount = this.gameMode === GAME_MODES.QUICK ? 5 : 10;
        const maxCount = this.gameMode === GAME_MODES.QUICK ? 20 : maxPossible;

        return { min: minCount, max: maxCount, current: this.maxRounds };
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
    }

    removePlayer(pseudo) {
        const player = this.getPlayer(pseudo);
        if (player) {
            // Marquer comme déconnecté mais garder les données
            player.connected = false;
            player.socketId = null;
            player.disconnectedAt = Date.now();

            // ✅ NOUVEAU : Gérer le transfert automatique du rôle de créateur
            if (this.creatorPseudo === pseudo) {
                this.transferHostToNextPlayer();
            }

            // ✅ NOUVEAU : Délai de reconnexion plus long pendant les parties
            const reconnectionTimeout = this.state === ROOM_STATES.PLAYING ? 10 * 60 * 1000 : 5 * 60 * 1000; // 10min en partie, 5min sinon

            setTimeout(() => {
                if (this.players.has(pseudo)) {
                    const currentPlayer = this.getPlayer(pseudo);
                    if (currentPlayer && !currentPlayer.connected) {
                        this.players.delete(pseudo);
                        this.scores.delete(pseudo);

                        // Si c'était le créateur et qu'il n'y a plus personne, supprimer la room
                        if (this.creatorPseudo === pseudo && this.getConnectedPlayers().length === 0) {
                        }
                    }
                }
            }, reconnectionTimeout);
        }
        this.updateActivity();
    }

    // ✅ NOUVEAU : Méthode pour transférer le host manuellement
    transferHost(newHostPseudo) {
        const newHost = this.getPlayer(newHostPseudo);
        if (!newHost || !newHost.connected) {
            return false;
        }

        const oldHost = this.creatorPseudo;
        this.creatorPseudo = newHostPseudo;
        this.updateActivity();

        console.log(`👑 Transfert de host: ${oldHost} → ${newHostPseudo} dans room ${this.code}`);
        return true;
    }

    // ✅ NOUVEAU : Méthode pour transférer automatiquement le host
    transferHostToNextPlayer() {
        const connectedPlayers = this.getConnectedPlayers();

        if (connectedPlayers.length === 0) {
            console.log(`👑 Aucun joueur connecté pour recevoir le host dans room ${this.code}`);
            return null;
        }

        // Prendre le premier joueur connecté (le plus ancien)
        const newHost = connectedPlayers[0];
        const oldHost = this.creatorPseudo;
        this.creatorPseudo = newHost.pseudo;
        this.updateActivity();

        console.log(`👑 Transfert automatique de host: ${oldHost} → ${newHost.pseudo} dans room ${this.code}`);
        return newHost.pseudo;
    }

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
        return connectedPlayers.length >= 2 && connectedPlayers.every(p => p.ready);
    }

    isCreator(pseudo) {
        return pseudo === this.creatorPseudo;
    }

    isEmpty() {
        return this.getConnectedPlayers().length === 0;
    }

    isExpired() {
        return Date.now() - this.lastActivity > ROOM_TIMEOUT;
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
    }

    resetForNewRound() {
        this.players.forEach(player => {
            player.currentRoundAnswer = null;
            player.hasFoundThisRound = false;
        });
    }
}

class OnlineGame {
    constructor(room, songData) {
        this.room = room;
        this.currentRound = 1;
        this.maxRounds = room.maxRounds;
        this.level = 1;
        this.maxLevel = 3;
        this.state = GAME_STATES.COUNTDOWN;
        this.currentSong = songData;
        this.answers = new Map();
        this.correctPlayers = new Set();
        this.timer = null;
        this.startTime = Date.now();
        this.currentAnswerTime = MIN_ANSWER_TIME;

    }

    cleanup() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    addAnswer(pseudo, answer) {
        const player = this.room.getPlayer(pseudo);
        if (!player) {
            return false;
        }

        // Permettre à tout le monde de répondre à chaque niveau
        // Seuls ceux qui ont déjà répondu à CE niveau sont bloqués
        if (player.currentRoundAnswer && player.currentRoundAnswer.level === this.level) {
            return false;
        }

        const isCorrect = normalize(answer.trim()) === normalize(this.currentSong.artist);

        this.answers.set(pseudo, {
            text: answer.trim(),
            level: this.level,
            timestamp: Date.now(),
            isCorrect
        });

        player.currentRoundAnswer = {
            text: answer.trim(),
            level: this.level,
            isCorrect
        };

        if (isCorrect) {
            player.hasFoundThisRound = true;
            this.correctPlayers.add(pseudo);
        } else {
        }

        return true;
    }

    hasAllAnswered() {
        const connectedPlayers = this.room.getConnectedPlayers();
        return connectedPlayers.every(player =>
            player.currentRoundAnswer !== null || player.hasFoundThisRound
        );
    }

    getResults() {
        return Array.from(this.answers.entries()).map(([pseudo, answer]) => ({
            pseudo,
            answer: answer.text,
            isCorrect: answer.isCorrect,
            level: answer.level,
            alreadyFound: false // Ne jamais marquer comme "déjà trouvé" pour les points
        }));
    }

    calculateAnswerTime(audioFilename) {
        // ✅ NOUVEAU : Utiliser le temps configuré par la room
        const configuredTime = this.room.answerTimeSettings.current;
        this.currentAnswerTime = configuredTime;
        return this.currentAnswerTime;
    }
}

function selectRandomSong(room) {
    try {
        const audioDir = path.join(__dirname, 'public', 'audio');
        const files = fs.readdirSync(audioDir);
        const level1Files = files.filter(f => f.startsWith('Level 1 -') && f.endsWith('.mp3'));
        let availableFiles = level1Files.filter(f => !room.playedSongs.has(f));

        // ✅ CORRECTION : Sélection aléatoire pour mode rapide
        if (room.gameMode === GAME_MODES.QUICK) {
            // Si c'est la première fois, sélectionner 10 fichiers aléatoires
            if (!room.quickModeSelection) {
                // Mélanger tous les fichiers disponibles et prendre les 10 premiers
                const shuffledFiles = [...level1Files].sort(() => Math.random() - 0.5);
                room.quickModeSelection = shuffledFiles.slice(0, 10);
            }
            availableFiles = room.quickModeSelection.filter(f => !room.playedSongs.has(f));
        }

        if (availableFiles.length === 0) {
            room.playedSongs.clear();
            return selectRandomSong(room);
        }

        const selectedFile = availableFiles[Math.floor(Math.random() * availableFiles.length)];
        const artist = selectedFile.replace('Level 1 - ', '').replace('.mp3', '');

        room.playedSongs.add(selectedFile);

        return {
            artist,
            level1File: selectedFile,
            level2File: selectedFile.replace('Level 1 -', 'Level 2 -'),
            level3File: selectedFile.replace('Level 1 -', 'Level 3 -'),
            level1Url: `${BASE_URL}/${encodeURIComponent(selectedFile)}`,
            level2Url: `${BASE_URL}/${encodeURIComponent(selectedFile.replace('Level 1 -', 'Level 2 -'))}`,
            level3Url: `${BASE_URL}/${encodeURIComponent(selectedFile.replace('Level 1 -', 'Level 3 -'))}`
        };
    } catch (error) {
        return null;
    }
}

function cleanupExpiredRooms() {
    const expiredRooms = [];
    const disconnectedRooms = [];

    onlineRooms.forEach((room, code) => {
        // ✅ NOUVEAU : Vérifier si tous les joueurs sont déconnectés
        const allPlayersDisconnected = room.getAllPlayers().length > 0 &&
            room.getConnectedPlayers().length === 0;

        if (room.isEmpty() || room.isExpired()) {
            expiredRooms.push(code);
        } else if (allPlayersDisconnected) {
            // ✅ NOUVEAU : Délai de grâce avant suppression (2 minutes)
            const gracePeriod = 2 * 60 * 1000; // 2 minutes
            const oldestDisconnection = Math.min(
                ...room.getAllPlayers()
                    .filter(p => !p.connected && p.disconnectedAt)
                    .map(p => p.disconnectedAt)
            );

            if (oldestDisconnection && (Date.now() - oldestDisconnection) > gracePeriod) {
                disconnectedRooms.push(code);
                console.log(`🚫 Room ${code}: Tous les joueurs déconnectés depuis plus de 2min`);
            }
        }
    });

    // Supprimer les rooms expirées normalement
    expiredRooms.forEach(code => {
        const room = onlineRooms.get(code);
        if (room && room.game) {
            room.game.cleanup();
        }
        onlineRooms.delete(code);
    });

    // ✅ NOUVEAU : Supprimer les rooms où tous les joueurs sont déconnectés
    disconnectedRooms.forEach(code => {
        const room = onlineRooms.get(code);
        if (room) {
            console.log(`🧹 Suppression room ${code}: Tous joueurs déconnectés`);
            if (room.game) {
                room.game.cleanup();
            }
            onlineRooms.delete(code);
        }
    });

    if (expiredRooms.length > 0 || disconnectedRooms.length > 0) {
        console.log(`🧹 Nettoyage: ${expiredRooms.length} expirées + ${disconnectedRooms.length} déconnectées`);
    }
}

// ✅ NOUVEAU : Ajouter cette nouvelle fonction
function checkRoomAfterDisconnection(room, io) {
    // Vérifier si tous les joueurs connectés sont partis
    const connectedPlayers = room.getConnectedPlayers();

    if (connectedPlayers.length === 0 && room.getAllPlayers().length > 0) {
        console.log(`⚠️ Room ${room.code}: Plus aucun joueur connecté`);

        // Délai de grâce de 30 secondes pour une reconnexion rapide
        setTimeout(() => {
            const currentRoom = onlineRooms.get(room.code);
            if (currentRoom && currentRoom.getConnectedPlayers().length === 0) {
                console.log(`🧹 Suppression immédiate room ${room.code}: Aucune reconnexion`);

                if (currentRoom.game) {
                    currentRoom.game.cleanup();
                }
                onlineRooms.delete(room.code);
            }
        }, 30000); // 30 secondes de grâce
    }
}

setInterval(cleanupExpiredRooms, 5 * 60 * 1000);

function handleOnlineSocketConnection(socket, io) {

    socket.on('create-online-room', ({ pseudo, gameMode = GAME_MODES.NORMAL }) => {
        try {

            if (!pseudo || pseudo.trim().length < 2) {
                socket.emit('online-room-result', {
                    success: false,
                    error: 'Pseudo invalide'
                });
                return;
            }

            // ✅ NOUVEAU : Validation du mode de jeu
            const validGameMode = Object.values(GAME_MODES).includes(gameMode) ? gameMode : GAME_MODES.NORMAL;

            const code = generateRoomCode();
            const room = new OnlineRoom(code, pseudo.trim(), socket.id, validGameMode);
            onlineRooms.set(code, room);

            socket.join(code);
            socket.data.onlineRoom = code;
            socket.data.onlinePseudo = pseudo.trim();

            socket.emit('online-room-result', {
                success: true,
                code,
                shareLink: room.shareLink,
                maxRounds: room.maxRounds,
                gameMode: room.gameMode,
                isCreator: true,
                message: `Room ${code} créée avec ${room.maxRounds} manches (${validGameMode}) !`
            });

            emitRoomUpdate(room, io);
            // ✅ NOUVEAU : Envoyer les settings séparément pour le créateur
            emitSettingsUpdate(room, io);

        } catch (error) {
            socket.emit('online-room-result', {
                success: false,
                error: 'Erreur serveur'
            });
        }
    });

    socket.on('join-online-room', ({ code, pseudo, gameMode }) => {
        try {
            const room = onlineRooms.get(code);

            if (!room) {
                socket.emit('online-join-result', {
                    success: false,
                    error: 'Room introuvable'
                });
                return;
            }

            if (room.state !== ROOM_STATES.WAITING) {
                // ✅ NOUVEAU : Permettre la reconnexion si le joueur existe déjà
                const cleanPseudo = pseudo.trim();
                const existingPlayer = room.getPlayer(cleanPseudo);

                if (!existingPlayer) {
                    socket.emit('online-join-result', {
                        success: false,
                        error: 'Partie en cours - impossible de rejoindre'
                    });
                    return;
                }

            }

            if (room.players.size >= 8) {
                socket.emit('online-join-result', {
                    success: false,
                    error: 'Room pleine'
                });
                return;
            }

            const cleanPseudo = pseudo.trim();
            if (room.players.has(cleanPseudo)) {
                const existingPlayer = room.getPlayer(cleanPseudo);

                // Vérifier si c'est une reconnexion (joueur déconnecté)
                if (existingPlayer && !existingPlayer.connected) {

                    // Reconnecter le joueur
                    existingPlayer.connected = true;
                    existingPlayer.socketId = socket.id;
                    existingPlayer.reconnectedAt = Date.now(); // ✅ NOUVEAU : Timestamp de reconnexion

                    socket.join(code);
                    socket.data.onlineRoom = code;
                    socket.data.onlinePseudo = cleanPseudo;

                    let reconnectionMessage = `🔄 Reconnexion réussie à la room ${code} !`;
                    let gameState = null;

                    // ✅ NOUVEAU : Différents états de reconnexion
                    if (room.state === ROOM_STATES.PLAYING && room.game) {
                        gameState = {
                            round: room.game.currentRound,
                            maxRounds: room.game.maxRounds,
                            level: room.game.level,
                            maxLevel: room.game.maxLevel,
                            state: room.game.state,
                            timeLeft: null, // Sera synchronisé via timer-update
                            currentSong: room.game.currentSong
                        };

                        // Messages contextuels selon l'état du jeu
                        if (room.game.state === GAME_STATES.ANSWERING) {
                            reconnectionMessage = `🔄 Reconnexion - Manche ${room.game.currentRound}, Niveau ${room.game.level} en cours`;
                        } else if (room.game.state === GAME_STATES.RESULTS) {
                            reconnectionMessage = `🔄 Reconnexion - En attente du prochain niveau/manche`;
                        } else {
                            reconnectionMessage = `🔄 Reconnexion - Partie en cours (Manche ${room.game.currentRound})`;
                        }
                    } else if (room.state === ROOM_STATES.STARTING) {
                        reconnectionMessage = `🔄 Reconnexion - Partie en cours de démarrage`;
                    } else if (room.state === ROOM_STATES.FINISHED) {
                        reconnectionMessage = `🔄 Reconnexion - Partie terminée`;
                    }

                    socket.emit('online-join-result', {
                        success: true,
                        code,
                        shareLink: room.shareLink,
                        maxRounds: room.maxRounds,
                        gameMode: room.gameMode,
                        isCreator: room.isCreator(cleanPseudo),
                        message: `Vous avez rejoint la room ${code} !`
                    });

                    emitRoomUpdate(room, io);
                    // ✅ NOUVEAU : Envoyer les settings pour les nouveaux joueurs
                    emitSettingsUpdate(room, io);

                    // ✅ NOUVEAU : Notifier les autres joueurs de la reconnexion
                    socket.to(code).emit('player-reconnected', {
                        pseudo: cleanPseudo,
                        message: `${cleanPseudo} s'est reconnecté`
                    });


                    // ✅ NOUVEAU : Synchronisation spécifique selon l'état du jeu
                    if (room.state === ROOM_STATES.PLAYING && room.game) {
                        // Envoyer l'état complet du jeu au joueur reconnecté
                        socket.emit('game-state-sync', {
                            gameState: gameState,
                            isInGame: true,
                            currentSong: room.game.currentSong,
                            playerState: {
                                hasFoundThisRound: existingPlayer.hasFoundThisRound,
                                currentAnswer: existingPlayer.currentRoundAnswer,
                                canAnswer: !existingPlayer.hasFoundThisRound && room.game.state === GAME_STATES.ANSWERING
                            }
                        });

                        // Si une phase de réponse est en cours, synchroniser le timer
                        if (room.game.state === GAME_STATES.ANSWERING && room.game.timer) {
                            socket.emit('answer-phase-started', {
                                timeLimit: room.game.currentAnswerTime
                            });
                        }
                    }

                    return;
                }

                // Vérifier si c'est le même socket qui essaie de rejoindre (refresh page)
                if (existingPlayer && existingPlayer.socketId === socket.id) {
                    // ... reste du code existant pour le refresh
                }

                // Sinon, c'est vraiment un pseudo déjà utilisé par un autre socket connecté
                if (existingPlayer && existingPlayer.connected) {
                    socket.emit('online-join-result', {
                        success: false,
                        error: 'Pseudo déjà utilisé par un joueur connecté'
                    });
                    return;
                }
            }

            room.addPlayer(cleanPseudo, socket.id);
            socket.join(code);
            socket.data.onlineRoom = code;
            socket.data.onlinePseudo = cleanPseudo;

            socket.emit('online-join-result', {
                success: true,
                code,
                shareLink: room.shareLink,
                maxRounds: room.maxRounds,
                gameMode: room.gameMode, // ✅ NOUVEAU : Envoyer le mode de la room
                isCreator: room.isCreator(cleanPseudo),
                message: `Vous avez rejoint la room ${code} !`
            });

            emitRoomUpdate(room, io);

        } catch (error) {
            socket.emit('online-join-result', {
                success: false,
                error: 'Erreur serveur'
            });
        }
    });

    socket.on('change-pseudo', ({ oldPseudo, newPseudo }) => {
        try {
            const { onlineRoom, onlinePseudo } = socket.data;

            console.log('🔄 Changement pseudo serveur:', {
                oldPseudo,
                newPseudo,
                socketDataPseudo: onlinePseudo,
                socketId: socket.id
            });

            if (onlinePseudo !== oldPseudo) {
                console.error('❌ Incohérence pseudo serveur:', {
                    socketData: onlinePseudo,
                    oldPseudo
                });
                socket.emit('pseudo-change-result', {
                    success: false,
                    error: 'Incohérence de pseudo'
                });
                return;
            }

            const room = onlineRooms.get(onlineRoom);
            if (!room || !oldPseudo || !newPseudo) {
                socket.emit('pseudo-change-result', {
                    success: false,
                    error: 'Données manquantes'
                });
                return;
            }

            const cleanNewPseudo = newPseudo.trim();

            if (cleanNewPseudo.length < 2) {
                socket.emit('pseudo-change-result', {
                    success: false,
                    error: 'Pseudo trop court (minimum 2 caractères)'
                });
                return;
            }

            if (cleanNewPseudo === oldPseudo.trim()) {
                socket.emit('pseudo-change-result', {
                    success: false,
                    error: 'Pseudo identique'
                });
                return;
            }

            if (room.players.has(cleanNewPseudo)) {
                socket.emit('pseudo-change-result', {
                    success: false,
                    error: 'Pseudo déjà utilisé'
                });
                return;
            }

            const player = room.getPlayer(oldPseudo);
            if (!player) {
                socket.emit('pseudo-change-result', {
                    success: false,
                    error: 'Joueur introuvable'
                });
                return;
            }

            // ✅ CORRECTION : Mise à jour atomique sans suppression/recréation
            const wasCreator = room.creatorPseudo === oldPseudo;
            const score = room.scores.get(oldPseudo) || 0;

            // Mettre à jour le pseudo dans l'objet player
            player.pseudo = cleanNewPseudo;

            // Transférer dans les Maps de façon atomique
            room.players.delete(oldPseudo);
            room.scores.delete(oldPseudo);
            room.players.set(cleanNewPseudo, player);
            room.scores.set(cleanNewPseudo, score);

            // Mettre à jour le créateur si nécessaire
            if (wasCreator) {
                room.creatorPseudo = cleanNewPseudo;
            }

            // ✅ CORRECTION CRITIQUE : Mettre à jour les données socket
            console.log('🔄 Mise à jour socket.data.onlinePseudo:', onlinePseudo, '→', cleanNewPseudo);
            socket.data.onlinePseudo = cleanNewPseudo;

            // Mettre à jour le jeu en cours si nécessaire
            if (room.game && room.game.answers.has(oldPseudo)) {
                const answer = room.game.answers.get(oldPseudo);
                room.game.answers.delete(oldPseudo);
                room.game.answers.set(cleanNewPseudo, answer);
                console.log('🎮 Réponse déplacée dans le jeu:', oldPseudo, '→', cleanNewPseudo);
            }

            room.updateActivity();

            console.log('✅ Changement pseudo serveur terminé:', {
                oldPseudo,
                newPseudo: cleanNewPseudo,
                newSocketData: socket.data.onlinePseudo,
                wasCreator
            });

            socket.emit('pseudo-change-result', {
                success: true,
                newPseudo: cleanNewPseudo,
                isCreator: wasCreator
            });

            // Notification immédiate des autres joueurs
            emitRoomUpdate(room, io);

        } catch (error) {
            console.error('❌ Erreur changement pseudo serveur:', error);
            socket.emit('pseudo-change-result', {
                success: false,
                error: 'Erreur serveur'
            });
        }
    });

    socket.on('toggle-ready', () => {
        const { onlineRoom, onlinePseudo } = socket.data;
        const room = onlineRooms.get(onlineRoom);

        if (!room || !onlinePseudo) return;

        const player = room.getPlayer(onlinePseudo);
        if (player) {
            player.ready = !player.ready;
            room.updateActivity();
            emitRoomUpdate(room, io);
        }
    });

    socket.on('start-game', ({ room: roomCode, artistCount }) => {
        const { onlinePseudo } = socket.data;
        const room = onlineRooms.get(roomCode);

        if (!room || !onlinePseudo) return;

        if (!room.isCreator(onlinePseudo)) {
            socket.emit('game-error', { error: 'Seul le créateur peut démarrer la partie' });
            return;
        }

        if (!room.allPlayersReady()) {
            socket.emit('game-error', { error: 'Tous les joueurs doivent être prêts' });
            return;
        }

        if (room.getConnectedPlayers().length < 2) {
            socket.emit('game-error', { error: 'Minimum 2 joueurs requis' });
            return;
        }

        if (artistCount && artistCount !== room.maxRounds) {
            const success = room.updateArtistCount(artistCount);

            if (!success) {
                const range = room.getArtistCountRange();
                socket.emit('game-error', {
                    error: `Configuration invalide: ${range.min}-${range.max} artistes autorisés`
                });
                return;
            }

            emitRoomUpdate(room, io);
        }

        startGame(room, io);
    });


    // Dans la fonction qui traite submit-answer
    socket.on('submit-answer', ({ answer }) => {
        const { onlineRoom, onlinePseudo } = socket.data;
        const room = onlineRooms.get(onlineRoom);

        console.log('📥 Réponse reçue serveur:', {
            answer,
            socketDataPseudo: onlinePseudo,
            socketId: socket.id,
            roomExists: !!room,
            gameExists: !!(room?.game),
            gameState: room?.game?.state
        });

        if (!room || !room.game || room.game.state !== GAME_STATES.ANSWERING) {
            console.warn('❌ Réponse rejetée - conditions non remplies');
            return;
        }

        const success = room.game.addAnswer(onlinePseudo, answer);

        console.log('🎯 Résultat addAnswer:', {
            pseudo: onlinePseudo,
            answer,
            success
        });

        if (success) {
            room.updateActivity();

            // ✅ NOUVEAU : Envoyer le feedback immédiatement au joueur
            const playerAnswer = room.game.answers.get(onlinePseudo);
            if (playerAnswer) {
                socket.emit('answer-feedback', {
                    isCorrect: playerAnswer.isCorrect,
                    answer: playerAnswer.text,
                    pseudo: onlinePseudo,
                    level: room.game.level
                });
            }

            io.to(onlineRoom).emit('player-answered', {
                pseudo: onlinePseudo
            });

            emitRoomUpdate(room, io);

            if (room.game.hasAllAnswered()) {
                endAnswerPhase(room, io);
            }
        } else {
            socket.emit('answer-rejected', {
                reason: 'Vous avez déjà répondu à ce niveau'
            });
        }
    });

    socket.on('disconnect', () => {
        const { onlineRoom, onlinePseudo } = socket.data;
        if (!onlineRoom || !onlinePseudo) return;

        const room = onlineRooms.get(onlineRoom);
        if (room) {
            const wasHost = room.isCreator(onlinePseudo);

            room.removePlayer(onlinePseudo);

            // ✅ NOUVEAU : Notifier le transfert automatique de host
            if (wasHost && room.getConnectedPlayers().length > 0) {
                io.to(onlineRoom).emit('host-transferred', {
                    newHost: room.creatorPseudo,
                    oldHost: onlinePseudo,
                    message: `${room.creatorPseudo} est maintenant le host de la room`,
                    isAutomatic: true
                });
            }

            // ✅ NOUVEAU : Vérification immédiate après déconnexion
            checkRoomAfterDisconnection(room, io);

            if (room.isEmpty()) {
                if (room.game) room.game.cleanup();
                onlineRooms.delete(onlineRoom);
            } else {
                emitRoomUpdate(room, io);
            }
        }
    });

    // ✅ NOUVEAU : Événement pour le transfert manuel de host
    // ✅ CORRECTION dans l'événement 'transfer-host'
    socket.on('transfer-host', ({ targetPseudo }) => {
        const { onlineRoom, onlinePseudo } = socket.data;
        const room = onlineRooms.get(onlineRoom);

        if (!room || !onlinePseudo) {
            socket.emit('transfer-host-result', {
                success: false,
                error: 'Room introuvable'
            });
            return;
        }

        if (!room.isCreator(onlinePseudo)) {
            socket.emit('transfer-host-result', {
                success: false,
                error: 'Seul le host peut transférer son rôle'
            });
            return;
        }

        if (!targetPseudo || targetPseudo === onlinePseudo) {
            socket.emit('transfer-host-result', {
                success: false,
                error: 'Impossible de se transférer le host à soi-même'
            });
            return;
        }

        if (room.state !== ROOM_STATES.WAITING) {
            socket.emit('transfer-host-result', {
                success: false,
                error: 'Impossible de changer de host pendant une partie'
            });
            return;
        }

        const success = room.transferHost(targetPseudo);

        if (success) {
            socket.emit('transfer-host-result', {
                success: true,
                newHost: targetPseudo,
                oldHost: onlinePseudo
            });

            // ✅ CORRECTION : Notifier TOUTE la room du changement, y compris l'ancien host
            io.to(onlineRoom).emit('host-transferred', {
                newHost: targetPseudo,
                oldHost: onlinePseudo,
                message: `${targetPseudo} est maintenant le host de la room`
            });

            // ✅ AJOUT : Mise à jour immédiate de la room pour synchroniser les états
            emitRoomUpdate(room, io);
        } else {
            socket.emit('transfer-host-result', {
                success: false,
                error: 'Joueur introuvable ou déconnecté'
            });
        }
    });

    // Ajouter dans handleOnlineSocketConnection, après les autres handlers
    socket.on('update-artist-count', ({ count }) => {
        const { onlineRoom, onlinePseudo } = socket.data;
        const room = onlineRooms.get(onlineRoom);

        if (!room || !onlinePseudo) {
            socket.emit('artist-count-update-result', {
                success: false,
                error: 'Room introuvable'
            });
            return;
        }

        if (!room.isCreator(onlinePseudo)) {
            socket.emit('artist-count-update-result', {
                success: false,
                error: 'Seul le créateur peut modifier ce paramètre'
            });
            return;
        }

        const success = room.updateArtistCount(count);

        if (success) {
            socket.emit('artist-count-update-result', {
                success: true,
                newCount: count
            });

            // ✅ NOUVEAU : Mise à jour spécifique des settings seulement
            emitSettingsUpdate(room, io);
        } else {
            const range = room.getArtistCountRange();
            socket.emit('artist-count-update-result', {
                success: false,
                error: `Nombre d'artistes invalide (${range.min}-${range.max})`
            });
        }
    });

    socket.on('update-answer-time', ({ seconds }) => {
        const { onlineRoom, onlinePseudo } = socket.data;
        const room = onlineRooms.get(onlineRoom);

        if (!room || !onlinePseudo) {
            socket.emit('answer-time-update-result', {
                success: false,
                error: 'Room introuvable'
            });
            return;
        }

        if (!room.isCreator(onlinePseudo)) {
            socket.emit('answer-time-update-result', {
                success: false,
                error: 'Seul le créateur peut modifier ce paramètre'
            });
            return;
        }

        const success = room.updateAnswerTime(seconds);

        if (success) {
            socket.emit('answer-time-update-result', {
                success: true,
                newTime: seconds
            });

            // ✅ NOUVEAU : Mise à jour spécifique des settings seulement
            emitSettingsUpdate(room, io);
        } else {
            const settings = room.getAnswerTimeSettings();
            socket.emit('answer-time-update-result', {
                success: false,
                error: `Temps invalide (${settings.min}-${settings.max}s)`
            });
        }
    });

    socket.on('kick-player', ({ targetPseudo }) => {
        const { onlineRoom, onlinePseudo } = socket.data;
        const room = onlineRooms.get(onlineRoom);

        if (!room || !onlinePseudo) {
            socket.emit('kick-result', {
                success: false,
                error: 'Room introuvable'
            });
            return;
        }

        if (!room.isCreator(onlinePseudo)) {
            socket.emit('kick-result', {
                success: false,
                error: 'Seul le créateur peut exclure des joueurs'
            });
            return;
        }

        if (!targetPseudo || targetPseudo === onlinePseudo) {
            socket.emit('kick-result', {
                success: false,
                error: 'Impossible de s\'exclure soi-même'
            });
            return;
        }

        const targetPlayer = room.getPlayer(targetPseudo);
        if (!targetPlayer) {
            socket.emit('kick-result', {
                success: false,
                error: 'Joueur introuvable'
            });
            return;
        }

        // Notifier le joueur exclu
        if (targetPlayer.socketId) {
            io.to(targetPlayer.socketId).emit('player-kicked', {
                kickedPseudo: targetPseudo,
                message: `Vous avez été exclu de la room par ${onlinePseudo}`
            });

            // Déconnecter le socket du joueur exclu
            const targetSocket = io.sockets.sockets.get(targetPlayer.socketId);
            if (targetSocket) {
                targetSocket.leave(onlineRoom);
                targetSocket.data.onlineRoom = null;
                targetSocket.data.onlinePseudo = null;
            }
        }

        // Supprimer le joueur de la room
        room.players.delete(targetPseudo);
        room.scores.delete(targetPseudo);

        socket.emit('kick-result', {
            success: true,
            kickedPseudo: targetPseudo
        });

        // Notifier tous les autres joueurs
        io.to(onlineRoom).emit('player-kicked', {
            kickedPseudo: targetPseudo,
            message: `${targetPseudo} a été exclu de la room`
        });

        emitRoomUpdate(room, io);
    });

    socket.on('refresh-room-data', () => {
        const { onlineRoom } = socket.data;
        const room = onlineRooms.get(onlineRoom);

        if (room) {
            emitRoomUpdate(room, io);
        }
    });
}

function startGame(room, io) {
    room.state = ROOM_STATES.STARTING;
    io.to(room.code).emit('game-starting');

    setTimeout(() => {
        const songData = selectRandomSong(room);
        if (!songData) {
            room.reset();
            io.to(room.code).emit('game-error', { error: 'Aucune chanson disponible' });
            return;
        }

        room.state = ROOM_STATES.PLAYING;
        room.game = new OnlineGame(room, songData);
        startRound(room, io);
    }, 2000);
}

function startRound(room, io) {
    const game = room.game;
    let countdown = 3;


    const countdownInterval = setInterval(() => {
        io.to(room.code).emit('countdown', { count: countdown });
        countdown--;

        if (countdown < 0) {
            clearInterval(countdownInterval);
            game.state = GAME_STATES.LISTENING;

            let audioUrl, audioFile;
            switch (game.level) {
                case 1:
                    audioUrl = game.currentSong.level1Url;
                    audioFile = game.currentSong.level1File;
                    break;
                case 2:
                    audioUrl = game.currentSong.level2Url;
                    audioFile = game.currentSong.level2File;
                    break;
                case 3:
                    audioUrl = game.currentSong.level3Url;
                    audioFile = game.currentSong.level3File;
                    break;
                default:
                    audioUrl = game.currentSong.level1Url;
                    audioFile = game.currentSong.level1File;
            }

            const answerTime = game.calculateAnswerTime(audioFile);

            io.to(room.code).emit('round-started', {
                round: game.currentRound,
                maxRounds: game.maxRounds,
                level: game.level,
                maxLevel: game.maxLevel,
                audioUrl,
                answerTime
            });

            // ✅ CORRECTION : Démarrer le timer immédiatement
            startAnswerPhase(room, io);
        }
    }, 1000);
}

function startAnswerPhase(room, io) {
    const game = room.game;
    game.state = GAME_STATES.ANSWERING;


    io.to(room.code).emit('answer-phase-started', {
        timeLimit: game.currentAnswerTime
    });

    let timeLeft = game.currentAnswerTime;
    game.timer = setInterval(() => {
        timeLeft--;
        io.to(room.code).emit('timer-update', { timeLeft });

        if (timeLeft <= 0) {
            clearInterval(game.timer);
            endAnswerPhase(room, io);
        }
    }, 1000);
}

function endAnswerPhase(room, io) {
    const game = room.game;
    if (game.timer) {
        clearInterval(game.timer);
        game.timer = null;
    }

    game.state = GAME_STATES.RESULTS;
    const results = game.getResults();

    // ✅ AJOUTER CE BLOC ICI
    results.forEach(result => {
        const player = room.getPlayer(result.pseudo);
        if (player && player.connected && player.socketId) {
            io.to(player.socketId).emit('answer-feedback', {
                isCorrect: result.isCorrect,
                answer: result.answer,
                pseudo: result.pseudo,
                level: game.level
            });
        }
    });

    // Remplace le console.log existant par :
    console.log(`📊 ROUND ${game.currentRound} LEVEL ${game.level} - Room ${room.code}`);
    console.log(`🎯 ARTISTE_ATTENDU: "${game.currentSong.artist}"`);
    console.log(`📝 TOTAL_JOUEURS: ${results.length}`);
    console.log(`✅ BONNES_REPONSES: ${results.filter(r => r.isCorrect).length}`);
    console.log('📋 DETAILS_REPONSES:', results.map(r => ({
        pseudo: r.pseudo,
        answer: r.answer,
        isCorrect: r.isCorrect
    })));

    // Attribution des points simplifiée
    results.forEach(result => {
        if (result.isCorrect) {
            const points = { 1: 5, 2: 3, 3: 1 }[game.level] || 1;
            const currentScore = room.scores.get(result.pseudo) || 0;
            const newScore = currentScore + points;
            room.scores.set(result.pseudo, newScore);
        }
    });

    const shouldRevealArtist = game.level === 3;

    io.to(room.code).emit('round-results', {
        artist: shouldRevealArtist ? game.currentSong.artist : null,
        level: game.level,
        results,
        scores: Object.fromEntries(room.scores),
        revealArtist: shouldRevealArtist
    });
    emitRoomUpdate(room, io);

    setTimeout(() => {
        const allFound = room.getConnectedPlayers().every(p => p.hasFoundThisRound);

        if (allFound || game.level >= 3) {
            if (!shouldRevealArtist) {
                io.to(room.code).emit('artist-revealed', {
                    artist: game.currentSong.artist
                });
            }
            nextRound(room, io);
        } else {
            nextLevel(room, io);
        }
    }, shouldRevealArtist ? 5000 : 3000);
}

function nextLevel(room, io) {
    const game = room.game;
    game.level++;
    game.answers.clear();

    // Reset les réponses pour permettre à tout le monde de répondre au nouveau niveau
    room.players.forEach(player => {
        if (!player.hasFoundThisRound) {
            player.currentRoundAnswer = null;
        }
    });

    // ✅ NOUVEAU : Notifier immédiatement le changement de niveau pour synchroniser les états
    emitRoomUpdate(room, io);

    startRound(room, io);
}

function nextRound(room, io) {
    const game = room.game;
    game.currentRound++;

    if (game.currentRound > game.maxRounds) {
        endGame(room, io);
    } else {

        // Reset complet pour nouvelle manche
        room.resetForNewRound();
        game.level = 1;
        game.answers.clear();
        game.correctPlayers.clear();

        const songData = selectRandomSong(room);
        if (songData) {
            game.currentSong = songData;
            emitRoomUpdate(room, io);
            startRound(room, io);
        } else {
            endGame(room, io);
        }
    }
}

function endGame(room, io) {
    room.state = ROOM_STATES.FINISHED;

    const finalRanking = Array.from(room.scores.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([pseudo, score], index) => ({
            rank: index + 1,
            pseudo,
            score
        }));

    io.to(room.code).emit('game-finished', {
        ranking: finalRanking,
        totalRounds: room.maxRounds
    });

    if (room.game) {
        room.game.cleanup();
    }

    setTimeout(() => {
        room.reset();
        emitRoomUpdate(room, io);
    }, 30000);
}

function emitRoomUpdate(room, io, options = {}) {
    const playersWithAnswers = room.getAllPlayers().map(player => ({
        ...player,
        currentAnswer: player.currentRoundAnswer,
        connectionStatus: player.connected ? 'connected' : 'disconnected',
        disconnectedAt: player.disconnectedAt || null,
        reconnectedAt: player.reconnectedAt || null,
        isReconnecting: !player.connected && player.disconnectedAt && (Date.now() - player.disconnectedAt) < 30000
    }));

    const baseData = {
        players: playersWithAnswers,
        scores: Object.fromEntries(room.scores),
        state: room.state,
        shareLink: room.shareLink,
        maxRounds: room.maxRounds,
        gameMode: room.gameMode,
        creatorPseudo: room.creatorPseudo
    };

    // ✅ NOUVEAU : Seulement inclure les paramètres de config si explicitement demandé
    if (options.includeSettings) {
        baseData.artistCountRange = room.getArtistCountRange();
        baseData.answerTimeSettings = room.getAnswerTimeSettings();
    }

    io.to(room.code).emit('room-updated', baseData);
}

// ✅ NOUVEAU : Fonction spécifique pour les mises à jour de configuration
function emitSettingsUpdate(room, io) {
    io.to(room.code).emit('settings-updated', {
        artistCountRange: room.getArtistCountRange(),
        answerTimeSettings: room.getAnswerTimeSettings()
    });
}

module.exports = { handleOnlineSocketConnection };