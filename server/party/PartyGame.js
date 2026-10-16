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
const { MINIGAMES, minigamesFor } = require('./minigames');

const CHARACTER_IDS = ['nova', 'grizz', 'kick', 'lila', 'robox', 'mamie', 'flex', 'mimi'];
const BOT_NAMES = ['Bot Tempo', 'Bot Snare', 'Bot Kick', 'Bot Loop', 'Bot Hi-Hat', 'Bot Bass'];
const MAX_PLAYERS = 4;
const TURN_OPTIONS = [5, 10, 15, 20];
// Vitesse des bots (réglage de l'hôte, modifiable en partie) : en « rapide », le tour d'un
// bot se joue avec des attentes et des animations raccourcies
const BOT_SPEEDS = ['normal', 'fast'];
const BOT_FAST_PACE = 0.55;
// Mini-jeu entre bots seulement (duel de deux bots) : joué en accéléré, sans présentation
const BOTS_ONLY_MG_SCALE = 0.03;
// Réactions des bots : ce qui les fait réagir, et avec quels sons
const BOT_REACTIONS = {
    red: ['ooh', 'scratch'],
    trap: ['ooh', 'scratch'],
    drop: ['snare', 'kick'],
    star: ['kick', 'snare', 'ooh'],
    steal: ['ooh', 'scratch'],
    wheel: ['ooh', 'snare'],
    duel: ['ooh', 'kick'],
};
const BOT_REACT_CHANCE = 0.45;
// Niveaux des bots (réglés par l'hôte dans le salon, bot par bot)
//   beginner : routes et objets au hasard, garde rarement de quoi acheter le Micro d'or
//   normal   : le comportement de base
//   pro      : vise le Micro d'or (route, vinyle, objets), économise, joue mieux les mini-jeux
const BOT_LEVELS = ['beginner', 'normal', 'pro'];
// Mini-jeux : multiplicateur d'adresse (mini-jeux d'équipe) ; chacun pour soi, probabilité
// de jouer deux essais et de garder le meilleur (pro) ou le moins bon (débutant)
const BOT_SKILL = { beginner: 0.85, normal: 1, pro: 1.15 };
const BOT_SECOND_TRY = { beginner: 0.5, normal: 0, pro: 0.5 };
// Barème des mini-jeux : seul le podium rapporte vraiment, pour que chacun joue la gagne
//   ffa   10 au 1er, 3 au 2e
//   solo  le solo d'un un-contre-trois qui gagne
//   crowd chaque joueur de la foule qui gagne
//   pair  chaque joueur de l'équipe gagnante d'un deux-contre-deux
const REWARDS = { ffa: [10, 3, 0, 0], solo: 15, crowd: 5, pair: 8 };
// Mini-jeux récents écartés du tirage, par type (comme Mario Party 4 : 8 pour les jeux à 4)
const RECENT_EXCLUDED = { ffa: 8, '1v3': 3, '2v2': 3, duel: 3 };
const DUEL_STAKE = 10;
// Case bleue : +4 (au lieu de 3) pour que le plateau pèse autant que les mini-jeux
const BLUE_GAIN = 4;
const START_HYPE = 10;
// Les dés : le pad REC/PLAY (1 à 10) est le dé de base ; les deux autres sont des objets (ITEMS).
//   block  bloc-boucle « double boucle » : deux boucles superposées, de 2 à 20
//   vinyl  vinyle « scratch » : il tourne lentement de 1 à 6, le joueur l'arrête quand il veut
const DICE = {
    pad: {},
    block: {},
    vinyl: { period: 420, faces: 6 },
};

// Micros bonus de fin de partie (comme les étoiles bonus de Mario Party) : on en tire
// quelques-uns au hasard, révélés un à un avant le podium. Égalité : tous les ex aequo l'ont.
//   minigames  roi des mini-jeux (le plus de mini-jeux gagnés)
//   flow       plus gros flow (le plus de Hype détenue à un moment de la partie)
//   drop       roi du Drop (le plus de Hype touchée en pourboires)
//   larsen     lot de consolation (le plus de Larsen)
//   distance   marathonien (le plus de cases parcourues)
const BONUS_IDS = ['minigames', 'flow', 'drop', 'larsen', 'distance'];
const BONUS_COUNT = 2;

// La roue du Rappel, tournée par le dernier à 3 tours de la fin : deux cases sur quatre
// doublent les cases bleues et rouges, les deux autres sont tirées dans FINALE_POOL.
//   double      cases bleues et rouges doublées
//   halfStar    Micro d'or à moitié prix
//   extraBonus  un Micro bonus de plus à la fin
//   redCut      les cases rouges deviennent des Coupures
//   freestyle   5 cases bleues deviennent des Freestyle !
const FINALE_POOL = ['halfStar', 'extraBonus', 'redCut', 'freestyle'];
const WHEEL_PERIOD = 110;

// Pourboire payé en passant sur la piste enregistrée par un autre joueur
const TRACK_TIP = 2;

// Sample ? : évènements de la scène (poids du tirage)
//   crowd     le public reprend en chœur : +8 Hype
//   encore    la boucle repart : on avance encore de 1 à 6 cases
//   screen    l'écran géant déplace le Micro d'or
//   swap      échange de place avec un autre joueur
//   feedback  Larsen dans la salle : tous les autres perdent 3 Hype
//   tipjar    pot commun : chaque autre joueur donne 2 Hype
const SAMPLES = { crowd: 3, encore: 2, screen: 2, swap: 2, feedback: 2, tipjar: 2 };

// Freestyle ! : trois rouleaux arrêtés par le joueur (qui donne, quoi, à qui)
const FREESTYLE_GIFTS = ['h5', 'h10', 'h20', 'mic', 'swapHype', 'swapMics'];
const REEL_PERIOD = 150;

// Objets (« samples »), achetés au stand de merch, 3 au plus dans le sac, un par tour au moment du dé
//   block  bloc-boucle : double dé, 2 à 20
//   vinyl  vinyle : il tourne de 1 à 6, le joueur l'arrête
//   trap   Larsen piégé : posé sur sa case, le prochain qui s'y arrête te donne 10 Hype
//   pipe   échange de piste : échange de place avec un autre joueur au hasard
//   mic    micro sans fil : file droit au Micro d'or
const ITEMS = {
    block: { price: 8 },
    vinyl: { price: 5 },
    trap: { price: 8 },
    pipe: { price: 10 },
    mic: { price: 25 },
};
const BAG_SIZE = 3;
const TRAP_AMOUNT = 10;

// Battle : chacun met la même mise (ou ce qu'il a), 70 % du pot au 1er, 30 % au 2e
const BATTLE_STAKES = [5, 10, 15, 20];

// Durées en millisecondes (multipliées par timeScale)
const TIMING = {
    orderRoll: 12000,
    orderReveal: 3500,
    starIntro: 3200,
    turnIntro: 2400,
    roll: 30000,
    scratch: 8000,
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
    mgResultsBots: 3600,
    finaleIntro: 3000,
    wheel: 12000,
    wheelBotMin: 1400,
    wheelBotMax: 3200,
    wheelResult: 3400,
    bonusIntro: 3400,
    bonusShow: 4600,
    sampleSpin: 2200,
    sampleShow: 2800,
    cutSpin: 2200,
    cutShow: 3000,
    freestyleIntro: 1600,
    reel: 9000,
    freestyleShow: 3400,
    battleIntro: 3400,
    duelIntro: 3000,
    battleShow: 0,
    shop: 15000,
    item: 1800,
    thief: 15000,
    thiefTarget: 15000,
    steal: 3200,
    stealShow: 2800,
    disconnectedAuto: 1500,
    botMin: 700,
    botMax: 1600,
};

const sanitizeName = (value) => String(value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);

class PartyGame {
    constructor(code, { emit = () => {}, react = null, timeScale = 1, minigameScale = 1, random = Math.random, now = Date.now } = {}) {
        this.code = code;
        this.emitState = emit;
        // Réactions beatbox des bots (relayées aux joueurs comme celles des humains)
        this.onReaction = react;
        this.timeScale = timeScale;
        // Durée réelle des mini-jeux (1 en jeu ; le simulateur de parties la réduit)
        this.minigameScale = minigameScale;
        this.random = random;
        this.now = now;
        this.createdAt = now();
        this.phase = 'lobby'; // lobby, order, turn, minigame, end
        this.step = null;
        this.deadline = null;
        this.players = [];
        this.hostId = null;
        this.settings = { turns: 10, board: 'setup', botSpeed: 'fast' };
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
        this.trackOwners = { 1: null, 2: null, 3: null, 4: null, 5: null };
        this.spaceOverrides = {};
        this.sample = null;
        this.cut = null;
        this.freestyle = null;
        this.battle = null;
        this.thief = null;
        this.shop = null;
        this.traps = {};
        this.itemUsed = false;
        this.roll = null;
        this.move = null;
        this.choice = null;
        this.starOffer = null;
        this.minigame = null;
        this.recentMinigames = {};
        this.duel = null;
        this.finalRanking = null;
        this.tiebreak = null;
        this.wheel = null;
        this.finaleEffect = null;
        this.bonuses = null;
    }

