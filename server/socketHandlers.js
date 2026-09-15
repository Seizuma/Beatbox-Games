const {
    createRoom, joinRoom, startRound, requestCountdown,
    authorizeAnswer, playerAnswer, gmConfirmNextLevel,
    gmConfirmNextRound, disconnectPlayer
} = require('./game');

function handleSocketConnection(socket, io) {
    // NOTE: Tu peux aussi tout coller dans un seul objet 'handlers' pour plus de DRY
    socket.on('create-room', (data) => createRoom(socket, io, data));
    socket.on('join-room', (data) => joinRoom(socket, io, data));
    socket.on('start-round', (data) => startRound(socket, io, data));
    socket.on('request-countdown', (data) => requestCountdown(socket, io, data));
    socket.on('authorize-answer', (data) => authorizeAnswer(socket, io, data));
    socket.on('player-answer', (data) => playerAnswer(socket, io, data));
    socket.on('gm-confirm-next-level', (data) => gmConfirmNextLevel(socket, io, data));
    socket.on('gm-confirm-next-round', (data) => gmConfirmNextRound(socket, io, data));
    socket.on('disconnect', () => disconnectPlayer(socket, io));
}

module.exports = { handleSocketConnection };
