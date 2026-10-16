// Personnages de Beatbox Party : pixel art « HD », vus de trois quarts.
//
// Chaque image est recomposée à partir d'un squelette (hanches, épaules, coudes,
// genoux) : les bras et les jambes suivent des cibles (cinématique inverse à deux os),
// ce qui permet beaucoup de poses sans dessiner chaque image à la main.
// Chaque partie (jambe, torse, tête, cheveux, bras) est tramée avec trois tons
// (ombre teintée de violet, base, lumière chaude venue d'en haut à gauche) et reçoit
// son propre contour, plus sombre que sa couleur : les parties se détachent comme sur
// un sprite dessiné à la main.
//
// Le micro se tient par la boule. En beatbox, la main l'enveloppe devant la bouche
// (le « cup »), le manche pointe vers le bas.
//
// Ce module ne dépend pas de React : il sert PixelCharacter.jsx et le plateau.

export const SPRITE_W = 64;
export const SPRITE_H = 96;
/** Point de contact des pieds avec le sol, dans le sprite */
export const FOOT_X = 32;
export const FOOT_Y = 89;
/** Haut des cheveux, debout */
export const HEAD_TOP = 22;
/** Hauteur du poing au sommet du saut qui frappe le dé */
export const DICE_HIT_Y = 6;

export const PLAYER_COLORS = ['#FFC72C', '#4C8DFF', '#F0533F', '#35C877'];

const W = SPRITE_W;
const H = SPRITE_H;
const OUT = '#120E26';
const BEAT = 0.625; // 96 battements par minute, comme la musique du plateau

// ---------------------------------------------------------------------------
// Couleurs : ombres tirées vers le violet, lumières vers le blanc chaud
// ---------------------------------------------------------------------------

const rgb = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
};
const hex = ([r, g, b]) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const lerp = (a, b, k) => {
    const A = rgb(a);
    const B = rgb(b);
    return hex([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]);
};
const dk = (c, k = 0.32) => lerp(c, '#1D1640', k);
const lt = (c, k = 0.3) => lerp(c, '#FFF4DC', k);
const line = (c) => lerp(c, '#140F2C', 0.62);

// ---------------------------------------------------------------------------
// Calques de pixels
// ---------------------------------------------------------------------------

class Layer {
    constructor() { this.m = new Map(); }

    px(x, y, c) {
        x = Math.round(x);
        y = Math.round(y);
        if (c && x >= 0 && y >= 0 && x < W && y < H) this.m.set(y * W + x, c);
        return this;
    }

    has(x, y) { return this.m.has(Math.round(y) * W + Math.round(x)); }

    del(x, y) { this.m.delete(Math.round(y) * W + Math.round(x)); return this; }

    rect(x, y, w, h, c) {
        x = Math.round(x);
        y = Math.round(y);
        for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) this.px(x + i, y + j, typeof c === 'function' ? c(i, j) : c);
        return this;
    }

    // Gabarit texte : une lettre par pixel, '.' transparent
    stamp(x, y, rows, pal) {
        x = Math.round(x);
        y = Math.round(y);
        rows.forEach((row, j) => {
            for (let i = 0; i < row.length; i += 1) {
                const c = pal[row[i]];
                if (row[i] !== '.' && c) this.px(x + i, y + j, typeof c === 'function' ? c(x + i, y + j) : c);
            }
        });
        return this;
    }

    // Ellipse ; shader(nx, ny, x, y) reçoit la normale (-1..1) et la position
    ellipse(cx, cy, rx, ry, shader) {
        for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y += 1) {
            for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x += 1) {
                const nx = (x + 0.5 - cx) / rx;
                const ny = (y + 0.5 - cy) / ry;
                if (nx * nx + ny * ny <= 1) this.px(x, y, typeof shader === 'function' ? shader(nx, ny, x, y) : shader);
            }
        }
        return this;
    }

    // Segment épais aux bouts arrondis (membres) ; shader(nx, ny, t)
    capsule(x0, y0, x1, y1, r0, r1, shader) {
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len2 = dx * dx + dy * dy || 1;
        const r = Math.max(r0, r1);
        for (let y = Math.floor(Math.min(y0, y1) - r - 1); y <= Math.ceil(Math.max(y0, y1) + r + 1); y += 1) {
            for (let x = Math.floor(Math.min(x0, x1) - r - 1); x <= Math.ceil(Math.max(x0, x1) + r + 1); x += 1) {
                const px = x + 0.5;
                const py = y + 0.5;
                const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2));
                const cx = x0 + dx * t;
                const cy = y0 + dy * t;
                const rr = r0 + (r1 - r0) * t;
                const ex = px - cx;
                const ey = py - cy;
                if (ex * ex + ey * ey <= rr * rr) this.px(x, y, typeof shader === 'function' ? shader(ex / rr, ey / rr, t) : shader);
            }
        }
        return this;
    }

    // Polygone ; shader(u, v) reçoit la position dans le cadre (0..1)
    poly(pts, shader) {
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        const minX = Math.floor(Math.min(...xs));
        const maxX = Math.ceil(Math.max(...xs));
        const minY = Math.floor(Math.min(...ys));
        const maxY = Math.ceil(Math.max(...ys));
        for (let y = minY; y <= maxY; y += 1) {
            for (let x = minX; x <= maxX; x += 1) {
                const px = x + 0.5;
                const py = y + 0.5;
                let inside = false;
                for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
                    const [xi, yi] = pts[i];
                    const [xj, yj] = pts[j];
                    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
                }
                if (inside) {
                    const u = (px - minX) / Math.max(1, maxX - minX);
                    const v = (py - minY) / Math.max(1, maxY - minY);
                    this.px(x, y, typeof shader === 'function' ? shader(u, v, x, y) : shader);
                }
            }
        }
        return this;
    }
}

class Sprite {
    constructor() { this.c = new Array(W * H).fill(null); }

    // Pose un calque, précédé de son contour (qui recouvre les calques du dessous)
    commit(layer, outline = OUT) {
        if (outline) {
            layer.m.forEach((_, k) => {
                const x = k % W;
                const y = (k - x) / W;
                for (let d = 0; d < 4; d += 1) {
                    const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
                    const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                    if (!layer.m.has(ny * W + nx)) this.c[ny * W + nx] = outline;
                }
            });
        }
        layer.m.forEach((c, k) => { this.c[k] = c; });
    }

    get(x, y) { return x < 0 || y < 0 || x >= W || y >= H ? null : this.c[y * W + x]; }
}

// Éclairage de volume : lumière en haut à gauche
const shade3 = (base, { hi = 0.3, sh = 0.34, edge = 0.42 } = {}) => {
    const H1 = lt(base, hi);
    const S1 = dk(base, sh);
    return (nx, ny) => {
        const v = -nx * 0.62 - ny * 0.78;
        if (v > edge) return H1;
        if (v < -0.3) return S1;
        return base;
    };
};

// ---------------------------------------------------------------------------
// Cinématique inverse à deux os
// ---------------------------------------------------------------------------

function ik(root, target, l1, l2, prefer) {
    const dx = target[0] - root[0];
    const dy = target[1] - root[1];
    const dist = Math.hypot(dx, dy);
    const d = Math.min(l1 + l2 - 0.01, Math.max(Math.abs(l1 - l2) + 0.01, dist || 0.01));
    const base = Math.atan2(dy, dx);
    const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    const j1 = [root[0] + Math.cos(base + a) * l1, root[1] + Math.sin(base + a) * l1];
    const j2 = [root[0] + Math.cos(base - a) * l1, root[1] + Math.sin(base - a) * l1];
    const score = (j) => (j[0] - root[0]) * prefer[0] + (j[1] - root[1]) * prefer[1];
    const joint = score(j1) >= score(j2) ? j1 : j2;
    const ang = Math.atan2(target[1] - joint[1], target[0] - joint[0]);
    return [joint, [joint[0] + Math.cos(ang) * l2, joint[1] + Math.sin(ang) * l2]];
}

const R = (p) => [Math.round(p[0]), Math.round(p[1])];

// ---------------------------------------------------------------------------
// Distribution
// ---------------------------------------------------------------------------

// Tête de trois quarts (regard vers la droite), 21 x 20 pixels
const HEAD = [
    '......sssssssss......',
    '....sssssssssssss....',
    '...sssssssssssssss...',
    '..sssssssssssssssss..',
    '.sssssssssssssssssss.',
    '.sssssssssssssssssss.',
    'sssssssssssssssssssss',
    'sssssssssssssssssssss',
    'sssssssssssssssssssss',
    'sssssssssssssssssssss',
    'sssssssssssssssssssss',
    'sssssssssssssssssssss',
    'sssssssssssssssssssss',
    '.ssssssssssssssssssss',
    '.sssssssssssssssssss.',
    '..ssssssssssssssssss.',
    '...sssssssssssssssss.',
    '.....sssssssssssssss.',
    '........ssssssssss...',
    '...........sssss.....',
];

