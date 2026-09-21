// server/services/beatboxdle-compare.js
//
// Le cœur du jeu : ce qui décide du gris, de l'orange et du vert.
// Volontairement côté serveur — un daily dont la réponse transite dans le
// navigateur dès le chargement se fait éventer en une ouverture d'onglet
// réseau. Le client ne reçoit que des couleurs.

// Tolérance de l'orange sur la première apparition. Deux ans de part et
// d'autre : assez large pour signaler une génération, assez étroit pour que
// l'orange reste une information (mesuré à ~18 % des paires sur la base).
const YEAR_TOLERANCE = 2;

/**
 * Mode lettres — coloration façon Wordle, en deux passes.
 *
 * La deuxième passe est ce qui distingue une implémentation correcte d'une
 * approximative : un « A » proposé en trop alors que la réponse n'en contient
 * qu'un seul, déjà placé, doit rester gris. On compte donc les lettres restant
 * disponibles après avoir figé les verts.
 *
 * @param {string} guess  nom proposé, déjà réduit à A-Z
 * @param {string} target nom cherché, déjà réduit à A-Z
 * @returns {{letter: string, state: 'correct'|'present'|'absent'}[]}
 */
function compareLetters(guess, target) {
    const result = guess.split('').map((letter) => ({ letter, state: 'absent' }));
    const remaining = new Map();

    // Passe 1 : les bien placées.
    guess.split('').forEach((letter, index) => {
        if (letter === target[index]) {
            result[index].state = 'correct';
        } else {
            const targetLetter = target[index];
            remaining.set(targetLetter, (remaining.get(targetLetter) || 0) + 1);
        }
    });

    // Passe 2 : les présentes mal placées, dans la limite du stock restant.
    result.forEach((cell) => {
        if (cell.state === 'correct') return;
        const available = remaining.get(cell.letter) || 0;
        if (available > 0) {
            cell.state = 'present';
            remaining.set(cell.letter, available - 1);
        }
    });

    return result;
}

/** Vert / gris simple. */
const exact = (guessValue, targetValue, label) => ({
    value: label !== undefined ? label : (guessValue !== undefined ? guessValue : null),
    state: guessValue && guessValue === targetValue ? 'correct' : 'absent',
});

/** Flèche : elle pointe vers la réponse, jamais vers la proposition. */
const directionOf = (guessValue, targetValue) => {
    if (guessValue == null || targetValue == null) return null;
    if (targetValue > guessValue) return 'up';
    if (targetValue < guessValue) return 'down';
    return null;
};

/**
 * Mode indices — quatre colonnes.
 *
 * Pays     : vert si même pays, orange si même continent.
 * Genre    : vert ou gris.
 * Première apparition : vert si même année, orange à ±2 ans, flèche vers la
 *            réponse. Cette colonne a remplacé « catégorie principale », qui
 *            répondait « solo » pour 89 % de la base et n'apprenait rien.
 * Meilleur titre : vert si exactement le même titre, orange si titre de rang
 *            équivalent (champion GBB vs champion du monde), gris sinon, avec
 *            une flèche vers le rang cherché.
 */
function compareClues(guess, target) {
    const titleState = (() => {
        if (!guess.bestTitle || !target.bestTitle) return 'absent';
        if (guess.bestTitle.id === target.bestTitle.id) return 'correct';
        return guess.bestTitle.tier === target.bestTitle.tier ? 'present' : 'absent';
    })();

    const yearGap = guess.firstYear != null && target.firstYear != null
        ? Math.abs(guess.firstYear - target.firstYear)
        : null;

    return {
        country: {
            value: guess.country,
            countryCode: guess.countryCode,
            state:
                guess.countryCode && guess.countryCode === target.countryCode
                    ? 'correct'
                    : guess.continent && guess.continent === target.continent
                        ? 'present'
                        : 'absent',
        },
        gender: exact(guess.gender, target.gender, guess.gender === 'F' ? 'F' : 'M'),
        firstYear: {
            value: guess.firstYear,
            state: yearGap === 0 ? 'correct' : (yearGap !== null && yearGap <= YEAR_TOLERANCE) ? 'present' : 'absent',
            direction: directionOf(guess.firstYear, target.firstYear),
        },
        title: {
            value: guess.bestTitle ? guess.bestTitle.label : null,
            state: titleState,
            direction: guess.bestTitle && target.bestTitle
                ? directionOf(guess.bestTitle.tier, target.bestTitle.tier)
                : null,
        },
    };
}

/** Ce que le client reçoit une fois la partie terminée (trouvé ou épuisé). */
function revealAnswer(beatboxer) {
    return {
        slug: beatboxer.slug,
        name: beatboxer.name,
        country: beatboxer.country,
        countryCode: beatboxer.countryCode,
        gender: beatboxer.gender,
        firstYear: beatboxer.firstYear,
        lastYear: beatboxer.lastYear,
        category: beatboxer.category,
        categoryLabel: beatboxer.categoryLabel,
        bestTitle: beatboxer.bestTitle,
        photo: beatboxer.photo,
        source: beatboxer.source,
    };
}

module.exports = { compareLetters, compareClues, revealAnswer, YEAR_TOLERANCE };