/**
 * Une partie de Beatbox Party : salon, ordre de passage, tours de plateau,
 * mini-jeux et fin de partie. Le serveur décide de tout (dés, déplacements,
 * scores) ; les clients ne font qu'afficher l'état et envoyer les choix.
 *
 * Chaque changement produit un instantané complet (snapshot), envoyé à toute
 * la salle avec, si besoin, l'événement à animer (event : dé, déplacement…).
 *
 * Les attentes (choix d'un joueur, animations) passent par schedule() : avec
 * timeScale < 1, une partie entière se joue en quelques secondes (tests).
 */

const crypto = require('crypto');
const { getBoard } = require('./boards');
const { MINIGAMES, MINIGAME_IDS } = require('./minigames');

const CHARACTER_IDS = ['nova', 'grizz', 'kick', 'lila', 'robox', 'mamie', 'flex', 'mimi'];
const BOT_NAMES = ['Bot Tempo', 'Bot Snare', 'Bot Kick', 'Bot Loop', 'Bot Hi-Hat', 'Bot Bass'];
const MAX_PLAYERS = 4;
const TURN_OPTIONS = [5, 10, 15, 20];
const MINIGAME_REWARDS = [10, 5, 2, 0];
const START_HYPE = 10;

// Durées en millisecondes (multipliées par timeScale)
const TIMING = {
    orderRoll: 12000,
    orderReveal: 3500,
    starIntro: 3200,
    turnIntro: 2400,
    roll: 30000,
    rollReveal: 1500,
    hop: 340,
    afterMove: 250,
    choice: 15000,
    star: 15000,
    starShow: 3000,
    land: 2000,
    mgIntro: 10000,
    mgCountdown: 3000,
    mgGrace: 2500,
    mgResults: 6500,
    finaleIntro: 3000,
    disconnectedAuto: 1500,
    botMin: 700,
    botMax: 1600,
};

const sanitizeName = (value) => String(value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);

class PartyGame {
    constructor(code, { emit = () => {}, timeScale = 1, random = Math.random, now = Date.now } = {}) {
        this.code = code;
        this.emitState = emit;
        this.timeScale = timeScale;
        this.random = random;
        this.now = now;
        this.createdAt = now();
        this.phase = 'lobby'; // lobby, order, turn, minigame, end
        this.step = null;
        this.deadline = null;
        this.players = [];
        this.hostId = null;
        this.settings = { turns: 10, board: 'openmic' };
        this.board = getBoard(this.settings.board);
        this.timers = new Set();
        this.token = 0;
        this.seq = 0;
        this.event = null;
        this.nextPlayerNumber = 1;
        this.resetGameState();
    }

    resetGameState() {
        this.turn = 0;
        this.order = [];
        this.orderRolls = {};
        this.turnIndex = 0;
        this.starSpace = null;
        this.stageOwner = null;
        this.roll = null;
        this.move = null;
        this.choice = null;
        this.starOffer = null;
        this.minigame = null;
        this.minigameBag = [];
        this.finalRanking = null;
    }

    // -----------------------------------------------------------------------
    // Outils
    // -----------------------------------------------------------------------

    ms(value) {
        return Math.max(1, Math.round(value * this.timeScale));
    }

    randInt(min, max) {
        return min + Math.floor(this.random() * (max - min + 1));
    }

    schedule(fn, delay) {
        const handle = setTimeout(() => {
            this.timers.delete(handle);
            fn();
        }, Math.max(0, delay));
        this.timers.add(handle);
        return handle;
    }

    clearTimers() {
        this.timers.forEach((handle) => clearTimeout(handle));
        this.timers.clear();
    }

    destroy() {
        this.clearTimers();
    }

    player(id) {
        return this.players.find((p) => p.id === id) || null;
    }

    humans() {
        return this.players.filter((p) => !p.isBot);
    }

    current() {
        return this.player(this.order[this.turnIndex]);
    }

