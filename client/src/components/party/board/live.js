// Objets de jeu en pixel art, dessinés par-dessus le plateau : Micro d'or, les trois dés
// (pad REC/PLAY de base, bloc-boucle et vinyle spéciaux), flèches, pièces de Hype.

import { drawText, textSprite } from './pixelFont';
import { E, R, RR, ring, line, makeCanvas, hexMix } from './pix';

const OUT = '#100d0c';

export function prect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Ellipse pleine, ligne par ligne (bords nets)
export function pellipse(ctx, cx, cy, rx, ry, color) {
    E(ctx, cx, cy, rx, ry, color);
}

/** Ombre portée au sol (ellipse sombre et transparente) */
export function drawShadow(ctx, x, y, rx, ry, alpha = 0.45) {
    ctx.globalAlpha = alpha;
    pellipse(ctx, x, y, rx, ry, '#060403');
    ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Micro d'or
// ---------------------------------------------------------------------------

const GOLD_MIC = [
    '....OOOOOO....',
    '..OOYYyYyYOO..',
    '.OYWYyYyYyYdO.',
    '.OYWyYyYyYydO.',
    'OYYyYyYyYyYddO',
    'OYyYyYyYyYyddO',
    'OyYyYyYyYyYddO',
    '.OYyYyYyYyddO.',
    '.OOdddddddddO.',
    '..OggggggggO..',
    '...OkkGkkkO...',
    '...OkkGkkkO...',
    '...OkkGkkkO...',
    '....OkGkkO....',
    '....OkGkkO....',
    '....OkGkkO....',
    '....OkkkkO....',
    '.....OkkO.....',
    '......OO......',
];
let goldMicCanvas = null;
function goldMic() {
    if (goldMicCanvas) return goldMicCanvas;
    const pal = { O: OUT, Y: '#E9B23A', y: '#C98F1E', W: '#FFF1C8', d: '#8E5E0E', g: '#F4CF73', k: '#A87814', G: '#E7C268' };
    const cv = document.createElement('canvas');
    cv.width = 14;
    cv.height = GOLD_MIC.length;
    const c = cv.getContext('2d');
    GOLD_MIC.forEach((row, j) => {
        for (let i = 0; i < row.length; i += 1) {
            if (pal[row[i]]) {
                c.fillStyle = pal[row[i]];
                c.fillRect(i, j, 1, 1);
            }
        }
    });
    goldMicCanvas = cv;
    return cv;
}

/** Micro d'or posé sur la case (x, y), sur un petit socle, avec un éclat qui passe */
export function drawGoldMic(ctx, x, y, t) {
    const bob = Math.round(Math.sin(t * 2.6) * 2);
    drawShadow(ctx, x, y + 1, 16, 6, 0.5);
    pellipse(ctx, x, y - 1, 14, 5.5, OUT);
    pellipse(ctx, x, y - 2, 13, 4.5, '#5a3d0c');
    pellipse(ctx, x, y - 3, 13, 4.5, '#C98F1E');
    const img = goldMic();
    ctx.drawImage(img, 0, 0, 14, img.height, Math.round(x - 14), Math.round(y - 52 + bob), 28, img.height * 2);
    // Reflet qui glisse sur la grille
    const sweep = (t * 0.8) % 2.4;
    if (sweep < 1) {
        const sx = Math.round(x - 10 + sweep * 18);
        prect(ctx, sx, y - 48 + bob, 2, 12, '#FFF6DC');
    }
}

let goldFrame = null;
/** Micro d'or dans un petit canvas (socle en bas au centre), pour le mettre à l'échelle */
export function goldMicSprite(t) {
    if (!goldFrame) [goldFrame] = makeCanvas(40, 64);
    const ctx = goldFrame.getContext('2d');
    ctx.clearRect(0, 0, 40, 64);
    drawGoldMic(ctx, 20, 58, t);
    return goldFrame;
}

// ---------------------------------------------------------------------------
// Les dés. (cx, bottom) = milieu du bas. mode : 'roll' (il tourne), 'hit' (frappé),
// 'result' (résultat), 'steps' (cases restantes)
// ---------------------------------------------------------------------------

const RED = '#ff3b30';
const RED_DIM = '#4a1410';
const GREEN = '#33e07a';
const GREEN_DIM = '#0f3a22';
const AMBER = '#ffb21e';
const AMBER_DIM = '#4a3208';

function bigNumber(ctx, value, x, cy, scale, color = '#ffffff', outline = OUT) {
    const s = textSprite(String(value), color, { font: 'bold', outline, shadow: Boolean(outline) });
    ctx.drawImage(s, Math.round(x - (s.width * scale) / 2), Math.round(cy - (s.height * scale) / 2), s.width * scale, s.height * scale);
}

function sparks(ctx, x, y, r, color) {
    for (let k = 0; k < 12; k += 1) {
        const a = (k / 12) * Math.PI * 2;
        const len = k % 2 ? 4 : 8;
        for (let s = 0; s < len; s += 1) R(ctx, x + Math.cos(a) * (r + s) - 1, y + Math.sin(a) * (r + s) - 1, 2, 2, k % 2 ? '#ffffff' : color);
    }
}

/** Dé de base : le pad REC/PLAY, 10 segments pour 10 valeurs */
export function drawPadDie(ctx, cx, bottom, value, { mode = 'roll', t = 0, total = 10, size = 1 } = {}) {
    const r = Math.round(24 * size);
    const x = Math.round(cx);
    const cy = Math.round(bottom - r - 3);
    E(ctx, x, cy + 3, r + 3, r + 3, OUT);
    E(ctx, x, cy, r + 3, r + 3, '#0b0b0e');
    const N = 10;
    const head = Math.floor(t * 18) % N;
    const col = mode === 'steps' ? RED : mode === 'roll' ? AMBER : GREEN;
    const dim = mode === 'steps' ? RED_DIM : mode === 'roll' ? AMBER_DIM : GREEN_DIM;
    const lit = mode === 'steps' ? Math.max(0, Math.round((value / Math.max(1, total)) * N)) : value;
    ring(ctx, x, cy, r, r - Math.max(4, Math.round(7 * size)), N, (k) => {
        if (mode === 'roll') return (head - k + N) % N < 3 ? col : dim;
        if (mode === 'hit') return '#ffffff';
        return k < lit ? col : dim;
    }, 0.22);
    ring(ctx, x, cy, r - Math.round(9 * size), r - Math.round(11 * size), 1, () => (mode === 'hit' ? '#ffffff' : col));
    E(ctx, x, cy, r - Math.round(12 * size), r - Math.round(12 * size), '#060608');
    E(ctx, x - 4 * size, cy - 6 * size, 6 * size, 3 * size, '#1d1d22');
    if (value != null) bigNumber(ctx, value, x, cy, size >= 0.9 ? 2 : 1, '#ffffff', null);
    if (mode === 'hit') sparks(ctx, x, cy, r + 6, AMBER);
}

/** Dé spécial « double boucle » : un bloc à la couleur du joueur, qui éclate */
export function drawBlockDie(ctx, cx, bottom, value, { mode = 'roll', t = 0, color = AMBER } = {}) {
    const s = 32;
    const d = 9;
    const x = Math.round(cx);
    const cy = Math.round(bottom - s / 2 - 6);
    if (mode === 'hit') {
        for (let k = 0; k < 9; k += 1) {
            const a = (k / 9) * Math.PI * 2 + 0.3;
            const rr = 22 + (k % 3) * 5;
            R(ctx, x + Math.cos(a) * rr - 5, cy + Math.sin(a) * rr - 5, 10, 10, OUT);
            R(ctx, x + Math.cos(a) * rr - 4, cy + Math.sin(a) * rr - 4, 8, 8, k % 2 ? color : '#1b1b20');
        }
        sparks(ctx, x, cy, 30, color);
        if (value != null) bigNumber(ctx, value, x, cy, 3);
        return;
    }
    if (mode === 'steps') {
        RR(ctx, x - 17, cy - 13, 34, 28, 8, OUT);
        RR(ctx, x - 15, cy - 12, 30, 24, 7, color);
        RR(ctx, x - 13, cy - 11, 26, 6, 4, hexMix(color, '#ffffff', 0.45));
        R(ctx, x - 3, cy + 12, 6, 3, OUT);
        R(ctx, x - 2, cy + 12, 4, 2, color);
        bigNumber(ctx, value, x, cy, 2);
        return;
    }
    const wob = mode === 'roll' ? Math.round(Math.sin(t * 9) * 2) : 0;
    const x0 = x - s / 2 - d / 2;
    const y0 = cy - s / 2 + d / 2 + wob;
    ctx.fillStyle = OUT;
    ctx.beginPath(); ctx.moveTo(x0 - 1, y0); ctx.lineTo(x0 + d - 1, y0 - d - 1); ctx.lineTo(x0 + s + d + 1, y0 - d - 1); ctx.lineTo(x0 + s + d + 1, y0 + s - d + 1); ctx.lineTo(x0 + s + 1, y0 + s + 1); ctx.lineTo(x0 - 1, y0 + s + 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = hexMix(color, '#ffffff', 0.35);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + d, y0 - d); ctx.lineTo(x0 + s + d, y0 - d); ctx.lineTo(x0 + s, y0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = hexMix(color, '#000000', 0.35);
    ctx.beginPath(); ctx.moveTo(x0 + s, y0); ctx.lineTo(x0 + s + d, y0 - d); ctx.lineTo(x0 + s + d, y0 + s - d); ctx.lineTo(x0 + s, y0 + s); ctx.closePath(); ctx.fill();
    R(ctx, x0, y0, s, s, color);
    RR(ctx, x0 + 4, y0 + 4, s - 8, s - 8, 3, '#141418');
    ring(ctx, x0 + s / 2 + d / 2, y0 - d / 2, 4, 2.6, 1, () => '#ffffff');
    if (mode === 'result') {
        for (let k = 0; k < 8; k += 1) {
            const a = (k / 8) * Math.PI * 2;
            line(ctx, x + Math.cos(a) * 30, cy + Math.sin(a) * 30, x + Math.cos(a) * 40, cy + Math.sin(a) * 40, color, 2);
        }
    }
    if (value != null) bigNumber(ctx, value, x0 + s / 2, y0 + s / 2, String(value).length > 1 ? 1 : 2, '#ffffff', null);
}

/** Dé spécial « scratch » : un 45 tours qui tourne, qu'on arrête au bon moment */
export function drawVinylDie(ctx, cx, bottom, value, { mode = 'roll', t = 0, color = AMBER } = {}) {
    const x = Math.round(cx);
    if (mode === 'result' || mode === 'steps') {
        const r = mode === 'steps' ? 16 : 26;
        const cy = Math.round(bottom - r - 4);
        E(ctx, x, cy + 2, r + 1, r + 1, OUT);
        E(ctx, x, cy, r, r, '#101012');
        for (let g = r - 3; g > r * 0.45; g -= 3) ring(ctx, x, cy, g, g - 1, 1, () => '#1e1e23');
        E(ctx, x - r * 0.35, cy - r * 0.45, r * 0.25, r * 0.12, '#3a3a42');
        E(ctx, x, cy, r * 0.42, r * 0.42, color);
        if (mode === 'result') for (let k = 0; k < 10; k += 1) {
            const a = (k / 10) * Math.PI * 2;
            line(ctx, x + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6), x + Math.cos(a) * (r + 13), cy + Math.sin(a) * (r + 13), color, 2);
        }
        bigNumber(ctx, value, x, cy, mode === 'steps' ? 1 : 2);
        return;
    }
    const cy = Math.round(bottom - 16);
    E(ctx, x, cy + 4, 32, 14, OUT);
    E(ctx, x, cy + 3, 30, 11, '#050506');
    E(ctx, x, cy, 31, 12, OUT);
    E(ctx, x, cy, 30, 11, '#121215');
    for (let g = 0; g < 4; g += 1) {
        const rr = 26 - g * 4;
        for (let a = 0; a < Math.PI * 2; a += 0.12) R(ctx, x + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.37, 1, 1, '#202026');
    }
    E(ctx, x, cy, 11, 4, color);
    const a = t * 14;
    if (mode === 'roll') {
        line(ctx, x + Math.cos(a) * 14, cy + Math.sin(a) * 5, x + Math.cos(a) * 27, cy + Math.sin(a) * 10, '#4a4a55', 2);
        line(ctx, x - Math.cos(a) * 14, cy - Math.sin(a) * 5, x - Math.cos(a) * 27, cy - Math.sin(a) * 10, '#4a4a55', 2);
    } else {
        for (let k = 0; k < 5; k += 1) line(ctx, x - 44 + k * 4, cy - 16 + k * 7, x - 30 + k * 4, cy - 18 + k * 7, '#ffffff', 1);
        sparks(ctx, x, cy, 32, color);
    }
    if (value != null) bigNumber(ctx, value, x, cy - 22, 2);
}

/** Le bon dé selon son type : 'pad' (base), 'block', 'vinyl' */
export function drawDie(ctx, die, cx, bottom, value, opts) {
    if (die === 'block') drawBlockDie(ctx, cx, bottom, value, opts);
    else if (die === 'vinyl') drawVinylDie(ctx, cx, bottom, value, opts);
    else drawPadDie(ctx, cx, bottom, value, opts);
}

/** Éclats autour du dé quand on le frappe (petits traits blancs) */
export function drawBurst(ctx, cx, cy, age) {
    const r = 22 + age / 16;
    ctx.globalAlpha = Math.max(0, 1 - age / 450);
    for (let k = 0; k < 12; k += 1) {
        const a = (k / 12) * Math.PI * 2;
        const len = k % 2 ? 4 : 7;
        for (let s = 0; s < len; s += 1) prect(ctx, cx + Math.cos(a) * (r + s), cy + Math.sin(a) * (r + s), 2, 2, k % 2 ? '#F2F0EA' : '#F0AE22');
    }
    ctx.globalAlpha = 1;
}

const ARROWS = {
    right: ['#.....', '##....', '###...', '####..', '#####.', '######', '#####.', '####..', '###...', '##....', '#.....'],
    left: ['.....#', '....##', '...###', '..####', '.#####', '######', '.#####', '..####', '...###', '....##', '.....#'],
    down: ['###########', '.#########.', '..#######..', '...#####...', '....###....', '.....#.....'],
    up: ['.....#.....', '....###....', '...#####...', '..#######..', '.#########.', '###########'],
};

/** Flèche de carrefour (pixels x2), centrée sur (x, y) */
export function drawArrow(ctx, x, y, dir, color) {
    const rows = ARROWS[dir];
    const w = rows[0].length * 2;
    const h = rows.length * 2;
    const x0 = Math.round(x - w / 2);
    const y0 = Math.round(y - h / 2);
    ctx.fillStyle = OUT;
    rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i += 1) if (row[i] === '#') ctx.fillRect(x0 + i * 2 - 2, y0 + j * 2 - 2, 6, 7);
    });
    rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i += 1) {
            if (row[i] !== '#') continue;
            ctx.fillStyle = j < rows.length / 2 ? color : color;
            ctx.fillRect(x0 + i * 2, y0 + j * 2, 2, 2);
        }
    });
}

const COIN = ['.OOOO.', 'OYYYyO', 'OYWyyO', 'OYyyyO', 'OYyydO', '.OOOO.'];
/** Pièce de Hype (pixels x2) */
export function drawCoin(ctx, x, y) {
    const pal = { O: OUT, Y: '#F4CF73', y: '#E9B23A', d: '#A87814', W: '#FFF6DC' };
    COIN.forEach((row, j) => {
        for (let i = 0; i < row.length; i += 1) {
            if (!pal[row[i]]) continue;
            ctx.fillStyle = pal[row[i]];
            ctx.fillRect(Math.round(x) + i * 2, Math.round(y) + j * 2, 2, 2);
        }
    });
}

/** Pastille d'un joueur masqué : petit pad à anneau de sa couleur, avec son numéro */
export function drawBadge(ctx, x, y, color, n) {
    pellipse(ctx, x, y + 1, 9, 9, OUT);
    pellipse(ctx, x, y, 9, 9, OUT);
    pellipse(ctx, x, y, 8, 8, color);
    pellipse(ctx, x, y, 5, 5, '#18181b');
    if (n) drawText(ctx, String(n), x, y - 2, '#F2F0EA', { font: 'tiny', outline: null, shadow: false });
}

