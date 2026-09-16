import React, { useId } from 'react';
import { Link } from 'react-router-dom';
import { useSiteI18n, formatNumber } from '../../utils/siteI18n';
import { useApi } from '../../utils/useApi';
import { Avatar } from './SiteUI';

const PREVIEW_LIMIT = 5;

// Aperçu du classement compétitif sur le hub (tous jeux confondus)
export default function RankingPreview() {
    const { t, language } = useSiteI18n();
    const titleId = useId();
    const ranking = useApi(`/api/ranking?game=all&limit=${PREVIEW_LIMIT}`);
    const players = ranking.data?.leaderboard || [];

    return (
        <section aria-labelledby={titleId}>
            <div className="flex items-baseline justify-between gap-4">
                <h2 id={titleId} className="text-base font-bold">{t('ranking.title')}</h2>
                <Link
                    to="/stats"
                    className="text-sm font-semibold underline decoration-brand-yellow decoration-2 underline-offset-4 hover:decoration-site-ink"
                >
                    {t('ranking.seeAll')}
                </Link>
            </div>
            <p className="mt-0.5 text-xs text-site-soft">{t('ranking.hint')}</p>

            {(ranking.status === 'loading' || ranking.status === 'idle') && (
                <p className="mt-3 text-sm text-site-soft" aria-live="polite">{t('ranking.loading')}</p>
            )}

            {ranking.status === 'error' && (
                <p className="mt-3 text-sm text-site-muted">{t('ranking.error')}</p>
            )}

            {ranking.status === 'ready' && players.length === 0 && (
                <p className="mt-3 text-sm text-site-muted">{t('ranking.empty')}</p>
            )}

            {ranking.status === 'ready' && players.length > 0 && (
                <ol className="mt-2">
                    {players.map((player) => (
                        <li key={`${player.rank}-${player.username}`} className="flex items-center gap-3 border-b border-site-line py-2.5 last:border-b-0">
                            <span
                                className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-extrabold ${player.rank === 1 ? 'bg-brand-yellow text-brand-ink' : 'bg-site-tint text-site-muted'}`}
                            >
                                {player.rank}
                            </span>
                            <Avatar src={player.avatar} name={player.username} size={28} />
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.username}</span>
                            <span className="text-sm font-bold tabular-nums">{formatNumber(language, player.rating)}</span>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}