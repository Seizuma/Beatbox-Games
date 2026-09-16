import React from 'react';
import { Link, useParams } from 'react-router-dom';
import SEO from './SEO';
import SiteShell from './site/SiteShell';
import { Avatar, PageContainer, SectionTitle, SiteButton } from './site/SiteUI';
import { Figures } from './stats/StatsBlocks';
import Icon from './icons/Icon';
import { useSiteI18n, formatDay, formatNumber, formatOrdinal } from '../utils/siteI18n';
import { useApi } from '../utils/useApi';

const isBuzzerMode = (gameMode) => typeof gameMode === 'string' && gameMode.startsWith('buzzer_');

function RankingCard({ label, entry, notRanked }) {
    const { language } = useSiteI18n();
    if (!entry || !entry.position) {
        return (
            <div className="rounded-xl border border-site-line bg-site-surface px-4 py-3">
                <p className="text-xs text-site-muted">{label}</p>
                <p className="mt-1 text-sm font-semibold text-site-soft">{notRanked}</p>
            </div>
        );
    }
    return (
        <div className="rounded-xl border border-site-line bg-site-surface px-4 py-3">
            <p className="text-xs text-site-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{formatOrdinal(language, entry.position)}</p>
            <p className="text-xs text-site-soft">{formatNumber(language, entry.rating)}</p>
        </div>
    );
}

