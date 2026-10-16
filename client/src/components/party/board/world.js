// Le monde de Beatbox Party : une loopstation géante façon RC-505 MK2 posée sur la scène
// d'une battle. Le moteur (stage3d.js) le filme en Mode 7 : sol et dessus de l'appareil
// sont des plans texturés, tout ce qui dépasse (potards, touches, faders, pads, cases)
// est un objet en relief dessiné à part, avec sa tranche.
//
// Coordonnées du monde : x vers la droite, y vers le public (vers la caméra), h en hauteur.
// L'appareil est dessiné à l'échelle 1/1,25 (coordonnées « locales ») puis agrandi.

import { OUT, R, E, RR, ring, line, dither, pixText, silk, makeCanvas, hexMix, hash } from './pix';

export const SCALE = 1.25;
export const DEVICE = { x: 312, y: 420, w: 1375, d: 725, h: 90 };
export const LOCAL = { w: 1100, d: 580 };
export const FLOOR = { x: -600, y: 140, w: 3200, d: 1900, scale: 2 };
export const WALL = { y: 140, x: -1000, w: 4000, h: 760, scale: 2 };

export const toWorld = (lx, ly) => [DEVICE.x + lx * SCALE, DEVICE.y + ly * SCALE];
export const toLocal = (x, y) => [(x - DEVICE.x) / SCALE, (y - DEVICE.y) / SCALE];

export const C = {
    body: '#1c1c21', body2: '#212127', bevel: '#38383f', side: '#111114', side2: '#1d1d23',
    silk: '#d8d8dc', silkDim: '#85858d',
    red: '#ff3b30', redDim: '#4a1410', redBtn: '#b8262a', redBtnHi: '#ff5145',
    green: '#33e07a', greenDim: '#0f3a22', greenBtn: '#1a8f4c', greenBtnHi: '#47f08f',
    pink: '#ff5f9e', blue: '#3f8cff', blueDim: '#10264a', amber: '#ffb21e', amberDim: '#4a3208',
    lcd: '#a7c9ef', lcdHi: '#cfe3fa', lcdInk: '#0f2240',
};

/**
 * Cases : couleur de l'anneau de LED, et au centre une forme propre à chaque type avec un
 * gros pictogramme blanc (on les distingue même sans voir les couleurs).
 */
const COMMON = {
    sample: { ring: '#b46cff', dim: '#2c1a44', light: '#dcb8ff' },
    cut: { ring: '#c9c9d4', dim: '#2a2a32', light: '#ffffff', fill: '#3a3a46' },
};
const PALETTES = {
    standard: {
        blue: { ring: C.blue, dim: C.blueDim, light: '#a9cdff' },
        red: { ring: C.red, dim: C.redDim, light: '#ff9d92' },
        drop: { ring: C.green, dim: C.greenDim, light: '#9dffc4' },
        freestyle: { ring: '#ffd23a', dim: '#4a3a08', light: '#fff0a8' },
        battle: { ring: '#f08a24', dim: '#4a2608', light: '#ffc590' },
        ...COMMON,
    },
    // Couleurs adaptées (daltonisme rouge-vert) : bleu, orange, cyan ; les formes font le reste
    adapted: {
        blue: { ring: '#3f8cff', dim: '#10264a', light: '#a9cdff' },
        red: { ring: '#ff8a1f', dim: '#4a2a08', light: '#ffc48a' },
        drop: { ring: '#2fd0dc', dim: '#0b3a3e', light: '#a8f3fa' },
        freestyle: { ring: '#ff6fb5', dim: '#4a1430', light: '#ffc0de' },
        battle: { ring: '#f5e04a', dim: '#4a420a', light: '#fff6b0' },
        ...COMMON,
    },
};
const SHAPES = {
    blue: { icon: '+', shape: 'circle' },
    red: { icon: '-', shape: 'triangle' },
    drop: { icon: 'v', shape: 'chevron' },
    start: { icon: '>', shape: 'arrow' },
    sample: { icon: '?', shape: 'hexagon' },
    freestyle: { icon: '!', shape: 'star' },
    battle: { icon: 'VS', shape: 'diamond' },
    cut: { icon: 'OFF', shape: 'square' },
};
export const SPACE_COLORS = {
    start: { ring: '#f2f0ea', dim: '#3a3a40', light: '#ffffff', ...SHAPES.start },
};
export let paletteVersion = 0;
const PALETTE_KEY = 'party_palette';

