/**
 * Beatbox Party : événements Socket.IO.
 *
 * Toutes les salles vivent en mémoire (Map code -> PartyGame). Un joueur est
 * reconnu par une clé secrète (renvoyée à la création ou à l'arrivée, gardée
 * par le navigateur) : en cas de coupure, il retrouve sa place, même en pleine
 * partie. Les salles sans joueur connecté disparaissent après quelques minutes.
 */

const { PartyGame } = require('./PartyGame');
const { getBoard } = require('./boards');

const games = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const EMPTY_ROOM_TTL = 10 * 60 * 1000;
const roomName = (code) => `party:${code}`;
// Accélère toutes les attentes (tests locaux uniquement) : PARTY_TIME_SCALE=0.3
const TIME_SCALE = Math.min(1, Math.max(0.05, Number(process.env.PARTY_TIME_SCALE) || 1));

let ioRef = null;
let sweeper = null;

function newCode() {
    let code;
    do {
        code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    } while (games.has(code));
    return code;
}

function createGame() {
    const code = newCode();
    const game = new PartyGame(code, {
        timeScale: TIME_SCALE,
        emit: (state) => {
            if (ioRef) ioRef.to(roomName(code)).emit('party:state', state);
        },
    });
    games.set(code, game);
    return game;
}

// Salles vides : supprimées après EMPTY_ROOM_TTL sans aucun joueur connecté
function sweep() {
    const now = Date.now();
    games.forEach((game, code) => {
        if (game.connectedHumans() > 0) {
            game.emptySince = null;
            return;
        }
        if (!game.emptySince) game.emptySince = now;
        if (now - game.emptySince > EMPTY_ROOM_TTL) {
            game.destroy();
            games.delete(code);
        }
    });
}

const reply = (callback, payload) => {
    if (typeof callback === 'function') callback(payload);
};

function handlePartySocketConnection(socket, io) {
    ioRef = io;
    if (!sweeper) {
        sweeper = setInterval(sweep, 60 * 1000);
        if (sweeper.unref) sweeper.unref();
    }

    const discordName = () => socket.discordUser?.username || null;
    const discordId = () => socket.discordUser?.discordId || null;

    // Salle et joueur liés à ce socket
    const context = () => {
        const link = socket.data.party;
        if (!link) return {};
        const game = games.get(link.code);
        if (!game) return {};
        return { game, playerId: link.playerId };
    };

    const enter = (game, player, callback) => {
        const previous = socket.data.party;
        if (previous && previous.code !== game.code) socket.leave(roomName(previous.code));
        socket.data.party = { code: game.code, playerId: player.id };
        socket.join(roomName(game.code));
        reply(callback, { ok: true, code: game.code, playerId: player.id, key: player.key, state: game.snapshot() });
    };

    socket.on('party:create', (payload = {}, callback) => {
        const game = createGame();
        const result = game.addHuman({
            name: discordName() || payload.name,
            characterId: payload.characterId,
            socketId: socket.id,
            discordId: discordId(),
        });
        if (result.error) return reply(callback, { ok: false, error: result.error });
        return enter(game, result.player, callback);
    });

    socket.on('party:join', (payload = {}, callback) => {
        const code = String(payload.code || '').trim().toUpperCase();
        const game = games.get(code);
        if (!game) return reply(callback, { ok: false, error: 'room_not_found' });
        // Retour d'un joueur déjà inscrit (rechargement de page, coupure réseau)
        if (payload.key) {
            const player = game.reconnect(String(payload.key), socket.id);
            if (player) return enter(game, player, callback);
        }
        const result = game.addHuman({
            name: discordName() || payload.name,
            characterId: payload.characterId,
            socketId: socket.id,
            discordId: discordId(),
        });
        if (result.error) return reply(callback, { ok: false, error: result.error });
        return enter(game, result.player, callback);
    });

    // Plan du plateau, pour les scènes de l'accueil (avant d'entrer dans une salle)
    socket.on('party:board', (payload = {}, callback) => {
        reply(callback, { ok: true, board: getBoard(String((payload && payload.id) || 'setup')) });
    });

    socket.on('party:leave', (payload, callback) => {
        const { game, playerId } = context();
        if (game) {
            game.leave(playerId);
            socket.leave(roomName(game.code));
        }
        socket.data.party = null;
        reply(callback, { ok: true });
    });

    // Actions de jeu : toutes renvoient { ok } ou { ok: false, error }
    const action = (event, run) => {
        socket.on(event, (payload = {}, callback) => {
            const { game, playerId } = context();
            if (!game) return reply(callback, { ok: false, error: 'not_in_room' });
            try {
                const result = run(game, playerId, payload || {}) || {};
                return reply(callback, result.error ? { ok: false, error: result.error } : { ok: true });
            } catch (error) {
                console.error(`[party] ${event}:`, error);
                return reply(callback, { ok: false, error: 'server_error' });
            }
        });
    };

    action('party:character', (game, id, p) => game.setCharacter(id, String(p.characterId || '')));
    action('party:addBot', (game, id) => game.addBot(id));
    action('party:removeBot', (game, id, p) => game.removeBot(id, String(p.playerId || '')));
    action('party:settings', (game, id, p) => game.updateSettings(id, p));
    action('party:start', (game, id) => game.start(id));
    action('party:roll', (game, id, p) => {
        if (game.phase === 'order') return game.rollForOrder(id);
        if (game.step === 'scratch') return game.scratch(id);
        if (game.step === 'wheel') return game.stopWheel(id);
        if (game.step === 'freestyle') return game.stopReel(id);
        if (game.step === 'steal') return game.mash(id);
        return game.rollDice(id);
    });
    action('party:wheel', (game, id) => game.stopWheel(id));
    action('party:reel', (game, id) => game.stopReel(id));
    action('party:item', (game, id, p) => game.useItem(id, String(p.item || '')));
    action('party:buy', (game, id, p) => game.buyItem(id, p.item ? String(p.item) : null));
    action('party:thief', (game, id, p) => game.chooseThief(id, String(p.choice || 'none')));
    action('party:victim', (game, id, p) => game.chooseVictim(id, String(p.playerId || '')));
    action('party:mash', (game, id) => game.mash(id));
    action('party:choose', (game, id, p) => game.choose(id, p.spaceId));
    action('party:star', (game, id, p) => game.resolveStar(id, Boolean(p.buy)));
    action('party:ready', (game, id) => game.setReady(id));
    action('party:mgResult', (game, id, p) => game.submitMinigame(id, p.raw));
    action('party:rematch', (game, id) => game.rematch(id));

    socket.on('disconnect', () => {
        const { game, playerId } = context();
        if (game) game.disconnect(playerId);
    });
}

module.exports = { handlePartySocketConnection, games };
