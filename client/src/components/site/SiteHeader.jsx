import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useSiteI18n } from '../../utils/siteI18n';
import { useSiteTheme } from '../../utils/siteTheme';
import BrandMark from '../brand/BrandMark';
import Icon from '../icons/Icon';
import SiteAccountButton from './SiteAccountButton';
import SiteSearch from './SiteSearch';
import { useIsAdmin } from '../../utils/useIsAdmin';

const NAV_ITEMS = [
    { to: '/', key: 'nav.games', icon: 'headphones', end: true },
    { to: '/stats', key: 'nav.rankings', icon: 'trophy' },
    { to: '/credits', key: 'nav.artists', icon: 'mic' },
    { to: '/profile', key: 'nav.profile', icon: 'user' },
];

// Ajouté aux deux navigations quand le compte est administrateur
const ADMIN_ITEM = { to: '/admin', key: 'nav.admin', icon: 'settings' };

const LANGUAGES = [
    { id: 'fr', label: 'FR' },
    { id: 'en', label: 'EN' },
];

function LanguageToggle() {
    const { language, switchLanguage, t } = useSiteI18n();

    return (
        <div role="group" aria-label={t('lang.label')} className="flex h-10 overflow-hidden rounded-lg border border-site-line text-xs font-bold">
            {LANGUAGES.map(({ id, label }) => {
                const active = language === id;
                return (
                    <button
                        key={id}
                        type="button"
                        lang={id}
                        aria-pressed={active}
                        onClick={() => switchLanguage(id)}
                        className={`w-10 transition-colors ${active ? 'bg-site-button text-site-on-button' : 'bg-site-surface text-site-muted hover:text-site-ink'}`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

function ThemeToggle() {
    const { theme, toggleTheme } = useSiteTheme();
    const { t } = useSiteI18n();
    const isNight = theme === 'night';

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={isNight ? t('theme.toDay') : t('theme.toNight')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-site-line bg-site-surface text-site-muted transition-colors hover:text-site-ink"
        >
            <Icon name={isNight ? 'sun' : 'moon'} size={18} />
        </button>
    );
}

/**
 * Thème et langue sur petit écran : un seul bouton dans la barre du haut, qui ouvre
 * les deux réglages. Ils servent une fois par visite et occupaient une rangée
 * entière sous les onglets, sur toutes les pages.
 */
function PreferencesMenu() {
    const { t } = useSiteI18n();
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const buttonRef = useRef(null);
    const panelId = useId();

    useEffect(() => {
        if (!open) return undefined;

        const closeOnOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
        };
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') {
                setOpen(false);
                buttonRef.current?.focus();
            }
        };

        document.addEventListener('pointerdown', closeOnOutside);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOnOutside);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open]);

    return (
        <div ref={containerRef} className="relative min-[560px]:hidden">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls={panelId}
                aria-label={t('footer.preferences')}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-site-line transition-colors ${open ? 'bg-site-tint text-site-ink' : 'bg-site-surface text-site-muted hover:text-site-ink'}`}
            >
                <Icon name="settings" size={18} />
            </button>

            {open && (
                <div
                    id={panelId}
                    role="group"
                    aria-label={t('footer.preferences')}
                    className="absolute right-0 top-full z-40 mt-2 flex items-center gap-2 rounded-xl border border-site-line bg-site-surface p-2 shadow-lg"
                >
                    <ThemeToggle />
                    <LanguageToggle />
                </div>
            )}
        </div>
    );
}

/**
 * Barre du haut. Sur mobile elle tient sur une seule rangée : la navigation
 * descend dans SiteTabBar, en bas d'écran, dans la zone du pouce.
 * Le thème, la langue et le compte restent ici, à droite (thème et langue
 * regroupés derrière un bouton sous 560 px).
 */
export default function SiteHeader() {
    const { t } = useSiteI18n();
    const isAdmin = useIsAdmin();

    const desktopLinkClass = ({ isActive }) =>
        `inline-flex items-center border-b-[3px] pt-[3px] text-sm font-semibold transition-colors ${isActive
            ? 'border-brand-yellow text-site-ink'
            : 'border-transparent text-site-muted hover:text-site-ink'
        }`;

    return (
        <header className="sticky top-0 z-30 border-b border-site-line bg-site-surface">
            <div className="mx-auto flex h-14 max-w-site items-stretch gap-3 px-4 sm:px-6 md:gap-8">
                <Link to="/" className="flex shrink-0 items-center gap-2 self-center rounded-md">
                    <BrandMark size={26} />
                    <span className="hidden font-brand text-[15px] leading-none text-site-ink min-[420px]:inline">BeatBox Games</span>
                    <span className="sr-only min-[420px]:hidden">BeatBox Games</span>
                </Link>

                <nav aria-label={t('nav.label')} className="hidden items-stretch gap-6 md:flex">
                    {NAV_ITEMS.map((item) => (
                        <NavLink key={item.to} to={item.to} end={item.end} className={desktopLinkClass}>
                            {t(item.key)}
                        </NavLink>
                    ))}
                    {isAdmin && (
                        <NavLink to={ADMIN_ITEM.to} className={desktopLinkClass}>
                            {t(ADMIN_ITEM.key)}
                        </NavLink>
                    )}
                </nav>

                <div className="ml-auto flex items-center gap-2 sm:gap-3">
                    <SiteSearch />
                    <div role="group" aria-label={t('footer.preferences')} className="hidden items-center gap-2 min-[560px]:flex">
                        <ThemeToggle />
                        <LanguageToggle />
                    </div>
                    <PreferencesMenu />
                    <SiteAccountButton />
                </div>
            </div>
        </header>
    );
}

/**
 * Navigation mobile ancrée en bas d'écran.
 * Le repère « onglet actif » est le même jaune que sur grand écran, au lieu du
 * fond plein des anciennes pilules : un seul langage visuel pour les deux tailles.
 */
export function SiteTabBar() {
    const { t } = useSiteI18n();
    const isAdmin = useIsAdmin();
    const items = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

    const tabClass = ({ isActive }) =>
        `flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 border-t-[3px] px-1 pt-0.5 text-[11px] font-bold transition-colors ${isActive
            ? 'border-brand-yellow text-site-ink'
            : 'border-transparent text-site-muted hover:text-site-ink'
        }`;

    return (
        <nav
            aria-label={t('nav.label')}
            className="sticky bottom-0 z-30 border-t border-site-line bg-site-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        >
            <div className="mx-auto flex max-w-site">
                {items.map((item) => (
                    <NavLink key={item.to} to={item.to} end={item.end} className={tabClass}>
                        <Icon name={item.icon} size={19} />
                        <span>{t(item.key)}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
}