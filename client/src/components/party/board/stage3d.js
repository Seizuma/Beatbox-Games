// Moteur « Mode 7 » du plateau : une caméra posée derrière le public regarde la scène.
// - Le sol, le fond et le dessus de la loopstation sont des plans : chaque ligne de
//   l'écran est une bande de texture étirée (comme les jeux SNES en Mode 7).
// - La loopstation est une vraie boîte : face avant épaisse, flancs, dessus.
// - Tout ce qui dépasse (potards, touches, faders, pads, cases, personnages) est dessiné
//   en relief, à l'échelle de sa distance, trié de l'arrière vers l'avant.
//
// Monde : x à droite, y vers la caméra, h en hauteur. Écran : pixels du canvas basse
// résolution (agrandi sans lissage).

import { OUT, R, E, RR, ring, icon, silk, pixText, makeCanvas, hexMix, hash } from './pix';
import { C, CROWD, DEVICE, FLOOR, LOCAL, SCALE, SMALL_R, BIG_R, SPACE_COLORS, WALL, WALL_SCREEN, toWorld } from './world';

export const SMALL_H = 8;
export const BIG_H = 10;

/** Focale : liée à la hauteur de l'écran (en portrait, champ plus serré, comme un téléobjectif) */
export const focalFor = (W, H) => Math.min(H * 0.95, W * 1.6);

/**
 * Caméra à partir d'un point visé : (tx, ty, th) le point, dist la distance (en y),
 * rise la hauteur de la caméra au-dessus du point, fy sa place verticale à l'écran (0..1).
 */
export function makeCam({ tx, ty, th = DEVICE.h, dist, rise, fy = 0.6, W, H, dx = 0, dy = 0 }) {
    const f = focalFor(W, H);
    return { x: tx + dx, y: ty + dist, H: th + rise, f, hz: fy * H - (rise * f) / dist + dy, W, Hs: H };
}

/** Distance pour qu'un objet à la distance visée soit affiché à l'échelle k */
export const distFor = (W, H, k) => focalFor(W, H) / k;

export function project(cam, x, y, h = 0) {
    const z = cam.y - y;
    if (z < 6) return null;
    const k = cam.f / z;
    return { sx: cam.W / 2 + (x - cam.x) * k, sy: cam.hz + (cam.H - h) * k, k, z };
}

// ---------------------------------------------------------------------------
// Plans texturés
// ---------------------------------------------------------------------------

/** Plan horizontal à la hauteur h, couvrant [x0, x0+w] × [y0, y0+d], texture à l'échelle s */
function drawPlane(ctx, cam, tex, x0, y0, w, d, h, s) {
    const hc = cam.H - h;
    if (hc <= 0) return;
    const zFar = cam.y - y0;
    const zNear = Math.max(6, cam.y - (y0 + d));
    if (zFar <= 6) return;
    const rowTop = Math.max(0, Math.floor(cam.hz + (hc * cam.f) / zFar));
    const rowBot = Math.min(cam.Hs, Math.ceil(cam.hz + (hc * cam.f) / zNear));
    for (let sy = rowTop; sy < rowBot; sy += 1) {
        const dz = sy + 0.5 - cam.hz;
        if (dz <= 0) continue;
        const z = (hc * cam.f) / dz;
        const wy = cam.y - z;
        if (wy < y0 || wy >= y0 + d) continue;
        const ty = Math.floor((wy - y0) / s);
        const k = cam.f / z;
        let a = cam.W / 2 + (x0 - cam.x) * k;
        let b = cam.W / 2 + (x0 + w - cam.x) * k;
        if (b <= 0 || a >= cam.W) continue;
        a = Math.max(0, a);
        b = Math.min(cam.W, b);
        const xa = Math.floor(a);
        const xb = Math.ceil(b);
        const srcA = (cam.x + (xa - cam.W / 2) / k - x0) / s;
        const srcW = (xb - xa) / k / s;
        ctx.drawImage(tex, srcA, ty, srcW, 1, xa, sy, xb - xa, 1);
    }
}

