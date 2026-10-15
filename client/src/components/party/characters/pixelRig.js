// Personnages de Beatbox Party en pixel art.
//
// Chaque personnage est un sprite de 32 x 54 pixels, recomposé à chaque image à partir
// de calques (jambes, torse, tête et coiffure, bras) : chaque calque reçoit son propre
// contour d'une couleur, ce qui sépare les parties comme un dessin à la main.
// Les images sont mises en cache : une pose ne se recalcule pas d'une partie à l'autre.
//
// Ce module ne dépend pas de React. Il sert le composant PixelCharacter.jsx (un
// personnage seul) et le plateau, qui dessine les sprites dans son propre canvas.
//
// Le micro se tient par la boule : en beatbox, la main l'enveloppe devant la bouche
// (le « cup »), le manche pointe vers le bas.

export const SPRITE_W = 32;
export const SPRITE_H = 54;
const OY = 8; // lignes libres en haut, pour les sauts
const OUT = '#1A1C2C';

export const PLAYER_COLORS = ['#FFC72C', '#4C8DFF', '#F0533F', '#35C877'];

// ---------------------------------------------------------------------------
// Calques de pixels
// ---------------------------------------------------------------------------

const key = (x, y) => (y << 6) | x;

class Layer {
    constructor() { this.m = new Map(); }

    px(x, y, c) {
        x = Math.round(x);
        y = Math.round(y) + OY;
        if (c && x >= 0 && y >= 0 && x < SPRITE_W && y < SPRITE_H) this.m.set(key(x, y), c);
        return this;
    }

    rect(x, y, w, h, c) {
        for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) this.px(x + i, y + j, typeof c === 'function' ? c(i, j) : c);
        return this;
    }

    disc(cx, cy, r, c) {
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
            for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
                const dx = x + 0.5 - cx;
                const dy = y + 0.5 - cy;
                if (dx * dx + dy * dy <= r * r) this.px(x, y, typeof c === 'function' ? c(dx, dy) : c);
            }
        }
        return this;
    }

    line(x0, y0, x1, y1, c, w = 1) {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let i = 0; i <= n; i += 1) {
            const x = Math.round(x0 + ((x1 - x0) * i) / n);
            const y = Math.round(y0 + ((y1 - y0) * i) / n);
            this.rect(x - Math.floor((w - 1) / 2), y - Math.floor((w - 1) / 2), w, w, c);
        }
        return this;
    }

    // Gabarit texte : une lettre par pixel, '.' transparent
    stamp(x, y, rows, pal) {
        rows.forEach((row, j) => {
            for (let i = 0; i < row.length; i += 1) if (row[i] !== '.' && pal[row[i]]) this.px(x + i, y + j, pal[row[i]]);
        });
        return this;
    }

    shift(dy) {
        if (!dy) return this;
        const m = new Map();
        this.m.forEach((c, k) => {
            const x = k & 63;
            const y = (k >> 6) + dy;
            if (y >= 0 && y < SPRITE_H) m.set(key(x, y), c);
        });
        this.m = m;
        return this;
    }
}

class Sprite {
    constructor() { this.c = new Array(SPRITE_W * SPRITE_H).fill(null); }

    // Pose un calque, précédé de son contour (qui recouvre les calques du dessous)
    commit(layer, outline = OUT) {
        if (outline) {
            layer.m.forEach((_, k) => {
                const x = k & 63;
                const y = k >> 6;
                [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= SPRITE_W || ny >= SPRITE_H) return;
                    if (!layer.m.has(key(nx, ny))) this.c[ny * SPRITE_W + nx] = outline;
                });
            });
        }
        layer.m.forEach((c, k) => { this.c[(k >> 6) * SPRITE_W + (k & 63)] = c; });
    }
}

const hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
};
const mix = (h, k) => {
    const [r, g, b] = hex(h);
    const f = (v) => Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1)).toString(16).padStart(2, '0');
    return `#${f(r)}${f(g)}${f(b)}`;
};

// ---------------------------------------------------------------------------
// Distribution
// ---------------------------------------------------------------------------

const DIGIT_8 = ['www', 'w.w', 'www', 'w.w', 'www'];

