const buzzerBeatboxerManager = require('./buzzer-beatboxerManager');

class BuzzerGameManager {
    constructor() {
        this.games = new Map();
    }

    /**
     * Crée une nouvelle partie
     */
    createGame(roomCode, socketId, config) {
        const game = {
            roomCode,
            creatorId: socketId,
            mode: config.mode,
            filter: config.filter,
            totalRounds: config.totalRounds,
            currentRound: 0,
            currentBeatboxer: null,
            players: {},
            buzzedPlayer: null,
            pixelLevel: 100,
            startTime: null,
            usedBeatboxers: [],
            status: 'waiting',
            // ✅ AJOUT : Tracking des performances
            roundHistory: [],
            roundStartTime: null
        };

        this.games.set(roomCode, game);
        console.log(`✅ Partie créée: ${roomCode}`);
        return game;
    }

    /**
     * Récupère une partie
     */
    getGame(roomCode) {
        return this.games.get(roomCode);
    }

    /**
     * Ajoute un joueur à une partie
     */
    addPlayer(roomCode, playerId, playerData) {
        const game = this.games.get(roomCode);
        if (!game) return null;

        game.players[playerId] = {
            id: playerId,
            username: playerData.username,
            avatar: playerData.avatar || '🎤',
            score: playerData.score || 0,
            buzzes: 0,
            correctGuesses: 0,
            wrongGuesses: 0,
            // ✅ Données Discord
            discordId: playerData.discordId || null,
            discordAvatar: playerData.discordAvatar || null,
            isDiscordUser: playerData.isDiscordUser || false,
            // ✅ AJOUT CRITIQUE : État de connexion
            connected: true,
            joinedAt: Date.now(),
            disconnectedAt: null
        };

        console.log(`👤 Nouveau joueur dans ${roomCode}: ${playerData.username} ${playerData.isDiscordUser ? '(Discord)' : ''}`);
        return game;
    }

    /**
     * Démarre un nouveau round
     */
    startRound(roomCode) {
        const game = this.games.get(roomCode);
        if (!game) return null;

        // Si c'est le premier round, changer le statut
        if (game.currentRound === 0) {
            game.status = 'playing';
            console.log(`🎮 Partie démarrée: ${roomCode} - Status: ${game.status}`);
        }

        // ✅ Obtenir TOUS les beatboxers selon le mode
        let allBeatboxers;
        if (game.mode === 'buzzer_country') {
            allBeatboxers = buzzerBeatboxerManager.getBeatboxersByCountry(game.filter);
        } else if (game.mode === 'buzzer_event') {
            allBeatboxers = buzzerBeatboxerManager.getBeatboxersByEvent(game.filter);
        } else {
            // Mode par défaut : tous les beatboxers
            allBeatboxers = buzzerBeatboxerManager.beatboxersData;
        }

        if (!allBeatboxers || allBeatboxers.length === 0) {
            throw new Error('Aucun beatboxer disponible pour ce mode');
        }

        // Initialiser usedBeatboxers si pas déjà fait
        if (!game.usedBeatboxers) {
            game.usedBeatboxers = [];
        }

        // Filtrer les beatboxers déjà utilisés
        let availableBeatboxers = allBeatboxers.filter(
            bb => !game.usedBeatboxers.includes(bb.title)
        );

        // Si tous ont été utilisés, réinitialiser
        if (availableBeatboxers.length === 0) {
            console.log('⚠️ Tous les beatboxers ont été utilisés, réinitialisation');
            game.usedBeatboxers = [];
            availableBeatboxers = allBeatboxers;
        }

        // Sélectionner un beatboxer aléatoire
        const randomIndex = Math.floor(Math.random() * availableBeatboxers.length);
        const selectedBeatboxer = availableBeatboxers[randomIndex];

        console.log(`🎲 Beatboxer sélectionné: ${selectedBeatboxer.title}`);

        // Ajouter à la liste des utilisés
        game.usedBeatboxers.push(selectedBeatboxer.title);

        game.currentBeatboxer = selectedBeatboxer;
        game.currentRound++;
        game.pixelLevel = 100;
        game.buzzedPlayer = null;
        game.startTime = Date.now();
        // ✅ AJOUT : Temps de début du round pour calculer le temps de réaction
        game.roundStartTime = Date.now();

        console.log(`🎮 Round ${game.currentRound} démarré: ${selectedBeatboxer.title}`);

        return game;
    }

    /**
     * Gère un buzzer
     */
    handleBuzz(roomCode, playerId) {
        const game = this.games.get(roomCode);
        if (!game) return null;

        // Vérifier si quelqu'un a déjà buzzé
        if (game.buzzedPlayer) {
            return null;
        }

        game.buzzedPlayer = playerId;

        // ✅ AJOUTÉ : Compter les buzzes
        if (game.players[playerId]) {
            game.players[playerId].buzzes = (game.players[playerId].buzzes || 0) + 1;
        }

        return game;
    }

