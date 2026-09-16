import React, { useMemo, useState } from 'react';
import { useSiteI18n, formatNumber } from '../../utils/siteI18n';
import { useDiscordAuth } from '../../utils/discordAuth';
import { Avatar, DataState, SectionTitle } from '../site/SiteUI';
import Icon from '../icons/Icon';

const clampRate = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

// Tableau du classement compétitif (cote Elo, parties classées uniquement)
export function LeaderboardTable({ state, rows, titleId, placementGames = 5, skeletonRows = 0 }) {
    const { t, language } = useSiteI18n();
    const { user } = useDiscordAuth();

    return (
        <DataState
            status={state.status}
            isEmpty={rows.length === 0}
            loadingText={t('common.loading')}
            errorText={t('common.loadError')}
            emptyText={t('stats.emptyLeaderboard', { placement: placementGames })}
            skeletonRows={skeletonRows}
        >
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm" aria-labelledby={titleId}>
                    <thead>
                        <tr className="border-b border-site-line text-left text-xs text-site-soft">
                            <th scope="col" className="w-14 py-2 pr-2 font-semibold">{t('stats.rank')}</th>
                            <th scope="col" className="py-2 pr-2 font-semibold">{t('stats.player')}</th>
                            <th scope="col" className="hidden py-2 pr-2 text-right font-semibold sm:table-cell">{t('stats.rankedGames')}</th>
                            <th scope="col" className="py-2 pr-2 text-right font-semibold">{t('stats.wins')}</th>
                            <th scope="col" className="py-2 text-right font-semibold">{t('stats.rating')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((player) => {
                            const isMe = Boolean(user?.username) && player.username === user.username;
                            return (
                                <tr key={`${player.rank}-${player.username}`} className={`border-b border-site-line last:border-b-0 ${isMe ? 'bg-site-highlight' : ''}`}>
                                    <td className="py-2.5 pr-2">
                                        <span className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-extrabold ${player.rank === 1 ? 'bg-brand-yellow text-brand-ink' : 'bg-site-tint text-site-muted'}`}>
                                            {player.rank}
                                        </span>
                                    </td>
                                    <td className="py-2.5 pr-2">
                                        <span className="flex min-w-0 items-center gap-2.5">
                                            <Avatar src={player.avatar} name={player.username} size={26} />
                                            <span className="truncate font-semibold">
                                                {player.username}
                                                {isMe && <span className="ml-1 text-xs font-normal text-site-muted">({t('common.you')})</span>}
                                            </span>
                                        </span>
                                    </td>
                                    <td className="hidden py-2.5 pr-2 text-right tabular-nums sm:table-cell">{formatNumber(language, player.rankedGames)}</td>
                                    <td className="py-2.5 pr-2 text-right tabular-nums">{formatNumber(language, player.wins)}</td>
                                    <td className="py-2.5 text-right font-bold tabular-nums">{formatNumber(language, player.rating)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </DataState>
    );
}

// Explication du classement, affichée sur la page Classements
export function RankingExplainer({ config }) {
    const { t } = useSiteI18n();
    const values = {
        players: config?.minDiscordPlayers ?? 2,
        rounds: config?.minRounds ?? 5,
        start: config?.startRating ?? 1000,
        placement: config?.placementGames ?? 5,
    };

    return (
        <details className="group rounded-xl border border-site-line bg-site-surface">
            <summary className="flex min-h-[2.75rem] cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-base font-bold">
                {t('stats.howTitle')}
                <Icon name="chevron-down" size={18} className="shrink-0 text-site-soft transition-transform group-open:rotate-180" />
            </summary>
            <ol className="flex flex-col gap-2.5 px-5 pb-5 text-sm text-site-muted">
                {['stats.how1', 'stats.how2', 'stats.how3', 'stats.how4'].map((key, index) => (
                    <li key={key} className="flex gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-site-tint text-[11px] font-extrabold text-site-ink">
                            {index + 1}
                        </span>
                        <span>{t(key, values)}</span>
                    </li>
                ))}
            </ol>
        </details>
    );
}

// Chiffres clés sous forme de liste de définitions
export function Figures({ items }) {
    return (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            {items.map((item) => (
                <div key={item.label} className="flex flex-col-reverse border-t border-site-line pt-3">
                    <dt className="text-xs text-site-muted">{item.label}</dt>
                    <dd className="text-2xl font-bold tabular-nums">{item.value}</dd>
                </div>
            ))}
        </dl>
    );
}

// Barres horizontales : nom, barre, pourcentage
export function RateBars({ items }) {
    return (
        <ul className="flex flex-col gap-2.5">
            {items.map((item) => {
                const rate = clampRate(item.rate);
                return (
                    <li key={item.key || item.label} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_2.75rem] items-center gap-3 text-sm">
                        <span className="truncate font-semibold" title={item.label}>{item.label}</span>
                        <span className="relative h-2 overflow-hidden rounded-full bg-site-tint" aria-hidden="true">
                            <span className="absolute inset-y-0 left-0 rounded-full bg-site-ink" style={{ width: `${rate}%` }} />
                        </span>
                        <span className="text-right tabular-nums text-site-muted">{rate} %</span>
                    </li>
                );
            })}
        </ul>
    );
}

// Liste complète des artistes avec recherche et repli
export function ArtistList({ state, artists, title, help, titleId }) {
    const { t, language } = useSiteI18n();
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState(false);

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return needle ? artists.filter((artist) => artist.name.toLowerCase().includes(needle)) : artists;
    }, [artists, query]);

    const visible = expanded || query ? filtered : filtered.slice(0, 12);

    return (
        <section aria-labelledby={titleId}>
            <SectionTitle id={titleId} aside={help}>{title}</SectionTitle>
            <DataState
                status={state.status}
                isEmpty={artists.length === 0}
                loadingText={t('common.loading')}
                errorText={t('common.loadError')}
                emptyText={t('stats.noData')}
            >
                <div className="mb-4 flex max-w-sm items-center gap-2 rounded-lg border border-site-line bg-site-surface px-3 focus-within:outline focus-within:outline-2 focus-within:outline-site-ink">
                    <Icon name="search" size={16} className="text-site-soft" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t('stats.searchArtist')}
                        aria-label={t('stats.searchArtist')}
                        className="min-w-0 flex-1 bg-transparent py-2 text-sm text-site-ink placeholder:text-site-soft focus:outline-none"
                    />
                </div>

                {filtered.length === 0 ? (
                    <p className="text-sm text-site-muted">{t('stats.noMatch')}</p>
                ) : (
                    <ol className="grid gap-x-8 sm:grid-cols-2">
                        {visible.map((artist) => {
                            const rate = clampRate(artist.successRate);
                            return (
                                <li key={artist.name} className="flex items-center gap-3 border-b border-site-line py-2 text-sm">
                                    <span className="min-w-0 flex-1 truncate font-semibold">{artist.name}</span>
                                    <span className="hidden text-xs text-site-soft sm:inline">
                                        {t('stats.roundsCount', { count: formatNumber(language, artist.rounds) })}
                                    </span>
                                    <span className="w-12 text-right font-bold tabular-nums">{rate} %</span>
                                </li>
                            );
                        })}
                    </ol>
                )}

                {!query && filtered.length > 12 && (
                    <button
                        type="button"
                        onClick={() => setExpanded((value) => !value)}
                        className="mt-4 text-sm font-semibold underline decoration-brand-yellow decoration-2 underline-offset-4 hover:decoration-site-ink"
                    >
                        {expanded ? t('stats.showLess') : t('stats.showAll', { count: filtered.length })}
                    </button>
                )}
            </DataState>
        </section>
    );
}

export { clampRate };