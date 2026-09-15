import React, { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSiteI18n, formatNumber } from '../../utils/siteI18n';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';
const PREVIEW_LIMIT = 5;

export default function RankingPreview() {
    const { t, language } = useSiteI18n();
    const titleId = useId();
    const [status, setStatus] = useState('loading');
    const [players, setPlayers] = useState([]);

    useEffect(() => {
        const controller = new AbortController();

        fetch(`${API_BASE_URL}/api/stats/leaderboard?limit=${PREVIEW_LIMIT}`, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((data) => {
                setPlayers(Array.isArray(data.leaderboard) ? data.leaderboard : []);
                setStatus('ready');
            })
            .catch((error) => {
                if (error.name !== 'AbortError') setStatus('error');
            });

        return () => controller.abort();
    }, []);


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

            {status === 'loading' && (
                <p className="mt-3 text-sm text-site-soft" aria-live="polite">{t('ranking.loading')}</p>
            )}

            {status === 'error' && (
                <p className="mt-3 text-sm text-site-muted">{t('ranking.error')}</p>
            )}

            {status === 'ready' && players.length === 0 && (
                <p className="mt-3 text-sm text-site-muted">{t('ranking.empty')}</p>
            )}

            {status === 'ready' && players.length > 0 && (
                <ol className="mt-2">
                    {players.map((player) => (
                        <li key={`${player.rank}-${player.username}`} className="flex items-center gap-3 border-b border-site-line py-2.5 last:border-b-0">
                            <span
                                className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-extrabold ${player.rank === 1 ? 'bg-brand-yellow text-brand-ink' : 'bg-site-tint text-site-muted'}`}
                            >
                                {player.rank}
                            </span>
                            {player.avatar ? (
                                <img
                                    src={player.avatar}
                                    alt={t('ranking.avatarAlt', { name: player.username })}
                                    loading="lazy"
                                    className="h-7 w-7 rounded-full bg-site-tint object-cover"
                                />
                            ) : (
                                <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-site-tint text-xs font-bold text-site-muted">
                                    {(player.username || '?').charAt(0).toUpperCase()}
                                </span>
                            )}
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.username}</span>
                            <span className="text-sm font-bold tabular-nums">
                                {t('common.points', { value: formatNumber(language, player.totalPoints) })}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}