// Texture bouclée (cheveux crépus, pompons) : base, reflets et creux
const curls = (c) => (nx, ny, x, y) => {
    const v = -nx * 0.6 - ny * 0.8;
    if (v > 0.55) return c.hairH;
    if (v < -0.35) return c.hairS;
    const k = (x * 3 + y * 5) % 7;
    if (k === 0) return c.hairS;
    if (k === 3 && v > 0.1) return c.hairH;
    return c.hair;
};

const CAST = {
    nova: {
        name: 'Nova', tagline: { fr: 'La reine du flow', en: 'Queen of flow' },
        skin: '#8D5A3B', hair: '#2A1A14', hairH: '#5A3B2C', hairS: '#160D0B', blush: '#B5584A',
        top: '#FFC72C', accent: '#24305E', pants: '#3A4C8C', shoe: '#F4F4F4', shoeA: '#E8402F', sole: '#C9CCD8',
        clothes: 'jersey',
        hairBack(L, hx, hy, c) {
            L.ellipse(hx + 3, hy + 1, 7, 6.5, curls(c));
        },
        hairFront(L, hx, hy, c) {
            L.ellipse(hx + 13, hy - 3, 6.5, 6, curls(c));
            L.stamp(hx - 1, hy - 1, [
                '....hhhhhhhhhhhh.....',
                '..hhhhhhhhhhhhhhhh...',
                '.hhhhhhhhhhhhhhhhhh..',
                'hhhhhhhhhhhhhhhhhhhh.',
                'hhhhhhhhhhhhhhhhhhh..',
                'hhhhhhhhhhhhhhhhhh...',
                'hhhhhhhhhhhhhhhh.....',
                'hhhhhhh..............',
                'hhhhhh...............',
                'hhhhh................',
                'hhhh.................',
                'hhh..................',
            ], { h: (x, y) => curls(c)(0, 0, x, y) });
        },
        extras(L, hx, hy) {
            // Créole dorée
            L.px(hx + 6, hy + 14, '#F2C230').px(hx + 5, hy + 15, '#F2C230').px(hx + 6, hy + 16, '#F2C230').px(hx + 7, hy + 15, '#C99400');
        },
        torsoDetail(L, b, c) {
            L.rect(b.nx - 3, b.ny + 1, 6, 1, c.accent);
            L.rect(b.nx - 2, b.ny + 2, 4, 1, c.accent);
            L.rect(b.x0 + 1, b.y1 - 3, b.x1 - b.x0 - 1, 2, c.accent);
            // L'onde sonore du site, en marine sur le maillot
            [2, 4, 6, 3, 5, 2].forEach((h, i) => L.rect(b.nx - 4 + i * 2, b.ny + 8 - Math.floor(h / 2), 1, h, c.accent));
        },
    },
    grizz: {
        name: 'Grizz', tagline: { fr: 'Basses de tonnerre', en: 'Thunder bass' },
        skin: '#E9B892', hair: '#5B3A26', hairH: '#7A5238', hairS: '#3E2718', blush: '#E07B6E',
        hat: '#E8402F', top: '#7D869E', accent: '#F2C230', pants: '#2C3248', shoe: '#2B2F42', shoeA: '#FFC72C', sole: '#8C93AD',
        clothes: 'hoodie', wide: 1, brows: 'thick', beard: true,
        hairFront(L, hx, hy, c) {
            const hat = shade3(c.hat);
            // Bonnet en laine, côtes verticales, revers épais
            L.poly([[hx - 1, hy + 5], [hx + 1, hy - 2], [hx + 6, hy - 5], [hx + 14, hy - 5], [hx + 19, hy - 2], [hx + 21, hy + 4]], (u, v, x) => (x % 3 === 0 ? dk(c.hat, 0.2) : hat(u * 2 - 1, v * 2 - 1)));
            L.rect(hx - 1, hy + 3, 23, 4, (i, j) => (j === 0 ? lt(c.hat, 0.25) : i % 2 ? dk(c.hat, 0.25) : dk(c.hat, 0.1)));
            L.ellipse(hx + 9, hy - 6, 3, 2.6, shade3('#F4F4F4'));
            L.rect(hx, hy + 7, 4, 4, c.hair);
        },
        torsoDetail(L, b, c) {
            // Capuche ramassée dans le dos, poche kangourou, cordons
            L.ellipse(b.nx - 6, b.ny + 1, 4, 3, shade3(dk(c.top, 0.1)));
            L.rect(b.x0 + 3, b.y1 - 7, b.x1 - b.x0 - 5, 5, (i, j) => (j === 0 ? dk(c.top, 0.35) : dk(c.top, 0.15)));
            L.rect(b.nx - 2, b.ny + 2, 1, 6, c.accent).rect(b.nx + 2, b.ny + 2, 1, 5, c.accent);
            L.px(b.nx - 2, b.ny + 8, '#FFFFFF').px(b.nx + 2, b.ny + 7, '#FFFFFF');
        },
    },
    kick: {
        name: 'Kick', tagline: { fr: 'Toujours à fond', en: 'Always full speed' },
        skin: '#D9A27A', hair: '#3B2416', hairH: '#5A3A26', hairS: '#24150C', blush: '#E07B6E',
        hat: '#4C8DFF', top: '#F5A23A', accent: '#FFFFFF', pants: '#3A3F55', shoe: '#4C8DFF', shoeA: '#FFFFFF', sole: '#E8ECF7',
        clothes: 'tee', sleeves: 'short', freckles: true,
        hairFront(L, hx, hy, c) {
            const hat = shade3(c.hat);
            // Casquette à l'envers : dôme, visière derrière la tête, ouverture de la sangle
            L.poly([[hx - 1, hy + 6], [hx, hy], [hx + 5, hy - 4], [hx + 14, hy - 4], [hx + 19, hy - 1], [hx + 21, hy + 5]], (u, v) => hat(u * 2 - 1.2, v * 2 - 1));
            L.poly([[hx - 7, hy + 5], [hx - 1, hy + 2], [hx + 2, hy + 6], [hx - 6, hy + 8]], dk(c.hat, 0.3));
            L.rect(hx + 1, hy + 3, 4, 2, c.hair);
            L.rect(hx - 1, hy + 5, 22, 1, dk(c.hat, 0.35));
            L.px(hx + 9, hy - 3, lt(c.hat, 0.5)).px(hx + 10, hy - 3, lt(c.hat, 0.5));
            L.rect(hx + 13, hy + 6, 6, 1, c.hair).rect(hx + 16, hy + 7, 3, 1, c.hair);
            L.rect(hx, hy + 6, 5, 5, c.hair);
        },
        torsoDetail(L, b, c) {
            L.rect(b.nx - 3, b.ny + 1, 7, 1, dk(c.top, 0.3));
            L.stamp(b.nx - 1, b.ny + 5, ['www', 'w.w', 'www', 'w.w', 'www'], { w: c.accent });
        },
    },
    lila: {
        name: 'Lila', tagline: { fr: 'Loopeuse de génie', en: 'Loop wizard' },
        skin: '#C68863', hair: '#1E1512', hairH: '#4A3A33', hairS: '#100A08', blush: '#D9715F',
        top: '#35C877', accent: '#FFF3D6', pants: '#2A3045', shoe: '#FF86B4', shoeA: '#FFFFFF', sole: '#F4F4F4', phones: '#FF86B4',
        clothes: 'bomber',
        hairBack(L, hx, hy, c) {
            // Tresses dans le dos
            [hx + 1, hx + 4].forEach((x, k) => {
                L.rect(x, hy + 8, 3, 22 - k * 2, (i, j) => (j % 3 === 2 ? c.hairH : i === 2 ? c.hairS : c.hair));
                L.rect(x, hy + 30 - k * 2, 3, 2, '#F2C230');
            });
        },
        hairFront(L, hx, hy, c) {
            L.stamp(hx - 1, hy - 1, [
                '.....hhhhhhhhhh......',
                '...hhhhhHHhhhhhhh....',
                '..hhhhHHhhhhhhhhhh...',
                '.hhhhhhhhhhhhhhhhhh..',
                'hhhhhhhhhhhhhhhhhhhh.',
                'hhhhhhhhhhhhh.hhhhhh.',
                'hhhhhhhhhhhh....hhh..',
                'hhhhhhhh.............',
                'hhhhhhh..............',
                'hhhhhh...............',
                'hhhhhh...............',
                'hhhhh................',
                'hhhh.................',
            ], { h: c.hair, H: c.hairH });
            // Casque audio sur la tête
            const band = shade3('#3A3F55');
            L.capsule(hx + 2, hy + 4, hx + 8, hy - 3, 1.3, 1.3, band);
            L.capsule(hx + 8, hy - 3, hx + 14, hy - 2, 1.3, 1.3, band);
            L.ellipse(hx + 4, hy + 10, 3.2, 4.2, shade3(c.phones));
            L.rect(hx + 3, hy + 8, 2, 4, dk(c.phones, 0.35));
        },
        torsoDetail(L, b, c) {
            L.rect(b.nx - 3, b.ny, 7, 2, (i) => (i % 2 ? dk(c.top, 0.3) : c.accent));
            L.rect(b.nx + 1, b.ny + 2, 1, b.y1 - b.ny - 3, '#C9CCD8');
            L.rect(b.x0 + 1, b.y1 - 2, b.x1 - b.x0 - 1, 2, (i) => (i % 2 ? dk(c.top, 0.3) : c.accent));
            L.stamp(b.x0 + 3, b.ny + 5, ['.y.', 'yyy', '.y.'], { y: '#FFC72C' });
            L.rect(b.nx + 3, b.ny + 7, 2, 2, '#FF86B4');
        },
    },
    robox: {
        name: 'R0-B0X', tagline: { fr: 'Boîte à rythmes ambulante', en: 'Walking drum machine' },
        robot: true, skin: '#B9C3DD', metal: '#B9C3DD', screen: '#1C2240', led: '#5FE0C8',
        top: '#B9C3DD', accent: '#5FE0C8', pants: '#8E9AB8', shoe: '#3A4466', shoeA: '#5FE0C8', sole: '#262C48',
        clothes: 'robot',
        torsoDetail(L, b, c, p) {
            // Haut-parleur sur le torse : la membrane bat avec le beatbox
            const pulse = p.speaker || 0;
            L.ellipse(b.nx, b.ny + 8, 4.5, 4.5, (nx, ny) => (nx * nx + ny * ny > 0.62 ? dk(c.metal, 0.5) : '#262C48'));
            L.ellipse(b.nx, b.ny + 8, 2 + pulse, 2 + pulse, (nx, ny) => (nx + ny < -0.4 ? '#5A6488' : '#3A4466'));
            L.px(b.nx, b.ny + 8, c.led);
            L.px(b.x0 + 2, b.ny + 2, dk(c.metal, 0.45)).px(b.x1 - 2, b.ny + 2, dk(c.metal, 0.45));
            L.rect(b.x0 + 1, b.y1 - 3, b.x1 - b.x0 - 1, 1, dk(c.metal, 0.4));
        },
    },
    mamie: {
        name: 'Mamie Snare', tagline: { fr: 'Cinquante ans de caisse claire', en: 'Fifty years of snare' },
        skin: '#F3D2B8', hair: '#D9DDE8', hairH: '#FFFFFF', hairS: '#A9B0C4', blush: '#EE8A8F',
        top: '#5FE0C8', accent: '#FFF3D6', pants: '#5B4A6E', shoe: '#F4F4F4', shoeA: '#5FE0C8', sole: '#C9CCD8',
        clothes: 'track', shades: true,
        hairFront(L, hx, hy, c) {
            // Chignon, mèches ondulées
            L.ellipse(hx + 5, hy - 2, 5, 4.4, curls(c));
            L.stamp(hx - 1, hy, [
                '....hhhhhhhhhhhh.....',
                '..hhhhHhhhhHhhhhhh...',
                '.hhhhhhhhhhhhhhhhhh..',
                'hhhhhhhhhhhhhhhhhhhh.',
                'hhhhhhhhhHhhhhhhhhh..',
                'hhhhhhhhhhhhhhhhhh...',
                'hhhhhhhh..hhh..hh....',
                'hhhhhhh..............',
                'hhhhhhh..............',
                'hhhhhh...............',
                'hhhhh................',
            ], { h: (x, y) => ((x + y) % 4 === 0 ? c.hairS : c.hair), H: c.hairH });
        },
        torsoDetail(L, b, c) {
            L.rect(b.nx + 1, b.ny, 1, b.y1 - b.ny - 1, '#C9CCD8');
            L.rect(b.nx - 3, b.ny, 3, 2, c.accent).rect(b.nx + 2, b.ny, 3, 2, c.accent);
            L.rect(b.x0, b.ny + 3, 1, b.y1 - b.ny - 4, c.accent);
        },
    },
    flex: {
        name: 'Flex', tagline: { fr: 'Technique et dent en or', en: 'Tech and a gold tooth' },
        skin: '#6B4028', hair: '#16100D', hairH: '#3A2E28', hairS: '#0B0806', blush: '#8C4A3A',
        top: '#F0533F', accent: '#FFFFFF', pants: '#F0533F', shoe: '#FFFFFF', shoeA: '#16100D', sole: '#C9CCD8',
        clothes: 'track', goldTooth: true, brows: 'sharp', pantsStripe: '#FFFFFF',
        hairFront(L, hx, hy, c) {
            // Coupe « flat top » : un bloc net, dégradé sur les côtés
            L.rect(hx + 1, hy - 7, 19, 9, (i, j) => (j === 0 ? c.hairH : i > 16 ? c.hairS : (i + j) % 5 === 0 ? c.hairH : c.hair));
            L.rect(hx, hy + 1, 4, 9, (i, j) => ((i + j) % 2 ? c.hairS : c.hair));
            L.rect(hx + 4, hy + 2, 15, 2, c.hair);
            L.rect(hx + 16, hy + 4, 3, 1, c.hair);
        },
        torsoDetail(L, b, c) {
            L.rect(b.nx + 1, b.ny + 1, 1, b.y1 - b.ny - 2, '#FFFFFF');
            L.rect(b.nx - 3, b.ny, 8, 2, dk(c.top, 0.3));
            // Chaîne en or
            for (let i = 0; i <= 8; i += 1) L.px(b.nx - 4 + i, b.ny + 2 + Math.round(Math.sin((i / 8) * Math.PI) * 3), i % 2 ? '#F2C230' : '#C99400');
            L.rect(b.nx, b.ny + 5, 2, 2, '#FFC72C');
        },
    },
    mimi: {
        name: 'Mimi', tagline: { fr: 'Mascotte officielle', en: 'Official mascot' },
        skin: '#F6D0B0', hair: '#6B3A26', hairH: '#8A5238', hairS: '#4A2618', blush: '#F28FA8',
        top: '#FF86B4', accent: '#FFD3E4', pants: '#FFFFFF', shoe: '#FF86B4', shoeA: '#FFFFFF', sole: '#F4F4F4',
        clothes: 'hoodie', whiskers: true,
        hairBack(L, hx, hy, c) {
            // Capuche de chat, derrière la tête
            const hood = shade3(c.top);
            L.ellipse(hx + 9, hy + 8, 12.5, 12, hood);
            L.poly([[hx - 2, hy - 1], [hx + 1, hy - 10], [hx + 6, hy - 3]], hood);
            L.poly([[hx + 13, hy - 3], [hx + 19, hy - 10], [hx + 21, hy + 1]], hood);
            L.poly([[hx + 1, hy - 2], [hx + 2, hy - 7], [hx + 5, hy - 3]], c.accent);
            L.poly([[hx + 15, hy - 3], [hx + 18, hy - 7], [hx + 19, hy]], c.accent);
        },
        hairFront(L, hx, hy, c) {
            L.stamp(hx + 2, hy + 1, [
                '...hhhhhhhhhhhh....',
                '.hhhhhhhhhhhhhhhhh.',
                'hhhhhh.hhhhh.hhhhhh',
                'hhhh....hhh...hhh..',
                'hhh......h.........',
            ], { h: c.hair });
            // Bord de la capuche autour du visage
            L.capsule(hx + 1, hy + 2, hx + 9, hy - 1, 1.4, 1.4, dk(c.top, 0.15));
            L.capsule(hx + 9, hy - 1, hx + 19, hy + 2, 1.4, 1.4, dk(c.top, 0.15));
        },
        torsoDetail(L, b, c) {
            L.rect(b.x0 + 3, b.y1 - 7, b.x1 - b.x0 - 5, 5, (i, j) => (j === 0 ? dk(c.top, 0.35) : dk(c.top, 0.12)));
            L.rect(b.nx - 2, b.ny + 2, 1, 5, '#FFFFFF').rect(b.nx + 2, b.ny + 2, 1, 4, '#FFFFFF');
        },
    },
};

