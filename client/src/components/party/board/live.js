// Le décor animé du plateau, redessiné à chaque image dans le canvas pixel :
// LED du matériel, écran de la loopstation, vumètres, membranes des enceintes,
// vapeur du café, fenêtres de la ville, néon qui grésille, foule miniature.
// Plus les objets de jeu en pixel art : Micro d'or, dé, flèches, pièces de Hype.

import { drawText, textSprite } from './pixelFont';
import { LOOP, MIXER_METERS, MONITORS, MUG, NEON_TUBES, PADS, PEDALS, PHONE, STAGE, WINDOW } from './world';

const OUT = '#120E26';

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

// Contour d'ellipse : points le long du tour
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
    pellipse(ctx, x, y, rx, ry, '#05040c');
    ctx.globalAlpha = 1;
}

const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
};

// ---------------------------------------------------------------------------
// Décor animé
// ---------------------------------------------------------------------------

// Fenêtres allumées des immeubles, derrière la vitre
const CITY_LIGHTS = Array.from({ length: 46 }, (_, i) => ({
    x: WINDOW.x + 4 + Math.floor(hash(i, 1) * (WINDOW.w - 10)),
    y: WINDOW.y + WINDOW.h - 6 - Math.floor(hash(i, 2) * 46),
    color: hash(i, 3) > 0.75 ? '#7fb2ff' : '#ffd27a',
    period: 6 + hash(i, 4) * 14,
    phase: hash(i, 5) * 20,
})).filter((l) => {
    const rx = l.x - WINDOW.x;
    const ry = l.y - WINDOW.y;
    // Seulement sur les immeubles (silhouettes du bas), hors croisillons
    return ry > WINDOW.h - 70 + (rx % 50 < 25 ? 18 : 0) && Math.abs(rx - WINDOW.w / 2) > 4 && Math.abs(ry - WINDOW.h / 2) > 3;
});

const PAD_COLORS = ['#FF5FA8', '#5FE0C8', '#9C7BFF', '#FFC72C'];

/**
 * info : { beat (0..1 dans le temps), kick (0..1, fort sur le temps), bi (numéro du temps),
 *          stageColor (couleur du joueur qui a le micro, ou null), music (bool) }
 */
