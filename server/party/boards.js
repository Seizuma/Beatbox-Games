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
        // Loopstation : pads de pistes et boutons STOP, de gauche à droite
        [403, 965, 'loop', 'track'], [494, 965, 'loop', 'stop'], [585, 965, 'loop', 'track'], [676, 965, 'loop', 'stop'],
        [767, 965, 'loop', 'track'], [858, 965, 'loop', 'stop'], [949, 965, 'loop', 'track'], [1040, 965, 'loop', 'stop'],
        [1131, 965, 'loop', 'track'], [1222, 965, 'loop', 'stop'],
        // Pédales d'effet, de bas en haut
        [1347, 913, 'pedal'], [1368, 822, 'pedal'], [1373, 731, 'pedal'], [1368, 640, 'pedal'], [1352, 549, 'pedal'],
        // Câble, puis la scène devant le micro géant, de droite à gauche
        [1300, 458, 'cable'], [1209, 432, 'stage'], [1125, 419, 'stage'], [1040, 413, 'stage'], [956, 419, 'stage'], [871, 432, 'stage'],
        // Carrefour, puis le casque posé sur le bureau
        [767, 437, 'desk'], [666, 432, 'phones', 'cup'], [572, 380, 'phones', 'band'], [471, 380, 'phones', 'band'], [374, 434, 'phones', 'cup'],
        // Pad controller, de haut en bas, puis le câble USB qui ramène à la loopstation
        [276, 527, 'pads'], [276, 611, 'pads'], [276, 696, 'pads'], [268, 793, 'cable'], [268, 871, 'cable'], [312, 946, 'cable'],
    ];

    // 32 cases : départ, puis surtout des Applaudissements, quelques Larsen et Drops
    const pattern = 'sbbrbbdbbbrbbdbbrbbbdbrbbbbrbdbr';
    const spaces = loop.map(([x, y, zone, kind], index) => ({
        id: index,
        x,
        y,
        zone,
        kind: kind || 'pad',
        type: { s: 'start', b: 'blue', r: 'red', d: 'drop' }[pattern[index]],
        next: [(index + 1) % loop.length],
        stage: zone === 'stage',
    }));

    // Raccourci : le fader master de la table de mixage, du carrefour (21) à la piste 3 (4)
    const junction = spaces[21];
    const rejoin = spaces[4];
    const corridorTypes = ['red', 'drop', 'blue', 'red', 'blue'];
    const corridorY = [520, 603, 686, 788, 874];
    const corridor = corridorTypes.map((type, i) => ({
        id: spaces.length + i,
        x: 767,
        y: corridorY[i],
        zone: i < 3 ? 'mixer' : 'loop',
        kind: 'pad',
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
        size: { w: 1664, h: 1144 },
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
