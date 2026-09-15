import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useSiteI18n } from '../../utils/siteI18n';
import BrandMark from '../brand/BrandMark';
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
                        className={`px-2.5 py-1.5 transition-colors ${active ? 'bg-site-ink text-white' : 'bg-site-surface text-site-muted hover:text-site-ink'}`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
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
            ? 'border-site-ink bg-site-ink text-white'
            : 'border-site-line bg-site-surface text-site-muted hover:text-site-ink'
        }`;

    return (
        <header className="sticky top-0 z-30 border-b border-site-line bg-site-surface">
            <div className="mx-auto flex h-14 max-w-site items-stretch gap-4 px-4 sm:px-6 md:gap-8">
                <Link to="/" className="flex items-center gap-2 self-center rounded-md">
                    <BrandMark size={26} />
                    <span className="hidden font-brand text-[15px] leading-none text-brand-ink min-[400px]:inline">BeatBox Games</span>
                    <span className="sr-only min-[400px]:hidden">BeatBox Games</span>
                </Link>

                <nav aria-label={t('nav.label')} className="hidden items-stretch gap-6 md:flex">
                    {NAV_ITEMS.map((item) => (
                        <NavLink key={item.to} to={item.to} end={item.end} className={desktopLinkClass}>
                            {t(item.key)}
                        </NavLink>
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-3">
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