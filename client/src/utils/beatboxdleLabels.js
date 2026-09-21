// client/src/utils/beatboxdleLabels.js
//
// Traduction des valeurs d'indices.
//
// Le serveur n'envoie que des identifiants : FR, EU, wbc-champion, crew. Les
// libellés visibles se calculent ici, dans la langue courante — sinon la base
// fige une langue et le site bilingue ment à la moitié de ses joueurs.

/** Nom du pays dans la langue du site. Intl connaît les 250 codes, pas nous. */
export function countryName(language, code) {
    if (!code) return null;
    try {
        return new Intl.DisplayNames([language], { type: 'region' }).of(code);
    } catch (error) {
        return code;
    }
}

export const continentName = (t, code) => (code ? t(`beatboxdle.continents.${code}`) : null);

export const titleName = (t, id) => (id ? t(`beatboxdle.titles.${id}`) : null);

/**
 * Forme courte, pour la case de la grille : « Quart de finaliste au
 * championnat du monde » tient sur cinq lignes dans 68 px de large. La forme
 * longue reste sur la fiche de réponse, où la place ne manque pas.
 */
export const titleShortName = (t, id) => (id ? t(`beatboxdle.titlesShort.${id}`) : null);

export const categoryName = (t, id) => (id ? t(`beatboxdle.categories.${id}`) : null);

export const genderName = (t, value) => {
    if (value === 'M') return t('beatboxdle.clues.male');
    if (value === 'F') return t('beatboxdle.clues.female');
    return null;
};