/** Palette des cases : 'standard' ou 'adapted' (gardée par le navigateur) */
export function setPalette(name) {
    const pal = PALETTES[name] || PALETTES.standard;
    Object.entries(pal).forEach(([type, col]) => { SPACE_COLORS[type] = { ...col, ...SHAPES[type] }; });
    paletteVersion += 1;
    try { localStorage.setItem(PALETTE_KEY, name); } catch (error) { /* navigation privée */ }
}
export function getPalette() {
    try { return localStorage.getItem(PALETTE_KEY) === 'adapted' ? 'adapted' : 'standard'; } catch (error) { return 'standard'; }
}
setPalette(getPalette());

export const TRACKS = [158, 354, 550, 746, 942];
export const SMALL_R = 27; // rayon local d'une petite case (≈ 34 dans le monde)
export const BIG_R = 62;
export const spaceRadius = (space) => (space.big ? BIG_R : SMALL_R) * SCALE;

// ---------------------------------------------------------------------------
// Dessus de l'appareil (partie plate : châssis, sérigraphie, fentes, tracé)
// ---------------------------------------------------------------------------

/**
 * Chevrons sérigraphiés entre deux cases, dans le sens de la marche. Les chevrons
 * s'allument par groupes de trois, à tour de rôle (phase 0, 1, 2) : sur trois textures
 * affichées en boucle, la lumière avance dans le sens du parcours.
 */
function chevrons(ctx, x0, y0, r0, x1, y1, r1, color, phase, counter) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1) return counter;
    const ux = dx / len;
    const uy = dy / len;
    const vx = -uy;
    const vy = ux;
    const dim = hexMix(color, '#1c1c21', 0.62);
    let k = counter;
    for (let d = r0 + 9; d <= len - r1 - 7; d += 15) {
        const cx = x0 + ux * d;
        const cy = y0 + uy * d;
        const c = k % 3 === phase ? color : dim;
        line(ctx, cx - ux * 3 + vx * 4, cy - uy * 3 + vy * 4, cx + ux * 2, cy + uy * 2, c, 2);
        line(ctx, cx - ux * 3 - vx * 4, cy - uy * 3 - vy * 4, cx + ux * 2, cy + uy * 2, c, 2);
        k += 1;
    }
    return k;
}

