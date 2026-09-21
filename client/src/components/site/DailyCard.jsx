import React from 'react';
import { Link } from 'react-router-dom';

// Aperçu : trois lignes muettes, juste les couleurs. Aucune lettre, donc aucun
// risque de souffler la réponse du jour depuis le hub.
const PREVIEW = [
    ['absent', 'present', 'absent', 'absent', 'absent'],
    ['present', 'absent', 'absent', 'absent', 'present'],
    ['present', 'absent', 'absent', 'absent', 'correct'],
];

const STATE_CLASS = {
    correct: 'bg-dle-correct',
    present: 'bg-dle-present',
    absent: 'bg-dle-absent',
};

/**
 * Carte du Beatboxdle sur le hub.
 *
 * Volontairement différente de GameCard : les deux autres jeux sont des
 * émissions en direct à plusieurs, celui-ci est une rubrique quotidienne qu'on
 * fait seul. Il garde donc l'habillage sobre de « la chaîne », sans plateau ni
 * projecteurs.
 */
export default function DailyCard({ kicker, name, description, meta, cta }) {
    return (
        <Link
            to="/beatboxdle"
            className="group flex h-full flex-col gap-4 rounded-2xl border border-site-line bg-site-surface p-5 transition hover:border-site-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-site-ink focus-visible:ring-offset-2 focus-visible:ring-offset-site-paper sm:p-6"
        >
            <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-site-muted">{kicker}</p>
                <h2 className="text-2xl font-bold leading-tight text-site-ink">{name}</h2>
            </div>

            <div className="flex flex-col gap-1.5" aria-hidden="true">
                {PREVIEW.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex gap-1.5">
                        {row.map((state, cellIndex) => (
                            <span
                                key={cellIndex}
                                className={`h-7 w-7 rounded ${STATE_CLASS[state]}`}
                            />
                        ))}
                    </div>
                ))}
            </div>

            <p className="text-sm leading-relaxed text-site-muted">{description}</p>

            <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                <span className="inline-flex items-center rounded-lg bg-site-button px-4 py-2.5 text-sm font-semibold text-site-on-button transition group-hover:bg-site-button-hover">
                    {cta}
                </span>
                <span className="text-xs font-medium text-site-muted">{meta}</span>
            </div>
        </Link>
    );
}