const buzzerGameManager = require('./services/buzzer-gameManager');
const buzzerBeatboxerManager = require('./services/buzzer-beatboxerManager');
const { BUZZER_CONFIG } = require('./constants');

/**
 * Gère les connexions Socket.IO pour Buzzer Battle
 */
function handleBuzzerSocketConnection(socket, io) {
    console.log(`🔌 Buzzer Battle - Nouvelle connexion: ${socket.id}`);

    // ==================== INFORMATIONS DISCORD ====================
    socket.on('discord:getInfo', (callback) => {
        try {
            if (socket.discordUser) {
                callback({
                    success: true,
                    user: {
                        username: socket.discordUser.username,
                        discordId: socket.discordUser.discordId,
                        avatar: socket.discordUser.avatar
                    }
                });
            } else {
                callback({
                    success: false,
                    user: null
                });
            }
        } catch (error) {
            console.error('❌ Erreur getDiscordInfo:', error);
            callback({ success: false, user: null });
        }
    });

    // ==================== OBTENIR LES FILTRES DISPONIBLES ====================
    socket.on('buzzer:getFilters', (callback) => {
        try {
            const countries = buzzerBeatboxerManager.getAllCountries(); // ✅ CORRECTION
            const events = buzzerBeatboxerManager.getAllEvents(); // ✅ CORRECTION

            callback({
                success: true,
                countries,
                events
            });
        } catch (error) {
            console.error('❌ Erreur getFilters:', error);
            callback({ success: false, error: error.message });
        }
    });

    // ==================== OBTENIR LE NOMBRE MAX DE BEATBOXERS ====================
    socket.on('buzzer:getMaxBeatboxers', ({ mode, filter }, callback) => {
        try {
            let beatboxers;

            if (mode === 'buzzer_country') {
                beatboxers = buzzerBeatboxerManager.getBeatboxersByCountry(filter);
            } else if (mode === 'buzzer_event') {
                beatboxers = buzzerBeatboxerManager.getBeatboxersByEvent(filter);
            } else {
                beatboxers = buzzerBeatboxerManager.beatboxersData;
            }

            const maxBeatboxers = beatboxers ? beatboxers.length : 0;

            callback({
                success: true,
                maxBeatboxers
            });
        } catch (error) {
            console.error('❌ Erreur getMaxBeatboxers:', error);
            callback({ success: false, error: error.message });
        }
    });

    // ==================== CRÉER UNE ROOM ====================
    socket.on('buzzer:createRoom', (config, callback) => {
        try {
            console.log('🎮 Création de room avec config:', config);

            if (!config) {
                return callback({ success: false, error: 'Configuration manquante' });
            }

            if (!config.username) {
                return callback({ success: false, error: 'Username requis' });
            }

            const roomCode = generateRoomCode();

            const game = buzzerGameManager.createGame(roomCode, socket.id, {
                mode: config.mode,
                filter: config.filter,
                totalRounds: config.totalRounds || 10
            });

            // ✅ AJOUT : Logs Discord
            console.log('👤 Création joueur:', {
                username: config.username,
                hasDiscordUser: !!socket.discordUser,
                discordId: socket.discordUser?.discordId,
                discordUsername: socket.discordUser?.username
            });

            // ✅ CORRECTION : Priorité au nom Discord côté serveur
            const finalUsername = socket.discordUser?.username || config.username;

            buzzerGameManager.addPlayer(roomCode, socket.id, {
                username: finalUsername,
                avatar: config.avatar || '🎤',
                score: 0,
                discordId: socket.discordUser?.discordId || null,
                discordAvatar: socket.discordUser?.avatar || null,
                isDiscordUser: !!socket.discordUser
            });

            console.log(`✅ Joueur ajouté: ${finalUsername} (Discord: ${!!socket.discordUser})`);
            // Rejoindre la room Socket.IO
            socket.join(roomCode);

            const updatedGame = buzzerGameManager.getGame(roomCode);

            console.log(`✅ Room créée: ${roomCode} par ${config.username} - Status: ${updatedGame.status}`); // ✅ LOG AJOUTÉ

            callback({
                success: true,
                roomCode,
                game: updatedGame
            });
        } catch (error) {
            console.error('❌ Erreur createRoom:', error);
            callback({ success: false, error: error.message });
        }
    });

    // ==================== REJOINDRE UNE ROOM ====================
    socket.on('buzzer:joinRoom', ({ roomCode, username, avatar }, callback) => {
        try {
            const game = buzzerGameManager.getGame(roomCode);

            if (!game) {
                return callback({ success: false, error: 'Room introuvable' });
            }

            if (game.status !== 'waiting') {
                return callback({ success: false, error: 'Partie déjà commencée' });
            }

            const existingPlayer = Object.values(game.players).find(
                p => {
                    if (socket.discordUser?.discordId && p.discordId) {
                        return p.discordId === socket.discordUser.discordId;
                    }
                    return p.username === username;
                }
            );
            if (existingPlayer) {
                console.log(`🔄 Reconnexion détectée: ${username}`);

                const oldSocketId = existingPlayer.id;
                const rooms = Array.from(socket.rooms);
                rooms.forEach(room => {
                    if (room !== socket.id) {
                        socket.leave(room);
                    }
                });
            }

            // ✅ AJOUT : Données Discord
            buzzerGameManager.addPlayer(roomCode, socket.id, {
                username,
                avatar,
                discordId: socket.discordUser?.discordId || null,
                discordAvatar: socket.discordUser?.avatar || null,
                isDiscordUser: !!socket.discordUser
            });
            socket.join(roomCode);

            // Récupérer le jeu mis à jour
            const updatedGame = buzzerGameManager.getGame(roomCode);

            // Notifier tous les joueurs avec l'état de connexion
            const playersWithStatus = Object.fromEntries(
                Object.entries(updatedGame.players).map(([id, player]) => [
                    id,
                    { ...player, connected: player.connected !== false } // Assurer que connected est true par défaut
                ])
            );

            io.to(roomCode).emit('buzzer:playerJoined', {
                player: updatedGame.players[socket.id],
                players: playersWithStatus,
                totalPlayers: Object.keys(updatedGame.players).length
            });

            // ✅ S'assurer que la configuration est bien retournée
            const gameResponse = {
                ...updatedGame,
                mode: updatedGame.mode,
                filter: updatedGame.filter,
                totalRounds: updatedGame.totalRounds
            };

            // ✅ S'assurer que la configuration est bien retournée
            callback({
                success: true,
                game: {
                    ...updatedGame,
                    mode: updatedGame.mode,
                    filter: updatedGame.filter,
                    totalRounds: updatedGame.totalRounds
                }
            });

            console.log(`✅ ${username} a rejoint ${roomCode} (total: ${Object.keys(updatedGame.players).length})`);
        } catch (error) {
            console.error('❌ Erreur joinRoom:', error);
            callback({ success: false, error: error.message });
        }
    });

    // ==================== METTRE À JOUR LA CONFIGURATION ====================
    socket.on('buzzer:updateConfig', ({ roomCode, mode, filter, totalRounds }, callback) => {
        try {
            const game = buzzerGameManager.getGame(roomCode);

            if (!game) {
                return callback({ success: false, error: 'Room introuvable' });
            }

            if (game.status !== 'waiting') {
                return callback({ success: false, error: 'Impossible de modifier pendant la partie' });
            }

            // Mettre à jour la configuration
            game.mode = mode;
            game.filter = filter;
            game.totalRounds = totalRounds;

            // Notifier tous les joueurs
            io.to(roomCode).emit('buzzer:configUpdated', {
                mode,
                filter,
                totalRounds
            });

            callback({ success: true });
            console.log(`⚙️ Configuration mise à jour pour ${roomCode}: ${mode} - ${filter}`);
        } catch (error) {
            console.error('❌ Erreur updateConfig:', error);
            callback({ success: false, error: error.message });
        }
    });

    // ==================== KICK JOUEUR ====================
    socket.on('buzzer:kickPlayer', ({ roomCode, targetPlayerId }, callback) => {
        try {
            const game = buzzerGameManager.getGame(roomCode);

            if (!game) {
                return callback({ success: false, error: 'Room introuvable' });
            }

            // Vérifier que c'est le créateur qui kick
            if (socket.id !== game.creatorId) {
                return callback({ success: false, error: 'Seul le créateur peut exclure des joueurs' });
            }

            // Vérifier qu'on ne peut pas se kick soi-même
            if (targetPlayerId === socket.id) {
                return callback({ success: false, error: 'Vous ne pouvez pas vous exclure vous-même' });
            }

            // Vérifier que le joueur existe
            const targetPlayer = game.players[targetPlayerId];
            if (!targetPlayer) {
                return callback({ success: false, error: 'Joueur introuvable' });
            }

            const targetUsername = targetPlayer.username;

            // Notifier le joueur exclu
            io.to(targetPlayerId).emit('buzzer:kicked', {
                kickedBy: game.players[socket.id].username,
                message: `Vous avez été exclu de la room par ${game.players[socket.id].username}`
            });

            // Faire quitter la room au joueur exclu
            const targetSocket = io.sockets.sockets.get(targetPlayerId);
            if (targetSocket) {
                targetSocket.leave(roomCode);
            }

            // Supprimer le joueur
            delete game.players[targetPlayerId];

            // Notifier tous les joueurs restants
            io.to(roomCode).emit('buzzer:playerKicked', {
                playerId: targetPlayerId,
                username: targetUsername,
                kickedBy: game.players[socket.id].username
            });

            console.log(`🚫 ${targetUsername} exclu de ${roomCode} par ${game.players[socket.id].username}`);

            callback({ success: true, kickedUsername: targetUsername });

        } catch (error) {
            console.error('❌ Erreur kickPlayer:', error);
            callback({ success: false, error: error.message });
        }
    });

    // ==================== DÉMARRER LA PARTIE ====================
    socket.on('buzzer:startGame', ({ roomCode }, callback) => {
        try {
            const game = buzzerGameManager.getGame(roomCode);

            if (!game) {
                return callback({ success: false, error: 'Room introuvable' });
            }

            if (socket.id !== game.creatorId) {
                return callback({ success: false, error: 'Seul le créateur peut démarrer' });
            }

            if (game.status !== 'waiting') {
                return callback({ success: false, error: 'Partie déjà commencée' });
            }

            console.log(`⏱️ Countdown démarré pour la room ${roomCode}`);

            let countdown = 3;
            const countdownInterval = setInterval(() => {
                io.to(roomCode).emit('buzzer:countdown', countdown);
                countdown--;

                if (countdown < 0) {
                    clearInterval(countdownInterval);
                    io.to(roomCode).emit('buzzer:countdownEnd');
                }
            }, 1000);

            // ✅ Démarrer la partie après 4 secondes
            setTimeout(() => {
                const updatedGame = buzzerGameManager.startRound(roomCode);
                const beatboxerData = buzzerBeatboxerManager.getBeatboxerData(updatedGame.currentBeatboxer);

                console.log('🖼️ Données beatboxer:', {
                    title: updatedGame.currentBeatboxer.title,
                    imageUrl: beatboxerData.imageUrl,
                    hasLocalImage: !!updatedGame.currentBeatboxer.local_image
                });

                io.to(roomCode).emit('buzzer:gameStarted', {
                    currentRound: updatedGame.currentRound,
                    totalRounds: updatedGame.totalRounds,
                    beatboxerImage: beatboxerData.imageUrl
                });

                startBlurProgression(roomCode, io);

                callback({ success: true });
            }, 4000);

        } catch (error) {
            console.error('❌ Erreur startGame:', error);
            callback({ success: false, error: error.message });
        }
    });


    // ==================== BUZZER ====================
    socket.on('buzzer:buzz', ({ roomCode }, callback) => {
        try {
            const game = buzzerGameManager.getGame(roomCode);

            if (!game) {
                return callback({ success: false, error: 'Room introuvable' });
            }

            const result = buzzerGameManager.handleBuzz(roomCode, socket.id);

            if (!result) {
                return callback({ success: false, error: 'Quelqu\'un a déjà buzzé' });
            }

            // ✅ Vérifier que le joueur existe dans la partie
            const player = result.players[socket.id];
            if (!player) {
                console.error('❌ Joueur introuvable dans la partie:', socket.id);
                console.error('📋 Joueurs présents:', Object.keys(result.players));
                return callback({ success: false, error: 'Joueur introuvable. Veuillez vous reconnecter.' });
            }

            const clock = getRoundClock(io);

            clock.pauseForAnswer(roomCode, {
                onAnswerTimeout: (code) => {
                    const currentGame = buzzerGameManager.getGame(code);
                    if (!currentGame || currentGame.buzzedPlayer !== socket.id) {
                        // Le joueur a répondu entre-temps : la reprise est déjà faite
                        clock.resume(code);
                        return;
                    }

                    console.log(`⏰ Timeout pour ${player.username}`);
                    const timeoutResult = buzzerGameManager.checkGuess(code, socket.id, '___TIMEOUT___');
                    currentGame.buzzedPlayer = null;

                    io.to(code).emit('buzzer:wrongGuess', {
                        playerId: socket.id,
                        playerName: player.username,
                        scores: timeoutResult.scores,
                        currentPixelLevel: clock.pixelLevel(code),
                        reason: 'timeout'
                    });

                    clock.resume(code);
                },
            });

            // Le gestionnaire de partie garde une trace du niveau, pour les stats et la reconnexion
            game.pixelLevel = clock.pixelLevel(roomCode);

            io.to(roomCode).emit('buzzer:playerBuzzed', {
                playerId: socket.id,
                playerName: player.username,
                currentPixelLevel: game.pixelLevel
            });

            callback({ success: true });

        } catch (error) {
            console.error('❌ Erreur buzz:', error);
            callback({ success: false, error: error.message });
        }
    });

    // ==================== DEVINER ====================
    socket.on('buzzer:guess', ({ roomCode, answer }, callback) => {
        try {
            const game = buzzerGameManager.getGame(roomCode);

            if (!game) {
                return callback({ success: false, error: 'Room introuvable' });
            }

            if (game.buzzedPlayer !== socket.id) {
                return callback({ success: false, error: 'Ce n\'est pas à vous de deviner' });
            }

            const clock = getRoundClock(io);
            const result = buzzerGameManager.checkGuess(roomCode, socket.id, answer);

            if (!result) {
                return callback({ success: false, error: 'Erreur lors de la vérification' });
            }

            if (result.isCorrect) {
                // Bonne réponse : on révèle, puis l'horloge ferme la manche.
                // C'est elle qui enchaîne (manche suivante ou fin de partie), jamais ce handler :
                // un seul point de passage, donc pas de double avancement possible.
                io.to(roomCode).emit('buzzer:guessResult', {
                    playerId: socket.id,
                    isCorrect: true,
                    correctAnswer: result.correctAnswer,
                    scores: result.scores
                });

                clock.endCurrentRound(roomCode, 'answered');

                callback({ success: true, isCorrect: true });
            } else {
                // Mauvaise réponse : le buzzer se libère et le dévoilement repart où il s'était arrêté
                game.buzzedPlayer = null;

                io.to(roomCode).emit('buzzer:wrongGuess', {
                    playerId: socket.id,
                    playerName: game.players[socket.id].username,
                    scores: result.scores,
                    currentPixelLevel: clock.pixelLevel(roomCode)
                });

                clock.resume(roomCode);

                callback({ success: true, isCorrect: false });
            }
        } catch (error) {
            console.error('❌ Erreur guess:', error);
            callback({ success: false, error: error.message });
        }
    });

    // ==================== RESET GAME (REJOUER) ====================
    socket.on('buzzer:resetGame', ({ roomCode }, callback) => {
        try {
            const game = buzzerGameManager.getGame(roomCode);

            if (!game) {
                return callback({ success: false, error: 'Room introuvable' });
            }

            // Couper l'horloge de manche avant de remettre la partie à zéro
            stopBlurProgression(roomCode);

            // ✅ Réinitialiser le jeu
            game.status = 'waiting';
            game.currentRound = 0;
            game.currentBeatboxer = null;
            game.buzzedPlayer = null;
            game.pixelLevel = 100;
            game.usedBeatboxers = [];

            // ✅ Réinitialiser les scores des joueurs
            Object.values(game.players).forEach(player => {
                player.score = 0;
                player.buzzes = 0;
                player.correctGuesses = 0;
                player.wrongGuesses = 0;
            });

            // Notifier tous les joueurs
            io.to(roomCode).emit('buzzer:gameReset', {
                game: game
            });

            console.log(`🔄 Partie ${roomCode} réinitialisée`);

            callback({ success: true, game });
        } catch (error) {
            console.error('❌ Erreur resetGame:', error);
            callback({ success: false, error: error.message });
        }
    });

    // ==================== DÉCONNEXION ====================
    socket.on('disconnect', (reason) => {
        console.log(`🔌 Déconnexion Buzzer: ${socket.id}, raison: ${reason}`);

        // Trouver la room du joueur
        let playerRoom = null;
        let playerUsername = null;

        buzzerGameManager.games.forEach((game, roomCode) => {
            Object.values(game.players).forEach(player => {
                if (player.id === socket.id) {
                    playerRoom = roomCode;
                    playerUsername = player.username;
                }
            });
        });

        if (!playerRoom || !playerUsername) {
            console.log('⚠️ Joueur non trouvé dans aucune room');
            return;
        }

        const game = buzzerGameManager.getGame(playerRoom);
        if (!game) return;

        const player = game.players[socket.id];
        if (!player) return;

        const wasCreator = socket.id === game.creatorId;

        // Marquer le joueur comme déconnecté (mais le garder)
        player.connected = false;
        player.disconnectedAt = Date.now();

        console.log(`👋 ${playerUsername} déconnecté de ${playerRoom} (${wasCreator ? 'créateur' : 'joueur'})`);

        // Notifier les autres joueurs
        io.to(playerRoom).emit('buzzer:playerDisconnected', {
            playerId: socket.id,
            username: playerUsername,
            isCreator: wasCreator
        });

        // ✅ Si c'était le créateur, transférer le host
        if (wasCreator) {
            const connectedPlayers = Object.values(game.players).filter(p => p.connected);

            if (connectedPlayers.length > 0) {
                // Transférer au joueur connecté le plus ancien
                const newCreator = connectedPlayers.sort((a, b) =>
                    (a.joinedAt || 0) - (b.joinedAt || 0)
                )[0];

                game.creatorId = newCreator.id;

                console.log(`👑 Host transféré automatiquement: ${playerUsername} → ${newCreator.username}`);

                io.to(playerRoom).emit('buzzer:hostTransferred', {
                    oldHost: playerUsername,
                    newHost: newCreator.username,
                    newHostId: newCreator.id,
                    isAutomatic: true
                });
            }
        }

        // ✅ CRITIQUE : Vérifier immédiatement si la room est vide
        const allPlayers = Object.values(game.players);
        const connectedPlayers = allPlayers.filter(p => p.connected);

        console.log(`📊 État de la room ${playerRoom}:`);
        console.log(`   - Total joueurs: ${allPlayers.length}`);
        console.log(`   - Joueurs connectés: ${connectedPlayers.length}`);
        console.log(`   - Détail:`, allPlayers.map(p => `${p.username} (${p.connected ? '✓' : '✗'})`));

        if (connectedPlayers.length === 0) {
            // ✅ Aucun joueur connecté → Supprimer immédiatement
            console.log(`🗑️ Aucun joueur connecté → Suppression immédiate de ${playerRoom}`);

            // Arrêter tous les timers en cours
            stopBlurProgression(playerRoom);

            // Supprimer la room
            buzzerGameManager.deleteGame(playerRoom);

            console.log(`✅ Room ${playerRoom} supprimée (vide)`);
        } else {
            // ✅ Il reste des joueurs → Timer de nettoyage pour le joueur déconnecté
            setTimeout(() => {
                const currentGame = buzzerGameManager.getGame(playerRoom);
                if (!currentGame) return;

                const currentPlayer = currentGame.players[socket.id];
                if (currentPlayer && !currentPlayer.connected) {
                    // Supprimer définitivement le joueur
                    delete currentGame.players[socket.id];

                    console.log(`🗑️ ${playerUsername} supprimé définitivement de ${playerRoom}`);

                    io.to(playerRoom).emit('buzzer:playerRemoved', {
                        playerId: socket.id,
                        username: playerUsername
                    });

                    // ✅ Re-vérifier si la room est devenue vide
                    const remainingPlayers = Object.values(currentGame.players).filter(p => p.connected);
                    if (remainingPlayers.length === 0) {
                        stopBlurProgression(playerRoom);
                        buzzerGameManager.deleteGame(playerRoom);
                        console.log(`🗑️ Room ${playerRoom} supprimée (vide après timeout)`);
                    }
                }
            }, 5 * 60 * 1000); // 5 minutes
        }
    });

    // ==================== RECONNEXION ====================
    socket.on('buzzer:reconnect', ({ roomCode, username }, callback) => {
        try {
            console.log(`🔄 Tentative reconnexion: ${username} → ${roomCode}`);

            const game = buzzerGameManager.getGame(roomCode);

            if (!game) {
                return callback({ success: false, error: 'Room introuvable' });
            }

            // Trouver le joueur déconnecté par son username
            let disconnectedPlayer = null;
            let oldSocketId = null;

            Object.entries(game.players).forEach(([socketId, player]) => {
                if (player.username === username && !player.connected) {
                    disconnectedPlayer = player;
                    oldSocketId = socketId;
                }
            });

            if (!disconnectedPlayer) {
                return callback({ success: false, error: 'Joueur introuvable ou déjà connecté' });
            }

            // ✅ Mettre à jour le joueur avec le nouveau socket ID
            delete game.players[oldSocketId];
            game.players[socket.id] = {
                ...disconnectedPlayer,
                id: socket.id,
                connected: true,
                disconnectedAt: null
            };

            // ✅ Si c'était le créateur, restaurer son statut
            if (game.creatorId === oldSocketId) {
                game.creatorId = socket.id;
                console.log(`👑 Créateur reconnecté: ${username}`);
            }

            socket.join(roomCode);

            console.log(`✅ ${username} reconnecté à ${roomCode}`);

            // Notifier tous les joueurs
            io.to(roomCode).emit('buzzer:playerReconnected', {
                playerId: socket.id,
                username: username,
                isCreator: game.creatorId === socket.id
            });

            // ✅ Préparer l'état complet du jeu pour la reconnexion
            const gameState = {
                roomCode: game.roomCode,
                mode: game.mode,
                filter: game.filter,
                totalRounds: game.totalRounds,
                currentRound: game.currentRound,
                status: game.status,
                players: game.players,
                isCreator: game.creatorId === socket.id
            };

            // ✅ Si la partie est en cours, envoyer aussi l'état du round actuel
            if (game.status === 'playing' && game.currentBeatboxer) {
                const beatboxerData = buzzerBeatboxerManager.getBeatboxerData(game.currentBeatboxer);

                // L'horloge fait foi : le joueur qui revient reprend la manche là où elle en est
                const snapshot = getRoundClock(io).snapshot(roomCode);

                gameState.currentRoundState = {
                    currentRound: game.currentRound,
                    totalRounds: game.totalRounds,
                    beatboxerImage: beatboxerData.imageUrl,
                    pixelLevel: snapshot ? snapshot.hidden * 100 : (game.pixelLevel ?? 100),
                    roundSync: snapshot,
                    buzzedPlayer: game.buzzedPlayer,
                    currentBeatboxer: game.buzzedPlayer ? game.currentBeatboxer : null // Révéler seulement si quelqu'un a buzzé et trouvé
                };
            }

            callback({
                success: true,
                game: gameState
            });

        } catch (error) {
            console.error('❌ Erreur reconnexion:', error);
            callback({ success: false, error: error.message });
        }
    });

}

