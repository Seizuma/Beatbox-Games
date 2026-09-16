/**
 * Gestionnaire de jeu - Version avec support Discord
 * Gère la logique de jeu, les manches, les niveaux et les scores avec avatars Discord
 */

const { CONFIG, GAME_STATES, ROOM_STATES } = require('../constants');
const { normalize } = require('../utils');
const { isAnswerCorrect } = require('./answerValidation');
const { getDatabase } = require('./database'); // ✅ AJOUT

const db = getDatabase(); // ✅ AJOUT

class GameManager {
    /**
     * Démarre une nouvelle partie
     */
    static startGame(room, io) {
        const validation = room.canStartGame();
        if (!validation.valid) {
            console.error(`❌ Impossible de démarrer la partie room ${room.code}: ${validation.reason}`);
            return false;
        }

        room.state = ROOM_STATES.STARTING;
        io.to(room.code).emit('game-starting');

        console.log(`🎮 Démarrage partie room ${room.code}: ${room.getConnectedPlayers().length} joueurs`);

        // ✅ CORRECTION : Créer l'entrée de partie dans la DB
        try {
            const allPlayers = room.getAllPlayers();
            const creatorPlayer = allPlayers.find(p => room.isCreator(p.pseudo));
            const creatorDiscordId = creatorPlayer?.discordId || null;

            // ✅ ÉTAPE 1 : Enregistrer TOUS les utilisateurs Discord AVANT de créer la partie
            const discordPlayers = allPlayers.filter(p => p.discordId);
            if (discordPlayers.length > 0) {
                console.log(`👥 Enregistrement de ${discordPlayers.length} utilisateurs Discord...`);
                discordPlayers.forEach(player => {
                    db.upsertUser(player.discordId, player.pseudo, player.discordAvatar);
                    console.log(`✅ User enregistré: ${player.pseudo} (${player.discordId.substring(0, 8)}...)`);
                });
            }

            // ✅ ÉTAPE 2 : Maintenant créer la partie (foreign key existe maintenant)
            room.gameId = db.createGame(
                room.code,
                room.gameMode,
                room.maxRounds,
                creatorDiscordId
            );

            console.log(`✅ Partie créée en DB: gameId=${room.gameId}, room=${room.code}, creator=${creatorDiscordId ? creatorDiscordId.substring(0, 8) + '...' : 'none'}, players=${discordPlayers.length}`);
        } catch (error) {
            console.error('❌ Erreur création partie DB:', error.message);
            console.error('Code:', error.code);
            // On continue quand même la partie
        }

        setTimeout(() => {
            const audioManager = require('./audioManager');
            const songData = audioManager.selectRandomSong(room);

            if (!songData) {
                console.error(`❌ Aucune chanson disponible pour room ${room.code}`);
                room.reset();
                io.to(room.code).emit('game-error', { error: 'Aucune chanson disponible' });
                return;
            }

            room.state = ROOM_STATES.PLAYING;
            room.game = new OnlineGame(room, songData);
            GameManager.startRound(room, io);
        }, 2000);

        return true;
    }
    /**
     * Démarre une nouvelle manche
     */
    static startRound(room, io) {
        const game = room.game;
        let countdown = 3;

        console.log(`🎵 Démarrage manche ${game.currentRound}/${game.maxRounds} niveau ${game.level} - Room ${room.code}`);

        const countdownInterval = setInterval(() => {
            io.to(room.code).emit('countdown', { count: countdown });
            countdown--;

            if (countdown < 0) {
                clearInterval(countdownInterval);
                game.state = GAME_STATES.LISTENING;

                const audioData = GameManager.getAudioForLevel(game.currentSong, game.level);
                const answerTime = game.calculateAnswerTime(audioData.file);

                io.to(room.code).emit('round-started', {
                    round: game.currentRound,
                    maxRounds: game.maxRounds,
                    level: game.level,
                    maxLevel: game.maxLevel,
                    audioUrl: audioData.url,
                    answerTime
                });

                GameManager.startAnswerPhase(room, io);
            }
        }, 1000);
    }

    /**
     * Récupère les données audio pour un niveau donné
     */
    static getAudioForLevel(song, level) {
        const levelMap = {
            1: { url: song.level1Url, file: song.level1File },
            2: { url: song.level2Url, file: song.level2File },
            3: { url: song.level3Url, file: song.level3File }
        };

        return levelMap[level] || levelMap[1];
    }