    isFinale() {
        return this.phase !== 'lobby' && this.turn > this.settings.turns - 3;
    }

    // Nouvelle étape : invalide les attentes de l'étape précédente
    setStep(phase, step, waitMs = null) {
        this.phase = phase;
        this.step = step;
        this.token += 1;
        this.deadline = waitMs != null ? this.now() + waitMs : null;
        return this.token;
    }

    // Planifie une suite qui n'a lieu que si l'étape n'a pas changé entre-temps
    later(token, delay, fn) {
        this.schedule(() => {
            if (token === this.token) fn();
        }, delay);
    }

    // Attend l'action d'un joueur : un bot répond vite, un joueur absent aussi, sinon délai normal
    awaitPlayer(token, player, waitMs, auto) {
        let delay = waitMs;
        if (player.isBot) delay = this.ms(this.randInt(TIMING.botMin, TIMING.botMax));
        else if (!player.connected) delay = this.ms(TIMING.disconnectedAuto);
        this.later(token, delay, auto);
    }

    publish(event = null) {
        if (event) {
            this.seq += 1;
            this.event = { ...event, seq: this.seq, at: this.now() };
        }
        this.emitState(this.snapshot());
    }

    snapshot() {
        return {
            code: this.code,
            phase: this.phase,
            step: this.step,
            deadline: this.deadline,
            serverNow: this.now(),
            hostId: this.hostId,
            settings: { ...this.settings, turnOptions: TURN_OPTIONS },
            board: this.board,
            turn: this.turn,
            finale: this.isFinale(),
            order: this.order,
            currentPlayerId: this.phase === 'turn' ? this.order[this.turnIndex] || null : null,
            orderRolls: this.orderRolls,
            players: this.players.map((p) => ({
                id: p.id,
                seat: p.seat,
                name: p.name,
                characterId: p.characterId,
                isBot: p.isBot,
                connected: p.connected,
                hype: p.hype,
                stars: p.stars,
                space: p.space,
                ready: p.ready,
                minigameWins: p.stats.minigameWins,
            })),
            starSpace: this.starSpace,
            starPrice: this.board.starPrice,
            stageOwner: this.stageOwner,
            roll: this.roll,
            choice: this.choice,
            starOffer: this.starOffer,
            minigame: this.minigame && {
                id: this.minigame.id,
                seed: this.minigame.seed,
                params: this.minigame.params,
                startsAt: this.minigame.startsAt,
                endsAt: this.minigame.endsAt,
                submitted: Object.keys(this.minigame.raw),
                results: this.minigame.results,
            },
            finalRanking: this.finalRanking,
            event: this.event,
        };
    }

    // -----------------------------------------------------------------------
    // Salon
    // -----------------------------------------------------------------------

    freeCharacters() {
        const taken = new Set(this.players.map((p) => p.characterId));
        return CHARACTER_IDS.filter((id) => !taken.has(id));
    }

    freeSeat() {
        for (let seat = 0; seat < MAX_PLAYERS; seat += 1) {
            if (!this.players.some((p) => p.seat === seat)) return seat;
        }
        return -1;
    }

    createPlayer({ name, characterId, isBot = false, socketId = null, discordId = null }) {
        const free = this.freeCharacters();
        const character = free.includes(characterId) ? characterId : free[0];
        const player = {
            id: `p${this.nextPlayerNumber}`,
            key: isBot ? null : crypto.randomBytes(12).toString('hex'),
            seat: this.freeSeat(),
            name: sanitizeName(name) || (isBot ? 'Bot' : 'Joueur'),
            characterId: character,
            isBot,
            connected: !isBot,
            socketId,
            discordId,
            hype: START_HYPE,
            stars: 0,
            space: null,
            ready: false,
            stats: { minigameWins: 0, hypeEarned: 0 },
        };
        this.nextPlayerNumber += 1;
        this.players.push(player);
        this.players.sort((a, b) => a.seat - b.seat);
        return player;
    }