// Personnages du décor (non jouables)
const NPCS = {
    inge: {
        name: 'Ingé son', skin: '#B57F59', hair: '#2A1A14', hairH: '#4A3326', hairS: '#160D0B', blush: '#C86A5A',
        hat: '#262B3F', top: '#1E2234', accent: '#FFC72C', pants: '#3A3F55', shoe: '#E8ECF7', shoeA: '#262B3F', sole: '#8C93AD',
        clothes: 'tee', brows: 'thick',
        hairFront(L, hx, hy, c) {
            const hat = shade3(c.hat);
            // Casquette visière devant, casque autour du cou
            L.poly([[hx - 1, hy + 6], [hx, hy], [hx + 5, hy - 4], [hx + 14, hy - 4], [hx + 19, hy - 1], [hx + 21, hy + 5]], (u, v) => hat(u * 2 - 1.2, v * 2 - 1));
            L.poly([[hx + 15, hy + 3], [hx + 27, hy + 4], [hx + 27, hy + 6], [hx + 15, hy + 7]], dk(c.hat, 0.2));
            L.rect(hx - 1, hy + 5, 22, 1, dk(c.hat, 0.35));
            L.rect(hx + 6, hy - 1, 6, 3, c.accent);
            L.rect(hx, hy + 6, 5, 5, c.hair);
        },
        torsoDetail(L, b, c) {
            const band = shade3('#3A3F55');
            L.capsule(b.nx - 6, b.ny + 1, b.nx + 6, b.ny + 1, 1.4, 1.4, band);
            L.ellipse(b.nx - 7, b.ny + 3, 2.6, 3.2, shade3('#E8402F'));
            L.ellipse(b.nx + 7, b.ny + 3, 2.6, 3.2, shade3('#E8402F'));
            // « CREW » en jaune
            L.rect(b.nx - 4, b.ny + 7, 9, 3, (i, j) => ((i + j) % 2 ? c.accent : c.top));
        },
    },
};
// Le voleur de flow : capuche rabattue, lunettes noires, chaîne en or
NPCS.thief = {
    name: 'Voleur de flow', skin: '#9A6446', hair: '#141019', hairH: '#2A2230', hairS: '#0B080E', blush: '#B5644F',
    top: '#2E2742', accent: '#FFC72C', pants: '#22252F', shoe: '#E8402F', shoeA: '#141019', sole: '#E8ECF7',
    clothes: 'hoodie', shades: true, goldTooth: true, brows: 'sharp',
    hairBack(L, hx, hy, c) {
        const hood = shade3(c.top);
        L.ellipse(hx + 9, hy + 7, 13, 12.5, hood);
    },
    hairFront(L, hx, hy, c) {
        L.stamp(hx + 3, hy + 2, [
            '..hhhhhhhhhhhhh...',
            'hhhhhhhhhhhhhhhhh.',
            'hhhhh......hhhhhh.',
        ], { h: c.hair });
        // Bord de la capuche, rabattue sur le front
        L.capsule(hx, hy + 4, hx + 9, hy - 2, 1.6, 1.6, dk(c.top, 0.2));
        L.capsule(hx + 9, hy - 2, hx + 20, hy + 3, 1.6, 1.6, dk(c.top, 0.2));
    },
    torsoDetail(L, b, c) {
        // Chaîne en or et poche kangourou
        L.capsule(b.nx - 5, b.ny + 2, b.nx, b.ny + 6, 0.8, 0.8, c.accent);
        L.capsule(b.nx, b.ny + 6, b.nx + 5, b.ny + 2, 0.8, 0.8, c.accent);
        L.rect(b.nx - 4, b.y1 - 9, 9, 4, dk(c.top, 0.25));
    },
};
// La vendeuse du stand de merch : bonnet jaune, tee-shirt du stand
NPCS.merch = {
    name: 'Merch', skin: '#E2AE86', hair: '#7A2E1C', hairH: '#9A4430', hairS: '#4E1C10', blush: '#E07B6E',
    hat: '#FFC72C', top: '#35C877', accent: '#FFFFFF', pants: '#2C3248', shoe: '#FFFFFF', shoeA: '#35C877', sole: '#8C93AD',
    clothes: 'tee', brows: 'up',
    hairFront(L, hx, hy, c) {
        const hat = shade3(c.hat);
        L.poly([[hx - 1, hy + 5], [hx + 1, hy - 2], [hx + 6, hy - 5], [hx + 14, hy - 5], [hx + 19, hy - 2], [hx + 21, hy + 4]], (u, v, x) => (x % 3 === 0 ? dk(c.hat, 0.2) : hat(u * 2 - 1, v * 2 - 1)));
        L.rect(hx - 1, hy + 3, 23, 4, (i, j) => (j === 0 ? lt(c.hat, 0.25) : i % 2 ? dk(c.hat, 0.25) : dk(c.hat, 0.1)));
        L.rect(hx, hy + 7, 4, 5, c.hair);
        L.rect(hx + 17, hy + 7, 3, 6, c.hair);
    },
    torsoDetail(L, b, c) {
        L.rect(b.nx - 3, b.ny + 4, 7, 4, c.accent);
        L.rect(b.nx - 2, b.ny + 5, 5, 2, '#FFC72C');
    },
};
const lookup = (id) => CAST[id] || NPCS[id] || CAST.nova;