function poly(ctx, pts, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(Math.round(x), Math.round(y)) : ctx.moveTo(Math.round(x), Math.round(y))));
    ctx.closePath();
    ctx.fill();
}

// ---------------------------------------------------------------------------
// Reliefs
// ---------------------------------------------------------------------------

/** Boîte (touches, faders) : face avant puis dessus */
export function drawBox(ctx, cam, o, sprite, h0 = DEVICE.h) {
    const top = h0 + o.h;
    const back = project(cam, o.x, o.y - o.d / 2, top);
    const front = project(cam, o.x, o.y + o.d / 2, top);
    const foot = project(cam, o.x, o.y + o.d / 2, h0);
    if (!back || !front || !foot) return;
    if (back.sy > cam.Hs + 4) return;
    const half = (o.w / 2) * front.k;
    const xa = Math.round(front.sx - half);
    const xb = Math.round(front.sx + half);
    const yTop = Math.round(back.sy);
    const yEdge = Math.round(front.sy);
    const yFoot = Math.round(foot.sy);
    if (yFoot > yEdge) {
        R(ctx, xa, yEdge, xb - xa, yFoot - yEdge, o.side);
        R(ctx, xa, yEdge, xb - xa, 1, hexMix(o.side, '#ffffff', 0.12));
    }
    if (sprite && yEdge > yTop) ctx.drawImage(sprite, xa, yTop, xb - xa, yEdge - yTop);
}

/**
 * Bords haut et bas (écran) d'un disque horizontal : on projette ses points le plus loin
 * et le plus près (exact même tout près de la caméra, où l'ellipse se déforme)
 */
function disc(cam, x, y, d, h) {
    const far = project(cam, x, y - d / 2, h);
    if (!far) return null;
    const near = project(cam, x, y + d / 2, h);
    const mid = project(cam, x, y, h) || far;
    return { top: far.sy, bottom: near ? near.sy : cam.Hs + 400, cx: mid.sx, k: mid.k };
}

/** Cylindre (potards, cases) : tranche puis dessus */
export function drawCyl(ctx, cam, o, sprite, h0 = DEVICE.h) {
    const top = h0 + o.h;
    const dt = disc(cam, o.x, o.y, o.d, top);
    const db = disc(cam, o.x, o.y, o.d, h0);
    if (!dt || !db) return;
    if (dt.top > cam.Hs + 4) return;
    const rx = (o.w / 2) * dt.k;
    const yT = (dt.top + dt.bottom) / 2;
    const yB = (db.top + db.bottom) / 2;
    E(ctx, db.cx, yB, rx, (db.bottom - db.top) / 2, o.side);
    R(ctx, Math.round(db.cx - rx), Math.round(yT), Math.round(rx * 2), Math.round(yB - yT), o.side);
    if (sprite) ctx.drawImage(sprite, Math.round(dt.cx - rx), Math.round(dt.top), Math.max(1, Math.round(rx * 2)), Math.max(1, Math.round(dt.bottom - dt.top)));
}

/** Contour d'ellipse au sol (onde de choc) */
export function ringOutline(ctx, cx, cy, rx, ry, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    const n = Math.max(24, Math.round(rx * 1.6));
    for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2;
        ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 2, 1);
    }
    ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Cases : pads ronds en caoutchouc à anneau de LED (sprites vus de dessus, en cache)
// ---------------------------------------------------------------------------

const padCache = new Map();

/**
 * Dessus d'une case. head : segment plus clair qui tourne ; active : couleur du joueur
 * dont c'est le tour (l'anneau tourne à sa couleur) ; flash : anneau blanc.
 */