function paintTop(board, phase = 0) {
    const { w: W, d: D } = LOCAL;
    const [c, ctx] = makeCanvas(W, D);
    RR(ctx, 0, 0, W, D, 22, OUT);
    RR(ctx, 2, 2, W - 4, D - 4, 20, C.bevel);
    RR(ctx, 3, 4, W - 6, D - 7, 19, C.body);
    for (let j = 6; j < D - 6; j += 3) for (let i = 8 + (j % 6); i < W - 8; i += 6) R(ctx, i, j, 1, 1, C.body2);

    // Ombres portées des reliefs (occlusion) : on les pose avant la sérigraphie
    const shade = (x, y, rx, ry) => { ctx.globalAlpha = 0.45; E(ctx, x + 3, y + 5, rx, ry, '#050507'); ctx.globalAlpha = 1; };
    shade(82, 70, 44, 42); shade(1018, 70, 44, 42);
    [470, 520, 580, 630].forEach((x) => shade(x, 158, 13, 12));

    silk(ctx, 'INPUT FX', 82, 122, C.silk);
    silk(ctx, 'INPUT FX', 210, 134, C.silkDim);
    silk(ctx, 'TRACK FX', W - 82, 122, C.silk);
    silk(ctx, 'TRACK FX', W - 210, 134, C.silkDim);
    // Logement de l'écran
    RR(ctx, 404, 20, 292, 112, 6, OUT);
    RR(ctx, 408, 23, 284, 105, 5, '#0d0d10');
    silk(ctx, 'MEMORY / LEVEL / PAN / TEMPO', 550, 176, C.silkDim);
    R(ctx, 12, 238, W - 24, 1, '#3a3a42');

    TRACKS.forEach((cx, i) => {
        const x0 = cx - 98;
        if (i > 0) R(ctx, x0, 248, 1, 300, '#2c2c33');
        // Fente du fader et graduations
        R(ctx, x0 + 26, 258, 6, 128, '#050506');
        R(ctx, x0 + 25, 258, 1, 128, '#2e2e35');
        for (let k = 0; k < 9; k += 1) R(ctx, x0 + 14, 262 + k * 15, 6, 1, '#4a4a52');
        silk(ctx, 'CLEAR HOLD', cx - 11, 346, C.silkDim);
        pixText(ctx, String(i + 1), x0 + 26, 512, C.silk, { font: 'bold', scale: 2, outline: null, shadow: false });
        // Cuvette du gros pad
        E(ctx, cx, 470, BIG_R + 6, BIG_R + 6, '#0a0a0d');
        E(ctx, cx, 471, BIG_R + 4, BIG_R + 4, '#060608');
    });

    // Tracé entre les cases (chevrons dans le sens de la marche), et cuvettes des petites cases
    if (board) {
        const loc = board.spaces.map((s) => toLocal(s.x, s.y));
        const rad = (sp) => (sp.big ? BIG_R : SMALL_R) + 2;
        let counter = 0;
        board.spaces.forEach((s, i) => {
            s.next.forEach((n) => {
                const [x0, y0] = loc[i];
                const [x1, y1] = loc[n];
                const amber = s.corridor || board.spaces[n].corridor;
                counter = chevrons(ctx, x0, y0, rad(s), x1, y1, rad(board.spaces[n]), amber ? C.amber : '#f2f0ea', phase, counter);
            });
        });
        board.spaces.forEach((s, i) => {
            if (s.big) return;
            const [x, y] = loc[i];
            E(ctx, x, y + 1, SMALL_R + 4, SMALL_R + 4, '#0a0a0d');
        });
    }
    return c;
}

// Face avant : la tranche épaisse de l'appareil, avec ses prises
function paintFront() {
    const W = LOCAL.w;
    const H = Math.round(DEVICE.h / SCALE);
    const [c, ctx] = makeCanvas(W, H);
    // Tranche en aluminium sombre, éclairée par la scène : plus claire en haut
    for (let y = 0; y < H; y += 1) R(ctx, 0, y, W, 1, hexMix('#3a3a43', '#16161b', y / H));
    R(ctx, 0, 0, W, 2, '#5a5a64');
    R(ctx, 0, 2, W, 1, '#2a2a31');
    R(ctx, 0, H - 3, W, 3, '#08080a');
    // Coins arrondis et vis
    [[14, 8], [W - 14, 8], [14, H - 10], [W - 14, H - 10]].forEach(([x, y]) => { E(ctx, x, y, 3, 3, '#14141a'); R(ctx, x - 1, y, 3, 1, '#4a4a54'); });
    // Grille d'aération
    for (let x = 160; x < 420; x += 6) R(ctx, x, Math.round(H / 2) - 6, 3, 12, '#141419');
    const mid = Math.round(H / 2);
    silk(ctx, 'LOOP STATION', 80, mid - 3, C.silk);
    // Prises : casque, entrées micro, sortie
    const jack = (x, r) => { E(ctx, x, mid, r + 3, r + 3, '#4a4a54'); E(ctx, x, mid, r + 1, r + 1, '#1b1b20'); E(ctx, x, mid, r - 2, r - 2, '#050506'); };
    [560, 610, 660].forEach((x) => jack(x, 7));
    silk(ctx, 'INPUT 1  INPUT 2  AUX', 610, mid + 12, C.silkDim);
    jack(W - 90, 6);
    silk(ctx, 'PHONES', W - 90, mid + 12, C.silkDim);
    E(ctx, W - 160, mid, 4, 4, '#33e07a');
    silk(ctx, 'POWER', W - 160, mid + 8, C.silkDim);
    return c;
}

// ---------------------------------------------------------------------------
// Scène de battle : plancher et fond (rideau, rampe, écran, public)
// ---------------------------------------------------------------------------

