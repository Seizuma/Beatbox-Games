import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Thème de « la chaîne » : nuit par défaut, jour en option. Les jeux (plateau) ne sont pas concernés.
const STORAGE_KEY = 'beatbox_site_theme';
const THEMES = ['night', 'day'];
export const DEFAULT_THEME = 'night';

// Couleur de fond appliquée au <body> pour que le rebond du scroll mobile reste dans le thème
const PAPER = { night: '#0A0E1C', day: '#F5F6FA' };

const readInitialTheme = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (THEMES.includes(saved)) return saved;
    } catch (error) {
        // localStorage indisponible : thème par défaut
    }
    return DEFAULT_THEME;
};

const SiteThemeContext = createContext(null);

export function SiteThemeProvider({ children }) {
    const [theme, setTheme] = useState(readInitialTheme);

    useEffect(() => {
        const previous = document.body.style.backgroundColor;
        document.body.style.backgroundColor = PAPER[theme];
        return () => {
            document.body.style.backgroundColor = previous;
        };
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setTheme((current) => {
            const next = current === 'night' ? 'day' : 'night';
            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch (error) {
                // Le choix reste valable pour la session
            }
            return next;
        });
    }, []);

    const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

    return <SiteThemeContext.Provider value={value}>{children}</SiteThemeContext.Provider>;
}

export function useSiteTheme() {
    const context = useContext(SiteThemeContext);
    if (!context) {
        throw new Error('useSiteTheme doit être utilisé à l’intérieur de SiteThemeProvider (SiteShell).');
    }
    return context;
}