    // -----------------------------------------------------------------------
    // Outils
    // -----------------------------------------------------------------------

    // Tour d'un bot avec le réglage « rapide » : attentes et animations raccourcies
    pace() {
        if (this.settings.botSpeed !== 'fast' || this.phase !== 'turn') return 1;
        const cur = this.current();
        return cur && cur.isBot ? BOT_FAST_PACE : 1;
    }

    // Équité en ligne : l'instant d'une action est celui que le joueur a vu à l'écran (horloge du
    // serveur estimée chez lui, envoyée avec l'action). Il est accepté s'il tombe dans la fenêtre
    // permise par sa latence mesurée (maxLag) ; sinon on le ramène au bord de cette fenêtre.
    actionTime(claimed, maxLag = 0, notBefore = -Infinity) {
        const now = this.now();
        const at = Number(claimed);
        if (!Number.isFinite(at) || !maxLag) return now;
        return Math.max(notBefore, Math.min(now, Math.max(at, now - maxLag)));
    }

    // `full` : délai laissé à un humain pendant le tour d'un bot (roue du Rappel, vol), jamais raccourci
    ms(value, full = false) {
        return Math.max(1, Math.round(value * this.timeScale * (full ? 1 : this.pace())));
    }

    randInt(min, max) {
        return min + Math.floor(this.random() * (max - min + 1));
    }

    shuffle(list) {
        const out = [...list];
        for (let i = out.length - 1; i > 0; i -= 1) {
            const j = Math.floor(this.random() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    // Tirage pondéré dans { id: poids }
    weighted(table) {
        const entries = Object.entries(table).filter(([, w]) => w > 0);
        let r = this.random() * entries.reduce((sum, [, w]) => sum + w, 0);
        for (const [id, w] of entries) {
            r -= w;
            if (r < 0) return id;
        }
        return entries[entries.length - 1][0];
    }

    // Type effectif d'une case (le Rappel peut changer les rouges ou des bleues)
    spaceType(space) {
        if (this.spaceOverrides[space.id]) return this.spaceOverrides[space.id];
        if (this.finaleEffect === 'redCut' && space.type === 'red') return 'cut';
        return space.type;
    }

    rankOf(player) {
        return this.standings().findIndex((p) => p.id === player.id) + 1;
    }

    // Gain ou perte de Hype (jamais en dessous de zéro), avec les statistiques de fin de partie
    addHype(player, delta) {
        const before = player.hype;
        player.hype = Math.max(0, player.hype + delta);
        const applied = player.hype - before;
        if (applied > 0) player.stats.hypeEarned += applied;
        player.stats.maxHype = Math.max(player.stats.maxHype, player.hype);
        return applied;
    }

    newStats() {
        return { minigameWins: 0, hypeEarned: 0, maxHype: START_HYPE, tipsEarned: 0, redLandings: 0, spacesMoved: 0 };
    }

    // Classement courant : Micros d'or, puis Hype
    standings() {
        return [...this.players].sort((a, b) => (b.stars - a.stars) || (b.hype - a.hype));
    }

    // Prix du Micro d'or (moitié prix si la roue du Rappel l'a décidé)
    starPrice() {
        const base = this.board.starPrice;
        return this.finaleEffect === 'halfStar' ? Math.ceil(base / 2) : base;
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
        if (event) this.botReact(event);
    }

    // De temps en temps, un bot réagit à ce qui arrive aux autres (kick, caisse claire, « oooh », scratch)
    botReact(event) {
        if (!this.onReaction) return;
        let pool = null;
        if (event.type === 'land') pool = event.trap ? BOT_REACTIONS.trap : BOT_REACTIONS[event.kind];
        else if (event.type === 'star' && event.bought) pool = BOT_REACTIONS.star;
        else if (event.type === 'steal' || event.type === 'wheel' || event.type === 'duel') pool = BOT_REACTIONS[event.type];
        if (!pool || this.random() > BOT_REACT_CHANCE) return;
        const bots = this.players.filter((p) => p.isBot && p.id !== event.playerId);
        if (!bots.length) return;
        const bot = bots[this.randInt(0, bots.length - 1)];
        const id = pool[this.randInt(0, pool.length - 1)];
        this.schedule(() => this.onReaction({ playerId: bot.id, id }), this.ms(350 + this.random() * 900));
    }

    snapshot() {
        return {
            code: this.code,
            phase: this.phase,
            step: this.step,
            deadline: this.deadline,
            serverNow: this.now(),
            hostId: this.hostId,
            settings: { ...this.settings, turnOptions: TURN_OPTIONS, botSpeeds: BOT_SPEEDS },
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
                botLevel: p.isBot ? p.botLevel || 'normal' : null,
                connected: p.connected,
                hype: p.hype,
                stars: p.stars,
                space: p.space,
                ready: p.ready,
                items: p.items,
                lastColor: p.lastColor || null,
                minigameWins: p.stats.minigameWins,
            })),
            starSpace: this.starSpace,
            starPrice: this.starPrice(),
            finaleEffect: this.finaleEffect,
            wheel: this.wheel,
            bonuses: this.bonuses && this.bonuses.map((b) => (b.revealed ? b : { revealed: false })),
            trackOwners: this.trackOwners,
            spaceOverrides: this.spaceOverrides,
            sample: this.sample,
            cut: this.cut,
            freestyle: this.freestyle && {
                ...this.freestyle,
                // Le rouleau en cours ne dévoile pas sa case avant l'arrêt
                reels: this.freestyle.reels.map((r) => ({ slots: r.slots, spinAt: r.spinAt, period: r.period, index: r.index })),
            },
            battle: this.battle,
            duel: this.duel,
            shop: this.shop,
            traps: this.traps,
            itemUsed: this.itemUsed,
            items: ITEMS,
            bagSize: BAG_SIZE,
            thief: this.thief && { ...this.thief, presses: undefined },
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
                context: this.minigame.context,
                pot: this.minigame.pot,
                kind: this.minigame.kind,
                teams: this.minigame.teams,
                solo: this.minigame.solo,
                colors: this.minigame.colors,
                participants: this.minigame.participants,
                live: this.minigame.live,
                outcome: this.minigame.outcome,
                botsOnly: this.minigame.botsOnly,
            },
            finalRanking: this.finalRanking,
            tiebreak: this.tiebreak || null,
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
            botLevel: isBot ? 'normal' : null,
            connected: !isBot,
            socketId,
            discordId,
            hype: START_HYPE,
            stars: 0,
            space: null,
            ready: false,
            items: [],
            stats: this.newStats(),
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

    setBotLevel(requesterId, botId, level) {
        if (requesterId !== this.hostId) return { error: 'not_host' };
        const bot = this.player(botId);
        if (!bot || !bot.isBot || this.phase !== 'lobby' || !BOT_LEVELS.includes(level)) return { error: 'invalid' };
        bot.botLevel = level;
        this.publish({ type: 'settings' });
        return { ok: true };
    }

    levelOf(player) {
        return player && player.isBot ? player.botLevel || 'normal' : 'normal';
    }

    updateSettings(requesterId, settings = {}) {
        if (requesterId !== this.hostId) return { error: 'not_host' };
        // La vitesse des bots se règle aussi en pleine partie (menu pause de l'hôte)
        if (BOT_SPEEDS.includes(settings.botSpeed)) this.settings.botSpeed = settings.botSpeed;
        if (settings.turns != null) {
            if (this.phase !== 'lobby') return { error: 'already_started' };
            if (TURN_OPTIONS.includes(Number(settings.turns))) this.settings.turns = Number(settings.turns);
        }
        this.publish(this.phase === 'lobby' ? { type: 'settings' } : null);
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
            p.items = [];
            p.stats = this.newStats();
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
            this.startFinale();
            return;
        }
        this.beginPlayerTurn();
    }

    // -----------------------------------------------------------------------
    // Le Rappel : à 3 tours de la fin, le dernier fait tourner la roue
    // -----------------------------------------------------------------------

    startFinale() {
        const ranked = this.standings();
        const last = ranked[ranked.length - 1];
        // Ex aequo à la dernière place : tirage au sort
        const tied = ranked.filter((p) => p.stars === last.stars && p.hype === last.hype);
        const spinner = tied[this.randInt(0, tied.length - 1)];
        const [a, b] = this.shuffle(FINALE_POOL);
        const slots = ['double', a, 'double', b || a, 'double', a, 'double', b || a];
        this.wheel = { playerId: spinner.id, slots, spinAt: null, period: WHEEL_PERIOD, index: null, result: null };
        const token = this.setStep('turn', 'finale', this.ms(TIMING.finaleIntro));
        this.publish({ type: 'finale', turnsLeft: 3, playerId: spinner.id });
        this.later(token, this.ms(TIMING.finaleIntro), () => this.spinWheel());
    }