const CAST = {
    nova: {
        name: 'Nova', tagline: { fr: 'La reine du flow', en: 'Queen of flow' },
        skin: '#8D5A3B', skinS: '#6B4129', blush: '#B5584A', hair: '#2A1A14', hairS: '#1A100C', hairH: '#5A3B2C',
        top: '#FFC72C', topS: '#D9930F', accent: '#24305E', pants: '#3A4C8C', pantsS: '#26346A',
        shoe: '#F4F4F4', shoeS: '#C9CCD8', shoeA: '#E8402F',
        hair_(L, hx, hy, p) {
            const puff = (dx, dy) => (dx + dy < -3 ? p.hairH : dx + dy > 3 ? p.hairS : p.hair);
            L.disc(hx - 0.5, hy - 1, 4.6, puff);
            L.disc(hx + 14.5, hy - 1, 4.6, puff);
            L.stamp(hx, hy - 1, [
                '...hhhhhhhh...',
                '.hhhhhHhhhhhh.',
                'hhhhhhhhhhhhhh',
                'hhhh.hhhh.hhhh',
                'hh..........hh',
                'h............h',
            ], { h: p.hair, H: p.hairH });
        },
        extras(L, hx, hy) {
            L.rect(hx - 1, hy + 9, 1, 2, '#F2C230');
            L.rect(hx + 14, hy + 9, 1, 2, '#F2C230');
        },
        torso(L, x, y, p) {
            L.rect(x + 3, y, 6, 1, p.accent);
            L.rect(x + 5, y + 1, 2, 7, p.topS);
            L.rect(x, y + 7, 12, 1, p.accent);
        },
    },
    grizz: {
        name: 'Grizz', tagline: { fr: 'Basses de tonnerre', en: 'Thunder bass' },
        skin: '#E9B892', skinS: '#C98F6A', blush: '#E07B6E', hair: '#5B3A26', hairS: '#3E2718', hairH: '#7A5238',
        hat: '#E8402F', hatS: '#A82A1C', top: '#7D869E', topS: '#5A6178', accent: '#F2C230',
        pants: '#2C3248', pantsS: '#1E2234', shoe: '#2B2F42', shoeS: '#1C1F2E', shoeA: '#FFC72C',
        wide: 1, brows: 'thick', beard: true,
        hair_(L, hx, hy, p) {
            L.stamp(hx - 1, hy - 5, [
                '......ww......',
                '.....wwww.....',
                '....RRRRRR....',
                '..RRrRRrRRrR..',
                '.RRRrRRrRRrRR.',
                'RRRRrRRrRRrRRRR.',
                'SSSSSSSSSSSSSSSS',
                'SSSSSSSSSSSSSSSS',
            ], { w: '#F4F4F4', R: p.hat, r: p.hatS, S: p.hatS });
        },
        torso(L, x, y, p) {
            L.rect(x + 2, y + 4, 10, 4, p.topS);
            L.line(x + 4, y + 1, x + 4, y + 3, '#F4F4F4');
            L.line(x + 9, y + 1, x + 9, y + 3, '#F4F4F4');
            L.line(x + 3, y, x + 6, y + 3, p.accent);
            L.line(x + 10, y, x + 7, y + 3, p.accent);
            L.rect(x + 6, y + 3, 2, 2, p.accent);
        },
    },
    kick: {
        name: 'Kick', tagline: { fr: 'Toujours à fond', en: 'Always full speed' },
        skin: '#D9A27A', skinS: '#B57F59', blush: '#E07B6E', hair: '#3B2416', hairS: '#24150C', hairH: '#5A3A26',
        hat: '#4C8DFF', hatS: '#2F63C9', top: '#F5A23A', topS: '#C9781C', accent: '#FFFFFF',
        pants: '#3A3F55', pantsS: '#2A2E40', shoe: '#4C8DFF', shoeS: '#2F63C9', shoeA: '#FFFFFF',
        sleeves: 'short', freckles: true,
        hair_(L, hx, hy, p) {
            // Casquette à l'envers : la visière dépasse derrière, l'ouverture de la sangle sur le front
            L.stamp(hx + 11, hy - 4, ['..vvv', '.vvvv', 'vvv..'], { v: p.hatS });
            L.stamp(hx, hy - 3, [
                '....cccccc....',
                '..cccccccccc..',
                '.ccCcccccccccc',
                'cccccccccccccc',
                'cccccchhcccccc',
                'SSSSShhhhSSSSS',
                'hh..........hh',
            ], { c: p.hat, C: mix(p.hat, 1.4), S: p.hatS, h: p.hair });
        },
        torso(L, x, y, p) {
            L.stamp(x + 5, y + 2, DIGIT_8, { w: p.accent });
            L.rect(x + 3, y, 6, 1, p.topS);
        },
    },
    lila: {
        name: 'Lila', tagline: { fr: 'Loopeuse de génie', en: 'Loop wizard' },
        skin: '#C68863', skinS: '#A46A48', blush: '#D9715F', hair: '#1E1512', hairS: '#120C0A', hairH: '#4A3A33',
        top: '#35C877', topS: '#23995A', accent: '#FFF3D6', pants: '#2A3045', pantsS: '#1C2133',
        shoe: '#FF86B4', shoeS: '#D9628F', shoeA: '#FFFFFF', phones: '#FF86B4',
        // Tresses : derrière le corps
        hairBack(L, hx, hy, p) {
            [hx - 1, hx + 13].forEach((x) => {
                L.rect(x, hy + 6, 2, 15, (i, j) => (j % 3 === 2 ? p.hairH : p.hair));
                L.rect(x, hy + 21, 2, 1, '#F2C230');
            });
        },
        hair_(L, hx, hy, p) {
            L.stamp(hx, hy - 1, [
                '...hhhhhhhh...',
                '.hhhhhh.hhhhh.',
                'hhhhhh...hhhhh',
                'hhhh......hhhh',
                'hh..........hh',
                'h............h',
            ], { h: p.hair });
            // Casque audio
            L.rect(hx + 1, hy - 2, 12, 1, '#3A3F55');
            L.rect(hx, hy - 1, 1, 2, '#3A3F55');
            L.rect(hx + 13, hy - 1, 1, 2, '#3A3F55');
            L.rect(hx - 2, hy + 4, 3, 5, (i) => (i === 0 ? mix(p.phones, 0.8) : p.phones));
            L.rect(hx + 13, hy + 4, 3, 5, (i) => (i === 2 ? mix(p.phones, 0.8) : p.phones));
        },
        torso(L, x, y, p) {
            L.rect(x + 5, y, 2, 8, p.accent);
            L.px(x + 2, y + 3, '#FFC72C').px(x + 2, y + 4, '#FFC72C').px(x + 1, y + 4, '#FFC72C').px(x + 3, y + 4, '#FFC72C');
            L.rect(x + 8, y + 5, 2, 2, '#FF86B4');
        },
    },
    robox: {
        name: 'R0-B0X', tagline: { fr: 'Boîte à rythmes ambulante', en: 'Walking drum machine' },
        robot: true, skin: '#B9C3DD', skinS: '#8E9AB8', metal: '#B9C3DD', metalS: '#8E9AB8', metalH: '#E2E8F6',
        screen: '#232A4A', led: '#5FE0C8',
        top: '#B9C3DD', topS: '#8E9AB8', accent: '#5FE0C8', pants: '#8E9AB8', pantsS: '#6E7A98',
        shoe: '#3A4466', shoeS: '#283050', shoeA: '#5FE0C8',
        torso(L, x, y, p) {
            L.disc(x + 6, y + 4, 3.2, (dx, dy) => (dx * dx + dy * dy < 2.2 ? p.screen : p.metalS));
            L.rect(x + 5, y + 3, 2, 2, p.led);
            L.px(x + 1, y + 1, p.screen).px(x + 10, y + 1, p.screen).px(x + 1, y + 7, p.screen).px(x + 10, y + 7, p.screen);
        },
    },
    mamie: {
        name: 'Mamie Snare', tagline: { fr: 'Cinquante ans de caisse claire', en: 'Fifty years of snare' },
        skin: '#F3D2B8', skinS: '#D6A88A', blush: '#EE8A8F', hair: '#D9DDE8', hairS: '#A9B0C4', hairH: '#FFFFFF',
        top: '#5FE0C8', topS: '#36AF99', accent: '#FFF3D6', pants: '#5B4A6E', pantsS: '#433553',
        shoe: '#F4F4F4', shoeS: '#C9CCD8', shoeA: '#5FE0C8', eyes: 'shades',
        hair_(L, hx, hy, p) {
            L.disc(hx + 7, hy - 3, 3.4, (dx, dy) => (dx + dy < -2 ? p.hairH : dx + dy > 2 ? p.hairS : p.hair));
            L.stamp(hx, hy - 1, [
                '...hhhhhhhh...',
                '.hhHhhhhhHhhh.',
                'hhhhhhhhhhhhhh',
                'hhsshhhhhhsshh',
                'h............h',
            ], { h: p.hair, H: p.hairH, s: p.hairS });
        },
        torso(L, x, y, p) {
            L.stamp(x + 3, y, ['aaaaaa', '.aaaa.', '..aa..'], { a: p.accent });
            for (let i = 0; i < 6; i += 1) L.px(x + 2 + i * 1.6, y + (i === 0 || i === 5 ? 0 : 1), '#FFFFFF');
            L.px(x + 7, y + 4, p.accent).px(x + 7, y + 6, p.accent);
        },
    },
    flex: {
        name: 'Flex', tagline: { fr: 'Technique et dent en or', en: 'Tech and a gold tooth' },
        skin: '#6B4028', skinS: '#4E2C1A', blush: '#8C4A3A', hair: '#16100D', hairS: '#0B0806', hairH: '#3A2E28',
        top: '#F0533F', topS: '#B93626', accent: '#FFFFFF', pants: '#F0533F', pantsS: '#B93626',
        shoe: '#FFFFFF', shoeS: '#C9CCD8', shoeA: '#16100D', goldTooth: true, brows: 'sharp', pantsStripe: '#FFFFFF',
        hair_(L, hx, hy, p) {
            L.rect(hx, hy - 6, 14, 8, (i, j) => (j === 0 ? p.hairH : i === 13 ? p.hairS : p.hair));
            L.rect(hx, hy + 2, 2, 2, p.hair);
            L.rect(hx + 12, hy + 2, 2, 2, p.hair);
            L.rect(hx + 3, hy - 4, 8, 1, p.hairH);
        },
        torso(L, x, y, p) {
            L.rect(x, y + 1, 1, 7, p.accent);
            L.rect(x + 11, y + 1, 1, 7, p.accent);
            L.stamp(x + 3, y, ['w....w', '.w..w.', '..ww..'], { w: p.accent });
            L.rect(x + 6, y + 3, 1, 5, p.topS);
        },
    },
    mimi: {
        name: 'Mimi', tagline: { fr: 'Mascotte officielle', en: 'Official mascot' },
        skin: '#F6D0B0', skinS: '#D9A98A', blush: '#F28FA8', hair: '#6B3A26', hairS: '#4A2618', hairH: '#8A5238',
        top: '#FF86B4', topS: '#D9628F', accent: '#FFD3E4', pants: '#FFFFFF', pantsS: '#D8DCE8',
        shoe: '#FF86B4', shoeS: '#D9628F', shoeA: '#FFFFFF', whiskers: true,
        // Capuche de chat : autour de la tête, dessinée avant elle
        hood(L, hx, hy, p) {
            L.rect(hx - 2, hy - 2, 18, 15, (i, j) => (((i === 0 || i === 17) && (j === 0 || j === 14)) ? null : i >= 15 ? p.topS : p.top));
            L.stamp(hx - 2, hy - 6, ['aa............aa', 'aAa..........aAa', 'aAAa........aAAa', 'aaaaa......aaaaa'], { a: p.top, A: p.accent });
        },
        hair_(L, hx, hy, p) {
            L.stamp(hx + 1, hy, ['hhhhhhhhhhhh', 'hhh.hhhh.hhh', 'h.h..hh..h.h'], { h: p.hair });
        },
        torso(L, x, y, p) {
            L.rect(x + 2, y + 4, 8, 3, p.topS);
            L.px(x + 4, y + 1, '#FFFFFF').px(x + 4, y + 2, '#FFFFFF').px(x + 7, y + 1, '#FFFFFF').px(x + 7, y + 2, '#FFFFFF');
        },
    },
};