// ==================== FONCTION DE SAUVEGARDE DES STATS ====================
async function saveGameStats(roomCode, finalScores) {
    try {
        console.log('🔍 DEBUG saveGameStats démarré:', {
            roomCode,
            finalScoresCount: finalScores?.length,
            hasGame: !!buzzerGameManager.getGame(roomCode)
        });

        const { getDatabase } = require('./services/database');
        const db = getDatabase();

        if (!finalScores || finalScores.length === 0) {
            console.warn('⚠️ Aucun score final à sauvegarder');
            return;
        }

        // ✅ ÉTAPE 1 : Récupérer le game
        const game = buzzerGameManager.getGame(roomCode);
        if (!game) {
            console.error('❌ Game introuvable pour room:', roomCode);
            return;
        }

        console.log('🔍 DEBUG game trouvé:', {
            mode: game.mode,
            filter: game.filter,
            totalRounds: game.totalRounds,
            roundHistoryLength: game.roundHistory?.length || 0
        });
        // Trouver le créateur
        const creatorPlayer = finalScores.find(p => p.id === game.creatorId);
        const creatorDiscordId = creatorPlayer?.discordId || null;

        // ✅ ÉTAPE 2 : Enregistrer tous les utilisateurs Discord
        const discordPlayers = finalScores.filter(p => p.isDiscordUser && p.discordId);
        if (discordPlayers.length > 0) {
            console.log(`👥 Enregistrement de ${discordPlayers.length} utilisateurs Discord...`);
            discordPlayers.forEach(player => {
                db.upsertUser(player.discordId, player.username, player.discordAvatar);
                console.log(`✅ User enregistré: ${player.username} (${player.discordId.substring(0, 8)}...)`);
            });
        }

        // ✅ ÉTAPE 3 : Créer l'entrée de partie avec le bon mode
        let gameMode;
        if (game.mode === 'buzzer_country') {
            gameMode = 'buzzer_country';
        } else if (game.mode === 'buzzer_event') {
            gameMode = 'buzzer_event';
        } else {
            gameMode = 'buzzer_battle';
        }

        const gameFilter = game.filter || null;

        console.log('🔍 DEBUG avant createGame:', {
            roomCode,
            gameMode,
            totalRounds: game.totalRounds,
            creatorDiscordId,
            gameFilter
        });

        const gameId = db.createGame(
            roomCode,
            gameMode,
            game.totalRounds,
            creatorDiscordId,
            gameFilter
        );

        console.log(`✅ Partie créée en DB: gameId=${gameId}, room=${roomCode}`);

        // ✅ ÉTAPE 4 : Sauvegarder les participations
        console.log('📊 Joueurs à sauvegarder:', finalScores.map(p => ({
            username: p.username,
            isDiscordUser: p.isDiscordUser,
            discordId: p.discordId ? p.discordId.substring(0, 8) + '...' : null
        })));

        let savedCount = 0;
        finalScores.forEach((player, index) => {
            if (player.isDiscordUser && player.discordId) {
                const roundsWon = player.correctGuesses || 0;
                db.addParticipation(
                    gameId,
                    player.discordId,
                    player.score,
                    index + 1,
                    roundsWon
                );
                savedCount++;
                console.log(`📊 Stats sauvegardées: ${player.username} - Score: ${player.score}, Rang: ${index + 1}`);
            } else {
                console.log(`⚠️ Joueur NON Discord ignoré: ${player.username} (isDiscordUser: ${player.isDiscordUser}, discordId: ${player.discordId})`);
            }
        });

        console.log(`✅ ${savedCount}/${finalScores.length} joueurs Discord sauvegardés`);
        // ✅ ÉTAPE 4.5 : Sauvegarder les performances Buzzer
        if (game.roundHistory && game.roundHistory.length > 0) {
            let savedPerformances = 0;

            game.roundHistory.forEach((round, roundIndex) => {
                // Enregistrer le joueur qui a buzzé (s'il existe)
                if (round.buzzedPlayer) {
                    const player = finalScores.find(p => p.id === round.buzzedPlayer);
                    if (player && player.isDiscordUser && player.discordId) {
                        db.addBuzzerPerformance(
                            gameId,
                            player.discordId,
                            round.round || roundIndex + 1,
                            true, // buzzedFirst (toujours vrai dans ce système)
                            round.isCorrect, // ✅ Sauvegarder le vrai résultat
                            round.reactionTime || 1000,
                            round.pointsEarned || (round.isCorrect ? 2 : -1),
                            round.beatboxer || 'Unknown'
                        );
                        savedPerformances++;
                        console.log(`🔔 Performance sauvée: ${player.username} - ${round.beatboxer} (${round.isCorrect ? 'CORRECT' : 'FAUX'})`);
                    }
                }

            });

            console.log(`🔔 ${savedPerformances} performances buzzer sauvegardées (incluant les non-buzzés)`);
        } else {
            console.log('⚠️ Aucune roundHistory trouvée dans le game');
        }
        // ✅ ÉTAPE 5 : Finaliser la partie
        db.finishGame(gameId);
        console.log(`✅ Partie ${roomCode} finalisée en DB`);

        // Journal consulté depuis la page d'administration
        db.logEvent({
            type: 'game',
            message: `Buzzer Battle terminé dans ${roomCode} (${finalScores.length} joueurs)`,
            discordId: creatorDiscordId,
            context: {
                roomCode,
                gameMode,
                rounds: game.totalRounds,
                winner: finalScores[0]?.username || null,
            },
        });

    } catch (error) {
        console.error('❌ Erreur sauvegarde stats Buzzer:', error);
    }
}