    spinWheel() {
        const player = this.player(this.wheel.playerId);
        this.wheel.spinAt = this.now();
        const token = this.setStep('turn', 'wheel', this.ms(TIMING.wheel, !player.isBot));
        this.publish({ type: 'wheelSpin', playerId: player.id });
        if (player.isBot) {
            this.later(token, this.ms(this.randInt(TIMING.wheelBotMin, TIMING.wheelBotMax)), () => this.stopWheel(player.id));
            return;
        }
        this.awaitPlayer(token, player, this.ms(TIMING.wheel, true), () => this.stopWheel(player.id));
    }

    stopWheel(playerId, at = null, maxLag = 0) {
        if (this.phase !== 'turn' || this.step !== 'wheel' || !this.wheel) return { error: 'not_now' };
        if (this.wheel.playerId !== playerId) return { error: 'not_your_turn' };
        const { spinAt, period, slots } = this.wheel;
        const spinner = this.player(playerId);
        // Un bot n'a pas de réflexes à mesurer : la case est tirée au sort
        const index = spinner && spinner.isBot
            ? this.randInt(0, slots.length - 1)
            : Math.floor((this.actionTime(at, maxLag, spinAt) - spinAt) / period) % slots.length;
        this.wheel.index = index;
        this.wheel.result = slots[index];
        this.finaleEffect = slots[index];
        if (this.finaleEffect === 'freestyle') {
            // Cinq petites cases bleues deviennent des Freestyle ! jusqu'à la fin
            const blues = this.board.spaces.filter((sp) => sp.type === 'blue' && !sp.big && !sp.corridor && sp.id !== this.starSpace);
            this.shuffle(blues).slice(0, 5).forEach((sp) => { this.spaceOverrides[sp.id] = 'freestyle'; });
        }
        const token = this.setStep('turn', 'wheelResult', this.ms(TIMING.wheelResult));
        this.publish({ type: 'wheel', playerId, result: this.finaleEffect, index });
        this.later(token, this.ms(TIMING.wheelResult), () => this.beginPlayerTurn());
        return { ok: true };
    }

    beginPlayerTurn() {
        const player = this.current();
        this.roll = null;
        this.choice = null;
        this.starOffer = null;
        this.itemUsed = false;
        const token = this.setStep('turn', 'intro', this.ms(TIMING.turnIntro));
        this.publish({ type: 'turn', playerId: player.id, turn: this.turn });
        this.later(token, this.ms(TIMING.turnIntro), () => {
            const rollToken = this.setStep('turn', 'roll', this.ms(TIMING.roll));
            this.publish();
            this.awaitPlayer(rollToken, player, this.ms(TIMING.roll), () => this.botRoll(player));
        });
    }

    // Au moment du dé, un bot utilise parfois un objet de son sac, puis lance
    botRoll(player) {
        if (this.phase !== 'turn' || this.step !== 'roll') return;
        const item = player.isBot ? this.botItem(player) : null;
        if (item) {
            this.useItem(player.id, item);
            // Le dé suit, sauf si l'objet a déjà déplacé le joueur (dé spécial, micro sans fil)
            if (this.step === 'roll') this.later(this.token, this.ms(this.randInt(TIMING.botMin, TIMING.botMax)), () => this.rollDice(player.id));
            return;
        }
        this.rollDice(player.id);
    }

    // Distance (en cases) d'une case au Micro d'or
    distanceToStar(from, hype = Infinity) {
        if (from == null || this.starSpace == null) return null;
        if (from === this.starSpace) return 0;
        const seen = new Map([[from, 0]]);
        const queue = [from];
        while (queue.length) {
            const id = queue.shift();
            for (const n of this.board.spaces[id].next) {
                if (seen.has(n) || (this.board.spaces[n].gate || 0) > hype) continue;
                seen.set(n, seen.get(id) + 1);
                if (n === this.starSpace) return seen.get(n);
                queue.push(n);
            }
        }
        return null;
    }

    botItem(player) {
        const bag = player.items || [];
        if (!bag.length) return null;
        const level = this.levelOf(player);
        // Débutant : un objet au hasard, de temps en temps
        if (level === 'beginner') {
            const usable = bag.filter((it) => it !== 'mic' || player.hype >= this.starPrice());
            return usable.length && this.random() < 0.3 ? usable[this.randInt(0, usable.length - 1)] : null;
        }
        const dist = this.distanceToStar(player.space, player.hype);
        const canBuy = player.hype >= this.starPrice();
        if (bag.includes('mic') && canBuy && dist > 6) return 'mic';
        if (bag.includes('pipe')) {
            const closer = this.players.find((p) => p.id !== player.id && this.distanceToStar(p.space) < dist - 4);
            if (closer && (level === 'pro' || this.random() < 0.7)) return 'pipe';
        }
        if (bag.includes('block') && canBuy && dist > 10 && dist <= 20) return 'block';
        if (bag.includes('vinyl') && canBuy && dist <= 6) return 'vinyl';
        if (bag.includes('trap') && this.random() < 0.4) return 'trap';
        return null;
    }

    rollDice(playerId) {
        if (this.phase !== 'turn' || this.step !== 'roll') return { error: 'not_now' };
        const player = this.current();
        if (!player || player.id !== playerId) return { error: 'not_your_turn' };
        // Les dés spéciaux ne s'obtiennent plus qu'en objets (useItem)
        return this.throwDie(player, 'pad');
    }

    throwDie(player, kind) {
        if (kind === 'vinyl') {
            // Le vinyle tourne : le joueur le scratche pour l'arrêter
            this.roll = { playerId: player.id, die: kind, spinAt: this.now(), period: DICE.vinyl.period, faces: DICE.vinyl.faces, paid: 0 };
            const token = this.setStep('turn', 'scratch', this.ms(TIMING.scratch));
            this.publish({ type: 'spin', playerId: player.id, die: kind, paid: 0 });
            this.awaitPlayer(token, player, this.ms(TIMING.scratch), () => this.scratch(player.id));
            return { ok: true };
        }
        const value = kind === 'block' ? this.randInt(1, 10) + this.randInt(1, 10) : this.randInt(1, 10);
        this.reveal(player, kind, value, 0);
        return { ok: true };
    }

    // Un objet du sac, au moment du dé (un seul par tour)
    useItem(playerId, item) {
        if (this.phase !== 'turn' || this.step !== 'roll') return { error: 'not_now' };
        const player = this.current();
        if (!player || player.id !== playerId) return { error: 'not_your_turn' };
        if (this.itemUsed) return { error: 'item_used' };
        const index = (player.items || []).indexOf(item);
        if (index < 0) return { error: 'no_item' };
        if (item === 'mic' && player.hype < this.starPrice()) return { error: 'not_enough_hype' };
        player.items.splice(index, 1);
        this.itemUsed = true;
        if (item === 'block' || item === 'vinyl') {
            this.publish({ type: 'useItem', playerId, item });
            return this.throwDie(player, item);
        }
        if (item === 'trap') {
            this.traps[player.space] = player.id;
            this.publish({ type: 'useItem', playerId, item, spaceId: player.space });
            return this.resumeRoll(player);
        }
        if (item === 'pipe') {
            const others = this.players.filter((p) => p.id !== player.id);
            const other = others[this.randInt(0, others.length - 1)];
            const from = player.space;
            [player.space, other.space] = [other.space, player.space];
            this.publish({ type: 'useItem', playerId, item, with: other.id, from, to: player.space });
            return this.resumeRoll(player);
        }
        if (item === 'mic') {
            // Micro sans fil : le joueur file au Micro d'or, puis son tour s'arrête là
            const from = player.space;
            player.space = this.starSpace;
            this.move = { playerId, left: 0, choice: null };
            const token = this.setStep('turn', 'itemWarp');
            this.publish({ type: 'useItem', playerId, item, from, to: player.space });
            this.later(token, this.ms(TIMING.item), () => this.openStarOffer(player));
            return { ok: true };
        }
        return { ok: true };
    }

    // Après un objet qui ne lance pas de dé : le joueur lance son dé normalement
    resumeRoll(player) {
        const token = this.setStep('turn', 'roll', this.ms(TIMING.roll));
        this.publish();
        this.awaitPlayer(token, player, this.ms(TIMING.roll), () => this.rollDice(player.id));
        return { ok: true };
    }

    // -----------------------------------------------------------------------
    // Le stand de merch : on s'y arrête en passant, un achat par visite
    // -----------------------------------------------------------------------

    canShop(player) {
        if (!this.board.shop || this.turn >= this.settings.turns) return false; // fermé au dernier tour
        if ((player.items || []).length >= BAG_SIZE) return false;
        return Object.values(ITEMS).some((it) => player.hype >= it.price);
    }

