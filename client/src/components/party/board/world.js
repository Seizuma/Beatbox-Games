// Le décor du plateau « Le Setup » : le bureau d'un beatboxer, la nuit, vu de trois
// quarts. Les joueurs sont des beatboxers miniatures qui marchent sur le matériel.
//
// Le décor fixe est peint une seule fois, en deux temps :
// 1. chaque objet pose dans deux tampons une matière (bois, plastique, métal…) et un
//    « ton » de base (relief : dessus clair, face avant sombre, arêtes brillantes) ;
// 2. l'éclairage de la scène (lampe de bureau, lune, projecteur de la scène) s'ajoute
//    au ton, puis chaque pixel prend la couleur de la rampe de sa matière, avec une
//    trame ordonnée (Bayer) entre deux tons : c'est ce qui donne les dégradés tramés
//    du pixel art. Les LED, écrans et néons sont « émissifs » : l'éclairage ne les touche pas.
//
// Les éléments animés (LED, vumètres, écran, enceintes…) sont dessinés à chaque image
// par live.js, aux positions exportées ici.

export const WORLD_W = 1280;
export const WORLD_H = 880;
export const DESK_Y = 150;
export const DESK_FRONT = 840;

// ---------------------------------------------------------------------------
// Matières : rampes de couleurs, du plus sombre au plus clair (ombres froides,
// lumières chaudes)
// ---------------------------------------------------------------------------