export const CHARACTERS = Object.entries(CAST).map(([id, c]) => ({ id, name: c.name, tagline: c.tagline, color: c.top }));
export const CHARACTER_IDS = Object.keys(CAST);
export const getCharacter = (id) => (CAST[id] ? { id, ...CAST[id] } : { id: 'nova', ...CAST.nova });

// ---------------------------------------------------------------------------
// Parties du corps
// ---------------------------------------------------------------------------

function head(L, c, hx, hy, f) {
    if (c.robot) {
        L.rect(hx - 1, hy, 16, 13, (i, j) => (((i === 0 || i === 15) && (j === 0 || j === 12)) ? null : j === 1 && i > 1 && i < 14 ? c.metalH : i >= 14 || j >= 11 ? c.metalS : c.metal));
        L.rect(hx + 1, hy + 3, 12, 7, c.screen);
        L.rect(hx - 2, hy + 5, 1, 3, c.metalS);
        L.rect(hx + 15, hy + 5, 1, 3, c.metalS);
        L.line(hx + 7, hy - 1, hx + 7, hy - 3, '#3A4466');
        L.rect(hx + 6, hy - 5, 3, 2, f.blinkLed ? '#2B7F72' : c.led);
        if (f.eyes === 'happy') {
            L.px(hx + 3, hy + 5, c.led).px(hx + 4, hy + 4, c.led).px(hx + 5, hy + 5, c.led);
            L.px(hx + 8, hy + 5, c.led).px(hx + 9, hy + 4, c.led).px(hx + 10, hy + 5, c.led);
        } else if (f.eyes === 'blink') {
            L.rect(hx + 3, hy + 5, 3, 1, c.led);
            L.rect(hx + 8, hy + 5, 3, 1, c.led);
        } else {
            L.rect(hx + 3, hy + 4, 3, 2, c.led);
            L.rect(hx + 8, hy + 4, 3, 2, c.led);
        }
        const bars = {
            smile: [1, 1, 2, 2, 1, 1], grin: [1, 2, 3, 3, 2, 1], sad: [2, 1, 1, 1, 1, 2],
            B: [1, 2, 3, 3, 2, 1], K: [3, 2, 1, 1, 2, 3], t: [1, 1, 3, 3, 1, 1], Pf: [2, 3, 2, 2, 3, 2],
        }[f.mouth] || [1, 1, 2, 2, 1, 1];
        bars.forEach((h, i) => L.rect(hx + 3 + Math.round(i * 1.5), hy + 9 - h, 1, h, c.led));
        return;
    }

    if (c.hood) c.hood(L, hx, hy, c);
    const s = c.skin;
    const sS = c.skinS;
    const rows = [[3, 10], [1, 12], [0, 13], [0, 13], [0, 13], [0, 13], [0, 13], [0, 13], [0, 13], [0, 13], [1, 12], [2, 11], [4, 9]];
    rows.forEach(([a, b], j) => {
        for (let i = a; i <= b; i += 1) L.px(hx + i, hy + j, i >= 12 || j >= 11 || (i === 11 && j >= 9) ? sS : s);
    });
    if (!c.hood) {
        L.rect(hx - 1, hy + 6, 1, 3, sS);
        L.rect(hx + 14, hy + 6, 1, 3, sS);
    }
    // Joues gonflées sur le « Pf »
    if (f.mouth === 'Pf') {
        L.rect(hx - 1, hy + 8, 1, 3, s);
        L.rect(hx + 14, hy + 8, 1, 3, sS);
    }
    L.rect(hx + 2, hy + 9, 2, 1, c.blush);
    L.rect(hx + 10, hy + 9, 2, 1, c.blush);
    if (c.freckles) L.px(hx + 2, hy + 8, sS).px(hx + 4, hy + 9, sS).px(hx + 11, hy + 8, sS).px(hx + 9, hy + 9, sS);
    if (c.whiskers) {
        L.rect(hx, hy + 8, 2, 1, OUT).rect(hx, hy + 10, 2, 1, OUT);
        L.rect(hx + 12, hy + 8, 2, 1, OUT).rect(hx + 12, hy + 10, 2, 1, OUT);
    }

    // Yeux
    if (c.eyes === 'shades') {
        L.rect(hx + 1, hy + 5, 5, 3, OUT);
        L.rect(hx + 8, hy + 5, 5, 3, OUT);
        L.rect(hx + 6, hy + 5, 2, 1, OUT);
        L.px(hx + 2, hy + 5, '#6C7AA6').px(hx + 9, hy + 5, '#6C7AA6');
    } else if (f.eyes === 'happy') {
        [3, 9].forEach((x) => L.px(hx + x - 1, hy + 7, OUT).px(hx + x, hy + 6, OUT).px(hx + x + 1, hy + 6, OUT).px(hx + x + 2, hy + 7, OUT));
    } else if (f.eyes === 'blink') {
        L.rect(hx + 3, hy + 7, 2, 1, OUT);
        L.rect(hx + 9, hy + 7, 2, 1, OUT);
    } else {
        L.rect(hx + 3, hy + 5, 2, 3, OUT);
        L.rect(hx + 9, hy + 5, 2, 3, OUT);
        L.px(hx + 4, hy + 5, '#FFFFFF').px(hx + 10, hy + 5, '#FFFFFF');
    }

    // Sourcils
    const browColor = c.hair || OUT;
    if (c.eyes !== 'shades') {
        if (c.brows === 'thick') {
            L.rect(hx + 2, hy + 3, 4, 1, browColor);
            L.rect(hx + 8, hy + 3, 4, 1, browColor);
        } else if (c.brows === 'sharp') {
            L.px(hx + 2, hy + 3, browColor).rect(hx + 3, hy + 4, 2, 1, browColor);
            L.px(hx + 11, hy + 3, browColor).rect(hx + 9, hy + 4, 2, 1, browColor);
        } else {
            L.rect(hx + 3, hy + 3, 2, 1, browColor);
            L.rect(hx + 9, hy + 3, 2, 1, browColor);
        }
        if (f.mouth === 'sad') L.px(hx + 2, hy + 4, browColor).px(hx + 11, hy + 4, browColor);
    }

    if (c.beard) {
        L.stamp(hx, hy + 7, [
            'b............b',
            'bb..........bb',
            'bbbbmmmmmmbbbb',
            'bbbb......bbbb',
            '.bbbbb..bbbbb.',
            '..bbbbbbbbbb..',
            '....bbbbbb....',
        ], { b: c.hair, m: c.hairS });
    }

    // Bouche
    const mx = hx + 5;
    const my = hy + 10;
    const M = '#5A1A24';
    const T = '#E8667A';
    const Wt = '#FFFFFF';
    switch (f.mouth) {
        case 'grin':
            L.rect(mx - 1, my, 6, 1, Wt).px(mx - 2, my, OUT).px(mx + 5, my, OUT);
            if (c.goldTooth) L.px(mx + 3, my, '#F2C230');
            L.rect(mx, my + 1, 4, 1, M).rect(mx + 1, my + 1, 2, 1, T).rect(mx + 1, my + 2, 2, 1, OUT);
            break;
        case 'sad':
            L.rect(mx + 1, my, 2, 1, OUT).px(mx, my + 1, OUT).px(mx + 3, my + 1, OUT);
            break;
        case 'B':
            L.rect(mx, my, 4, 1, OUT).rect(mx + 1, my - 1, 2, 1, sS).rect(mx + 1, my + 1, 2, 1, sS);
            break;
        case 'K':
            L.rect(mx + 1, my - 1, 2, 1, OUT);
            L.px(mx, my, OUT).rect(mx + 1, my, 2, 1, M).px(mx + 3, my, OUT);
            L.px(mx, my + 1, OUT).rect(mx + 1, my + 1, 2, 1, T).px(mx + 3, my + 1, OUT);
            L.rect(mx + 1, my + 2, 2, 1, OUT);
            break;
        case 't':
            L.rect(mx, my, 4, 1, Wt).px(mx - 1, my, OUT).px(mx + 4, my, OUT).rect(mx, my + 1, 4, 1, OUT);
            if (c.goldTooth) L.px(mx + 2, my, '#F2C230');
            break;
        case 'Pf':
            L.rect(mx + 1, my, 2, 2, OUT);
            break;
        default:
            L.px(mx, my, OUT).px(mx + 3, my, OUT).rect(mx + 1, my + 1, 2, 1, OUT);
    }
    if (c.extras) c.extras(L, hx, hy, c);
}