export function drawWorldLive(ctx, t, info, glows = []) {
    const { beat, kick, bi, stageColor } = info;

    // Fenêtres de la ville
    CITY_LIGHTS.forEach((l) => {
        if ((t + l.phase) % l.period < l.period * 0.72) prect(ctx, l.x, l.y, 2, 2, l.color);
    });

    // Néon : il grésille de temps en temps
    const flick = t % 9.3;
    const off = (flick > 4.1 && flick < 4.16) || (flick > 4.24 && flick < 4.3) || (flick > 7.6 && flick < 7.64);
    if (off) NEON_TUBES.forEach((tube, i) => { if (i % 3 === 1) prect(ctx, tube.x + 1, tube.y, tube.w - 2, tube.h, '#5a3d06'); });

    // Enceintes : la membrane pousse sur chaque temps, LED d'alimentation
    MONITORS.forEach((m) => {
        const cx = m.x + m.w / 2;
        const cy = m.y + 56 + 86;
        if (kick > 0.4) {
            pring(ctx, cx, cy, 28 + kick * 1.5, 28 + kick * 1.5, '#3c445b', 0.04);
            pring(ctx, cx, cy, 10, 10, '#454d65', 0.12);
        }
        prect(ctx, cx - 1, m.y + m.h - 26, 3, 2, '#5FE0C8');
        glows.push({ x: cx, y: m.y + m.h - 25, r: 8, color: '#5FE0C8', a: 0.8 });
    });

    // Loopstation : écran LCD (tempo, pistes, forme d'onde qui défile)
    const s = LOOP.screen;
    prect(ctx, s.x, s.y, s.w, s.h, '#06201f');
    glows.push({ x: s.x + s.w / 2, y: s.y + s.h / 2, r: s.w * 0.62, color: '#3fbfae', a: 0.32, squash: 0.4 });
    ctx.drawImage(textSprite(`BPM ${info.bpm || 96}`, '#5FE0C8', { font: 'tiny', outline: null, shadow: false }), s.x + 5, s.y + 4);
    for (let k = 0; k < 5; k += 1) {
        const on = Math.floor(t / 1.6) % 5 === k;
        prect(ctx, s.x + 58 + k * 9, s.y + 4, 6, 5, on ? '#FFC72C' : '#1b4a46');
    }
    ctx.drawImage(textSprite('REC', bi % 2 ? '#FF5A47' : '#5a1a14', { font: 'tiny', outline: null, shadow: false }), s.x + s.w - 18, s.y + 4);
    for (let i = 0; i < s.w - 10; i += 2) {
        const v = Math.abs(Math.sin((i + t * 60) * 0.11) * Math.sin((i + t * 37) * 0.031)) * (0.4 + kick * 0.6);
        const h = Math.max(1, Math.round(v * 20));
        prect(ctx, s.x + 5 + i, s.y + 26 - h / 2, 1, h, i % 6 === 0 ? '#9ff2e2' : '#3fbfae');
    }
    // Anneaux de LED autour des pads de pistes : la boucle tourne
    LOOP.tracks.forEach((cx, i) => {
        const cy = 743;
        const p = ((t / 6.4) + i * 0.27) % 1;
        const lit = Math.floor(p * 20);
        for (let k = 0; k < 20; k += 1) {
            const a = -Math.PI / 2 + (k / 20) * Math.PI * 2;
            const on = k <= lit;
            prect(ctx, cx + Math.cos(a) * 29 - 1, cy + Math.sin(a) * 18.5, 2, 1, on ? (k === lit ? '#FFFFFF' : '#FFC72C') : '#2a2410');
            if (k === lit) glows.push({ x: cx + Math.cos(a) * 29, y: cy + Math.sin(a) * 18.5, r: 7, color: '#FFC72C', a: 0.9 });
        }
        ctx.drawImage(textSprite(String(i + 1), '#8b95b4', { font: 'tiny', outline: null, shadow: false }), cx - 1, cy + 22);
    });
    // Voyant rouge REC sur le potard du milieu
    prect(ctx, 919, LOOP.y + 33, 3, 2, bi % 2 ? '#FF5A47' : '#5a1a14');

    // Vumètres de la table de mixage
    MIXER_METERS.forEach(({ x, y, n }, j) => {
        const level = Math.round((0.35 + kick * 0.55 + Math.sin(t * 9 + j * 1.7) * 0.08) * n);
        for (let k = 0; k < n; k += 1) {
            const on = n - k <= level;
            const color = k < 2 ? '#FF5A47' : k < 4 ? '#FFC72C' : '#35E085';
            prect(ctx, x - 1, y + k * 7, 4, 5, on ? color : '#12151f');
        }
        glows.push({ x: x + 1, y: y + (n - level) * 7 + level * 3.5, r: 4 + level * 2, color: '#35E085', a: 0.35, squash: 1.6 });
    });

    // Pad controller : les pads décoratifs s'allument comme une boîte à rythmes
    const step = Math.floor(t / 0.3125);
    PADS.cols.slice(1).forEach((cx, ci) => PADS.rows.forEach((cy, ri) => {
        const id = ri * 3 + ci;
        const hitStep = [0, 3, 6, 2, 5, 7, 1, 4, 8][id];
        const age = ((step - hitStep) % 8 + 8) % 8;
        if (age > 1) return;
        const color = PAD_COLORS[(id + Math.floor(step / 8)) % PAD_COLORS.length];
        ctx.globalAlpha = age === 0 ? 1 : 0.45;
        prrect(ctx, cx - 21, cy - 15, 42, 28, 5, color);
        prrect(ctx, cx - 19, cy - 13, 38, 6, 4, '#ffffff');
        ctx.globalAlpha = 1;
        glows.push({ x: cx, y: cy, r: 40, color, a: age === 0 ? 0.55 : 0.2, squash: 0.75 });
    }));

    // Pédales : LED d'état, la violette bat la mesure
    PEDALS.forEach((p, i) => {
        const on = i === 1 ? beat < 0.3 : i !== 3;
        prect(ctx, p.cx - 2, p.cy - 41, 4, 3, on ? (i === 4 ? '#5FE0C8' : '#FF5A47') : '#3a1410');
        if (on) glows.push({ x: p.cx, y: p.cy - 40, r: 9, color: i === 4 ? '#5FE0C8' : '#FF5A47', a: 0.8 });
    });

    // Scène : bord de LED, une vague de lumière fait le tour
    const rim = stageColor || '#B48CFF';
    for (let k = 0; k < 44; k += 1) {
        const a = (k / 44) * Math.PI;
        const x = STAGE.cx + Math.cos(a) * (STAGE.rx - 3);
        const y = STAGE.cy + STAGE.h + Math.sin(a) * (STAGE.ry - 2) - 2;
        const wave = (k + Math.floor(t * 18)) % 11;
        prect(ctx, x - 1, y, 2, 2, wave < 3 ? '#FFFFFF' : rim);
        if (k % 4 === 0) glows.push({ x, y, r: 12, color: rim, a: wave < 3 ? 0.7 : 0.3 });
    }

    // Vapeur du café
    for (let w = 0; w < 3; w += 1) {
        for (let i = 0; i < 14; i += 1) {
            const rise = (i * 3 + (t * 14) % 3);
            const x = MUG.cx - 10 + w * 10 + Math.sin(i * 0.45 + t * 1.6 + w * 2) * (2 + i * 0.35);
            const y = MUG.cy - MUG.h - 6 - rise;
            ctx.globalAlpha = 0.35 * (1 - i / 14);
            prect(ctx, x, y, 2, 2, '#e8ecf7');
        }
    }
    ctx.globalAlpha = 1;

    // Téléphone : appli d'enregistrement
    const px = PHONE.x + 4;
    const py = PHONE.y + 8;
    const pw = PHONE.w - 8;
    for (let i = 0; i < pw - 6; i += 2) {
        const v = Math.abs(Math.sin((i + t * 30) * 0.3) * Math.cos((i - t * 11) * 0.09));
        const h = Math.max(1, Math.round(v * 22 * (0.5 + kick * 0.5)));
        prect(ctx, px + 3 + i, py + 34 - h / 2, 1, h, '#FFC72C');
    }
    pellipse(ctx, px + pw / 2, py + 62, 6, 6, bi % 2 ? '#FF5A47' : '#7a2018');
    glows.push({ x: px + pw / 2, y: py + 36, r: 46, color: '#5b7cff', a: 0.25, squash: 1.3 });
    prect(ctx, px + 4, py + 4, pw - 8, 2, '#2c3460');
}

