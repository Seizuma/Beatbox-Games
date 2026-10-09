import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Pictogrammes des modes. Dessinés à la main plutôt que pris dans un jeu
 * d'icônes : deux formes suffisent, et elles disent exactement ce que fait
 * chaque mode — une grille de lettres, une grille d'indices.
 */
const ICONS = {
    letters: (
        <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7">
            <rect x="2" y="7" width="8" height="8" rx="2" fill="currentColor" opacity="0.35" />
            <rect x="12" y="7" width="8" height="8" rx="2" fill="currentColor" />
            <rect x="22" y="7" width="8" height="8" rx="2" fill="currentColor" opacity="0.35" />
            <rect x="2" y="17" width="8" height="8" rx="2" fill="currentColor" />
            <rect x="12" y="17" width="8" height="8" rx="2" fill="currentColor" opacity="0.35" />
            <rect x="22" y="17" width="8" height="8" rx="2" fill="currentColor" />
        </svg>
    ),
    clues: (
        <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7">
            <circle cx="6" cy="8" r="4" fill="currentColor" />
            <rect x="13" y="6" width="17" height="4" rx="2" fill="currentColor" opacity="0.35" />
            <circle cx="6" cy="16" r="4" fill="currentColor" opacity="0.35" />
            <rect x="13" y="14" width="13" height="4" rx="2" fill="currentColor" />
            <circle cx="6" cy="24" r="4" fill="currentColor" />
            <rect x="13" y="22" width="9" height="4" rx="2" fill="currentColor" opacity="0.35" />
        </svg>
    ),
};

/**
 * Une carte par mode sur l'écran d'accueil du Beatboxdle.
 *
 * L'état du jour est affiché à droite : c'est ce qui distingue un menu d'un
 * sommaire. Savoir qu'on a déjà joué le mode lettres et pas le mode indices
 * est l'information qu'on vient chercher en ouvrant la page.
 */
export default function ModeCard({ mode, name, description, to, badge, badgeTone = 'idle', streak = null }) {
    const tone = badgeTone === 'done'
        ? 'border-dle-correct bg-dle-correct text-dle-correct-ink'
        : badgeTone === 'failed'
            ? 'border-dle-present bg-dle-present text-dle-present-ink'
            : 'border-brand-yellow text-brand-yellow';

    return (
        <Link
            to={to}
            className="group flex items-center gap-4 rounded-xl border border-site-line bg-site-surface p-4 transition hover:border-brand-yellow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-site-paper sm:p-5"
        >
            <span className="shrink-0 text-brand-yellow transition group-hover:scale-105">
                {ICONS[mode]}
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-lg font-bold leading-tight text-site-ink">{name}</span>
                <span className="text-sm leading-snug text-site-muted">{description}</span>
                {streak && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-brand-yellow">
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                            <path d="M6 0.5c.4 2-1.8 3-1.8 5.1 0 .9.5 1.6 1.1 1.9-.1-1 .6-1.8 1.4-2.4.2 1.3 1.8 1.8 1.8 3.4A3 3 0 0 1 2.5 8.6C2.5 5.4 5.6 4.1 6 .5Z" fill="currentColor" />
                        </svg>
                        {streak}
                    </span>
                )}
            </span>

            {badge ? (
                <span className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.6875rem] font-bold ${tone}`}>
                    {badge}
                </span>
            ) : null}
        </Link>
    );
}