    addHuman({ name, characterId, socketId, discordId }) {
        if (this.phase !== 'lobby') return { error: 'already_started' };
        if (this.humans().length >= MAX_PLAYERS) return { error: 'room_full' };
        if (this.players.length >= MAX_PLAYERS) {
            // La salle est complétée par des bots : un humain prend la place du dernier
            const bot = [...this.players].reverse().find((p) => p.isBot);
            if (!bot) return { error: 'room_full' };
            this.players = this.players.filter((p) => p !== bot);
        }
        const player = this.createPlayer({ name, characterId, socketId, discordId });
        if (!this.hostId) this.hostId = player.id;
        this.publish({ type: 'joined', playerId: player.id });
        return { player };
    }

    reconnect(key, socketId) {
        const player = this.players.find((p) => p.key && p.key === key);
        if (!player) return null;
        player.connected = true;
        player.socketId = socketId;
        if (!this.player(this.hostId) || !this.player(this.hostId).connected) this.hostId = player.id;
        this.publish({ type: 'reconnected', playerId: player.id });
        return player;
    }

    disconnect(playerId) {
        const player = this.player(playerId);
        if (!player || player.isBot) return;
        player.connected = false;
        player.socketId = null;
        if (this.phase === 'lobby') {
            // Sans retour rapide, la place se libère
            this.schedule(() => {
                const again = this.player(playerId);
                if (again && !again.connected && this.phase === 'lobby') this.removePlayer(playerId);
            }, this.ms(20000));
        }
        this.transferHostIfNeeded();
        this.publish({ type: 'disconnected', playerId });
    }

    leave(playerId) {
        const player = this.player(playerId);
        if (!player) return;
        if (this.phase === 'lobby') this.removePlayer(playerId);
        else this.disconnect(playerId);
    }

    removePlayer(playerId) {
        this.players = this.players.filter((p) => p.id !== playerId);
        this.transferHostIfNeeded();
        this.publish({ type: 'left', playerId });
    }

    transferHostIfNeeded() {
        const host = this.player(this.hostId);
        if (host && host.connected) return;
        const next = this.humans().find((p) => p.connected);
        this.hostId = next ? next.id : this.hostId;
    }

    connectedHumans() {
        return this.humans().filter((p) => p.connected).length;
    }

    setCharacter(playerId, characterId) {
        if (this.phase !== 'lobby') return { error: 'already_started' };
        if (!CHARACTER_IDS.includes(characterId)) return { error: 'invalid_character' };
        const player = this.player(playerId);
        if (!player) return { error: 'not_in_room' };
        const owner = this.players.find((p) => p.characterId === characterId);
        if (owner && owner !== player) {
            if (!owner.isBot) return { error: 'character_taken' };
            owner.characterId = player.characterId; // échange avec le bot
        }
        player.characterId = characterId;
        this.publish({ type: 'character', playerId });
        return { ok: true };
    }

    addBot(requesterId) {
        if (requesterId !== this.hostId) return { error: 'not_host' };
        if (this.phase !== 'lobby') return { error: 'already_started' };
        if (this.players.length >= MAX_PLAYERS) return { error: 'room_full' };
        const used = new Set(this.players.map((p) => p.name));
        const name = BOT_NAMES.find((n) => !used.has(n)) || 'Bot';
        const bot = this.createPlayer({ name, isBot: true, characterId: this.freeCharacters()[this.randInt(0, this.freeCharacters().length - 1)] });
        this.publish({ type: 'joined', playerId: bot.id });
        return { ok: true };
    }

    removeBot(requesterId, botId) {
        if (requesterId !== this.hostId) return { error: 'not_host' };
        const bot = this.player(botId);
        if (!bot || !bot.isBot || this.phase !== 'lobby') return { error: 'invalid' };
        this.removePlayer(botId);
        return { ok: true };
    }