// ==================== FONCTIONS UTILITAIRES ====================

const { BuzzerRoundClock } = require('./services/buzzerRoundClock');

// Une seule horloge pour toutes les salles, créée à la première utilisation
let roundClock = null;

function getRoundClock(io) {
    if (roundClock) return roundClock;

    roundClock = new BuzzerRoundClock(io, {
        // La photo est nette : dernière fenêtre pour buzzer
        onFullReveal: (roomCode) => {
            io.to(roomCode).emit('buzzer:fullReveal', {
                message: 'Image complètement révélée ! 3 secondes pour deviner !'
            });
        },

        // Fin de manche, quelle qu'en soit la cause. Point de passage unique.
        onRoundEnd: (roomCode, roundId, reason) => {
            const game = buzzerGameManager.getGame(roomCode);
            if (!game) return;

            if (reason === 'watchdog') {
                console.warn(`⏱️ Manche ${roundId} close par le chien de garde (${roomCode})`);
            }

            // La réponse n'est révélée que si personne ne l'a trouvée
            if (reason !== 'answered') {
                game.buzzedPlayer = null;
                io.to(roomCode).emit('buzzer:autoReveal', {
                    beatboxer: game.currentBeatboxer,
                    correctAnswer: game.currentBeatboxer?.title
                });
            }

            setTimeout(() => {
                advanceRound(roomCode, io).catch((error) => {
                    console.error('❌ Erreur passage de manche:', error);
                });
            }, 3000);
        },
    });

    return roundClock;
}