export const CHARACTERS = Object.entries(CAST).map(([id, c]) => ({ id, name: c.name, tagline: c.tagline, color: c.top }));
export const CHARACTER_IDS = Object.keys(CAST);
export const getCharacter = (id) => (CAST[id] ? { id, ...CAST[id] } : { id: 'nova', ...CAST.nova });

// ---------------------------------------------------------------------------
// Parties du corps
// ---------------------------------------------------------------------------

const EYE = '#1A1530';
const WHITE = '#FFFFFF';

function drawHead(L, c, hx, hy, p) {
    const sk = c.skin;
    const skS = dk(sk, 0.3);
    if (c.robot) {
        // Tête-écran : coque en métal, visage en LED
        const metal = shade3(c.metal, { hi: 0.4 });
        L.poly([[hx + 1, hy + 1], [hx + 20, hy], [hx + 21, hy + 17], [hx + 2, hy + 18], [hx, hy + 9]], (u, v) => metal(u * 2 - 1, v * 2 - 1));
        L.rect(hx + 5, hy + 4, 14, 11, c.screen);
        L.rect(hx + 5, hy + 4, 14, 1, '#2C3460');
        L.rect(hx + 1, hy + 7, 3, 6, dk(c.metal, 0.3));
        L.rect(hx + 2, hy + 8, 1, 4, c.led);
        L.capsule(hx + 10, hy, hx + 8, hy - 5, 0.8, 0.8, '#3A4466');
        L.ellipse(hx + 8, hy - 6.5, 1.8, 1.8, p.blink ? '#2B7F72' : c.led);
        const led = c.led;
        const eyes = p.eyes || 'open';
        [[hx + 8, 3], [hx + 14, 3]].forEach(([x, w]) => {
            if (eyes === 'happy') L.px(x, hy + 8, led).px(x + 1, hy + 7, led).px(x + 2, hy + 8, led);
            else if (eyes === 'blink' || eyes === 'closed') L.rect(x, hy + 8, w, 1, led);
            else if (eyes === 'wide') L.rect(x, hy + 6, w, 4, led).px(x + 1, hy + 7, c.screen).px(x + 1, hy + 8, c.screen);
            else if (eyes === 'sad') L.px(x, hy + 7, led).px(x + 1, hy + 8, led).px(x + 2, hy + 8, led);
            else L.rect(x + (p.look || 0), hy + 6 + (p.lookY || 0), 2, 3, led);
        });
        const bars = {
            smile: [1, 1, 2, 2, 1], grin: [1, 2, 3, 2, 1], sad: [2, 1, 1, 1, 2], O: [2, 3, 3, 3, 2], shout: [2, 3, 3, 3, 2],
            B: [1, 2, 3, 2, 1], K: [3, 2, 1, 2, 3], t: [1, 1, 3, 1, 1], Pf: [2, 3, 2, 3, 2], line: [1, 1, 1, 1, 1],
        }[p.mouth] || [1, 1, 2, 2, 1];
        bars.forEach((h, i) => L.rect(hx + 9 + i * 2, hy + 14 - h, 1, h, led));
        return;
    }

    // Peau, ombre sous la mâchoire et sur la joue qui tourne
    L.stamp(hx, hy, HEAD, { s: (x, y) => {
        const i = x - hx;
        const j = y - hy;
        if (j >= 17 || (j >= 15 && i < 8) || i === 20 || (i === 19 && j >= 14)) return skS;
        if (j <= 6 && i <= 4) return lt(sk, 0.18);
        return sk;
    } });
    // Nez
    L.px(hx + 21, hy + 11, sk).px(hx + 21, hy + 12, skS);
    // Joues gonflées (le « Pf »)
    if (p.cheeks) L.rect(hx + 20, hy + 13, 2, 3, sk).px(hx + 21, hy + 15, skS);
    // Oreille (cachée par la capuche de Mimi)
    if (!c.whiskers) L.px(hx + 6, hy + 9, skS).px(hx + 5, hy + 10, skS).px(hx + 5, hy + 11, skS).px(hx + 5, hy + 12, skS).px(hx + 6, hy + 13, skS).px(hx + 7, hy + 11, skS);
    // Taches de rousseur, joues
    if (c.freckles) L.px(hx + 11, hy + 13, skS).px(hx + 13, hy + 14, skS).px(hx + 17, hy + 13, skS);
    L.rect(hx + 10, hy + 14, 3, 1, c.blush).px(hx + 18, hy + 14, c.blush);
    if (c.whiskers) {
        L.rect(hx + 8, hy + 13, 2, 1, dk(sk, 0.55)).rect(hx + 8, hy + 15, 2, 1, dk(sk, 0.55));
        L.rect(hx + 19, hy + 13, 2, 1, dk(sk, 0.55));
    }

    // Yeux
    const look = p.look || 0;
    const ly = p.lookY || 0;
    const eyes = p.eyes || 'open';
    const near = hx + 10 + look;
    const far = hx + 16 + look;
    if (c.shades) {
        L.rect(hx + 9, hy + 9, 5, 4, EYE).rect(hx + 15, hy + 9, 4, 4, EYE).rect(hx + 14, hy + 10, 1, 1, EYE);
        L.rect(hx + 7, hy + 10, 2, 1, EYE);
        L.px(hx + 10, hy + 10, '#7C8AC0').px(hx + 16, hy + 10, '#7C8AC0');
        if (eyes === 'happy' || eyes === 'closed') L.px(hx + 11, hy + 12, '#3A3F66');
    } else if (eyes === 'happy') {
        [[near, 3], [far, 2]].forEach(([x, w]) => {
            L.px(x, hy + 11, EYE).rect(x + (w > 2 ? 1 : 0), hy + 10, w > 2 ? 1 : 1, 1, EYE).px(x + w - 1 + (w > 2 ? 0 : 1), hy + 11, EYE);
        });
    } else if (eyes === 'blink' || eyes === 'closed') {
        L.rect(near, hy + 11, 3, 1, EYE).rect(far, hy + 11, 2, 1, EYE);
    } else if (eyes === 'wink') {
        L.rect(near, hy + 11, 3, 1, EYE).px(near, hy + 10, EYE);
        L.rect(far, hy + 9, 2, 4, EYE).px(far, hy + 9, WHITE);
    } else if (eyes === 'wide') {
        L.rect(near, hy + 8, 3, 5, EYE).px(near, hy + 8, WHITE).px(near, hy + 9, WHITE);
        L.rect(far, hy + 8, 2, 5, EYE).px(far, hy + 8, WHITE);
    } else if (eyes === 'sad') {
        L.rect(near, hy + 10 + ly, 3, 3, EYE).px(near, hy + 10 + ly, WHITE);
        L.rect(far, hy + 10 + ly, 2, 3, EYE);
    } else if (eyes === 'focus') {
        L.rect(near, hy + 10, 3, 2, EYE).rect(far, hy + 10, 2, 2, EYE);
    } else {
        L.rect(near, hy + 9 + ly, 3, 4, EYE).px(near, hy + 9 + ly, WHITE).px(near + 1, hy + 9 + ly, WHITE);
        L.rect(far, hy + 9 + ly, 2, 4, EYE).px(far, hy + 9 + ly, WHITE);
    }

    // Sourcils
    if (!c.shades) {
        const bc = c.hair || EYE;
        const by = hy + 7 + (p.brows === 'up' ? -1 : 0);
        if (p.brows === 'sad') {
            L.px(near, by + 1, bc).rect(near + 1, by, 2, 1, bc);
            L.rect(far, by, 2, 1, bc).px(far + 2, by + 1, bc);
        } else if (p.brows === 'angry' || c.brows === 'sharp') {
            L.rect(near, by, 2, 1, bc).px(near + 2, by + 1, bc);
            L.px(far - 1, by + 1, bc).rect(far, by, 2, 1, bc);
        } else if (c.brows === 'thick') {
            L.rect(near - 1, by, 4, 2, bc).rect(far, by, 3, 2, bc);
        } else {
            L.rect(near, by, 3, 1, bc).rect(far, by, 2, 1, bc);
        }
    }

    // Barbe
    if (c.beard) {
        L.stamp(hx + 6, hy + 12, [
            'b.............b',
            'bb...........bb',
            'bbb.........bbb',
            'bbbbb.....bbbbb',
            '.bbbbbbbbbbbbbb',
            '..bbbbbbbbbbbb.',
            '.....bbbbbbbb..',
            '.......bbbb....',
        ], { b: (x, y) => ((x + y) % 3 === 0 ? c.hairS : c.hair) });
    }

    // Bouche
    const mx = hx + 15;
    const my = hy + 15;
    const M = '#4A1424';
    const T = '#E8667A';
    switch (p.mouth) {
        case 'grin':
            L.rect(mx, my, 5, 1, WHITE).px(mx - 1, my, EYE).px(mx + 5, my, EYE);
            if (c.goldTooth) L.px(mx + 3, my, '#F2C230');
            L.rect(mx, my + 1, 5, 1, M).rect(mx + 1, my + 1, 3, 1, T).rect(mx + 1, my + 2, 3, 1, EYE);
            break;
        case 'shout':
            L.rect(mx, my - 1, 4, 1, EYE).rect(mx - 1, my, 6, 3, M).rect(mx, my, 4, 1, WHITE).rect(mx, my + 2, 4, 1, T).rect(mx, my + 3, 4, 1, EYE);
            break;
        case 'O':
            L.rect(mx + 1, my - 1, 2, 1, EYE).rect(mx, my, 1, 2, EYE).rect(mx + 3, my, 1, 2, EYE).rect(mx + 1, my, 2, 2, M).rect(mx + 1, my + 2, 2, 1, EYE);
            break;
        case 'sad':
            L.rect(mx + 1, my, 3, 1, EYE).px(mx, my + 1, EYE).px(mx + 4, my + 1, EYE);
            break;
        case 'line':
            L.rect(mx, my + 1, 4, 1, EYE);
            break;
        case 'smirk':
            L.rect(mx, my + 1, 3, 1, EYE).px(mx + 3, my, EYE);
            if (c.goldTooth) L.px(mx + 2, my + 1, '#F2C230');
            break;
        default: // sourire
            L.px(mx, my, EYE).rect(mx + 1, my + 1, 3, 1, EYE).px(mx + 4, my, EYE);
    }
    if (c.extras) c.extras(L, hx, hy, c);
}

