import { uniqueNamesGenerator, adjectives, animals } from 'unique-names-generator';

// Le serveur refuse les pseudos de plus de 20 caractères : un tirage trop long
// (« Contemporary-Silkworm ») faisait échouer l'entrée par lien sans explication.
// On vise même plus court, pour que le nom tienne en entier sur un pupitre.
const SERVER_MAX_LENGTH = 20;
const PREFERRED_MAX_LENGTH = 14;
const MAX_ATTEMPTS = 30;

const draw = () => uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    length: 2,
    separator: '-',
    style: 'capital'
});

export function getRandomPseudo() {
    let shortest = draw();
    for (let attempt = 0; attempt < MAX_ATTEMPTS && shortest.length > PREFERRED_MAX_LENGTH; attempt += 1) {
        const candidate = draw();
        if (candidate.length < shortest.length) shortest = candidate;
    }
    return shortest.slice(0, SERVER_MAX_LENGTH);
}