    updateSettings(requesterId, settings = {}) {
        if (requesterId !== this.hostId) return { error: 'not_host' };
        if (this.phase !== 'lobby') return { error: 'already_started' };
        if (TURN_OPTIONS.includes(Number(settings.turns))) this.settings.turns = Number(settings.turns);
        this.publish({ type: 'settings' });
        return { ok: true };
    }

    // -----------------------------------------------------------------------
    // Début de partie : ordre de passage
    // -----------------------------------------------------------------------

    start(requesterId) {
        if (requesterId !== this.hostId) return { error: 'not_host' };
        if (this.phase !== 'lobby') return { error: 'already_started' };
        while (this.players.length < MAX_PLAYERS) this.addBot(this.hostId);
        this.resetGameState();
        this.players.forEach((p) => {
            p.hype = START_HYPE;
            p.stars = 0;
            p.space = this.board.start;
            p.ready = false;
            p.stats = { minigameWins: 0, hypeEarned: 0 };
        });
        this.starSpace = this.pickStarSpot(null);
        const token = this.setStep('order', 'roll', this.ms(TIMING.orderRoll));
        this.publish({ type: 'started' });
        this.players.forEach((p) => this.awaitPlayer(token, p, this.ms(TIMING.orderRoll), () => this.rollForOrder(p.id)));
        return { ok: true };
    }

    rollForOrder(playerId) {
        if (this.phase !== 'order' || this.step !== 'roll') return { error: 'not_now' };
        if (this.orderRolls[playerId] != null) return { error: 'already_rolled' };
        // Pas d'égalité : chaque valeur ne sort qu'une fois
        const taken = new Set(Object.values(this.orderRolls));
        let value;
        do value = this.randInt(1, 10); while (taken.has(value));
        this.orderRolls[playerId] = value;
        this.publish({ type: 'orderRoll', playerId, value });
        if (Object.keys(this.orderRolls).length === this.players.length) {
            this.order = [...this.players].sort((a, b) => this.orderRolls[b.id] - this.orderRolls[a.id]).map((p) => p.id);
            const token = this.setStep('order', 'reveal', this.ms(TIMING.orderReveal));
            this.publish({ type: 'order', order: this.order });
            this.later(token, this.ms(TIMING.orderReveal), () => this.revealStar());
        }
        return { ok: true };
    }

    // Comme dans Mario Party : avant le premier tour, la caméra montre où est le Micro d'or
    revealStar() {
        const token = this.setStep('order', 'starIntro', this.ms(TIMING.starIntro));
        this.publish({ type: 'starIntro', spaceId: this.starSpace });
        this.later(token, this.ms(TIMING.starIntro), () => this.beginTurn(1));
    }

    // -----------------------------------------------------------------------
    // Tours de plateau
    // -----------------------------------------------------------------------

    beginTurn(turn) {
        this.turn = turn;
        this.turnIndex = 0;
        if (turn === this.settings.turns - 2 && this.settings.turns >= 5) {
            // Le Rappel : les trois derniers tours, cases doublées
            const token = this.setStep('turn', 'finale', this.ms(TIMING.finaleIntro));
            this.publish({ type: 'finale', turnsLeft: 3 });
            this.later(token, this.ms(TIMING.finaleIntro), () => this.beginPlayerTurn());
            return;
        }
        this.beginPlayerTurn();
    }

    beginPlayerTurn() {
        const player = this.current();
        if (this.stageOwner === player.id) this.stageOwner = null; // la scène se libère à son tour
        this.roll = null;
        this.choice = null;
        this.starOffer = null;
        const token = this.setStep('turn', 'intro', this.ms(TIMING.turnIntro));
        this.publish({ type: 'turn', playerId: player.id, turn: this.turn });
        this.later(token, this.ms(TIMING.turnIntro), () => {
            const rollToken = this.setStep('turn', 'roll', this.ms(TIMING.roll));
            this.publish();
            this.awaitPlayer(rollToken, player, this.ms(TIMING.roll), () => this.rollDice(player.id));
        });
    }

