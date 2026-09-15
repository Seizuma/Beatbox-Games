const fs = require('fs');
const path = require('path');
const { rooms, updateRemainingRounds } = require('./rooms');
const { createGameState, normalize } = require('./utils');

const BASE_URL = 'https://beatboxgames.com/audio';

// ======== HELPERS ========
function getConnectedPseudos(roomObj) {
    return roomObj.players.filter(p => p.isConnected).map(p => p.pseudo);
}
function getAllPseudos(roomObj) {
    return roomObj.players.map(p => p.pseudo);
}
function findPlayer(roomObj, pseudo) {
    return roomObj.players.find(p => p.pseudo === pseudo);
}

// ======== DELETE ROOM ========
function deleteRoom(roomCode, io) {
    if (rooms[roomCode]) {
        delete rooms[roomCode];
        io.to(roomCode).emit('room-deleted'); // Optionnel : informe les clients
    }
}

// ======== CRÉER UNE ROOM ========
function createRoom(socket, io, { code }) {
    // Si ce socket était déjà GM d'une room, supprime l'ancienne
    const oldRoom = socket.data.room;
    if (oldRoom && rooms[oldRoom]) {
        deleteRoom(oldRoom, io);
    }
    if (rooms[code]) {
        return socket.emit('room-created', { success: false, reason: 'Code déjà pris' });
    }
    rooms[code] = {
        players: [],
        scores: {},
        playedArtists: [],
        game: null
    };
    socket.data.room = code;
    socket.data.isGM = true;
    socket.join(code);
    socket.emit('room-created', { success: true, code });
}

// ======== REJOINDRE UNE ROOM ========
function joinRoom(socket, io, { pseudo, room }) {
    const r = rooms[room];
    if (!r) {
        socket.emit('joined-room', { success: false, reason: 'Room inconnue ou expirée' });
        return;
    }

    // Recherche joueur déjà existant
    let player = findPlayer(r, pseudo);
    if (player) {
        if (!player.isConnected) {
            // RECONNEXION
            player.isConnected = true;
            if (player.disconnectTimeout) {
                clearTimeout(player.disconnectTimeout);
                player.disconnectTimeout = null;
            }
            socket.data.pseudo = pseudo;
            socket.data.room = room;
            socket.join(room);
            socket.emit('joined-room', { success: true });
            io.to(room).emit('update-players', getAllPseudos(r));
            io.to(room).emit('update-scores', r.scores);
            return;
        } else {
            // déjà présent ET connecté => refuse
            socket.emit('joined-room', { success: false, reason: 'Ce pseudo est déjà utilisé dans cette room' });
            return;
        }
    }

    // Nouveau joueur
    player = { pseudo, isConnected: true, disconnectTimeout: null };
    r.players.push(player);
    r.scores[pseudo] = 0;
    socket.data.pseudo = pseudo;
    socket.data.room = room;
    socket.join(room);

    socket.emit('joined-room', { success: true });
    io.to(room).emit('update-players', getAllPseudos(r));
    io.to(room).emit('update-scores', r.scores);
}

// ======== LANCER UNE MANCHE ========
function startRound(socket, io, { room }) {
    const r = rooms[room];
    if (!r) return;
    if (r.game?.timeoutId) {
        clearTimeout(r.game.timeoutId);
        r.game.timeoutId = null;
    }
    const dir = path.join(__dirname, 'public', 'audio');
    fs.readdir(dir, (err, files) => {
        if (err) return;
        const level1 = files.filter(f => f.startsWith('Level 1 -'));
        const available = level1.filter(f => !r.playedArtists.includes(f));
        if (available.length === 0) return;
        const pick = available[Math.floor(Math.random() * available.length)];
        const artist = pick.replace('Level 1 - ', '').replace('.mp3', '');
        const url = `${BASE_URL}/${encodeURIComponent(pick)}`;
        r.playedArtists.push(pick);
        r.game = createGameState(artist, r.players.length);
        io.to(room).emit('round-started', { artist, url, level: 1 });
        updateRemainingRounds(room, io);
    });
}

// ======== COMPTE À REBOURS AVANT AUDIO ========
function requestCountdown(socket, io, { room }) {
    io.to(room).emit('start-countdown');
}

