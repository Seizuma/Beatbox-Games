/**
 * Mini-jeux de Beatbox Party.
 *
 * Comme dans Mario Party, le type du mini-jeu découle du plateau : à la fin d'une manche,
 * la couleur de la dernière case de chaque joueur (bleue = applaudi, rouge = Larsen, les
 * autres tirées au sort) forme les équipes.
 *   ffa   4 joueurs, chacun pour soi (4 de la même couleur)
 *   1v3   un contre trois (3 + 1)
 *   2v2   deux contre deux (2 + 2)
 *   duel  un contre un (deux joueurs sur la même case dans les 5 derniers tours)
 *
 * Chaque mini-jeu tire ses paramètres d'une graine commune (setup), reçoit de chaque
 * joueur un résultat brut envoyé par le client, le recalcule ou le borne côté serveur
 * (score), puis classe les joueurs (le plus grand score gagne). Les bots produisent un
 * résultat plausible (bot).
 *
 * Mini-jeux « en direct » : certains ont besoin d'échanges pendant la partie (un motif à
 * transmettre, des choix secrets dévoilés à chaque manche, une corde à tirer). Le client
 * envoie alors des actions (input), et le serveur publie un état commun (mg.live), avec
 * des étapes à heure fixe (timeline / onTime) et des bots qui jouent en direct (botPlan).
 *
 * Mini-jeux d'équipe : result(mg, ctx) renvoie le score de chaque camp (a et b) ; le plus
 * grand gagne, l'égalité ne rapporte rien.
 *
 * Les durées sont en millisecondes, comptées depuis le début de la manche (après le
 * décompte affiché par le client).
 */

// Générateur pseudo-aléatoire déterministe : même graine, mêmes paramètres partout
function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isPick = (value, n) => Number.isInteger(value) && value >= 0 && value < n;

// Précision d'une frappe en rythme : 1 pile sur le temps, 0 à 160 ms et plus
const beatAccuracy = (offsets, count) => (Array.isArray(offsets) ? offsets.slice(0, count) : []).reduce((sum, o) => (isNumber(o) ? sum + Math.max(0, 1 - Math.abs(o) / 160) : sum), 0);

