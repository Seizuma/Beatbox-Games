// Le décor du plateau « Le Setup » : le bureau d'un beatboxer, la nuit, vu de trois
// quarts. Les joueurs sont des beatboxers miniatures qui marchent sur le matériel.
//
// Direction artistique : du matériel réel, sans néon. Châssis noir mat et sérigraphie
// blanche inspirés des loopstations de table (pads ronds en caoutchouc entourés d'un
// anneau de LED, faders, écran LCD graphique), bois chaud, mousse acoustique, et
// l'éclairage d'une lampe de bureau et de la lune. Les seules lumières colorées sont
// de petites LED de matériel.
//
// Le décor fixe est peint une seule fois, en deux temps :
// 1. chaque objet pose dans deux tampons une matière (bois, plastique, métal…) et un
//    « ton » de base (relief : dessus clair, face avant sombre, arêtes brillantes) ;
// 2. l'éclairage de la scène s'ajoute au ton, puis chaque pixel prend la couleur de la
//    rampe de sa matière, avec une trame ordonnée (Bayer) entre deux tons. Les LED et
//    les écrans sont « émissifs » : l'éclairage ne les touche pas.
//
// Les éléments animés (LED, écran, enceintes…) sont dessinés à chaque image par
// live.js, aux positions exportées ici.

import { glyphPixels, plain } from './pixelFont';

export const WORLD_W = 1664;
export const WORLD_H = 1144;
export const DESK_Y = 196;
export const DESK_FRONT = 1092;

// ---------------------------------------------------------------------------
// Matières : rampes de couleurs, du plus sombre au plus clair. Tons neutres et
// chauds (bois, noir mat), pas de bleu nuit saturé.
// ---------------------------------------------------------------------------

const RAMPS = {
    void: ['#050404', '#090807', '#0e0c0b', '#141210', '#1b1816'],
    wall: ['#0c0a0a', '#131010', '#1a1616', '#221d1c', '#2b2523', '#352e2b', '#403734', '#4c423e'],
    foam: ['#0b0b0d', '#111114', '#18181c', '#202025', '#29292f', '#33333a', '#3e3e46', '#4a4a53', '#57575f'],
    wood: ['#0b070e', '#120a13', '#1a0f17', '#24151b', '#2f1b1f', '#3c2224', '#4b2a28', '#5d342d', '#713f33', '#884b38', '#a1593e', '#bb6a46', '#d47f53'],
    chassis: ['#050506', '#09090b', '#0e0e11', '#141417', '#1a1a1e', '#212126', '#29292f', '#333339', '#3e3e45', '#4b4b53', '#5b5b64'],
    gear: ['#08080a', '#0d0d10', '#131317', '#1a1a1f', '#222228', '#2b2b32', '#35353d', '#41414a', '#4f4f59', '#60606b', '#74747f'],
    metal: ['#141416', '#1d1d21', '#27272c', '#323238', '#3f3f46', '#4e4e56', '#5f5f68', '#73737c', '#8a8a92', '#a3a3aa', '#bfbfc4', '#dcdcdf'],
    rubber: ['#0a0a0b', '#101012', '#17171a', '#1f1f23', '#28282d', '#323238', '#3d3d44', '#4a4a52', '#58585f'],
    cable: ['#040404', '#08080a', '#0e0e10', '#151517', '#1d1d20', '#26262a', '#313136', '#3e3e44', '#4e4e55'],
    chrome: ['#101012', '#19191c', '#242428', '#313136', '#414147', '#55555c', '#6c6c73', '#86868c', '#a3a3a8', '#c2c2c6', '#e0e0e3', '#ffffff'],
    silk: ['#3b3a37', '#57554f', '#76736b', '#95918a', '#b3afa7', '#cfcbc3', '#e6e3dc', '#f6f4ef'],
    gold: ['#241403', '#3d2304', '#5d3502', '#814a00', '#a86200', '#cd7d00', '#ec9d0b', '#ffbe28', '#ffd65e', '#ffeaa0', '#fff7d9'],
    brass: ['#1c1307', '#2e200d', '#443015', '#5c421d', '#765627', '#916b33', '#ad8243', '#c79b58', '#dcb574', '#ecd09a'],
    cork: ['#1d140c', '#2c1f13', '#3d2b1a', '#503923', '#64482c', '#7a5836', '#8f6840', '#a5794b', '#b98b5a'],
    paper: ['#2b2618', '#463e28', '#62583b', '#80754f', '#9d9165', '#b8ac7f', '#d0c59a', '#e4dab5', '#f3ebcf'],
    rose: ['#24141a', '#3a1f28', '#522b37', '#6c3947', '#864858', '#a05a6a', '#b86f7e', '#cd8794', '#dfa1ab'],
    ceramic: ['#141414', '#202020', '#303030', '#434343', '#595959', '#727272', '#8d8d8d', '#aaaaaa', '#c8c8c6', '#e2e1dd', '#f6f5f1'],
    coffee: ['#0b0503', '#150a06', '#21110a', '#2e180e', '#3d2113', '#4e2b18'],
    orange: ['#1c0a05', '#331208', '#511d0c', '#732a10', '#983914', '#b84b1c', '#d1622b', '#e27d42', '#ee9a62', '#f6b88a'],
    teal: ['#061212', '#0b1e1e', '#122e2d', '#1a403e', '#235350', '#2e6762', '#3b7b75', '#4c908a', '#62a59f', '#7fbab4'],
    purple: ['#0e0b14', '#181322', '#231c32', '#2f2643', '#3c3155', '#4a3d67', '#5a4b79', '#6c5c8b', '#806f9d', '#9585af'],
    cream: ['#171410', '#28231c', '#3e362b', '#584d3e', '#756753', '#94846b', '#b3a185', '#cfbea1', '#e8d8bc', '#f8ecd6'],
    velvet: ['#1a0408', '#2e070e', '#460b15', '#62101d', '#801726', '#9e2130', '#bb2f3c', '#d4464e'],
};
const MAT_NAMES = Object.keys(RAMPS);
const M = Object.fromEntries(MAT_NAMES.map((n, i) => [n, i]));
const EMIT = 255;
const RAMP_RGB = MAT_NAMES.map((n) => RAMPS[n].map((h) => {
    const v = parseInt(h.slice(1), 16);
    return [v >> 16, (v >> 8) & 255, v & 255];
}));

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const smooth = (a, b, x) => {
    const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
};
// Bruit déterministe
const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
};
const toHexInt = (h) => parseInt(h.slice(1), 16);

// ---------------------------------------------------------------------------
// Toile à matières
// ---------------------------------------------------------------------------

