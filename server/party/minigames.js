/**
 * Mini-jeux de Beatbox Party (version 1 : chacun pour soi, une seule commande).
 *
 * Chaque mini-jeu tire ses paramètres d'une graine commune (setup), reçoit de
 * chaque joueur un résultat brut envoyé par le client, le recalcule ou le borne
 * côté serveur (score), puis classe les joueurs (le plus grand score gagne).
 * Les bots produisent un résultat plausible (bot).
 *
 * Les durées sont en millisecondes, comptées depuis le début de la manche
 * (après le décompte affiché par le client).
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

const MINIGAMES = {
    // Dégaine : le drop tombe, le premier qui appuie gagne. Un faux départ et c'est perdu.
    degaine: {
        id: 'degaine',
        setup(seed) {
            const r = rng(seed);
            const signalAt = Math.round(2200 + r() * 3300);
            return { signalAt, duration: signalAt + 2500 };
        },
        // Le client envoie { reaction } (ms après le signal, mesuré sur son horloge) ou { falseStart: true }
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
        display(params, raw) {
            if (!raw) return { kind: 'none' };
            if (raw.falseStart) return { kind: 'falseStart' };
            return { kind: 'ms', value: Math.round(clamp(raw.reaction, 90, 5000)) };
        },
    },

    // La gorgée : maintiens pour remplir ta bouteille, relâche au plus près du trait sans déborder.
    // Chaque joueur a sa propre vitesse de remplissage (dans params.players).
    gorgee: {
        id: 'gorgee',
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
        // Le client envoie { holdMs } : durée de l'appui
        score(params, raw, playerId) {
            if (!raw || !isNumber(raw.holdMs)) return -1e9;
            const level = this.level(params, playerId, raw.holdMs);
            if (level > 1) return -1e6 + level; // débordé
            return level;
        },
        bot(params, r, playerId) {
            const p = params.players[playerId];
            const target = 0.72 + r() * 0.34; // parfois trop
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
        setup(seed) {
            const r = rng(seed);
            return {
                period: Math.round(1500 + r() * 700),
                phase: Number((r() * Math.PI * 2).toFixed(3)),
                duration: 8000,
            };
        },
        // Position du micro (-1 à 1) à l'instant t (ms depuis le début)
        position(params, t) {
            return Math.sin((t / params.period) * Math.PI * 2 + params.phase);
        },
        // Le client envoie { atMs } : moment du lâcher
        score(params, raw) {
            if (!raw || !isNumber(raw.atMs)) return -1e9;
            const t = clamp(raw.atMs, 0, params.duration);
            return -Math.abs(this.position(params, t));
        },
        bot(params, r) {
            // Vise un passage au centre, avec une erreur de quelques dizaines de ms
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
        setup(seed) {
            const r = rng(seed);
            const bpm = Math.round(96 + r() * 28);
            const beatMs = 60000 / bpm;
            return { bpm, beatMs, countIn: 4, beats: 8, duration: Math.round(beatMs * 13.5) };
        },
        // Le client envoie { offsets: [8 décalages en ms, null si raté] }
        score(params, raw) {
            if (!raw || !Array.isArray(raw.offsets)) return -1e9;
            return raw.offsets.slice(0, params.beats).reduce((sum, offset) => {
                if (!isNumber(offset)) return sum;
                return sum + Math.max(0, 1 - Math.abs(offset) / 160);
            }, 0);
        },
        bot(params, r) {
            const skill = 20 + r() * 70;
            return {
                offsets: Array.from({ length: params.beats }, () => (r() < 0.08 ? null : Math.round((r() - 0.5) * 2 * skill))),
            };
        },
        display(params, raw) {
            if (!raw || !Array.isArray(raw.offsets)) return { kind: 'none' };
            const score = this.score(params, raw);
            return { kind: 'percent', value: Math.round((score / params.beats) * 100) };
        },
    },
};

const MINIGAME_IDS = Object.keys(MINIGAMES);

module.exports = { MINIGAMES, MINIGAME_IDS, rng };