// Torse de trois quarts : épaule proche à gauche, épaule lointaine à droite
function drawTorso(L, c, neck, hip, p) {
    const w = c.wide || 0;
    const pts = [
        [neck[0] - 7 - w, neck[1] + 2],
        [neck[0] + 6 + w, neck[1] + 1],
        [neck[0] + 8 + w, neck[1] + 4],
        [hip[0] + 7 + w, hip[1] + 1],
        [hip[0] - 6 - w, hip[1] + 1],
        [neck[0] - 9 - w, neck[1] + 5],
    ];
    const base = c.robot ? c.metal : c.top;
    const hi = lt(base, 0.3);
    const sh = dk(base, 0.3);
    L.poly(pts, (u, v) => {
        if (u < 0.12 && v < 0.85) return hi;
        if (u > 0.8 || v > 0.9) return sh;
        return base;
    });
    const box = { x0: Math.round(Math.min(...pts.map((q) => q[0]))), x1: Math.round(Math.max(...pts.map((q) => q[0]))), y0: Math.round(neck[1]), y1: Math.round(hip[1] + 1), nx: Math.round(neck[0]), ny: Math.round(neck[1]) };
    if (c.clothes === 'track') {
        // Bandes sur les épaules
        L.capsule(pts[5][0] + 1, pts[5][1], pts[0][0] + 2, pts[0][1], 0.6, 0.6, c.accent);
    }
    if (c.torsoDetail) c.torsoDetail(L, box, c, p);
    // Ceinture / haut du pantalon
    L.rect(hip[0] - 6 - w, hip[1], 14 + w * 2, 2, (i, j) => (j === 0 ? dk(c.pants, 0.25) : c.pants));
}

function drawLeg(L, c, hipJ, foot) {
    const [knee, ankle] = ik(hipJ, foot, 9, 9.5, [1, 0]);
    const pants = shade3(c.pants);
    L.capsule(hipJ[0], hipJ[1], knee[0], knee[1], 3.1, 2.8, pants);
    L.capsule(knee[0], knee[1], ankle[0], ankle[1], 2.8, 2.5, pants);
    if (c.pantsStripe) L.capsule(hipJ[0] - 2, hipJ[1] + 1, ankle[0] - 2, ankle[1] - 2, 0.5, 0.5, c.pantsStripe);
    return R(ankle);
}