class Paint {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.mat = new Uint8Array(w * h);
        this.tone = new Float32Array(w * h);
        this.col = new Int32Array(w * h);
    }

    put(x, y, m, t) {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
        const i = y * this.w + x;
        if (m === EMIT) {
            this.mat[i] = EMIT;
            this.col[i] = typeof t === 'string' ? toHexInt(t) : t;
        } else {
            this.mat[i] = m;
            this.tone[i] = t;
        }
    }

    // Assombrit (ou éclaire) ce qui est déjà peint
    add(x, y, dt) {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
        const i = y * this.w + x;
        if (this.mat[i] !== EMIT) this.tone[i] += dt;
    }

    rect(x, y, w, h, m, t) {
        x = Math.round(x);
        y = Math.round(y);
        for (let j = 0; j < h; j += 1) {
            for (let i = 0; i < w; i += 1) {
                const v = typeof t === 'function' ? t(x + i, y + j, i / Math.max(1, w - 1), j / Math.max(1, h - 1)) : t;
                if (v !== null && v !== undefined) this.put(x + i, y + j, m, v);
            }
        }
    }

    ellipse(cx, cy, rx, ry, m, t) {
        for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y += 1) {
            for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x += 1) {
                const nx = (x + 0.5 - cx) / rx;
                const ny = (y + 0.5 - cy) / ry;
                const d = nx * nx + ny * ny;
                if (d <= 1) {
                    const v = typeof t === 'function' ? t(nx, ny, x, y, d) : t;
                    if (v !== null && v !== undefined) this.put(x, y, m, v);
                }
            }
        }
    }

    // Rectangle aux coins arrondis
    rrect(x, y, w, h, r, m, t) {
        this.rect(x, y, w, h, m, (px, py, u, v) => {
            const dx = Math.max(x + r - px - 0.5, px + 0.5 - (x + w - r), 0);
            const dy = Math.max(y + r - py - 0.5, py + 0.5 - (y + h - r), 0);
            if (dx * dx + dy * dy > r * r) return null;
            return typeof t === 'function' ? t(px, py, u, v) : t;
        });
    }

    poly(pts, m, t) {
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
                if (inside) this.put(x, y, m, typeof t === 'function' ? t(x, y, (px - minX) / Math.max(1, maxX - minX), (py - minY) / Math.max(1, maxY - minY)) : t);
            }
        }
    }

    // Tube (câble, pied de lampe) le long d'une ligne brisée ; t(nx, ny, s)
    tube(points, r, m, t) {
        for (let k = 0; k < points.length - 1; k += 1) {
            const [x0, y0] = points[k];
            const [x1, y1] = points[k + 1];
            const dx = x1 - x0;
            const dy = y1 - y0;
            const len2 = dx * dx + dy * dy || 1;
            for (let y = Math.floor(Math.min(y0, y1) - r - 1); y <= Math.ceil(Math.max(y0, y1) + r + 1); y += 1) {
                for (let x = Math.floor(Math.min(x0, x1) - r - 1); x <= Math.ceil(Math.max(x0, x1) + r + 1); x += 1) {
                    const px = x + 0.5;
                    const py = y + 0.5;
                    const s = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2));
                    const ex = px - (x0 + dx * s);
                    const ey = py - (y0 + dy * s);
                    if (ex * ex + ey * ey <= r * r) this.put(x, y, m, typeof t === 'function' ? t(ex / r, ey / r, k + s) : t);
                }
            }
        }
    }

    // Ombre douce sous un objet (ellipse ou rectangle arrondi), sur ce qui est déjà peint
    shadowEllipse(cx, cy, rx, ry, amount) {
        for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y += 1) {
            for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x += 1) {
                const nx = (x + 0.5 - cx) / rx;
                const ny = (y + 0.5 - cy) / ry;
                const d = Math.sqrt(nx * nx + ny * ny);
                if (d <= 1) this.add(x, y, -amount * smooth(1, 0.55, d));
            }
        }
    }

    shadowRect(x, y, w, h, amount, soft = 10) {
        for (let j = -soft; j < h + soft; j += 1) {
            for (let i = -soft; i < w + soft; i += 1) {
                const dx = Math.max(-i, i - w + 1, 0);
                const dy = Math.max(-j, j - h + 1, 0);
                const d = Math.sqrt(dx * dx + dy * dy) / soft;
                if (d < 1) this.add(x + i, y + j, -amount * (1 - smooth(0, 1, d)));
            }
        }
    }

    // Lumière posée sur la surface (halo d'une LED, d'un écran)
    spill(cx, cy, r, amount) {
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
            for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
                const d = Math.hypot((x + 0.5 - cx), (y + 0.5 - cy) * 1.5) / r;
                if (d < 1) this.add(x, y, amount * (1 - d) * (1 - d));
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Éclairage de la scène : lampe de bureau (chaude), lune (froide), projecteur doux
// ---------------------------------------------------------------------------

export const LIGHTS = {
    lamp: { x: 420, y: 480, r: 900, amp: 4.6 },
    moon: { x: 1380, y: 310, r: 470, amp: 1.0 },
    stage: { x: 1040, y: 380, r: 290, amp: 1.4 },
};

function lightAt(x, y) {
    let v = -1.35;
    Object.values(LIGHTS).forEach((L) => {
        const d = Math.hypot(x - L.x, (y - L.y) * 1.25) / L.r;
        if (d < 1) v += L.amp * (1 - d) ** 1.6;
    });
    v -= 1.6 * smooth(990, 1144, y);
    v -= 0.8 * smooth(1430, 1664, x) + 0.6 * smooth(180, 0, x);
    return v;
}

// ---------------------------------------------------------------------------
// Volumes et détails de matériel
// ---------------------------------------------------------------------------

// Boîtier vu de trois quarts : dessus (x, y, w, d) et face avant de hauteur h
function box(P, { x, y, w, d, h, r = 8, m, top = 4, front = 2.2, shadow = 2.4 }) {
    P.shadowRect(x + 12, y + d * 0.35, w + 6, d * 0.65 + h + 8, shadow, 16);
    P.rrect(x, y + h, w, d, r, m, front - 0.8);
    P.rect(x, y + d, w, h, m, (px, py, u, v) => {
        const left = px - x;
        const right = x + w - 1 - px;
        const bottom = y + d + h - 1 - py;
        if ((left < r || right < r) && bottom < r) {
            const cx = left < r ? r - left : r - right;
            const cy = r - bottom;
            if (cx * cx + cy * cy > r * r) return null;
        }
        return front - v * 0.9 - (bottom === 0 ? 0.6 : 0) + (py === y + d ? 1.4 : 0);
    });
    P.rrect(x, y, w, d, r, m, (px, py) => {
        let t = top;
        if (py === y) t += 1.6;
        else if (py === y + 1) t += 0.8;
        if (py >= y + d - 2) t += 1.1;
        if (px <= x + 1) t += 0.6;
        if (px >= x + w - 2) t -= 0.7;
        return t;
    });
}

// Sérigraphie blanche (texte en petite police)
function silk(P, text, x, y, { tone = 5, align = 'left' } = {}) {
    const { pixels, width } = glyphPixels(plain(text), 'tiny');
    const x0 = Math.round(align === 'center' ? x - width / 2 : align === 'right' ? x - width : x);
    pixels.forEach(([px, py]) => P.put(x0 + px, Math.round(y) + py, M.silk, tone));
}

// Filet sérigraphié autour d'une section, avec son titre
function silkFrame(P, x, y, w, h, label) {
    const tone = 3.6;
    P.rect(x, y, w, 1, M.silk, tone);
    P.rect(x, y + h - 1, w, 1, M.silk, tone);
    P.rect(x, y, 1, h, M.silk, tone);
    P.rect(x + w - 1, y, 1, h, M.silk, tone);
    if (label) {
        const { width } = glyphPixels(plain(label), 'tiny');
        P.rect(x + 8, y - 3, width + 6, 7, M.chassis, 4.4);
        silk(P, label, x + 11, y - 2, { tone: 5.4 });
    }
}

// Potard : jupe, capuchon, trait blanc
function knob(P, cx, cy, r, m = M.chassis, base = 5) {
    P.shadowEllipse(cx + 2, cy + 3, r + 2, r * 0.7 + 2, 1.6);
    P.ellipse(cx, cy + 2, r, r * 0.62, m, base - 2.5);
    P.ellipse(cx, cy, r, r * 0.62, m, (nx, ny, px, py, d) => base + (-nx * 0.6 - ny * 0.8) * 1.4 + (d > 0.8 ? -0.6 : 0) + ((px + py) % 3 === 0 && d > 0.75 ? 0.6 : 0));
    P.rect(cx - 0.5, cy - r * 0.62 + 1, 1, Math.max(2, r * 0.45), M.silk, 6);
}

// Fente de fader avec son curseur
function fader(P, cx, y0, y1, pos) {
    P.rect(cx - 2, y0, 4, y1 - y0, M.chassis, (px) => (px === cx - 2 ? 0.4 : 0.9));
    for (let k = 0; k <= 4; k += 1) P.rect(cx - 9, Math.round(y0 + ((y1 - y0) * k) / 4), 4, 1, M.silk, 3.2);
    const fy = y0 + (y1 - y0) * pos;
    P.shadowRect(cx - 8, fy + 2, 16, 10, 1.5, 3);
    P.rrect(cx - 10, fy - 5, 20, 11, 2, M.rubber, (px, py) => (py === Math.round(fy - 5) ? 7 : py > fy + 3 ? 3.5 : 5.2));
    P.rect(cx - 8, fy, 16, 1, M.silk, 5.6);
}

// Petit bouton en caoutchouc rectangulaire (avec sa LED, allumée dans live.js)
function rubberKey(P, x, y, w, h) {
    P.rrect(x, y + 2, w, h, 3, M.rubber, 1.4);
    P.rrect(x, y, w, h, 3, M.rubber, (px, py) => (py === y ? 6 : py > y + h - 3 ? 3.4 : 4.6));
}

// ---------------------------------------------------------------------------
// Mur du fond
// ---------------------------------------------------------------------------

function paintWall(P) {
    P.rect(0, 0, WORLD_W, DESK_Y, M.wall, 3);
    // Panneaux de mousse acoustique : dents alternées (verticales / horizontales)
    const PW = 80;
    const PH = 80;
    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col * PW < WORLD_W; col += 1) {
            const x0 = col * PW + 2;
            const y0 = row * PH + 6;
            if (y0 > DESK_Y - 10) continue;
            const vertical = (row + col) % 2 === 0;
            P.rect(x0, y0, PW - 4, Math.min(PH - 4, DESK_Y - 10 - y0), M.foam, (px, py) => {
                const k = vertical ? (px - x0) % 13 : (py - y0) % 13;
                let t = k < 4 ? 5 : k < 8 ? 3.9 : k < 11 ? 2.9 : 2.1;
                if (py === y0) t += 0.8;
                return t + (hash(px, py) - 0.5) * 0.5;
            });
        }
    }
    P.rect(0, DESK_Y - 10, WORLD_W, 10, M.wall, (px, py) => 1.2 - (py - (DESK_Y - 10)) * 0.08);
}