    openShop(player) {
        const items = Object.entries(ITEMS).map(([id, it]) => ({ id, price: it.price, ok: player.hype >= it.price }));
        this.shop = { playerId: player.id, items };
        const token = this.setStep('turn', 'shop', this.ms(TIMING.shop));
        this.publish({ type: 'shopOpen', playerId: player.id });
        this.awaitPlayer(token, player, this.ms(TIMING.shop), () => this.buyItem(player.id, player.isBot ? this.botShop(player) : null));
    }

    botShop(player) {
        const level = this.levelOf(player);
        const wish = Object.keys(ITEMS).filter((id) => !player.items.includes(id));
        // Débutant : achète au hasard ce qu'il peut payer, sans penser au Micro d'or
        if (level === 'beginner') {
            const any = wish.filter((id) => ITEMS[id].price <= player.hype);
            return any.length && this.random() < 0.6 ? any[this.randInt(0, any.length - 1)] : null;
        }
        // Normal : garde de quoi acheter le Micro d'or avec le micro sans fil ; sinon un objet au hasard
        // Pro : garde toujours de quoi acheter le Micro d'or, et préfère les objets qui y mènent
        const reserve = level === 'pro' ? this.starPrice() : 6;
        const affordable = wish.filter((id) => ITEMS[id].price <= player.hype - (id === 'mic' ? this.starPrice() : reserve));
        if (!affordable.length || (level === 'normal' && this.random() < 0.25)) return null;
        if (affordable.includes('mic')) return 'mic';
        if (level === 'pro') {
            const useful = ['pipe', 'vinyl', 'block'].filter((id) => affordable.includes(id));
            return useful.length ? useful[0] : null;
        }
        return affordable[this.randInt(0, affordable.length - 1)];
    }

    buyItem(playerId, item) {
        const shop = this.shop;
        if (this.phase !== 'turn' || this.step !== 'shop' || !shop || shop.playerId !== playerId) return { error: 'not_now' };
        const player = this.player(playerId);
        let bought = null;
        if (item && ITEMS[item]) {
            if (player.hype < ITEMS[item].price) return { error: 'not_enough_hype' };
            if (player.items.length >= BAG_SIZE) return { error: 'bag_full' };
            this.addHype(player, -ITEMS[item].price);
            player.items.push(item);
            bought = item;
        }
        this.shop = null;
        const token = this.setStep('turn', 'shopDone');
        this.publish({ type: bought ? 'buy' : 'shopSkip', playerId, item: bought, price: bought ? ITEMS[bought].price : 0 });
        this.later(token, this.ms(bought ? 900 : 300), () => {
            if (this.move && this.move.left > 0) this.continueMove();
            else this.land(player);
        });
        return { ok: true };
    }

    scratch(playerId, at = null, maxLag = 0) {
        if (this.phase !== 'turn' || this.step !== 'scratch') return { error: 'not_now' };
        const player = this.current();
        if (!player || player.id !== playerId || !this.roll) return { error: 'not_your_turn' };
        const { spinAt, period, faces } = this.roll;
        let value;
        if (player.isBot) {
            // Le pro arrête le vinyle sur la distance du Micro d'or quand il est à portée
            const dist = this.distanceToStar(player.space, player.hype);
            const aim = this.levelOf(player) === 'pro' && dist && dist <= faces && player.hype >= this.starPrice();
            value = aim ? dist : this.randInt(1, faces);
        } else value = 1 + (Math.floor((this.actionTime(at, maxLag, spinAt) - spinAt) / period) % faces);
        this.reveal(player, 'vinyl', value, 0);
        return { ok: true };
    }

    reveal(player, die, value, paid) {
        this.roll = { playerId: player.id, die, value };
        const token = this.setStep('turn', 'rolled');
        this.publish({ type: 'roll', playerId: player.id, value, die, paid });
        this.later(token, this.ms(TIMING.rollReveal), () => {
            this.move = { playerId: player.id, left: value, choice: null };
            this.continueMove();
        });
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
            player.stats.spacesMoved += 1;
            path.push(nextId);
            const next = spaces[nextId];
            const ownerId = next.track ? this.trackOwners[next.track] : null;
            if (ownerId && ownerId !== player.id) {
                const owner = this.player(ownerId);
                const amount = Math.min(TRACK_TIP, player.hype);
                if (owner && amount > 0) {
                    this.addHype(player, -amount);
                    this.addHype(owner, amount);
                    owner.stats.tipsEarned += amount;
                    effects.push({ type: 'tip', step: path.length - 1, from: player.id, to: owner.id, amount });
                }
            }
            if (nextId === this.starSpace) {
                stop = 'star';
                break;
            }
            if (next.place === 'thief' && this.canUseThief(player)) {
                stop = 'thief';
                break;
            }
            if (next.place === 'shop' && this.canShop(player)) {
                stop = 'shop';
                break;
            }
        }
        if (m.left === 0 && !['star', 'thief', 'shop'].includes(stop)) stop = 'land';