export function padSprite(type, big, head, active = null, flash = false) {
    const key = `${type}|${big ? 1 : 0}|${head}|${active || ''}|${flash ? 1 : 0}`;
    let s = padCache.get(key);
    if (s) return s;
    const col = SPACE_COLORS[type] || SPACE_COLORS.blue;
    const r = big ? BIG_R : SMALL_R;
    const n = big ? 24 : 16;
    const d = r * 2 + 2;
    const [c, ctx] = makeCanvas(d, d);
    const x = d / 2;
    E(ctx, x, x, r + 1, r + 1, '#0b0b0e');
    const width = big ? 12 : 7;
    ring(ctx, x, x, r, r - width, n, (k, dist) => {
        if (flash) return '#ffffff';
        if (active) {
            const on = ((head - k + n) % n) < (big ? 8 : 5);
            return on ? (dist > r - 2 ? hexMix(active, '#ffffff', 0.45) : active) : hexMix(active, '#000000', 0.68);
        }
        if (k === head % n || k === (head + n / 2) % n) return col.light;
        return dist > r - 2 ? col.light : col.ring;
    }, 0.2);
    if (big) {
        ring(ctx, x, x, r - width - 3, r - width - 5, 1, () => (flash ? '#ffffff' : C.green));
        E(ctx, x, x, r - width - 6, r - width - 6, '#060608');
        E(ctx, x, x - 2, r - width - 9, r - width - 9, '#151519');
        E(ctx, x - r * 0.22, x - r * 0.3, r * 0.28, r * 0.13, '#24242a');
        icon(ctx, x, x + 2, col.icon, active || col.ring, 5);
    } else {
        E(ctx, x, x, r - width - 1, r - width - 1, '#111115');
        E(ctx, x, x - 1, r - width - 3, r - width - 3, '#1c1c22');
        E(ctx, x - r * 0.2, x - r * 0.3, r * 0.26, r * 0.12, '#2a2a31');
        icon(ctx, x, x, col.icon, active || col.ring, 3);
    }
    if (padCache.size > 600) padCache.delete(padCache.keys().next().value);
    padCache.set(key, c);
    return c;
}

/** Une case en relief (pad), posée sur l'appareil */
export function drawSpace(ctx, cam, space, t, { active = null, flash = 0 } = {}) {
    const r = (space.big ? BIG_R : SMALL_R) * SCALE;
    const n = space.big ? 24 : 16;
    const head = Math.floor(t * (space.big ? 14 : 10) + space.id * 3) % n;
    const o = { x: space.x, y: space.y, w: r * 2, d: r * 2, h: space.big ? BIG_H : SMALL_H, side: '#08080a' };
    drawCyl(ctx, cam, o, padSprite(space.type, space.big, head, active));
    if (flash > 0) {
        ctx.globalAlpha = flash;
        drawCyl(ctx, cam, { ...o, side: 'rgba(0,0,0,0)' }, padSprite(space.type, space.big, 0, null, true));
        ctx.globalAlpha = 1;
    }
}

/** Hauteur du dessus d'une case (là où se posent les pieds) */
export const spaceTop = (space) => DEVICE.h + (space && space.big ? BIG_H : SMALL_H);

// ---------------------------------------------------------------------------
// Écran LCD de la loopstation (contenu vivant)
// ---------------------------------------------------------------------------

let lcdCanvas = null;
function lcdSprite(info) {
    if (!lcdCanvas) [lcdCanvas] = makeCanvas(260, 86);
    const ctx = lcdCanvas.getContext('2d');
    R(ctx, 0, 0, 260, 86, C.lcd);
    R(ctx, 0, 0, 260, 30, C.lcdHi);
    const lcd = info.lcd || {};
    pixText(ctx, lcd.big || '01', 130, 12, C.lcdInk, { font: 'bold', scale: 3, outline: null, shadow: false });
    silk(ctx, lcd.small || 'MEMORY01', 130, 50, C.lcdInk, 'center', 2);
    silk(ctx, `BPM ${info.bpm || 96}`, 8, 4, C.lcdInk, 'left');
    silk(ctx, lcd.corner || 'TRK 1-5', 252, 4, C.lcdInk, 'right');
    const bi = info.bi || 0;
    for (let i = 0; i < 5; i += 1) R(ctx, 36 + i * 40, 72, 28, 8, i === bi % 5 ? C.lcdInk : '#6f95c4');
    return lcdCanvas;
}

