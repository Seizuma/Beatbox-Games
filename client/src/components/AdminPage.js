import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from './SEO';
import SiteShell from './site/SiteShell';
import { Avatar, DataState, Notice, PageContainer, PageHeader, Segmented, SectionTitle, SiteButton, SiteModal } from './site/SiteUI';
import Icon from './icons/Icon';
import { useDiscordAuth } from '../utils/discordAuth';
import { useDiscordCallback } from '../utils/useDiscordCallback';
import { useIsAdmin } from '../utils/useIsAdmin';
import { useSiteI18n, formatDay, formatNumber } from '../utils/siteI18n';
import { API_BASE_URL, getStoredDiscordToken, useApi } from '../utils/useApi';
import useUrlTab from '../hooks/useUrlTab';

const TABS = ['overview', 'players', 'games', 'rooms', 'log', 'maintenance'];

const authFetch = (path, options = {}) => fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getStoredDiscordToken()}`,
        ...(options.headers || {}),
    },
});

const formatBytes = (bytes) => {
    if (!bytes) return '—';
    const mb = bytes / 1024 / 1024;
    return mb >= 1024 ? `${(mb / 1024).toFixed(2)} Go` : `${mb.toFixed(1)} Mo`;
};

const formatUptime = (seconds) => {
    if (!seconds) return '—';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days} j ${hours} h`;
    if (hours > 0) return `${hours} h ${minutes} min`;
    return `${minutes} min`;
};

function StatGrid({ items }) {
    return (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
                <div key={item.label} className="flex flex-col-reverse border-t border-site-line pt-3">
                    <dt className="text-xs text-site-muted">{item.label}</dt>
                    <dd className="text-2xl font-bold tabular-nums">{item.value}</dd>
                </div>
            ))}
        </dl>
    );
}