    /**
     * Vérifie une réponse
     */
    checkGuess(roomCode, playerId, guess) {
        const game = this.games.get(roomCode);
        if (!game) return null;

        if (!game.currentBeatboxer) return null;

        // ✅ Utiliser la fonction de validation professionnelle
        const { isAnswerCorrect } = require('../services/answerValidation');
        const correctAnswer = game.currentBeatboxer.title;
        const playerGuess = guess;

        console.log('🔍 Validation réponse:');
        console.log('  - Réponse correcte:', correctAnswer);
        console.log('  - Réponse joueur:', playerGuess);

        // ✅ Utiliser la fonction avec toutes les protections
        const isCorrect = isAnswerCorrect(playerGuess, correctAnswer);

        console.log('  - Résultat:', isCorrect ? '✅ CORRECT' : '❌ FAUX');

        // ✅ NOUVEAU : Système de points +2/-1
        if (isCorrect && game.players[playerId]) {
            game.players[playerId].score += 2; // ✅ +2 points pour bonne réponse
            game.players[playerId].correctGuesses = (game.players[playerId].correctGuesses || 0) + 1;

            // ✅ AJOUT : Enregistrer la performance pour les stats
            if (!game.roundHistory) {
                game.roundHistory = [];
            }

            const reactionTime = game.roundStartTime ? Date.now() - game.roundStartTime : 1000;
            game.roundHistory.push({
                round: game.currentRound,
                beatboxer: game.currentBeatboxer.title,
                buzzedPlayer: playerId,
                isCorrect: true,
                reactionTime: reactionTime,
                pointsEarned: 2,
                timestamp: Date.now()
            });

        } else if (game.players[playerId]) {
            game.players[playerId].score -= 1; // ✅ -1 point pour mauvaise réponse
            game.players[playerId].wrongGuesses = (game.players[playerId].wrongGuesses || 0) + 1;

            // ✅ AJOUT : Enregistrer aussi les mauvaises réponses
            // ✅ Enregistrer la performance pour les stats
            if (!game.roundHistory) {
                game.roundHistory = [];
            }

            const reactionTime = game.roundStartTime ? Date.now() - game.roundStartTime : 1000;
            game.roundHistory.push({
                round: game.currentRound,
                beatboxer: game.currentBeatboxer.title,
                buzzedPlayer: playerId,
                isCorrect: isCorrect, // ✅ Important : sauvegarder le vrai résultat
                reactionTime: reactionTime,
                pointsEarned: isCorrect ? 2 : -1,
                timestamp: Date.now()
            });
        }
        return {
            isCorrect,
            correctAnswer: game.currentBeatboxer.title,
            players: game.players,
            scores: Object.values(game.players).map(p => ({
                id: p.id,
                username: p.username,
                avatar: p.avatar,
                score: p.score,
                buzzes: p.buzzes || 0,
                correctGuesses: p.correctGuesses || 0,
                wrongGuesses: p.wrongGuesses || 0
            })).sort((a, b) => b.score - a.score)
        };
    }

    /**
     * Passe au round suivant
     */
    nextRound(roomCode) {
        const game = this.games.get(roomCode);
        if (!game) return null;

        if (game.currentRound >= game.totalRounds) {
            game.status = 'finished';
            return null;
        }

        return this.startRound(roomCode);
    }

    /**
     * Termine une partie
     */
    endGame(roomCode) {
        const game = this.games.get(roomCode);
        if (!game) return null;

        game.status = 'finished';

        const finalScores = Object.values(game.players)
            .map(p => ({
                id: p.id,
                username: p.username,
                avatar: p.avatar,
                score: p.score,
                buzzes: p.buzzes || 0,
                correctGuesses: p.correctGuesses || 0,
                wrongGuesses: p.wrongGuesses || 0,
                // ✅ AJOUT : Données Discord pour sauvegarde
                discordId: p.discordId || null,
                discordAvatar: p.discordAvatar || null,
                isDiscordUser: p.isDiscordUser || false
            }))
            .sort((a, b) => b.score - a.score);

        return {
            finalScores,
            winner: finalScores[0]
        };
    }
    /**
     * Supprime une partie
     */
    deleteGame(roomCode) {
        this.games.delete(roomCode);
        console.log(`🗑️ Partie supprimée: ${roomCode}`);
    }

    /**
     * Met à jour le niveau de pixelisation
     */
    updatePixelLevel(roomCode, pixelLevel) {
        const game = this.games.get(roomCode);
        if (!game) return null;

        game.pixelLevel = pixelLevel;
        return game;
    }
}

module.exports = new BuzzerGameManager();