// ---------------------------------------------------------------------------
// Scène complète
// ---------------------------------------------------------------------------

/**
 * Dessine le fond, le sol et la loopstation, et renvoie la liste des reliefs à trier
 * avec les personnages : [{ y, draw }]. Les lumières douces vont dans glows (écran).
 * opts : { t, info, board, active: { spaceId, color }, flashes: { [spaceId]: alpha } }
 */
export function renderStage(ctx, world, cam, { t = 0, info = {}, board = null, active = null, flashes = {}, cheering = false } = {}) {
    const { W, Hs } = cam;
    ctx.imageSmoothingEnabled = false;
    R(ctx, 0, 0, W, Hs, '#07060b');

    // Fond : rideau, rampe, écran géant, public
    const zw = cam.y - WALL.y;
    const kw = cam.f / zw;
    const wallBottom = cam.hz + cam.H * kw;
    const wallTop = wallBottom - WALL.h * kw;
    const wallLeft = W / 2 + (WALL.x - cam.x) * kw;
    ctx.drawImage(world.wall, Math.round(wallLeft), Math.round(wallTop), Math.round(WALL.w * kw), Math.round(WALL.h * kw));
    // Barres de l'égaliseur sur l'écran géant
    const scrX = W / 2 + (WALL_SCREEN.x - cam.x) * kw;
    const scrY = wallTop + WALL_SCREEN.top * kw;
    const bars = 24;
    const bw = (WALL_SCREEN.w * kw) / bars;
    for (let i = 0; i < bars; i += 1) {
        const lvl = 0.25 + 0.75 * Math.abs(Math.sin(t * 3 + i * 0.7 + (info.kick || 0) * 2)) * (0.5 + hash(i, Math.floor(t * 4)) * 0.5);
        const bh = WALL_SCREEN.h * kw * 0.8 * lvl;
        R(ctx, scrX - (WALL_SCREEN.w * kw) / 2 + i * bw + 1, scrY + WALL_SCREEN.h * kw * 0.9 - bh, Math.max(1, bw - 2), bh, i % 6 === 0 ? C.amber : '#3f8cff');
    }
    // Public : silhouettes qui sautent sur le temps
    const beat = info.beat || 0;
    CROWD.forEach((p, i) => {
        const sx = W / 2 + (p.x - cam.x) * kw;
        if (sx < -20 || sx > W + 20) return;
        const ph = (beat + p.phase * 0.35) % 1;
        const jump = cheering ? Math.abs(Math.sin(t * 9 + p.phase * 6)) * 14 : ph < 0.2 ? 5 : 0;
        const hgt = p.h * kw;
        const y = wallBottom - hgt - jump * kw;
        const bw2 = 16 * kw;
        E(ctx, sx, y + 5 * kw, 6 * kw, 7 * kw, p.shade);
        R(ctx, sx - bw2 / 2, y + 10 * kw, bw2, hgt, p.shade);
        if (p.arm || cheering) R(ctx, sx + bw2 / 2 - 2 * kw, y - 16 * kw, 3 * kw, 22 * kw, p.shade);
        if (p.phone && i % 2) R(ctx, sx + bw2 / 2 - 2 * kw, y - 20 * kw, 3 * kw, 4 * kw, '#9cc3ff');
    });

    // Sol de la scène
    drawPlane(ctx, cam, world.floor, FLOOR.x, FLOOR.y, FLOOR.w, FLOOR.d, 0, FLOOR.scale);

    // La loopstation : flancs, face avant, puis dessus
    const { x: DX, y: DY, w: DW, d: DD, h: DH } = DEVICE;
    const p = (x, y, h) => project(cam, x, y, h);
    if (cam.x < DX) {
        const a = p(DX, DY, 0); const b = p(DX, DY + DD, 0); const c2 = p(DX, DY + DD, DH); const d = p(DX, DY, DH);
        if (a && b && c2 && d) poly(ctx, [[a.sx, a.sy], [b.sx, b.sy], [c2.sx, c2.sy], [d.sx, d.sy]], C.side2);
    }
    if (cam.x > DX + DW) {
        const a = p(DX + DW, DY, 0); const b = p(DX + DW, DY + DD, 0); const c2 = p(DX + DW, DY + DD, DH); const d = p(DX + DW, DY, DH);
        if (a && b && c2 && d) poly(ctx, [[a.sx, a.sy], [b.sx, b.sy], [c2.sx, c2.sy], [d.sx, d.sy]], C.side2);
    }
    const fTop = p(DX, DY + DD, DH);
    const fBot = p(DX, DY + DD, 0);
    if (fTop && fBot) {
        const x0 = fTop.sx;
        const wpx = DW * fTop.k;
        ctx.drawImage(world.front, Math.round(x0), Math.round(fTop.sy), Math.round(wpx), Math.max(1, Math.round(fBot.sy - fTop.sy)));
    }
    drawPlane(ctx, cam, world.top, DX, DY, DW, DD, DH, SCALE);

    // Reliefs fixes et cases, à trier avec les personnages
    const list = [];
    const lcd = lcdSprite(info);
    world.statics.forEach((o) => {
        if (o.kind === 'lcd') {
            list.push({ y: o.y - 1000, draw: () => drawBox(ctx, cam, o, lcd) });
            return;
        }
        const sprite = o.beat && (info.bi || 0) % 2 ? o.off : o.sprite;
        list.push({ y: o.y + o.d / 2 - 20, draw: () => (o.kind === 'cyl' ? drawCyl(ctx, cam, o, sprite) : drawBox(ctx, cam, o, sprite)) });
    });
    if (board) {
        board.spaces.forEach((space) => {
            const r = (space.big ? BIG_R : SMALL_R) * SCALE;
            const act = active && active.spaceId === space.id ? active.color : null;
            list.push({ y: space.y - r * 0.6, draw: () => drawSpace(ctx, cam, space, t, { active: act, flash: flashes[space.id] || 0 }) });
        });
    }
    return list;
}

