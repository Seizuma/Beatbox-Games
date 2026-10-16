// Le décor animé du plateau, redessiné à chaque image dans le canvas pixel :
// LED du matériel (anneaux des pads qui tournent comme une boucle), écran LCD de la
// loopstation, vumètres, membranes des enceintes, vapeur du café, fenêtres de la ville,
// foule miniature. Plus les objets de jeu en pixel art : Micro d'or, dé en anneau de
// boucle, flèches, pièces de Hype.

import { drawText, textSprite } from './pixelFont';
import { LOOP, MIXER_METERS, MONITORS, MUG, PADS, PEDALS, PHONE, RING_SEGMENTS, SPACE_COLORS, STAGE, WINDOW, padShape } from './world';

const OUT = '#100d0c';

// ---------------------------------------------------------------------------
// Primitives pixel
// ---------------------------------------------------------------------------

export function prect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Ellipse pleine, ligne par ligne (bords nets)
export function pellipse(ctx, cx, cy, rx, ry, color) {
    ctx.fillStyle = color;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
        const k = (y + 0.5 - cy) / ry;
        if (k * k > 1) continue;
        const half = rx * Math.sqrt(1 - k * k);
        const x0 = Math.round(cx - half);
        const x1 = Math.round(cx + half);
        if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1);
    }
}

function pring(ctx, cx, cy, rx, ry, color, step = 0.06) {
    ctx.fillStyle = color;
    for (let a = 0; a < Math.PI * 2; a += step) ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
}

function prrect(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color;
    for (let j = 0; j < h; j += 1) {
        const dy = Math.max(r - j - 0.5, j + 0.5 - (h - r), 0);
        const inset = dy > 0 ? Math.round(r - Math.sqrt(Math.max(0, r * r - dy * dy))) : 0;
        ctx.fillRect(Math.round(x + inset), Math.round(y + j), Math.round(w - inset * 2), 1);
    }
}

/** Ombre portée au sol (ellipse sombre et transparente) */
export function drawShadow(ctx, x, y, rx, ry, alpha = 0.45) {
    ctx.globalAlpha = alpha;
    pellipse(ctx, x, y, rx, ry, '#060403');
    ctx.globalAlpha = 1;
}

const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
};

// ---------------------------------------------------------------------------
// Anneaux de LED des pads
// ---------------------------------------------------------------------------

/**
 * Allume des segments de l'anneau d'une case. segments : liste d'indices (0 en haut,
 * sens horaire). Pour un pad carré, les segments suivent le cadre.
 */