    rollDice(playerId) {
        if (this.phase !== 'turn' || this.step !== 'roll') return { error: 'not_now' };
        const player = this.current();
        if (!player || player.id !== playerId) return { error: 'not_your_turn' };
        const value = this.randInt(1, 10);
        this.roll = { playerId, value };
        const token = this.setStep('turn', 'rolled');
        this.publish({ type: 'roll', playerId, value });
        this.later(token, this.ms(TIMING.rollReveal), () => {
            this.move = { playerId, left: value, choice: null };
            this.continueMove();
        });
        return { ok: true };
    }

    continueMove() {
        const m = this.move;
        const player = this.player(m.playerId);
        const spaces = this.board.spaces;
        const path = [];
        const effects = [];
        let stop = 'land';

        while (m.left > 0) {
            const here = spaces[player.space];
            if (here.next.length > 1 && m.choice == null) {
                stop = 'choice';
                break;
            }
            const nextId = m.choice != null ? m.choice : here.next[0];
            m.choice = null;
            player.space = nextId;
            m.left -= 1;
            path.push(nextId);
            const next = spaces[nextId];
            if (next.stage && this.stageOwner && this.stageOwner !== player.id) {
                const owner = this.player(this.stageOwner);
                const amount = Math.min(3, player.hype);
                if (owner && amount > 0) {
                    player.hype -= amount;
                    owner.hype += amount;
                    owner.stats.hypeEarned += amount;
                    effects.push({ type: 'tip', step: path.length - 1, from: player.id, to: owner.id, amount });
                }
            }
            if (nextId === this.starSpace) {
                stop = 'star';
                break;
            }
        }
        if (m.left === 0 && stop !== 'star') stop = 'land';

        const token = this.setStep('turn', 'moving');
        if (path.length) this.publish({ type: 'move', playerId: player.id, path, effects, hopMs: this.ms(TIMING.hop) });
        const wait = path.length ? this.ms(TIMING.hop * path.length + TIMING.afterMove) : 0;
        this.later(token, wait, () => {
            if (stop === 'choice') this.openChoice(player);
            else if (stop === 'star') this.openStarOffer(player);
            else this.land(player);
        });
    }

    openChoice(player) {
        const here = this.board.spaces[player.space];
        const options = here.next.map((id) => {
            const gate = this.board.spaces[id].gate || 0;
            return { spaceId: id, gate, affordable: player.hype >= gate };
        });
        this.choice = { playerId: player.id, at: player.space, options };
        const token = this.setStep('turn', 'choice', this.ms(TIMING.choice));
        this.publish({ type: 'choice', playerId: player.id });
        this.awaitPlayer(token, player, this.ms(TIMING.choice), () => {
            const affordable = options.filter((o) => o.affordable);
            let pick = options[0];
            if (player.isBot && affordable.length > 1 && this.random() < 0.55) pick = affordable[affordable.length - 1];
            this.choose(player.id, pick.spaceId);
        });
    }

    choose(playerId, spaceId) {
        if (this.phase !== 'turn' || this.step !== 'choice' || !this.choice || this.choice.playerId !== playerId) return { error: 'not_now' };
        const option = this.choice.options.find((o) => o.spaceId === Number(spaceId));
        if (!option) return { error: 'invalid_choice' };
        if (!option.affordable) return { error: 'not_enough_hype' };
        const player = this.player(playerId);
        if (option.gate) player.hype -= option.gate;
        this.choice = null;
        this.move.choice = option.spaceId;
        this.publish({ type: 'chose', playerId, spaceId: option.spaceId, paid: option.gate || 0 });
        this.continueMove();
        return { ok: true };
    }

    openStarOffer(player) {
        const price = this.board.starPrice;
        const affordable = player.hype >= price;
        this.starOffer = { playerId: player.id, price, affordable };
        const token = this.setStep('turn', 'star', affordable ? this.ms(TIMING.star) : this.ms(TIMING.starShow));
        this.publish({ type: 'starOffer', playerId: player.id, affordable });
        if (!affordable) {
            this.later(token, this.ms(TIMING.starShow), () => this.resolveStar(player.id, false));
            return;
        }
        this.awaitPlayer(token, player, this.ms(TIMING.star), () => this.resolveStar(player.id, true));
    }