// Basket vue de profil, bout vers la droite
function drawShoe(L, c, ankle, toeUp = 0) {
    const [ax, ay] = ankle;
    const shoe = c.shoe;
    L.stamp(ax - 3, ay - 1 - toeUp, [
        '..ssss....',
        '.ssssssa..',
        'ssssssssss',
        'ssssssssss',
        'wwwwwwwwww',
    ], {
        s: (x, y) => (y === ay - 1 - toeUp ? lt(shoe, 0.25) : x >= ax + 4 ? dk(shoe, 0.12) : shoe),
        a: c.shoeA,
        w: c.sole,
    });
    L.px(ax - 1, ay + 1 - toeUp, c.shoeA).px(ax + 1, ay + 1 - toeUp, c.shoeA);
}

// Main : relâchée, poing, doigt pointé, paume ouverte
function drawHand(L, c, at, shape, dir = [1, 0]) {
    const sk = c.robot ? dk(c.metal, 0.1) : c.skin;
    const skS = dk(sk, 0.28);
    const [x, y] = R(at);
    if (shape === 'palm') {
        L.rect(x - 2, y - 2, 5, 5, (i, j) => (i === 4 || j === 4 ? skS : sk));
        L.px(x - 2, y - 3, sk).px(x, y - 3, sk).px(x + 2, y - 3, sk);
        L.px(x - 3, y, sk);
        return;
    }
    L.rect(x - 2, y - 2, 4, 4, (i, j) => (i === 3 || j === 3 ? skS : sk));
    L.px(x - 1, y - 2, lt(sk, 0.2));
    if (shape === 'point') {
        const [dx, dy] = dir;
        for (let k = 2; k <= 4; k += 1) L.px(x + Math.round(dx * k), y + Math.round(dy * k) - 1, sk);
    }
}

// Micro tenu par la boule ; le manche part dans la direction `grip`
function drawMic(L, ball, grip, c) {
    const [bx, by] = R(ball);
    const [gx, gy] = grip;
    const len = Math.hypot(gx, gy) || 1;
    const ux = gx / len;
    const uy = gy / len;
    L.capsule(bx + ux * 3, by + uy * 3, bx + ux * 10, by + uy * 10, 1.3, 1.1, (nx) => (nx < -0.3 ? '#4A5070' : '#262A40'));
    L.px(bx + ux * 4, by + uy * 4, '#FFC72C').px(bx + ux * 4 + 1, by + uy * 4, '#C99400');
    L.ellipse(bx + 0.5, by + 0.5, 3.4, 3.4, (nx, ny, x, y) => {
        if (nx + ny > 0.9) return '#7E89AE';
        if (nx + ny < -0.9) return '#F4F7FF';
        return (x + y) % 2 ? '#C3CBE6' : '#E3E8F7';
    });
}

function drawBase(L, color) {
    const side = lerp(color, '#140F2C', 0.5);
    const top = color;
    const light = lt(color, 0.45);
    L.ellipse(32, 91, 15, 4.5, side);
    L.ellipse(32, 89, 15, 4.5, (nx, ny) => (ny < -0.5 && nx < 0 ? light : top));
    L.ellipse(32, 89, 10, 2.8, lerp(color, '#140F2C', 0.25));
}

// ---------------------------------------------------------------------------
// Poses (sprite tourné vers la droite)
// ---------------------------------------------------------------------------

const ease = (k) => k * k * (3 - 2 * k);
const PATTERN = ['B', 't', 'K', 't', 'B', 'B', 'K', 'Pf'];

// Squelette de repos
const REST = {
    hip: [0, 0],
    footN: [27, 84],
    footF: [37, 84],
    handN: [24, 66],
    handF: [41, 64],
};

/** Coups de beatbox à l'instant t : intensité (0 à 1) et son, pour les ondes du plateau */
export function beatboxHit(t) {
    const half = t / (BEAT / 2);
    const k = half % 1;
    const sound = PATTERN[Math.floor(half) % PATTERN.length];
    return { sound, strength: k < 0.35 ? 1 - k / 0.35 : 0, heavy: sound === 'B' || sound === 'K' };
}
/** Position de la boule du micro pendant le beatbox (coordonnées du sprite tourné vers la droite) */
export const MIC_MOUTH = [41, 44];