function PlayerContent() {
    const { t, language } = useSiteI18n();
    const { discordId } = useParams();
    const profile = useApi(`/api/players/${encodeURIComponent(discordId)}`);

    if (profile.status === 'loading' || profile.status === 'idle') {
        return <p className="py-20 text-center text-site-soft" aria-live="polite">{t('common.loading')}</p>;
    }

    if (profile.status === 'error' || !profile.data?.player) {
        return (
            <div className="mx-auto max-w-lg py-16 text-center">
                <h1 className="text-2xl font-bold">{t('player.unavailableTitle')}</h1>
                <p className="mt-3 text-site-muted">{t('player.unavailableText')}</p>
                <SiteButton to="/stats" className="mt-6">{t('player.backToRanking')}</SiteButton>
            </div>
        );
    }

    const { player, stats, ranking, artists, opponents, recentGames } = profile.data;
    const totalGames = (stats.blindtest.totalGames || 0) + (stats.buzzer.totalGames || 0);
    const totalWins = (stats.blindtest.wins || 0) + (stats.buzzer.wins || 0);

    return (
        <>
            <SEO
                title={t('player.seoTitle', { name: player.username })}
                description={t('player.seoDescription', { name: player.username })}
            />

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <Avatar src={player.avatar} name={player.username} size={72} />
                <div className="min-w-0">
                    <h1 className="truncate text-[1.75rem] font-bold leading-tight tracking-tight sm:text-4xl">{player.username}</h1>
                    <p className="mt-1 text-sm text-site-muted">
                        {t('player.memberSince', { date: formatDay(language, player.memberSince, t) })}
                    </p>
                </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <RankingCard label={t('games.all')} entry={ranking.all} notRanked={t('ranking.notRanked')} />
                <RankingCard label={t('games.blindtest.name')} entry={ranking.blindtest} notRanked={t('ranking.notRanked')} />
                <RankingCard label={t('games.buzzer.name')} entry={ranking.buzzer} notRanked={t('ranking.notRanked')} />
            </div>

            <div className="mt-12 grid gap-10 md:grid-cols-2 md:gap-12">
                <section>
                    <SectionTitle>{t('games.blindtest.name')}</SectionTitle>
                    <Figures
                        items={[
                            { label: t('profile.games'), value: formatNumber(language, stats.blindtest.totalGames) },
                            { label: t('profile.wins'), value: formatNumber(language, stats.blindtest.wins) },
                            { label: t('profile.points'), value: formatNumber(language, stats.blindtest.totalPoints) },
                            { label: t('profile.average'), value: formatNumber(language, stats.blindtest.averageScore) },
                        ]}
                    />
                </section>

                <section>
                    <SectionTitle>{t('games.buzzer.name')}</SectionTitle>
                    <Figures
                        items={[
                            { label: t('profile.games'), value: formatNumber(language, stats.buzzer.totalGames) },
                            { label: t('profile.wins'), value: formatNumber(language, stats.buzzer.wins) },
                            { label: t('player.buzzes'), value: formatNumber(language, stats.buzzer.totalBuzzes) },
                            { label: t('player.reaction'), value: `${formatNumber(language, stats.buzzer.averageReaction)} ms` },
                        ]}
                    />
                </section>
            </div>

            <section className="mt-12">
                <SectionTitle aside={t('player.overallHelp')}>{t('player.overall')}</SectionTitle>
                <Figures
                    items={[
                        { label: t('profile.games'), value: formatNumber(language, totalGames) },
                        { label: t('profile.wins'), value: formatNumber(language, totalWins) },
                    ]}
                />
            </section>

            {artists.length > 0 && (
                <section className="mt-12">
                    <SectionTitle aside={t('player.artistsHelp')}>{t('player.artists')}</SectionTitle>
                    <ul className="grid gap-x-8 sm:grid-cols-2">
                        {artists.map((artist) => (
                            <li key={artist.name} className="flex items-center gap-3 border-b border-site-line py-2 text-sm last:border-b-0">
                                <span className="min-w-0 flex-1 truncate font-semibold">{artist.name}</span>
                                <span className="text-xs text-site-soft">{t('stats.roundsCount', { count: artist.rounds })}</span>
                                <span className="w-16 text-right font-bold tabular-nums">
                                    {artist.rounds ? Math.round((artist.found / artist.rounds) * 100) : 0} %
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {opponents.length > 0 && (
                <section className="mt-12">
                    <SectionTitle aside={t('player.opponentsHelp')}>{t('player.opponents')}</SectionTitle>
                    <ul>
                        {opponents.map((opponent) => (
                            <li key={opponent.discordId} className="border-b border-site-line last:border-b-0">
                                <Link
                                    to={`/player/${encodeURIComponent(opponent.discordId)}`}
                                    className="flex items-center gap-3 rounded-md px-1 py-3 text-sm transition-colors hover:bg-site-tint"
                                >
                                    <Avatar src={opponent.avatar} name={opponent.username} size={28} />
                                    <span className="min-w-0 flex-1 truncate font-semibold">{opponent.username}</span>
                                    <span className="shrink-0 text-xs text-site-soft">
                                        {t('player.record', { ahead: opponent.aheadOfThem, behind: opponent.behindThem })}
                                    </span>
                                    <Icon name="chevron-right" size={16} className="shrink-0 text-site-soft" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {recentGames.length > 0 && (
                <section className="mt-12">
                    <SectionTitle>{t('profile.recent')}</SectionTitle>
                    <ul>
                        {recentGames.map((game) => {
                            const me = game.participants.find((entry) => entry.discordId === player.discordId);
                            const name = isBuzzerMode(game.gameMode) ? t('games.buzzer.name') : t('games.blindtest.name');
                            return (
                                <li key={game.gameId} className="flex items-center gap-3 border-b border-site-line py-3 text-sm last:border-b-0">
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate font-semibold">
                                            {t('profile.gameRank', {
                                                game: name,
                                                rank: formatOrdinal(language, me?.rank ?? 0),
                                                total: game.participants.length,
                                            })}
                                        </span>
                                        <span className="text-xs text-site-soft">{formatDay(language, game.finishedAt, t)}</span>
                                    </span>
                                    <span className="w-16 shrink-0 text-right font-bold tabular-nums">
                                        {formatNumber(language, me?.score ?? 0)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}
        </>
    );
}

function PlayerPage() {
    return (
        <SiteShell>
            <PageContainer>
                <PlayerContent />
            </PageContainer>
        </SiteShell>
    );
}

export default PlayerPage;