// Fenêtre : ciel de nuit, lune, immeubles (les fenêtres allumées scintillent dans live.js)
export const WINDOW = { x: 1209, y: 16, w: 306, h: 152 };
function paintWindow(P) {
    const { x, y, w, h } = WINDOW;
    P.rect(x - 8, y - 8, w + 16, h + 18, M.wood, (px, py) => (py < y - 6 ? 7 : py > y + h + 2 ? 3.6 : 5));
    for (let j = 0; j < h; j += 1) {
        const k = j / h;
        const r = Math.round(14 + k * 20);
        const g = Math.round(17 + k * 20);
        const b = Math.round(32 + k * 26);
        for (let i = 0; i < w; i += 1) P.put(x + i, y + j, EMIT, (r << 16) | (g << 8) | b);
    }
    for (let i = 0; i < 50; i += 1) {
        const sx = x + Math.floor(hash(i, 3) * w);
        const sy = y + Math.floor(hash(i, 7) * h * 0.55);
        P.put(sx, sy, EMIT, hash(i, 9) > 0.7 ? '#efe8d6' : '#6f7488');
    }
    const mx = x + w - 52;
    const my = y + 38;
    for (let j = -15; j <= 15; j += 1) {
        for (let i = -15; i <= 15; i += 1) {
            if (i * i + j * j <= 210) {
                const crater = (i + 4) ** 2 + (j - 3) ** 2 < 14 || (i - 6) ** 2 + (j + 5) ** 2 < 8;
                P.put(mx + i, my + j, EMIT, crater ? '#cfc8b4' : i + j < -10 ? '#fbf6e9' : '#ece4cc');
            }
        }
    }
    const skyline = [[0, 92], [29, 68], [62, 104], [91, 52], [125, 80], [156, 40], [185, 76], [218, 60], [247, 96], [278, 70]];
    skyline.forEach(([bx, bh], i) => {
        const bw = (skyline[i + 1] ? skyline[i + 1][0] : w) - bx;
        for (let j = h - bh; j < h; j += 1) {
            for (let k = 0; k < bw; k += 1) P.put(x + bx + k, y + j, EMIT, j === h - bh ? '#22232b' : '#0f1015');
        }
    });
    P.rect(x + w / 2 - 4, y, 8, h, M.wood, 5);
    P.rect(x, y + h / 2 - 3, w, 6, M.wood, 5);
    P.rect(x - 12, y + h + 8, w + 24, 8, M.wood, (px, py) => (py === y + h + 8 ? 7.5 : 4));
}

// Tableau en liège : flyers de battles, polaroïd, setlist (aucune lumière)
function paintCorkboard(P) {
    const x = 500;
    const y = 24;
    const w = 286;
    const h = 140;
    P.shadowRect(x + 6, y + 8, w, h, 1.6, 10);
    P.rect(x, y, w, h, M.wood, (px, py) => (px < x + 6 || py < y + 6 || px > x + w - 7 || py > y + h - 7 ? (py < y + 2 || px < x + 2 ? 7 : 4.6) : null));
    P.rect(x + 6, y + 6, w - 12, h - 12, M.cork, (px, py) => 4.2 + (hash(px, py) > 0.7 ? 0.8 : hash(px + 7, py) > 0.85 ? -0.8 : 0));
    const pin = (px, py, m) => {
        P.ellipse(px + 1, py + 2, 3, 2, M.cork, 2);
        P.ellipse(px, py, 3, 3, m, (nx, ny) => 6 + (-nx - ny) * 1.5);
    };
    // Flyer de battle : grande onde imprimée, lignes de titre
    const f1 = [x + 18, y + 16, 84, 108];
    P.shadowRect(f1[0] + 3, f1[1] + 4, f1[2], f1[3], 1.4, 4);
    P.rect(f1[0], f1[1], f1[2], f1[3], M.paper, (px, py, u, v) => 6 - v * 0.6);
    P.rect(f1[0] + 8, f1[1] + 10, 68, 9, M.chassis, 3);
    P.rect(f1[0] + 8, f1[1] + 22, 44, 4, M.chassis, 4);
    [10, 22, 34, 18, 40, 26, 14, 30, 20].forEach((bh, i) => P.rect(f1[0] + 10 + i * 7, f1[1] + 64 - bh / 2, 4, bh, M.velvet, 4.6));
    P.rect(f1[0] + 8, f1[1] + 90, 58, 3, M.chassis, 4);
    P.rect(f1[0] + 8, f1[1] + 96, 40, 3, M.chassis, 4);
    pin(f1[0] + 42, f1[1] + 4, M.velvet);
    // Affiche rose : silhouette de micro
    const f2 = [x + 116, y + 26, 74, 96];
    P.shadowRect(f2[0] + 3, f2[1] + 4, f2[2], f2[3], 1.4, 4);
    P.rect(f2[0], f2[1], f2[2], f2[3], M.rose, (px, py, u, v) => 5.4 - v * 0.6);
    P.ellipse(f2[0] + 37, f2[1] + 32, 13, 14, M.chassis, 3);
    P.rect(f2[0] + 33, f2[1] + 44, 8, 30, M.chassis, 3);
    P.rect(f2[0] + 10, f2[1] + 80, 54, 4, M.chassis, 3.6);
    pin(f2[0] + 37, f2[1] + 4, M.teal);
    // Polaroïd : une scène, de loin
    const f3 = [x + 204, y + 16, 62, 72];
    P.shadowRect(f3[0] + 3, f3[1] + 4, f3[2], f3[3], 1.4, 4);
    P.rect(f3[0], f3[1], f3[2], f3[3], M.ceramic, 8);
    P.rect(f3[0] + 5, f3[1] + 5, f3[2] - 10, 48, M.chassis, (px, py, u, v) => 1.5 + (Math.abs(u - 0.5) < 0.18 && v > 0.4 ? 4 : 0) + (v > 0.85 ? 1 : 0));
    pin(f3[0] + 31, f3[1] + 3, M.gold);
    // Setlist griffonnée
    const f4 = [x + 200, y + 96, 70, 34];
    P.rect(f4[0], f4[1], f4[2], f4[3], M.paper, 6.4);
    for (let l = 0; l < 3; l += 1) for (let i = 0; i < 52; i += 1) if (hash(i, l + 4) < 0.75) P.put(f4[0] + 8 + i, f4[1] + 8 + l * 8, M.chassis, 4);
}

