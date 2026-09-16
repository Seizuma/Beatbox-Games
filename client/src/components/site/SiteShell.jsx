import React from 'react';
import { SiteI18nProvider } from '../../utils/siteI18n';
import { SiteThemeProvider, useSiteTheme } from '../../utils/siteTheme';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

function ThemedFrame({ children }) {
    const { theme } = useSiteTheme();

    return (
        <div data-site-theme={theme} className="flex min-h-screen flex-col overflow-x-clip bg-site-paper font-site text-site-ink">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
        </div>
    );
}

// Coquille de « la chaîne » : toutes les pages hors jeu (hub, classements, profil, artistes, contact, légal)
export default function SiteShell({ children }) {
    return (
        <SiteI18nProvider>
            <SiteThemeProvider>
                <ThemedFrame>{children}</ThemedFrame>
            </SiteThemeProvider>
        </SiteI18nProvider>
    );
}