const MINIGAMES = {
    // -----------------------------------------------------------------------
    // Chacun pour soi (aussi jouables en duel)
    // -----------------------------------------------------------------------

    // Dégaine : le drop tombe, le premier qui appuie gagne. Un faux départ et c'est perdu.
    degaine: {
        id: 'degaine',
        kinds: ['ffa', 'duel'],
        control: 'reaction',
        setup(seed) {
            const r = rng(seed);
            const signalAt = Math.round(2200 + r() * 3300);
            return { signalAt, duration: signalAt + 2500 };
        },
        // Le client envoie { reaction } (ms après le signal) ou { falseStart: true }
        score(params, raw) {
            if (!raw) return -1e9;
            if (raw.falseStart) return -1e6;
            if (!isNumber(raw.reaction)) return -1e9;
            return -clamp(raw.reaction, 90, 5000);
        },
        bot(params, r) {
            if (r() < 0.06) return { falseStart: true };
            return { reaction: Math.round(230 + r() * 330) };
        },
        // Le temps de réaction est mesuré chez le joueur (équitable quelle que soit la latence).
        // Le serveur vérifie qu'il colle à l'heure d'arrivée : une réponse arrivée avant le
        // signal est un faux départ, et un temps annoncé trop court est ramené au minimum possible.
        verify(params, raw, { elapsed, maxLag }) {
            if (raw.falseStart || !isNumber(raw.reaction)) return raw;
            if (elapsed < params.signalAt - 50) return { falseStart: true };
            const least = elapsed - params.signalAt - Math.max(150, maxLag);
            return raw.reaction < least ? { reaction: Math.round(least), adjusted: true } : raw;
        },
        display(params, raw) {
            if (!raw) return { kind: 'none' };
            if (raw.falseStart) return { kind: 'falseStart' };
            return { kind: 'ms', value: Math.round(clamp(raw.reaction, 90, 5000)) };
        },
    },

    // La gorgée : maintiens pour remplir ta bouteille, relâche au plus près du trait sans déborder.
    gorgee: {
        id: 'gorgee',
        kinds: ['ffa', 'duel'],
        control: 'hold',
        setup(seed, playerIds) {
            const r = rng(seed);
            const players = {};
            playerIds.forEach((id) => {
                players[id] = { fillMs: Math.round(2300 + r() * 1300), curve: Number((1.25 + r() * 0.9).toFixed(2)) };
            });
            return { players, duration: 9000 };
        },
        level(params, playerId, holdMs) {
            const p = params.players[playerId] || { fillMs: 3000, curve: 1.5 };
            return Math.pow(clamp(holdMs, 0, 20000) / p.fillMs, p.curve);
        },
        score(params, raw, playerId) {
            if (!raw || !isNumber(raw.holdMs)) return -1e9;
            const level = this.level(params, playerId, raw.holdMs);
            if (level > 1) return -1e6 + level;
            return level;
        },
        bot(params, r, playerId) {
            const p = params.players[playerId];
            const target = 0.72 + r() * 0.34;
            return { holdMs: Math.round(p.fillMs * Math.pow(target, 1 / p.curve)) };
        },
        display(params, raw, playerId) {
            if (!raw || !isNumber(raw.holdMs)) return { kind: 'none' };
            const level = this.level(params, playerId, raw.holdMs);
            return level > 1 ? { kind: 'overflow' } : { kind: 'percent', value: Math.round(level * 100) };
        },
    },

    // Mic drop : le micro se balance au-dessus de la scène, lâche-le pile sur la cible.
    micdrop: {
        id: 'micdrop',
        kinds: ['ffa', 'duel'],
        control: 'timing',
        setup(seed) {
            const r = rng(seed);
            return { period: Math.round(1500 + r() * 700), phase: Number((r() * Math.PI * 2).toFixed(3)), duration: 8000 };
        },
        position(params, t) {
            return Math.sin((t / params.period) * Math.PI * 2 + params.phase);
        },
        score(params, raw) {
            if (!raw || !isNumber(raw.atMs)) return -1e9;
            return -Math.abs(this.position(params, clamp(raw.atMs, 0, params.duration)));
        },
        bot(params, r) {
            const k = Math.ceil(params.phase / Math.PI) + Math.floor(r() * 3);
            let t = ((k * Math.PI - params.phase) / (Math.PI * 2)) * params.period;
            if (t < 400) t += params.period / 2;
            return { atMs: Math.round(t + (r() - 0.5) * 220) };
        },
        display(params, raw) {
            if (!raw || !isNumber(raw.atMs)) return { kind: 'none' };
            const d = Math.abs(this.position(params, clamp(raw.atMs, 0, params.duration)));
            return { kind: 'percent', value: Math.round((1 - d) * 100) };
        },
    },

    // Calé : huit temps à frapper pile sur le beat, après quatre temps d'écoute.
    cale: {
        id: 'cale',
        kinds: ['ffa', 'duel'],
        control: 'rhythm',
        setup(seed) {
            const r = rng(seed);
            const bpm = Math.round(96 + r() * 28);
            const beatMs = 60000 / bpm;
            return { bpm, beatMs, countIn: 4, beats: 8, duration: Math.round(beatMs * 13.5) };
        },
        score(params, raw) {
            if (!raw || !Array.isArray(raw.offsets)) return -1e9;
            return beatAccuracy(raw.offsets, params.beats);
        },
        bot(params, r) {
            const skill = 20 + r() * 70;
            return { offsets: Array.from({ length: params.beats }, () => (r() < 0.08 ? null : Math.round((r() - 0.5) * 2 * skill))) };
        },
        display(params, raw) {
            if (!raw || !Array.isArray(raw.offsets)) return { kind: 'none' };
            return { kind: 'percent', value: Math.round((this.score(params, raw) / params.beats) * 100) };
        },
    },

    // Roulement : tape le plus vite possible pendant 5 secondes (roulement de caisse claire).
    roulement: {
        id: 'roulement',
        kinds: ['ffa', 'duel'],
        control: 'mash',
        setup() {
            return { duration: 5000, maxRate: 18 };
        },
        // Le client envoie { taps }, borné à 18 frappes par seconde
        score(params, raw) {
            if (!raw || !isNumber(raw.taps)) return -1e9;
            return clamp(Math.round(raw.taps), 0, Math.round((params.duration / 1000) * params.maxRate));
        },
        bot(params, r) {
            return { taps: Math.round(30 + r() * 30) };
        },
        display(params, raw) {
            if (!raw || !isNumber(raw.taps)) return { kind: 'none' };
            return { kind: 'taps', value: this.score(params, raw) };
        },
    },

    // Écho : la loopstation joue une suite de sons, rejoue-la. Trois manches de plus en plus longues.
    echo: {
        id: 'echo',
        kinds: ['ffa', 'duel'],
        control: 'memory',
        setup(seed) {
            const r = rng(seed);
            const sequence = Array.from({ length: 6 }, () => Math.floor(r() * 4));
            const stepMs = 430;
            const rounds = [];
            let t = 400;
            [4, 5, 6].forEach((len) => {
                const listenAt = t;
                const answerAt = listenAt + len * stepMs + 300;
                const endAt = answerAt + 1400 + len * 650;
                rounds.push({ len, listenAt, answerAt, endAt });
                t = endAt + 500;
            });
            return { sequence, stepMs, rounds, duration: t };
        },
        // Le client envoie { answers: [[...], [...], [...]], ms } : ses réponses à chaque manche
        correct(params, raw) {
            if (!raw || !Array.isArray(raw.answers)) return 0;
            return params.rounds.reduce((sum, round, i) => {
                const answer = Array.isArray(raw.answers[i]) ? raw.answers[i] : [];
                let ok = 0;
                while (ok < round.len && answer[ok] === params.sequence[ok]) ok += 1;
                return sum + ok;
            }, 0);
        },
        score(params, raw) {
            if (!raw || !Array.isArray(raw.answers)) return -1e9;
            // Égalité : le plus rapide passe devant
            return this.correct(params, raw) * 100000 - clamp(isNumber(raw.ms) ? raw.ms : 99999, 0, 99999);
        },
        bot(params, r) {
            const answers = params.rounds.map((round) => {
                const out = [];
                for (let k = 0; k < round.len; k += 1) {
                    if (r() < 0.07 + k * 0.025) { out.push((params.sequence[k] + 1) % 4); break; }
                    out.push(params.sequence[k]);
                }
                return out;
            });
            return { answers, ms: Math.round(5000 + r() * 6000) };
        },
        display(params, raw) {
            if (!raw || !Array.isArray(raw.answers)) return { kind: 'none' };
            return { kind: 'notes', value: this.correct(params, raw) };
        },
    },

    // -----------------------------------------------------------------------
    // Un contre trois
    // -----------------------------------------------------------------------

    // Contre la foule : le solo pose un motif de 4 sons, les trois autres doivent le reproduire.
    // La foule gagne si au moins deux de ses joueurs le reproduisent exactement.
    crowd: {
        id: 'crowd',
        kinds: ['1v3'],
        control: 'memory',
        live: true,
        setup(seed) {
            const recordMs = 5500;
            const stepMs = 450;
            const playAt = recordMs + 400;
            const answerAt = playAt + 4 * stepMs + 300;
            return { length: 4, recordMs, stepMs, playAt, answerAt, duration: answerAt + 5500 };
        },
        // Le solo envoie { pattern: [4 sons] } pendant l'enregistrement
        input(mg, playerId, data, ctx) {
            if (playerId !== ctx.solo || mg.live.pattern) return false;
            if (!Array.isArray(data.pattern) || data.pattern.length !== mg.params.length || !data.pattern.every((v) => isPick(v, 4))) return false;
            mg.live.pattern = data.pattern.slice();
            return true;
        },
        timeline(params) {
            return [{ at: params.recordMs, id: 'lock' }];
        },
        // Le solo n'a rien posé à temps : la loopstation choisit à sa place
        onTime(mg, id, ctx, random) {
            if (id === 'lock' && !mg.live.pattern) {
                mg.live.pattern = Array.from({ length: mg.params.length }, () => Math.floor(random() * 4));
                mg.live.auto = true;
            }
            return true;
        },
        botPlan(mg, ctx, random) {
            if (!ctx.bots.includes(ctx.solo)) return [];
            return [{ at: 1500 + Math.round(random() * 2500), data: { pattern: Array.from({ length: mg.params.length }, () => Math.floor(random() * 4)) }, playerId: ctx.solo }];
        },
        // Les bots de la foule répondent après avoir entendu le motif
        botRawFrom(params) {
            return params.answerAt + 600;
        },
        // La foule envoie { answer: [4 sons] } ; le solo n'envoie rien de plus
        bot(params, r, playerId, mg, ctx) {
            if (playerId === ctx.solo) return { done: true };
            const pattern = (mg.live && mg.live.pattern) || [0, 0, 0, 0];
            if (r() < 0.62) return { answer: pattern.slice() };
            const answer = pattern.slice();
            answer[Math.floor(r() * answer.length)] = Math.floor(r() * 4);
            return { answer };
        },
        ok(mg, raw) {
            return Boolean(raw && Array.isArray(raw.answer) && mg.live.pattern && raw.answer.length === mg.live.pattern.length && raw.answer.every((v, i) => v === mg.live.pattern[i]));
        },
        result(mg, ctx) {
            const crowd = ctx.teams.a;
            const hits = crowd.filter((id) => this.ok(mg, mg.raw[id])).length;
            const display = {};
            crowd.forEach((id) => { display[id] = mg.raw[id] ? { kind: this.ok(mg, mg.raw[id]) ? 'copied' : 'missed' } : { kind: 'none' }; });
            display[ctx.solo] = { kind: 'copies', value: hits };
            return { a: hits >= 2 ? 1 : 0, b: hits >= 2 ? 0 : 1, display };
        },
    },

    // Le Drop : 3 manches. Chaque joueur de la foule choisit en secret une des 5 pistes ;
    // le solo lâche le drop sur deux pistes. Ceux qui s'y trouvent sont éliminés.
    // La foule gagne s'il reste au moins un survivant.
    ledrop: {
        id: 'ledrop',
        kinds: ['1v3'],
        control: 'choice',
        live: true,
        setup() {
            const pickMs = 3800;
            const revealMs = 1800;
            const rounds = Array.from({ length: 3 }, (_, i) => ({ startAt: i * (pickMs + revealMs), revealAt: i * (pickMs + revealMs) + pickMs }));
            return { tracks: 5, drops: 2, rounds, pickMs, revealMs, duration: 3 * (pickMs + revealMs) + 300 };
        },
        init(mg, ctx) {
            mg.live.alive = ctx.teams.a.slice();
            mg.live.rounds = [];
            mg.secret.picks = mg.params.rounds.map(() => ({}));
        },
        roundAt(mg, ctx, elapsed) {
            return mg.params.rounds.findIndex((r) => elapsed >= r.startAt && elapsed < r.revealAt);
        },
        input(mg, playerId, data, ctx, elapsed) {
            const round = this.roundAt(mg, ctx, elapsed);
            if (round < 0 || data.round !== round) return false;
            const picks = mg.secret.picks[round];
            if (playerId === ctx.solo) {
                const drops = Array.isArray(data.drops) ? [...new Set(data.drops)].filter((v) => isPick(v, mg.params.tracks)) : [];
                if (drops.length !== mg.params.drops) return false;
                picks[playerId] = drops;
            } else {
                if (!mg.live.alive.includes(playerId) || !isPick(data.pick, mg.params.tracks)) return false;
                picks[playerId] = data.pick;
            }
            // Le choix reste secret ; on publie seulement qui a déjà choisi
            mg.live.ready = Object.keys(picks);
            return true;
        },
        timeline(params) {
            return params.rounds.map((r, i) => ({ at: r.revealAt, id: `reveal${i}` }));
        },
        onTime(mg, id, ctx, random) {
            const round = Number(id.replace('reveal', ''));
            const picks = mg.secret.picks[round];
            const n = mg.params.tracks;
            if (!picks[ctx.solo]) {
                const first = Math.floor(random() * n);
                picks[ctx.solo] = [first, (first + 1 + Math.floor(random() * (n - 1))) % n];
            }
            mg.live.alive.forEach((pid) => { if (!isPick(picks[pid], n)) picks[pid] = Math.floor(random() * n); });
            const drops = picks[ctx.solo];
            const out = mg.live.alive.filter((pid) => drops.includes(picks[pid]));
            mg.live.alive = mg.live.alive.filter((pid) => !out.includes(pid));
            mg.live.rounds.push({ drops, picks: { ...picks }, out });
            mg.live.ready = [];
            return true;
        },
        botPlan(mg, ctx, random) {
            const plan = [];
            mg.params.rounds.forEach((r, i) => {
                ctx.bots.forEach((pid) => {
                    const at = r.startAt + 600 + Math.round(random() * (mg.params.pickMs - 1200));
                    if (pid === ctx.solo) {
                        const first = Math.floor(random() * 5);
                        plan.push({ at, playerId: pid, data: { round: i, drops: [first, (first + 1 + Math.floor(random() * 4)) % 5] } });
                    } else plan.push({ at, playerId: pid, data: { round: i, pick: Math.floor(random() * 5) }, ifAlive: true });
                });
            });
            return plan;
        },
        bot() {
            return { done: true };
        },
        result(mg, ctx) {
            const alive = mg.live.alive || [];
            const display = {};
            ctx.teams.a.forEach((id) => { display[id] = { kind: alive.includes(id) ? 'survived' : 'dropped' }; });
            display[ctx.solo] = { kind: 'caught', value: ctx.teams.a.length - alive.length };
            return { a: alive.length > 0 ? 1 : 0, b: alive.length > 0 ? 0 : 1, display };
        },
    },

    // Bras de fer : tout le monde tape le plus vite possible ; les frappes du solo comptent
    // presque triple. La corde penche du côté le plus fort.
    tug: {
        id: 'tug',
        kinds: ['1v3'],
        control: 'mash',
        live: true,
        setup() {
            return { duration: 6000, soloFactor: 2.8, maxRate: 18 };
        },
        init(mg, ctx) {
            mg.live.taps = {};
            ctx.participants.forEach((id) => { mg.live.taps[id] = 0; });
        },
        // Le client envoie { taps } (total depuis le début), au plus 18 frappes par seconde
        input(mg, playerId, data, ctx, elapsed) {
            if (!isNumber(data.taps) || elapsed < 0) return false;
            const cap = Math.ceil((clamp(elapsed, 0, mg.params.duration) / 1000) * mg.params.maxRate) + 2;
            mg.live.taps[playerId] = clamp(Math.round(data.taps), mg.live.taps[playerId] || 0, cap);
            return true;
        },
        throttle: 200,
        botPlan(mg, ctx, random) {
            const plan = [];
            ctx.bots.forEach((pid) => {
                const rate = (pid === ctx.solo ? 6.5 : 5.5) + random() * 2.5;
                for (let t = 250; t <= mg.params.duration; t += 250) plan.push({ at: t, playerId: pid, data: { taps: Math.round((rate * t) / 1000) } });
            });
            return plan;
        },
        bot() {
            return { done: true };
        },
        force(mg, ctx) {
            const taps = mg.live.taps || {};
            const solo = (taps[ctx.solo] || 0) * mg.params.soloFactor;
            const crowd = ctx.teams.a.reduce((sum, id) => sum + (taps[id] || 0), 0);
            return { solo, crowd };
        },
        result(mg, ctx) {
            const { solo, crowd } = this.force(mg, ctx);
            const display = {};
            ctx.participants.forEach((id) => { display[id] = { kind: 'taps', value: (mg.live.taps || {})[id] || 0 }; });
            return { a: crowd, b: solo, display };
        },
    },

    // -----------------------------------------------------------------------
    // Deux contre deux
    // -----------------------------------------------------------------------

    // Boucle à deux : dans chaque équipe, l'un tient le kick (temps 1 et 3), l'autre la
    // caisse claire (temps 2 et 4). La boucle la plus juste gagne.
    loop2: {
        id: 'loop2',
        kinds: ['2v2'],
        control: 'rhythm',
        setup(seed, playerIds, ctx) {
            const r = rng(seed);
            const bpm = Math.round(88 + r() * 22);
            const beatMs = 60000 / bpm;
            const roles = {};
            ['a', 'b'].forEach((side) => {
                const members = (ctx && ctx.teams && ctx.teams[side]) || [];
                members.forEach((id, i) => { roles[id] = i === 0 ? 'kick' : 'snare'; });
            });
            return { bpm, beatMs, countIn: 4, beats: 16, hits: 8, roles, duration: Math.round(beatMs * 21.5) };
        },
        // Le client envoie { offsets: [8 décalages en ms] } sur ses propres temps
        score(params, raw) {
            if (!raw || !Array.isArray(raw.offsets)) return 0;
            return beatAccuracy(raw.offsets, params.hits);
        },
        bot(params, r) {
            const skill = 25 + r() * 70;
            return { offsets: Array.from({ length: params.hits }, () => (r() < 0.08 ? null : Math.round((r() - 0.5) * 2 * skill))) };
        },
        result(mg, ctx) {
            const sum = (ids) => ids.reduce((s, id) => s + this.score(mg.params, mg.raw[id]), 0);
            const display = {};
            ctx.participants.forEach((id) => { display[id] = mg.raw[id] ? { kind: 'percent', value: Math.round((this.score(mg.params, mg.raw[id]) / mg.params.hits) * 100) } : { kind: 'none' }; });
            return { a: sum(ctx.teams.a), b: sum(ctx.teams.b), display };
        },
    },

    // Bouteille à deux : chaque équipe remplit une seule bouteille, chacun sa part. Le
    // total doit approcher le trait sans déborder. Quand un joueur a versé, son équipier
    // voit le niveau.
    bottle2: {
        id: 'bottle2',
        kinds: ['2v2'],
        control: 'hold',
        live: true,
        setup(seed, playerIds) {
            const r = rng(seed);
            const players = {};
            playerIds.forEach((id) => {
                players[id] = { fillMs: Math.round(2600 + r() * 1400), curve: Number((1.2 + r() * 0.6).toFixed(2)) };
            });
            return { players, duration: 10000 };
        },
        level(params, playerId, holdMs) {
            const p = params.players[playerId] || { fillMs: 3000, curve: 1.4 };
            // Chaque joueur remplit au plus la bouteille entière à lui seul
            return Math.pow(clamp(holdMs, 0, 20000) / p.fillMs, p.curve) * 0.5;
        },
        init(mg) {
            mg.live.pours = {};
        },
        // Le client envoie { holdMs } en relâchant : le niveau est publié pour l'équipier
        input(mg, playerId, data) {
            if (!isNumber(data.holdMs) || mg.live.pours[playerId] != null) return false;
            mg.live.pours[playerId] = Number(this.level(mg.params, playerId, data.holdMs).toFixed(3));
            mg.raw[playerId] = { holdMs: Math.round(data.holdMs) };
            return true;
        },
        botPlan(mg, ctx, random) {
            return ctx.bots.map((pid) => ({ at: 1200 + Math.round(random() * 6500), playerId: pid, bottle: true }));
        },
        // Un bot vise ce qui manque à son équipe (s'il voit déjà la part de son équipier)
        botPour(mg, ctx, playerId, random) {
            const side = ctx.teams.a.includes(playerId) ? 'a' : 'b';
            const mate = ctx.teams[side].find((id) => id !== playerId);
            const mateLevel = mate != null ? mg.live.pours[mate] : null;
            const target = (mateLevel != null ? 1 - mateLevel : 0.5) * (0.82 + random() * 0.24);
            const p = mg.params.players[playerId];
            return Math.round(p.fillMs * Math.pow(clamp(target, 0, 2) / 0.5, 1 / p.curve));
        },
        bot() {
            return null;
        },
        total(mg, ids) {
            return ids.reduce((s, id) => s + (mg.live.pours[id] || 0), 0);
        },
        result(mg, ctx) {
            const value = (ids) => {
                const total = this.total(mg, ids);
                return total > 1 ? -1 + (2 - total) * 0.001 : total;
            };
            const display = {};
            ['a', 'b'].forEach((side) => {
                const total = this.total(mg, ctx.teams[side]);
                ctx.teams[side].forEach((id) => { display[id] = total > 1 ? { kind: 'overflow' } : { kind: 'percent', value: Math.round(total * 100) }; });
            });
            return { a: value(ctx.teams.a), b: value(ctx.teams.b), display };
        },
    },

    // Même vibe : 5 manches. Chaque joueur choisit en secret un des 4 sons ; une équipe
    // marque quand ses deux joueurs ont choisi le même.
    vibe: {
        id: 'vibe',
        kinds: ['2v2'],
        control: 'choice',
        live: true,
        setup() {
            const pickMs = 3200;
            const revealMs = 1500;
            const rounds = Array.from({ length: 5 }, (_, i) => ({ startAt: i * (pickMs + revealMs), revealAt: i * (pickMs + revealMs) + pickMs }));
            return { sounds: 4, rounds, pickMs, revealMs, duration: 5 * (pickMs + revealMs) + 300 };
        },
        init(mg) {
            mg.live.rounds = [];
            mg.live.score = { a: 0, b: 0 };
            mg.secret.picks = mg.params.rounds.map(() => ({}));
        },
        input(mg, playerId, data, ctx, elapsed) {
            const round = mg.params.rounds.findIndex((r) => elapsed >= r.startAt && elapsed < r.revealAt);
            if (round < 0 || data.round !== round || !isPick(data.pick, mg.params.sounds)) return false;
            const picks = mg.secret.picks[round];
            if (picks[playerId] != null) return false;
            picks[playerId] = data.pick;
            mg.live.ready = Object.keys(picks);
            return true;
        },
        timeline(params) {
            return params.rounds.map((r, i) => ({ at: r.revealAt, id: `reveal${i}` }));
        },
        onTime(mg, id, ctx) {
            const round = Number(id.replace('reveal', ''));
            const picks = mg.secret.picks[round];
            const match = {};
            ['a', 'b'].forEach((side) => {
                const [x, y] = ctx.teams[side];
                match[side] = picks[x] != null && picks[x] === picks[y];
                if (match[side]) mg.live.score[side] += 1;
            });
            mg.live.rounds.push({ picks: { ...picks }, match });
            mg.live.ready = [];
            return true;
        },
        botPlan(mg, ctx, random) {
            const plan = [];
            mg.params.rounds.forEach((r, i) => {
                // Les bots ont un son « favori » par manche : deux bots tombent souvent d'accord
                const favorite = Math.floor(rng(mg.seed + i * 7919)() * 4);
                ctx.bots.forEach((pid) => {
                    const pick = random() < 0.55 ? favorite : Math.floor(random() * 4);
                    plan.push({ at: r.startAt + 500 + Math.round(random() * (mg.params.pickMs - 1000)), playerId: pid, data: { round: i, pick } });
                });
            });
            return plan;
        },
        bot() {
            return { done: true };
        },
        result(mg, ctx) {
            const display = {};
            ['a', 'b'].forEach((side) => ctx.teams[side].forEach((id) => { display[id] = { kind: 'matches', value: mg.live.score[side] }; }));
            return { a: mg.live.score.a, b: mg.live.score.b, display };
        },
    },
};

const MINIGAME_IDS = Object.keys(MINIGAMES);

/** Mini-jeux jouables pour un type ('ffa', '1v3', '2v2', 'duel') */
const minigamesFor = (kind) => MINIGAME_IDS.filter((id) => MINIGAMES[id].kinds.includes(kind));

module.exports = { MINIGAMES, MINIGAME_IDS, minigamesFor, rng };