// ======== AUTORISER LA RÉPONSE DES JOUEURS ========
function authorizeAnswer(socket, io, { room }) {
    const r = rooms[room];
    const g = r?.game;
    if (!g) return;
    if (g.timerActive) return;
    // Autorise uniquement les connectés n'ayant pas trouvé
    const authorized = getConnectedPseudos(r).filter(pseudo => !g.correct.has(pseudo));
    authorized.forEach(pseudo => {
        const client = [...io.sockets.sockets.values()].find(s => s.data.pseudo === pseudo && s.data.room === room);
        if (client) client.emit('authorize-answer');
    });

    io.to(room).emit('start-timer', { seconds: 60 });
    g.timerActive = true;
    g.timeoutId = setTimeout(() => {
        handleForceAnswers(room, io);
    }, 60000);
}

// ======== TRAITER LA RÉPONSE D'UN JOUEUR ========
function playerAnswer(socket, io, { pseudo, room, answer }) {
    const r = rooms[room];
    if (!r || !r.game) return;
    const g = r.game;

    if (g.answers[pseudo] && g.answers[pseudo].level === g.level) {
        return;
    }
    const isCorrect = normalize(answer) === normalize(g.artist);

    // ✅ AMÉLIORATION : Stocker plus d'informations sur la réponse
    g.answers[pseudo] = {
        level: g.level,
        isCorrect,
        answer: answer.trim(), // ✅ Stocker la réponse complète
        timestamp: new Date().toISOString() // ✅ Horodatage
    };

    if (isCorrect) {
        g.correct.add(pseudo);
        g.winners.add(pseudo); // Gagnant de la manche
        if (!g.correctByLevel[g.level]) g.correctByLevel[g.level] = new Set();
        g.correctByLevel[g.level].add(pseudo);
    }

    socket.emit('answer-feedback', { correct: isCorrect });

    // ✅ AMÉLIORATION : Envoyer plus d'infos à tous les clients
    io.to(room).emit('player-answered', {
        pseudo,
        isCorrect,
        answer: answer.trim(), // ✅ Réponse complète pour le GM
        level: g.level,
        timestamp: g.answers[pseudo].timestamp
    });

    // ✅ NOUVEAU : Événement spécial pour le GM avec toutes les réponses
    const gm = [...io.sockets.sockets.values()].find(s => s.data.room === room && s.data.isGM);
    if (gm) {
        // Envoyer l'état complet des réponses au GM
        const allAnswersForGM = Object.entries(g.answers)
            .filter(([, answerData]) => answerData.level === g.level)
            .map(([playerPseudo, answerData]) => ({
                pseudo: playerPseudo,
                answer: answerData.answer,
                isCorrect: answerData.isCorrect,
                timestamp: answerData.timestamp
            }));

        gm.emit('gm-answers-update', {
            level: g.level,
            artist: g.artist,
            answers: allAnswersForGM
        });
    }

    // CHECK SI TOUS LES JOUEURS (connectés ou non) ONT RÉPONDU
    const allAnswered = getAllPseudos(r).every(p =>
        g.answers[p]?.level === g.level || g.correct.has(p)
    );
    if (allAnswered) {
        stopTimerForRoom(room, io);
        handleEndOfLevel(room, io);
    }
}

// ======== FORCER LES RÉPONSES VIDES SI TIMER À 0 ========
function handleForceAnswers(room, io) {
    const r = rooms[room];
    const g = r?.game;
    if (!g || !r) return;

    // Pour tous les connectés qui n'ont pas répondu
    getConnectedPseudos(r).forEach(p => {
        if (!g.answers[p] && !g.correct.has(p)) {
            const fakeSocket = [...io.sockets.sockets.values()].find(s => s.data.pseudo === p && s.data.room === room);
            if (fakeSocket) {
                fakeSocket.emit('answer-feedback', { correct: false });
            }
            io.to(room).emit('player-answered', { pseudo: p, isCorrect: false, answer: '', timestamp: new Date().toISOString() });
            // ✅ AMÉLIORATION : Stocker aussi les réponses forcées
            g.answers[p] = { level: g.level, isCorrect: false, answer: '', timestamp: new Date().toISOString() };
        }
    });

    // ✅ NOUVEAU : Mettre à jour le GM avec les réponses forcées
    const gm = [...io.sockets.sockets.values()].find(s => s.data.room === room && s.data.isGM);
    if (gm) {
        const allAnswersForGM = Object.entries(g.answers)
            .filter(([, answerData]) => answerData.level === g.level)
            .map(([playerPseudo, answerData]) => ({
                pseudo: playerPseudo,
                answer: answerData.answer,
                isCorrect: answerData.isCorrect,
                timestamp: answerData.timestamp
            }));

        gm.emit('gm-answers-update', {
            level: g.level,
            artist: g.artist,
            answers: allAnswersForGM
        });
    }

    stopTimerForRoom(room, io);
    handleEndOfLevel(room, io);
}

