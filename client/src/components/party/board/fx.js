// Lumière douce par-dessus le pixel art : un canvas à la résolution de l'écran, posé sur
// le canvas pixel en mode « screen ». Volontairement sobre (pas de néon) : cône chaud
// de la lampe avec sa poussière, clair de lune, petit halo des LED, projecteur blanc.
// Un second canvas assombrit les bords et, au tour d'un joueur, tout ce qui n'est pas
// sous son projecteur.

import { LAMP_BULB, STAGE, WINDOW } from './world';

const sprites = new Map();

// Halo radial d'une couleur, gardé en cache
function glowSprite(color) {
    let cv = sprites.get(color);
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 64;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color);
    g.addColorStop(0.25, `${color}aa`);
    g.addColorStop(0.6, `${color}33`);
    g.addColorStop(1, `${color}00`);
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    sprites.set(color, cv);
    return cv;
}

export function glow(ctx, x, y, r, color, alpha = 1, squash = 1) {
    if (alpha <= 0.01) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(glowSprite(color), x - r, y - r * squash, r * 2, r * 2 * squash);
    ctx.globalAlpha = 1;
}

// Poussière qui flotte dans le cône de la lampe
const DUST = Array.from({ length: 34 }, (_, i) => ({
    u: (Math.sin(i * 12.9898) * 43758.5453) % 1,
    v: (Math.sin(i * 78.233) * 12345.678) % 1,
    speed: 0.02 + ((i * 7) % 5) * 0.006,
    size: 0.8 + (i % 3) * 0.5,
}));

/** Lumières fixes du décor (lampe, lune, scène) */
export function drawAmbient(ctx, t, info) {
    // Cône de la lampe : du bulbe vers le bureau
    const bx = LAMP_BULB.x;
    const by = LAMP_BULB.y;
    const cone = ctx.createLinearGradient(bx, by, 430, 560);
    cone.addColorStop(0, 'rgba(255,214,150,0.20)');
    cone.addColorStop(0.5, 'rgba(255,196,120,0.07)');
    cone.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(bx - 28, by - 8);
    ctx.lineTo(bx + 34, by + 6);
    ctx.lineTo(730, 610);
    ctx.lineTo(150, 610);
    ctx.closePath();
    ctx.fill();
    glow(ctx, 430, 470, 430, '#ffcf8a', 0.12, 0.62);
    glow(ctx, bx + 8, by + 6, 30, '#fff1d0', 0.5);
    DUST.forEach((d) => {
        const k = (Math.abs(d.v) + t * d.speed) % 1;
        const x = bx - 12 + (Math.abs(d.u) - 0.5) * 80 + (Math.abs(d.u) - 0.3) * k * 390 + Math.sin(t * 0.7 + d.u * 9) * 8;
        const y = by + 14 + k * 430;
        ctx.globalAlpha = 0.4 * Math.sin(k * Math.PI);
        ctx.fillStyle = '#fff3d6';
        ctx.fillRect(x, y, d.size, d.size);
    });
    ctx.globalAlpha = 1;

    // Clair de lune qui tombe de la fenêtre
    const moon = ctx.createLinearGradient(0, WINDOW.y + WINDOW.h, 0, 610);
    moon.addColorStop(0, 'rgba(200,210,235,0.08)');
    moon.addColorStop(1, 'rgba(200,210,235,0)');
    ctx.fillStyle = moon;
    ctx.beginPath();
    ctx.moveTo(WINDOW.x, WINDOW.y + WINDOW.h);
    ctx.lineTo(WINDOW.x + WINDOW.w, WINDOW.y + WINDOW.h);
    ctx.lineTo(WINDOW.x + WINDOW.w - 40, 610);
    ctx.lineTo(WINDOW.x - 140, 610);
    ctx.closePath();
    ctx.fill();

    // Projecteur blanc chaud sur la scène du micro géant
    const beam = ctx.createLinearGradient(0, 0, 0, STAGE.cy + 50);
    beam.addColorStop(0, 'rgba(255,240,215,0)');
    beam.addColorStop(1, 'rgba(255,240,215,0.10)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(STAGE.cx - 52, -26);
    ctx.lineTo(STAGE.cx + 52, -26);
    ctx.lineTo(STAGE.cx + STAGE.rx * 0.8, STAGE.cy + 26);
    ctx.lineTo(STAGE.cx - STAGE.rx * 0.8, STAGE.cy + 26);
    ctx.closePath();
    ctx.fill();
    glow(ctx, STAGE.cx, STAGE.cy + 6, STAGE.rx * 0.9, info.stageColor || '#fff0d8', 0.08, 0.38);
}

/** Halos ponctuels (LED, écrans, cases, Micro d'or…) demandés pendant l'image */
export function drawGlows(ctx, glows) {
    glows.forEach((g) => glow(ctx, g.x, g.y, g.r, g.color, g.a, g.squash || 1));
}

/** Rayon de lumière vertical (Micro d'or, joueur actif) */
export function drawBeam(ctx, x, y, w, color, alpha) {
    const g = ctx.createLinearGradient(0, y - 260, 0, y);
    g.addColorStop(0, `${color}00`);
    g.addColorStop(1, color);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.35, y - 260);
    ctx.lineTo(x + w * 0.35, y - 260);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x - w, y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
}

/** Ondes sonores qui sortent du micro d'un joueur qui beatboxe */
export function drawSoundWaves(ctx, x, y, facing, hit, t) {
    if (!hit) return;
    const dir = facing < 0 ? Math.PI : 0;
    for (let k = 0; k < 3; k += 1) {
        const age = (t * 2.2 + k / 3) % 1;
        const r = 6 + age * 34;
        const a = (1 - age) * (0.18 + hit.strength * 0.3);
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#f2efe6';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, r, dir - 0.7, dir + 0.7);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

/** Assombrissement : bords de l'écran, et tout sauf le projecteur du joueur actif */
export function drawShade(ctx, w, h, spot) {
    ctx.clearRect(0, 0, w, h);
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(3,4,14,0)');
    v.addColorStop(1, 'rgba(3,4,14,0.5)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    if (spot && spot.amount > 0.01) {
        ctx.save();
        ctx.fillStyle = `rgba(3,4,14,${0.36 * spot.amount})`;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'destination-out';
        const g = ctx.createRadialGradient(spot.x, spot.y, spot.r * 0.25, spot.x, spot.y, spot.r);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(spot.x, spot.y, spot.r, spot.r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
