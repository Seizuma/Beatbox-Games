/**
 * Plateaux de Beatbox Party.
 *
 * Un plateau est un graphe : chaque case a un type, une position (x, y) en pixels
 * du décor dessiné par le client, une zone (l'appareil sur lequel elle se trouve)
 * et la liste des cases suivantes. Une case avec deux suivantes est un carrefour,
 * où le joueur choisit sa route.
 *
 * Types de case :
 *   start      départ (rapporte comme une case bleue)
 *   blue       Applaudissement, +3 Hype
 *   red        Larsen, -3 Hype
 *   drop       Drop : le joueur prend la main sur les 5 pistes de la loopstation
 *   sample     Sample ? : un évènement de la scène, tiré au sort
 *   freestyle  Freestyle ! : la roue des échanges (qui donne quoi à qui)
 *   cut        Coupure : l'ingé son coupe le son (pertes, selon le rang)
 *   battle     Battle : chacun mise, mini-jeu immédiat, 70 % / 30 % du pot
 * Propriétés facultatives :
 *   big    gros pad de piste (track = 1 à 5) : s'y arrêter enregistre sa boucle sur la piste,
 *          passer sur la piste d'un autre lui donne un pourboire
 *   gate   passage payant de l'ingé son (prix en Hype pour entrer sur cette route)
 *   place  lieu de passage : le joueur s'y arrête en passant, sans user de pas
 *          (thief : la loge du voleur de flow ; shop : le stand de merch)
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
    // [x, y, type, piste, lieu]
    const loop = [
        [30, T, 'start'],
        [158, T, 'blue', 1], [256, T, 'blue'], [354, T, 'blue', 2], [452, T, 'sample'], [550, T, 'blue', 3],
        [648, T, 'battle'], [746, T, 'drop', 4], [844, T, 'blue'], [942, T, 'blue', 5], [1070, T, 'red'],
        [1070, 380, 'sample'], [1070, 292, 'blue', null, 'shop'],
        [1070, TOP, 'drop'], [966, TOP, 'blue'], [862, TOP, 'freestyle'], [758, TOP, 'red'], [654, TOP, 'blue'],
        [550, TOP, 'blue'], [446, TOP, 'cut'], [342, TOP, 'blue'], [238, TOP, 'sample'], [134, TOP, 'battle'],
        [30, TOP, 'blue'], [30, 292, 'blue', null, 'thief'], [30, 380, 'red'],
    ];
    const spaces = loop.map(([lx, ly, type, track, place], index) => {
        const [x, y] = at(lx, ly);
        return {
            id: index,
            x,
            y,
            type,
            big: Boolean(track),
            track: track || null,
            place: place || null,
            next: [(index + 1) % loop.length],
        };
    });

    // Raccourci : du milieu de la rangée du haut (18), par le fader de la piste 3, jusqu'au pad 3 (5)
    const junction = spaces[18];
    const rejoin = spaces[5];
    const corridor = [[480, 282, 'red'], [480, 360, 'drop']].map(([lx, ly, type], i) => {
        const [x, y] = at(lx, ly);
        return { id: spaces.length + i, x, y, type, big: false, track: null, place: null, next: [], corridor: true };
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
        starPrice: 20,
        // Cases où le Micro d'or peut apparaître (jamais sur un lieu de passage)
        starSpots: [2, 8, 14, 17, 20, 23],
        // La loge du voleur de flow, au bord de la scène, à côté de la case 24
        thief: { spaceId: 24, hypeCost: 5, micCost: 45, x: at(-58, 292)[0], y: at(-58, 292)[1] },
        // Le stand de merch, de l'autre côté, à côté de la case 12
        shop: { spaceId: 12, x: at(1158, 292)[0], y: at(1158, 292)[1] },
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
