// server/services/publicRooms.js
//
// Salles publiques et partie rapide.
//
// Une salle publique est une salle ordinaire, marquée « publique » à sa
// création : elle apparaît dans la liste de l'accueil et la partie rapide y
// envoie les joueurs. Pas besoin d'hôte réveillé : dès deux joueurs connectés,
// un compte à rebours de 20 s démarre la partie tout seul. Il s'annule si
// l'on retombe à un joueur, et l'hôte peut toujours lancer avant.
//
// La partie rapide rejoint la salle publique en attente la plus remplie ; s'il
// n'y en a pas, le client en crée une (il a déjà le formulaire pour ça).

const AUTO_START_MS = 20 * 1000;
const MIN_PLAYERS = 2;

// Minuteurs à part : un objet Timeout posé sur la salle casserait la
// sérialisation des salles envoyées aux clients.
const timers = new Map();

/**
 * Programme le démarrage automatique s'il ne l'est pas déjà.
 * Renvoie l'instant prévu (millisecondes), ou celui déjà programmé.
 */
function schedule(key, run) {
    const existing = timers.get(key);
    if (existing) return existing.at;
    const at = Date.now() + AUTO_START_MS;
    const handle = setTimeout(() => {
        timers.delete(key);
        run();
    }, AUTO_START_MS);
    if (typeof handle.unref === 'function') handle.unref();
    timers.set(key, { handle, at });
    return at;
}

function cancel(key) {
    const existing = timers.get(key);
    if (!existing) return false;
    clearTimeout(existing.handle);
    timers.delete(key);
    return true;
}

/** Salles publiques en attente, tous jeux confondus, pour l'accueil. */
function list() {
    // Chargés ici pour éviter une dépendance circulaire au démarrage
    const { roomManager } = require('./roomManager');
    const buzzerGameManager = require('./buzzer-gameManager');
    const { CONFIG, ROOM_STATES } = require('../constants');
    const maxPlayers = CONFIG.LIMITS.MAX_PLAYERS_PER_ROOM || 10;
    const rooms = [];

    roomManager.rooms.forEach((room) => {
        if (!room.isPublic || room.state !== ROOM_STATES.WAITING) return;
        const players = room.getConnectedPlayers().length;
        if (players === 0 || players >= maxPlayers) return;
        rooms.push({ game: 'blindtest', code: room.code, players, maxPlayers, autoStartAt: room.autoStartAt || null });
    });

    buzzerGameManager.games.forEach((game, code) => {
        if (!game.isPublic || game.status !== 'waiting' || game.launching) return;
        const players = Object.values(game.players || {}).filter((player) => player.connected !== false).length;
        if (players === 0 || players >= maxPlayers) return;
        rooms.push({ game: 'buzzer', code, players, maxPlayers, autoStartAt: game.autoStartAt || null });
    });

    return rooms.sort((a, b) => b.players - a.players);
}

/** Salle publique à rejoindre pour une partie rapide, ou null. */
function pickQuick(game) {
    return list().find((room) => room.game === game) || null;
}

module.exports = { AUTO_START_MS, MIN_PLAYERS, schedule, cancel, list, pickQuick };