const RAMPS = {
    void: ['#030409', '#06070e', '#0a0b15', '#0f111d', '#151827'],
    wall: ['#07081a', '#0b0d22', '#10132c', '#151937', '#1b2043', '#232951', '#2c3360', '#363e70'],
    foam: ['#07081a', '#0b0d24', '#101330', '#15193d', '#1b204b', '#22285a', '#2b326a', '#353d7b', '#41498b'],
    wood: ['#0b070e', '#120a13', '#1a0f17', '#24151b', '#2f1b1f', '#3c2224', '#4b2a28', '#5d342d', '#713f33', '#884b38', '#a1593e', '#bb6a46', '#d47f53'],
    gear: ['#05060c', '#090b14', '#0e111d', '#141827', '#1b2032', '#232940', '#2d344f', '#394161', '#475074', '#59638a', '#6f79a1'],
    metal: ['#10131f', '#181c2c', '#22273b', '#2e344b', '#3b425c', '#4b5370', '#5e6786', '#737d9d', '#8b95b4', '#a6b0ca', '#c4ccdf', '#e3e8f3'],
    rubber: ['#07080e', '#0c0e16', '#12141f', '#181c29', '#1f2433', '#272d3f', '#31384c', '#3c445b'],
    cable: ['#030408', '#07080f', '#0c0e17', '#121521', '#191d2b', '#222737', '#2d3347', '#3b425a', '#4d5571'],
    chrome: ['#0d1019', '#161a28', '#21263a', '#2e354d', '#3e4663', '#525c7c', '#6a7597', '#8590b1', '#a3adc9', '#c3cbdf', '#e3e8f2', '#ffffff'],
    gold: ['#241403', '#3d2304', '#5d3502', '#814a00', '#a86200', '#cd7d00', '#ec9d0b', '#ffbe28', '#ffd65e', '#ffeaa0', '#fff7d9'],
    paper: ['#2a230b', '#453a12', '#64561c', '#857426', '#a69231', '#c6b03f', '#e1cb52', '#f5e273', '#fff2a6'],
    pink: ['#22091a', '#3a0f2b', '#561840', '#742357', '#93306f', '#b24188', '#cf5ba2', '#e67fbc', '#f6a9d4'],
    ceramic: ['#121220', '#1e1e2d', '#2e2e40', '#424256', '#59596f', '#73738a', '#8f8fa6', '#adadc2', '#cbcbdb', '#e6e6f0', '#fbfbfe'],
    coffee: ['#0b0503', '#150a06', '#21110a', '#2e180e', '#3d2113', '#4e2b18'],
    orange: ['#1c0a05', '#331208', '#511d0c', '#732a10', '#983914', '#bd4c19', '#dc6423', '#f2823a', '#ffa45c', '#ffc589'],
    teal: ['#031315', '#062126', '#0a3239', '#0f454d', '#145b63', '#1b737b', '#268f95', '#3aabae', '#5cc6c5', '#8ddfdb'],
    purple: ['#0d071c', '#160c30', '#221247', '#2f1a5f', '#3e2378', '#4f2e92', '#633dab', '#7b55c2', '#9873d6', '#b897e6'],
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
// Éclairage de la scène
// ---------------------------------------------------------------------------

export const LIGHTS = {
    lamp: { x: 320, y: 360, r: 640, amp: 4.4 },
    moon: { x: 1060, y: 240, r: 360, amp: 1.2 },
    stage: { x: 800, y: 290, r: 230, amp: 1.8 },
};

function lightAt(x, y) {
    let v = -1.7;
    Object.values(LIGHTS).forEach((L) => {
        const d = Math.hypot(x - L.x, (y - L.y) * 1.25) / L.r;
        if (d < 1) v += L.amp * (1 - d) ** 1.6;
    });
    v -= 1.6 * smooth(760, 880, y);
    v -= 0.8 * smooth(1100, 1280, x) + 0.6 * smooth(140, 0, x);
    return v;
}

// ---------------------------------------------------------------------------
// Volumes
// ---------------------------------------------------------------------------

// Boîtier vu de trois quarts : dessus (x, y, w, d) et face avant de hauteur h
function box(P, { x, y, w, d, h, r = 8, m, top = 4, front = 2.2, shadow = 2.4 }) {
    P.shadowRect(x + 10, y + d * 0.35, w + 4, d * 0.65 + h + 6, shadow, 12);
    P.rrect(x, y + h, w, d, r, m, front - 0.8);
    P.rect(x, y + d, w, h, m, (px, py, u, v) => {
        // coins arrondis en bas de la face avant
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

// Bouton rond en relief (bouton d'appareil, potard)
function knob(P, cx, cy, r, m = M.metal, base = 6) {
    P.shadowEllipse(cx + 2, cy + 3, r + 2, r * 0.7 + 2, 1.6);
    P.ellipse(cx, cy + 2, r, r * 0.62, m, base - 2.5);
    P.ellipse(cx, cy, r, r * 0.62, m, (nx, ny) => base + (-nx * 0.6 - ny * 0.8) * 1.6);
    P.rect(cx - 0.5, cy - r * 0.62, 1, Math.max(2, r * 0.5), m, base + 3);
}

// Fente de fader avec son curseur
function fader(P, cx, y0, y1, pos, m = M.gear) {
    P.rect(cx - 2, y0, 4, y1 - y0, m, (px) => (px === cx - 2 ? 0.6 : 1.2));
    const fy = y0 + (y1 - y0) * pos;
    P.shadowRect(cx - 7, fy + 2, 14, 8, 1.5, 3);
    P.rrect(cx - 8, fy - 4, 16, 9, 2, M.metal, (px, py) => (py === Math.round(fy - 4) ? 9 : py > fy + 2 ? 4.5 : 6.5));
    P.rect(cx - 6, fy, 12, 1, M.metal, 3);
}

// ---------------------------------------------------------------------------
// Mur du fond
// ---------------------------------------------------------------------------

function paintWall(P) {
    P.rect(0, 0, WORLD_W, DESK_Y, M.wall, 3);
    // Panneaux de mousse acoustique : dents alternées (verticales / horizontales)
    const PW = 62;
    const PH = 62;
    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col * PW < WORLD_W; col += 1) {
            const x0 = col * PW + 2;
            const y0 = row * PH + 6;
            if (y0 > DESK_Y - 8) continue;
            const vertical = (row + col) % 2 === 0;
            P.rect(x0, y0, PW - 4, Math.min(PH - 4, DESK_Y - 8 - y0), M.foam, (px, py, u, v) => {
                const k = vertical ? (px - x0) % 10 : (py - y0) % 10;
                let t = k < 3 ? 5.2 : k < 6 ? 4 : k < 8 ? 3 : 2.2;
                if (py === y0) t += 0.8;
                return t + (hash(px, py) - 0.5) * 0.3;
            });
        }
    }
    // Plinthe : jonction mur / bureau
    P.rect(0, DESK_Y - 8, WORLD_W, 8, M.wall, (px, py) => 1.2 - (py - (DESK_Y - 8)) * 0.1);
}

// Fenêtre : ciel de nuit, lune, immeubles (les fenêtres allumées scintillent dans live.js)
export const WINDOW = { x: 930, y: 12, w: 236, h: 118 };
function paintWindow(P) {
    const { x, y, w, h } = WINDOW;
    P.rect(x - 6, y - 6, w + 12, h + 14, M.gear, (px, py) => (py < y - 4 ? 6 : py > y + h + 2 ? 3 : 4.5));
    for (let j = 0; j < h; j += 1) {
        const k = j / h;
        const r = Math.round(10 + k * 22);
        const g = Math.round(14 + k * 22);
        const b = Math.round(42 + k * 40);
        for (let i = 0; i < w; i += 1) P.put(x + i, y + j, EMIT, (r << 16) | (g << 8) | b);
    }
    // Étoiles
    for (let i = 0; i < 40; i += 1) {
        const sx = x + Math.floor(hash(i, 3) * w);
        const sy = y + Math.floor(hash(i, 7) * h * 0.6);
        P.put(sx, sy, EMIT, hash(i, 9) > 0.7 ? '#fff6d8' : '#7d86c4');
    }
    // Lune
    const mx = x + w - 40;
    const my = y + 30;
    for (let j = -12; j <= 12; j += 1) {
        for (let i = -12; i <= 12; i += 1) {
            if (i * i + j * j <= 132) {
                const crater = (i + 3) ** 2 + (j - 2) ** 2 < 10 || (i - 5) ** 2 + (j + 4) ** 2 < 6;
                P.put(mx + i, my + j, EMIT, crater ? '#d9cfae' : i + j < -8 ? '#fffaea' : '#f3e9c8');
            }
        }
    }
    // Immeubles en silhouette
    const skyline = [[0, 70], [22, 52], [48, 80], [70, 40], [96, 62], [120, 30], [142, 58], [168, 46], [190, 74], [214, 54]];
    skyline.forEach(([bx, bh], i) => {
        const bw = (skyline[i + 1] ? skyline[i + 1][0] : w) - bx;
        for (let j = h - bh; j < h; j += 1) {
            for (let k = 0; k < bw; k += 1) P.put(x + bx + k, y + j, EMIT, j === h - bh ? '#1a1f3e' : '#0b0d1f');
        }
    });
    // Croisillons
    P.rect(x + w / 2 - 3, y, 6, h, M.gear, 5);
    P.rect(x, y + h / 2 - 2, w, 5, M.gear, 5);
    // Rebord
    P.rect(x - 10, y + h + 6, w + 20, 6, M.gear, (px, py) => (py === y + h + 6 ? 7 : 4));
}

// Néon : l'onde sonore du logo de BeatBox Games
export const NEON = { x: 392, y: 20, w: 214, h: 104, bars: [16, 34, 56, 36, 76, 44, 62, 30, 46, 22, 12] };
export const NEON_TUBES = [];
function paintNeon(P) {
    const { x, y, w, h, bars } = NEON;
    NEON_TUBES.length = 0;
    P.shadowRect(x + 4, y + 6, w, h, 1.4, 8);
    P.rrect(x, y, w, h, 6, M.gear, (px, py) => (py === y ? 4 : px === x || px === x + w - 1 ? 2.6 : 1.8));
    [[x + 8, y + 8], [x + w - 10, y + 8], [x + 8, y + h - 10], [x + w - 10, y + h - 10]].forEach(([sx, sy]) => P.ellipse(sx, sy, 2.5, 2.5, M.chrome, 7));
    const step = (w - 30) / (bars.length - 1);
    bars.forEach((bh, i) => {
        const cx = Math.round(x + 15 + i * step);
        const cy = y + h / 2;
        NEON_TUBES.push({ x: cx - 3, y: Math.round(cy - bh / 2), w: 7, h: Math.round(bh) });
        for (let j = Math.round(cy - bh / 2); j < Math.round(cy + bh / 2); j += 1) {
            const end = Math.min(j - (cy - bh / 2), cy + bh / 2 - j);
            for (let k = -3; k <= 3; k += 1) {
                if (end < 2 && Math.abs(k) > 2 - end) continue;
                const c = Math.abs(k) <= 1 ? '#fff4c7' : Math.abs(k) === 2 ? '#ffc72c' : '#c98a00';
                P.put(cx + k, j, EMIT, c);
            }
        }
    });
}

// Disque vinyle encadré
function paintVinyl(P) {
    const x = 640;
    const y = 30;
    P.shadowRect(x + 4, y + 6, 84, 84, 1.3, 8);
    P.rect(x, y, 84, 84, M.wood, (px, py) => (px === x || py === y ? 8 : px === x + 83 || py === y + 83 ? 4 : 6));
    P.rect(x + 5, y + 5, 74, 74, M.cream, 3.4);
    P.ellipse(x + 42, y + 42, 33, 33, M.rubber, (nx, ny, px, py, d) => {
        const ring = Math.floor(Math.sqrt(d) * 14) % 2;
        return (nx < -0.2 && ny < -0.2 && d > 0.3 ? 5.5 : 2.5) + ring * 0.6;
    });
    P.ellipse(x + 42, y + 42, 10, 10, M.velvet, (nx, ny) => 5 + (-nx - ny) * 0.8);
    P.ellipse(x + 42, y + 42, 1.6, 1.6, M.void, 0);
}

// ---------------------------------------------------------------------------
// Bureau
// ---------------------------------------------------------------------------

function paintDesk(P) {
    for (let y = DESK_Y; y < DESK_FRONT; y += 1) {
        const plank = Math.floor((y - DESK_Y) / 46);
        const inPlank = (y - DESK_Y) % 46;
        const shift = (hash(plank, 1) - 0.5) * 0.6;
        for (let x = 0; x < WORLD_W; x += 1) {
            let t = 5.2 + shift;
            const g = Math.sin((y + Math.sin(x * 0.012 + plank * 2.1) * 7 + Math.sin(x * 0.047 + plank) * 1.6) * 0.85 + plank * 1.3);
            if (g > 0.86) t -= 0.8;
            else if (g < -0.93) t += 0.5;
            if (inPlank === 0) t -= 2.2;
            else if (inPlank === 1) t += 0.7;
            // Joints décalés entre deux planches
            const seam = (x + plank * 173) % 420;
            if (seam === 0) t -= 1.8;
            else if (seam === 1) t += 0.5;
            P.put(x, y, M.wood, t);
        }
    }
    // Ombre du mur sur le fond du bureau
    for (let y = DESK_Y; y < DESK_Y + 26; y += 1) for (let x = 0; x < WORLD_W; x += 1) P.add(x, y, -1.8 * (1 - (y - DESK_Y) / 26));
    // Chant du bureau, puis le vide (le sol est loin en dessous)
    P.rect(0, DESK_FRONT, WORLD_W, 16, M.wood, (px, py) => (py === DESK_FRONT ? 8.2 : py === DESK_FRONT + 1 ? 6.5 : 4.2 - (py - DESK_FRONT) * 0.12));
    P.rect(0, DESK_FRONT + 16, WORLD_W, WORLD_H - DESK_FRONT - 16, M.void, (px, py) => Math.max(0, 1.4 - (py - DESK_FRONT - 16) * 0.05));
}

// ---------------------------------------------------------------------------
// Objets du bureau
// ---------------------------------------------------------------------------

// Enceintes de monitoring (les membranes battent dans live.js)
export const MONITORS = [{ x: 24, y: 76, w: 90, h: 186 }, { x: 1166, y: 76, w: 90, h: 186 }];
function paintMonitor(P, { x, y, w, h }) {
    const top = 56;
    P.shadowRect(x + 12, y + h - 40, w + 6, 44, 2.6, 14);
    // Dessus
    P.rrect(x, y, w, top, 6, M.gear, (px, py) => (py === y ? 7.5 : 5.6 - (py - y) * 0.02));
    // Face avant
    P.rect(x, y + top, w, h - top, M.gear, (px, py, u, v) => (py === y + top ? 6.8 : px === x ? 4.2 : px === x + w - 1 ? 2 : 3.2 - v * 0.8));
    const cx = x + w / 2;
    // Tweeter et boomer
    P.ellipse(cx, y + top + 30, 12, 12, M.rubber, (nx, ny) => 2 + (-nx * 0.6 - ny * 0.8) * 1.2);
    P.ellipse(cx, y + top + 30, 5, 5, M.chrome, (nx, ny) => 6 + (-nx - ny) * 2);
    P.ellipse(cx, y + top + 86, 34, 34, M.gear, (nx, ny, px, py, d) => (d > 0.82 ? 5.2 + (-nx - ny) : 2));
    P.ellipse(cx, y + top + 86, 27, 27, M.rubber, (nx, ny, px, py, d) => 1.5 + d * 2.5 + (-nx * 0.5 - ny * 0.5) * 1.2);
    P.ellipse(cx, y + top + 86, 8, 8, M.rubber, (nx, ny) => 3 + (-nx - ny) * 1.2);
    // Évent bass reflex et LED (allumée dans live.js)
    P.rrect(cx - 14, y + h - 18, 28, 7, 3, M.void, 0.5);
}

// Lampe de bureau articulée
function paintLamp(P) {
    const bx = 196;
    const by = 232;
    P.shadowEllipse(bx + 14, by + 8, 46, 14, 2.4);
    P.ellipse(bx, by + 4, 34, 11, M.gear, 2.2);
    P.ellipse(bx, by, 34, 11, M.gear, (nx, ny) => 5 + (-nx * 0.6 - ny * 0.8) * 1.6);
    P.ellipse(bx - 2, by - 2, 8, 3, M.metal, 7);
    const arm = (nx, ny) => 5.5 + (-nx * 0.7 - ny * 0.7) * 2.5;
    P.tube([[bx, by - 2], [bx + 30, by - 104], [bx + 98, by - 150]], 3.2, M.metal, arm);
    P.ellipse(bx + 30, by - 104, 5, 5, M.chrome, 7);
    // Abat-jour, ouverture vers le bas à droite
    const hx = bx + 98;
    const hy = by - 150;
    P.poly([[hx - 12, hy - 14], [hx + 16, hy - 20], [hx + 50, hy + 18], [hx + 8, hy + 34]], M.gold, (px, py, u, v) => 4.2 + (1 - u) * 2 - v * 1.4);
    P.poly([[hx + 8, hy + 34], [hx + 50, hy + 18], [hx + 46, hy + 26], [hx + 12, hy + 40]], EMIT, (px, py) => ((px + py) % 3 ? '#fff1c2' : '#ffe08a'));
}
export const LAMP_BULB = { x: 324, y: 112 };

// Micro géant sur son pied, au centre d'une scène ronde
export const STAGE = { cx: 800, cy: 292, rx: 168, ry: 56, h: 16 };
export const MIC = { x: 800, top: 18 };
function paintStage(P) {
    const { cx, cy, rx, ry, h } = STAGE;
    P.shadowEllipse(cx + 14, cy + h + 6, rx + 8, ry + 6, 2.6);
    P.ellipse(cx, cy + h, rx, ry, M.gear, (nx, ny) => (ny > 0.2 ? 1.6 : null));
    P.rect(cx - rx, cy, rx * 2, h, M.gear, (px, py) => {
        const nx = (px + 0.5 - cx) / rx;
        if (nx * nx > 1) return null;
        return 2.6 - (py - cy) * 0.06;
    });
    P.ellipse(cx, cy + h, rx, ry, M.gear, (nx, ny, px, py, d) => (ny > 0 && d > 0.9 ? 2 : null));
    // Plancher de la scène : lattes sombres
    P.ellipse(cx, cy, rx, ry, M.wood, (nx, ny, px, py, d) => {
        let t = 4.2 + ((px - cx + 400) % 26 === 0 ? -1.4 : 0);
        if (d > 0.9) t = ny < 0 ? 6.5 : 3.2;
        return t;
    });
    // Pied du micro : socle rond en chrome, tige
    P.shadowEllipse(cx + 8, cy - 8, 50, 16, 2.2);
    P.ellipse(cx, cy - 6, 44, 14, M.chrome, 3);
    P.ellipse(cx, cy - 10, 44, 14, M.chrome, (nx, ny) => 5.2 + (-nx * 0.6 - ny * 0.8) * 2.4);
    P.ellipse(cx - 12, cy - 15, 12, 3, M.chrome, 9);
    const rod = (nx) => 5.8 + -nx * 3.4 + (nx > 0.6 ? -1.5 : 0);
    P.tube([[cx, cy - 12], [cx, 168]], 4.2, M.chrome, rod);
    P.rect(cx - 7, 160, 14, 10, M.chrome, (px) => 4 + (cx - px) * 0.3);
    P.tube([[cx, 160], [cx, 134]], 3.2, M.chrome, rod);
    // Pince et micro dynamique : corps noir effilé, bague dorée, grosse grille argentée
    P.rrect(cx - 16, 128, 32, 22, 5, M.gear, (px, py) => 3.4 + (cx - px) * 0.08 + (py === 128 ? 1.5 : 0));
    P.poly([[cx - 10, 156], [cx + 10, 156], [cx + 15, 88], [cx - 15, 88]], M.gear, (px, py, u) => 3.2 + (0.5 - u) * 4 + (u > 0.82 ? -1 : 0) + (u > 0.18 && u < 0.26 ? 1.6 : 0));
    P.rect(cx - 16, 78, 32, 11, M.gold, (px, py) => 7 + (cx - px) * 0.14 + (py === 78 ? 1.5 : py === 88 ? -2 : 0));
    const gy = MIC.top + 34;
    P.ellipse(cx, gy, 36, 40, M.chrome, (nx, ny, px, py, d) => {
        if (py > 80) return null;
        const light = -nx * 0.65 - ny * 0.55;
        const mesh = (px + py) % 4 === 0 || (px - py + 400) % 4 === 0 ? -1.3 : 0;
        const band = Math.abs(py - gy - 4) < 2 ? -1.2 : Math.abs(py - gy - 4) === 2 ? 1 : 0;
        return 6.6 + light * 3.4 + mesh + band + (d > 0.9 ? -1.4 : 0);
    });
    P.ellipse(cx - 14, MIC.top + 16, 7, 9, M.chrome, (nx, ny, px, py) => ((px + py) % 4 ? 11 : 9.5));
    P.rect(cx - 30, 74, 60, 5, M.chrome, (px) => 6 + (cx - px) * 0.06);
}

// Casque audio posé à plat : deux oreillettes, l'arceau sert de chemin
function paintHeadphones(P) {
    const cups = [[288, 342], [512, 340]];
    P.shadowEllipse(400, 340, 170, 42, 1.6);
    // Câble qui part de l'oreillette gauche
    cable(P, [[262, 362], [210, 372], [150, 350], [96, 368], [40, 360], [-10, 372]], 3.4);
    cups.forEach(([cx, cy]) => {
        P.shadowEllipse(cx + 8, cy + 10, 42, 26, 2.4);
        P.ellipse(cx, cy + 10, 40, 24, M.gear, 1.8);
        P.rect(cx - 40, cy, 80, 10, M.gear, (px) => {
            const nx = (px + 0.5 - cx) / 40;
            return nx * nx > 1 ? null : 2.6 - Math.abs(nx);
        });
        P.ellipse(cx, cy, 40, 24, M.gear, (nx, ny) => 4.8 + (-nx * 0.6 - ny * 0.8) * 1.5);
        P.ellipse(cx, cy, 33, 19, M.pink, (nx, ny, px, py, d) => (d > 0.78 ? 4.2 + (-nx - ny) * 1.2 : null));
        // Coussinet en simili cuir
        P.ellipse(cx, cy, 28, 16, M.rubber, (nx, ny, px, py, d) => 3 + (1 - d) * 1.6 + (-nx * 0.4 - ny * 0.6) * 1.4 + (hash(px, py) > 0.92 ? 0.8 : 0));
        P.ellipse(cx, cy + 1, 17, 10, M.rubber, (nx, ny) => 1.6 + (nx + ny) * 0.4);
    });
    // Arceau : bande matelassée
    const band = [[300, 320], [326, 300], [362, 292], [440, 292], [478, 300], [500, 318]];
    P.tube(band.map(([x, y]) => [x + 4, y + 12]), 9, M.gear, 1.4);
    P.tube(band.map(([x, y]) => [x, y + 4]), 10, M.gear, (nx, ny) => 4.6 + (-nx * 0.5 - ny * 0.8) * 1.8);
    P.tube(band.map(([x, y]) => [x, y + 2]), 6.5, M.rubber, (nx, ny, s) => 3.6 + (-ny) * 1.2 + (Math.floor(s * 6) % 2 ? 0 : -0.5));
    P.ellipse(326, 304, 7, 5, M.metal, (nx, ny) => 6 + (-nx - ny) * 1.6);
    P.ellipse(478, 304, 7, 5, M.metal, (nx, ny) => 6 + (-nx - ny) * 1.6);
}

// Câble en caoutchouc noir, avec reflet et ombre
function cable(P, pts, r = 4) {
    // Lissage : courbe de Chaikin
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
    P.tube(path.map(([x, y]) => [x + 3, y + 4]), r + 1.5, M.cable, null);
    path.forEach(([x, y], i) => { if (i % 2 === 0) P.shadowEllipse(x + 4, y + 5, r + 3, r + 2, 0.5); });
    P.tube(path, r, M.cable, (nx, ny) => 3 + (-nx * 0.5 - ny * 0.85) * 3.2);
    return path;
}

// Table de mixage, au centre : quatre voies et le fader master (le raccourci)
export const MIXER = { x: 466, y: 362, w: 252, d: 200, h: 18 };
export const MIXER_METERS = [{ x: 560, y: 380, n: 12 }, { x: 618, y: 380, n: 12 }];
function paintMixer(P) {
    const { x, y, w, d, h } = MIXER;
    box(P, { x, y, w, d, h, r: 10, m: M.gear, top: 4.6, front: 2.4 });
    // Plaque métal brossé
    P.rrect(x + 8, y + 8, w - 16, d - 18, 6, M.metal, (px, py) => 3.6 + (hash(px * 0.2, py) - 0.5) * 0.35 + (py === y + 8 ? 1.4 : 0));
    // Quatre voies : potards et faders
    [496, 528, 656, 688].forEach((cx, i) => {
        [384, 410, 436].forEach((ky, j) => knob(P, cx, ky, 7, j === 0 ? M.gold : M.metal, j === 0 ? 5 : 6));
        fader(P, cx, 460, 540, [0.3, 0.55, 0.4, 0.25][i]);
    });
    // Rail du master : une gorge éclairée où passent les cases
    P.rrect(574, y + 14, 36, d - 30, 8, M.gear, (px, py) => (px < 577 ? 1.2 : 2.2) + (py === y + 14 ? -0.6 : 0));
    // Vumètres (allumés dans live.js)
    MIXER_METERS.forEach(({ x: mx, y: my, n }) => P.rect(mx - 3, my - 2, 8, n * 7 + 3, M.void, 1));
}

// Pad controller, à gauche : 4 x 4 pads, le chemin descend la première colonne
export const PADS = { x: 156, y: 364, w: 292, d: 196, h: 18, cols: [212, 278, 344, 410], rows: [405, 470, 535] };
function paintPadController(P) {
    const { x, y, w, d, h } = PADS;
    box(P, { x, y, w, d, h, r: 12, m: M.gear, top: 4.2, front: 2.2 });
    P.rrect(x + 10, y + 10, w - 20, d - 22, 8, M.gear, (px, py) => 3.2 + (py === y + 10 ? -0.8 : 0));
    // Pads décoratifs (les trois colonnes de droite) : caoutchouc éteint ; ils s'allument dans live.js
    PADS.cols.slice(1).forEach((cx) => PADS.rows.forEach((cy) => {
        P.rrect(cx - 23, cy - 13, 46, 32, 5, M.rubber, 1.2);
        P.rrect(cx - 21, cy - 15, 42, 28, 5, M.rubber, (px, py) => 4 + (py < cy - 12 ? 1 : 0) + (px < cx - 18 ? 0.5 : 0));
    }));
}

// Loopstation, en bas : cinq pistes (pad rond, fader, numéro), écran LCD
export const LOOP = { x: 252, y: 574, w: 736, d: 220, h: 22, tracks: [310, 450, 590, 730, 870], screen: { x: 664, y: 590, w: 176, h: 40 } };
function paintLoopstation(P) {
    const { x, y, w, d, h } = LOOP;
    box(P, { x, y, w, d, h, r: 14, m: M.gear, top: 4.4, front: 2.4, shadow: 2.8 });
    // Bandeau métal en haut, écran, potards
    P.rrect(x + 12, y + 10, w - 24, 50, 8, M.metal, (px, py) => 3.4 + (py === y + 10 ? 1.4 : 0) + (hash(px * 0.3, py) - 0.5) * 0.3);
    const s = LOOP.screen;
    P.rrect(s.x - 4, s.y - 4, s.w + 8, s.h + 8, 4, M.gear, 1.2);
    [300, 352, 404, 456, 508].forEach((kx) => knob(P, kx, y + 34, 9, M.metal, 6));
    [880, 920, 960].forEach((kx, i) => knob(P, kx, y + 34, 8, i === 1 ? M.velvet : M.metal, i === 1 ? 5 : 6));
    // Pistes : fente de fader au-dessus de chaque pad
    LOOP.tracks.forEach((cx, i) => {
        if (cx !== 590) fader(P, cx, y + 72, y + 132, [0.2, 0.45, 0, 0.35, 0.6][i]);
        // Sérigraphie : numéro de la piste (dessiné par live.js, émissif)
    });
    // Rainure entre les pistes
    for (let i = 0; i < 4; i += 1) P.rect(LOOP.tracks[i] + 70 - 1, y + 70, 1, d - 84, M.gear, 2.6);
}

// Chaîne de pédales d'effet, à droite
export const PEDALS = [
    { cx: 1040, cy: 422, m: 'cream' },
    { cx: 1052, cy: 492, m: 'purple' },
    { cx: 1056, cy: 562, m: 'teal' },
    { cx: 1052, cy: 632, m: 'orange' },
    { cx: 1036, cy: 702, m: 'metal' },
];
function paintPedals(P) {
    // Câbles de liaison sur le côté droit
    for (let i = 0; i < PEDALS.length - 1; i += 1) {
        const a = PEDALS[i];
        const b = PEDALS[i + 1];
        cable(P, [[a.cx + 44, a.cy - 10], [a.cx + 66, (a.cy + b.cy) / 2 - 12], [b.cx + 44, b.cy - 22]], 2.6);
    }
    PEDALS.forEach(({ cx, cy, m }) => {
        const mat = M[m];
        const x = cx - 44;
        const y = cy - 44;
        box(P, { x, y, w: 88, d: 56, h: 14, r: 7, m: mat, top: m === 'metal' ? 5 : 5.4, front: 3, shadow: 2.6 });
        // Deux potards et une vis
        knob(P, cx - 22, cy - 30, 6, M.gear, 4.5);
        knob(P, cx + 22, cy - 30, 6, M.gear, 4.5);
        P.rect(cx - 30, cy - 12, 60, 1, mat, 3);
    });
}

// Tasse de café géante (la vapeur monte dans live.js)
export const MUG = { cx: 884, cy: 478, rx: 30, ry: 11, h: 58 };
function paintMug(P) {
    const { cx, cy, rx, ry, h } = MUG;
    P.shadowEllipse(cx + 14, cy + 6, rx + 14, ry + 6, 2.6);
    P.rect(cx - rx, cy - h, rx * 2, h, M.ceramic, (px, py) => {
        const nx = (px + 0.5 - cx) / rx;
        if (nx * nx > 1) return null;
        return 7.2 - nx * 3 - (nx > 0.75 ? 1.5 : 0) + (nx < -0.55 && nx > -0.75 ? 1.5 : 0);
    });
    P.ellipse(cx, cy, rx, ry, M.ceramic, (nx, ny) => (ny > 0 ? 7 - nx * 3 : null));
    // Anse
    P.tube([[cx + rx - 2, cy - h + 14], [cx + rx + 14, cy - h + 18], [cx + rx + 15, cy - h + 36], [cx + rx - 2, cy - h + 40]], 4.2, M.ceramic, (nx, ny) => 5.4 + (-nx * 0.6 - ny * 0.8) * 2.4);
    // Bord, café
    P.ellipse(cx, cy - h, rx, ry, M.ceramic, (nx, ny) => 8.6 - ny);
    P.ellipse(cx, cy - h + 1, rx - 4, ry - 3, M.coffee, (nx, ny) => 2.4 + ny * 1.2 + (nx < -0.3 && ny < -0.2 ? 1.6 : 0));
    // Logo : l'onde sonore jaune
    [3, 6, 9, 5, 8, 4].forEach((bh, i) => P.rect(cx - 13 + i * 5, cy - h / 2 - bh / 2 + 6, 2, bh, M.gold, 7));
}

// Téléphone posé à plat, écran allumé (forme d'onde dans live.js)
export const PHONE = { x: 742, y: 468, w: 52, h: 92 };
function paintPhone(P) {
    const { x, y, w, h } = PHONE;
    P.shadowRect(x + 8, y + 8, w, h, 2.2, 8);
    P.rrect(x, y + 3, w, h, 8, M.gear, 2);
    P.rrect(x, y, w, h, 8, M.gear, (px, py) => (py === y ? 6 : 3.4));
    P.rrect(x + 4, y + 8, w - 8, h - 16, 3, EMIT, '#0b1230');
}

// Notes repositionnables avec un pattern de beatbox griffonné
function paintNotes(P) {
    const notes = [[24, 452, M.paper], [70, 560, M.pink], [30, 664, M.paper]];
    notes.forEach(([x, y, m], k) => {
        P.shadowRect(x + 5, y + 6, 66, 62, 1.6, 6);
        P.rect(x, y, 66, 62, m, (px, py, u, v) => 5.6 - v * 0.8 + (py === y ? 1.2 : 0) + (u > 0.85 && v > 0.85 ? -1.5 : 0));
        // Griffonnage : lignes de « B t K t »
        for (let line = 0; line < 4; line += 1) {
            for (let i = 0; i < 46; i += 1) {
                if (hash(i + k * 50, line) > 0.72 || (i % 12) > 8) continue;
                P.put(x + 10 + i, y + 14 + line * 11 + Math.round(Math.sin(i * 0.9 + line) * 1.2), m, 1.6);
            }
        }
    });
    // Crayon
    P.tube([[118, 640], [196, 610]], 3.2, M.gold, (nx, ny) => 6 + (-nx * 0.6 - ny * 0.8) * 2);
    P.tube([[196, 610], [206, 606]], 2.2, M.cream, 6);
    P.tube([[112, 642], [118, 640]], 2.6, M.pink, 6);
}

// ---------------------------------------------------------------------------
// Cases : pads lumineux. La couleur dit le type ; le support dépend de l'appareil.
// ---------------------------------------------------------------------------

export const SPACE_COLORS = {
    blue: { base: '#3E7BFF', light: '#9CC0FF', dark: '#1F48B8', glow: '#4C8DFF' },
    red: { base: '#F04A3A', light: '#FFA597', dark: '#A8221A', glow: '#FF5A47' },
    drop: { base: '#2CC873', light: '#97F2BF', dark: '#127E44', glow: '#35E085' },
    start: { base: '#FFC72C', light: '#FFE9A6', dark: '#C08A00', glow: '#FFC72C' },
};

const ICONS = {
    plus: ['..##..', '..##..', '######', '######', '..##..', '..##..'],
    minus: ['......', '......', '######', '######', '......', '......'],
    drop: ['##..##', '.####.', '..##..', '##..##', '.####.', '..##..'],
    play: ['##....', '####..', '######', '######', '####..', '##....'],
};
const ICON_OF = { blue: 'plus', red: 'minus', drop: 'drop', start: 'play' };

/** Taille du chapeau lumineux d'une case */
export function capSize(space) {
    if (space.kind === 'track') return { rx: 21, ry: 13, square: false };
    if (space.zone === 'pads' && space.kind !== 'button') return { rx: 20, ry: 13, square: true };
    return { rx: 17, ry: 10.5, square: false };
}

// Le chapeau d'une case, émissif ; `flash` le dessine chauffé à blanc
function paintCap(P, space, flash = false) {
    const c = SPACE_COLORS[space.type] || SPACE_COLORS.blue;
    const { rx, ry, square } = capSize(space);
    const cx = space.x;
    const cy = space.y - 2;
    const shade = (nx, ny) => {
        if (flash) return ny < -0.3 ? '#ffffff' : '#fff6e0';
        const v = -nx * 0.5 - ny * 0.85;
        return v > 0.5 ? c.light : v < -0.45 ? c.dark : c.base;
    };
    if (square) P.rrect(cx - rx, cy - ry, rx * 2, ry * 2, 5, EMIT, (px, py, u, v) => shade(u * 2 - 1, v * 2 - 1));
    else P.ellipse(cx, cy, rx, ry, EMIT, (nx, ny) => shade(nx, ny));
    const icon = ICONS[ICON_OF[space.type] || 'plus'];
    const ink = flash ? c.base : '#FFFFFF';
    const edge = flash ? '#ffffff' : c.dark;
    const ix = Math.round(cx - 3);
    const iy = Math.round(cy - 3);
    icon.forEach((row, j) => {
        for (let i = 0; i < row.length; i += 1) {
            if (row[i] !== '#') continue;
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                const nr = icon[j + dy];
                if (!nr || nr[i + dx] !== '#') P.put(ix + i + dx, iy + j + dy, EMIT, edge);
            });
        }
    });
    icon.forEach((row, j) => {
        for (let i = 0; i < row.length; i += 1) if (row[i] === '#') P.put(ix + i, iy + j, EMIT, ink);
    });
}