    resolveStar(playerId, buy) {
        if (this.phase !== 'turn' || this.step !== 'star' || !this.starOffer || this.starOffer.playerId !== playerId) return { error: 'not_now' };
        const player = this.player(playerId);
        const bought = Boolean(buy) && this.starOffer.affordable;
        const from = this.starSpace;
        if (bought) {
            player.hype -= this.starOffer.price;
            player.stars += 1;
            this.starSpace = this.pickStarSpot(from);
        }
        this.starOffer = null;
        const token = this.setStep('turn', 'starResult');
        this.publish({ type: 'star', playerId, bought, from, to: this.starSpace });
        this.later(token, bought ? this.ms(TIMING.starShow) : this.ms(400), () => {
            if (this.move.left > 0) this.continueMove();
            else this.land(player);
        });
        return { ok: true };
    }

    pickStarSpot(current) {
        const spots = this.board.starSpots.filter((id) => id !== current);
        return spots[this.randInt(0, spots.length - 1)];
    }

    land(player) {
        const space = this.board.spaces[player.space];
        const mult = this.isFinale() ? 2 : 1;
        let delta = 0;
        if (space.type === 'blue' || space.type === 'start') delta = 3 * mult;
        if (space.type === 'red') delta = -Math.min(player.hype, 3 * mult);
        if (space.type === 'drop') this.stageOwner = player.id;
        player.hype += delta;
        if (delta > 0) player.stats.hypeEarned += delta;
        const token = this.setStep('turn', 'landed');
        this.publish({ type: 'land', playerId: player.id, spaceId: space.id, kind: space.type, delta });
        this.later(token, this.ms(TIMING.land), () => this.nextPlayer());
    }

    nextPlayer() {
        this.turnIndex += 1;
        this.move = null;
        if (this.turnIndex < this.order.length) this.beginPlayerTurn();
        else this.startMinigame();
    }

    // -----------------------------------------------------------------------
    // Mini-jeux
    // -----------------------------------------------------------------------

    pickMinigame() {
        if (!this.minigameBag.length) {
            this.minigameBag = [...MINIGAME_IDS].sort(() => this.random() - 0.5);
        }
        return this.minigameBag.shift();
    }

    startMinigame() {
        const id = this.pickMinigame();
        const seed = this.randInt(1, 2 ** 31 - 1);
        const params = MINIGAMES[id].setup(seed, this.players.map((p) => p.id));
        this.minigame = { id, seed, params, raw: {}, results: null, startsAt: null, endsAt: null };
        this.players.forEach((p) => { p.ready = p.isBot; });
        const token = this.setStep('minigame', 'intro', this.ms(TIMING.mgIntro));
        this.publish({ type: 'minigame', id });
        this.later(token, this.ms(TIMING.mgIntro), () => this.playMinigame());
    }

    setReady(playerId) {
        if (this.phase !== 'minigame' || this.step !== 'intro') return { error: 'not_now' };
        const player = this.player(playerId);
        if (!player) return { error: 'not_in_room' };
        player.ready = true;
        this.publish();
        if (this.players.every((p) => p.ready || !p.connected)) this.playMinigame();
        return { ok: true };
    }