function torso(L, c, x, y) {
    const w = 12 + (c.wide || 0) * 2;
    x -= c.wide || 0;
    for (let j = 0; j < 9; j += 1) {
        for (let i = j === 0 ? 1 : 0; i <= (j === 0 ? w - 2 : w - 1); i += 1) L.px(x + i, y + j, i >= w - 2 ? c.topS : c.top);
    }
    if (c.torso) c.torso(L, x, y, c);
}

function legs(L, c, dyL, dyR) {
    [[11, dyL], [18, dyR]].forEach(([x, dy]) => {
        L.rect(x, 28 + dy, 3, 5, (i) => (i === 2 ? c.pantsS : c.pants));
        if (c.pantsStripe) L.rect(x === 11 ? x : x + 2, 28 + dy, 1, 5, c.pantsStripe);
        L.rect(x - 1, 33 + dy, 5, 2, (i) => (i === 4 ? c.shoeS : c.shoe));
        L.rect(x - 1, 35 + dy, 5, 1, c.shoeA);
    });
}

// Bras gauche (sans micro) : épaule, coude, main
function armLeft(L, c, s, e, h) {
    const fore = c.sleeves === 'short' ? c.skin : c.top;
    L.line(s[0], s[1], e[0], e[1], c.top, 2);
    L.line(e[0], e[1], h[0], h[1], fore, 2);
    L.rect(h[0] - 0.5, h[1] - 0.5, 2, 2, c.robot ? c.metalS : c.skin);
}

