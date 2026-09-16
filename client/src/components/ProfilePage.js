import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from './SEO';
import SiteShell from './site/SiteShell';
import { Avatar, DataState, Notice, PageContainer, Segmented, SectionTitle, SiteButton, SiteModal } from './site/SiteUI';
import { Figures } from './stats/StatsBlocks';
import Icon from './icons/Icon';
import { useDiscordAuth } from '../utils/discordAuth';
import { useDiscordCallback } from '../utils/useDiscordCallback';
import { useSiteI18n, formatDay, formatNumber, formatOrdinal } from '../utils/siteI18n';
import { getStoredDiscordToken, useApi } from '../utils/useApi';

const isBuzzerMode = (gameMode) => typeof gameMode === 'string' && gameMode.startsWith('buzzer_');

function GuestProfile({ pending }) {
    const { t } = useSiteI18n();
    const { login, loading } = useDiscordAuth();

    if (pending) {
        return <p className="py-16 text-center text-site-soft" aria-live="polite">{t('profile.connecting')}</p>;
    }

    return (
        <div className="mx-auto max-w-lg py-10 text-center">
            <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-3xl">{t('profile.guestTitle')}</h1>
            <p className="mt-3 text-site-muted">{t('profile.guestText')}</p>
            <SiteButton className="mt-6" onClick={() => login('profile')} disabled={loading}>
                <Icon name="discord" size={18} />
                {t('account.login')}
            </SiteButton>
        </div>
    );
}

