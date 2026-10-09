import React from 'react';
import { SiteI18nProvider } from '../../utils/siteI18n';
import { useThemedSurface } from '../../utils/siteTheme';
import SiteHeader, { SiteTabBar } from './SiteHeader';
import SiteFooter from './SiteFooter';

function ThemedFrame({ variant, children }) {
    const theme = useThemedSurface('site');
    // Page de jeu (Beatboxdle) : l'écran appartient au jeu, sans onglets ni pied de page en bas
    const isGame = variant === 'game';

    return (
        <div data-site-theme={theme} className="flex min-h-screen flex-col overflow-x-clip bg-site-paper font-site text-site-ink">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            {!isGame && <SiteFooter />}
            {!isGame && <SiteTabBar />}
        </div>
    );
}

// Coquille de « la chaîne » : toutes les pages hors jeu (hub, classements, profil, artistes, contact, légal)
// variant="game" : page de jeu de la chaîne (Beatboxdle), en plein écran sous l'en-tête
export default function SiteShell({ variant = 'page', children }) {
    return (
        <SiteI18nProvider>
            <ThemedFrame variant={variant}>{children}</ThemedFrame>
        </SiteI18nProvider>
    );
}