// Bras droit : la main tient le micro par la boule, le manche part dans la direction `grip`
function armMic(L, c, s, e, h, grip) {
    const fore = c.sleeves === 'short' ? c.skin : c.top;
    L.line(s[0], s[1], e[0], e[1], c.top, 2);
    L.line(e[0], e[1], h[0], h[1], fore, 2);
    const [gx, gy] = grip;
    // Manche : il sort sous la main
    L.line(h[0] + gx * 2, h[1] + gy * 2, h[0] + gx * 5, h[1] + gy * 5, '#2B3150', 1);
    L.px(h[0] + gx * 2, h[1] + gy * 2, '#FFC72C');
    // Boule (grille) : la main l'enveloppe par en dessous, on voit le haut de la grille entre les doigts
    L.disc(h[0] + 0.5, h[1] - 0.5, 2.7, (dx, dy) => {
        if (dx + dy > 1.4) return '#8C97BC';
        return (Math.round(dx + 3) + Math.round(dy + 3)) % 2 ? '#C9D2EE' : '#E4E9F8';
    });
    const hand = c.robot ? c.metalS : c.skin;
    const handS = c.robot ? mix(c.metalS, 0.78) : c.skinS;
    L.rect(h[0] - 2, h[1], 5, 2, (i, j) => (j === 1 || i === 4 ? handS : hand));
    L.px(h[0] - 1, h[1], handS).px(h[0] + 1, h[1], handS);
    L.rect(h[0] - 3, h[1] - 1, 1, 2, hand);
}