export const POSES = {
    idle(t) {
        const breath = Math.sin((t / 2.6) * Math.PI * 2) > 0.2 ? 1 : 0;
        const cycle = t % 7;
        const glance = cycle > 4.6 && cycle < 5.6;
        const nod = cycle > 5.8 ? Math.floor((cycle - 5.8) / 0.3) % 2 : 0;
        return {
            hip: [0, breath], head: [0, nod], look: glance ? -1 : 0,
            handN: [24, 66 + breath], shapeN: 'relaxed', handF: [41, 64 + breath], mic: 'hold',
        };
    },
    walk(t) {
        const ph = (t / 0.56) % 1;
        const leg = (p) => {
            const q = p % 1;
            if (q < 0.5) return [5 - q * 20, 0];
            const s = (q - 0.5) * 2;
            return [-5 + s * 10, -Math.sin(s * Math.PI) * 4];
        };
        const n = leg(ph);
        const f = leg(ph + 0.5);
        const bob = (ph % 0.5) < 0.25 ? 1 : 0;
        const swing = Math.sin(ph * Math.PI * 2);
        return {
            hip: [1, bob], lean: 1, head: [1, 0],
            footN: [28 + n[0], 84 + n[1]], footF: [36 + f[0], 84 + f[1]], toeN: n[1] < -1 ? 1 : 0, toeF: f[1] < -1 ? 1 : 0,
            handN: [25 - swing * 4, 65 - Math.abs(swing)], shapeN: 'fist', handF: [41 + swing * 3, 63], mic: 'hold',
        };
    },
    // Saut d'une case à l'autre (t de 0 à 0,6 s : élan, vol, réception)
    hop(t) {
        const k = Math.min(1, (t % 0.6) / 0.6);
        if (k < 0.14) return { hip: [0, 3], footN: [27, 84], footF: [37, 84], handN: [20, 66], shapeN: 'fist', handF: [44, 66], mic: 'hold', eyes: 'focus' };
        if (k > 0.86) return { hip: [0, 2], footN: [26, 84], footF: [38, 84], handN: [20, 60], shapeN: 'palm', handF: [45, 59], mic: 'hold', mouth: 'smile' };
        return {
            hip: [0, -1], footN: [25, 80], footF: [39, 79], toeN: 1, toeF: 1,
            handN: [18, 54], shapeN: 'palm', handF: [47, 52], mic: 'hold', mouth: 'grin', eyes: 'happy',
        };
    },
    // Frappe du dé au-dessus de la tête (t de 0 à 0,9 s)
    diceHit(t) {
        const k = Math.min(0.9, t);
        if (k < 0.12) return { hip: [0, 4], footN: [26, 84], footF: [38, 84], handN: [22, 68], shapeN: 'fist', handF: [43, 67], mic: 'hold', lookY: -1, eyes: 'focus', brows: 'angry' };
        if (k < 0.5) {
            const up = k < 0.34 ? ease((k - 0.12) / 0.22) : 1;
            return {
                figDy: -Math.round(up * 18), hip: [0, -1], footN: [27, 82], footF: [37, 81], toeN: 1, toeF: 1,
                handN: [27, 30], shapeN: 'fist', handF: [46, 58], mic: 'hold', eyes: k > 0.32 ? 'closed' : 'open', lookY: -1, mouth: 'shout',
            };
        }
        if (k < 0.78) {
            const down = ease((k - 0.5) / 0.28);
            return {
                figDy: -Math.round((1 - down) * 18), hip: [0, 0], footN: [26, 83], footF: [38, 83],
                handN: [19, 52], shapeN: 'palm', handF: [46, 54], mic: 'hold', eyes: 'happy', mouth: 'grin',
            };
        }
        return { hip: [0, 3], footN: [26, 84], footF: [38, 84], handN: [19, 60], shapeN: 'palm', handF: [45, 60], mic: 'hold', eyes: 'happy', mouth: 'grin' };
    },
    // Le cup : main et boule devant la bouche, coude levé, manche vers le bas
    beatbox(t) {
        const hit = beatboxHit(t);
        const beat = Math.floor(t / BEAT);
        const inBeat = (t / BEAT) % 1;
        const down = hit.strength > 0.3 ? 1 : 0;
        const bar = Math.floor(beat / 4) % 4;
        let handN;
        let shapeN = 'fist';
        if (bar === 0) handN = [22, inBeat < 0.3 ? 62 : 57];
        else if (bar === 1) { handN = [20 + (beat % 2) * 2, 56]; shapeN = 'palm'; }
        else if (bar === 2) { handN = [49, 55 - (inBeat < 0.3 ? 1 : 0)]; shapeN = 'point'; }
        else { handN = [21, 46]; shapeN = 'palm'; }
        return {
            hip: [0, down], head: [hit.heavy ? down : 0, down],
            footN: [26, 84], footF: [38, 84], toeF: beat % 2 && inBeat < 0.3 ? 1 : 0,
            handN, shapeN, handF: [MIC_MOUTH[0] - 1, MIC_MOUTH[1] + 1 + down], mic: 'cup', front: true,
            eyes: hit.sound === 'B' && hit.strength > 0.5 ? 'closed' : 'focus', brows: hit.sound === 'K' ? 'up' : null,
            mouth: 'line', cheeks: hit.sound === 'Pf' && hit.strength > 0.2, speaker: hit.strength > 0.4 ? 1 : 0,
        };
    },
    cheer(t) {
        const ph = (t / 0.5) % 1;
        const up = Math.round(Math.abs(Math.sin(ph * Math.PI)) * 7);
        const k = Math.floor(t / 0.25) % 2;
        return {
            figDy: -up, hip: [0, up > 3 ? -1 : 1], footN: [26, up > 3 ? 81 : 84], footF: [38, up > 3 ? 81 : 84], toeN: up > 3 ? 1 : 0, toeF: up > 3 ? 1 : 0,
            handN: [21 + k, 32], shapeN: 'fist', handF: [43 - k, 31], mic: 'hold', grip: [0.2, 1],
            eyes: 'happy', mouth: k ? 'shout' : 'grin',
        };
    },
    sad(t) {
        const heave = Math.floor(t / 0.9) % 2;
        return {
            hip: [0, 2 + heave], lean: 1, head: [1, 3 + heave],
            footN: [28, 84], footF: [35, 84], handN: [27, 72], shapeN: 'relaxed', handF: [38, 72], mic: 'hold',
            eyes: 'sad', lookY: 1, brows: 'sad', mouth: 'sad',
        };
    },
    dance(t) {
        const beat = Math.floor(t / BEAT);
        const inBeat = (t / BEAT) % 1;
        const move = Math.floor(beat / 4) % 3;
        const side = beat % 2 ? 1 : -1;
        const hitDown = inBeat < 0.35 ? 1 : 0;
        if (move === 0) {
            // Toprock : pas croisés d'un côté à l'autre
            return {
                hip: [side * 2, hitDown], head: [side, hitDown],
                footN: [side > 0 ? 32 : 24, 84 - (inBeat > 0.5 && side > 0 ? 3 : 0)], footF: [side > 0 ? 40 : 33, 84 - (inBeat > 0.5 && side < 0 ? 3 : 0)],
                handN: [20 + side * 3, 58], shapeN: 'fist', handF: [44 + side * 2, 58], mic: 'hold', mouth: 'grin', eyes: beat % 4 === 3 ? 'happy' : 'open',
            };
        }
        if (move === 1) {
            // Rebond et index pointé vers le ciel
            return {
                hip: [0, hitDown * 2], footN: [25, 84], footF: [39, 84],
                handN: side > 0 ? [26, 30] : [18, 60], shapeN: side > 0 ? 'point' : 'fist', dirN: [0, -1], handF: [42, 56 + hitDown], mic: 'hold',
                mouth: side > 0 ? 'shout' : 'grin', eyes: side > 0 ? 'happy' : 'open',
            };
        }
        // Épaules qui sautent, tête qui hoche, demi-tour sur le dernier temps
        return {
            hip: [0, hitDown], head: [0, hitDown], footN: [26, 84], footF: [38, 84], toeN: side > 0 ? 1 : 0,
            handN: [22, side > 0 ? 54 : 60], shapeN: 'fist', handF: [42, side > 0 ? 60 : 54], mic: 'hold',
            mouth: 'smirk', eyes: 'open', mirror: beat % 4 === 3 && inBeat > 0.5,
        };
    },
    // Larsen : on recule, mains levées, yeux ronds
    shock(t) {
        const jitter = Math.floor(t * 20) % 2;
        return {
            hip: [-2 + jitter, 1], lean: -2, head: [-1, 0], footN: [24, 84], footF: [36, 84],
            handN: [17, 50], shapeN: 'palm', handF: [47, 50], mic: 'hold', grip: [0.6, 1], eyes: 'wide', brows: 'up', mouth: 'O',
        };
    },
    // Au carrefour : main au menton, regard en l'air, pied qui tape
    think(t) {
        const tap = Math.floor(t / 0.45) % 2;
        const swap = Math.floor(t / 2.2) % 2;
        return {
            hip: [0, 0], head: [0, 0], footN: [27, 84], footF: [37, 84], toeF: tap,
            handN: [36, 50], shapeN: 'fist', handF: [41, 64], mic: 'hold',
            look: swap ? 1 : -1, lookY: -1, brows: 'up', mouth: 'line',
        };
    },
    // Pose de présentation : main sur la hanche, micro brandi, clin d'œil
    present(t) {
        const k = Math.min(1, t / 0.25);
        return {
            figDy: k < 1 ? -Math.round(Math.sin(k * Math.PI) * 5) : 0, hip: [0, 0], footN: [24, 84], footF: [39, 84],
            handN: [24, 64], shapeN: 'fist', elbowN: 'out', handF: [44, 33], mic: 'hold', grip: [0.15, 1],
            eyes: Math.floor(t / 1.4) % 2 ? 'wink' : 'open', mouth: 'grin',
        };
    },
    // L'ingé son garde le raccourci : bras croisés, hoche la tête en rythme
    guard(t) {
        const nod = Math.floor(t / BEAT) % 2;
        return {
            hip: [0, 0], head: [0, nod], footN: [25, 84], footF: [39, 84],
            handN: [36, 58], shapeN: 'fist', handF: [29, 57], mic: 'none', front: true,
            eyes: 'focus', brows: 'angry', mouth: 'line',
        };
    },
    // Petit gain : poing qui monte
    fist(t) {
        const k = (t % 0.8) / 0.8;
        const up = k < 0.3 ? ease(k / 0.3) : 1;
        return {
            hip: [0, up > 0.5 ? 0 : 1], footN: [27, 84], footF: [37, 84],
            handN: [24 - up * 2, 62 - up * 22], shapeN: 'fist', handF: [41, 63], mic: 'hold', eyes: up > 0.5 ? 'happy' : 'open', mouth: 'grin',
        };
    },
};
export const POSE_NAMES = Object.keys(POSES);

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