// Courbe d'activité en SVG : pas de dépendance ajoutée pour un seul graphique
function ActivityChart({ points, label }) {
    if (!points || points.length === 0) return <p className="text-sm text-site-muted">{label}</p>;

    const max = Math.max(...points.map((point) => point.games), 1);
    const width = 720;
    const height = 140;
    const step = points.length > 1 ? width / (points.length - 1) : width;

    const path = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${(index * step).toFixed(1)} ${(height - (point.games / max) * height).toFixed(1)}`)
        .join(' ');

    return (
        <figure>
            <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full" role="img" aria-label={label} preserveAspectRatio="none">
                <path d={`${path} L ${width} ${height} L 0 ${height} Z`} className="fill-site-tint" />
                <path d={path} className="fill-none stroke-site-ink" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            <figcaption className="mt-2 flex justify-between text-xs text-site-soft">
                <span>{points[0]?.day}</span>
                <span>{points[points.length - 1]?.day}</span>
            </figcaption>
        </figure>
    );
}

function OverviewTab() {
    const { t, language } = useSiteI18n();
    const overview = useApi('/api/admin/overview', { auth: true });
    const data = overview.data;

    return (
        <DataState status={overview.status} isEmpty={!data} loadingText={t('common.loading')} errorText={t('common.loadError')} emptyText={t('stats.noData')}>
            {data && (
                <div className="flex flex-col gap-12">
                    <section>
                        <SectionTitle>{t('admin.keyFigures')}</SectionTitle>
                        <StatGrid
                            items={[
                                { label: t('admin.players'), value: formatNumber(language, data.counts.users) },
                                { label: t('admin.playersActive'), value: formatNumber(language, data.counts.usersActiveWeek) },
                                { label: t('admin.gamesTotal'), value: formatNumber(language, data.counts.gamesTotal) },
                                { label: t('admin.gamesDay'), value: formatNumber(language, data.counts.gamesDay) },
                                { label: t('admin.gamesWeek'), value: formatNumber(language, data.counts.gamesWeek) },
                                { label: t('games.blindtest.name'), value: formatNumber(language, data.counts.blindtestGames) },
                                { label: t('games.buzzer.name'), value: formatNumber(language, data.counts.buzzerGames) },
                                { label: t('admin.averagePlayers'), value: data.counts.averagePlayersPerGame },
                            ]}
                        />
                    </section>

                    <section>
                        <SectionTitle aside={t('admin.activityHelp')}>{t('admin.activity')}</SectionTitle>
                        <ActivityChart points={data.activity} label={t('admin.activity')} />
                    </section>

                    <div className="grid gap-10 md:grid-cols-2 md:gap-12">
                        <section>
                            <SectionTitle>{t('admin.system')}</SectionTitle>
                            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                                <dt className="text-site-muted">{t('admin.environment')}</dt><dd className="font-semibold">{data.system.environment}</dd>
                                <dt className="text-site-muted">Node</dt><dd className="font-semibold">{data.system.nodeVersion}</dd>
                                <dt className="text-site-muted">{t('admin.uptime')}</dt><dd className="font-semibold">{formatUptime(data.system.uptimeSeconds)}</dd>
                                <dt className="text-site-muted">{t('admin.memory')}</dt><dd className="font-semibold tabular-nums">{data.system.memoryUsedMb} Mo</dd>
                                <dt className="text-site-muted">{t('admin.load')}</dt><dd className="font-semibold tabular-nums">{data.system.loadAverage.join(' · ')}</dd>
                                <dt className="text-site-muted">{t('admin.database')}</dt><dd className="font-semibold tabular-nums">{formatBytes(data.system.databaseBytes)}</dd>
                            </dl>
                        </section>

                        <section>
                            <SectionTitle>{t('admin.tables')}</SectionTitle>
                            <ul className="text-sm">
                                {data.tables.map((table) => (
                                    <li key={table.table} className="flex items-center justify-between border-b border-site-line py-2 last:border-b-0">
                                        <span className="font-mono text-xs">{table.table}</span>
                                        <span className="font-bold tabular-nums">{formatNumber(language, table.rows)}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>
                </div>
            )}
        </DataState>
    );
}

function PlayersTab() {
    const { t, language } = useSiteI18n();
    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const [selected, setSelected] = useState(null);
    const [dossier, setDossier] = useState(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(query.trim()), 300);
        return () => clearTimeout(timer);
    }, [query]);

    const search = useApi(debounced.length >= 2 ? `/api/admin/players?q=${encodeURIComponent(debounced)}&limit=25` : null, { auth: true });

    const openDossier = async (discordId) => {
        setSelected(discordId);
        setDossier(null);
        const response = await authFetch(`/api/admin/players/${encodeURIComponent(discordId)}`);
        if (response.ok) setDossier(await response.json());
    };

    const deletePlayer = async () => {
        if (!selected) return;
        setDeleting(true);
        const response = await authFetch(`/api/admin/players/${encodeURIComponent(selected)}`, { method: 'DELETE' });
        setDeleting(false);
        if (response.ok) {
            setSelected(null);
            setDossier(null);
            search.reload();
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex max-w-md items-center gap-2 rounded-lg border border-site-line bg-site-surface px-3 focus-within:outline focus-within:outline-2 focus-within:outline-site-ink">
                <Icon name="search" size={16} className="text-site-soft" />
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('admin.searchPlaceholder')}
                    aria-label={t('admin.searchPlaceholder')}
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-site-ink placeholder:text-site-soft focus:outline-none"
                />
            </div>

            {debounced.length < 2 && <p className="text-sm text-site-soft">{t('admin.searchHint')}</p>}

            {debounced.length >= 2 && (
                <DataState
                    status={search.status}
                    isEmpty={!search.data?.results?.length}
                    loadingText={t('common.loading')}
                    errorText={t('common.loadError')}
                    emptyText={t('admin.noPlayer')}
                >
                    <ul>
                        {(search.data?.results || []).map((player) => (
                            <li key={player.discordId} className="border-b border-site-line last:border-b-0">
                                <button
                                    type="button"
                                    onClick={() => openDossier(player.discordId)}
                                    className="flex w-full items-center gap-3 rounded-md px-1 py-3 text-left text-sm transition-colors hover:bg-site-tint"
                                >
                                    <Avatar src={player.avatar} name={player.username} size={32} />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate font-semibold">{player.username}</span>
                                        <span className="font-mono text-[11px] text-site-soft">{player.discordId}</span>
                                    </span>
                                    {!player.isPublic && (
                                        <span className="shrink-0 rounded-full bg-site-tint px-2 py-0.5 text-[11px] font-bold text-site-muted">
                                            {t('admin.private')}
                                        </span>
                                    )}
                                    <span className="shrink-0 text-xs text-site-soft">
                                        {t('search.games', { count: player.totalGames })}
                                    </span>
                                    <Icon name="chevron-right" size={16} className="shrink-0 text-site-soft" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </DataState>
            )}

            <SiteModal
                open={Boolean(selected)}
                onClose={() => { setSelected(null); setDossier(null); }}
                title={dossier?.player?.username || t('common.loading')}
                closeLabel={t('common.close')}
                footer={dossier && (
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                        <SiteButton
                            variant="ghost"
                            className="text-site-danger hover:text-site-danger"
                            onClick={deletePlayer}
                            disabled={deleting || dossier.player.isAdmin}
                        >
                            <Icon name="trash" size={16} />
                            {t('admin.deletePlayer')}
                        </SiteButton>
                        <SiteButton variant="secondary" to={`/player/${encodeURIComponent(dossier.player.discordId)}`}>
                            {t('admin.viewPublicProfile')}
                        </SiteButton>
                    </div>
                )}
            >
                {!dossier ? (
                    <p className="py-8 text-center text-site-soft">{t('common.loading')}</p>
                ) : (
                    <div className="flex flex-col gap-6 text-sm">
                        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5">
                            <dt className="text-site-muted">Discord ID</dt>
                            <dd className="font-mono text-xs">{dossier.player.discordId}</dd>
                            <dt className="text-site-muted">{t('admin.memberSince')}</dt>
                            <dd>{formatDay(language, dossier.player.createdAt, t)}</dd>
                            <dt className="text-site-muted">{t('admin.lastSeen')}</dt>
                            <dd>{formatDay(language, dossier.player.lastSeen, t)}</dd>
                            <dt className="text-site-muted">{t('admin.profileVisibility')}</dt>
                            <dd>{dossier.player.isPublic ? t('admin.public') : t('admin.private')}</dd>
                        </dl>

                        <div>
                            <h3 className="mb-2 font-bold">{t('admin.ratings')}</h3>
                            <ul>
                                {['all', 'blindtest', 'buzzer'].map((game) => (
                                    <li key={game} className="flex justify-between border-b border-site-line py-1.5 last:border-b-0">
                                        <span className="text-site-muted">{game}</span>
                                        <span className="font-bold tabular-nums">
                                            {dossier.ranking[game]?.position
                                                ? `${dossier.ranking[game].position}e · ${dossier.ranking[game].rating}`
                                                : '—'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {dossier.opponents.length > 0 && (
                            <div>
                                <h3 className="mb-2 font-bold">{t('player.opponents')}</h3>
                                <ul>
                                    {dossier.opponents.map((opponent) => (
                                        <li key={opponent.discordId} className="flex justify-between border-b border-site-line py-1.5 last:border-b-0">
                                            <span className="truncate">{opponent.username}</span>
                                            <span className="shrink-0 text-xs text-site-soft">
                                                {t('player.record', { ahead: opponent.aheadOfThem, behind: opponent.behindThem })}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {dossier.recentGames.length > 0 && (
                            <div>
                                <h3 className="mb-2 font-bold">{t('profile.recent')}</h3>
                                <ul>
                                    {dossier.recentGames.slice(0, 8).map((game) => (
                                        <li key={game.gameId} className="flex justify-between border-b border-site-line py-1.5 last:border-b-0">
                                            <span className="truncate">{game.gameMode} · {game.roomCode}</span>
                                            <span className="shrink-0 text-xs text-site-soft">{formatDay(language, game.finishedAt, t)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </SiteModal>
        </div>
    );
}

function GamesTab() {
    const { t, language } = useSiteI18n();
    const games = useApi('/api/admin/games?limit=50', { auth: true });

    return (
        <DataState
            status={games.status}
            isEmpty={!games.data?.games?.length}
            loadingText={t('common.loading')}
            errorText={t('common.loadError')}
            emptyText={t('stats.noData')}
        >
            <ul>
                {(games.data?.games || []).map((game) => (
                    <li key={game.gameId} className="border-b border-site-line py-3 last:border-b-0">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                            <span className="font-bold">{game.gameMode}</span>
                            <span className="font-mono text-xs text-site-soft">{game.roomCode}</span>
                            <span className="text-xs text-site-soft">{formatDay(language, game.finishedAt, t)}</span>
                            <span className="text-xs text-site-soft">{t('admin.roundsCount', { count: game.totalRounds })}</span>
                            {game.gameFilter && <span className="text-xs text-site-muted">{game.gameFilter}</span>}
                        </div>
                        <ol className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-site-muted">
                            {game.participants.map((participant) => (
                                <li key={participant.discordId}>
                                    <Link to={`/player/${encodeURIComponent(participant.discordId)}`} className="hover:text-site-ink">
                                        {participant.rank}. {participant.username} ({participant.score})
                                    </Link>
                                </li>
                            ))}
                        </ol>
                    </li>
                ))}
            </ul>
        </DataState>
    );
}

function RoomsTab() {
    const { t } = useSiteI18n();
    const rooms = useApi('/api/admin/rooms', { auth: true });

    // Les salles vivent en mémoire : on rafraîchit régulièrement
    useEffect(() => {
        const timer = setInterval(() => rooms.reload(), 10000);
        return () => clearInterval(timer);
    }, [rooms]);

    return (
        <DataState
            status={rooms.status}
            isEmpty={!rooms.data?.rooms?.length}
            loadingText={t('common.loading')}
            errorText={t('common.loadError')}
            emptyText={t('admin.noRoom')}
        >
            <ul>
                {(rooms.data?.rooms || []).map((room) => (
                    <li key={`${room.game}-${room.code}`} className="border-b border-site-line py-3 last:border-b-0">
                        <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
                            <span className="font-mono font-bold">{room.code}</span>
                            <span>{room.game === 'buzzer' ? t('games.buzzer.name') : t('games.blindtest.name')}</span>
                            <span className="text-xs text-site-soft">{room.state}</span>
                            {room.currentRound ? (
                                <span className="text-xs text-site-soft">{room.currentRound}/{room.totalRounds}</span>
                            ) : null}
                        </div>
                        <p className="mt-1 text-xs text-site-muted">
                            {room.players.map((player) => `${player.name}${player.connected ? '' : ' (hors ligne)'}`).join(', ') || t('admin.noPlayerInRoom')}
                        </p>
                    </li>
                ))}
            </ul>
        </DataState>
    );
}

function LogTab() {
    const { t, language } = useSiteI18n();
    const [type, setType] = useState('');
    const log = useApi(`/api/admin/log?limit=200${type ? `&type=${encodeURIComponent(type)}` : ''}`, { auth: true });

    const levelClass = (level) => (level === 'error'
        ? 'text-site-danger'
        : level === 'warn' ? 'text-brand-yellow' : 'text-site-soft');

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    aria-label={t('admin.filterType')}
                    className="min-h-[2.75rem] rounded-lg border border-site-line bg-site-surface px-3 py-2 text-sm font-semibold text-site-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-site-ink"
                >
                    <option value="">{t('admin.allTypes')}</option>
                    {(log.data?.types || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
                <SiteButton variant="secondary" size="sm" onClick={() => log.reload()}>{t('admin.refresh')}</SiteButton>
            </div>

            <DataState
                status={log.status}
                isEmpty={!log.data?.entries?.length}
                loadingText={t('common.loading')}
                errorText={t('common.loadError')}
                emptyText={t('admin.emptyLog')}
            >
                <ul className="text-sm">
                    {(log.data?.entries || []).map((entry) => (
                        <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-site-line py-2 last:border-b-0">
                            <span className="w-24 shrink-0 text-xs text-site-soft">{formatDay(language, entry.createdAt, t)}</span>
                            <span className={`w-14 shrink-0 text-xs font-bold ${levelClass(entry.level)}`}>{entry.level}</span>
                            <span className="w-20 shrink-0 font-mono text-[11px] text-site-muted">{entry.type}</span>
                            <span className="min-w-0 flex-1">{entry.message}</span>
                            {entry.username && <span className="shrink-0 text-xs text-site-soft">{entry.username}</span>}
                        </li>
                    ))}
                </ul>
            </DataState>
        </div>
    );
}

function MaintenanceTab() {
    const { t } = useSiteI18n();
    const [confirm, setConfirm] = useState('');
    const [keepUsers, setKeepUsers] = useState(true);
    const [status, setStatus] = useState(null);
    const [busy, setBusy] = useState(false);

    const reset = async () => {
        setBusy(true);
        setStatus(null);
        try {
            const response = await authFetch('/api/admin/reset-stats', {
                method: 'POST',
                body: JSON.stringify({ confirm, keepUsers }),
            });
            setStatus(response.ok ? 'done' : 'error');
            if (response.ok) setConfirm('');
        } catch (error) {
            setStatus('error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="max-w-2xl">
            <SectionTitle aside={t('admin.resetHelp')}>{t('admin.reset')}</SectionTitle>

            <Notice tone="error">{t('admin.resetWarning')}</Notice>

            <label className="mt-6 flex items-center gap-3 text-sm">
                <input
                    type="checkbox"
                    checked={keepUsers}
                    onChange={(event) => setKeepUsers(event.target.checked)}
                    className="h-4 w-4"
                />
                {t('admin.keepUsers')}
            </label>

            <label className="mt-6 block text-sm font-bold" htmlFor="admin-reset-confirm">
                {t('admin.typeReset')}
            </label>
            <input
                id="admin-reset-confirm"
                type="text"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="RESET"
                autoComplete="off"
                className="mt-2 w-full max-w-xs rounded-lg border border-site-line bg-site-surface px-3 py-2.5 text-base font-semibold tracking-[0.2em] text-site-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-site-ink"
            />

            <div className="mt-5">
                <SiteButton variant="danger" onClick={reset} disabled={busy || confirm !== 'RESET'}>
                    {busy ? t('admin.resetting') : t('admin.resetConfirm')}
                </SiteButton>
            </div>

            {status === 'done' && <div className="mt-5"><Notice tone="success">{t('admin.resetDone')}</Notice></div>}
            {status === 'error' && <div className="mt-5"><Notice tone="error">{t('admin.resetError')}</Notice></div>}

            <p className="mt-8 text-xs text-site-soft">{t('admin.resetScript')}</p>
        </div>
    );
}

function AdminContent() {
    const { t } = useSiteI18n();
    const { isAuthenticated, login, loading } = useDiscordAuth();
    const isAdmin = useIsAdmin();
    const [tab, setTab] = useUrlTab('tab', TABS, 'overview');
    useDiscordCallback();

    if (!isAuthenticated) {
        return (
            <div className="mx-auto max-w-lg py-16 text-center">
                <h1 className="text-2xl font-bold">{t('admin.loginTitle')}</h1>
                <p className="mt-3 text-site-muted">{t('admin.loginText')}</p>
                <SiteButton className="mt-6" onClick={() => login('admin')} disabled={loading}>
                    <Icon name="discord" size={18} />
                    {t('account.login')}
                </SiteButton>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="mx-auto max-w-lg py-16 text-center">
                <h1 className="text-2xl font-bold">{t('admin.deniedTitle')}</h1>
                <p className="mt-3 text-site-muted">{t('admin.deniedText')}</p>
                <SiteButton to="/" className="mt-6" variant="secondary">{t('notFound.home')}</SiteButton>
            </div>
        );
    }

    return (
        <>
            <PageHeader title={t('admin.title')} intro={t('admin.intro')}>
                <Segmented
                    label={t('admin.sections')}
                    value={tab}
                    onChange={setTab}
                    options={TABS.map((id) => ({ id, label: t(`admin.tab.${id}`) }))}
                />
            </PageHeader>

            <div className="mt-10">
                {tab === 'overview' && <OverviewTab />}
                {tab === 'players' && <PlayersTab />}
                {tab === 'games' && <GamesTab />}
                {tab === 'rooms' && <RoomsTab />}
                {tab === 'log' && <LogTab />}
                {tab === 'maintenance' && <MaintenanceTab />}
            </div>
        </>
    );
}

function AdminPage() {
    return (
        <SiteShell>
            <SEO title="Administration — BeatBox Games" description="Espace d'administration" />
            <PageContainer>
                <AdminContent />
            </PageContainer>
        </SiteShell>
    );
}

export default AdminPage;