// ---------------------------------------------------------------------------
// Foule miniature, vue de dos, tournée vers le micro géant
// ---------------------------------------------------------------------------

const FANS = Array.from({ length: 13 }, (_, i) => ({
    x: 742 + (i % 7) * 34 + (i >= 7 ? 17 : 0) + Math.round((hash(i, 8) - 0.5) * 8),
    y: i >= 7 ? 432 : 404,
    shirt: ['#5A3E8C', '#2F5FA0', '#8C2F3E', '#2F7A5A', '#8C6A2F', '#3E3E5A', '#A04A7A'][(i * 3) % 7],
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
        drawShadow(ctx, x + 6, f.y + 1, 8, 3, 0.4);
        const armsUp = cheering || (i % 3 === 0 && ph < 0.5);
        // Jambes, dos, tête (cheveux), bras
        prect(ctx, x + 1, y - 9, 4, 9, OUT);
        prect(ctx, x + 7, y - 9, 4, 9, OUT);
        prect(ctx, x + 2, y - 9, 2, 8, '#2a2f48');
        prect(ctx, x + 8, y - 9, 2, 8, '#2a2f48');
        prect(ctx, x - 1, y - 23, 14, 15, OUT);
        prect(ctx, x, y - 22, 12, 13, f.shirt);
        prect(ctx, x + 9, y - 22, 3, 13, '#00000040');
        prect(ctx, x + 1, y - 33, 10, 11, OUT);
        prect(ctx, x + 2, y - 32, 8, 9, f.hair);
        prect(ctx, x + 2, y - 32, 3, 2, '#ffffff22');
        if (armsUp) {
            prect(ctx, x - 3, y - 34, 4, 13, OUT);
            prect(ctx, x + 11, y - 34, 4, 13, OUT);
            prect(ctx, x - 2, y - 33, 2, 11, f.skin);
            prect(ctx, x + 12, y - 33, 2, 11, f.skin);
            if (f.phone && !cheering) {
                prect(ctx, x + 11, y - 41, 5, 8, OUT);
                prect(ctx, x + 12, y - 40, 3, 6, '#9cc0ff');
            }
        } else {
            prect(ctx, x - 2, y - 22, 3, 10, OUT);
            prect(ctx, x + 11, y - 22, 3, 10, OUT);
            prect(ctx, x - 1, y - 21, 2, 8, f.shirt);
            prect(ctx, x + 12, y - 21, 2, 8, f.shirt);
        }
    });
}

// ---------------------------------------------------------------------------
// Objets de jeu
// ---------------------------------------------------------------------------

// Micro d'or : debout sur un petit socle
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
    const pal = { O: OUT, Y: '#FFC72C', y: '#E8A200', W: '#FFF4C7', d: '#B07400', g: '#FFE07A', k: '#C98A00', G: '#FFE9A6' };
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

/** Micro d'or posé sur la case (x, y) : il flotte et brille, avec des étincelles */
export function drawGoldMic(ctx, x, y, t) {
    const bob = Math.round(Math.sin(t * 2.6) * 2);
    drawShadow(ctx, x, y + 1, 14, 5, 0.5);
    // Socle
    pellipse(ctx, x, y - 1, 12, 4.5, OUT);
    pellipse(ctx, x, y - 2, 11, 3.5, '#8d5200');
    pellipse(ctx, x, y - 3, 11, 3.5, '#FFC72C');
    const img = goldMic();
    ctx.drawImage(img, 0, 0, 14, img.height, Math.round(x - 14), Math.round(y - 50 + bob), 28, img.height * 2);
    const sp = Math.floor(t * 6) % 6;
    [[-18, -46], [15, -38], [-14, -24], [17, -54], [-6, -60], [11, -20]].forEach(([dx, dy], i) => {
        if (i !== sp && i !== (sp + 3) % 6) return;
        const sx = Math.round(x + dx);
        const sy = Math.round(y + dy + bob);
        prect(ctx, sx, sy - 2, 1, 5, '#FFFFFF');
        prect(ctx, sx - 2, sy, 5, 1, '#FFFFFF');
    });
}

