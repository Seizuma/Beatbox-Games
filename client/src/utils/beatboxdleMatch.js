// client/src/utils/beatboxdleMatch.js
//
// Correspondance entre ce que le joueur tape au clavier du Beatboxdle et les
// noms proposables. Même réduction que la base (scripts/beatboxdle/builder.js,
// toLetters) : accents retirés, majuscules, lettres seules. Le mode indices
// garde aussi les chiffres, sinon « Zer0 » ou « 8384 » seraient introuvables.

export const toKeys = (name, withDigits = false) =>
    String(name || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(withDigits ? /[^A-Z0-9]/g : /[^A-Z]/g, '');

/** Index « touches → noms », calculé une fois par liste de candidats. */
export function buildKeyIndex(names, withDigits = false) {
    return (names || []).map((name) => ({ name, keys: toKeys(name, withDigits) }));
}

/**
 * Noms qui commencent par la saisie, puis ceux qui la contiennent (à partir de
 * deux touches), dans l'ordre alphabétique de la liste.
 */
export function suggest(typed, index, limit = 6) {
    if (!typed) return [];
    const starts = [];
    const contains = [];
    index.forEach(({ name, keys }) => {
        if (keys.startsWith(typed)) starts.push(name);
        else if (typed.length >= 2 && keys.includes(typed)) contains.push(name);
    });
    return [...starts, ...contains].slice(0, limit);
}

/** Noms dont les touches correspondent exactement à la saisie. */
export function exactMatches(typed, index) {
    if (!typed) return [];
    return index.filter(({ keys }) => keys === typed).map(({ name }) => name);
}

const RANK = { absent: 1, present: 2, correct: 3 };

/** Meilleur état connu de chaque lettre, d'après les essais du mode lettres. */
export function letterStates(guesses) {
    const states = {};
    (guesses || []).forEach((guess) => {
        (guess.result || []).forEach(({ letter, state }) => {
            const key = String(letter || '').toUpperCase();
            if (!key) return;
            if (!states[key] || RANK[state] > RANK[states[key]]) states[key] = state;
        });
    });
    return states;
}
