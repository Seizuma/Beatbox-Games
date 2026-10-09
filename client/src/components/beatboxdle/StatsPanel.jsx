import React, { useId } from 'react';

/**
 * Statistiques du Beatboxdle : quatre chiffres et la répartition des essais.
 *
 * C'est la raison de revenir le lendemain : une série qu'on ne veut pas
 * casser, une barre qu'on veut voir glisser vers la gauche. `highlight`
 * marque la barre de la partie du jour.
 */
export default function StatsPanel({ t, stats, maxAttempts, highlight = null, streak, compact = false }) {
    const titleId = useId();
    if (!stats) return null;

    const counts = Array.from({ length: maxAttempts }, (_, index) => stats.distribution?.[index + 1] || 0);
    const top = Math.max(1, ...counts);
    const figures = [
        { key: 'played', value: stats.played },
        { key: 'winRate', value: `${stats.winRate} %` },
        { key: 'streak', value: streak ?? stats.currentStreak },
        { key: 'best', value: stats.bestStreak },
    ];

    return (
        <section aria-labelledby={titleId} className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-3">
                <h3 id={titleId} className="text-sm font-bold text-site-ink">{t('beatboxdle.stats.title')}</h3>
                <span className="text-right text-[0.6875rem] text-site-soft">
                    {stats.source === 'account' ? t('beatboxdle.stats.account') : t('beatboxdle.stats.local')}
                </span>
            </div>

            <dl className="grid grid-cols-4 gap-2 text-center">
                {figures.map(({ key, value }) => (
                    <div key={key} className="flex flex-col-reverse gap-0.5">
                        <dt className="text-[0.6875rem] leading-tight text-site-muted">{t(`beatboxdle.stats.${key}`)}</dt>
                        <dd className="text-2xl font-bold tabular-nums leading-none text-site-ink">{value}</dd>
                    </div>
                ))}
            </dl>

            {!compact && (
                <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-site-muted">{t('beatboxdle.stats.distribution')}</p>
                    <ol className="flex flex-col gap-1" aria-label={t('beatboxdle.stats.distribution')}>
                        {counts.map((count, index) => {
                            const attempt = index + 1;
                            const mine = highlight === attempt;
                            return (
                                <li key={attempt} className="grid grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 text-xs">
                                    <span className="text-right font-semibold tabular-nums text-site-muted">{attempt}</span>
                                    <span
                                        aria-label={t('beatboxdle.stats.bar', { attempt, count })}
                                        className={`flex h-5 min-w-[1.5rem] items-center justify-end rounded px-1.5 font-bold tabular-nums ${mine ? 'bg-dle-correct text-dle-correct-ink' : 'bg-site-tint text-site-ink'}`}
                                        style={{ width: `${Math.max(8, Math.round((count / top) * 100))}%` }}
                                    >
                                        {count}
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            )}
        </section>
    );
}