// ======== STOP TIMER ========
function stopTimerForRoom(room, io) {
    const r = rooms[room];
    const g = r?.game;
    if (!g) return;
    if (g.timeoutId) {
        clearTimeout(g.timeoutId);
        g.timeoutId = null;
    }
    g.timerActive = false;
    io.to(room).emit('stop-timer');
}

// ======== FIN DE NIVEAU ========
function handleEndOfLevel(room, io) {
    const r = rooms[room];
    const g = r?.game;
    if (!g || !r) return;
    const pts = { 1: 5, 2: 3, 3: 1 };
    getAllPseudos(r).forEach(p => {
        const ans = g.answers[p];
        const key = `${p}-level${ans?.level}`;
        if (ans?.isCorrect && !g.scored.has(key)) {
            r.scores[p] += pts[ans.level];
            g.scored.add(key);
        }
    });
    io.to(room).emit('update-scores', r.scores);

    const allFound = getAllPseudos(r).every(p => g.winners.has(p)); // tous ont trouvé à un moment
    const gm = [...io.sockets.sockets.values()].find(s => s.data.room === room && s.data.isGM);

    if (allFound) {
        io.to(room).emit('round-result', {
            message: `✅ Tous ont trouvé ! C'était : ${g.artist}`
        });
        gm && gm.emit('gm-choose-next-round');
    } else if (g.level === 3) {
        io.to(room).emit('round-result', {
            message: `⛔ Manche terminée ! La réponse était : ${g.artist}`
        });
        gm && gm.emit('gm-choose-next-round');
    } else {
        gm && gm.emit('gm-choose-next-level', { artist: g.artist, level: g.level + 1 });
    }
}

// ======== PASSE AU NIVEAU SUIVANT ========
function gmConfirmNextLevel(socket, io, { room }) {
    const r = rooms[room];
    if (!r || !r.game) return;
    const g = r.game;

    stopTimerForRoom(room, io);

    const nextLevel = g.level + 1;
    if (nextLevel > 3) return;

    g.level = nextLevel;

    const dir = path.join(__dirname, 'public', 'audio');
    fs.readdir(dir, (err, files) => {
        if (err) return;

        const targetFile = files.find(f =>
            f.startsWith(`Level ${nextLevel} -`) &&
            normalize(f.replace(`Level ${nextLevel} -`, '').replace('.mp3', '')) === normalize(g.artist)
        );
        if (!targetFile) return;

        const nextUrl = `${BASE_URL}/${encodeURIComponent(targetFile)}`;
        io.to(room).emit('round-started', {
            artist: g.artist,
            url: nextUrl,
            level: nextLevel
        });
    });
}

// ======== PASSE À LA MANCHE SUIVANTE ========
function gmConfirmNextRound(socket, io, { room }) {
    const r = rooms[room];
    if (!r || !r.game) return;
    stopTimerForRoom(room, io);
    const g = r.game;
    const pts = { 1: 5, 2: 3, 3: 1 };
    Object.entries(g.answers).forEach(([pseudo, answerData]) => {
        const key = `${pseudo}-level${answerData.level}`;
        if (answerData.isCorrect && !g.scored.has(key)) {
            r.scores[pseudo] += pts[answerData.level] || 0;
            g.scored.add(key);
        }
    });
    io.to(room).emit('update-scores', r.scores);
    io.to(room).emit('next-round');
    updateRemainingRounds(room, io);
}

// ======== GESTION DU DISCONNECT ========
function disconnectPlayer(socket, io) {
    const { room, pseudo } = socket.data || {};
    if (room && pseudo) {
        const r = rooms[room];
        if (r) {
            const player = findPlayer(r, pseudo);
            if (player && player.isConnected) {
                player.isConnected = false;
                // Timer : suppression si non revenu dans 5min
                player.disconnectTimeout = setTimeout(() => {
                    // Suppression définitive si non revenu
                    r.players = r.players.filter(p => p.pseudo !== pseudo);
                    delete r.scores[pseudo];
                    io.to(room).emit('update-players', getAllPseudos(r));
                    io.to(room).emit('update-scores', r.scores);

                    // === SUPPRIMER LA ROOM SI VIDE ===
                    if (r.players.length === 0) {
                        deleteRoom(room, io);
                    }
                }, 5 * 60 * 1000);
            }
        }
    }
}

module.exports = {
    createRoom,
    joinRoom,
    startRound,
    requestCountdown,
    authorizeAnswer,
    playerAnswer,
    gmConfirmNextLevel,
    gmConfirmNextRound,
    disconnectPlayer
};