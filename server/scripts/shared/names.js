// server/scripts/shared/names.js
//
// Comparer des noms de beatboxers venus de quatre sources (Google Sheet,
// beatboxers.json, beatbox.world, wiki) : « Max0 », « MaxO », « MAXO » sont
// la même personne, « D-Low » et « D Low » aussi.

/** Lettres et chiffres seulement, accents retirés, en minuscules. */
const normalizeName = (name) =>
    String(name || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

/**
 * Version tolérante : confond aussi 0/o et 1/l/i, fréquents dans les pseudos
 * (Max0 / MaxO). Ne sert qu'à rapprocher des candidats, jamais à fusionner
 * deux entrées sans contrôle humain.
 */
const looseName = (name) =>
    normalizeName(name)
        .replace(/0/g, 'o')
        .replace(/[1!|]/g, 'l')
        .replace(/i/g, 'l');

/**
 * Nom de fichier d'image du Buzzer Battle, identique à title_to_filename()
 * de scan_images.py : les deux doivent produire le même nom, sinon le script
 * Python ne retrouve pas les photos validées depuis l'administration.
 */
const titleToFilename = (title) =>
    String(title || '')
        .replace(/\. /g, '_')
        .replace(/, /g, '_')
        .replace(/\./g, '_')
        .replace(/'/g, '_')
        .replace(/ /g, '_')
        .replace(/-/g, '_')
        .replace(/:/g, '_');

/** Identifiant de dossier sûr (pas de / ni de ..), stable pour un même nom. */
const reviewKey = (name) => {
    const base = String(name || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    // Un nom fait uniquement de symboles (« ¥€$ ») donnerait une clé vide.
    if (base) return base.slice(0, 60);
    return `x-${Buffer.from(String(name)).toString('hex').slice(0, 40)}`;
};

/** Slug façon beatbox.world : « Bookie Blanco » -> « bookie-blanco ». */
const guessSlug = (name) =>
    String(name || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

module.exports = { normalizeName, looseName, titleToFilename, reviewKey, guessSlug };