function paintFloor() {
    const s = FLOOR.scale;
    const W = FLOOR.w / s;
    const D = FLOOR.d / s;
    const [c, ctx] = makeCanvas(W, D);
    R(ctx, 0, 0, W, D, '#141117');
    // Lames du plancher
    for (let y = 0; y < D; y += 20) {
        R(ctx, 0, y, W, 1, '#0d0b10');
        for (let x = (y * 3) % 130; x < W; x += 130) R(ctx, x, y + 1, 1, 19, '#0f0d12');
        for (let x = (y * 7) % 60; x < W; x += 60 + ((x + y) % 40)) R(ctx, x, y + 9, 20 + ((x * 3) % 18), 1, '#19161d');
    }
    // Ombre de l'appareil
    const [dx, dy] = [(DEVICE.x - FLOOR.x) / s, (DEVICE.y - FLOOR.y) / s];
    ctx.globalAlpha = 0.55;
    RR(ctx, dx - 6, dy - 2, DEVICE.w / s + 16, DEVICE.d / s + 14, 14, '#050407');
    ctx.globalAlpha = 1;
    // Repères de scotch et câbles
    [[dx - 60, dy + 40], [dx + DEVICE.w / s + 50, dy + 80], [dx + 200, dy + DEVICE.d / s + 70], [dx + 520, dy + DEVICE.d / s + 90]].forEach(([x, y]) => {
        R(ctx, x - 7, y - 1, 14, 3, '#e8d14a');
        R(ctx, x - 1, y - 7, 3, 14, '#e8d14a');
    });
    for (let x = 0; x < dx; x += 1) R(ctx, x, dy + 120 + Math.round(Math.sin(x / 26) * 6), 1, 3, '#060508');
    for (let x = dx + DEVICE.w / s; x < W; x += 1) R(ctx, x, dy + 170 + Math.round(Math.sin(x / 30) * 7), 1, 3, '#060508');
    // Nez de scène
    const lip = (1720 - FLOOR.y) / s;
    R(ctx, 0, lip, W, 3, '#2b2330');
    R(ctx, 0, lip + 3, W, D - lip, '#070609');
    for (let x = 6; x < W; x += 90) R(ctx, x, lip - 4, 10, 3, '#3a3040');
    return c;
}

function paintWall() {
    const s = WALL.scale;
    const W = WALL.w / s;
    const H = WALL.h / s;
    const [c, ctx] = makeCanvas(W, H);
    R(ctx, 0, 0, W, H, '#0d0a14');
    // Rideau à plis
    for (let x = 0; x < W; x += 18) {
        R(ctx, x, 30, 9, H, '#1a1024');
        R(ctx, x + 9, 30, 9, H, '#140c1c');
        R(ctx, x + 4, 30, 1, H, '#21152d');
    }
    // Rampe de projecteurs
    R(ctx, 0, 18, W, 8, '#2a2a30');
    R(ctx, 0, 20, W, 1, '#3a3a42');
    for (let x = 30; x < W; x += 140) {
        RR(ctx, x - 10, 26, 20, 16, 3, '#1b1b20');
        E(ctx, x, 40, 7, 4, '#fff1c9');
    }
    // Écran géant au centre (les barres sont animées par le moteur)
    const cx = (1000 - WALL.x) / s;
    RR(ctx, cx - 170, 70, 340, 130, 4, OUT);
    R(ctx, cx - 164, 76, 328, 118, '#120d1e');
    // Enceintes empilées de chaque côté de la scène
    [cx - 560, cx + 470].forEach((x) => {
        for (let k = 0; k < 3; k += 1) {
            const y = H - 70 - k * 66;
            RR(ctx, x, y, 90, 64, 4, OUT);
            RR(ctx, x + 2, y + 2, 86, 60, 3, '#1b1b20');
            E(ctx, x + 45, y + 32, 22, 22, '#0a0a0c');
            E(ctx, x + 45, y + 32, 9, 9, '#2a2a30');
        }
    });
    return c;
}

/** Position de l'écran géant dans le fond (coordonnées monde) */
export const WALL_SCREEN = { x: 1000, w: 656, top: 152, h: 236 };

// Le public : silhouettes devant le rideau, elles sautent sur le temps (dessinées par le moteur)
export const CROWD = Array.from({ length: 150 }, (_, i) => ({
    x: WALL.x + 300 + i * 22 + Math.round((hash(i, 1) - 0.5) * 10),
    h: 70 + hash(i, 2) * 46,
    shade: hash(i, 3) > 0.5 ? '#07060b' : '#0b0912',
    arm: hash(i, 4) > 0.72,
    phone: hash(i, 5) > 0.9,
    phase: hash(i, 6),
}));