function paintSpace(P, space) {
    const { rx, ry, square } = capSize(space);
    const cx = space.x;
    const cy = space.y;
    const c = SPACE_COLORS[space.type] || SPACE_COLORS.blue;
    // Lumière de la LED sur la surface autour
    P.spill(cx, cy + 2, rx * 2.4, 1.6);
    if (space.zone === 'pedal') {
        // Pédale : interrupteur au pied en chrome, la LED forme un anneau autour
        P.ellipse(cx, cy + 4, rx + 6, ry + 5, M.gear, 1.6);
        P.ellipse(cx, cy + 2, rx + 6, ry + 5, M.metal, (nx, ny) => 5 + (-nx * 0.6 - ny * 0.8) * 1.6);
    } else if (space.zone === 'stage' || space.zone === 'desk' || space.zone === 'cable') {
        // Palet de caoutchouc posé au sol
        P.shadowEllipse(cx + 5, cy + 7, rx + 7, ry + 5, 2);
        P.ellipse(cx, cy + 6, rx + 5, ry + 4, M.rubber, 1.6);
        P.rect(cx - rx - 5, cy + 1, (rx + 5) * 2, 5, M.rubber, (px) => {
            const nx = (px + 0.5 - cx) / (rx + 5);
            return nx * nx > 1 ? null : 3 - nx;
        });
        P.ellipse(cx, cy + 1, rx + 5, ry + 4, M.rubber, (nx, ny) => 4.4 + (-nx * 0.6 - ny * 0.8) * 1.2);
    } else if (space.zone === 'phones' && space.kind === 'band') {
        P.ellipse(cx, cy + 3, rx + 3, ry + 3, M.gear, (nx, ny) => 4 + (-nx * 0.6 - ny * 0.8));
    } else if (space.zone === 'mixer') {
        P.rrect(cx - rx - 4, cy - ry - 2, (rx + 4) * 2, (ry + 4) * 2, 6, M.gear, (px, py) => (py < cy - ry ? 4.4 : 1.4));
    } else {
        // Appareil : lunette métal autour du pad
        if (square) P.rrect(cx - rx - 4, cy - ry - 4, (rx + 4) * 2, (ry + 4) * 2 + 2, 7, M.gear, 1);
        else P.ellipse(cx, cy + 1, rx + 5, ry + 4, M.metal, (nx, ny, px, py, d) => (d > 0.75 ? 5.6 + (-nx * 0.6 - ny * 0.8) * 1.6 : 1));
    }
    // Flanc du chapeau, puis le chapeau lumineux
    if (square) P.rrect(cx - rx, cy - ry + 2, rx * 2, ry * 2 + 2, 5, EMIT, c.dark);
    else P.ellipse(cx, cy + 1, rx, ry, EMIT, c.dark);
    paintCap(P, space);
    if (space.gate) paintGate(P, space);
}