        const token = this.setStep('turn', 'moving');
        if (path.length) this.publish({ type: 'move', playerId: player.id, path, effects, hopMs: this.ms(TIMING.hop) });
        const wait = path.length ? this.ms(TIMING.hop * path.length + TIMING.afterMove) : 0;
        this.later(token, wait, () => {
            if (stop === 'choice') this.openChoice(player);
            else if (stop === 'star') this.openStarOffer(player);
            else if (stop === 'thief') this.openThief(player);
            else if (stop === 'shop') this.openShop(player);
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
            const pick = player.isBot ? this.botRoute(player, options) : options[0];
            this.choose(player.id, pick.spaceId);
        });
    }

    // Carrefour : le pro prend la route du Micro d'or (sans payer le raccourci s'il lui faut
    // cette Hype pour l'acheter), le normal le fait souvent, le débutant choisit au hasard
    botRoute(player, options) {
        const affordable = options.filter((o) => o.affordable);
        if (affordable.length < 2) return affordable[0] || options[0];
        const level = this.levelOf(player);
        if (level === 'beginner') return affordable[this.randInt(0, affordable.length - 1)];
        if (level === 'normal' && this.random() < 0.45) return this.random() < 0.55 ? affordable[affordable.length - 1] : affordable[0];
        const scored = affordable.map((o) => {
            const d = this.distanceToStar(o.spaceId, player.hype - o.gate);
            let cost = (d == null ? 99 : d + 1);
            // Payer le raccourci et ne plus pouvoir acheter le Micro d'or : à éviter
            if (o.gate && player.hype - o.gate < this.starPrice()) cost += 6;
            return { o, cost };
        }).sort((a, b) => a.cost - b.cost);
        return scored[0].o;
    }

    choose(playerId, spaceId) {
        if (this.phase !== 'turn' || this.step !== 'choice' || !this.choice || this.choice.playerId !== playerId) return { error: 'not_now' };
        const option = this.choice.options.find((o) => o.spaceId === Number(spaceId));
        if (!option) return { error: 'invalid_choice' };
        if (!option.affordable) return { error: 'not_enough_hype' };
        const player = this.player(playerId);
        if (option.gate) this.addHype(player, -option.gate);
        this.choice = null;
        this.move.choice = option.spaceId;
        this.publish({ type: 'chose', playerId, spaceId: option.spaceId, paid: option.gate || 0 });
        this.continueMove();
        return { ok: true };
    }

    openStarOffer(player) {
        const price = this.starPrice();
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
            this.addHype(player, -this.starOffer.price);
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

    // Fin du déplacement : la case du joueur agit
    land(player) {
        const space = this.board.spaces[player.space];
        const type = this.spaceType(space);
        const mult = this.isFinale() && this.finaleEffect === 'double' ? 2 : 1;
        let delta = 0;
        // Gros pad de piste : le joueur y enregistre sa boucle (les autres lui laissent un pourboire en passant)
        const recorded = space.track ? space.track : null;
        if (recorded) this.trackOwners[recorded] = player.id;
        // Couleur retenue pour le mini-jeu (vert : tirée au sort au moment du mini-jeu)
        player.lastColor = type === 'blue' || type === 'start' ? 'blue' : type === 'red' ? 'red' : 'green';
        if (type === 'blue' || type === 'start') delta = BLUE_GAIN * mult;
        if (type === 'red') {
            delta = -3 * mult;
            player.stats.redLandings += 1;
        }
        // Drop : le joueur prend la main sur les cinq pistes
        if (type === 'drop') Object.keys(this.trackOwners).forEach((k) => { this.trackOwners[k] = player.id; });
        delta = this.addHype(player, delta);
        // Larsen piégé par un autre joueur : il touche jusqu'à 10 Hype
        let trap = null;
        const trapOwner = this.traps[space.id] && this.player(this.traps[space.id]);
        if (trapOwner && trapOwner.id !== player.id) {
            const amount = -this.addHype(player, -TRAP_AMOUNT);
            this.addHype(trapOwner, amount);
            delete this.traps[space.id];
            trap = { owner: trapOwner.id, amount };
        }
        const token = this.setStep('turn', 'landed');
        this.publish({ type: 'land', playerId: player.id, spaceId: space.id, kind: type, delta, recorded, trap });
        if (type === 'sample') return this.later(token, this.ms(900), () => this.spinSample(player));
        if (type === 'cut') return this.later(token, this.ms(900), () => this.spinCut(player));
        if (type === 'freestyle') return this.later(token, this.ms(900), () => this.startFreestyle(player));
        if (type === 'battle') return this.later(token, this.ms(900), () => this.startBattle(player));
        const rival = this.duelTarget(player);
        if (rival) return this.later(token, this.ms(1200), () => this.startDuel(player, rival));
        return this.later(token, this.ms(TIMING.land), () => this.nextPlayer());
    }

    // -----------------------------------------------------------------------
    // Sample ? : un évènement de la scène
    // -----------------------------------------------------------------------

    spinSample(player) {
        this.sample = { playerId: player.id, result: null };
        const token = this.setStep('turn', 'sample', this.ms(TIMING.sampleSpin));
        this.publish({ type: 'sampleSpin', playerId: player.id });
        this.later(token, this.ms(TIMING.sampleSpin), () => this.resolveSample(player));
    }

    resolveSample(player) {
        const others = this.players.filter((p) => p.id !== player.id);
        let result = this.weighted(SAMPLES);
        if (result === 'swap' && !others.length) result = 'crowd';
        const detail = { playerId: player.id, result };
        if (result === 'crowd') detail.amount = this.addHype(player, 8);
        if (result === 'feedback') {
            detail.losses = others.map((p) => ({ playerId: p.id, amount: -this.addHype(p, -3) }));
        }
        if (result === 'tipjar') {
            detail.gifts = others.map((p) => {
                const amount = -this.addHype(p, -2);
                this.addHype(player, amount);
                return { playerId: p.id, amount };
            });
        }
        if (result === 'screen') {
            detail.from = this.starSpace;
            this.starSpace = this.pickStarSpot(this.starSpace);
            detail.to = this.starSpace;
        }
        if (result === 'swap') {
            const other = others[this.randInt(0, others.length - 1)];
            detail.with = other.id;
            detail.from = player.space;
            detail.to = other.space;
            [player.space, other.space] = [other.space, player.space];
        }
        if (result === 'encore') detail.value = this.randInt(1, 6);
        this.sample = detail;
        const token = this.setStep('turn', 'sampleResult', this.ms(TIMING.sampleShow));
        this.publish({ type: 'sample', ...detail });
        this.later(token, this.ms(TIMING.sampleShow), () => {
            this.sample = null;
            // La boucle repart : le joueur avance encore
            if (result === 'encore') this.reveal(player, 'pad', detail.value, 0);
            else this.nextPlayer();
        });
    }

    // -----------------------------------------------------------------------
    // Coupure : l'ingé son coupe le son (plus dur pour ceux qui mènent)
    // -----------------------------------------------------------------------

    spinCut(player) {
        this.cut = { playerId: player.id, result: null };
        const token = this.setStep('turn', 'cut', this.ms(TIMING.cutSpin));
        this.publish({ type: 'cutSpin', playerId: player.id });
        this.later(token, this.ms(TIMING.cutSpin), () => this.resolveCut(player));
    }

    resolveCut(player) {
        const leader = this.rankOf(player) <= 2;
        const table = leader
            ? { lose: 4, share: 2, blackout: 1, mic: player.stars > 0 && this.rankOf(player) === 1 ? 1 : 0 }
            : { lose: 3, share: 2, blackout: 2 };
        const result = this.weighted(table);
        const detail = { playerId: player.id, result };
        if (result === 'lose') detail.amount = -this.addHype(player, -(leader ? this.randInt(10, 20) : this.randInt(5, 10)));
        if (result === 'share') {
            detail.gifts = this.players.filter((p) => p.id !== player.id).map((p) => {
                const amount = -this.addHype(player, -3);
                this.addHype(p, amount);
                return { playerId: p.id, amount };
            });
        }
        if (result === 'blackout') detail.losses = this.players.map((p) => ({ playerId: p.id, amount: -this.addHype(p, -5) }));
        if (result === 'mic') {
            player.stars -= 1;
            detail.amount = 1;
        }
        this.cut = detail;
        const token = this.setStep('turn', 'cutResult', this.ms(TIMING.cutShow));
        this.publish({ type: 'cut', ...detail });
        this.later(token, this.ms(TIMING.cutShow), () => {
            this.cut = null;
            this.nextPlayer();
        });
    }

    // -----------------------------------------------------------------------
    // Freestyle ! : trois rouleaux (qui donne, quoi, à qui), arrêtés par le joueur
    // -----------------------------------------------------------------------

    startFreestyle(player) {
        const ids = this.shuffle(this.players.map((p) => p.id));
        const anyMic = this.players.some((p) => p.stars > 0);
        const gifts = FREESTYLE_GIFTS.filter((g) => anyMic || (g !== 'mic' && g !== 'swapMics'));
        this.freestyle = {
            playerId: player.id,
            current: 0,
            reels: [
                { slots: ids, spinAt: this.now(), period: REEL_PERIOD, index: null },
                { slots: this.shuffle(gifts), spinAt: null, period: REEL_PERIOD * 1.2, index: null },
                { slots: null, spinAt: null, period: REEL_PERIOD, index: null },
            ],
            result: null,
        };
        const token = this.setStep('turn', 'freestyle', this.ms(TIMING.reel));
        this.publish({ type: 'freestyle', playerId: player.id });
        this.awaitReel(token, player);
    }

    // Rouleaux du Freestyle : le pro a la main sûre une fois sur deux (un autre donne, lui reçoit)
    botReelIndex(player, fs, reel) {
        const n = reel.slots.length;
        const level = this.levelOf(player);
        const sure = level === 'pro' ? 0.5 : level === 'normal' ? 0.15 : 0;
        if (this.random() >= sure) return this.randInt(0, n - 1);
        if (fs.current === 0) {
            const richest = reel.slots.filter((id) => id !== player.id).sort((a, b) => this.player(b).hype - this.player(a).hype)[0];
            return Math.max(0, reel.slots.indexOf(richest));
        }
        if (fs.current === 2 && reel.slots.includes(player.id)) return reel.slots.indexOf(player.id);
        return this.randInt(0, n - 1);
    }

    awaitReel(token, player) {
        if (player.isBot) {
            this.later(token, this.ms(this.randInt(900, 1700)), () => this.stopReel(player.id));
            return;
        }
        this.awaitPlayer(token, player, this.ms(TIMING.reel), () => this.stopReel(player.id));
    }

    stopReel(playerId, at = null, maxLag = 0) {
        const fs = this.freestyle;
        if (this.phase !== 'turn' || this.step !== 'freestyle' || !fs || fs.playerId !== playerId) return { error: 'not_now' };
        const reel = fs.reels[fs.current];
        const player = this.player(playerId);
        const n = reel.slots.length;
        if (player.isBot) reel.index = this.botReelIndex(player, fs, reel);
        else reel.index = Math.floor((this.actionTime(at, maxLag, reel.spinAt) - reel.spinAt) / reel.period) % n;
        fs.current += 1;
        if (fs.current === 2) {
            // Le dernier rouleau ne propose que les autres joueurs que celui qui donne
            const giver = fs.reels[0].slots[fs.reels[0].index];
            fs.reels[2].slots = this.shuffle(this.players.map((p) => p.id).filter((id) => id !== giver));
        }
        if (fs.current < 3) {
            fs.reels[fs.current].spinAt = this.now();
            const token = this.setStep('turn', 'freestyle', this.ms(TIMING.reel));
            this.publish({ type: 'reel', playerId, reel: fs.current - 1 });
            this.awaitReel(token, player);
            return { ok: true };
        }
        this.resolveFreestyle();
        return { ok: true };
    }

    resolveFreestyle() {
        const fs = this.freestyle;
        const [r0, r1, r2] = fs.reels;
        const giver = this.player(r0.slots[r0.index]);
        const gift = r1.slots[r1.index];
        const taker = this.player(r2.slots[r2.index]);
        let amount = 0;
        if (gift[0] === 'h') {
            amount = -this.addHype(giver, -Number(gift.slice(1)));
            this.addHype(taker, amount);
        } else if (gift === 'mic') {
            amount = giver.stars > 0 ? 1 : 0;
            giver.stars -= amount;
            taker.stars += amount;
        } else if (gift === 'swapHype') {
            const a = giver.hype;
            const b = taker.hype;
            this.addHype(giver, b - a);
            this.addHype(taker, a - b);
            amount = Math.abs(a - b);
        } else if (gift === 'swapMics') {
            [giver.stars, taker.stars] = [taker.stars, giver.stars];
            amount = Math.abs(giver.stars - taker.stars);
        }
        fs.result = { giver: giver.id, gift, taker: taker.id, amount };
        const token = this.setStep('turn', 'freestyleResult', this.ms(TIMING.freestyleShow));
        this.publish({ type: 'freestyleResult', playerId: fs.playerId, ...fs.result });
        this.later(token, this.ms(TIMING.freestyleShow), () => {
            this.freestyle = null;
            this.nextPlayer();
        });
    }

    // -----------------------------------------------------------------------
    // Battle : mise commune, mini-jeu immédiat à quatre
    // -----------------------------------------------------------------------

    startBattle(player) {
        const stake = BATTLE_STAKES[this.randInt(0, BATTLE_STAKES.length - 1)];
        const bets = this.players.map((p) => ({ playerId: p.id, amount: -this.addHype(p, -stake) }));
        const pot = bets.reduce((sum, b) => sum + b.amount, 0);
        this.battle = { playerId: player.id, stake, pot, bets };
        const token = this.setStep('turn', 'battle', this.ms(TIMING.battleIntro));
        this.publish({ type: 'battle', playerId: player.id, stake, pot });
        this.later(token, this.ms(TIMING.battleIntro), () => this.startMinigame({ context: 'battle', pot }));
    }

    // Partage du pot d'une Battle : 70 % aux premiers, 30 % aux deuxièmes (ex aequo : partagé)
    battlePayout(results, pot) {
        const firsts = results.filter((r) => r.rank === 1 && r.played);
        const seconds = results.filter((r) => r.rank === 2 && r.played);
        const out = {};
        if (!firsts.length) return out;
        const firstShare = seconds.length ? Math.round(pot * 0.7) : pot;
        firsts.forEach((r, i) => { out[r.playerId] = Math.floor(firstShare / firsts.length) + (i === 0 ? firstShare % firsts.length : 0); });
        const rest = pot - firstShare;
        seconds.forEach((r, i) => { out[r.playerId] = Math.floor(rest / seconds.length) + (i === 0 ? rest % seconds.length : 0); });
        return out;
    }

    // -----------------------------------------------------------------------
    // Le voleur de flow : une loge au bord de la scène, on s'y arrête en passant
    // -----------------------------------------------------------------------

    canUseThief(player) {
        const cfg = this.board.thief;
        if (!cfg || player.hype < cfg.hypeCost) return false;
        return this.players.some((p) => p.id !== player.id && (p.hype > 0 || p.stars > 0));
    }

    thiefOptions(player) {
        const cfg = this.board.thief;
        const others = this.players.filter((p) => p.id !== player.id);
        return [
            { id: 'hype', cost: cfg.hypeCost, ok: player.hype >= cfg.hypeCost && others.some((p) => p.hype > 0) },
            { id: 'mic', cost: cfg.micCost, ok: player.hype >= cfg.micCost && others.some((p) => p.stars > 0) },
        ];
    }

    openThief(player) {
        this.thief = { playerId: player.id, options: this.thiefOptions(player), kind: null, victimId: null, amount: null, presses: 0, result: null };
        const token = this.setStep('turn', 'thief', this.ms(TIMING.thief));
        this.publish({ type: 'thiefOffer', playerId: player.id });
        this.awaitPlayer(token, player, this.ms(TIMING.thief), () => this.chooseThief(player.id, player.isBot ? this.botThief(player) : 'none'));
    }

    botThief(player) {
        const opts = this.thiefOptions(player);
        const level = this.levelOf(player);
        if (level === 'beginner') return this.random() < 0.3 && opts[0].ok ? 'hype' : 'none';
        if (opts[1].ok && (level === 'pro' || this.random() < 0.8)) return 'mic';
        // Le pro ne vole de la Hype que s'il garde de quoi acheter le Micro d'or
        if (level === 'pro') return opts[0].ok && player.hype - opts[0].cost >= this.starPrice() ? 'hype' : 'none';
        if (opts[0].ok && player.hype >= 12 && this.random() < 0.6) return 'hype';
        return 'none';
    }

    chooseThief(playerId, choice) {
        const th = this.thief;
        if (this.phase !== 'turn' || this.step !== 'thief' || !th || th.playerId !== playerId) return { error: 'not_now' };
        const player = this.player(playerId);
        const option = th.options.find((o) => o.id === choice);
        if (!option) return this.leaveThief(player, false);
        if (!option.ok) return { error: 'not_enough_hype' };
        this.addHype(player, -option.cost);
        th.kind = choice;
        th.paid = option.cost;
        const targets = this.players.filter((p) => p.id !== playerId && (choice === 'mic' ? p.stars > 0 : p.hype > 0)).map((p) => p.id);
        th.targets = targets;
        if (targets.length === 1) return this.chooseVictim(playerId, targets[0]);
        const token = this.setStep('turn', 'thiefTarget', this.ms(TIMING.thiefTarget));
        this.publish({ type: 'thiefPick', playerId, kind: choice, paid: option.cost });
        this.awaitPlayer(token, player, this.ms(TIMING.thiefTarget), () => {
            // Par défaut (et pour les bots) : le plus riche
            const richest = targets.map((id) => this.player(id)).sort((a, b) => (choice === 'mic' ? b.stars - a.stars : b.hype - a.hype))[0];
            this.chooseVictim(playerId, richest.id);
        });
        return { ok: true };
    }

    chooseVictim(playerId, victimId) {
        const th = this.thief;
        if (this.phase !== 'turn' || !th || th.playerId !== playerId || !th.kind) return { error: 'not_now' };
        if (this.step !== 'thiefTarget' && this.step !== 'thief') return { error: 'not_now' };
        if (!th.targets.includes(victimId)) return { error: 'invalid' };
        th.victimId = victimId;
        th.amount = th.kind === 'mic' ? 1 : this.randInt(8, 16) + Math.floor(this.turn / 3) * 2;
        th.presses = 0;
        // La victime martèle sa touche pour protéger sa Hype (pas son Micro d'or)
        const window = th.kind === 'hype' ? TIMING.steal : 1200;
        // Une victime humaine garde tout son temps pour marteler, même si le voleur est un bot rapide
        const full = th.kind === 'hype' && !(this.player(victimId) || {}).isBot;
        th.until = this.now() + this.ms(window, full);
        const token = this.setStep('turn', 'steal', this.ms(window, full));
        this.publish({ type: 'stealStart', playerId, victimId, kind: th.kind, paid: th.paid });
        this.later(token, this.ms(window, full), () => this.resolveSteal());
        return { ok: true };
    }

    mash(playerId) {
        const th = this.thief;
        if (this.phase !== 'turn' || this.step !== 'steal' || !th || th.victimId !== playerId || th.kind !== 'hype') return { error: 'not_now' };
        th.presses = Math.min(60, th.presses + 1);
        return { ok: true };
    }

    resolveSteal() {
        const th = this.thief;
        const thief = this.player(th.playerId);
        const victim = this.player(th.victimId);
        let taken = 0;
        if (th.kind === 'mic') {
            taken = victim.stars > 0 ? 1 : 0;
            victim.stars -= taken;
            thief.stars += taken;
        } else {
            const mashRange = { beginner: [4, 16], normal: [8, 28], pro: [18, 30] }[this.levelOf(victim)];
            const presses = victim.isBot ? this.randInt(mashRange[0], mashRange[1]) : th.presses;
            const saved = Math.min(0.6, presses * 0.02);
            taken = -this.addHype(victim, -Math.round(th.amount * (1 - saved)));
            this.addHype(thief, taken);
            th.presses = presses;
        }
        th.result = taken;
        const token = this.setStep('turn', 'stealResult', this.ms(TIMING.stealShow));
        this.publish({ type: 'steal', playerId: th.playerId, victimId: th.victimId, kind: th.kind, amount: taken, saved: th.kind === 'hype' ? th.amount - taken : 0 });
        this.later(token, this.ms(TIMING.stealShow), () => this.leaveThief(thief, true));
    }

    // On repart de la loge : le déplacement continue, ou le joueur s'arrête sur la case
    leaveThief(player, acted) {
        this.thief = null;
        if (!acted) this.publish({ type: 'thiefSkip', playerId: player.id });
        if (this.move && this.move.left > 0) this.continueMove();
        else this.land(player);
        return { ok: true };
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

    // Type du mini-jeu de fin de manche, d'après la couleur de la dernière case de chacun
    // (comme Mario Party : 4 identiques = chacun pour soi, 3 + 1 = un contre trois, 2 + 2)
    roundTeams() {
        this.players.forEach((p) => {
            if (p.lastColor !== 'blue' && p.lastColor !== 'red') p.lastColor = this.random() < 0.5 ? 'blue' : 'red';
        });
        const blue = this.players.filter((p) => p.lastColor === 'blue').map((p) => p.id);
        const red = this.players.filter((p) => p.lastColor === 'red').map((p) => p.id);
        if (this.players.length < 4 || !blue.length || !red.length) return { kind: 'ffa', teams: null, solo: null };
        if (blue.length === 2) return { kind: '2v2', teams: { a: blue, b: red }, solo: null, colors: { a: 'blue', b: 'red' } };
        const soloSide = blue.length === 1 ? blue : red;
        const crowd = blue.length === 1 ? red : blue;
        return { kind: '1v3', teams: { a: crowd, b: soloSide }, solo: soloSide[0], colors: { a: blue.length === 1 ? 'red' : 'blue', b: blue.length === 1 ? 'blue' : 'red' } };
    }

    // Tirage d'un mini-jeu du bon type, en écartant ceux joués récemment
    pickMinigame(kind) {
        const pool = minigamesFor(kind);
        const recent = this.recentMinigames[kind] || [];
        const keep = Math.min(RECENT_EXCLUDED[kind] || 2, pool.length - 1);
        const exclude = recent.slice(-keep);
        const options = pool.filter((id) => !exclude.includes(id));
        const id = options[this.randInt(0, options.length - 1)];
        this.recentMinigames[kind] = [...recent, id].slice(-8);
        return id;
    }

    // Tests : PARTY_FORCE_MG=crowd,ledrop,… impose les mini-jeux de fin de manche, dans l'ordre
    forcedSetup() {
        const list = String(process.env.PARTY_FORCE_MG || '').split(',').filter((id) => MINIGAMES[id]);
        if (!list.length || process.env.NODE_ENV === 'production') return null;
        const id = list[(this.turn - 1) % list.length];
        const kind = MINIGAMES[id].kinds[0];
        const ids = [...this.players].sort((a, b) => a.seat - b.seat).map((p) => p.id);
        if (kind === '1v3') {
            const solo = ids[(this.turn - 1) % ids.length];
            return { id, setup: { kind, teams: { a: ids.filter((x) => x !== solo), b: [solo] }, solo, colors: { a: 'red', b: 'blue' } } };
        }
        if (kind === '2v2') return { id, setup: { kind, teams: { a: [ids[0], ids[2]], b: [ids[1], ids[3]] }, solo: null, colors: { a: 'blue', b: 'red' } } };
        return { id, setup: { kind, teams: null, solo: null } };
    }

    startMinigame({ context = 'round', pot = 0, players = null } = {}) {
        let setup;
        const forced = context === 'round' ? this.forcedSetup() : null;
        if (forced) setup = forced.setup;
        else if (context === 'battle') setup = { kind: 'ffa', teams: null, solo: null };
        else if (context === 'duel') setup = { kind: 'duel', teams: null, solo: null };
        else setup = this.roundTeams();
        const participants = players || this.players.map((p) => p.id);
        const id = forced ? forced.id : this.pickMinigame(setup.kind === 'duel' ? 'duel' : setup.kind);
        const seed = this.randInt(1, 2 ** 31 - 1);
        const ctx = { kind: setup.kind, teams: setup.teams, solo: setup.solo, participants };
        const params = MINIGAMES[id].setup(seed, participants, ctx);
        // Entre bots seulement (un duel de deux bots) : pas de présentation, jeu en accéléré
        const botsOnly = participants.every((pid) => (this.player(pid) || {}).isBot);
        this.minigame = {
            id, seed, params, raw: {}, results: null, startsAt: null, endsAt: null, context, pot,
            kind: setup.kind, teams: setup.teams, solo: setup.solo, colors: setup.colors || null, participants,
            live: {}, secret: {}, outcome: null,
            botsOnly, scale: botsOnly ? Math.min(this.minigameScale, BOTS_ONLY_MG_SCALE) : this.minigameScale,
        };
        this.players.forEach((p) => { p.ready = p.isBot || !participants.includes(p.id); });
        const token = this.setStep('minigame', 'intro', this.ms(TIMING.mgIntro));
        this.publish({ type: 'minigame', id, kind: setup.kind, context, botsOnly });
        if (botsOnly) this.playMinigame();
        else this.later(token, this.ms(TIMING.mgIntro), () => this.playMinigame());
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

    minigameCtx(mg) {
        const bots = mg.participants.filter((id) => (this.player(id) || {}).isBot);
        const skill = Object.fromEntries(bots.map((id) => [id, BOT_SKILL[this.levelOf(this.player(id))] || 1]));
        return { kind: mg.kind, teams: mg.teams, solo: mg.solo, participants: mg.participants, bots, skill };
    }

    playMinigame() {
        if (this.phase !== 'minigame' || this.step !== 'intro') return;
        const mg = this.minigame;
        const def = MINIGAMES[mg.id];
        const ctx = this.minigameCtx(mg);
        const scale = mg.scale;
        const countdown = mg.botsOnly ? this.ms(150) : this.ms(TIMING.mgCountdown);
        const grace = mg.botsOnly ? this.ms(300) : this.ms(TIMING.mgGrace);
        mg.startsAt = this.now() + countdown;
        // La durée du jeu n'est jamais accélérée : le client affiche les mêmes repères (signal, tempo)
        mg.endsAt = mg.startsAt + Math.round(mg.params.duration * scale);
        const token = this.setStep('minigame', 'play', mg.endsAt - this.now() + grace);
        if (def.init) def.init(mg, ctx);
        this.publish({ type: 'minigameStart', id: mg.id });
        if (def.live) {
            // Étapes à heure fixe (dévoilements), actions des bots en direct
            (def.timeline ? def.timeline(mg.params) : []).forEach((step) => {
                this.later(token, countdown + Math.round(step.at * scale), () => {
                    if (def.onTime(mg, step.id, ctx, this.random)) this.publish();
                });
            });
            (def.botPlan ? def.botPlan(mg, ctx, this.random) : []).forEach((action) => {
                this.later(token, countdown + Math.round(action.at * scale), () => {
                    if (action.ifAlive && mg.live.alive && !mg.live.alive.includes(action.playerId)) return;
                    if (action.bottle) this.minigameInput(action.playerId, { holdMs: def.botPour(mg, ctx, action.playerId, this.random) }, true);
                    else this.minigameInput(action.playerId, action.data, true);
                });
            });
        }
        // Les bots rendent leur résultat ; les joueurs absents ne rendent rien
        ctx.bots.forEach((botId) => {
            const span = mg.params.duration * 0.9;
            const from = def.botRawFrom ? def.botRawFrom(mg.params) : 0;
            const at = countdown + Math.round((from + this.random() * Math.max(200, span - from)) * scale);
            this.later(token, at, () => {
                const raw = this.botMinigameRaw(def, mg, ctx, botId);
                if (raw) this.submitMinigame(botId, raw);
            });
        });
        this.later(token, mg.endsAt - this.now() + grace, () => this.finishMinigame());
    }

    // Résultat d'un bot à un mini-jeu chacun pour soi : une fois sur deux, le pro garde le
    // meilleur de 2 essais et le débutant le moins bon (les mini-jeux d'équipe utilisent ctx.skill)
    botMinigameRaw(def, mg, ctx, botId) {
        const level = this.levelOf(this.player(botId));
        const runs = this.random() < (BOT_SECOND_TRY[level] || 0) ? 2 : 1;
        if (runs === 1 || mg.teams || !def.score) return def.bot(mg.params, this.random, botId, mg, ctx);
        let best = null;
        for (let i = 0; i < runs; i += 1) {
            const raw = def.bot(mg.params, this.random, botId, mg, ctx);
            const score = def.score(mg.params, raw, botId);
            if (!best || (level === 'pro' ? score > best.score : score < best.score)) best = { raw, score };
        }
        return best.raw;
    }

    // Action pendant un mini-jeu en direct (motif, choix secret, frappes…)
    minigameInput(playerId, data, fromBot = false) {
        if (this.phase !== 'minigame' || this.step !== 'play') return { error: 'not_now' };
        const mg = this.minigame;
        const def = MINIGAMES[mg.id];
        if (!def.live || !mg.participants.includes(playerId)) return { error: 'invalid' };
        const elapsed = (this.now() - mg.startsAt) / mg.scale;
        if (elapsed < -50 || elapsed > mg.params.duration + 200) return { error: 'not_now' };
        if (!fromBot && (this.player(playerId) || {}).isBot) return { error: 'invalid' };
        const ok = def.input(mg, playerId, data && typeof data === 'object' ? data : {}, this.minigameCtx(mg), elapsed);
        if (!ok) return { error: 'invalid' };
        // Publication groupée pour les actions très fréquentes (frappes)
        if (def.throttle) {
            if (!this.mgPublishPending) {
                this.mgPublishPending = true;
                this.schedule(() => { this.mgPublishPending = false; if (this.minigame === mg) this.publish(); }, def.throttle);
            }
        } else this.publish();
        return { ok: true };
    }

    submitMinigame(playerId, raw, maxLag = 0) {
        if (this.phase !== 'minigame' || this.step !== 'play') return { error: 'not_now' };
        const mg = this.minigame;
        const player = this.player(playerId);
        if (!player || !mg.participants.includes(playerId)) return { error: 'invalid' };
        if (mg.raw[playerId] !== undefined) return { error: 'already_sent' };
        let value = raw && typeof raw === 'object' ? raw : null;
        // Résultat mesuré chez le joueur, confronté à l'heure d'arrivée et à sa latence
        const def = MINIGAMES[mg.id];
        if (value && def.verify && !player.isBot) value = def.verify(mg.params, value, { elapsed: (this.now() - mg.startsAt) / mg.scale, maxLag: maxLag / mg.scale });
        mg.raw[playerId] = value;
        this.publish();
        // Fin anticipée quand tout le monde a rendu (sauf pour les mini-jeux en direct, qui suivent leur minuterie)
        const everyone = mg.participants.every((id) => {
            const p = this.player(id);
            return mg.raw[id] !== undefined || !p || (!p.isBot && !p.connected);
        });
        if (everyone && !MINIGAMES[mg.id].live) {
            const token = this.token;
            this.later(token, this.ms(600), () => this.finishMinigame());
        }
        return { ok: true };
    }

    finishMinigame() {
        if (this.phase !== 'minigame' || this.step !== 'play') return;
        const mg = this.minigame;
        const def = MINIGAMES[mg.id];
        const ctx = this.minigameCtx(mg);
        const players = mg.participants.map((id) => this.player(id)).filter(Boolean);
        if (mg.teams && def.result) {
            // Équipes : le camp au plus grand score gagne, l'égalité ne rapporte rien
            const res = def.result(mg, ctx);
            const winner = res.a > res.b ? 'a' : res.b > res.a ? 'b' : null;
            mg.outcome = { winner, a: res.a, b: res.b };
            mg.results = players.map((p) => {
                const side = mg.teams.a.includes(p.id) ? 'a' : 'b';
                const won = winner === side;
                let reward = 0;
                if (won) reward = mg.kind === '1v3' ? (side === 'b' ? REWARDS.solo : REWARDS.crowd) : REWARDS.pair;
                this.addHype(p, reward);
                if (won) p.stats.minigameWins += 1;
                return { playerId: p.id, rank: won ? 1 : 2, reward, display: (res.display || {})[p.id] || { kind: 'none' }, side };
            }).sort((a, b) => a.rank - b.rank);
        } else {
            const scored = players.map((p) => ({
                player: p,
                score: def.score(mg.params, mg.raw[p.id], p.id),
                display: def.display(mg.params, mg.raw[p.id], p.id),
            })).sort((a, b) => b.score - a.score);
            // Classement avec ex aequo : même score, même rang, même gain
            let rank = 0;
            const ranked = scored.map((entry, index) => {
                if (index === 0 || entry.score !== scored[index - 1].score) rank = index;
                return { entry, rank: rank + 1, played: entry.score > -1e8 };
            });
            const battle = mg.context === 'battle' ? this.battlePayout(ranked.map((r) => ({ playerId: r.entry.player.id, rank: r.rank, played: r.played })), mg.pot) : null;
            // Duel : le gagnant prend la mise du perdant
            const duel = mg.context === 'duel' && ranked.length === 2 && ranked[0].rank !== ranked[1].rank && ranked[0].played ? ranked : null;
            const duelAmount = duel ? -this.addHype(duel[1].entry.player, -mg.pot) : 0;
            mg.results = ranked.map(({ entry, rank: place, played }) => {
                let reward = 0;
                if (battle) reward = battle[entry.player.id] || 0;
                else if (mg.context === 'duel') reward = duel && place === 1 ? duelAmount : duel ? -duelAmount : 0;
                else reward = played ? REWARDS.ffa[place - 1] || 0 : 0;
                if (reward > 0) this.addHype(entry.player, reward);
                if (place === 1 && played) entry.player.stats.minigameWins += 1;
                return { playerId: entry.player.id, rank: place, reward, display: entry.display };
            });
        }
        const showFor = this.ms(mg.botsOnly ? TIMING.mgResultsBots : TIMING.mgResults);
        const token = this.setStep('minigame', 'results', showFor);
        this.publish({ type: 'minigameResults', id: mg.id, context: mg.context, kind: mg.kind });
        this.later(token, showFor, () => {
            this.minigame = null;
            // Battle ou duel : retour au plateau, au joueur suivant
            if (mg.context === 'battle' || mg.context === 'duel') {
                this.battle = null;
                this.duel = null;
                this.nextPlayer();
                return;
            }
            if (this.turn >= this.settings.turns) this.endGame();
            else this.beginTurn(this.turn + 1);
        });
    }

    // Duel (dans les 5 derniers tours) : s'arrêter sur la case d'un autre joueur lance un duel
    duelTarget(player) {
        if (this.turn <= this.settings.turns - 5 || player.space === this.board.start) return null;
        const others = this.players.filter((p) => p.id !== player.id && p.space === player.space);
        if (!others.length) return null;
        const target = others[this.randInt(0, others.length - 1)];
        return Math.min(DUEL_STAKE, player.hype, target.hype) > 0 ? target : null;
    }

    startDuel(player, target) {
        const stake = Math.min(DUEL_STAKE, player.hype, target.hype);
        this.duel = { playerId: player.id, targetId: target.id, stake };
        const token = this.setStep('turn', 'duel', this.ms(TIMING.duelIntro));
        this.publish({ type: 'duel', playerId: player.id, targetId: target.id, stake });
        this.later(token, this.ms(TIMING.duelIntro), () => this.startMinigame({ context: 'duel', pot: stake, players: [player.id, target.id] }));
    }

    // -----------------------------------------------------------------------
    // Fin de partie
    // -----------------------------------------------------------------------

    // Valeur d'un joueur pour un Micro bonus
    bonusValue(id, player) {
        const s = player.stats;
        switch (id) {
            case 'minigames': return s.minigameWins;
            case 'flow': return s.maxHype;
            case 'drop': return s.tipsEarned;
            case 'larsen': return s.redLandings;
            case 'distance': return s.spacesMoved;
            default: return 0;
        }
    }

    // Avant le podium : les Micros bonus, révélés un à un
    endGame() {
        const count = Math.min(BONUS_IDS.length, BONUS_COUNT + (this.finaleEffect === 'extraBonus' ? 1 : 0));
        this.bonuses = this.shuffle(BONUS_IDS).slice(0, count).map((id) => {
            const values = this.players.map((p) => ({ id: p.id, value: this.bonusValue(id, p) }));
            const best = Math.max(...values.map((v) => v.value));
            const winners = best > 0 ? values.filter((v) => v.value === best).map((v) => v.id) : [];
            return { id, value: best, winners, revealed: false };
        });
        const token = this.setStep('end', 'bonusIntro', this.ms(TIMING.bonusIntro));
        this.publish({ type: 'bonusIntro', count });
        this.later(token, this.ms(TIMING.bonusIntro), () => this.revealBonus(0));
    }

    revealBonus(index) {
        const bonus = this.bonuses[index];
        if (!bonus) {
            this.finishGame();
            return;
        }
        bonus.revealed = true;
        bonus.winners.forEach((id) => {
            const p = this.player(id);
            if (p) p.stars += 1;
        });
        const token = this.setStep('end', 'bonus', this.ms(TIMING.bonusShow));
        this.publish({ type: 'bonus', index, id: bonus.id });
        this.later(token, this.ms(TIMING.bonusShow), () => this.revealBonus(index + 1));
    }

    finishGame() {
        const ranked = [...this.players].sort((a, b) => (b.stars - a.stars) || (b.hype - a.hype) || (b.stats.minigameWins - a.stats.minigameWins));
        let rank = 0;
        this.finalRanking = ranked.map((p, index) => {
            const prev = ranked[index - 1];
            if (index === 0 || p.stars !== prev.stars || p.hype !== prev.hype) rank = index;
            return { playerId: p.id, rank: rank + 1, stars: p.stars, hype: p.hype, minigameWins: p.stats.minigameWins, hypeEarned: p.stats.hypeEarned };
        });
        // Égalité de Micros d'or en tête : la Hype a départagé (affiché sur l'écran de fin)
        this.tiebreak = ranked.length > 1 && ranked[0].stars === ranked[1].stars ? 'hype' : null;
        this.setStep('end', 'podium');
        this.publish({ type: 'end' });
    }

    rematch(requesterId) {
        if (requesterId !== this.hostId) return { error: 'not_host' };
        if (this.phase !== 'end' || this.step !== 'podium') return { error: 'not_now' };
        this.clearTimers();
        this.resetGameState();
        this.players.forEach((p) => {
            p.space = null;
            p.hype = START_HYPE;
            p.stars = 0;
            p.ready = false;
            p.items = [];
            p.stats = this.newStats();
        });
        this.setStep('lobby', null);
        this.publish({ type: 'rematch' });
        return { ok: true };
    }
}

module.exports = { PartyGame, CHARACTER_IDS, MAX_PLAYERS, TURN_OPTIONS, TIMING, DICE, BONUS_IDS, ITEMS };
