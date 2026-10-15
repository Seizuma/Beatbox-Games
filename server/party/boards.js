/**
 * Plateaux de Beatbox Party.
 *
 * Un plateau est un graphe : chaque case a un type, une position sur la grille
 * isométrique (x, y) et la liste des cases suivantes. Une case avec deux
 * suivantes est un carrefour, où le joueur choisit sa route.
 *
 * Types de case :
 *   start  départ (rapporte comme une case bleue)
 *   blue   Applaudissement, +3 Hype
 *   red    Larsen, -3 Hype
 *   drop   Drop : déclenche l'événement du plateau
 * Propriétés facultatives :
 *   stage  la case longe la scène (Pot à pourboires)
 *   gate   passage payant du Videur (prix en Hype pour entrer sur cette route)
 */

// L'Open Mic : une boucle de 32 cases autour du bar, et le couloir des loges
// qui coupe par le milieu (6 cases au lieu de 16), gardé par le Videur.
function buildOpenMic() {
    const loop = [];
    for (let x = 1; x <= 11; x += 1) loop.push([x, 1]);   // haut, vers la droite
    for (let y = 2; y <= 7; y += 1) loop.push([11, y]);   // droite, vers le bas (la scène)
    for (let x = 10; x >= 1; x -= 1) loop.push([x, 7]);   // bas, vers la gauche
    for (let y = 6; y >= 2; y -= 1) loop.push([1, y]);    // gauche, vers le haut

    // 32 cases : départ, puis surtout des Applaudissements, quelques Larsen et Drops
    const pattern = 'sbbrbbdbbbrbbdbbrbbbdbrbbbbrbdbr';
    const spaces = loop.map(([x, y], index) => ({
        id: index,
        x,
        y,
        type: { s: 'start', b: 'blue', r: 'red', d: 'drop' }[pattern[index]],
        next: [(index + 1) % loop.length],
        stage: x === 11 && y >= 2 && y <= 6,
    }));

    // Couloir des loges : du carrefour (6,1) au retour sur la boucle en (6,7)
    const junction = spaces.find((space) => space.x === 6 && space.y === 1);
    const rejoin = spaces.find((space) => space.x === 6 && space.y === 7);
    const corridorTypes = ['red', 'drop', 'blue', 'red', 'blue'];
    const corridor = corridorTypes.map((type, i) => ({
        id: spaces.length + i,
        x: 6,
        y: 2 + i,
        type,
        next: [],
        corridor: true,
    }));
    corridor.forEach((space, i) => {
        space.next = [i < corridor.length - 1 ? corridor[i + 1].id : rejoin.id];
    });
    corridor[0].gate = 5;
    junction.next = [junction.next[0], corridor[0].id];
    spaces.push(...corridor);

    return {
        id: 'openmic',
        size: { w: 13, h: 9 },
        start: 0,
        starPrice: 15,
        // Cases où le Micro d'or peut apparaître
        starSpots: [3, 9, 15, 23, 29, 34],
        defaultTurns: 10,
        spaces,
        // Décor, pour le client : scène à droite, bar au centre-gauche, porte du Videur
        decor: [
            { kind: 'stage', x: 12.4, y: 4 },
            { kind: 'bar', x: 3.5, y: 4 },
            { kind: 'bouncer', x: 6.8, y: 1.9 },
            { kind: 'speaker', x: 12.2, y: 1.4 },
            { kind: 'speaker', x: 12.2, y: 6.6 },
            { kind: 'tables', x: 8.8, y: 4 },
        ],
    };
}

const BOARDS = {
    openmic: buildOpenMic(),
};

function getBoard(id) {
    return BOARDS[id] || BOARDS.openmic;
}

module.exports = { BOARDS, getBoard };
