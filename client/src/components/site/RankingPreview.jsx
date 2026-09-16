import React, { useId } from 'react';
import { Link } from 'react-router-dom';
import { useSiteI18n, formatNumber, formatOrdinal } from '../../utils/siteI18n';
import { useDiscordAuth } from '../../utils/discordAuth';
import { useApi } from '../../utils/useApi';
import { Avatar, SkeletonRows } from './SiteUI';

const PREVIEW_LIMIT = 5;

function RankRow({ rank, avatar, username, value, isMe, label }) {
    return (
        <li className={`flex items-center gap-3 border-b border-site-line py-2.5 last:border-b-0 ${isMe ? 'bg-site-highlight' : ''}`}>
            <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-extrabold ${rank === 1 ? 'bg-brand-yellow text-brand-ink' : 'bg-site-tint text-site-muted'}`}
            >
                {rank ?? '—'}
            </span>
            <Avatar src={avatar} name={username} size={28} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {username}
                {label && <span className="ml-1.5 text-xs font-normal text-site-muted">({label})</span>}
            </span>
            <span className="text-sm font-bold tabular-nums">{value}</span>
        </li>
    );
}

// Aperçu du classement compétitif sur le hub (tous jeux confondus)
export default function RankingPreview() {
    const { t, language } = useSiteI18n();
    const { isAuthenticated, user, getAvatarUrl } = useDiscordAuth();
    const titleId = useId();

    const ranking = useApi(`/api/ranking?game=all&limit=${PREVIEW_LIMIT}`);
    // Sa propre place n'est chargée que si elle n'est pas déjà dans les cinq premiers
    const me = useApi(isAuthenticated ? '/api/ranking/me?game=all' : null, { auth: true });

    const players = ranking.data?.leaderboard || [];
    const myEntry = me.data?.player;
    const inTop = Boolean(user?.username) && players.some((player) => player.username === user.username);
    const showMyRow = isAuthenticated && !inTop && myEntry;

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
                <div className="mt-2">
                    <SkeletonRows rows={PREVIEW_LIMIT} label={t('ranking.loading')} />
                </div>
            )}

            {ranking.status === 'error' && (
                <p className="mt-3 text-sm text-site-muted">{t('ranking.error')}</p>
            )}

            {ranking.status === 'ready' && players.length === 0 && (
                <p className="mt-3 text-sm text-site-muted">{t('ranking.empty')}</p>
            )}

            {ranking.status === 'ready' && players.length > 0 && (
                <>
                    <ol className="mt-2">
                        {players.map((player) => (
                            <RankRow
                                key={`${player.rank}-${player.username}`}
                                rank={player.rank}
                                avatar={player.avatar}
                                username={player.username}
                                value={formatNumber(language, player.rating)}
                                isMe={Boolean(user?.username) && player.username === user.username}
                                label={Boolean(user?.username) && player.username === user.username ? t('common.you') : null}
                            />
                        ))}
                    </ol>

                    {showMyRow && (
                        <>
                            <p className="mt-4 text-xs font-bold text-site-soft">{t('ranking.yourRank')}</p>
                            <ol className="mt-1">
                                <RankRow
                                    rank={myEntry.position}
                                    avatar={getAvatarUrl(64)}
                                    username={user.username}
                                    value={myEntry.position ? formatNumber(language, myEntry.rating) : t('ranking.notRanked')}
                                    isMe
                                    label={myEntry.position ? formatOrdinal(language, myEntry.position) : null}
                                />
                            </ol>
                        </>
                    )}
                </>
            )}
        </section>
    );
}