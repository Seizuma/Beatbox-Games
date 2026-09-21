// server/services/beatboxdle-daily.js
//
// Tirage du beatboxer du jour.
//
// Principe : pas de tirage aléatoire ni de stockage. Le jour N donne toujours
// le même beatboxer, calculé à la volée — donc pas de désynchronisation entre
// instances, pas de table à alimenter, et un redémarrage ne change rien.
//
// La liste est mélangée par une permutation de Fisher-Yates semée avec
// (BEATBOXDLE_SEED + mode + numéro de cycle). Deux conséquences voulues :
//   - aucun beatboxer ne repasse avant que toute la liste soit épuisée ;
//   - le cycle suivant est dans un ordre différent ;
//   - les deux modes ne proposent pas le même beatboxer le même jour.
//
// Le `reroll` est la seule entorse, et elle est réservée aux tests : il vient
// de la base (l'administrateur l'incrémente) et ne sale la graine QUE pour la
// date concernée. Les autres jours gardent l'ordre du cycle, donc relancer un
// tirage aujourd'hui ne décale pas les semaines suivantes.

const dataset = require('./beatboxdle-dataset');

const TIMEZONE = process.env.BEATBOXDLE_TIMEZONE || 'Europe/Paris';
const EPOCH = process.env.BEATBOXDLE_EPOCH || '2026-01-01';
// Changer cette graine rebat toutes les cartes : à ne faire qu'avant l'ouverture.
const SEED = process.env.BEATBOXDLE_SEED || 'beatboxdle-v1';

const MODES = {
    letters: { maxAttempts: 6 },
    clues: { maxAttempts: 8 },
};

// Mode lettres : une réponse de 13 lettres n'est jouable que s'il existe assez
// d'autres noms de 13 lettres à proposer. En dessous de ce seuil, la longueur
// est écartée du tirage — sinon la grille se devine par élimination.
const LETTERS_MIN_CANDIDATES = Number(process.env.BEATBOXDLE_MIN_CANDIDATES) || 12;

const isMode = (mode) => Object.prototype.hasOwnProperty.call(MODES, mode);

/** Vivier du mode, une fois les longueurs injouables retirées. */
function pool(mode) {
    const playable = dataset.forMode(mode);
    if (mode !== 'letters') return playable;

    const byLength = new Map();
    playable.forEach((beatboxer) => byLength.set(beatboxer.length, (byLength.get(beatboxer.length) || 0) + 1));
    return playable.filter((beatboxer) => byLength.get(beatboxer.length) >= LETTERS_MIN_CANDIDATES);
}

// « fr-CA » donne YYYY-MM-DD, le seul format ISO que propose Intl.
const dateFormatter = new Intl.DateTimeFormat('fr-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

/** Date du jour telle que la voit un joueur français (la journée bascule à minuit à Paris). */
const localDate = (date = new Date()) => dateFormatter.format(date);

/** Nombre de jours écoulés depuis l'époque, à partir des dates calendaires. */
function dayIndex(dateString) {
    const toUtc = (value) => {
        const [year, month, day] = value.split('-').map(Number);
        return Date.UTC(year, month - 1, day);
    };
    return Math.floor((toUtc(dateString) - toUtc(EPOCH)) / 86400000);
}

// --- Générateur pseudo-aléatoire semé -----------------------------------
// xmur3 transforme une chaîne en graine 32 bits, mulberry32 la déroule.
// Deux fonctions courtes, déterministes, sans dépendance.
function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i += 1) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return () => {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return h >>> 0;
    };
}

function mulberry32(seed) {
    let a = seed;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle(list, seedString) {
    const random = mulberry32(xmur3(seedString)());
    const result = [...list];
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/** Instant du prochain minuit local, en tenant compte des changements d'heure. */
function nextResetAt(from = new Date()) {
    const today = localDate(from);
    const cursor = from.getTime();
    // Balayage à l'heure jusqu'au basculement de date, puis affinage à la minute.
    for (let hours = 1; hours <= 48; hours += 1) {
        const candidate = cursor + hours * 3600000;
        if (localDate(new Date(candidate)) !== today) {
            for (let minutes = 59; minutes >= 0; minutes -= 1) {
                const refined = candidate - minutes * 60000;
                if (localDate(new Date(refined)) !== today) return new Date(refined - (refined % 60000)).toISOString();
            }
            return new Date(candidate).toISOString();
        }
    }
    return new Date(cursor + 86400000).toISOString();
}

/**
 * Énigme du jour, réponse comprise. Usage interne au serveur uniquement.
 *
 * @param {string} mode   'letters' ou 'clues'
 * @param {Date}   date   instant de référence
 * @param {number} reroll compteur de relances pour cette date (0 = tirage normal)
 */
function getPuzzle(mode, date = new Date(), reroll = 0) {
    if (!isMode(mode)) throw new Error(`Mode Beatboxdle inconnu : ${mode}`);

    const candidates = pool(mode);
    if (candidates.length === 0) return null;

    const dateString = localDate(date);
    const index = dayIndex(dateString);
    const cycle = Math.floor(index / candidates.length);
    const position = ((index % candidates.length) + candidates.length) % candidates.length;

    // Sans relance, l'ordre est celui du cycle. Avec, cette date seule reçoit
    // son propre mélange : les autres jours ne bougent pas d'un cran.
    const seed = reroll > 0
        ? `${SEED}:${mode}:${cycle}:reroll-${reroll}:${dateString}`
        : `${SEED}:${mode}:${cycle}`;
    const order = shuffle(candidates, seed);

    return {
        mode,
        date: dateString,
        puzzleNumber: index + 1,
        reroll,
        cycle: cycle + 1,
        answer: order[position],
        maxAttempts: MODES[mode].maxAttempts,
        poolSize: candidates.length,
        nextResetAt: nextResetAt(date),
    };
}

/**
 * Version envoyée au client : tout sauf la réponse. La longueur du nom est
 * publique en mode lettres, c'est le gabarit de la grille. `reroll` l'est aussi :
 * c'est lui qui fait jeter aux navigateurs la grille devenue caduque.
 */
function getPublicPuzzle(mode, date = new Date(), reroll = 0) {
    const puzzle = getPuzzle(mode, date, reroll);
    if (!puzzle) return null;

    return {
        mode: puzzle.mode,
        date: puzzle.date,
        puzzleNumber: puzzle.puzzleNumber,
        reroll: puzzle.reroll,
        maxAttempts: puzzle.maxAttempts,
        poolSize: puzzle.poolSize,
        nextResetAt: puzzle.nextResetAt,
        length: mode === 'letters' ? puzzle.answer.length : null,
    };
}

module.exports = { MODES, isMode, localDate, dayIndex, nextResetAt, getPuzzle, getPublicPuzzle };