function base(L, color) {
    const side = mix(color, 0.62);
    const light = mix(color, 1.45);
    for (let y = 34; y <= 44; y += 1) {
        for (let x = 2; x <= 30; x += 1) {
            const top = ((x + 0.5 - 16) / 13) ** 2 + ((y + 0.5 - 38.5) / 4.2) ** 2 <= 1;
            const under = ((x + 0.5 - 16) / 13) ** 2 + ((y + 0.5 - 40.5) / 4.2) ** 2 <= 1;
            if (top) L.px(x, y, y === 36 && x >= 8 && x <= 12 ? light : color);
            else if (under && y > 38) L.px(x, y, side);
        }
    }
}

// ---------------------------------------------------------------------------
// Poses (coordonnées du sprite, avant le décalage de saut)
// ---------------------------------------------------------------------------

const BEAT = 0.6;
const PATTERN = ['B', 't', 'K', 't', 'B', 'B', 'K', 'Pf'];
const SHOULDER_L = [10, 20];
const SHOULDER_R = [21, 20];
const DOWN = [0, 1];

export const POSES = {
    idle(t) {
        const b = Math.floor(t * 2) % 2;
        return { bodyDy: b, headDy: b, armL: [[9, 24], [8, 26 + b]], armR: [[22, 24], [23, 26 + b]], grip: DOWN, mouth: 'smile' };
    },
    // Le cup : main et boule devant la bouche, coude levé, manche vers le bas
    beatbox(t) {
        const beat = t / BEAT;
        const half = Math.floor(beat * 2);
        const hit = (beat * 2) % 1 < 0.35;
        const sound = PATTERN[half % PATTERN.length];
        return {
            bodyDy: hit ? 1 : 0, headDy: hit ? 1 : 0,
            armL: [[7, 23], [9, hit ? 21 : 22]], armR: [[25, 20], [16, 18]], grip: [0.3, 1],
            mouth: sound, waves: hit ? (half % 2 ? 2 : 1) : 0,
            legs: [hit && half % 2 ? -1 : 0, hit && !(half % 2) ? -1 : 0],
        };
    },
    hop(t) {
        const ph = (t / 0.6) % 1;
        const up = Math.round(Math.sin(ph * Math.PI) * 7);
        return { figDy: -up, armL: [[7, 18], [5, 15]], armR: [[24, 18], [26, 15]], grip: DOWN, mouth: up > 3 ? 'grin' : 'smile', eyes: up > 4 ? 'happy' : 'open' };
    },
    cheer(t) {
        const k = Math.floor(t * 5) % 2;
        const up = Math.round(Math.abs(Math.sin(t * Math.PI * 2)) * 4);
        return { figDy: -up, armL: [[6, 17], [4 + k, 13]], armR: [[25, 17], [26 - k, 12]], grip: DOWN, mouth: 'grin', eyes: 'happy' };
    },
    sad(t) {
        const b = Math.floor(t * 1.5) % 2;
        return { bodyDy: 1, headDy: 2 + b, armL: [[10, 24], [10, 27]], armR: [[21, 24], [21, 28]], grip: DOWN, mouth: 'sad' };
    },
    walk(t) {
        const k = Math.floor(t * 6) % 4;
        const sw = [0, 1, 0, -1][k];
        return {
            bodyDy: k % 2, headDy: k % 2, armL: [[9 - sw, 24], [8 - sw * 2, 26]], armR: [[22 + sw, 24], [23 + sw * 2, 27]], grip: DOWN,
            legs: [k === 1 ? -1 : 0, k === 3 ? -1 : 0], mouth: 'smile',
        };
    },
    dance(t) {
        const k = Math.floor((t / BEAT) * 2) % 4;
        const left = [[[6, 18], [4, 14]], [[8, 24], [10, 22]]][k % 2];
        const right = [[[25, 24], [23, 21]], [[25, 18], [27, 13]]][k % 2];
        return {
            figDy: k % 2 ? -2 : 0, headDy: k % 2, armL: left, armR: right, grip: DOWN,
            legs: [k === 1 ? -2 : 0, k === 3 ? -2 : 0], mouth: 'grin', eyes: k === 3 ? 'happy' : 'open',
        };
    },
};
export const POSE_NAMES = Object.keys(POSES);

