import React from 'react';
import { SiteI18nProvider } from '../../utils/siteI18n';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

// Coquille de « la chaîne » : toutes les pages hors jeu (hub, classements, profil, artistes, contact, légal)
export default function SiteShell({ children }) {
    return (
        <SiteI18nProvider>
            <div className="flex min-h-screen flex-col bg-site-paper font-site text-site-ink">
                <SiteHeader />
                <main className="flex-1">{children}</main>
                <SiteFooter />
            </div>
        </SiteI18nProvider>
    );
}