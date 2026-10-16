// Primitives pixel partagées par le décor, le moteur 3D (Mode 7) et les objets de jeu.
// Tout est dessiné avec fillRect sur des coordonnées entières : bords nets, sans lissage.

import { textSprite } from './pixelFont';

export const OUT = '#0d0b14';

export function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return [c, ctx];
}

export function R(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Ellipse pleine, ligne par ligne */
export function E(ctx, cx, cy, rx, ry, c) {
    if (rx <= 0 || ry <= 0) return;
    ctx.fillStyle = c;
    const y0 = Math.ceil(cy - ry - 0.5);
    const y1 = Math.floor(cy + ry - 0.5);
    for (let y = y0; y <= y1; y += 1) {
        const dy = (y + 0.5 - cy) / ry;
        if (Math.abs(dy) > 1) continue;
        const hw = rx * Math.sqrt(1 - dy * dy);
        const x0 = Math.round(cx - hw);
        const x1 = Math.round(cx + hw);
        if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1);
    }
}

/** Rectangle aux coins arrondis en escalier */
export function RR(ctx, x, y, w, h, r, c) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    ctx.fillStyle = c;
    for (let j = 0; j < h; j += 1) {
        const d = j < r ? r - j : j >= h - r ? j - (h - r - 1) : 0;
        const inset = d > 0 ? Math.round(r - Math.sqrt(Math.max(0, r * r - d * d))) : 0;
        ctx.fillRect(x + inset, y + j, w - inset * 2, 1);
    }
}

/** Anneau segmenté vu de dessus : colorOf(indice du segment, distance) → couleur ou null */
export function ring(ctx, cx, cy, rOut, rIn, n, colorOf, gap = 0.14) {
    for (let y = Math.floor(-rOut) - 1; y <= Math.ceil(rOut) + 1; y += 1) {
        for (let x = Math.floor(-rOut) - 1; x <= Math.ceil(rOut) + 1; x += 1) {
            const dx = x + 0.5;
            const dy = y + 0.5;
            const d = Math.hypot(dx, dy);
            if (d > rOut || d < rIn) continue;
            let a = Math.atan2(dx, -dy) / (Math.PI * 2);
            if (a < 0) a += 1;
            const f = a * n;
            const k = Math.floor(f);
            if (n > 1 && (f - k < gap / 2 || f - k > 1 - gap / 2)) continue;
            const c = colorOf(k, d);
            if (!c) continue;
            ctx.fillStyle = c;
            ctx.fillRect(Math.round(cx) + x, Math.round(cy) + y, 1, 1);
        }
    }
}

export function line(ctx, x0, y0, x1, y1, c, w = 1) {
    ctx.fillStyle = c;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i += 1) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n - w / 2 + 0.5), Math.round(y0 + ((y1 - y0) * i) / n - w / 2 + 0.5), w, w);
}

export function dashed(ctx, x0, y0, x1, y1, c, on = 3, off = 3) {
    ctx.fillStyle = c;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i += 1) if (i % (on + off) < on) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
}

export function dither(ctx, x, y, w, h, c, phase = 0) {
    ctx.fillStyle = c;
    for (let j = 0; j < h; j += 1) for (let i = (j + phase) % 2; i < w; i += 2) ctx.fillRect(x + i, y + j, 1, 1);
}

/** Texte en police bitmap (sérigraphie : petite police, sans contour) */
export function pixText(ctx, text, x, y, color, { font = 'bold', scale = 1, outline = OUT, shadow = true, align = 'center' } = {}) {
    const s = textSprite(String(text), color, { font, outline, shadow });
    const w = s.width * scale;
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.drawImage(s, Math.round(x0), Math.round(y), w, s.height * scale);
    return w;
}

export function silk(ctx, text, x, y, color, align = 'center', scale = 1) {
    return pixText(ctx, text, x, y, color, { font: 'tiny', outline: null, shadow: false, align, scale });
}

export function starIcon(ctx, x, y, c, k = 2) {
    const rows = ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '##...##'];
    rows.forEach((row, j) => { for (let i = 0; i < 7; i += 1) if (row[i] === '#') R(ctx, x - 3.5 * k + i * k, y - 3.5 * k + j * k, k, k, c); });
}

const ICONS = {
    '+': ['..##..', '..##..', '######', '######', '..##..', '..##..'],
    '-': ['......', '......', '######', '######', '......', '......'],
    v: ['##..##', '##..##', '.####.', '.####.', '..##..', '..##..'],
    '>': ['##....', '####..', '######', '######', '####..', '##....'],
    '?': ['.####.', '##..##', '...##.', '..##..', '......', '..##..'],
    '!': ['..##..', '..##..', '..##..', '..##..', '......', '..##..'],
};

/** Polygone plein, ligne par ligne (bords nets, sans lissage) */
export function P(ctx, pts, c) {
    ctx.fillStyle = c;
    const ys = pts.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys));
    const y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y < y1; y += 1) {
        const yc = y + 0.5;
        const xs = [];
        for (let i = 0; i < pts.length; i += 1) {
            const [ax, ay] = pts[i];
            const [bx, by] = pts[(i + 1) % pts.length];
            if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
            const xa = Math.round(xs[k]);
            const xb = Math.round(xs[k + 1]);
            if (xb > xa) ctx.fillRect(xa, y, xb - xa, 1);
        }
    }
}

/** Points d'une forme de case centrée sur (x, y), de rayon r */
export function shapePoints(shape, x, y, r) {
    const reg = (n, rot = -Math.PI / 2, rr = r) => Array.from({ length: n }, (_, i) => [x + Math.cos(rot + (i / n) * Math.PI * 2) * rr, y + Math.sin(rot + (i / n) * Math.PI * 2) * rr]);
    switch (shape) {
        case 'triangle': return [[x, y - r * 1.05], [x + r * 1.08, y + r * 0.8], [x - r * 1.08, y + r * 0.8]];
        case 'chevron': return [[x - r, y - r * 0.75], [x + r, y - r * 0.75], [x + r, y + r * 0.05], [x, y + r], [x - r, y + r * 0.05]];
        case 'arrow': return [[x - r * 0.85, y - r * 0.85], [x + r * 0.25, y - r * 0.85], [x + r, y], [x + r * 0.25, y + r * 0.85], [x - r * 0.85, y + r * 0.85]];
        case 'hexagon': return reg(6, 0);
        case 'diamond': return reg(4, -Math.PI / 2, r * 1.12);
        case 'square': return reg(4, -Math.PI / 4, r * 1.2);
        case 'star': return Array.from({ length: 10 }, (_, i) => {
            const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
            const rr = i % 2 ? r * 0.5 : r * 1.12;
            return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
        });
        default: return null; // cercle
    }
}
/** Pictogramme de case (+, -, v, >, * pour l'étoile) centré sur (x, y) */
export function icon(ctx, x, y, kind, color, k = 2) {
    const rows = ICONS[kind];
    if (!rows) { starIcon(ctx, x, y, color, k); return; }
    const w = rows[0].length * k;
    const h = rows.length * k;
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i += 1) if (row[i] === '#') R(ctx, x - w / 2 + i * k, y - h / 2 + j * k, k, k, color); });
}

export function hexMix(a, b, k) {
    const pa = parseInt(a.slice(1, 7), 16);
    const pb = parseInt(b.slice(1, 7), 16);
    const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
    return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

export const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
};