// Manche suivante, ou fin de partie. Appelée uniquement depuis onRoundEnd.
async function advanceRound(roomCode, io) {
    const game = buzzerGameManager.getGame(roomCode);
    if (!game) return;

    if (game.currentRound >= game.totalRounds) {
        const endResult = buzzerGameManager.endGame(roomCode);
        getRoundClock(io).stop(roomCode);

        // Les stats sont sauvegardées ici, donc pour toutes les fins de partie,
        // y compris celles où la dernière manche s'est terminée sans bonne réponse.
        await saveGameStats(roomCode, endResult.finalScores);

        io.to(roomCode).emit('buzzer:gameFinished', {
            finalScores: endResult.finalScores,
            winner: endResult.winner
        });
        return;
    }

    const nextRoundGame = buzzerGameManager.nextRound(roomCode);
    if (!nextRoundGame) return;

    const nextBeatboxerData = buzzerBeatboxerManager.getBeatboxerData(nextRoundGame.currentBeatboxer);
    nextRoundGame.buzzedPlayer = null;

    io.to(roomCode).emit('buzzer:nextRound', {
        currentRound: nextRoundGame.currentRound,
        totalRounds: nextRoundGame.totalRounds,
        beatboxerImage: nextBeatboxerData.imageUrl
    });

    startBlurProgression(roomCode, io);
}

// Noms conservés : le reste du fichier appelle toujours ces deux fonctions
function startBlurProgression(roomCode, io) {
    const game = buzzerGameManager.getGame(roomCode);
    const playerCount = game ? Object.keys(game.players || {}).length : 1;
    getRoundClock(io).startRound(roomCode, { playerCount });
}

function stopBlurProgression(roomCode) {
    if (roundClock) roundClock.stop(roomCode);
}

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}


module.exports = { handleBuzzerSocketConnection };