// Disque vinyle encadré
function paintVinyl(P) {
    const x = 832;
    const y = 38;
    const s = 110;
    P.shadowRect(x + 5, y + 8, s, s, 1.4, 10);
    P.rect(x, y, s, s, M.wood, (px, py) => (px === x || py === y ? 8 : px === x + s - 1 || py === y + s - 1 ? 4 : 6));
    P.rect(x + 6, y + 6, s - 12, s - 12, M.cream, 3.4);
    P.ellipse(x + s / 2, y + s / 2, 43, 43, M.rubber, (nx, ny, px, py, d) => {
        const ring = Math.floor(Math.sqrt(d) * 18) % 2;
        return (nx < -0.2 && ny < -0.2 && d > 0.3 ? 5 : 2.2) + ring * 0.6;
    });
    P.ellipse(x + s / 2, y + s / 2, 13, 13, M.velvet, (nx, ny) => 5 + (-nx - ny) * 0.8);
    P.ellipse(x + s / 2, y + s / 2, 2, 2, M.void, 0);
}

// ---------------------------------------------------------------------------
// Bureau
// ---------------------------------------------------------------------------

function paintDesk(P) {
    for (let y = DESK_Y; y < DESK_FRONT; y += 1) {
        const plank = Math.floor((y - DESK_Y) / 60);
        const inPlank = (y - DESK_Y) % 60;
        const shift = (hash(plank, 1) - 0.5) * 0.6;
        for (let x = 0; x < WORLD_W; x += 1) {
            let t = 5.2 + shift;
            const g = Math.sin((y + Math.sin(x * 0.009 + plank * 2.1) * 9 + Math.sin(x * 0.036 + plank) * 2) * 0.65 + plank * 1.3);
            if (g > 0.86) t -= 0.8;
            else if (g < -0.93) t += 0.5;
            if (inPlank === 0) t -= 2.2;
            else if (inPlank === 1) t += 0.7;
            const seam = (x + plank * 225) % 546;
            if (seam === 0) t -= 1.8;
            else if (seam === 1) t += 0.5;
            P.put(x, y, M.wood, t);
        }
    }
    for (let y = DESK_Y; y < DESK_Y + 34; y += 1) for (let x = 0; x < WORLD_W; x += 1) P.add(x, y, -1.8 * (1 - (y - DESK_Y) / 34));
    P.rect(0, DESK_FRONT, WORLD_W, 20, M.wood, (px, py) => (py === DESK_FRONT ? 8.2 : py === DESK_FRONT + 1 ? 6.5 : 4.2 - (py - DESK_FRONT) * 0.1));
    P.rect(0, DESK_FRONT + 20, WORLD_W, WORLD_H - DESK_FRONT - 20, M.void, (px, py) => Math.max(0, 1.4 - (py - DESK_FRONT - 20) * 0.05));
}

// ---------------------------------------------------------------------------
// Objets du bureau
// ---------------------------------------------------------------------------

// Enceintes de monitoring (les membranes battent dans live.js)
export const MONITORS = [{ x: 31, y: 99, w: 117, h: 242 }, { x: 1516, y: 99, w: 117, h: 242 }];
function paintMonitor(P, { x, y, w, h }) {
    const top = 73;
    P.shadowRect(x + 14, y + h - 52, w + 8, 56, 2.6, 18);
    P.rrect(x, y, w, top, 7, M.gear, (px, py) => (py === y ? 7.5 : 5.4 - (py - y) * 0.02));
    P.rect(x, y + top, w, h - top, M.gear, (px, py, u, v) => (py === y + top ? 6.8 : px === x ? 4.2 : px === x + w - 1 ? 2 : 3.2 - v * 0.8));
    const cx = x + w / 2;
    P.ellipse(cx, y + top + 39, 16, 16, M.rubber, (nx, ny) => 2 + (-nx * 0.6 - ny * 0.8) * 1.2);
    P.ellipse(cx, y + top + 39, 6, 6, M.chrome, (nx, ny) => 6 + (-nx - ny) * 2);
    P.ellipse(cx, y + top + 112, 44, 44, M.gear, (nx, ny, px, py, d) => (d > 0.82 ? 5.2 + (-nx - ny) : 2));
    P.ellipse(cx, y + top + 112, 35, 35, M.rubber, (nx, ny, px, py, d) => 1.5 + d * 2.5 + (-nx * 0.5 - ny * 0.5) * 1.2);
    P.ellipse(cx, y + top + 112, 10, 10, M.rubber, (nx, ny) => 3 + (-nx - ny) * 1.2);
    P.rrect(cx - 18, y + h - 23, 36, 9, 4, M.void, 0.5);
    silk(P, 'STUDIO 5', cx, y + top + 8, { align: 'center', tone: 4.2 });
}

// Lampe de bureau articulée, en laiton
export const LAMP_BULB = { x: 421, y: 146 };
function paintLamp(P) {
    const bx = 255;
    const by = 302;
    P.shadowEllipse(bx + 18, by + 10, 60, 18, 2.4);
    P.ellipse(bx, by + 5, 44, 14, M.chassis, 2.2);
    P.ellipse(bx, by, 44, 14, M.chassis, (nx, ny) => 5 + (-nx * 0.6 - ny * 0.8) * 1.6);
    P.ellipse(bx - 3, by - 3, 10, 4, M.brass, 7);
    const arm = (nx, ny) => 5.5 + (-nx * 0.7 - ny * 0.7) * 2.5;
    P.tube([[bx, by - 3], [bx + 39, by - 135], [bx + 127, by - 195]], 4, M.brass, arm);
    P.ellipse(bx + 39, by - 135, 6, 6, M.brass, 7);
    const hx = bx + 127;
    const hy = by - 195;
    P.poly([[hx - 16, hy - 18], [hx + 21, hy - 26], [hx + 65, hy + 23], [hx + 10, hy + 44]], M.chassis, (px, py, u, v) => 3.6 + (1 - u) * 2 - v * 1.2);
    P.poly([[hx + 10, hy + 44], [hx + 65, hy + 23], [hx + 60, hy + 34], [hx + 16, hy + 52]], EMIT, (px, py) => ((px + py) % 3 ? '#fff0c9' : '#ffe2a0'));
}

