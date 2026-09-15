import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useSiteI18n } from '../../utils/siteI18n';
import { useSiteTheme } from '../../utils/siteTheme';
import BrandMark from '../brand/BrandMark';
import Icon from '../icons/Icon';
import SiteAccountButton from './SiteAccountButton';

const NAV_ITEMS = [
    { to: '/', key: 'nav.games', end: true },
    { to: '/stats', key: 'nav.rankings' },
    { to: '/credits', key: 'nav.artists' },
    { to: '/profile', key: 'nav.profile' },
];

const LANGUAGES = [
    { id: 'fr', label: 'FR' },
    { id: 'en', label: 'EN' },
];

function LanguageToggle() {
    const { language, switchLanguage, t } = useSiteI18n();

    return (
        <div role="group" aria-label={t('lang.label')} className="flex overflow-hidden rounded-lg border border-site-line text-xs font-bold">
            {LANGUAGES.map(({ id, label }) => {
                const active = language === id;
                return (
                    <button
                        key={id}
                        type="button"
                        lang={id}
                        aria-pressed={active}
                        onClick={() => switchLanguage(id)}
                        className={`px-2.5 py-1.5 transition-colors ${active ? 'bg-site-button text-site-on-button' : 'bg-site-surface text-site-muted hover:text-site-ink'}`}
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-site-line bg-site-surface text-site-muted transition-colors hover:text-site-ink"
        >
            <Icon name={isNight ? 'sun' : 'moon'} size={17} title={isNight ? t('theme.toDay') : t('theme.toNight')} />
        </button>
    );
}

export default function SiteHeader() {
    const { t } = useSiteI18n();

    const desktopLinkClass = ({ isActive }) =>
        `inline-flex items-center border-b-[3px] pt-[3px] text-sm font-semibold transition-colors ${isActive
            ? 'border-brand-yellow text-site-ink'
            : 'border-transparent text-site-muted hover:text-site-ink'
        }`;

    const mobileLinkClass = ({ isActive }) =>
        `whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${isActive
            ? 'border-site-button bg-site-button text-site-on-button'
            : 'border-site-line bg-site-surface text-site-muted hover:text-site-ink'
        }`;

    return (
        <header className="sticky top-0 z-30 border-b border-site-line bg-site-surface">
            <div className="mx-auto flex h-14 max-w-site items-stretch gap-3 px-4 sm:gap-4 sm:px-6 md:gap-8">
                <Link to="/" className="flex items-center gap-2 self-center rounded-md">
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
                </nav>

                <div className="ml-auto flex items-center gap-2 sm:gap-3">
                    <ThemeToggle />
                    <LanguageToggle />
                    <SiteAccountButton />
                </div>
            </div>

            <nav aria-label={t('nav.label')} className="border-t border-site-line md:hidden">
                <div className="flex gap-2 overflow-x-auto px-4 py-2">
                    {NAV_ITEMS.map((item) => (
                        <NavLink key={item.to} to={item.to} end={item.end} className={mobileLinkClass}>
                            {t(item.key)}
                        </NavLink>
                    ))}
                </div>
            </nav>
        </header>
    );
}