    /**
     * Démarre la phase de réponse
     */
    static startAnswerPhase(room, io) {
        const game = room.game;
        game.state = GAME_STATES.ANSWERING;

        console.log(`⏰ Phase de réponse démarrée - Room ${room.code}: ${game.currentAnswerTime}s`);

        io.to(room.code).emit('answer-phase-started', {
            timeLimit: game.currentAnswerTime
        });

        let timeLeft = game.currentAnswerTime;
        game.timer = setInterval(() => {
            timeLeft--;
            io.to(room.code).emit('timer-update', { timeLeft });

            if (timeLeft <= 0) {
                clearInterval(game.timer);
                GameManager.endAnswerPhase(room, io);
            }
        }, 1000);
    }

    /**
     * Termine la phase de réponse
     */
    static endAnswerPhase(room, io) {
        const game = room.game;
        if (game.timer) {
            clearInterval(game.timer);
            game.timer = null;
        }

        game.state = GAME_STATES.RESULTS;
        const results = game.getResults();

        // Envoyer feedback immédiat à chaque joueur
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

        // Logs détaillés
        console.log(`📊 RESULTATS MANCHE ${game.currentRound} NIVEAU ${game.level} - Room ${room.code}`);
        console.log(`🎯 Artiste: "${game.currentSong.artist}"`);
        console.log(`📝 Réponses: ${results.length} | Correctes: ${results.filter(r => r.isCorrect).length}`);

        // Attribution des points
        GameManager.calculateAndUpdateScores(room, results, game.level);

        const shouldRevealArtist = game.level === 3;

        io.to(room.code).emit('round-results', {
            artist: shouldRevealArtist ? game.currentSong.artist : null,
            level: game.level,
            results,
            scores: Object.fromEntries(room.scores),
            revealArtist: shouldRevealArtist
        });

        // Mise à jour room
        GameManager.emitRoomUpdate(room, io);

        // Délai avant suite
        setTimeout(() => {
            const allFound = room.getConnectedPlayers().every(p => p.hasFoundThisRound);

            if (allFound || game.level >= 3) {
                if (!shouldRevealArtist) {
                    io.to(room.code).emit('artist-revealed', {
                        artist: game.currentSong.artist
                    });
                }
                GameManager.nextRound(room, io);
            } else {
                GameManager.nextLevel(room, io);
            }
        }, shouldRevealArtist ? 5000 : 3000);
    }

    /**
     * Calcule et met à jour les scores
     */
    static calculateAndUpdateScores(room, results, level) {
        results.forEach(result => {
            const player = room.getPlayer(result.pseudo);

            if (!player) return;

            // ✅ Initialiser les propriétés
            if (!player.correctAnswers) player.correctAnswers = 0;
            if (!player.totalAnswers) player.totalAnswers = 0;
            if (!player.currentStreak) player.currentStreak = 0;
            if (!player.bestStreak) player.bestStreak = 0;

            player.totalAnswers++;

            if (result.isCorrect) {
                const points = room.game.getPointsForLevel(level);
                const currentScore = room.scores.get(result.pseudo) || 0;
                room.scores.set(result.pseudo, currentScore + points);

                player.correctAnswers++;

                // ✅ IMPORTANT : Marquer dès qu'il trouve (n'importe quel niveau)
                // Cela compte comme "trouvé ce round"
                player.hasFoundThisRound = true;

                console.log(`✅ ${result.pseudo}: +${points}pts (total: ${currentScore + points})`);

                // ✅ NOUVEAU : Sauvegarder la performance détaillée dans la DB
                console.log(`🔍 Vérification sauvegarde performance: gameId=${room.gameId}, discordId=${player.discordId}`);
                if (room.gameId && player.discordId) {
                    try {
                        // Calculer le nombre de tentatives fausses
                        // wrong_attempts = (niveau trouvé - 1) car si trouvé niveau 2, cela veut dire 1 tentative fausse au niveau 1
                        const wrongAttempts = Math.max(0, level - 1);

                        console.log(`💾 Enregistrement performance: joueur=${result.pseudo}, round=${room.game.currentRound}, artiste="${room.game.currentSong.artist}", level=${level}, points=${points}`);

                        db.addRoundPerformance(
                            room.gameId,
                            player.discordId,
                            room.game.currentRound,
                            room.game.currentSong.artist,
                            level,
                            points,
                            null, // timeTaken - À implémenter si vous voulez tracker le temps
                            wrongAttempts
                        );

                        console.log(`✅ Performance enregistrée pour ${result.pseudo} - ${room.game.currentSong.artist} (niveau ${level})`);
                    } catch (error) {
                        console.error('❌ Erreur sauvegarde performance round:', error);
                        console.error('Stack:', error.stack);
                    }
                } else {
                    console.warn(`⚠️ Impossible de sauvegarder performance pour ${result.pseudo}: gameId=${room.gameId}, discordId=${player.discordId}`);
                }
            }
        });
    }

