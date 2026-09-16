import React from 'react';
import { Link } from 'react-router-dom';
import { useSiteI18n } from '../../utils/siteI18n';

const FOOTER_LINKS = [
    { to: '/contact', key: 'footer.contact' },
    { to: '/privacy', key: 'footer.privacy' },
    { to: '/legal', key: 'footer.legal' },
];

export default function SiteFooter() {
    const { t } = useSiteI18n();

    return (
        <footer className="border-t border-site-line">
            <div className="mx-auto flex max-w-site flex-col gap-3 px-4 py-6 text-sm text-site-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p>{t('footer.madeBy')}</p>
                <nav aria-label={t('footer.legal')} className="flex flex-wrap gap-x-5 gap-y-2">
                    {FOOTER_LINKS.map((link) => (
                        <Link key={link.to} to={link.to} className="hover:text-site-ink">
                            {t(link.key)}
                        </Link>
                    ))}
                </nav>
            </div>
        </footer>
    );
}