function compose(c, p, color, withBase) {
    const sprite = new Sprite();
    const fy = p.figDy || 0;
    if (withBase) {
        const B = new Layer();
        drawBase(B, color);
        sprite.commit(B, OUT);
    }
    const hp = p.hip || [0, 0];
    const hip = [31 + hp[0], 66 + hp[1] + fy];
    const lean = p.lean || 0;
    const neck = [hip[0] + 1 + lean, hip[1] - 17];
    const shN = [neck[0] - 6, neck[1] + 4];
    const shF = [neck[0] + 6, neck[1] + 3];
    const hd = p.head || [0, 0];
    const hx = Math.round(neck[0] - 11 + hd[0]);
    const hy = Math.round(neck[1] - 19 + hd[1]);
    const foot = (f) => [f[0], f[1] + fy];
    const footN = foot(p.footN || REST.footN);
    const footF = foot(p.footF || REST.footF);
    const handN = foot(p.handN || REST.handN);
    const handF = foot(p.handF || REST.handF);
    const sleeve = c.robot ? c.metal : c.top;
    const fore = c.sleeves === 'short' ? c.skin : sleeve;

    // Bras lointain (porte le micro)
    const [elbowF, wristF] = ik(R(shF), handF, 8, 8, p.mic === 'cup' ? [1, 0.7] : [0.7, 0.6]);
    const armF = new Layer();
    armF.capsule(shF[0], shF[1], elbowF[0], elbowF[1], 2.6, 2.3, shade3(dk(sleeve, 0.12)));
    const foreF = new Layer();
    foreF.capsule(elbowF[0], elbowF[1], wristF[0], wristF[1], 2.3, 2, shade3(dk(fore, 0.12)));
    const handFL = new Layer();
    const grip = p.grip || (p.mic === 'cup' ? [0.35, 1] : [0.1, 1]);
    const ball = p.mic === 'cup' ? [wristF[0] + 1, wristF[1] - 1] : [wristF[0], wristF[1] - 1];
    if (p.mic !== 'none') drawMic(handFL, ball, grip, c);
    // La main enveloppe la boule par-dessous
    const sk = c.robot ? dk(c.metal, 0.1) : c.skin;
    const skS = dk(sk, 0.28);
    const [wx, wy] = R(wristF);
    if (p.mic === 'none') {
        drawHand(handFL, c, wristF, 'fist');
    } else if (p.mic === 'cup') {
        handFL.rect(wx - 2, wy, 5, 3, (i, j) => (j === 2 || i === 4 ? skS : sk));
        handFL.rect(wx + 2, wy - 3, 2, 3, (i) => (i ? skS : sk));
        handFL.px(wx - 1, wy - 1, sk).px(wx + 1, wy - 1, skS);
    } else {
        handFL.rect(wx - 2, wy, 5, 2, (i, j) => (j === 1 || i === 4 ? skS : sk));
        handFL.px(wx - 3, wy - 1, sk).px(wx - 1, wy, skS).px(wx + 1, wy, skS);
    }

    if (!p.front) {
        sprite.commit(armF, line(sleeve));
        sprite.commit(foreF, line(fore));
        sprite.commit(handFL, OUT);
    } else {
        sprite.commit(armF, line(sleeve));
    }

    if (c.hairBack) {
        const HB = new Layer();
        c.hairBack(HB, hx, hy, c);
        sprite.commit(HB, line(c.hair || c.top));
    }

    // Jambes et baskets
    const legF = new Layer();
    const ankleF = drawLeg(legF, c, [hip[0] + 4, hip[1]], footF);
    sprite.commit(legF, line(c.pants));
    const shoeF = new Layer();
    drawShoe(shoeF, c, ankleF, p.toeF || 0);
    sprite.commit(shoeF, OUT);
    const legN = new Layer();
    const ankleN = drawLeg(legN, c, [hip[0] - 3, hip[1]], footN);
    sprite.commit(legN, line(c.pants));
    const shoeN = new Layer();
    drawShoe(shoeN, c, ankleN, p.toeN || 0);
    sprite.commit(shoeN, OUT);

    // Torse
    const T = new Layer();
    drawTorso(T, c, neck, hip, p);
    sprite.commit(T, line(c.robot ? c.metal : c.top));

    // Cou et tête
    const Hd = new Layer();
    Hd.rect(neck[0] - 2, neck[1] - 3, 5, 5, dk(c.robot ? '#5A6488' : c.skin, 0.3));
    drawHead(Hd, c, hx, hy, p);
    sprite.commit(Hd, line(c.robot ? c.metal : c.skin));
    if (c.hairFront) {
        const HF = new Layer();
        c.hairFront(HF, hx, hy, c);
        sprite.commit(HF, line(c.hair || c.hat || c.top));
        // Ombre portée de la frange sur le front
        HF.m.forEach((_, k) => {
            const below = k + W;
            if (!HF.m.has(below) && sprite.c[below] === c.skin) sprite.c[below] = dk(c.skin, 0.22);
        });
    }

    // Bras proche (geste libre)
    const prefer = p.elbowN === 'out' ? [-1, -0.2] : [-0.8, 0.5];
    const [elbowN, wristN] = ik(R(shN), handN, 8, 8, prefer);
    const armN = new Layer();
    armN.capsule(shN[0], shN[1], elbowN[0], elbowN[1], 2.7, 2.4, shade3(sleeve));
    sprite.commit(armN, line(sleeve));
    const foreN = new Layer();
    foreN.capsule(elbowN[0], elbowN[1], wristN[0], wristN[1], 2.4, 2.1, shade3(fore));
    sprite.commit(foreN, line(fore));
    const handNL = new Layer();
    drawHand(handNL, c, wristN, p.shapeN || 'relaxed', p.dirN || [1, 0]);
    sprite.commit(handNL, line(sk));

    if (p.front) {
        sprite.commit(foreF, line(fore));
        sprite.commit(handFL, OUT);
    }
    return sprite;
}

// ---------------------------------------------------------------------------
// Images et cache
// ---------------------------------------------------------------------------

const frameCache = new Map();
const MAX_CACHE = 1400;
const FPS = 12;

function paramsAt(pose, t) {
    const p = (POSES[pose] || POSES.idle)(t);
    const open = !p.eyes || p.eyes === 'open';
    const blink = open && (t % 3.7) < 0.12;
    const out = { ...p, eyes: blink ? 'blink' : p.eyes || 'open', blink: Math.floor(t * 3) % 2 === 0 };
    // Positions entières : deux instants voisins donnent souvent la même image
    ['hip', 'head', 'footN', 'footF', 'handN', 'handF'].forEach((k) => { if (out[k]) out[k] = R(out[k]); });
    if (out.figDy) out.figDy = Math.round(out.figDy);
    return out;
}

function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    return Object.assign(document.createElement('canvas'), { width: w, height: h });
}

// Contour sombre d'un pixel autour de la silhouette : le personnage se détache
// nettement du plateau, même sur les zones chargées (LED, touches)
const OUTLINE = [13, 11, 20];
function outline(data) {
    const solid = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i += 1) solid[i] = data[i * 4 + 3] > 0 ? 1 : 0;
    for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
            const i = y * W + x;
            if (solid[i]) continue;
            let near = false;
            for (let dy = -1; dy <= 1 && !near; dy += 1) {
                const yy = y + dy;
                if (yy < 0 || yy >= H) continue;
                for (let dx = -1; dx <= 1; dx += 1) {
                    const xx = x + dx;
                    if (xx >= 0 && xx < W && solid[yy * W + xx]) { near = true; break; }
                }
            }
            if (!near) continue;
            const o = i * 4;
            data[o] = OUTLINE[0];
            data[o + 1] = OUTLINE[1];
            data[o + 2] = OUTLINE[2];
            data[o + 3] = 255;
        }
    }
}

/**
 * Image (canvas 64 x 96) d'un personnage dans une pose, à l'instant t (secondes).
 * Les images sont calculées à 12 par seconde et gardées en cache.
 * facing : 1 regarde à droite, -1 à gauche.
 */
export function getFrame(id, pose, t, color = PLAYER_COLORS[0], { base: withBase = true, facing = 1 } = {}) {
    const c = lookup(id);
    const p = paramsAt(pose, Math.floor(t * FPS) / FPS);
    const flip = (facing < 0) !== Boolean(p.mirror);
    const cacheKey = `${id}|${withBase ? color : '-'}|${flip ? 1 : 0}|${JSON.stringify(p)}`;
    let canvas = frameCache.get(cacheKey);
    if (canvas) return canvas;
    const sprite = compose(c, p, color, withBase);
    canvas = makeCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, H);
    const colors = new Map();
    for (let i = 0; i < sprite.c.length; i += 1) {
        const col = sprite.c[i];
        if (!col) continue;
        let v = colors.get(col);
        if (!v) { v = rgb(col); colors.set(col, v); }
        const x = i % W;
        const y = (i - x) / W;
        const o = (y * W + (flip ? W - 1 - x : x)) * 4;
        img.data[o] = v[0];
        img.data[o + 1] = v[1];
        img.data[o + 2] = v[2];
        img.data[o + 3] = 255;
    }
    outline(img.data);
    ctx.putImageData(img, 0, 0);
    if (frameCache.size > MAX_CACHE) frameCache.delete(frameCache.keys().next().value);
    frameCache.set(cacheKey, canvas);
    return canvas;
}

// ---------------------------------------------------------------------------
// Un personnage seul dans un <canvas> (salon, bandeaux, résultats, mini-jeux)
// ---------------------------------------------------------------------------

export const CROPS = {
    full: [0, 0, W, H],
    // Buste, pour les portraits
    bust: [8, 14, 48, 44],
    // Tout le corps sans la marge du haut
    body: [0, 16, W, H - 16],
};

const mounted = new Set();
let raf = 0;
const reduceMotion = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function tick(now) {
    const t = now / 1000;
    mounted.forEach((m) => m.draw(t));
    raf = mounted.size ? requestAnimationFrame(tick) : 0;
}

export function mountSprite(canvas, { id, pose = 'idle', color = PLAYER_COLORS[0], base: withBase = true, crop = 'full', facing = 1 }) {
    const state = { id, pose, color, base: withBase, crop, facing, seed: Math.random() * 7, last: null, since: performance.now() / 1000 };
    const size = () => {
        const [, , cw, ch] = CROPS[state.crop] || CROPS.full;
        if (canvas.width !== cw) canvas.width = cw;
        if (canvas.height !== ch) canvas.height = ch;
    };
    size();
    const ctx = canvas.getContext('2d');
    const m = {
        draw(t) {
            // Les poses courtes (saut, frappe) repartent de zéro quand on les choisit
            const local = ['present', 'diceHit', 'fist'].includes(state.pose) ? t - state.since : t + state.seed;
            const frame = getFrame(state.id, state.pose, local, state.color, { base: state.base, facing: state.facing });
            if (frame === state.last) return;
            state.last = frame;
            const [sx, sy, sw, sh] = CROPS[state.crop] || CROPS.full;
            ctx.clearRect(0, 0, sw, sh);
            ctx.drawImage(frame, sx, sy, sw, sh, 0, 0, sw, sh);
        },
        update(next) {
            if (next.pose !== state.pose) state.since = performance.now() / 1000;
            Object.assign(state, next);
            state.last = null;
            size();
        },
        destroy() { mounted.delete(m); },
    };
    m.draw(performance.now() / 1000);
    if (!reduceMotion) {
        mounted.add(m);
        if (!raf) raf = requestAnimationFrame(tick);
    }
    return m;
}
