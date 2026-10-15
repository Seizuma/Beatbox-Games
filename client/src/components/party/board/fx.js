// Lumières « au-delà du pixel art » : un canvas à la résolution de l'écran, posé sur
// le canvas pixel en mode « screen ». Halos des LED et du néon, cône de la lampe avec
// sa poussière, rayon de lune, projecteurs, ondes sonores du beatbox. Un second canvas
// assombrit les bords et, au tour d'un joueur, tout ce qui n'est pas sous son projecteur.

import { LAMP_BULB, NEON_TUBES, STAGE, WINDOW } from './world';

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

/** Lumières fixes du décor (lampe, lune, néon, scène) */
export function drawAmbient(ctx, t, info) {
    const { kick, stageColor } = info;

    // Cône de la lampe : du bulbe vers le bureau
    const bx = LAMP_BULB.x;
    const by = LAMP_BULB.y;
    const cone = ctx.createLinearGradient(bx, by, 330, 420);
    cone.addColorStop(0, 'rgba(255,205,120,0.30)');
    cone.addColorStop(0.5, 'rgba(255,180,90,0.10)');
    cone.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(bx - 22, by - 6);
    ctx.lineTo(bx + 26, by + 4);
    ctx.lineTo(560, 470);
    ctx.lineTo(120, 470);
    ctx.closePath();
    ctx.fill();
    glow(ctx, 330, 360, 330, '#ffb35a', 0.22, 0.62);
    glow(ctx, bx + 6, by + 4, 34, '#fff1c2', 0.9);
    DUST.forEach((d) => {
        const k = (Math.abs(d.v) + t * d.speed) % 1;
        const x = bx - 10 + (Math.abs(d.u) - 0.5) * 60 + (Math.abs(d.u) - 0.3) * k * 300 + Math.sin(t * 0.7 + d.u * 9) * 6;
        const y = by + 10 + k * 330;
        ctx.globalAlpha = 0.5 * Math.sin(k * Math.PI);
        ctx.fillStyle = '#fff3d0';
        ctx.fillRect(x, y, d.size, d.size);
    });
    ctx.globalAlpha = 1;

    // Clair de lune qui tombe de la fenêtre
    const moon = ctx.createLinearGradient(0, WINDOW.y + WINDOW.h, 0, 470);
    moon.addColorStop(0, 'rgba(150,175,255,0.13)');
    moon.addColorStop(1, 'rgba(150,175,255,0)');
    ctx.fillStyle = moon;
    ctx.beginPath();
    ctx.moveTo(WINDOW.x, WINDOW.y + WINDOW.h);
    ctx.lineTo(WINDOW.x + WINDOW.w, WINDOW.y + WINDOW.h);
    ctx.lineTo(WINDOW.x + WINDOW.w - 30, 470);
    ctx.lineTo(WINDOW.x - 110, 470);
    ctx.closePath();
    ctx.fill();
    glow(ctx, WINDOW.x + WINDOW.w - 40, WINDOW.y + 30, 40, '#fff4d6', 0.5);

    // Néon : il grésille avec les tubes du canvas pixel
    const flick = t % 9.3;
    const off = (flick > 4.1 && flick < 4.16) || (flick > 4.24 && flick < 4.3) || (flick > 7.6 && flick < 7.64);
    NEON_TUBES.forEach((tube, i) => glow(ctx, tube.x + 3, tube.y + tube.h / 2, 14 + tube.h * 0.55, '#ffc72c', off && i % 3 === 1 ? 0.08 : 0.42, 1.1));

    // Projecteur sur la scène du micro géant
    const spot = stageColor || '#c9b8ff';
    const beam = ctx.createLinearGradient(0, 0, 0, STAGE.cy + 40);
    beam.addColorStop(0, `${spot}00`);
    beam.addColorStop(0.5, `${spot}22`);
    beam.addColorStop(1, `${spot}38`);
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(STAGE.cx - 40, -20);
    ctx.lineTo(STAGE.cx + 40, -20);
    ctx.lineTo(STAGE.cx + STAGE.rx * 0.8, STAGE.cy + 20);
    ctx.lineTo(STAGE.cx - STAGE.rx * 0.8, STAGE.cy + 20);
    ctx.closePath();
    ctx.fill();
    glow(ctx, STAGE.cx, STAGE.cy + 4, STAGE.rx * 0.95, spot, 0.22 + kick * 0.08, 0.38);
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
        const a = (1 - age) * (0.35 + hit.strength * 0.5);
        ctx.globalAlpha = a;
        ctx.strokeStyle = hit.heavy ? '#ffe07a' : '#9fe9ff';
        ctx.lineWidth = 1.6;
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
