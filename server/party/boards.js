/**
 * Plateaux de Beatbox Party.
 *
 * Un plateau est un graphe : chaque case a un type, une position (x, y) en pixels
 * du décor dessiné par le client, une zone (l'appareil sur lequel elle se trouve)
 * et la liste des cases suivantes. Une case avec deux suivantes est un carrefour,
 * où le joueur choisit sa route.
 *
 * Types de case :
 *   start  départ (rapporte comme une case bleue)
 *   blue   Applaudissement, +3 Hype
 *   red    Larsen, -3 Hype
 *   drop   Drop : le joueur prend la main sur la loopstation
 * Propriétés facultatives :
 *   big    gros pad de piste (track = 1 à 5)
 *   stage  pourboire au joueur qui a le Drop quand on passe dessus
 *   gate   passage payant de l'ingé son (prix en Hype pour entrer sur cette route)
 */

// La loopstation (façon RC-505 MK2) posée sur la scène d'une battle : c'est elle, le plateau.
// Coordonnées du monde : l'appareil occupe x 312..1687, y 420..1145 (vu de dessus, y vers
// le public). Les positions ci-dessous sont celles de l'appareil (dessinées au 1/1,25)
// puis converties. La boucle part en bas à gauche, longe les 5 gros pads de piste,
// remonte à droite, revient sous l'écran LCD et redescend à gauche. Le raccourci passe
// sur le fader de la piste 3 ; l'ingé son le garde.
const DEVICE = { x: 312, y: 420, scale: 1.25 };
const at = (x, y) => [Math.round(DEVICE.x + x * DEVICE.scale), Math.round(DEVICE.y + y * DEVICE.scale)];

function buildSetup() {
    const T = 470; // rangée des pads de piste
    const TOP = 205; // rangée sous l'écran
    const loop = [
        [30, T, 'start'],
        [158, T, 'blue', 1], [256, T, 'blue'], [354, T, 'red', 2], [452, T, 'red'], [550, T, 'blue', 3],
        [648, T, 'blue'], [746, T, 'drop', 4], [844, T, 'blue'], [942, T, 'blue', 5], [1070, T, 'blue'],
        [1070, 380, 'red'], [1070, 292, 'blue'],
        [1070, TOP, 'drop'], [966, TOP, 'blue'], [862, TOP, 'blue'], [758, TOP, 'red'], [654, TOP, 'blue'],
        [550, TOP, 'blue'], [446, TOP, 'blue'], [342, TOP, 'red'], [238, TOP, 'blue'], [134, TOP, 'drop'],
        [30, TOP, 'blue'], [30, 292, 'blue'], [30, 380, 'red'],
    ];
    const spaces = loop.map(([lx, ly, type, track], index) => {
        const [x, y] = at(lx, ly);
        return {
            id: index,
            x,
            y,
            type,
            // Les 5 gros pads de piste : le joueur qui a le Drop y touche un pourboire
            big: Boolean(track),
            track: track || null,
            stage: Boolean(track),
            next: [(index + 1) % loop.length],
        };
    });

    // Raccourci : du milieu de la rangée du haut (18), par le fader de la piste 3, jusqu'au pad 3 (5)
    const junction = spaces[18];
    const rejoin = spaces[5];
    const corridor = [[480, 282, 'red'], [480, 360, 'drop']].map(([lx, ly, type], i) => {
        const [x, y] = at(lx, ly);
        return { id: spaces.length + i, x, y, type, big: false, track: null, stage: false, next: [], corridor: true };
    });
    corridor.forEach((space, i) => {
        space.next = [i < corridor.length - 1 ? corridor[i + 1].id : rejoin.id];
    });
    corridor[0].gate = 5;
    junction.next = [junction.next[0], corridor[0].id];
    spaces.push(...corridor);

    return {
        id: 'setup',
        size: { w: 2000, h: 1800 },
        device: { x: DEVICE.x, y: DEVICE.y, w: Math.round(1100 * DEVICE.scale), d: Math.round(580 * DEVICE.scale) },
        start: 0,
        starPrice: 15,
        // Cases où le Micro d'or peut apparaître
        starSpots: [4, 8, 12, 16, 21, 24],
        defaultTurns: 10,
        spaces,
    };
}

const BOARDS = {
    setup: buildSetup(),
};

function getBoard(id) {
    return BOARDS[id] || BOARDS.setup;
}

module.exports = { BOARDS, getBoard };
