// Polices bitmap du plateau : chiffres épais (dé, compteurs, gains) et petite police
// d'appareil (sérigraphies, écrans LCD). Chaque texte est dessiné une fois dans un
// petit canvas, avec son contour, puis réutilisé.

const BOLD = {
    0: ['.####.', '##..##', '##..##', '##.###', '###.##', '##..##', '##..##', '.####.'],
    1: ['..##..', '.###..', '####..', '..##..', '..##..', '..##..', '..##..', '######'],
    2: ['.####.', '##..##', '....##', '...##.', '..##..', '.##...', '##....', '######'],
    3: ['.####.', '##..##', '....##', '..###.', '....##', '....##', '##..##', '.####.'],
    4: ['...##.', '..###.', '.####.', '##.##.', '##.##.', '######', '...##.', '...##.'],
    5: ['######', '##....', '#####.', '....##', '....##', '....##', '##..##', '.####.'],
    6: ['.####.', '##....', '##....', '#####.', '##..##', '##..##', '##..##', '.####.'],
    7: ['######', '....##', '...##.', '...##.', '..##..', '..##..', '.##...', '.##...'],
    8: ['.####.', '##..##', '##..##', '.####.', '##..##', '##..##', '##..##', '.####.'],
    9: ['.####.', '##..##', '##..##', '##..##', '.#####', '....##', '...##.', '.###..'],
    '+': ['......', '..##..', '..##..', '######', '######', '..##..', '..##..', '......'],
    '-': ['......', '......', '......', '######', '######', '......', '......', '......'],
    '!': ['##', '##', '##', '##', '##', '..', '##', '##'],
    '×': ['......', '##..##', '.####.', '..##..', '.####.', '##..##', '......', '......'],
    ' ': ['...', '...', '...', '...', '...', '...', '...', '...'],
};

const TINY = {
    0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'],
    3: ['##.', '..#', '.#.', '..#', '##.'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
    6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
    9: ['###', '#.#', '###', '..#', '##.'],
    A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
    D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
    G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
    K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'], M: ['#.#', '###', '###', '#.#', '#.#'],
    N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'],
    R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
    U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'],
    X: ['#.#', '#.#', '.#.', '#.#', '#.#'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
    '+': ['...', '.#.', '###', '.#.', '...'], '-': ['...', '...', '###', '...', '...'], '/': ['..#', '..#', '.#.', '#..', '#..'],
    J: ['..#', '..#', '..#', '#.#', '.#.'], Q: ['.#.', '#.#', '#.#', '##.', '.##'],
    '!': ['.#.', '.#.', '.#.', '...', '.#.'], '?': ['##.', '..#', '.#.', '...', '.#.'], '%': ['#.#', '..#', '.#.', '#..', '#.#'],
    "'": ['.#.', '.#.', '...', '...', '...'], '×': ['...', '#.#', '.#.', '#.#', '...'], '>': ['#..', '.#.', '..#', '.#.', '#..'],
    '<': ['..#', '.#.', '#..', '.#.', '..#'], '(': ['.#.', '#..', '#..', '#..', '.#.'], ')': ['.#.', '..#', '..#', '..#', '.#.'],
    '.': ['...', '...', '...', '...', '.#.'], ':': ['...', '.#.', '...', '.#.', '...'], ' ': ['..', '..', '..', '..', '..'],
};

/** Texte ramené aux glyphes disponibles : majuscules sans accents */
export function plain(text) {
    return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").replace(/…/g, '...').toUpperCase();
}

const FONTS = { bold: { glyphs: BOLD, h: 8, gap: 1 }, tiny: { glyphs: TINY, h: 5, gap: 1 } };

const cache = new Map();

function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    return Object.assign(document.createElement('canvas'), { width: w, height: h });
}

/** Pixels allumés d'un texte (pour peindre une sérigraphie dans le décor) */
export function glyphPixels(text, font = 'tiny') {
    const f = FONTS[font];
    const pixels = [];
    let x = 0;
    String(text).split('').forEach((ch) => {
        const g = f.glyphs[ch] || f.glyphs[' '];
        g.forEach((row, j) => {
            for (let i = 0; i < row.length; i += 1) if (row[i] === '#') pixels.push([x + i, j]);
        });
        x += g[0].length + f.gap;
    });
    return { pixels, width: Math.max(0, x - f.gap), height: f.h };
}

/** Largeur d'un texte, sans contour */
export function textWidth(text, font = 'bold') {
    const f = FONTS[font];
    return String(text).split('').reduce((w, ch) => w + ((f.glyphs[ch] || f.glyphs[' '])[0].length + f.gap), -f.gap);
}

/**
 * Canvas d'un texte avec un contour d'un pixel (outline), et une ombre portée
 * d'un pixel vers le bas (shadow). Couleur unie ou dégradé haut/bas [haut, bas].
 */
export function textSprite(text, color, { font = 'bold', outline = '#120E26', shadow = true } = {}) {
    const key = `${text}|${color}|${font}|${outline}|${shadow}`;
    let cv = cache.get(key);
    if (cv) return cv;
    const f = FONTS[font];
    const pad = outline ? 1 : 0;
    const w = textWidth(text, font) + pad * 2;
    const h = f.h + pad * 2 + (shadow ? 1 : 0);
    cv = makeCanvas(Math.max(1, w), h);
    const ctx = cv.getContext('2d');
    const pixels = [];
    let x = pad;
    String(text).split('').forEach((ch) => {
        const g = f.glyphs[ch] || f.glyphs[' '];
        g.forEach((row, j) => {
            for (let i = 0; i < row.length; i += 1) if (row[i] === '#') pixels.push([x + i, pad + j]);
        });
        x += g[0].length + f.gap;
    });
    if (outline) {
        ctx.fillStyle = outline;
        pixels.forEach(([px, py]) => {
            ctx.fillRect(px - 1, py, 3, 1);
            ctx.fillRect(px, py - 1, 1, 3);
            if (shadow) {
                ctx.fillRect(px - 1, py + 1, 3, 1);
                ctx.fillRect(px, py + 2, 1, 1);
            }
        });
    }
    pixels.forEach(([px, py]) => {
        ctx.fillStyle = Array.isArray(color) ? (py - pad < f.h / 2 ? color[0] : color[1]) : color;
        ctx.fillRect(px, py, 1, 1);
    });
    if (cache.size > 400) cache.delete(cache.keys().next().value);
    cache.set(key, cv);
    return cv;
}

/** Dessine un texte centré sur x (align 'center') ou à partir de x ('left') */
export function drawText(ctx, text, x, y, color, opts = {}) {
    const cv = textSprite(text, color, opts);
    const left = opts.align === 'left' ? x : x - cv.width / 2;
    ctx.drawImage(cv, Math.round(left), Math.round(y));
    return cv.width;
}