export function lightRing(ctx, space, segments, color, alpha = 1) {
    const g = padShape(space);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    if (g.square) {
        const x0 = space.x - g.ringW / 2;
        const y0 = space.y - g.ringH / 2;
        segments.forEach((k) => {
            const i = ((k % RING_SEGMENTS) + RING_SEGMENTS) % RING_SEGMENTS;
            if (i < 8) ctx.fillRect(Math.round(x0 + (i / 8) * g.ringW) + 1, Math.round(y0), Math.round(g.ringW / 8) - 1, 3);
            else ctx.fillRect(Math.round(x0 + g.ringW - ((i - 7) / 8) * g.ringW) + 1, Math.round(y0 + g.ringH - 3), Math.round(g.ringW / 8) - 1, 3);
        });
    } else {
        const cx = space.x;
        const cy = space.y + 1;
        segments.forEach((k) => {
            const i = ((k % RING_SEGMENTS) + RING_SEGMENTS) % RING_SEGMENTS;
            const a0 = -Math.PI / 2 + ((i + 0.18) / RING_SEGMENTS) * Math.PI * 2;
            const a1 = -Math.PI / 2 + ((i + 0.95) / RING_SEGMENTS) * Math.PI * 2;
            for (let a = a0; a < a1; a += 0.02) {
                for (let r = 0.83; r <= 0.99; r += 0.04) ctx.fillRect(Math.floor(cx + Math.cos(a) * g.ringRx * r), Math.floor(cy + Math.sin(a) * g.ringRy * r), 1, 1);
            }
        });
    }
    ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Décor animé
// ---------------------------------------------------------------------------

const CITY_LIGHTS = Array.from({ length: 60 }, (_, i) => ({
    x: WINDOW.x + 4 + Math.floor(hash(i, 1) * (WINDOW.w - 10)),
    y: WINDOW.y + WINDOW.h - 6 - Math.floor(hash(i, 2) * 60),
    color: hash(i, 3) > 0.8 ? '#a9b8d0' : '#e6c27a',
    period: 6 + hash(i, 4) * 14,
    phase: hash(i, 5) * 20,
})).filter((l) => {
    const rx = l.x - WINDOW.x;
    const ry = l.y - WINDOW.y;
    return ry > WINDOW.h - 90 + (rx % 64 < 32 ? 22 : 0) && Math.abs(rx - WINDOW.w / 2) > 5 && Math.abs(ry - WINDOW.h / 2) > 4;
});

const LCD_ON = '#cfe0de';
const LCD_DIM = '#2a3536';

/**
 * info : { beat (0..1 dans le temps), kick (0..1), bi (numéro du temps), t,
 *          stageColor (couleur du joueur qui a le micro géant, ou null), bpm }
 * board : le plateau (anneaux des cases). glows : halos demandés à la couche lumière.
 */
export function drawWorldLive(ctx, t, info, glows = [], board = null) {
    const { beat, kick, bi } = info;

    // Fenêtres de la ville
    CITY_LIGHTS.forEach((l) => {
        if ((t + l.phase) % l.period < l.period * 0.72) prect(ctx, l.x, l.y, 2, 2, l.color);
    });

    // Enceintes : la membrane pousse sur chaque temps, LED d'alimentation
    MONITORS.forEach((m) => {
        const cx = m.x + m.w / 2;
        const cy = m.y + 73 + 112;
        if (kick > 0.4) pring(ctx, cx, cy, 36 + kick * 2, 36 + kick * 2, '#3d3d44', 0.03);
        prect(ctx, cx - 1, m.y + m.h - 34, 3, 2, '#7fd18b');
    });

    // Loopstation : écran LCD graphique (tempo, pistes, forme d'onde), LED des touches
    const s = LOOP.screen;
    ctx.drawImage(textSprite(`BPM ${info.bpm || 96}`, LCD_ON, { font: 'tiny', outline: null, shadow: false }), s.x + 6, s.y + 5);
    ctx.drawImage(textSprite('MEMORY 01', LCD_ON, { font: 'tiny', outline: null, shadow: false }), s.x + s.w - 44, s.y + 5);
    prect(ctx, s.x + 4, s.y + 13, s.w - 8, 1, LCD_DIM);
    for (let k = 0; k < 5; k += 1) {
        const on = Math.floor(t / 1.6) % 5 === k;
        const x = s.x + 8 + k * 38;
        prect(ctx, x, s.y + 18, 30, 26, LCD_DIM);
        prect(ctx, x + 1, s.y + 19, 28, 24, on ? LCD_ON : '#0d1213');
        const p = ((t / 6.4) + k * 0.27) % 1;
        prect(ctx, x + 3, s.y + 38, Math.round(24 * p), 3, on ? '#0d1213' : LCD_ON);
        ctx.drawImage(textSprite(String(k + 1), on ? '#0d1213' : LCD_ON, { font: 'tiny', outline: null, shadow: false }), x + 13, s.y + 23);
    }
    LOOP.inputKeys.forEach((kx, i) => prect(ctx, kx - 3, LOOP.y + 36, 6, 3, i === bi % 4 ? '#e2402f' : '#3a1712'));
    LOOP.trackKeys.forEach((kx, i) => prect(ctx, kx - 3, LOOP.y + 36, 6, 3, i === 1 ? '#2eb75e' : '#12301d'));

    // Anneaux des cases : un segment plus clair tourne, comme la boucle d'une piste
    if (board) {
        board.spaces.forEach((space, i) => {
            const c = SPACE_COLORS[space.type] || SPACE_COLORS.blue;
            const head = Math.floor((t * 2.4 + i * 0.37) * RING_SEGMENTS / 4) % RING_SEGMENTS;
            lightRing(ctx, space, [head], c.light, 0.9);
        });
    }

    // Vumètres de la table de mixage
    MIXER_METERS.forEach(({ x, y, n }, j) => {
        const level = Math.round((0.35 + kick * 0.55 + Math.sin(t * 9 + j * 1.7) * 0.08) * n);
        for (let k = 0; k < n; k += 1) {
            const on = n - k <= level;
            const color = k < 2 ? '#e2402f' : k < 4 ? '#f0ae22' : '#2eb75e';
            prect(ctx, x - 2, y + k * 9, 6, 6, on ? color : '#141416');
        }
    });

    // Pad controller : rétroéclairage discret des pads joués (blanc chaud)
    const step = Math.floor(t / 0.3125);
    PADS.cols.slice(1).forEach((cx, ci) => PADS.rows.forEach((cy, ri) => {
        const id = ri * 3 + ci;
        const hitStep = [0, 3, 6, 2, 5, 7, 1, 4, 8][id];
        const age = ((step - hitStep) % 8 + 8) % 8;
        if (age > 1) return;
        ctx.globalAlpha = age === 0 ? 0.55 : 0.25;
        prrect(ctx, cx - 26, cy - 18, 52, 34, 6, '#e9d7b4');
        ctx.globalAlpha = 1;
    }));

    // Pédales : LED d'état
    PEDALS.forEach((p, i) => {
        const on = i === 1 ? beat < 0.3 : i !== 3;
        prect(ctx, p.cx - 2, p.cy - 40, 4, 3, on ? '#e2402f' : '#3a1712');
    });

    // Retours de scène : petite LED à la couleur du joueur qui a le micro géant
    if (info.stageColor) {
        [[STAGE.cx - 150, STAGE.cy - 30], [STAGE.cx + 150, STAGE.cy - 30]].forEach(([x, y]) => prect(ctx, x + 18, y + 10, 4, 2, info.stageColor));
    }

    // Vapeur du café
    for (let w = 0; w < 3; w += 1) {
        for (let i = 0; i < 16; i += 1) {
            const rise = (i * 4 + (t * 16) % 4);
            const x = MUG.cx - 13 + w * 13 + Math.sin(i * 0.4 + t * 1.6 + w * 2) * (2 + i * 0.4);
            const y = MUG.cy - MUG.h - 8 - rise;
            ctx.globalAlpha = 0.3 * (1 - i / 16);
            prect(ctx, x, y, 2, 2, '#e8e6e0');
        }
    }
    ctx.globalAlpha = 1;

    // Téléphone : appli d'enregistrement, écran tamisé
    const px = PHONE.x + 5;
    const py = PHONE.y + 10;
    const pw = PHONE.w - 10;
    prect(ctx, px + 4, py + 6, pw - 8, 2, '#2c2f36');
    for (let i = 0; i < pw - 8; i += 2) {
        const v = Math.abs(Math.sin((i + t * 30) * 0.3) * Math.cos((i - t * 11) * 0.09));
        const h = Math.max(1, Math.round(v * 26 * (0.5 + kick * 0.5)));
        prect(ctx, px + 4 + i, py + 44 - h / 2, 1, h, '#b9b6ad');
    }
    pellipse(ctx, px + pw / 2, py + 82, 7, 7, bi % 2 ? '#e2402f' : '#5a1d16');
    glows.push({ x: px + pw / 2, y: py + 46, r: 50, color: '#8a8f99', a: 0.12, squash: 1.4 });
}

// ---------------------------------------------------------------------------
// Foule miniature, vue de dos, tournée vers le micro géant
// ---------------------------------------------------------------------------

const FANS = Array.from({ length: 13 }, (_, i) => ({
    x: 965 + (i % 7) * 44 + (i >= 7 ? 22 : 0) + Math.round((hash(i, 8) - 0.5) * 10),
    y: i >= 7 ? 562 : 525,
    shirt: ['#5a4a6e', '#3b5a7a', '#7a3b3b', '#3b6a52', '#7a6238', '#45454f', '#7a4a62'][(i * 3) % 7],
    hair: ['#2A1A14', '#5B3A26', '#16100D', '#D9DDE8', '#6B3A26', '#1E1512'][(i * 5) % 6],
    skin: ['#8D5A3B', '#E9B892', '#C68863', '#6B4028', '#F3D2B8'][(i * 2) % 5],
    phase: hash(i, 9),
    phone: i % 5 === 2,
}));

export function drawCrowd(ctx, t, { beat, cheering }) {
    FANS.forEach((f, i) => {
        const ph = (beat + f.phase * 0.3) % 1;
        const jump = cheering ? Math.round(Math.abs(Math.sin(t * 9 + f.phase * 6)) * 6) : ph < 0.22 ? 1 : 0;
        const x = f.x;
        const y = f.y - jump;
        drawShadow(ctx, x + 6, f.y + 1, 9, 3, 0.4);
        const armsUp = cheering || (i % 3 === 0 && ph < 0.5);
        prect(ctx, x + 1, y - 10, 4, 10, OUT);
        prect(ctx, x + 7, y - 10, 4, 10, OUT);
        prect(ctx, x + 2, y - 10, 2, 9, '#2c2c34');
        prect(ctx, x + 8, y - 10, 2, 9, '#2c2c34');
        prect(ctx, x - 1, y - 25, 14, 16, OUT);
        prect(ctx, x, y - 24, 12, 14, f.shirt);
        prect(ctx, x + 9, y - 24, 3, 14, '#00000040');
        prect(ctx, x + 1, y - 35, 10, 11, OUT);
        prect(ctx, x + 2, y - 34, 8, 9, f.hair);
        if (armsUp) {
            prect(ctx, x - 3, y - 36, 4, 14, OUT);
            prect(ctx, x + 11, y - 36, 4, 14, OUT);
            prect(ctx, x - 2, y - 35, 2, 12, f.skin);
            prect(ctx, x + 12, y - 35, 2, 12, f.skin);
            if (f.phone && !cheering) {
                prect(ctx, x + 11, y - 43, 5, 8, OUT);
                prect(ctx, x + 12, y - 42, 3, 6, '#b9b6ad');
            }
        } else {
            prect(ctx, x - 2, y - 24, 3, 11, OUT);
            prect(ctx, x + 11, y - 24, 3, 11, OUT);
            prect(ctx, x - 1, y - 23, 2, 9, f.shirt);
            prect(ctx, x + 12, y - 23, 2, 9, f.shirt);
        }
    });
}

// ---------------------------------------------------------------------------
// Objets de jeu
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

/**
 * Dé en anneau de boucle : un afficheur rond, l'anneau de LED autour et le chiffre au
 * milieu. mode 'roll' : l'anneau tourne et le chiffre défile ; 'result' : anneau
 * plein ; 'steps' : un segment par case qui reste à parcourir.
 * (cx, bottom) = milieu du bas.
 */
export function drawLoopDie(ctx, cx, bottom, value, { mode = 'roll', total = 10, t = 0, size = 1 } = {}) {
    const R = Math.round(18 * size);
    const cy = Math.round(bottom - R - 2);
    const x = Math.round(cx);
    // Boîtier noir mat et lunette
    pellipse(ctx, x, cy + 2, R + 3, R + 3, OUT);
    pellipse(ctx, x, cy, R + 3, R + 3, OUT);
    pellipse(ctx, x, cy, R + 2, R + 2, '#26262b');
    pellipse(ctx, x, cy - 1, R + 1, R + 1, '#333339');
    pellipse(ctx, x, cy, R, R, '#121214');
    // Anneau : 16 segments
    const N = 16;
    const color = mode === 'steps' ? '#E2402F' : mode === 'result' ? '#2EB75E' : '#F0AE22';
    const off = mode === 'steps' ? '#3a1712' : mode === 'result' ? '#123a20' : '#3d2c0a';
    let lit;
    if (mode === 'roll') {
        const head = Math.floor(t * 22) % N;
        lit = (k) => ((head - k + N) % N) < 5;
    } else if (mode === 'steps') {
        const n = Math.round((value / Math.max(1, total)) * N);
        lit = (k) => k < n;
    } else lit = () => true;
    for (let k = 0; k < N; k += 1) {
        const a0 = -Math.PI / 2 + ((k + 0.15) / N) * Math.PI * 2;
        const a1 = -Math.PI / 2 + ((k + 0.9) / N) * Math.PI * 2;
        ctx.fillStyle = lit(k) ? color : off;
        for (let a = a0; a < a1; a += 0.04) {
            for (let r = R - 4 * size; r <= R - 1; r += 1) ctx.fillRect(Math.round(x + Math.cos(a) * r - 0.5), Math.round(cy + Math.sin(a) * r - 0.5), 1, 1);
        }
    }
    // Chiffre au milieu, blanc sur l'afficheur
    const label = textSprite(String(value), '#F2F0EA', { font: 'bold', outline: null, shadow: false });
    const k = size >= 1 ? 2 : 1;
    ctx.drawImage(label, Math.round(x - (label.width * k) / 2), Math.round(cy - (label.height * k) / 2), label.width * k, label.height * k);
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

/** Contour d'ellipse (onde de choc au sol) */
export function drawRing(ctx, x, y, rx, ry, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    pring(ctx, x, y, rx, ry, color, 0.02);
    pring(ctx, x, y, rx + 1, ry + 1, color, 0.02);
    ctx.globalAlpha = 1;
}