function GameDetailModal({ game, onClose, username }) {
    const { t, language } = useSiteI18n();
    const participants = Array.isArray(game?.participants)
        ? game.participants.slice().sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
        : [];

    return (
        <SiteModal
            open={Boolean(game)}
            onClose={onClose}
            title={t('profile.gameDetail')}
            closeLabel={t('common.close')}
        >
            {game && (
                <>
                    <p className="text-sm text-site-muted">
                        <span className="font-brand text-site-ink">{isBuzzerMode(game.gameMode) ? t('games.buzzer.name') : t('games.blindtest.name')}</span>
                        {' '}{formatDay(language, game.finishedAt, t)}
                        {game.roomCode ? `, ${t('profile.room', { room: game.roomCode })}` : ''}
                    </p>

                    <h3 className="mb-2 mt-5 text-sm font-bold">{t('profile.participants')}</h3>
                    {participants.length === 0 ? (
                        <p className="text-sm text-site-muted">{t('profile.noParticipants')}</p>
                    ) : (
                        <ol>
                            {participants.map((participant, index) => {
                                const isMe = participant.username === username;
                                return (
                                    <li
                                        key={`${participant.username}-${index}`}
                                        className={`flex items-center gap-3 border-b border-site-line px-2 py-2.5 text-sm last:border-b-0 ${isMe ? 'bg-site-highlight' : ''}`}
                                    >
                                        <span className="w-10 font-bold tabular-nums text-site-muted">{formatOrdinal(language, participant.rank ?? index + 1)}</span>
                                        <span className="min-w-0 flex-1 truncate font-semibold">
                                            {participant.username}
                                            {isMe && <span className="ml-1 text-xs font-normal text-site-muted">({t('common.you')})</span>}
                                        </span>
                                        <span className="font-bold tabular-nums">{t('common.points', { value: formatNumber(language, participant.score) })}</span>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </>
            )}
        </SiteModal>
    );
}

function ConnectedProfile() {
    const { t, language } = useSiteI18n();
    const navigate = useNavigate();
    const { user, getAvatarUrl, logout, deleteAccount, loading } = useDiscordAuth();

    const [game, setGame] = useState('blindtest');
    const [selectedGame, setSelectedGame] = useState(null);
    const [showDelete, setShowDelete] = useState(false);
    const [deleteError, setDeleteError] = useState(false);

    const blindtest = useApi('/api/stats/me/blindtest', { auth: true });
    const buzzer = useApi('/api/stats/me/buzzer', { auth: true });
    const ranking = useApi(`/api/ranking/me?game=${game}`, { auth: true });
    const current = game === 'buzzer' ? buzzer : blindtest;
    const rankingPlayer = ranking.data?.player;
    const stats = current.data?.stats;
    const recentGames = current.data?.recentGames || [];

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const handleDelete = async () => {
        setDeleteError(false);
        try {
            await deleteAccount();
            navigate('/');
        } catch (error) {
            setDeleteError(true);
        }
    };

    return (
        <>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Avatar src={getAvatarUrl()} name={user.username} size={64} />
                    <div className="min-w-0">
                        <h1 className="truncate text-[1.75rem] font-bold leading-tight tracking-tight sm:text-4xl">{user.username}</h1>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-site-muted">
                            <Icon name="discord" size={15} />
                            {t('profile.connectedWith')}
                        </p>
                    </div>
                </div>
                <Segmented
                    label={t('stats.gameTabs')}
                    value={game}
                    onChange={setGame}
                    options={[
                        { id: 'blindtest', label: t('games.blindtest.name') },
                        { id: 'buzzer', label: t('games.buzzer.name') },
                    ]}
                />
            </div>

            <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-12">
                <div className="flex flex-col gap-10">
                <section>
                    <SectionTitle aside={t('profile.rankingHelp')}>{t('profile.rankingTitle')}</SectionTitle>
                    <DataState status={ranking.status} isEmpty={!rankingPlayer} loadingText={t('common.loading')} errorText={t('common.loadError')} emptyText={t('profile.noGames')}>
                        {rankingPlayer && (
                            <>
                                <Figures
                                    items={[
                                        { label: t('profile.rating'), value: formatNumber(language, rankingPlayer.rating) },
                                        {
                                            label: t('profile.position'),
                                            value: rankingPlayer.position ? formatOrdinal(language, rankingPlayer.position) : '—',
                                        },
                                        { label: t('profile.rankedGames'), value: formatNumber(language, rankingPlayer.rankedGames) },
                                        { label: t('profile.peak'), value: formatNumber(language, rankingPlayer.peakRating ?? rankingPlayer.rating) },
                                    ]}
                                />
                                {rankingPlayer.placementRemaining > 0 && (
                                    <p className="mt-4 rounded-lg bg-site-tint px-4 py-3 text-sm text-site-muted">
                                        {t('profile.placement', { count: rankingPlayer.placementRemaining })}
                                    </p>
                                )}
                            </>
                        )}
                    </DataState>
                </section>

                <section>
                    <SectionTitle>{t('profile.personalTitle')}</SectionTitle>
                    <DataState status={current.status} isEmpty={!stats} loadingText={t('common.loading')} errorText={t('common.loadError')} emptyText={t('profile.noGames')}>
                        {stats && (
                            <Figures
                                items={[
                                    { label: t('profile.games'), value: formatNumber(language, stats.totalGames) },
                                    { label: t('profile.wins'), value: formatNumber(language, stats.wins) },
                                    { label: t('profile.points'), value: formatNumber(language, stats.totalPoints) },
                                    { label: t('profile.average'), value: formatNumber(language, stats.averageScore) },
                                    {
                                        label: game === 'buzzer' ? t('profile.correctGuesses') : t('profile.roundsWon'),
                                        value: formatNumber(language, stats.totalRoundsWon),
                                    },
                                ]}
                            />
                        )}
                    </DataState>
                </section>
                </div>

                <section aria-labelledby="profile-recent">
                    <SectionTitle id="profile-recent">{t('profile.recent')}</SectionTitle>
                    <DataState status={current.status} isEmpty={recentGames.length === 0} loadingText={t('common.loading')} errorText={t('common.loadError')} emptyText={t('profile.noGames')}>
                        <ul>
                            {recentGames.map((item, index) => {
                                const total = Array.isArray(item.participants) ? item.participants.length : null;
                                return (
                                    <li key={`${item.roomCode}-${item.finishedAt}-${index}`} className="border-b border-site-line last:border-b-0">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedGame(item)}
                                            className="flex w-full items-center gap-3 rounded-md px-1 py-3 text-left text-sm transition-colors hover:bg-site-tint"
                                        >
                                            <span className="w-20 shrink-0 text-xs text-site-soft">{formatDay(language, item.finishedAt, t)}</span>
                                            <span className="min-w-0 flex-1 truncate">
                                                {item.roomCode ? t('profile.room', { room: item.roomCode }) : ''}
                                            </span>
                                            <span className={`shrink-0 font-semibold ${item.finalRank === 1 ? 'text-site-ink' : 'text-site-muted'}`}>
                                                {total
                                                    ? t('profile.rankOf', { rank: formatOrdinal(language, item.finalRank), total })
                                                    : formatOrdinal(language, item.finalRank)}
                                            </span>
                                            <span className="w-16 shrink-0 text-right font-bold tabular-nums">{formatNumber(language, item.finalScore)}</span>
                                            <Icon name="chevron-right" size={16} className="text-site-soft" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </DataState>
                </section>
            </div>

            <section className="mt-14 border-t border-site-line pt-8">
                <SectionTitle>{t('profile.account')}</SectionTitle>
                <div className="flex flex-wrap gap-3">
                    <SiteButton variant="secondary" onClick={handleLogout} disabled={loading}>
                        <Icon name="logout" size={16} />
                        {t('profile.logout')}
                    </SiteButton>
                    <SiteButton variant="ghost" className="text-site-danger hover:text-site-danger" onClick={() => setShowDelete(true)}>
                        <Icon name="trash" size={16} />
                        {t('profile.delete')}
                    </SiteButton>
                </div>
            </section>

            <GameDetailModal game={selectedGame} onClose={() => setSelectedGame(null)} username={user.username} />

            <SiteModal
                open={showDelete}
                onClose={() => {
                    setShowDelete(false);
                    setDeleteError(false);
                }}
                title={t('profile.deleteTitle')}
                closeLabel={t('common.close')}
                footer={
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <SiteButton variant="secondary" onClick={() => setShowDelete(false)}>{t('common.cancel')}</SiteButton>
                        <SiteButton variant="danger" onClick={handleDelete} disabled={loading}>{t('profile.deleteConfirm')}</SiteButton>
                    </div>
                }
            >
                <p className="text-sm text-site-muted">{t('profile.deleteText')}</p>
                {deleteError && <div className="mt-4"><Notice tone="error">{t('profile.deleteError')}</Notice></div>}
            </SiteModal>
        </>
    );
}

function ProfileContent() {
    const { t } = useSiteI18n();
    const { isAuthenticated, user } = useDiscordAuth();
    useDiscordCallback();

    // Un token est stocké mais les données Discord ne sont pas encore chargées
    const pending = !isAuthenticated && Boolean(getStoredDiscordToken());

    return (
        <>
            <SEO title={t('profile.seoTitle')} description={t('profile.guestText')} url="https://beatboxgames.com/#/profile" />
            <PageContainer>
                {isAuthenticated && user ? <ConnectedProfile /> : <GuestProfile pending={pending} />}
            </PageContainer>
        </>
    );
}

function ProfilePage() {
    return (
        <SiteShell>
            <ProfileContent />
        </SiteShell>
    );
}

export default ProfilePage;