// Micro géant sur son pied, au centre d'une scène ronde en bois
export const STAGE = { cx: 1040, cy: 380, rx: 218, ry: 73, h: 20 };
export const MIC = { x: 1040, top: 23 };
function paintStage(P) {
    const { cx, cy, rx, ry, h } = STAGE;
    P.shadowEllipse(cx + 18, cy + h + 8, rx + 10, ry + 8, 2.6);
    P.ellipse(cx, cy + h, rx, ry, M.wood, (nx, ny) => (ny > 0.2 ? 2.2 : null));
    P.rect(cx - rx, cy, rx * 2, h, M.wood, (px, py) => {
        const nx = (px + 0.5 - cx) / rx;
        if (nx * nx > 1) return null;
        return 3.4 - (py - cy) * 0.05 + ((px - cx + 900) % 34 === 0 ? -1 : 0);
    });
    P.ellipse(cx, cy, rx, ry, M.wood, (nx, ny, px, py, d) => {
        let t = 5.4 + ((px - cx + 900) % 34 === 0 ? -1.4 : 0) + (hash(px, Math.floor(py / 3)) - 0.5) * 0.4;
        if (d > 0.93) t = ny < 0 ? 7 : 4;
        return t;
    });
    // Retours de scène en fond de scène
    [[cx - 150, cy - 36, 1], [cx + 150, cy - 36, -1]].forEach(([wx, wy, dir]) => {
        P.shadowRect(wx - 22, wy + 6, 50, 16, 1.6, 6);
        P.poly([[wx - 26, wy + 12], [wx + 26, wy + 12], [wx + 22, wy - 10], [wx - 22, wy - 10]], M.chassis, (px, py, u, v) => 3.4 + (1 - v) * 1.2);
        P.rect(wx - 20, wy - 8, 40, 16, M.rubber, (px, py) => ((px + py) % 2 ? 2.4 : 1.6));
        P.rect(wx - 26, wy + 12, 52, 5, M.chassis, 2);
        void dir;
    });
    // Pied du micro : socle rond, tige
    P.shadowEllipse(cx + 10, cy - 10, 64, 21, 2.2);
    P.ellipse(cx, cy - 8, 57, 18, M.chrome, 3);
    P.ellipse(cx, cy - 13, 57, 18, M.chrome, (nx, ny) => 5.2 + (-nx * 0.6 - ny * 0.8) * 2.4);
    P.ellipse(cx - 16, cy - 19, 16, 4, M.chrome, 9);
    const rod = (nx) => 5.8 + -nx * 3.4 + (nx > 0.6 ? -1.5 : 0);
    P.tube([[cx, cy - 15], [cx, 218]], 5.4, M.chrome, rod);
    P.rect(cx - 9, 208, 18, 13, M.chrome, (px) => 4 + (cx - px) * 0.3);
    // Pince et micro dynamique : corps noir effilé, bague, grosse grille argentée
    P.rrect(cx - 21, 166, 42, 29, 6, M.chassis, (px, py) => 3.4 + (cx - px) * 0.06 + (py === 166 ? 1.5 : 0));
    P.poly([[cx - 13, 203], [cx + 13, 203], [cx + 19, 114], [cx - 19, 114]], M.chassis, (px, py, u) => 3.2 + (0.5 - u) * 4 + (u > 0.82 ? -1 : 0) + (u > 0.18 && u < 0.26 ? 1.6 : 0));
    P.rect(cx - 21, 101, 42, 14, M.metal, (px, py) => 6.4 + (cx - px) * 0.1 + (py === 101 ? 1.5 : py === 114 ? -2 : 0));
    const gy = MIC.top + 44;
    P.ellipse(cx, gy, 47, 52, M.chrome, (nx, ny, px, py, d) => {
        if (py > 104) return null;
        const light = -nx * 0.65 - ny * 0.55;
        const mesh = (px + py) % 4 === 0 || (px - py + 800) % 4 === 0 ? -1.3 : 0;
        const band = Math.abs(py - gy - 5) < 2 ? -1.2 : Math.abs(py - gy - 5) === 2 ? 1 : 0;
        return 6.4 + light * 3.4 + mesh + band + (d > 0.9 ? -1.4 : 0);
    });
    P.ellipse(cx - 18, MIC.top + 20, 9, 12, M.chrome, (nx, ny, px, py) => ((px + py) % 4 ? 10.5 : 9.5));
    P.rect(cx - 39, 96, 78, 6, M.chrome, (px) => 6 + (cx - px) * 0.05);
}

// Câble en caoutchouc noir, avec reflet et ombre
function cable(P, pts, r = 5) {
    let path = pts;
    for (let k = 0; k < 3; k += 1) {
        const next = [path[0]];
        for (let i = 0; i < path.length - 1; i += 1) {
            const [x0, y0] = path[i];
            const [x1, y1] = path[i + 1];
            next.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
        }
        next.push(path[path.length - 1]);
        path = next;
    }
    path.forEach(([x, y], i) => { if (i % 2 === 0) P.shadowEllipse(x + 5, y + 6, r + 4, r + 2, 0.5); });
    P.tube(path, r, M.cable, (nx, ny) => 3 + (-nx * 0.5 - ny * 0.85) * 3);
    return path;
}

// Casque audio posé à plat : deux oreillettes, l'arceau sert de chemin
function paintHeadphones(P) {
    const cups = [[374, 445], [666, 442]];
    P.shadowEllipse(520, 442, 220, 54, 1.6);
    cable(P, [[340, 470], [273, 484], [195, 455], [125, 478], [52, 468], [-13, 484]], 4.4);
    cups.forEach(([cx, cy]) => {
        P.shadowEllipse(cx + 10, cy + 13, 55, 34, 2.4);
        P.ellipse(cx, cy + 13, 52, 31, M.chassis, 1.8);
        P.rect(cx - 52, cy, 104, 13, M.chassis, (px) => {
            const nx = (px + 0.5 - cx) / 52;
            return nx * nx > 1 ? null : 2.6 - Math.abs(nx);
        });
        P.ellipse(cx, cy, 52, 31, M.chassis, (nx, ny) => 4.6 + (-nx * 0.6 - ny * 0.8) * 1.5);
        P.ellipse(cx, cy, 43, 25, M.metal, (nx, ny, px, py, d) => (d > 0.84 ? 4.6 + (-nx - ny) * 1.2 : null));
        P.ellipse(cx, cy, 37, 21, M.rubber, (nx, ny, px, py, d) => 3 + (1 - d) * 1.6 + (-nx * 0.4 - ny * 0.6) * 1.4 + (hash(px, py) > 0.92 ? 0.8 : 0));
    });
    const band = [[390, 416], [424, 390], [471, 380], [572, 380], [621, 390], [650, 413]];
    P.tube(band.map(([x, y]) => [x + 5, y + 15]), 12, M.chassis, 1.4);
    P.tube(band.map(([x, y]) => [x, y + 5]), 13, M.chassis, (nx, ny) => 4.4 + (-nx * 0.5 - ny * 0.8) * 1.8);
    P.tube(band.map(([x, y]) => [x, y + 3]), 8.5, M.rubber, (nx, ny, s) => 3.6 + (-ny) * 1.2 + (Math.floor(s * 6) % 2 ? 0 : -0.5));
    P.ellipse(424, 395, 9, 6, M.metal, (nx, ny) => 6 + (-nx - ny) * 1.6);
    P.ellipse(621, 395, 9, 6, M.metal, (nx, ny) => 6 + (-nx - ny) * 1.6);
}

