// Cadres pixel de l'interface (famille « Pixel arcade ») : de petites images 18 × 18 tracées
// au pixel, découpées en 9 (border-image, tranche de 6 px) et agrandies sans lissage.
// Elles sont générées une fois et posées en variables CSS sur la racine du document.

const PALETTES = {
    // Cadre sombre : panneaux, menus
    frame: { fill: '#241c48', light: '#f4f0e6', mid: '#6b5bd0' },
    // Cadre clair : boîte de dialogue
    'frame-light': { fill: '#f4f0e6', light: '#ffffff', mid: '#b9b0d8' },
    // Cadre doré : sélection, action principale
    'frame-sel': { fill: '#3a2c78', light: '#ffd23a', mid: '#c98a12' },
    // Touche : plus discrète que le cadre sombre
    'frame-btn': { fill: '#2f2560', light: '#b9b0d8', mid: '#4a3c94' },
    // Danger (quitter, perte)
    'frame-red': { fill: '#3a1430', light: '#ff6a55', mid: '#a8322a' },
};

function frame9({ fill, light, mid }, edge = '#0b0a14') {
    const c = document.createElement('canvas');
    c.width = 18;
    c.height = 18;
    const ctx = c.getContext('2d');
    const R = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
    R(1, 0, 16, 18, edge);
    R(0, 1, 18, 16, edge);
    R(2, 1, 14, 16, light);
    R(1, 2, 16, 14, light);
    R(2, 2, 14, 14, mid);
    R(3, 3, 12, 12, fill);
    R(3, 14, 12, 1, mid);
    R(14, 3, 1, 12, mid);
    return c.toDataURL('image/png');
}

let installed = false;

/** Pose les cadres en variables CSS (--frame, --frame-light…) ; sans effet côté serveur */
export function installPixelFrames() {
    if (installed || typeof document === 'undefined') return;
    installed = true;
    const st = document.documentElement.style;
    Object.entries(PALETTES).forEach(([name, pal]) => st.setProperty(`--${name}`, `url(${frame9(pal)})`));
}