// ---------------------------------------------------------------------------
// Composition et cache
// ---------------------------------------------------------------------------

function compose(c, p, color, withBase) {
    const sprite = new Sprite();
    const figDy = p.figDy || 0;
    if (withBase) {
        const B = new Layer();
        base(B, color);
        sprite.commit(B);
    }
    const hx = 9;
    const hy = 6 + (p.headDy || 0) + figDy;
    if (c.hairBack) {
        const HB = new Layer();
        c.hairBack(HB, hx, hy, c);
        sprite.commit(HB);
    }
    const Lg = new Layer();
    legs(Lg, c, p.legs ? p.legs[0] : 0, p.legs ? p.legs[1] : 0);
    sprite.commit(Lg.shift(figDy));
    const T = new Layer();
    torso(T, c, 10, 19 + (p.bodyDy || 0));
    sprite.commit(T.shift(figDy));
    const Hd = new Layer();
    head(Hd, c, hx, hy, p);
    if (c.hair_) c.hair_(Hd, hx, hy, c);
    sprite.commit(Hd);
    const bd = p.bodyDy || 0;
    const AL = new Layer();
    armLeft(AL, c, [SHOULDER_L[0], SHOULDER_L[1] + bd], p.armL[0], p.armL[1]);
    sprite.commit(AL.shift(figDy));
    const AR = new Layer();
    armMic(AR, c, [SHOULDER_R[0], SHOULDER_R[1] + bd], p.armR[0], p.armR[1], p.grip || DOWN);
    sprite.commit(AR.shift(figDy));
    // Ondes sonores qui sortent du micro, sans contour
    if (p.waves) {
        const Wv = new Layer();
        const wx = 6;
        const wy = 17 + (p.headDy || 0) + figDy;
        Wv.rect(wx, wy - 1, 1, 3, '#FFFFFF').px(wx + 1, wy - 2, '#FFFFFF').px(wx + 1, wy + 2, '#FFFFFF');
        if (p.waves > 1) Wv.rect(wx - 2, wy - 2, 1, 5, '#BFD0FF').px(wx - 1, wy - 3, '#BFD0FF').px(wx - 1, wy + 3, '#BFD0FF');
        sprite.commit(Wv, null);
    }
    return sprite;
}