    /**
     * Passe au niveau suivant
     */
    static nextLevel(room, io) {
        const game = room.game;
        game.level++;
        game.answers.clear();

        console.log(`⬆️ Niveau suivant ${game.level} - Room ${room.code}`);

        // Reset les réponses pour le nouveau niveau
        room.players.forEach(player => {
            if (!player.hasFoundThisRound) {
                player.currentRoundAnswer = null;
            }
        });

        GameManager.emitRoomUpdate(room, io);
        GameManager.startRound(room, io);
    }

    /**
     * Passe à la manche suivante
     */
    static nextRound(room, io) {
        const game = room.game;
        game.currentRound++;

        room.getConnectedPlayers().forEach(player => {
            if (player.hasFoundThisRound) {
                // Le joueur a trouvé ce round → continuer le streak
                player.currentStreak++;
                player.bestStreak = Math.max(player.bestStreak, player.currentStreak);
                console.log(`🔥 ${player.pseudo}: Streak = ${player.currentStreak}`);
            } else {
                // Le joueur n'a PAS trouvé ce round → reset du streak
                if (player.currentStreak > 0) {
                    console.log(`💔 ${player.pseudo}: Streak perdu (était à ${player.currentStreak})`);
                }
                player.currentStreak = 0;

                // ✅ NOUVEAU : Enregistrer que le joueur n'a pas trouvé (level_found = 0, wrong_attempts = 3)
                if (room.gameId && player.discordId) {
                    try {
                        db.addRoundPerformance(
                            room.gameId,
                            player.discordId,
                            room.game.currentRound,
                            room.game.currentSong.artist,
                            0, // level_found = 0 (pas trouvé)
                            0, // points_earned = 0
                            null, // timeTaken
                            3 // wrong_attempts = 3 (a essayé les 3 niveaux sans succès)
                        );
                        console.log(`📊 Performance 0 enregistrée pour ${player.pseudo} - ${room.game.currentSong.artist}`);
                    } catch (error) {
                        console.error('❌ Erreur sauvegarde performance non trouvée:', error);
                    }
                }
            }

            // Réinitialiser pour le prochain round
            player.hasFoundThisRound = false;
        });

        if (game.currentRound > game.maxRounds) {
            GameManager.endGame(room, io);
        } else {
            console.log(`➡️ Manche suivante ${game.currentRound}/${game.maxRounds} - Room ${room.code}`);

            // Reset complet pour nouvelle manche
            room.resetForNewRound();
            game.level = 1;
            game.answers.clear();
            game.correctPlayers.clear();

            const audioManager = require('./audioManager');
            const songData = audioManager.selectRandomSong(room);

            if (songData) {
                game.currentSong = songData;
                GameManager.emitRoomUpdate(room, io);
                GameManager.startRound(room, io);
            } else {
                console.error(`❌ Plus de chansons disponibles pour room ${room.code}`);
                GameManager.endGame(room, io);
            }
        }
    }