/** Cube du dé (ou du compteur de pas) au-dessus d'un joueur ; (cx, bottom) = milieu du bas */
export function drawCube(ctx, cx, bottom, text, { gold = true, size = 26 } = {}) {
    const x = Math.round(cx - size / 2);
    const top = 6;
    const y = Math.round(bottom - size - top);
    const face = gold ? '#FFC72C' : '#F4F6FC';
    const side = gold ? '#C98A00' : '#AEB7D2';
    const lid = gold ? '#FFE07A' : '#FFFFFF';
    prect(ctx, x - 1, y - 1, size + 2, size + top + 2, OUT);
    prect(ctx, x, y, size, top, lid);
    prect(ctx, x, y + top, size, size, face);
    prect(ctx, x, y + top + size - 4, size, 4, side);
    prect(ctx, x + size - 4, y + top, 4, size, side);
    prect(ctx, x, y + top, size, 1, OUT);
    // Coins arrondis
    prect(ctx, x - 1, y - 1, 2, 2, 'rgba(0,0,0,0)');
    // Rivets de « pad » aux coins de la face
    [[3, top + 3], [size - 8, top + 3], [3, top + size - 8], [size - 8, top + size - 8]].forEach(([dx, dy]) => prect(ctx, x + dx, y + dy, 2, 2, side));
    const label = textSprite(String(text), OUT, { font: 'bold', outline: null, shadow: false });
    const k = size >= 26 ? 2 : 1;
    ctx.drawImage(label, Math.round(cx - (label.width * k) / 2 - 1), Math.round(y + top + (size - label.height * k) / 2 - 1), label.width * k, label.height * k);
}

/** Éclats autour du dé quand on le frappe */
export function drawBurst(ctx, cx, cy, age) {
    const r = 14 + age / 18;
    ctx.globalAlpha = Math.max(0, 1 - age / 450);
    for (let k = 0; k < 10; k += 1) {
        const a = (k / 10) * Math.PI * 2;
        const len = k % 2 ? 4 : 7;
        for (let s = 0; s < len; s += 1) prect(ctx, cx + Math.cos(a) * (r + s), cy + Math.sin(a) * (r + s), 2, 2, k % 2 ? '#FFFFFF' : '#FFE07A');
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
        for (let i = 0; i < row.length; i += 1) if (row[i] === '#') ctx.fillRect(x0 + i * 2 - 2, y0 + j * 2 - 2, 6, 6);
    });
    rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i += 1) {
            if (row[i] !== '#') continue;
            ctx.fillStyle = j < rows.length / 2 && (dir === 'left' || dir === 'right') ? color : color;
            ctx.fillRect(x0 + i * 2, y0 + j * 2, 2, 2);
        }
    });
}

const COIN = ['.OOOO.', 'OYYYyO', 'OYWyyO', 'OYyyyO', 'OYyydO', '.OOOO.'];
/** Pièce de Hype (pixels x2) */
export function drawCoin(ctx, x, y) {
    const pal = { O: OUT, Y: '#FFE07A', y: '#FFC72C', d: '#C98A00', W: '#FFFFFF' };
    COIN.forEach((row, j) => {
        for (let i = 0; i < row.length; i += 1) {
            if (!pal[row[i]]) continue;
            ctx.fillStyle = pal[row[i]];
            ctx.fillRect(Math.round(x) + i * 2, Math.round(y) + j * 2, 2, 2);
        }
    });
}

/** Pastille d'un joueur masqué : sa couleur et son numéro de passage */
export function drawBadge(ctx, x, y, color, n) {
    pellipse(ctx, x, y, 8, 8, OUT);
    pellipse(ctx, x, y, 7, 7, color);
    pellipse(ctx, x - 1, y - 2, 4, 3, 'rgba(255,255,255,0.35)');
    if (n) drawText(ctx, String(n), x, y - 3, OUT, { font: 'tiny', outline: null, shadow: false });
}

/** Anneau au sol autour de la case du joueur actif */
export function drawRing(ctx, x, y, rx, ry, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    pring(ctx, x, y, rx, ry, color, 0.02);
    pring(ctx, x, y, rx + 1, ry + 1, color, 0.02);
    ctx.globalAlpha = 1;
}