// ---------------------------------------------------------------------------
// Objets en relief (touches, potards, faders) : dessus en sprite + hauteur
// ---------------------------------------------------------------------------

const spriteCache = new Map();
function cached(key, w, h, paint) {
    let s = spriteCache.get(key);
    if (!s) {
        const [c, ctx] = makeCanvas(w, h);
        paint(ctx, w, h);
        s = c;
        spriteCache.set(key, s);
    }
    return s;
}

export function knobTop(r) {
    const d = Math.ceil(r * 2) + 2;
    return cached(`knob${r}`, d, d, (ctx) => {
        const x = d / 2;
        E(ctx, x, x, r, r, '#2b2b31');
        ring(ctx, x, x, r, r - 3, 28, (k) => (k % 2 ? '#3a3a41' : '#232328'), 0.3);
        E(ctx, x, x, r - 4, r - 4, '#34343b');
        E(ctx, x - r * 0.25, x - r * 0.35, r * 0.35, r * 0.2, '#45454d');
        line(ctx, x + Math.sin(-0.8) * (r * 0.3), x - Math.cos(-0.8) * (r * 0.3), x + Math.sin(-0.8) * (r - 5), x - Math.cos(-0.8) * (r - 5), '#e8e8ec', r > 20 ? 2 : 1);
    });
}

export function roundBtnTop(r, led) {
    const d = Math.ceil(r * 2) + 2;
    return cached(`rb${r}${led}`, d, d, (ctx) => {
        const x = d / 2;
        ring(ctx, x, x, r, r - 3, 1, () => led);
        E(ctx, x, x, r - 3, r - 3, '#2a2a30');
        E(ctx, x, x - 1, r - 5, r - 5, '#36363d');
    });
}

export function rubberTop(w, h, color, hi, lit, label) {
    return cached(`rub${w}${h}${color}${lit}${label}`, w, h, (ctx) => {
        RR(ctx, 0, 0, w, h, 4, lit ? color : '#2c2c32');
        RR(ctx, 2, 1, w - 4, h - 4, 3, lit ? hi : '#38383f');
        RR(ctx, 3, 3, w - 6, h - 7, 3, lit ? color : '#2f2f35');
        if (label) silk(ctx, label, w / 2, h / 2 - 3, lit ? '#1a0505' : C.silkDim);
    });
}

export function stopTop() {
    return cached('stop', 22, 17, (ctx) => {
        RR(ctx, 0, 0, 22, 17, 3, '#3a3a41');
        R(ctx, 7, 5, 8, 7, '#d8d8dc');
    });
}

export function capTop() {
    return cached('cap', 28, 13, (ctx) => {
        R(ctx, 0, 0, 28, 13, '#8a8a92');
        R(ctx, 0, 6, 28, 1, '#e8e8ec');
        R(ctx, 0, 9, 28, 4, '#6a6a72');
    });
}

