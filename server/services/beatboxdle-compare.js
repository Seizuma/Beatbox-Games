// server/services/beatboxdle-compare.js
//
// Le cœur du jeu : ce qui décide du gris, de l'orange et du vert.
// Volontairement côté serveur — un daily dont la réponse transite dans le
// navigateur dès le chargement se fait éventer en une ouverture d'onglet
// réseau. Le client ne reçoit que des couleurs.

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
    result.forEach((cell, index) => {
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
    value: label ?? guessValue ?? null,
    state: guessValue && guessValue === targetValue ? 'correct' : 'absent',
});

/**
 * Mode indices — quatre colonnes.
 *
 * Pays   : vert si même pays, orange si même continent.
 * Genre  : vert ou gris.
 * Catégorie : vert ou gris.
 * Titre  : vert si exactement le même titre, orange si titre de rang
 *          équivalent (champion GBB vs champion du monde), gris sinon.
 *          `direction` indique si le titre cherché est plus ou moins
 *          prestigieux, pour afficher une flèche.
 */
function compareClues(guess, target) {
    const titleState = (() => {
        if (!guess.bestTitle || !target.bestTitle) return 'absent';
        if (guess.bestTitle.id === target.bestTitle.id) return 'correct';
        return guess.bestTitle.tier === target.bestTitle.tier ? 'present' : 'absent';
    })();

    const titleDirection = (() => {
        if (!guess.bestTitle || !target.bestTitle) return null;
        if (target.bestTitle.tier > guess.bestTitle.tier) return 'up';
        if (target.bestTitle.tier < guess.bestTitle.tier) return 'down';
        return null;
    })();

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
        gender: exact(guess.gender, target.gender, guess.gender === 'F' ? 'Femme' : 'Homme'),
        category: exact(guess.category, target.category, guess.categoryLabel),
        title: {
            value: guess.bestTitle ? guess.bestTitle.label : null,
            state: titleState,
            direction: titleDirection,
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
        category: beatboxer.category,
        categoryLabel: beatboxer.categoryLabel,
        bestTitle: beatboxer.bestTitle,
        photo: beatboxer.photo,
        source: beatboxer.source,
    };
}

module.exports = { compareLetters, compareClues, revealAnswer };