// Table de mixage, au centre : quatre voies et le fader master (le raccourci)
export const MIXER = { x: 606, y: 471, w: 328, d: 260, h: 23 };
export const MIXER_METERS = [{ x: 726, y: 492, n: 12 }, { x: 806, y: 492, n: 12 }];
function paintMixer(P) {
    const { x, y, w, d, h } = MIXER;
    box(P, { x, y, w, d, h, r: 12, m: M.chassis, top: 4.4, front: 2.2 });
    [645, 686, 848, 889].forEach((cx, i) => {
        silk(P, `CH ${i + 1}`, cx, y + 12, { align: 'center', tone: 4.8 });
        [500, 532, 564].forEach((ky, j) => knob(P, cx, ky, 9, M.chassis, j === 0 ? 5.6 : 5));
        fader(P, cx, 598, 700, [0.3, 0.55, 0.4, 0.25][i]);
    });
    // Rail du master : une gorge où passent les cases
    P.rrect(745, y + 16, 44, d - 36, 10, M.chassis, (px) => (px < 749 ? 0.8 : 1.6));
    silk(P, 'MASTER', 767, y + d - 15, { align: 'center', tone: 5.2 });
    MIXER_METERS.forEach(({ x: mx, y: my, n }) => P.rect(mx - 4, my - 3, 10, n * 9 + 4, M.void, 1));
}

// Pad controller, à gauche : 4 x 3 pads, le chemin descend la première colonne
export const PADS = { x: 203, y: 473, w: 380, d: 255, h: 23, cols: [276, 361, 447, 533], rows: [527, 611, 696] };
function paintPadController(P) {
    const { x, y, w, d, h } = PADS;
    box(P, { x, y, w, d, h, r: 14, m: M.chassis, top: 4.2, front: 2.2 });
    silkFrame(P, x + 12, y + 14, w - 24, d - 26, 'PADS');
    PADS.cols.slice(1).forEach((cx) => PADS.rows.forEach((cy) => {
        P.rrect(cx - 30, cy - 17, 60, 42, 6, M.rubber, 1.2);
        P.rrect(cx - 28, cy - 20, 56, 38, 6, M.rubber, (px, py) => 4 + (py < cy - 16 ? 1 : 0) + (px < cx - 24 ? 0.5 : 0));
    }));
}

// Loopstation, en bas, inspirée des loopstations de table à cinq pistes :
// section INPUT FX, écran LCD graphique, section TRACK FX ; pour chaque piste, fader,
// boutons et grand pad rond entouré de son anneau de LED (les cases).
export const LOOP = {
    x: 328, y: 746, w: 957, d: 286, h: 29,
    tracks: [403, 585, 767, 949, 1131],
    screen: { x: 832, y: 772, w: 200, h: 50 },
    inputKeys: [376, 432, 488, 544],
    trackKeys: [1072, 1124, 1176, 1228],
};
function paintLoopstation(P) {
    const { x, y, w, d, h } = LOOP;
    box(P, { x, y, w, d, h, r: 16, m: M.chassis, top: 4.3, front: 2.2, shadow: 2.8 });
    // Section INPUT FX : quatre touches (LED dans live.js), deux potards
    silkFrame(P, x + 22, y + 14, 330, 74, 'INPUT FX');
    LOOP.inputKeys.forEach((kx, i) => {
        rubberKey(P, kx - 20, y + 42, 40, 18);
        silk(P, 'ABCD'[i], kx, y + 66, { align: 'center', tone: 5 });
    });
    knob(P, 612, y + 50, 13, M.chassis, 5.2);
    knob(P, 660, y + 50, 13, M.chassis, 5.2);
    silk(P, 'LEVEL', 636, y + 72, { align: 'center', tone: 4.6 });
    // Écran LCD graphique et sa lunette
    const s = LOOP.screen;
    P.rrect(s.x - 8, s.y - 8, s.w + 16, s.h + 16, 5, M.chassis, (px, py) => (py < s.y - 5 ? 2 : 1.2));
    P.rect(s.x, s.y, s.w, s.h, EMIT, '#0d1213');
    // Section TRACK FX
    silkFrame(P, 1050, y + 14, 214, 74, 'TRACK FX');
    LOOP.trackKeys.forEach((kx, i) => {
        rubberKey(P, kx - 18, y + 42, 36, 18);
        silk(P, 'ABCD'[i], kx, y + 66, { align: 'center', tone: 5 });
    });
    P.rect(x + 18, y + 100, w - 36, 1, M.silk, 3.4);
    // Pistes : numéro, fader, petites touches FX et TRACK
    LOOP.tracks.forEach((cx, i) => {
        silk(P, `TRACK ${i + 1}`, cx, y + 108, { align: 'center', tone: 5.4 });
        if (i !== 2) {
            fader(P, cx, y + 122, y + 184, [0.25, 0.5, 0, 0.35, 0.6][i]);
            rubberKey(P, cx - 52, y + 124, 26, 14);
            rubberKey(P, cx + 26, y + 124, 26, 14);
            silk(P, 'FX', cx - 39, y + 142, { align: 'center', tone: 4.4 });
            silk(P, 'TRK', cx + 39, y + 142, { align: 'center', tone: 4.4 });
        }
    });
    silk(P, 'LOOP STATION', x + 24, y + d - 14, { tone: 5.6 });
    silk(P, '5 TRACK', x + w - 24, y + d - 14, { align: 'right', tone: 4.6 });
}

// Chaîne de pédales d'effet compactes, à droite : boîtier, grande pédale articulée
export const PEDALS = [
    { cx: 1352, cy: 549, m: 'cream', label: 'DELAY' },
    { cx: 1368, cy: 640, m: 'purple', label: 'REVERB' },
    { cx: 1373, cy: 731, m: 'teal', label: 'CHORUS' },
    { cx: 1368, cy: 822, m: 'orange', label: 'DRIVE' },
    { cx: 1347, cy: 913, m: 'metal', label: 'LOOP' },
];
function paintPedals(P) {
    for (let i = 0; i < PEDALS.length - 1; i += 1) {
        const a = PEDALS[i];
        const b = PEDALS[i + 1];
        cable(P, [[a.cx + 58, a.cy - 12], [a.cx + 86, (a.cy + b.cy) / 2 - 16], [b.cx + 58, b.cy - 28]], 3.4);
    }
    PEDALS.forEach(({ cx, cy, m, label }) => {
        const mat = M[m];
        const x = cx - 52;
        const y = cy - 58;
        box(P, { x, y, w: 104, d: 76, h: 18, r: 8, m: mat, top: m === 'metal' ? 5 : 5.2, front: 3, shadow: 2.6 });
        // Bandeau du haut : deux potards, LED (live.js)
        knob(P, cx - 30, cy - 46, 7, M.chassis, 4.6);
        knob(P, cx + 30, cy - 46, 7, M.chassis, 4.6);
        silk(P, label, cx, cy - 50, { align: 'center', tone: m === 'cream' ? 1.4 : 6 });
        // Pédale articulée : plaque nervurée, un peu en relief
        P.rrect(x + 6, cy - 32, 92, 46, 6, mat, (px, py) => (py === cy - 32 ? 7 : 4.4 + ((py - cy) % 5 === 0 ? -0.6 : 0)));
        P.rect(x + 6, cy + 14, 92, 4, mat, 2.6);
    });
}

