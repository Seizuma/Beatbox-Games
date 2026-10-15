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
 *   drop   Drop : le joueur prend le micro géant (la scène)
 * Propriétés facultatives :
 *   stage  la case est devant le micro géant (pourboire au joueur qui a le micro)
 *   gate   passage payant de l'ingé son (prix en Hype pour entrer sur cette route)
 */

// Le Setup : des beatboxers miniatures sur le bureau d'un beatboxer, la nuit.
// La boucle de 32 cases passe sur la loopstation (en bas), la chaîne de pédales
// (à droite), devant le micro géant (en haut), sur le casque et le pad controller
// (à gauche). Le raccourci descend le fader master de la table de mixage, au centre ;
// l'ingé son le garde.
function buildSetup() {
    const loop = [
        // Loopstation : pads de pistes et boutons, de gauche à droite
        [310, 742, 'loop', 'track'], [380, 742, 'loop', 'button'], [450, 742, 'loop', 'track'], [520, 742, 'loop', 'button'],
        [590, 742, 'loop', 'track'], [660, 742, 'loop', 'button'], [730, 742, 'loop', 'track'], [800, 742, 'loop', 'button'],
        [870, 742, 'loop', 'track'], [940, 742, 'loop', 'button'],
        // Pédales d'effet, de bas en haut
        [1036, 702, 'pedal'], [1052, 632, 'pedal'], [1056, 562, 'pedal'], [1052, 492, 'pedal'], [1040, 422, 'pedal'],
        // Câble, puis la scène devant le micro géant, de droite à gauche
        [1000, 352, 'cable'], [930, 332, 'stage'], [865, 322, 'stage'], [800, 318, 'stage'], [735, 322, 'stage'], [670, 332, 'stage'],
        // Carrefour, puis le casque posé sur le bureau
        [592, 336, 'desk'], [512, 332, 'phones', 'cup'], [440, 292, 'phones', 'band'], [362, 292, 'phones', 'band'], [288, 334, 'phones', 'cup'],
        // Pad controller, de haut en bas, puis le câble USB qui ramène à la loopstation
        [212, 405, 'pads'], [212, 470, 'pads'], [212, 535, 'pads'], [206, 610, 'cable'], [206, 670, 'cable'], [240, 728, 'cable'],
    ];

    // 32 cases : départ, puis surtout des Applaudissements, quelques Larsen et Drops
    const pattern = 'sbbrbbdbbbrbbdbbrbbbdbrbbbbrbdbr';
    const spaces = loop.map(([x, y, zone, kind], index) => ({
        id: index,
        x,
        y,
        zone,
        kind: kind || 'button',
        type: { s: 'start', b: 'blue', r: 'red', d: 'drop' }[pattern[index]],
        next: [(index + 1) % loop.length],
        stage: zone === 'stage',
    }));

    // Raccourci : le fader master de la table de mixage, du carrefour (21) à la piste 3 (4)
    const junction = spaces[21];
    const rejoin = spaces[4];
    const corridorTypes = ['red', 'drop', 'blue', 'red', 'blue'];
    const corridorY = [400, 464, 528, 606, 672];
    const corridor = corridorTypes.map((type, i) => ({
        id: spaces.length + i,
        x: 592,
        y: corridorY[i],
        zone: i < 3 ? 'mixer' : 'loop',
        kind: i < 3 ? 'fader' : 'button',
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
        id: 'setup',
        size: { w: 1280, h: 880 },
        start: 0,
        starPrice: 15,
        // Cases où le Micro d'or peut apparaître
        starSpots: [3, 9, 13, 23, 28, 34],
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
