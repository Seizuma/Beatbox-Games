import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSiteI18n } from '../../utils/siteI18n';
import { stripEmoji } from '../../utils/showI18n';
import Icon from '../icons/Icon';

export const CONTACT_EMAIL = 'contact@beatboxgames.com';

const cleanTitle = (text) => stripEmoji(text).replace(/\s*:\s*$/, '');

// Mise en page commune des mentions légales et de la politique de confidentialité
export default function LegalLayout({ title, updated, sections, children }) {
    const { t } = useSiteI18n();

    const scrollTo = (id) => {
        const target = document.getElementById(id);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.focus({ preventScroll: true });
    };

    const tabClass = ({ isActive }) =>
        `whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-bold transition-colors ${isActive ? 'bg-site-surface text-site-ink shadow-[0_1px_0_rgb(var(--site-line))]' : 'text-site-muted hover:text-site-ink'}`;

    return (
        <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
            <aside className="lg:sticky lg:top-24 lg:self-start">
                <nav aria-label={t('legal.tabs')} className="inline-flex gap-1 rounded-lg bg-site-tint p-1">
                    <NavLink to="/legal" className={tabClass}>{t('legal.legal')}</NavLink>
                    <NavLink to="/privacy" className={tabClass}>{t('legal.privacy')}</NavLink>
                </nav>

                <nav aria-label={t('legal.toc')} className="mt-6 hidden lg:block">
                    <p className="mb-2 text-xs font-semibold text-site-soft">{t('legal.toc')}</p>
                    <ul className="flex flex-col border-l border-site-line">
                        {sections.map((section) => (
                            <li key={section.id}>
                                <button
                                    type="button"
                                    onClick={() => scrollTo(section.id)}
                                    className="-ml-px border-l-2 border-transparent py-1.5 pl-3 text-left text-sm text-site-muted transition-colors hover:border-brand-yellow hover:text-site-ink"
                                >
                                    {cleanTitle(section.title)}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
            </aside>

            <article className="max-w-[68ch]">
                <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-4xl">{title}</h1>
                {updated && <p className="mt-2 text-sm text-site-soft">{updated}</p>}
                <div className="mt-8 flex flex-col gap-10">{children}</div>
            </article>
        </div>
    );
}

export function LegalSection({ id, title, children }) {
    return (
        <section aria-labelledby={`${id}-title`}>
            <h2 id={`${id}-title`} className="mb-3 text-lg font-bold sm:text-xl">
                <span id={id} tabIndex={-1} className="scroll-mt-28 outline-none">{cleanTitle(title)}</span>
            </h2>
            <div className="flex flex-col gap-3 text-[0.975rem] leading-relaxed text-site-muted [&_strong]:font-semibold [&_strong]:text-site-ink">
                {children}
            </div>
        </section>
    );
}

export function LegalList({ items }) {
    return (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-site-soft">
            {items.map((item, index) => (
                <li key={index}>{item}</li>
            ))}
        </ul>
    );
}

export function MailLink() {
    return (
        <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-2 font-semibold text-site-ink underline decoration-brand-yellow decoration-2 underline-offset-4"
        >
            <Icon name="mail" size={16} />
            {CONTACT_EMAIL}
        </a>
    );
}

export { cleanTitle };