// Cordon de velours à l'entrée du raccourci (l'ingé son est dessiné dans live.js)
function paintGate(P, space) {
    const y = space.y - 34;
    [space.x - 30, space.x + 30].forEach((x) => {
        P.shadowEllipse(x + 4, y + 30, 9, 4, 1.6);
        P.ellipse(x, y + 28, 8, 3.5, M.gold, (nx, ny) => 6 + (-nx - ny) * 1.6);
        P.tube([[x, y + 26], [x, y]], 2.2, M.gold, (nx) => 6.5 - nx * 2.6);
        P.ellipse(x, y - 1, 3.4, 3.4, M.gold, (nx, ny) => 7 + (-nx - ny) * 1.8);
    });
    const rope = [];
    for (let i = 0; i <= 12; i += 1) rope.push([space.x - 30 + i * 5, y + 4 + Math.sin((i / 12) * Math.PI) * 9]);
    P.tube(rope, 2.6, M.velvet, (nx, ny) => 4.5 + (-nx * 0.5 - ny * 0.9) * 2.4);
}

/** Petite image du chapeau d'une case, chauffé à blanc, pour les éclats au passage */
function capSprite(space, flash) {
    const { rx, ry } = capSize(space);
    const w = Math.ceil(rx * 2 + 4);
    const h = Math.ceil(ry * 2 + 6);
    const P = new Paint(w, h);
    const local = { ...space, x: w / 2, y: h / 2 + 2 };
    paintCap(P, local, flash);
    const canvas = resolve(P, null);
    return { canvas, ox: Math.round(space.x - w / 2), oy: Math.round(space.y - h / 2 - 2) };
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
 * l'image de son chapeau chauffé à blanc (éclat quand un joueur passe dessus).
 */
export function buildWorld(board) {
    const P = new Paint(WORLD_W, WORLD_H);
    paintWall(P);
    paintNeon(P);
    paintVinyl(P);
    paintWindow(P);
    paintDesk(P);
    MONITORS.forEach((m) => paintMonitor(P, m));
    paintLamp(P);
    paintNotes(P);
    paintHeadphones(P);
    // Câbles posés sur le bureau, sous les appareils
    cable(P, [[836, 300], [930, 352], [1010, 368], [1110, 392], [1150, 470], [1146, 640], [1120, 762], [1040, 780], [990, 760]], 4.2);
    cable(P, [[214, 566], [206, 610], [204, 670], [232, 726], [262, 742]], 3.8);
    cable(P, [[640, 578], [646, 590]], 3.4);
    cable(P, [[540, 578], [520, 600]], 3.4);
    cable(P, [[1256, 250], [1270, 300], [1290, 320]], 3.4);
    cable(P, [[30, 262], [12, 300], [-10, 310]], 3.4);
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
    board.spaces.forEach((space) => { flashes[space.id] = capSprite(space, true); });
    return { canvas, flashes };
}