const frameCache = new Map();
const MAX_CACHE = 1500;

function paramsAt(pose, t) {
    const p = (POSES[pose] || POSES.idle)(t);
    const open = (p.eyes || 'open') === 'open';
    const blink = open && (t % 3.7) < 0.12;
    return { ...p, eyes: blink ? 'blink' : p.eyes || 'open', blinkLed: Math.floor(t * 3) % 2 };
}

/**
 * Image (canvas 32 x 54) d'un personnage dans une pose, à l'instant t (secondes).
 * Les images sont calculées à 10 par seconde et gardées en cache.
 */
export function getFrame(id, pose, t, color = PLAYER_COLORS[0], { base: withBase = true } = {}) {
    const c = CAST[id] || CAST.nova;
    const p = paramsAt(pose, Math.floor(t * 10) / 10);
    const cacheKey = `${id}|${withBase ? color : '-'}|${JSON.stringify(p)}`;
    let canvas = frameCache.get(cacheKey);
    if (canvas) return canvas;
    const sprite = compose(c, p, color, withBase);
    canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(SPRITE_W, SPRITE_H) : Object.assign(document.createElement('canvas'), { width: SPRITE_W, height: SPRITE_H });
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(SPRITE_W, SPRITE_H);
    sprite.c.forEach((col, i) => {
        if (!col) return;
        const [r, g, b] = hex(col);
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = g;
        img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = 255;
    });
    ctx.putImageData(img, 0, 0);
    if (frameCache.size > MAX_CACHE) frameCache.delete(frameCache.keys().next().value);
    frameCache.set(cacheKey, canvas);
    return canvas;
}

// ---------------------------------------------------------------------------
// Un personnage seul dans un <canvas> (salon, résultats, mini-jeux)
// ---------------------------------------------------------------------------

const mounted = new Set();
let raf = 0;
const reduceMotion = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function tick(now) {
    const t = now / 1000;
    mounted.forEach((m) => m.draw(t));
    raf = mounted.size ? requestAnimationFrame(tick) : 0;
}

export function mountSprite(canvas, { id, pose = 'idle', color = PLAYER_COLORS[0], base: withBase = true }) {
    canvas.width = SPRITE_W;
    canvas.height = SPRITE_H;
    const ctx = canvas.getContext('2d');
    const state = { id, pose, color, base: withBase, seed: Math.random() * 7, last: null };
    const m = {
        draw(t) {
            const frame = getFrame(state.id, state.pose, t + state.seed, state.color, { base: state.base });
            if (frame === state.last) return;
            state.last = frame;
            ctx.clearRect(0, 0, SPRITE_W, SPRITE_H);
            ctx.drawImage(frame, 0, 0);
        },
        update(next) { Object.assign(state, next); state.last = null; },
        destroy() { mounted.delete(m); },
    };
    m.draw(performance.now() / 1000);
    if (!reduceMotion) {
        mounted.add(m);
        if (!raf) raf = requestAnimationFrame(tick);
    }
    return m;
}
