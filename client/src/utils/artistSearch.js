// Recherche d'artistes tolérante : accents, majuscules, espaces et ponctuation ignorés
// (« reeps one », « Reeps-One » et « REEPSONE » désignent le même artiste)

export const normalizeArtistName = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Nom exact de la liste correspondant à la saisie, ou null
export function findArtist(query, artists) {
    const needle = normalizeArtistName(query);
    if (!needle) return null;
    return artists.find((artist) => normalizeArtistName(artist) === needle) || null;
}

/**
 * Suggestions classées :
 * 1. le nom commence par la saisie
 * 2. un des mots du nom commence par la saisie
 * 3. le nom contient la saisie
 */
export function rankArtists(query, artists, limit = 6) {
    const needle = normalizeArtistName(query);
    if (!needle) return [];

    const scored = [];
    artists.forEach((artist) => {
        const normalized = normalizeArtistName(artist);
        let score = -1;

        if (normalized.startsWith(needle)) {
            score = 0;
        } else if (String(artist).split(/[\s\-_'.]+/).some((word) => normalizeArtistName(word).startsWith(needle))) {
            score = 1;
        } else if (normalized.includes(needle)) {
            score = 2;
        }

        if (score >= 0) scored.push({ artist, score });
    });

    return scored
        .sort((a, b) => a.score - b.score || a.artist.localeCompare(b.artist, 'fr', { sensitivity: 'base' }))
        .slice(0, limit)
        .map((entry) => entry.artist);
}

// Découpe le nom pour mettre en gras la partie saisie (quand elle est contiguë dans le nom)
export function splitMatch(name, query) {
    const text = String(name);
    const needle = String(query || '').trim();
    if (!needle) return [{ text, match: false }];

    const plain = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const index = plain(text).indexOf(plain(needle));
    if (index < 0) return [{ text, match: false }];

    return [
        { text: text.slice(0, index), match: false },
        { text: text.slice(index, index + needle.length), match: true },
        { text: text.slice(index + needle.length), match: false },
    ].filter((part) => part.text);
}