// Tasse de café géante (la vapeur monte dans live.js)
export const MUG = { cx: 1149, cy: 621, rx: 39, ry: 14, h: 75 };
function paintMug(P) {
    const { cx, cy, rx, ry, h } = MUG;
    P.shadowEllipse(cx + 18, cy + 8, rx + 18, ry + 8, 2.6);
    P.rect(cx - rx, cy - h, rx * 2, h, M.ceramic, (px) => {
        const nx = (px + 0.5 - cx) / rx;
        if (nx * nx > 1) return null;
        return 7.2 - nx * 3 - (nx > 0.75 ? 1.5 : 0) + (nx < -0.55 && nx > -0.75 ? 1.5 : 0);
    });
    P.ellipse(cx, cy, rx, ry, M.ceramic, (nx, ny) => (ny > 0 ? 7 - nx * 3 : null));
    P.tube([[cx + rx - 3, cy - h + 18], [cx + rx + 18, cy - h + 23], [cx + rx + 20, cy - h + 47], [cx + rx - 3, cy - h + 52]], 5.4, M.ceramic, (nx, ny) => 5.4 + (-nx * 0.6 - ny * 0.8) * 2.4);
    P.ellipse(cx, cy - h, rx, ry, M.ceramic, (nx, ny) => 8.6 - ny);
    P.ellipse(cx, cy - h + 1, rx - 5, ry - 4, M.coffee, (nx, ny) => 2.4 + ny * 1.2 + (nx < -0.3 && ny < -0.2 ? 1.6 : 0));
    [4, 8, 12, 6, 10, 5].forEach((bh, i) => P.rect(cx - 17 + i * 6, cy - h / 2 - bh / 2 + 8, 3, bh, M.chassis, 3));
}

// Téléphone posé à plat (son écran s'allume dans live.js)
export const PHONE = { x: 965, y: 608, w: 68, h: 120 };
function paintPhone(P) {
    const { x, y, w, h } = PHONE;
    P.shadowRect(x + 10, y + 10, w, h, 2.2, 10);
    P.rrect(x, y + 4, w, h, 10, M.chassis, 2);
    P.rrect(x, y, w, h, 10, M.chassis, (px, py) => (py === y ? 6 : 3.4));
    P.rrect(x + 5, y + 10, w - 10, h - 20, 4, EMIT, '#0b0d10');
}

// Notes repositionnables avec un pattern de beatbox griffonné
function paintNotes(P) {
    const notes = [[31, 588, M.paper], [91, 728, M.rose], [39, 863, M.paper]];
    notes.forEach(([x, y, m], k) => {
        P.shadowRect(x + 6, y + 8, 86, 81, 1.6, 8);
        P.rect(x, y, 86, 81, m, (px, py, u, v) => 5.6 - v * 0.8 + (py === y ? 1.2 : 0) + (u > 0.85 && v > 0.85 ? -1.5 : 0));
        silk(P, ['B T K T', 'PF TS', 'B . K .'][k], x + 12, y + 14, { tone: 0.6 });
        for (let line = 1; line < 4; line += 1) {
            for (let i = 0; i < 60; i += 1) {
                if (hash(i + k * 50, line) > 0.72 || (i % 15) > 11) continue;
                P.put(x + 12 + i, y + 18 + line * 14 + Math.round(Math.sin(i * 0.9 + line) * 1.4), m, 1.6);
            }
        }
    });
    P.tube([[153, 832], [255, 793]], 4.2, M.gold, (nx, ny) => 5.6 + (-nx * 0.6 - ny * 0.8) * 2);
    P.tube([[255, 793], [268, 788]], 2.8, M.cream, 6);
    P.tube([[146, 835], [153, 832]], 3.4, M.rose, 6);
}

// ---------------------------------------------------------------------------
// Cases : pads ronds en caoutchouc entourés d'un anneau de LED (la couleur dit le
// type), comme les pads de piste d'une loopstation. Sur le pad controller, pads carrés.
// ---------------------------------------------------------------------------

export const SPACE_COLORS = {
    blue: { ring: '#3F7EEA', light: '#9DBFFF', dark: '#1D3A78' },
    red: { ring: '#E2402F', light: '#FFA192', dark: '#741B13' },
    drop: { ring: '#2EB75E', light: '#93E8B2', dark: '#135A2C' },
    start: { ring: '#F0AE22', light: '#FFE4A0', dark: '#734D08' },
};

const ICONS = {
    plus: ['..##..', '..##..', '######', '######', '..##..', '..##..'],
    minus: ['......', '......', '######', '######', '......', '......'],
    drop: ['##..##', '.####.', '..##..', '##..##', '.####.', '..##..'],
    play: ['##....', '####..', '######', '######', '####..', '##....'],
};
const ICON_OF = { blue: 'plus', red: 'minus', drop: 'drop', start: 'play' };
export const RING_SEGMENTS = 16;

/** Géométrie d'une case : pad rond (anneau rx, ry) ou carré (w, h) */
export function padShape(space) {
    if (space.zone === 'pads') return { square: true, w: 56, h: 38, ringW: 64, ringH: 46 };
    return { square: false, rx: 23, ry: 14.5, ringRx: 31, ringRy: 19.5 };
}

// Segment de l'anneau sous un point (null dans les espaces entre segments)
function ringSegment(nx, ny) {
    const a = (Math.atan2(ny, nx) + Math.PI * 2.5) % (Math.PI * 2);
    const f = (a / (Math.PI * 2)) * RING_SEGMENTS;
    return f % 1 < 0.16 ? null : Math.floor(f);
}

// Anneau de LED, pad et pictogramme ; flash : chauffé à blanc (éclat au passage)
function paintPad(P, space, flash = false) {
    const c = SPACE_COLORS[space.type] || SPACE_COLORS.blue;
    const g = padShape(space);
    const cx = space.x;
    const cy = space.y;
    const ringColor = (nx, ny) => {
        if (flash) return ny < 0 ? '#ffffff' : c.light;
        return ny < -0.2 ? c.light : ny > 0.55 ? c.dark : c.ring;
    };
    if (g.square) {
        const x0 = cx - g.ringW / 2;
        const y0 = cy - g.ringH / 2;
        P.rrect(x0, y0, g.ringW, g.ringH, 8, EMIT, (px, py, u, v) => {
            const inner = px > x0 + 3 && px < x0 + g.ringW - 4 && py > y0 + 3 && py < y0 + g.ringH - 4;
            if (inner) return null;
            const seg = Math.floor(u * 8) + (v > 0.5 ? 8 : 0);
            if ((u * 8) % 1 < 0.1) return '#0e0e10';
            void seg;
            return ringColor(u * 2 - 1, v * 2 - 1);
        });
        P.rrect(cx - g.w / 2, cy - g.h / 2 + 4, g.w, g.h, 6, M.rubber, 1.6);
        P.rrect(cx - g.w / 2, cy - g.h / 2, g.w, g.h, 6, flash ? EMIT : M.rubber, flash ? '#cfcfd4' : (px, py, u, v) => 4.4 + (v < 0.12 ? 1.2 : 0) + (u < 0.1 ? 0.5 : 0) - (v > 0.88 ? 1 : 0));
    } else {
        P.ellipse(cx, cy + 1, g.ringRx, g.ringRy, EMIT, (nx, ny, px, py, d) => {
            if (d < 0.66) return null;
            const seg = ringSegment(nx, ny);
            return seg === null ? '#0e0e10' : ringColor(nx, ny);
        });
        P.ellipse(cx, cy + 4, g.rx, g.ry, M.rubber, 1.6);
        P.rect(cx - g.rx, cy, g.rx * 2, 4, M.rubber, (px) => {
            const nx = (px + 0.5 - cx) / g.rx;
            return nx * nx > 1 ? null : 2.6 - nx;
        });
        if (flash) P.ellipse(cx, cy, g.rx, g.ry, EMIT, (nx, ny) => (ny < -0.3 ? '#ffffff' : '#d8d8de'));
        else P.ellipse(cx, cy, g.rx, g.ry, M.rubber, (nx, ny, px, py, d) => 4.6 + (-nx * 0.5 - ny * 0.85) * 1.3 + (d > 0.85 ? -0.6 : 0));
    }
    // Pictogramme sérigraphié au centre du pad
    const icon = ICONS[ICON_OF[space.type] || 'plus'];
    const ix = Math.round(cx - 3);
    const iy = Math.round(cy - 3);
    icon.forEach((row, j) => {
        for (let i = 0; i < row.length; i += 1) {
            if (row[i] !== '#') continue;
            if (flash) P.put(ix + i, iy + j, EMIT, c.ring);
            else P.put(ix + i, iy + j, M.silk, 6.4);
        }
    });
}