    /**
     * Termine la partie
     */
    /**
     * Termine la partie
     */
    static endGame(room, io) {
        room.state = ROOM_STATES.FINISHED;

        // ✅ ENRICHIR le ranking avec les stats des joueurs
        const finalRanking = Array.from(room.scores.entries())
            .sort(([, a], [, b]) => b - a)
            .map(([pseudo, score], index) => {
                const player = room.getPlayer(pseudo);
                return {
                    rank: index + 1,
                    pseudo,
                    score,
                    // ✅ NOUVEAU : Ajouter les stats détaillées
                    correctAnswers: player?.correctAnswers || 0,
                    totalAnswers: player?.totalAnswers || 0,
                    bestStreak: player?.bestStreak || 0,
                    // ✅ Pour Discord
                    isDiscordUser: player?.isDiscordUser || false,
                    discordId: player?.discordId || null
                };
            });

        console.log(`🏆 Fin de partie room ${room.code}:`, finalRanking.map(r => `${r.rank}. ${r.pseudo} (${r.score}pts)`));

        // ✅ NOUVEAU : Sauvegarder les stats dans la DB
        try {
            if (room.gameId) {
                console.log(`📊 Finalisation de la partie gameId=${room.gameId}...`);
                db.finishGame(room.gameId);
                console.log(`✅ Partie marquée comme terminée (finished_at défini)`);

                // Journal consulté depuis la page d'administration
                db.logEvent({
                    type: 'game',
                    message: `Blind Test terminé dans ${room.code} (${finalRanking.length} joueurs)`,
                    discordId: finalRanking.find((player) => player.discordId)?.discordId || null,
                    context: {
                        roomCode: room.code,
                        gameMode: room.gameMode,
                        winner: finalRanking[0]?.pseudo || null,
                    },
                });

                // Sauvegarder les participations de chaque joueur Discord
                let savedCount = 0;
                finalRanking.forEach((player) => {
                    if (player.discordId) {
                        const roundsWon = 0; // À implémenter si vous trackez les victoires par round
                        db.addParticipation(
                            room.gameId,
                            player.discordId,
                            player.score,
                            player.rank,
                            roundsWon
                        );
                        savedCount++;
                        console.log(`✅ Participation sauvegardée: ${player.pseudo} (rank ${player.rank}, score ${player.score})`);
                    }
                });

                console.log(`📊 Stats sauvegardées pour partie ${room.code} (gameId: ${room.gameId}, ${savedCount} joueurs Discord)`);
            } else {
                console.warn(`⚠️ Aucun gameId pour la room ${room.code}, stats non sauvegardées`);
            }
        } catch (error) {
            console.error('❌ Erreur sauvegarde stats:', error);
            console.error('Stack:', error.stack);
        }

        io.to(room.code).emit('game-finished', {
            ranking: finalRanking,
            totalRounds: room.maxRounds,
            gameMode: room.gameMode  // ✅ Ajouter le mode de jeu
        });

        if (room.game) {
            room.game.cleanup();
        }

        // Auto-reset après délai
        setTimeout(() => {
            console.log(`🔄 Auto-reset room ${room.code}`);
            room.reset();
            GameManager.emitRoomUpdate(room, io);
        }, CONFIG.TIMEOUTS.GAME_RESET_DELAY);
    }

    /**
     * Gère la soumission d'une réponse avec sécurité Discord
     */
    static handleAnswerSubmission(room, pseudo, answer, socket, io) {
        if (!room.game || room.game.state !== GAME_STATES.ANSWERING) {
            console.warn(`❌ Réponse rejetée ${pseudo}: jeu non actif`);
            return false;
        }

        const success = room.game.addAnswer(pseudo, answer);

        if (success) {
            room.updateActivity();

            // Feedback immédiat au joueur
            const playerAnswer = room.game.answers.get(pseudo);
            if (playerAnswer) {
                socket.emit('answer-feedback', {
                    isCorrect: playerAnswer.isCorrect,
                    answer: playerAnswer.text,
                    pseudo: pseudo,
                    level: room.game.level
                });

                console.log(`📝 ${pseudo}: "${answer}" ${playerAnswer.isCorrect ? '✅' : '❌'} [artiste: "${room.game.currentSong.artist}"]`);
            }

            io.to(room.code).emit('player-answered', { pseudo });
            GameManager.emitRoomUpdate(room, io);

            // Vérifier si tout le monde a répondu
            if (room.game.hasAllAnswered()) {
                console.log(`✅ Tous ont répondu - Room ${room.code}`);
                GameManager.endAnswerPhase(room, io);
            }

            return true;
        } else {
            socket.emit('answer-rejected', {
                reason: 'Vous avez déjà répondu à ce niveau'
            });
            return false;
        }
    }