/** Liste des reliefs fixes (coordonnées monde, tailles monde) */
function buildStatics() {
    const list = [];
    const S = SCALE;
    const add = (kind, lx, ly, lw, ld, h, sprite, side, extra = {}) => {
        const [x, y] = toWorld(lx, ly);
        list.push({ kind, x, y, w: lw * S, d: ld * S, h, sprite, side, ...extra });
    };
    // Gros potards et petits potards sous l'écran (cylindres)
    add('cyl', 82, 70, 80, 80, 32, knobTop(40), '#141418');
    add('cyl', 1018, 70, 80, 80, 32, knobTop(40), '#141418');
    [470, 520, 580, 630].forEach((x) => add('cyl', x, 158, 22, 22, 16, knobTop(11), '#141418'));
    // Touches rondes INPUT / TRACK FX
    ['A', 'B', 'C', 'D'].forEach((l, i) => {
        add('cyl', 150 + i * 40, 112, 26, 26, 8, roundBtnTop(13, C.pink), '#2a0f1c', { label: l });
        add('cyl', 830 + i * 40, 112, 26, 26, 8, roundBtnTop(13, C.pink), '#2a0f1c', { label: l });
    });
    // Touches en caoutchouc autour de l'écran
    const rub = (lx, ly, color, hi, lit, label, beat = false) => add('box', lx + 22, ly + 9, 44, 18, 10, rubberTop(44, 18, color, hi, lit, label), lit ? hexMix(color, '#000000', 0.5) : '#1d1d22', { beat, off: rubberTop(44, 18, color, hi, false, label) });
    rub(320, 40, C.redBtn, C.redBtnHi, false, 'MENU');
    rub(320, 70, C.redBtn, C.redBtnHi, false, 'LOOP');
    rub(736, 40, C.redBtn, C.redBtnHi, false, 'EXIT');
    rub(736, 70, C.redBtn, C.redBtnHi, false, 'ENTER');
    rub(260, 40, C.greenBtn, C.greenBtnHi, true, 'ALL');
    rub(796, 40, C.greenBtn, C.greenBtnHi, true, 'TAP', true);
    rub(796, 70, C.redBtn, C.redBtnHi, true, 'REC');
    // Pistes : FX, TRACK, STOP et capuchon du fader (pas sur la piste 3 : le raccourci y passe)
    TRACKS.forEach((cx, i) => {
        const x0 = cx - 98;
        rub(cx - 34, 256, C.redBtn, C.redBtnHi, i % 2 === 0, 'FX');
        rub(cx - 34, 288, C.greenBtn, C.greenBtnHi, i !== 3, 'TRACK');
        add('box', cx - 11, 328.5, 22, 17, 9, stopTop(), '#1d1d22');
        if (i !== 2) add('box', x0 + 29, 270 + ((i * 37) % 80) + 6.5, 28, 13, 14, capTop(), '#3a3a42');
    });
    // L'écran : légèrement en saillie, contenu animé par le moteur
    add('lcd', 550, 75, 260, 86, 4, null, '#050507');
    return list;
}

// La loge du voleur de flow (au sol, au bord de la scène) : rideau, enseigne, guichet
function boothFront() {
    return cached('boothFront', 64, 104, (ctx, w, h) => {
        R(ctx, 0, 0, w, h, '#1a0f14');
        // Enseigne
        RR(ctx, 4, 4, w - 8, 18, 3, OUT);
        RR(ctx, 5, 5, w - 10, 16, 3, '#2a1d0a');
        pixText(ctx, 'FLOW', w / 2, 9, '#ffc72c', { font: 'tiny', scale: 2, outline: null, shadow: false });
        // Guichet et rideau à plis
        R(ctx, 8, 28, w - 16, 30, '#0a0608');
        R(ctx, 8, 28, w - 16, 2, '#3a2a12');
        for (let x = 8; x < w - 8; x += 6) {
            R(ctx, x, 60, 3, h - 64, '#5a1424');
            R(ctx, x + 3, 60, 3, h - 64, '#3e0d19');
        }
        R(ctx, 6, 58, w - 12, 3, '#ffc72c');
        R(ctx, 0, h - 3, w, 3, '#050304');
    });
}
function boothTop() {
    return cached('boothTop', 64, 44, (ctx, w, h) => {
        R(ctx, 0, 0, w, h, '#24161c');
        for (let y = 2; y < h; y += 6) R(ctx, 0, y, w, 2, '#3a2129');
        R(ctx, 0, 0, w, 2, '#4a2a34');
    });
}

// ---------------------------------------------------------------------------

const worlds = new Map();

/** Textures et reliefs du plateau (calculés une fois par plateau) */
export function getWorld(board) {
    const key = board ? board.id : 'none';
    let w = worlds.get(key);
    if (w) return w;
    const tops = [0, 1, 2].map((phase) => paintTop(board, phase));
    const statics = buildStatics();
    if (board && board.thief) {
        statics.push({ kind: 'box', x: board.thief.x, y: board.thief.y, w: 80, d: 56, h: 130, sprite: boothTop(), front: boothFront(), side: '#1a0f14', floor: true, booth: true });
    }
    w = {
        top: tops[0],
        tops,
        front: paintFront(),
        floor: paintFloor(),
        wall: paintWall(),
        statics,
    };
    worlds.set(key, w);
    return w;
}

export { dither };
