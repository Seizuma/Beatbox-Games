import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useSiteI18n } from '../../utils/siteI18n';
import BrandMark from '../brand/BrandMark';
import Icon from '../icons/Icon';
import SiteAccountButton from './SiteAccountButton';

const NAV_ITEMS = [
    { to: '/', key: 'nav.games', icon: 'headphones', end: true },
    { to: '/stats', key: 'nav.rankings', icon: 'trophy' },
    { to: '/credits', key: 'nav.artists', icon: 'mic' },
    { to: '/profile', key: 'nav.profile', icon: 'user' },
];

/**
 * Barre du haut. Sur mobile elle tient sur une seule rangée : la navigation
 * descend dans SiteTabBar, en bas d'écran, dans la zone du pouce.
 * Le thème et la langue vivent dans le pied de page, pour ne laisser dans le
 * header que l'accès au compte.
 */
export default function SiteHeader() {
    const { t } = useSiteI18n();

    const desktopLinkClass = ({ isActive }) =>
        `inline-flex items-center border-b-[3px] pt-[3px] text-sm font-semibold transition-colors ${isActive
            ? 'border-brand-yellow text-site-ink'
            : 'border-transparent text-site-muted hover:text-site-ink'
        }`;

    return (
        <header className="sticky top-0 z-30 border-b border-site-line bg-site-surface">
            <div className="mx-auto flex h-14 max-w-site items-stretch gap-4 px-4 sm:px-6 md:gap-8">
                <Link to="/" className="flex items-center gap-2 self-center rounded-md">
                    <BrandMark size={26} />
                    <span className="font-brand text-[15px] leading-none text-site-ink">BeatBox Games</span>
                </Link>

                <nav aria-label={t('nav.label')} className="hidden items-stretch gap-6 md:flex">
                    {NAV_ITEMS.map((item) => (
                        <NavLink key={item.to} to={item.to} end={item.end} className={desktopLinkClass}>
                            {t(item.key)}
                        </NavLink>
                    ))}
                </nav>

                <div className="ml-auto flex items-center">
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
                {NAV_ITEMS.map((item) => (
                    <NavLink key={item.to} to={item.to} end={item.end} className={tabClass}>
                        <Icon name={item.icon} size={19} />
                        <span>{t(item.key)}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
}