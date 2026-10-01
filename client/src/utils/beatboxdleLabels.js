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

// Un titre arrive soit sous forme d'objet ({ id, region, count… }), soit, dans
// les anciennes bases, réduit à son identifiant.
const titleId = (title) => (typeof title === 'string' ? title : title?.id || null);
const withCount = (label, title) => (label && title?.count > 1 ? `${label} ×${title.count}` : label);

/**
 * Où le titre a été gagné : pays (champion national), continent (champion
 * d'Europe) ou nom de l'événement (grands battles internationaux). Rien pour
 * le GBB et le championnat du monde, dont le nom dit déjà tout.
 */
export function titlePlace(t, language, title) {
    if (!title || typeof title === 'string') return null;
    if (title.regionType === 'country') return countryName(language, title.region);
    if (title.regionType === 'continent') return continentName(t, title.region);
    if (title.regionType === 'event') return title.event || null;
    return null;
}

/** Forme longue, pour la fiche de réponse : « Champion national — Bulgarie ×3 ». */
export function titleName(t, title, language) {
    const id = titleId(title);
    if (!id) return null;
    const place = titlePlace(t, language, title);
    const label = t(`beatboxdle.titles.${id}`);
    return withCount(place ? `${label} — ${place}` : label, title);
}

/**
 * Forme courte, pour la case de la grille : « Quart de finaliste au
 * championnat du monde » tient sur cinq lignes dans 68 px de large. La forme
 * longue reste sur la fiche de réponse, où la place ne manque pas. Le lieu
 * part en précision sous la valeur (voir titlePlace).
 */
export const titleShortName = (t, title) => {
    const id = titleId(title);
    return id ? withCount(t(`beatboxdle.titlesShort.${id}`), title) : null;
};

export const categoryName = (t, id) => (id ? t(`beatboxdle.categories.${id}`) : null);

export const genderName = (t, value) => {
    if (value === 'M') return t('beatboxdle.clues.male');
    if (value === 'F') return t('beatboxdle.clues.female');
    return null;
};