// Lumière douce par-dessus le pixel art : un canvas à la résolution de l'écran, posé sur
// le canvas pixel en mode « screen ». Volontairement sobre (pas de néon) : faisceaux
// blancs des projecteurs de la scène, lueur de l'écran géant, halo des objets de jeu.
// Les positions sont celles de l'écran (pixels du canvas pixel), déjà projetées.
// Un second canvas assombrit les bords et, au tour d'un joueur, tout ce qui n'est pas
// sous son projecteur.


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

/** Halos ponctuels (LED, écrans, cases, Micro d'or…) demandés pendant l'image */
export function drawGlows(ctx, glows) {
    glows.forEach((g) => {
        if (g.beam) drawBeam(ctx, g.x, g.y + g.len, g.w, g.color, g.a, g.len);
        else glow(ctx, g.x, g.y, g.r, g.color, g.a, g.squash || 1);
    });
}

/** Rayon de lumière vertical (Micro d'or, joueur actif) */
export function drawBeam(ctx, x, y, w, color, alpha, len = 260) {
    const g = ctx.createLinearGradient(0, y - len, 0, y);
    g.addColorStop(0, `${color}00`);
    g.addColorStop(1, color);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.35, y - len);
    ctx.lineTo(x + w * 0.35, y - len);
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
