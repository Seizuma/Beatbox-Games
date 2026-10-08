// server/services/beatboxdle-compare.js
//
// Le cœur du jeu : ce qui décide du gris, de l'orange et du vert.
// Volontairement côté serveur — un daily dont la réponse transite dans le
// navigateur dès le chargement se fait éventer en une ouverture d'onglet
// réseau. Le client ne reçoit que des couleurs.
//
// Règle d'or de ce fichier : il ne renvoie JAMAIS de texte affichable, que des
// identifiants (FR, EU, wbc-champion, crew). Le site est bilingue ; un libellé
// calculé ici serait figé dans une langue pour tout le monde.

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
 * Pays     : vert si même pays, orange si même continent. Le continent part
 *            avec la case : sur un orange, « Royaume-Uni » seul ne dit pas au
 *            joueur CE QUI est commun, il faut le lui écrire.
 * Genre    : vert ou gris.
 * Première apparition : vert si même année, orange à ±2 ans, flèche vers la
 *            réponse. Cette colonne a remplacé « catégorie principale », qui
 *            répondait « solo » pour 89 % de la base et n'apprenait rien.
 * Meilleur titre : vert si exactement le même titre (champion national de
 *            Bulgarie = champion national de Bulgarie), orange si même rang
 *            ailleurs — même niveau et même placement : champion GBB vs
 *            champion du monde, champion de Bulgarie vs champion de France —,
 *            gris sinon, avec une flèche vers le prestige cherché. La
 *            discipline et le lieu voyagent avec le titre : « champion du
 *            monde » en crew et en solo ne veut pas dire la même chose pour
 *            qui cherche la réponse.
 */
// `key` distingue les titres régionaux (national-champion:BG) ; les bases
// construites avant le palmarès élargi n'ont que `id`.
const titleKey = (title) => (title ? title.key || title.id : null);

// Le GBB et le championnat du monde sont un seul niveau : « mondial ».
const LEVEL_GROUPS = { wbc: 'world', gbb: 'world' };

/**
 * Rang d'un titre : niveau + placement, sans le lieu. Déduit de l'identifiant
 * (« national-runner-up » -> national / runner-up), présent dans tous les
 * formats de base, anciens compris.
 */
function titleRank(title) {
    const id = title && title.id;
    if (!id) return null;
    const [level, ...placement] = id.split('-');
    return `${LEVEL_GROUPS[level] || level}:${placement.join('-')}`;
}

// Départage de deux titres au prestige égal mais de rangs différents
// (champion d'Europe 70 / finaliste GBB 70) : le niveau de l'événement.
const LEVEL_ORDER = { world: 5, continental: 4, intl: 3, national: 2, other: 1 };

/**
 * Flèche du titre : vers le prestige cherché. À prestige égal et rang
 * différent, le niveau départage, sinon le joueur verrait un gris sans
 * direction. À rang égal (orange), pas de flèche : c'est le lieu qui diffère.
 */
function titleDirection(guess, target) {
    const byTier = directionOf(guess.tier, target.tier);
    if (byTier || titleRank(guess) === titleRank(target)) return byTier;
    const level = (title) => LEVEL_ORDER[(titleRank(title) || '').split(':')[0]] || 0;
    return directionOf(level(guess), level(target));
}

function compareClues(guess, target) {
    const titleState = (() => {
        if (!guess.bestTitle || !target.bestTitle) return 'absent';
        if (titleKey(guess.bestTitle) === titleKey(target.bestTitle)) return 'correct';
        // Un rang égal par coïncidence de score (continental 70 = finaliste mondial 70)
        // n'est pas un titre équivalent : seul le rang compte pour l'orange.
        return titleRank(guess.bestTitle) === titleRank(target.bestTitle) ? 'present' : 'absent';
    })();

    const yearGap = guess.firstYear != null && target.firstYear != null
        ? Math.abs(guess.firstYear - target.firstYear)
        : null;

    const sameCountry = Boolean(guess.countryCode) && guess.countryCode === target.countryCode;
    const sameContinent = Boolean(guess.continent) && guess.continent === target.continent;

    return {
        country: {
            code: guess.countryCode || null,
            continent: guess.continent || null,
            state: sameCountry ? 'correct' : sameContinent ? 'present' : 'absent',
        },
        gender: {
            value: guess.gender || null,
            state: guess.gender && guess.gender === target.gender ? 'correct' : 'absent',
        },
        firstYear: {
            value: guess.firstYear != null ? guess.firstYear : null,
            state: yearGap === 0 ? 'correct' : (yearGap !== null && yearGap <= YEAR_TOLERANCE) ? 'present' : 'absent',
            direction: directionOf(guess.firstYear, target.firstYear),
        },
        title: {
            id: guess.bestTitle ? guess.bestTitle.id : null,
            discipline: guess.bestTitle ? guess.bestTitle.discipline || null : null,
            // Codes et nom propre seulement : le libellé se fait côté client.
            region: guess.bestTitle ? guess.bestTitle.region || null : null,
            regionType: guess.bestTitle ? guess.bestTitle.regionType || null : null,
            event: guess.bestTitle ? guess.bestTitle.event || null : null,
            count: guess.bestTitle ? guess.bestTitle.count || 1 : null,
            state: titleState,
            direction: guess.bestTitle && target.bestTitle && titleState !== 'correct'
                ? titleDirection(guess.bestTitle, target.bestTitle)
                : null,
        },
    };
}

/** Ce que le client reçoit une fois la partie terminée (trouvé ou épuisé). */
function revealAnswer(beatboxer) {
    return {
        slug: beatboxer.slug,
        name: beatboxer.name,
        countryCode: beatboxer.countryCode,
        continent: beatboxer.continent,
        gender: beatboxer.gender,
        firstYear: beatboxer.firstYear,
        lastYear: beatboxer.lastYear,
        category: beatboxer.category,
        bestTitle: beatboxer.bestTitle,
        photo: beatboxer.photo,
        source: beatboxer.source,
    };
}

module.exports = { compareLetters, compareClues, revealAnswer, titleRank, YEAR_TOLERANCE };