/** Faisceaux des projecteurs et halos fixes, en coordonnées écran (couche lumière) */
export function stageLights(cam, t, info, glows) {
    const zw = cam.y - WALL.y;
    const kw = cam.f / zw;
    const wallBottom = cam.hz + cam.H * kw;
    const wallTop = wallBottom - WALL.h * kw;
    for (let x = WALL.x + 60; x < WALL.x + WALL.w; x += 280) {
        const sx = cam.W / 2 + (x - cam.x) * kw;
        if (sx < -200 || sx > cam.W + 200) continue;
        glows.push({ beam: true, x: sx, y: wallTop + 40 * kw, w: 14 * kw, len: (wallBottom - wallTop) * 0.9, color: x % 3 ? '#fff1d0' : '#cfe0ff', a: 0.07 + (info.kick || 0) * 0.03 });
    }
    // Lueur de l'écran géant
    const scr = cam.W / 2 + (WALL_SCREEN.x - cam.x) * kw;
    glows.push({ x: scr, y: wallTop + (WALL_SCREEN.top + WALL_SCREEN.h / 2) * kw, r: WALL_SCREEN.w * kw * 0.7, color: '#6f95ff', a: 0.12 });
}

/** Position écran d'un personnage debout en (x, y) à la hauteur h ; null s'il est derrière la caméra */
export function actorAt(cam, x, y, h) {
    return project(cam, x, y, h);
}

export { toWorld, LOCAL, OUT, RR };
