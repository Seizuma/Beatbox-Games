import React, { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { RankRow } from '../site/RankingPreview';
import { Segmented, SkeletonRows } from '../site/SiteUI';
import { fetchLeaderboard } from '../../utils/beatboxdleApi';
import { useDiscordAuth } from '../../utils/discordAuth';
import { formatOrdinal } from '../../utils/siteI18n';

const LIMIT = 10;

/**
 * Classement du Beatboxdle : l'énigme du jour, ou les sept derniers jours.
 *
 * Le classement général demande des parties à plusieurs ; celui-ci se joue
 * seul, chaque matin. C'est le tableau qu'on vient regarder après avoir fini.
 * Réservé aux comptes Discord : un pseudo sans compte se falsifie trop
 * facilement pour figurer dans un classement.
 */
export default function DayLeaderboard({ t, language, modes }) {
    const titleId = useId();
    const { isAuthenticated, user } = useDiscordAuth();
    const [mode, setMode] = useState(modes[0] || 'letters');
    const [period, setPeriod] = useState('day');
    const [state, setState] = useState({ status: 'loading', data: null });

    useEffect(() => {
        const controller = new AbortController();
        setState((previous) => ({ status: 'loading', data: previous.data }));
        fetchLeaderboard({ mode, period, limit: LIMIT }, controller.signal)
            .then((data) => setState({ status: 'ready', data }))
            .catch((error) => {
                if (error.name !== 'AbortError') setState({ status: 'error', data: null });
            });
        return () => controller.abort();
    }, [mode, period, isAuthenticated]);

    const rows = state.data?.leaderboard || [];
    const me = state.data?.me;
    const meInTop = me && rows.some((row) => row.discordId === me.discordId);
    const value = (row) => (period === 'day'
        ? (row.solved ? t('beatboxdle.board.attempts', { count: row.attempts }) : t('beatboxdle.board.failed'))
        : t('beatboxdle.board.points', { count: row.points }));

    return (
        <section aria-labelledby={titleId} className="flex flex-col gap-3 rounded-xl border border-site-line bg-site-surface p-4 sm:p-5">
            <div className="flex flex-col gap-0.5">
                <h2 id={titleId} className="text-base font-bold text-site-ink">{t('beatboxdle.board.title')}</h2>
                <p className="text-xs text-site-soft">
                    {period === 'day' ? t('beatboxdle.board.hintDay') : t('beatboxdle.board.hintWeek', { max: state.data?.maxAttempts || 6 })}
                </p>
            </div>

            <div className="flex flex-wrap gap-2">
                <Segmented
                    label={t('beatboxdle.modeLabel')}
                    options={modes.map((id) => ({ id, label: t(`beatboxdle.modes.${id}`) }))}
                    value={mode}
                    onChange={setMode}
                />
                <Segmented
                    label={t('beatboxdle.board.period')}
                    options={[
                        { id: 'day', label: t('beatboxdle.board.today') },
                        { id: 'week', label: t('beatboxdle.board.week') },
                    ]}
                    value={period}
                    onChange={setPeriod}
                />
            </div>

            {state.status === 'loading' && !state.data && <SkeletonRows rows={5} label={t('common.loading')} />}
            {state.status === 'error' && <p className="text-sm text-site-muted">{t('beatboxdle.board.error')}</p>}

            {state.status !== 'error' && state.data && (
                rows.length === 0 ? (
                    <p className="text-sm text-site-muted">{t('beatboxdle.board.empty')}</p>
                ) : (
                    <ol aria-busy={state.status === 'loading'}>
                        {rows.map((row) => {
                            const isMe = Boolean(me) && row.discordId === me.discordId;
                            return (
                                <RankRow
                                    key={row.discordId}
                                    rank={row.rank}
                                    avatar={row.avatar}
                                    username={row.username}
                                    value={value(row)}
                                    isMe={isMe}
                                    label={isMe ? t('common.you') : null}
                                />
                            );
                        })}
                    </ol>
                )
            )}

            {me && !meInTop && (
                <ol className="border-t border-site-line pt-1">
                    <RankRow
                        rank={me.rank}
                        avatar={me.avatar}
                        username={me.username || user?.username}
                        value={value(me)}
                        isMe
                        label={formatOrdinal(language, me.rank)}
                    />
                </ol>
            )}

            {!isAuthenticated && (
                <p className="text-xs text-site-muted">
                    {t('beatboxdle.board.guest')}{' '}
                    <Link to="/profile" className="font-semibold text-site-ink underline underline-offset-4">
                        {t('beatboxdle.board.connect')}
                    </Link>
                </p>
            )}
        </section>
    );
}