function paintSpace(P, space) {
    const g = padShape(space);
    const cx = space.x;
    const cy = space.y;
    // Lumière de l'anneau sur la surface autour
    P.spill(cx, cy + 2, (g.ringRx || g.ringW / 2) * 1.8, 0.9);
    if (space.zone === 'stage' || space.zone === 'desk' || space.zone === 'cable') {
        // Socle en caoutchouc posé au sol
        P.shadowEllipse(cx + 6, cy + 9, 40, 25, 2);
        P.ellipse(cx, cy + 8, 37, 24, M.chassis, 1.6);
        P.rect(cx - 37, cy + 1, 74, 7, M.chassis, (px) => {
            const nx = (px + 0.5 - cx) / 37;
            return nx * nx > 1 ? null : 3 - nx;
        });
        P.ellipse(cx, cy + 1, 37, 24, M.chassis, (nx, ny) => 4.6 + (-nx * 0.6 - ny * 0.8) * 1.2);
    } else if (space.zone === 'phones' && space.kind === 'band') {
        P.ellipse(cx, cy + 4, 35, 23, M.chassis, (nx, ny) => 4 + (-nx * 0.6 - ny * 0.8));
    } else if (space.zone === 'mixer') {
        P.rrect(cx - 37, cy - 25, 74, 52, 8, M.chassis, (px, py) => (py < cy - 22 ? 4.4 : 1.6));
    } else if (!g.square) {
        // Appareil : creux sombre autour de l'anneau
        P.ellipse(cx, cy + 2, g.ringRx + 4, g.ringRy + 3.5, M.chassis, (nx, ny, px, py, d) => (d > 0.8 ? 2.6 + (ny > 0 ? 1.4 : -0.4) : 1));
    }
    paintPad(P, space);
    if (space.gate) paintGate(P, space);
}

// Cordon de velours à l'entrée du raccourci (l'ingé son est dessiné à part)
function paintGate(P, space) {
    const y = space.y - 44;
    [space.x - 40, space.x + 40].forEach((x) => {
        P.shadowEllipse(x + 5, y + 39, 11, 5, 1.6);
        P.ellipse(x, y + 36, 10, 4.5, M.brass, (nx, ny) => 6 + (-nx - ny) * 1.6);
        P.tube([[x, y + 34], [x, y]], 2.8, M.brass, (nx) => 6.5 - nx * 2.6);
        P.ellipse(x, y - 1, 4.4, 4.4, M.brass, (nx, ny) => 7 + (-nx - ny) * 1.8);
    });
    const rope = [];
    for (let i = 0; i <= 16; i += 1) rope.push([space.x - 40 + i * 5, y + 5 + Math.sin((i / 16) * Math.PI) * 12]);
    P.tube(rope, 3.2, M.velvet, (nx, ny) => 4.5 + (-nx * 0.5 - ny * 0.9) * 2.4);
}

/** Petite image d'une case chauffée à blanc, pour l'éclat au passage */
function flashSprite(space) {
    const w = 72;
    const h = 52;
    const P = new Paint(w, h);
    paintPad(P, { ...space, x: w / 2, y: h / 2 }, true);
    const canvas = resolve(P, null);
    return { canvas, ox: Math.round(space.x - w / 2), oy: Math.round(space.y - h / 2) };
}

// ---------------------------------------------------------------------------
// Rendu final : éclairage, trame, couleurs
// ---------------------------------------------------------------------------

function resolve(P, light) {
    const { w, h } = P;
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            const i = y * w + x;
            const m = P.mat[i];
            const o = i * 4;
            if (m === EMIT) {
                const c = P.col[i];
                data[o] = (c >> 16) & 255;
                data[o + 1] = (c >> 8) & 255;
                data[o + 2] = c & 255;
                data[o + 3] = 255;
                continue;
            }
            if (!light && P.tone[i] === 0 && m === 0) continue;
            const ramp = RAMP_RGB[m];
            const t = P.tone[i] + (light ? light(x, y) : 0);
            let idx = Math.floor(t + BAYER[(y & 3) * 4 + (x & 3)]);
            idx = idx < 0 ? 0 : idx >= ramp.length ? ramp.length - 1 : idx;
            const c = ramp[idx];
            data[o] = c[0];
            data[o + 1] = c[1];
            data[o + 2] = c[2];
            data[o + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
}

let worldCache = null;
/** Décor du plateau, peint une seule fois par plateau (partagé par le jeu et les scènes) */
export function getWorld(board) {
    if (!worldCache || worldCache.id !== board.id) worldCache = { id: board.id, ...buildWorld(board) };
    return worldCache;
}

/**
 * Peint le plateau entier. Renvoie l'image du décor fixe et, pour chaque case,
 * l'image de son pad chauffé à blanc (éclat quand un joueur passe dessus).
 */
export function buildWorld(board) {
    const P = new Paint(WORLD_W, WORLD_H);
    paintWall(P);
    paintCorkboard(P);
    paintVinyl(P);
    paintWindow(P);
    paintDesk(P);
    MONITORS.forEach((m) => paintMonitor(P, m));
    paintLamp(P);
    paintNotes(P);
    paintHeadphones(P);
    cable(P, [[1087, 390], [1209, 458], [1313, 478], [1443, 510], [1495, 611], [1490, 832], [1456, 991], [1352, 1014], [1287, 988]], 5.4);
    cable(P, [[278, 736], [268, 793], [265, 871], [302, 944], [340, 965]], 5);
    cable(P, [[832, 751], [840, 767]], 4.4);
    cable(P, [[702, 751], [676, 780]], 4.4);
    cable(P, [[1633, 325], [1651, 390], [1677, 416]], 4.4);
    cable(P, [[39, 341], [16, 390], [-13, 403]], 4.4);
    paintStage(P);
    paintPadController(P);
    paintMixer(P);
    paintMug(P);
    paintPhone(P);
    paintPedals(P);
    paintLoopstation(P);
    board.spaces.forEach((space) => paintSpace(P, space));
    const canvas = resolve(P, lightAt);
    const flashes = {};
    board.spaces.forEach((space) => { flashes[space.id] = flashSprite(space); });
    return { canvas, flashes };
}
