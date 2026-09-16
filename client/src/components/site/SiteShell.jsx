import React from 'react';
import { SiteI18nProvider } from '../../utils/siteI18n';
import { useThemedSurface } from '../../utils/siteTheme';
import SiteHeader, { SiteTabBar } from './SiteHeader';
import SiteFooter from './SiteFooter';

function ThemedFrame({ children }) {
    const theme = useThemedSurface('site');

    return (
        <div data-site-theme={theme} className="flex min-h-screen flex-col overflow-x-clip bg-site-paper font-site text-site-ink">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <SiteTabBar />
        </div>
    );
}

// Coquille de « la chaîne » : toutes les pages hors jeu (hub, classements, profil, artistes, contact, légal)
export default function SiteShell({ children }) {
    return (
        <SiteI18nProvider>
            <ThemedFrame>{children}</ThemedFrame>
        </SiteI18nProvider>
    );
}