import { uniqueNamesGenerator, adjectives, animals } from 'unique-names-generator';

export function getRandomPseudo() {
    return uniqueNamesGenerator({
        dictionaries: [adjectives, animals],
        length: 2,
        separator: '-',
        style: 'capital'
    });
}
