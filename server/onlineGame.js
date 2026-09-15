// server/onlineGame.js - Version corrigée avec authentification Discord
const { roomManager } = require('./services/roomManager');
const { GameManager } = require('./services/gameManager');
const audioManager = require('./services/audioManager');
const { CONFIG, ROOM_STATES, GAME_STATES, GAME_MODES } = require('./constants');
const { validatePseudo, validateRoomCode, createLogger } = require('./utils');

const logger = createLogger('ONLINE_GAME');

function handleOnlineSocketConnection(socket, io) {
    logger.info(`Nouvelle connexion socket: ${socket.id}`);

    // ✅ CORRECTION : Création de room avec support Discord
    socket.on('create-online-room', ({ pseudo, gameMode = GAME_MODES.NORMAL }) => {
        try {
            let finalPseudo = pseudo;
            let isDiscordUser = false;
            let discordAvatar = null;

            // ✅ NOUVEAU : Priorité au pseudo Discord si connecté
            if (socket.discordUser) {
                finalPseudo = socket.discordUser.username;
                isDiscordUser = true;
                discordAvatar = socket.discordUser.avatar;
                console.log('👤 Création room par utilisateur Discord:', {
                    username: socket.discordUser.username,
                    discordId: socket.discordUser.discordId
                });
            }

            const pseudoValidation = validatePseudo(finalPseudo);
            if (!pseudoValidation.valid) {
                socket.emit('online-room-result', {
                    success: false,
                    error: pseudoValidation.reason
                });
                return;
            }

            // Validation du mode de jeu
            const validGameMode = Object.values(GAME_MODES).includes(gameMode) ? gameMode : GAME_MODES.NORMAL;

            const room = roomManager.createRoom(pseudoValidation.cleaned, socket.id, validGameMode);

            // ✅ NOUVEAU : Ajouter les infos Discord au joueur créateur
            if (isDiscordUser) {
                const creatorPlayer = room.getPlayer(pseudoValidation.cleaned);
                if (creatorPlayer) {
                    creatorPlayer.discordId = socket.discordUser.discordId;
                    creatorPlayer.discordAvatar = discordAvatar;
                    creatorPlayer.isDiscordUser = true;
                    creatorPlayer.discordUsername = socket.discordUser.username;
                }
            }

            socket.join(room.code);
            socket.data.onlineRoom = room.code;
            socket.data.onlinePseudo = pseudoValidation.cleaned;

            socket.emit('online-room-result', {
                success: true,
                code: room.code,
                shareLink: room.shareLink,
                maxRounds: room.maxRounds,
                gameMode: room.gameMode,
                isCreator: true,
                confirmedPseudo: pseudoValidation.cleaned, // ✅ Confirmer le pseudo final
                message: `Room ${room.code} créée avec ${room.maxRounds} manches (${validGameMode}) !`
            });
            console.log(`📤 ONLINE-ROOM-RESULT envoyé à socket ${socket.id} pour room ${room.code}`);
            GameManager.emitRoomUpdate(room, io);
            GameManager.emitSettingsUpdate(room, io);

            logger.success(`Room ${room.code} créée par ${pseudoValidation.cleaned} (Discord: ${isDiscordUser})`);

        } catch (error) {
            logger.error('Erreur création room:', error);
            socket.emit('online-room-result', {
                success: false,
                error: 'Erreur serveur'
            });
        }
    });

    // ✅ CORRECTION : Rejoindre une room avec support Discord amélioré
    socket.on('join-online-room', ({ code, pseudo, gameMode, isSharedLinkJoin, retryAttempt }) => {
        try {
            let finalPseudo = pseudo;
            let isDiscordUser = false;
            let discordAvatar = null;
            let discordId = null;

            // ✅ PRIORITÉ ABSOLUE : Utiliser les infos Discord si disponibles
            if (socket.discordUser) {
                finalPseudo = socket.discordUser.username;
                isDiscordUser = true;
                discordAvatar = socket.discordUser.avatar;
                discordId = socket.discordUser.discordId;
                console.log('👤 Join par utilisateur Discord:', {
                    username: socket.discordUser.username,
                    discordId: socket.discordUser.discordId,
                    originalPseudo: pseudo
                });
            }

            const codeValidation = validateRoomCode(code);
            const pseudoValidation = validatePseudo(finalPseudo);

            console.log('🚪 JOIN REQUEST:', {
                code,
                originalPseudo: pseudo,
                finalPseudo: finalPseudo,
                isDiscordUser,
                socketId: socket.id,
                isSharedLinkJoin: !!isSharedLinkJoin,
                retryAttempt: retryAttempt || 0,
                timestamp: new Date().toISOString()
            });

            if (!codeValidation.valid) {
                console.log('❌ Code invalide:', codeValidation.reason);
                socket.emit('online-join-result', {
                    success: false,
                    error: codeValidation.reason
                });
                return;
            }

            if (!pseudoValidation.valid) {
                console.log('❌ Pseudo invalide:', pseudoValidation.reason);
                socket.emit('online-join-result', {
                    success: false,
                    error: pseudoValidation.reason
                });
                return;
            }

            const room = roomManager.getRoom(codeValidation.cleaned);
            if (!room) {
                console.log('❌ Room introuvable:', codeValidation.cleaned);
                socket.emit('online-join-result', {
                    success: false,
                    error: 'Room introuvable'
                });
                return;
            }

            const cleanPseudo = pseudoValidation.cleaned;

            // ✅ VÉRIFICATION DE L'ÉTAT DE LA ROOM
            if (room.state !== ROOM_STATES.WAITING) {
                const existingPlayer = room.getPlayer(cleanPseudo);
                if (!existingPlayer) {
                    console.log('❌ Partie en cours et joueur inexistant');
                    socket.emit('online-join-result', {
                        success: false,
                        error: 'Partie en cours - impossible de rejoindre'
                    });
                    return;
                }
            }

            // ✅ VÉRIFICATION DE LA CAPACITÉ
            if (room.players.size >= CONFIG.LIMITS.MAX_PLAYERS_PER_ROOM) {
                console.log('❌ Room pleine:', room.players.size, '/', CONFIG.LIMITS.MAX_PLAYERS_PER_ROOM);
                socket.emit('online-join-result', {
                    success: false,
                    error: 'Room pleine'
                });
                return;
            }

            // ✅ LOGIQUE DE GESTION DES CONFLITS DE PSEUDO AMÉLIORÉE
            if (room.players.has(cleanPseudo)) {
                const existingPlayer = room.getPlayer(cleanPseudo);

                console.log('⚠️ Pseudo existe déjà:', {
                    pseudo: cleanPseudo,
                    existingConnected: existingPlayer.connected,
                    existingDiscordId: existingPlayer.discordId,
                    currentDiscordId: discordId,
                    isDiscordUser,
                    isSharedLink: !!isSharedLinkJoin
                });

                // ✅ CAS SPÉCIAL : Même utilisateur Discord - reconnexion légitime
                if (isDiscordUser && existingPlayer.discordId === discordId) {
                    console.log('🔄 Reconnexion Discord légitime détectée');
                    handlePlayerReconnection(room, existingPlayer, cleanPseudo, socket, io);
                    return;
                }

                // Cas de reconnexion (joueur déconnecté)
                if (existingPlayer && !existingPlayer.connected) {
                    console.log('🔄 Reconnexion détectée');
                    handlePlayerReconnection(room, existingPlayer, cleanPseudo, socket, io);
                    return;
                }

                // Cas de refresh de page (même socket)
                if (existingPlayer && existingPlayer.socketId === socket.id) {
                    console.log('🔄 Refresh page détecté');
                    handlePageRefresh(room, cleanPseudo, socket, io);
                    return;
                }

                // ✅ NOUVEAU : Gestion spéciale pour les liens partagés
                if (existingPlayer && existingPlayer.connected && isSharedLinkJoin) {
                    console.log('🔗 Conflit pseudo sur lien partagé');

                    // Si l'utilisateur existant n'est pas Discord mais le nouveau l'est
                    if (isDiscordUser && !existingPlayer.isDiscordUser) {
                        console.log('👑 Utilisateur Discord prend la priorité sur utilisateur anonyme');
                        // On pourrait implémenter une logique de remplacement ici
                    }

                    const suggestedPseudo = generateAlternativePseudo(cleanPseudo, room);
                    socket.emit('online-join-result', {
                        success: false,
                        error: 'Pseudo déjà utilisé par un joueur connecté',
                        suggestedPseudo,
                        isSharedLinkConflict: true
                    });
                    return;
                }

                // Pseudo déjà utilisé par un autre joueur connecté
                if (existingPlayer && existingPlayer.connected) {
                    console.log('❌ Pseudo déjà utilisé par joueur connecté');
                    socket.emit('online-join-result', {
                        success: false,
                        error: 'Pseudo déjà utilisé par un joueur connecté'
                    });
                    return;
                }
            }

            // ✅ NOUVEAU JOUEUR - SUCCESS
            console.log('✅ Ajout nouveau joueur:', cleanPseudo);
            room.addPlayer(cleanPseudo, socket.id);

            // ✅ NOUVEAU : Ajouter les infos Discord au nouveau joueur
            if (isDiscordUser) {
                const newPlayer = room.getPlayer(cleanPseudo);
                if (newPlayer) {
                    newPlayer.discordId = discordId;
                    newPlayer.discordAvatar = discordAvatar;
                    newPlayer.isDiscordUser = true;
                    newPlayer.discordUsername = socket.discordUser.username;
                }
            }

            socket.join(room.code);
            socket.data.onlineRoom = room.code;
            socket.data.onlinePseudo = cleanPseudo;

            const successResponse = {
                success: true,
                code: room.code,
                shareLink: room.shareLink,
                maxRounds: room.maxRounds,
                gameMode: room.gameMode,
                isCreator: room.isCreator(cleanPseudo),
                confirmedPseudo: cleanPseudo,
                message: `Vous avez rejoint la room ${room.code} !`,
                playersCount: room.getConnectedPlayers().length
            };

            socket.emit('online-join-result', successResponse);
            GameManager.emitRoomUpdate(room, io);
            GameManager.emitSettingsUpdate(room, io);

            console.log('✅ JOIN SUCCESS:', {
                room: room.code,
                pseudo: cleanPseudo,
                players: room.players.size,
                isDiscordUser,
                isSharedLink: !!isSharedLinkJoin
            });

        } catch (error) {
            console.error('❌ Erreur rejoindre room:', error);
            socket.emit('online-join-result', {
                success: false,
                error: 'Erreur serveur'
            });
        }
    });

    // ✅ CORRECTION : Changement de pseudo avec protection Discord
    socket.on('change-pseudo', ({ oldPseudo, newPseudo }) => {
        try {
            const { onlineRoom, onlinePseudo } = socket.data;
            const room = roomManager.getRoom(onlineRoom);

            if (!room || !onlinePseudo || onlinePseudo !== oldPseudo) {
                socket.emit('pseudo-change-result', {
                    success: false,
                    error: 'Données incohérentes'
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

            // ✅ PROTECTION : Les utilisateurs Discord ne peuvent pas changer de pseudo
            if (player.isDiscordUser) {
                socket.emit('pseudo-change-result', {
                    success: false,
                    error: 'Les utilisateurs Discord ne peuvent pas changer de pseudo'
                });
                return;
            }

            const newPseudoValidation = validatePseudo(newPseudo);
            if (!newPseudoValidation.valid) {
                socket.emit('pseudo-change-result', {
                    success: false,
                    error: newPseudoValidation.reason
                });
                return;
            }

            const cleanNewPseudo = newPseudoValidation.cleaned;

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

            // Mise à jour atomique
            const wasCreator = room.creatorPseudo === oldPseudo;
            const score = room.scores.get(oldPseudo) || 0;

            player.pseudo = cleanNewPseudo;
            room.players.delete(oldPseudo);
            room.scores.delete(oldPseudo);
            room.players.set(cleanNewPseudo, player);
            room.scores.set(cleanNewPseudo, score);

            if (wasCreator) {
                room.creatorPseudo = cleanNewPseudo;
            }

            socket.data.onlinePseudo = cleanNewPseudo;

            // Mise à jour du jeu en cours si nécessaire
            if (room.game && room.game.answers.has(oldPseudo)) {
                const answer = room.game.answers.get(oldPseudo);
                room.game.answers.delete(oldPseudo);
                room.game.answers.set(cleanNewPseudo, answer);
            }

            room.updateActivity();

            socket.emit('pseudo-change-result', {
                success: true,
                newPseudo: cleanNewPseudo,
                isCreator: wasCreator
            });

            GameManager.emitRoomUpdate(room, io);
            logger.info(`Pseudo changé: ${oldPseudo} → ${cleanNewPseudo} dans room ${room.code}`);

        } catch (error) {
            logger.error('Erreur changement pseudo:', error);
            socket.emit('pseudo-change-result', {
                success: false,
                error: 'Erreur serveur'
            });
        }
    });

    // ✅ CORRECTION : Soumission de réponse avec protection Discord
    socket.on('submit-answer', ({ answer }) => {
        const { onlineRoom, onlinePseudo } = socket.data;
        const room = roomManager.getRoom(onlineRoom);

        if (!room || !onlinePseudo) return;

        const player = room.getPlayer(onlinePseudo);

        // ✅ SÉCURITÉ : Vérifier que c'est bien le bon utilisateur Discord
        if (socket.discordUser && player) {
            if (player.isDiscordUser && player.discordId !== socket.discordUser.discordId) {
                console.log('🚫 Tentative de triche détectée - Discord ID mismatch');
                socket.emit('answer-rejected', {
                    reason: 'Identité Discord invalide'
                });
                return;
            }
        }

        GameManager.handleAnswerSubmission(room, onlinePseudo, answer, socket, io);
    });

    // ✅ NOUVEAU : Collecte sécurisée des stats Discord
    socket.on('collect-game-stats', () => {
        const { onlineRoom, onlinePseudo } = socket.data;
        const room = roomManager.getRoom(onlineRoom);

        if (!room || !onlinePseudo || !socket.discordUser) return;

        const player = room.getPlayer(onlinePseudo);

        // Vérification d'identité Discord
        if (player && player.isDiscordUser && player.discordId === socket.discordUser.discordId) {
            try {
                const playerStats = collectDetailedPlayerStats(room, onlinePseudo);
                socket.emit('game-stats-collected', playerStats);
                console.log('📊 Stats Discord collectées pour', socket.discordUser.username, ':', playerStats);
            } catch (error) {
                console.error('Erreur collecte stats Discord:', error);
            }
        }
    });

    // [Conserver tous les autres gestionnaires d'événements existants...]
    // Toggle ready, start game, etc. - ils restent identiques

    // Toggle ready
    socket.on('toggle-ready', () => {
        const { onlineRoom, onlinePseudo } = socket.data;
        const room = roomManager.getRoom(onlineRoom);

        if (!room || !onlinePseudo) return;

        const player = room.getPlayer(onlinePseudo);
        if (player) {
            player.ready = !player.ready;
            room.updateActivity();
            GameManager.emitRoomUpdate(room, io);
            logger.debug(`${onlinePseudo} ready: ${player.ready} dans room ${room.code}`);
        }
    });

    // Démarrer la partie
    socket.on('start-game', ({ room: roomCode, artistCount }) => {
        const { onlinePseudo } = socket.data;
        const room = roomManager.getRoom(roomCode);

        if (!room || !onlinePseudo) return;

        if (!room.isCreator(onlinePseudo)) {
            socket.emit('game-error', { error: 'Seul le créateur peut démarrer la partie' });
            return;
        }

        const validation = room.canStartGame();
        if (!validation.valid) {
            socket.emit('game-error', { error: validation.reason });
            return;
        }

        // Mise à jour du nombre d'artistes si fourni
        if (artistCount && artistCount !== room.maxRounds) {
            const updateResult = room.updateArtistCount(artistCount);
            if (!updateResult.success) {
                socket.emit('game-error', { error: updateResult.error });
                return;
            }
            GameManager.emitRoomUpdate(room, io);
        }

        const started = GameManager.startGame(room, io);
        if (!started) {
            socket.emit('game-error', { error: 'Impossible de démarrer la partie' });
        }
    });

    // [Conserver tous les autres gestionnaires existants...]
    // transferHost, updateArtistCount, kickPlayer, etc.

    // Transfert de host
    socket.on('transfer-host', ({ targetPseudo }) => {
        const { onlineRoom, onlinePseudo } = socket.data;
        const room = roomManager.getRoom(onlineRoom);

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

        const result = room.transferHost(targetPseudo);

        if (result.success) {
            socket.emit('transfer-host-result', {
                success: true,
                newHost: result.newHost,
                oldHost: result.oldHost
            });

            io.to(onlineRoom).emit('host-transferred', {
                newHost: result.newHost,
                oldHost: result.oldHost,
                message: `${result.newHost} est maintenant le host de la room`
            });

            GameManager.emitRoomUpdate(room, io);
            logger.info(`Host transféré: ${result.oldHost} → ${result.newHost} dans room ${room.code}`);
        } else {
            socket.emit('transfer-host-result', {
                success: false,
                error: result.error
            });
        }
    });

    // Mise à jour du nombre d'artistes
    socket.on('update-artist-count', ({ count }) => {
        const { onlineRoom, onlinePseudo } = socket.data;
        const room = roomManager.getRoom(onlineRoom);

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

        const result = room.updateArtistCount(count);

        if (result.success) {
            socket.emit('artist-count-update-result', {
                success: true,
                newCount: count
            });
            GameManager.emitSettingsUpdate(room, io);
            logger.info(`Nombre d'artistes mis à jour: ${count} dans room ${room.code}`);
        } else {
            socket.emit('artist-count-update-result', {
                success: false,
                error: result.error
            });
        }
    });

    // Mise à jour du temps de réponse
    socket.on('update-answer-time', ({ seconds }) => {
        const { onlineRoom, onlinePseudo } = socket.data;
        const room = roomManager.getRoom(onlineRoom);

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

        const result = room.updateAnswerTime(seconds);

        if (result.success) {
            socket.emit('answer-time-update-result', {
                success: true,
                newTime: seconds
            });
            GameManager.emitSettingsUpdate(room, io);
            logger.info(`Temps de réponse mis à jour: ${seconds}s dans room ${room.code}`);
        } else {
            socket.emit('answer-time-update-result', {
                success: false,
                error: result.error
            });
        }
    });

    // Exclusion de joueur
    socket.on('kick-player', ({ targetPseudo }) => {
        const { onlineRoom, onlinePseudo } = socket.data;
        const room = roomManager.getRoom(onlineRoom);

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

            const targetSocket = io.sockets.sockets.get(targetPlayer.socketId);
            if (targetSocket) {
                targetSocket.leave(onlineRoom);
                targetSocket.data.onlineRoom = null;
                targetSocket.data.onlinePseudo = null;
            }
        }

        // Supprimer le joueur
        room.players.delete(targetPseudo);
        room.scores.delete(targetPseudo);

        socket.emit('kick-result', {
            success: true,
            kickedPseudo: targetPseudo
        });

        io.to(onlineRoom).emit('player-kicked', {
            kickedPseudo: targetPseudo,
            message: `${targetPseudo} a été exclu de la room`
        });

        GameManager.emitRoomUpdate(room, io);
        logger.info(`${targetPseudo} exclu de la room ${room.code} par ${onlinePseudo}`);
    });

    // Rafraîchissement des données
    socket.on('refresh-room-data', () => {
        const { onlineRoom } = socket.data;
        const room = roomManager.getRoom(onlineRoom);

        if (room) {
            GameManager.emitRoomUpdate(room, io);
        }
    });

    // Déconnexion
    socket.on('disconnect', () => {
        const { onlineRoom, onlinePseudo } = socket.data;
        if (!onlineRoom || !onlinePseudo) return;

        const room = roomManager.getRoom(onlineRoom);
        if (room) {
            const wasHost = room.isCreator(onlinePseudo);

            room.removePlayer(onlinePseudo);

            // Notifier le transfert automatique de host
            if (wasHost && room.getConnectedPlayers().length > 0) {
                io.to(onlineRoom).emit('host-transferred', {
                    newHost: room.creatorPseudo,
                    oldHost: onlinePseudo,
                    message: `${room.creatorPseudo} est maintenant le host de la room`,
                    isAutomatic: true
                });
            }

            // Vérification après déconnexion
            roomManager.checkRoomAfterDisconnection(room, io);

            if (room.isEmpty()) {
                roomManager.deleteRoom(room.code, 'room vide');
            } else {
                GameManager.emitRoomUpdate(room, io);
            }

            logger.info(`${onlinePseudo} déconnecté de la room ${room.code}`);
        }
    });
}

function collectDetailedPlayerStats(room, pseudo) {
    const player = room.getPlayer(pseudo);
    const playerScore = room.scores.get(pseudo) || 0;

    if (!player) {
        console.warn(`❌ Impossible de collecter stats pour ${pseudo} - joueur introuvable`);
        return null;
    }

    // ✅ AMÉLIORATION : Utiliser les vraies données du joueur si disponibles
    const correctAnswers = player.correctAnswers || Math.floor(playerScore / 3);
    const totalRounds = room.maxRounds || 0;
    const totalAnswers = player.totalAnswers || (totalRounds * 3);

    const stats = {
        totalGames: 1,
        totalCorrect: correctAnswers,
        totalAnswers: totalAnswers,
        bestStreak: player.bestStreak || Math.min(correctAnswers, totalRounds),
        playerScore: playerScore,
        gameMode: room.gameMode,
        gameDuration: room.game ? (Date.now() - room.game.startTime) : 0,
        timestamp: new Date().toISOString(),
        discordId: player.discordId || null,
        discordUsername: player.discordUsername || null
    };

    console.log(`📊 Stats collectées pour ${pseudo}:`, {
        correct: stats.totalCorrect,
        total: stats.totalAnswers,
        score: stats.playerScore,
        hasDiscord: !!stats.discordId
    });

    return stats;
}

// ✅ FONCTION UTILITAIRE : Générer un pseudo alternatif
function generateAlternativePseudo(basePseudo, room, maxAttempts = 10) {
    for (let i = 1; i <= maxAttempts; i++) {
        const alternative = `${basePseudo}${i}`;
        if (!room.players.has(alternative)) {
            console.log(`💡 Pseudo alternatif généré: ${basePseudo} → ${alternative}`);
            return alternative;
        }
    }

    // Si aucune alternative trouvée, générer un pseudo complètement aléatoire
    try {
        const { getRandomPseudo } = require('../utils/randomPseudo');
        const randomPseudo = getRandomPseudo();
        console.log(`💡 Pseudo aléatoire généré: ${basePseudo} → ${randomPseudo}`);
        return randomPseudo;
    } catch (error) {
        console.warn('⚠️ Module randomPseudo non trouvé, génération simple');
        const randomSuffix = Math.floor(Math.random() * 9999);
        return `${basePseudo}_${randomSuffix}`;
    }
}

// ✅ Fonctions utilitaires pour la gestion des connexions

function handlePlayerReconnection(room, existingPlayer, cleanPseudo, socket, io) {
    existingPlayer.connected = true;
    existingPlayer.socketId = socket.id;
    existingPlayer.reconnectedAt = Date.now();

    socket.join(room.code);
    socket.data.onlineRoom = room.code;
    socket.data.onlinePseudo = cleanPseudo;

    let reconnectionMessage = `🔄 Reconnexion réussie à la room ${room.code} !`;
    let gameState = null;

    // Messages contextuels selon l'état
    if (room.state === ROOM_STATES.PLAYING && room.game) {
        gameState = {
            round: room.game.currentRound,
            maxRounds: room.game.maxRounds,
            level: room.game.level,
            maxLevel: room.game.maxLevel,
            state: room.game.state,
            timeLeft: null,
            currentSong: room.game.currentSong
        };

        if (room.game.state === GAME_STATES.ANSWERING) {
            reconnectionMessage = `🔄 Reconnexion - Manche ${room.game.currentRound}, Niveau ${room.game.level} en cours`;
        } else if (room.game.state === GAME_STATES.RESULTS) {
            reconnectionMessage = `🔄 Reconnexion - En attente du prochain niveau/manche`;
        }
    }

    socket.emit('online-join-result', {
        success: true,
        code: room.code,
        shareLink: room.shareLink,
        maxRounds: room.maxRounds,
        gameMode: room.gameMode,
        isCreator: room.isCreator(cleanPseudo),
        confirmedPseudo: cleanPseudo,
        message: reconnectionMessage
    });

    GameManager.emitRoomUpdate(room, io);
    GameManager.emitSettingsUpdate(room, io);

    socket.to(room.code).emit('player-reconnected', {
        pseudo: cleanPseudo,
        message: `${cleanPseudo} s'est reconnecté`
    });

    // Synchronisation spécifique pour les parties en cours
    if (room.state === ROOM_STATES.PLAYING && room.game) {
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

        if (room.game.state === GAME_STATES.ANSWERING && room.game.timer) {
            socket.emit('answer-phase-started', {
                timeLimit: room.game.currentAnswerTime
            });
        }
    }
}

function handlePageRefresh(room, cleanPseudo, socket, io) {
    socket.emit('online-join-result', {
        success: true,
        code: room.code,
        shareLink: room.shareLink,
        maxRounds: room.maxRounds,
        gameMode: room.gameMode,
        isCreator: room.isCreator(cleanPseudo),
        confirmedPseudo: cleanPseudo,
        message: `Reconnexion à la room ${room.code} (refresh page)`
    });

    GameManager.emitRoomUpdate(room, io);
    GameManager.emitSettingsUpdate(room, io);
}

module.exports = { handleOnlineSocketConnection };