    /**
     * ✅ NOUVEAU : Émet la mise à jour de room avec support Discord
     */
    static emitRoomUpdate(room, io, options = {}) {
        const playersWithAnswers = room.getAllPlayers().map(player => ({
            ...player,
            currentAnswer: player.currentRoundAnswer,
            connectionStatus: player.connected ? 'connected' : 'disconnected',
            disconnectedAt: player.disconnectedAt || null,
            reconnectedAt: player.reconnectedAt || null,
            isReconnecting: !player.connected && player.disconnectedAt &&
                (Date.now() - player.disconnectedAt) < CONFIG.TIMEOUTS.QUICK_RECONNECTION_GRACE,
            // ✅ NOUVEAU : Support Discord avec avatar
            discordId: player.discordId || null,
            discordAvatar: player.discordAvatar || null,
            isDiscordUser: player.isDiscordUser || false,
            discordUsername: player.discordUsername || null,
            avatarUrl: player.discordAvatar ?
                `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=128` :
                null
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

        if (options.includeSettings) {
            baseData.artistCountRange = room.getArtistCountRange();
            baseData.answerTimeSettings = room.getAnswerTimeSettings();
        }

        io.to(room.code).emit('room-updated', baseData);
    }

    /**
     * Émet la mise à jour des paramètres
     */
    static emitSettingsUpdate(room, io) {
        io.to(room.code).emit('settings-updated', {
            artistCountRange: room.getArtistCountRange(),
            answerTimeSettings: room.getAnswerTimeSettings()
        });
    }
}

/**
 * Classe OnlineGame (refactorisée et améliorée)
 */
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
        this.currentAnswerTime = room.answerTimeSettings.current;

        console.log(`🎮 Nouvelle partie créée - Room ${room.code}: ${this.maxRounds} manches`);
    }

    cleanup() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        console.log(`🧹 Nettoyage jeu room ${this.room.code}`);
    }

    /**
     * ✅ NOUVEAU : Validation sécurisée Discord lors de l'ajout de réponse
     */
    addAnswer(pseudo, answer) {
        const player = this.room.getPlayer(pseudo);
        if (!player) {
            console.warn(`❌ Joueur ${pseudo} introuvable`);
            return false;
        }

        // Vérifier si déjà répondu à ce niveau
        if (player.currentRoundAnswer && player.currentRoundAnswer.level === this.level) {
            console.warn(`❌ ${pseudo} a déjà répondu au niveau ${this.level}`);
            return false;
        }

        // Utilisation de la fonction importée depuis answerValidation.js
        const isCorrect = isAnswerCorrect(answer.trim(), this.currentSong.artist);

        const answerData = {
            text: answer.trim(),
            level: this.level,
            timestamp: Date.now(),
            isCorrect,
            // ✅ NOUVEAU : Inclure les données Discord pour la sécurisation
            discordId: player.discordId || null,
            isDiscordUser: player.isDiscordUser || false
        };

        this.answers.set(pseudo, answerData);

        player.currentRoundAnswer = {
            text: answer.trim(),
            level: this.level,
            isCorrect
        };

        if (isCorrect) {
            player.hasFoundThisRound = true;
            this.correctPlayers.add(pseudo);
            console.log(`✅ ${pseudo} a trouvé "${this.currentSong.artist}" au niveau ${this.level} (réponse: "${answer.trim()}")`);
        }

        return true;
    }
    /**
 * Retourne les points pour un niveau donné
 */
    getPointsForLevel(level) {
        const pointsMap = {
            1: CONFIG.POINTS.LEVEL_1,  // 5 points
            2: CONFIG.POINTS.LEVEL_2,  // 3 points
            3: CONFIG.POINTS.LEVEL_3   // 1 point
        };
        return pointsMap[level] || 0;
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
            timestamp: answer.timestamp,
            // ✅ NOUVEAU : Inclure l'info Discord (pour debug/stats)
            discordId: answer.discordId,
            isDiscordUser: answer.isDiscordUser
        }));
    }

    calculateAnswerTime(audioFilename) {
        // Utiliser le temps configuré par la room
        this.currentAnswerTime = this.room.answerTimeSettings.current;
        return this.currentAnswerTime;
    }

    /**
     * Statistiques de la partie
     */
    getGameStats() {
        const connectedPlayers = this.room.getConnectedPlayers();
        const totalAnswers = this.answers.size;
        const correctAnswers = Array.from(this.answers.values()).filter(a => a.isCorrect).length;

        return {
            round: this.currentRound,
            level: this.level,
            totalPlayers: connectedPlayers.length,
            totalAnswers,
            correctAnswers,
            accuracy: totalAnswers > 0 ? (correctAnswers / totalAnswers * 100).toFixed(1) : 0,
            currentSong: this.currentSong.artist,
            gameTime: Date.now() - this.startTime
        };
    }
}

module.exports = {
    GameManager,
    OnlineGame
};
