import { useCallback, useEffect, useState } from 'react';

// Thème global : « la chaîne » (site) et « le plateau » (jeux) suivent le même choix.
// Magasin volontairement hors React : les vues de jeu le lisent sans provider parent.
const STORAGE_KEY = 'beatbox_site_theme';
const THEMES = ['night', 'day'];
export const DEFAULT_THEME = 'night';

// Couleur de fond du <body> et de la barre du navigateur, par surface et par thème
const PAPER = {
    site: { night: '#0A0E1C', day: '#F5F6FA' },
    show: { night: '#0A1B45', day: '#D6E0F6' },
};

const readInitialTheme = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (THEMES.includes(saved)) return saved;
    } catch (error) {
        // localStorage indisponible : thème par défaut
    }
    return DEFAULT_THEME;
};

let currentTheme = readInitialTheme();
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener(currentTheme));

export function setTheme(next) {
    if (!THEMES.includes(next) || next === currentTheme) return;
    currentTheme = next;
    try {
        localStorage.setItem(STORAGE_KEY, next);
    } catch (error) {
        // Le choix reste valable pour la session
    }
    notify();
}

export function getTheme() {
    return currentTheme;
}

export function toggleTheme() {
    setTheme(currentTheme === 'night' ? 'day' : 'night');
}

/** Thème courant, réévalué à chaque changement, d'où qu'il vienne. */
export function useSiteTheme() {
    const [theme, setLocal] = useState(currentTheme);

    useEffect(() => {
        const listener = (next) => setLocal(next);
        listeners.add(listener);
        if (currentTheme !== theme) setLocal(currentTheme);
        return () => listeners.delete(listener);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { theme, toggleTheme, setTheme };
}

/**
 * Applique le thème à une surface : fond du <body> (pour le rebond du scroll mobile)
 * et <meta name="theme-color"> (barre du navigateur sur mobile).
 * surface : 'site' pour les pages de la chaîne, 'show' pour le plateau.
 */
export function useThemedSurface(surface = 'site') {
    const { theme } = useSiteTheme();

    useEffect(() => {
        const paper = (PAPER[surface] || PAPER.site)[theme];
        const previousBackground = document.body.style.backgroundColor;
        document.body.style.backgroundColor = paper;

        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'theme-color');
            document.head.appendChild(meta);
        }
        const previousColor = meta.getAttribute('content');
        meta.setAttribute('content', paper);

        return () => {
            document.body.style.backgroundColor = previousBackground;
            if (previousColor) meta.setAttribute('content', previousColor);
        };
    }, [theme, surface]);

    return theme;
}

/** Libellé du bouton de bascule, sans dépendre d'un fichier de traduction. */
export function useThemeToggle(language = 'fr') {
    const { theme } = useSiteTheme();
    const isNight = theme === 'night';
    const label = language === 'en'
        ? (isNight ? 'Switch to day theme' : 'Switch to night theme')
        : (isNight ? 'Passer au thème jour' : 'Passer au thème nuit');

    return { theme, isNight, label, toggle: useCallback(() => toggleTheme(), []) };
}

// Conservé pour compatibilité : le thème n'a plus besoin de provider.
export function SiteThemeProvider({ children }) {
    return children;
}