    playMinigame() {
        if (this.phase !== 'minigame' || this.step !== 'intro') return;
        const mg = this.minigame;
        const def = MINIGAMES[mg.id];
        mg.startsAt = this.now() + this.ms(TIMING.mgCountdown);
        // La durée du jeu n'est jamais accélérée : le client affiche les mêmes repères (signal, tempo)
        mg.endsAt = mg.startsAt + mg.params.duration;
        const token = this.setStep('minigame', 'play', mg.endsAt - this.now() + this.ms(TIMING.mgGrace));
        this.publish({ type: 'minigameStart', id: mg.id });
        // Les bots jouent ; les joueurs absents ne rendent rien
        this.players.filter((p) => p.isBot).forEach((bot) => {
            const at = this.ms(TIMING.mgCountdown) + Math.round(this.random() * mg.params.duration * 0.9);
            this.later(token, at, () => this.submitMinigame(bot.id, def.bot(mg.params, this.random, bot.id)));
        });
        this.later(token, mg.endsAt - this.now() + this.ms(TIMING.mgGrace), () => this.finishMinigame());
    }

    submitMinigame(playerId, raw) {
        if (this.phase !== 'minigame' || this.step !== 'play') return { error: 'not_now' };
        const mg = this.minigame;
        if (!this.player(playerId) || mg.raw[playerId] !== undefined) return { error: 'already_sent' };
        mg.raw[playerId] = raw && typeof raw === 'object' ? raw : null;
        this.publish();
        if (this.players.every((p) => mg.raw[p.id] !== undefined || (!p.isBot && !p.connected))) {
            const token = this.token;
            this.later(token, this.ms(600), () => this.finishMinigame());
        }
        return { ok: true };
    }

    finishMinigame() {
        if (this.phase !== 'minigame' || this.step !== 'play') return;
        const mg = this.minigame;
        const def = MINIGAMES[mg.id];
        const scored = this.players.map((p) => ({
            player: p,
            score: def.score(mg.params, mg.raw[p.id], p.id),
            display: def.display(mg.params, mg.raw[p.id], p.id),
        })).sort((a, b) => b.score - a.score);
        // Classement avec ex aequo : même score, même rang, même gain
        let rank = 0;
        mg.results = scored.map((entry, index) => {
            if (index === 0 || entry.score !== scored[index - 1].score) rank = index;
            const played = entry.score > -1e8;
            const reward = played ? MINIGAME_REWARDS[rank] : 0;
            entry.player.hype += reward;
            entry.player.stats.hypeEarned += reward;
            if (rank === 0 && played) entry.player.stats.minigameWins += 1;
            return { playerId: entry.player.id, rank: rank + 1, reward, display: entry.display };
        });
        const token = this.setStep('minigame', 'results', this.ms(TIMING.mgResults));
        this.publish({ type: 'minigameResults', id: mg.id });
        this.later(token, this.ms(TIMING.mgResults), () => {
            this.minigame = null;
            if (this.turn >= this.settings.turns) this.endGame();
            else this.beginTurn(this.turn + 1);
        });
    }

    // -----------------------------------------------------------------------
    // Fin de partie
    // -----------------------------------------------------------------------

    endGame() {
        const ranked = [...this.players].sort((a, b) => (b.stars - a.stars) || (b.hype - a.hype) || (b.stats.minigameWins - a.stats.minigameWins));
        let rank = 0;
        this.finalRanking = ranked.map((p, index) => {
            const prev = ranked[index - 1];
            if (index === 0 || p.stars !== prev.stars || p.hype !== prev.hype) rank = index;
            return { playerId: p.id, rank: rank + 1, stars: p.stars, hype: p.hype, minigameWins: p.stats.minigameWins, hypeEarned: p.stats.hypeEarned };
        });
        this.setStep('end', 'podium');
        this.publish({ type: 'end' });
    }

    rematch(requesterId) {
        if (requesterId !== this.hostId) return { error: 'not_host' };
        if (this.phase !== 'end') return { error: 'not_now' };
        this.clearTimers();
        this.resetGameState();
        this.players.forEach((p) => {
            p.space = null;
            p.hype = START_HYPE;
            p.stars = 0;
            p.ready = false;
        });
        this.setStep('lobby', null);
        this.publish({ type: 'rematch' });
        return { ok: true };
    }
}

module.exports = { PartyGame, CHARACTER_IDS, MAX_PLAYERS, TURN_OPTIONS, TIMING };
