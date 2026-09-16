import React from 'react';
import { Link } from 'react-router-dom';
import { useSiteI18n } from '../../utils/siteI18n';
import { useSiteTheme } from '../../utils/siteTheme';
import Icon from '../icons/Icon';

const FOOTER_LINKS = [
    { to: '/contact', key: 'footer.contact' },
    { to: '/privacy', key: 'footer.privacy' },
    { to: '/legal', key: 'footer.legal' },
];

const LANGUAGES = [
    { id: 'fr', label: 'FR' },
    { id: 'en', label: 'EN' },
];

// Thème et langue : réglages consultés une fois, pas à chaque page.
// Ils quittent le header pour libérer la place du compte et atteindre 44 px de cible tactile.
function DisplayPreferences() {
    const { language, switchLanguage, t } = useSiteI18n();
    const { theme, toggleTheme } = useSiteTheme();
    const isNight = theme === 'night';

    return (
        <div role="group" aria-label={t('footer.preferences')} className="flex items-center gap-2">
            <button
                type="button"
                onClick={toggleTheme}
                aria-label={isNight ? t('theme.toDay') : t('theme.toNight')}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-site-line bg-site-surface text-site-muted transition-colors hover:text-site-ink"
            >
                <Icon name={isNight ? 'sun' : 'moon'} size={18} />
            </button>

            <div role="group" aria-label={t('lang.label')} className="flex h-11 overflow-hidden rounded-lg border border-site-line text-xs font-bold">
                {LANGUAGES.map(({ id, label }) => {
                    const active = language === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            lang={id}
                            aria-pressed={active}
                            onClick={() => switchLanguage(id)}
                            className={`w-11 transition-colors ${active ? 'bg-site-button text-site-on-button' : 'bg-site-surface text-site-muted hover:text-site-ink'}`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function SiteFooter() {
    const { t } = useSiteI18n();

    return (
        <footer className="border-t border-site-line">
            <div className="mx-auto flex max-w-site flex-col gap-5 px-4 py-6 text-sm text-site-soft sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <p>{t('footer.madeBy')}</p>
                    <nav aria-label={t('footer.legal')} className="flex flex-wrap gap-x-5 gap-y-2">
                        {FOOTER_LINKS.map((link) => (
                            <Link key={link.to} to={link.to} className="hover:text-site-ink">
                                {t(link.key)}
                            </Link>
                        ))}
                    </nav>
                </div>
                <DisplayPreferences />
            </div>
        </footer>
    );
}