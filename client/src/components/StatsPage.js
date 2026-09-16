import React, { useState } from 'react';
import SEO from './SEO';
import SiteShell from './site/SiteShell';
import { DataState, PageContainer, PageHeader, Segmented, SectionTitle } from './site/SiteUI';
import useUrlTab from '../hooks/useUrlTab.js';
import { ArtistList, Figures, LeaderboardTable, RankingExplainer, RateBars } from './stats/StatsBlocks';
import { useSiteI18n, formatNumber } from '../utils/siteI18n';
import { useApi } from '../utils/useApi';

const LEADERBOARD_LIMIT = 15;
const GAME_TABS = ['blindtest', 'buzzer', 'all'];

const toArtistBars = (list = []) => list.map((item) => ({ key: item.name, label: item.name, rate: item.successRate }));

// Bloc classement compétitif commun aux trois onglets
function RankingSection({ game, titleId }) {
    const { t } = useSiteI18n();
    const ranking = useApi(`/api/ranking?game=${game}&limit=${LEADERBOARD_LIMIT}`);

    return (
        <section>
            <SectionTitle id={titleId} aside={t('stats.sortNote')}>{t('stats.leaderboard')}</SectionTitle>
            <LeaderboardTable
                state={ranking}
                rows={ranking.data?.leaderboard || []}
                titleId={titleId}
                placementGames={ranking.data?.config?.placementGames}
                skeletonRows={LEADERBOARD_LIMIT}
            />
            <div className="mt-6">
                <RankingExplainer config={ranking.data?.config} />
            </div>
        </section>
    );
}

function BlindTestStats() {
    const { t, language } = useSiteI18n();
    const general = useApi('/api/stats/general');
    const rounds = useApi('/api/stats/rounds');
    const hardest = useApi('/api/stats/artists?type=hardest&limit=5');
    const easiest = useApi('/api/stats/artists?type=easiest&limit=5');
    const allArtists = useApi('/api/stats/artists?type=all');

    const figures = general.data?.stats;
    const levelRows = (rounds.data?.rounds || []).map((row) => ({
        key: row.level,
        label: t('stats.level', { level: row.level }),
        rate: row.success_rate,
    }));

    return (
        <div className="flex flex-col gap-12">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
                <RankingSection game="blindtest" titleId="bt-leaderboard" />

                <div className="flex flex-col gap-10">
                    <section>
                        <SectionTitle>{t('stats.figures')}</SectionTitle>
                        <DataState status={general.status} isEmpty={!figures} loadingText={t('common.loading')} errorText={t('common.loadError')} emptyText={t('stats.noData')}>
                            {figures && (
                                <Figures
                                    items={[
                                        { label: t('stats.players'), value: formatNumber(language, figures.uniquePlayers) },
                                        { label: t('stats.rounds'), value: formatNumber(language, figures.totalRoundsPlayed) },
                                        { label: t('stats.answers'), value: formatNumber(language, figures.totalAnswers) },
                                        { label: t('stats.successRate'), value: `${Math.round(figures.globalSuccessRate || 0)} %` },
                                    ]}
                                />
                            )}
                        </DataState>
                    </section>

                    <section>
                        <SectionTitle aside={t('stats.levelsHelp')}>{t('stats.levels')}</SectionTitle>
                        <DataState status={rounds.status} isEmpty={levelRows.length === 0} loadingText={t('common.loading')} errorText={t('common.loadError')} emptyText={t('stats.noData')}>
                            <RateBars items={levelRows} />
                        </DataState>
                    </section>
                </div>
            </div>

            <div className="grid gap-10 md:grid-cols-2 md:gap-12">
                <section>
                    <SectionTitle>{t('stats.hardest')}</SectionTitle>
                    <DataState status={hardest.status} isEmpty={!hardest.data?.artists?.length} loadingText={t('common.loading')} errorText={t('common.loadError')} emptyText={t('stats.noData')}>
                        <RateBars items={toArtistBars(hardest.data?.artists)} />
                    </DataState>
                </section>
                <section>
                    <SectionTitle>{t('stats.easiest')}</SectionTitle>
                    <DataState status={easiest.status} isEmpty={!easiest.data?.artists?.length} loadingText={t('common.loading')} errorText={t('common.loadError')} emptyText={t('stats.noData')}>
                        <RateBars items={toArtistBars(easiest.data?.artists)} />
                    </DataState>
                </section>
            </div>

            <ArtistList
                state={allArtists}
                artists={allArtists.data?.artists || []}
                title={t('stats.allArtists')}
                help={t('stats.helpBlindtest')}
                titleId="bt-all-artists"
            />
        </div>
    );
}

function BuzzerStats() {
    const { t, language } = useSiteI18n();
    // Une seule valeur, encodée « type:valeur » : le select est toujours là,
    // donc plus de saut de mise en page quand on change de type de filtre.
    const [filter, setFilter] = useState('all');

    const filters = useApi('/api/stats/buzzer/filters');
    const countries = filters.data?.countries || [];
    const events = filters.data?.events || [];

    const [filterType, filterValue] = filter === 'all' ? ['all', ''] : filter.split(/:(.*)/s);

    const filterParams = filterType !== 'all' && filterValue
        ? `&filter=${filterType}&filterValue=${encodeURIComponent(filterValue)}`
        : '';

    const general = useApi('/api/stats/buzzer/general');
    const hardest = useApi(`/api/stats/buzzer/beatboxers?type=hardest&limit=5${filterParams}`);
    const easiest = useApi(`/api/stats/buzzer/beatboxers?type=easiest&limit=5${filterParams}`);
    const allBeatboxers = useApi(`/api/stats/buzzer/beatboxers?type=all${filterParams}`);

    const figures = general.data?.stats;
    const successRate = figures && figures.totalAnswers > 0
        ? Math.round((figures.correctAnswers / figures.totalAnswers) * 100)
        : 0;

    const beatboxerRows = (list = []) => list.map((item) => ({
        name: item.name,
        successRate: item.successRate,
        rounds: item.totalRounds,
    }));

    return (
        <div className="flex flex-col gap-12">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
                <RankingSection game="buzzer" titleId="bz-leaderboard" />

                <section>
                    <SectionTitle>{t('stats.figures')}</SectionTitle>
                    <DataState status={general.status} isEmpty={!figures} loadingText={t('common.loading')} errorText={t('common.loadError')} emptyText={t('stats.noData')}>
                        {figures && (
                            <Figures
                                items={[
                                    { label: t('stats.players'), value: formatNumber(language, figures.uniquePlayers) },
                                    { label: t('stats.rounds'), value: formatNumber(language, figures.totalRounds) },
                                    { label: t('stats.successRate'), value: `${successRate} %` },
                                    { label: t('stats.reaction'), value: `${formatNumber(language, figures.averageReactionTime)} ms` },
                                ]}
                            />
                        )}
                    </DataState>
                </section>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    aria-label={t('stats.filterLabel')}
                    disabled={filters.status !== 'ready'}
                    className="min-h-[2.75rem] min-w-[14rem] rounded-lg border border-site-line bg-site-surface px-3 py-2 text-sm font-semibold text-site-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-site-ink disabled:opacity-60"
                >
                    <option value="all">{t('stats.filterEveryone')}</option>
                    {countries.length > 0 && (
                        <optgroup label={t('stats.groupCountries')}>
                            {countries.map((country) => (
                                <option key={`country:${country}`} value={`country:${country}`}>{country}</option>
                            ))}
                        </optgroup>
                    )}
                    {events.length > 0 && (
                        <optgroup label={t('stats.groupEvents')}>
                            {events.map((event) => (
                                <option key={`event:${event}`} value={`event:${event}`}>{event}</option>
                            ))}
                        </optgroup>
                    )}
                </select>
                <p className="w-full text-xs text-site-soft sm:w-auto">{t('stats.filterNote')}</p>
            </div>

            <div className="grid gap-10 md:grid-cols-2 md:gap-12">
                <section>
                    <SectionTitle>{t('stats.hardest')}</SectionTitle>
                    <DataState status={hardest.status} isEmpty={!hardest.data?.beatboxers?.length} loadingText={t('common.loading')} errorText={t('common.loadError')} emptyText={t('stats.noData')}>
                        <RateBars items={toArtistBars(hardest.data?.beatboxers)} />
                    </DataState>
                </section>
                <section>
                    <SectionTitle>{t('stats.easiest')}</SectionTitle>
                    <DataState status={easiest.status} isEmpty={!easiest.data?.beatboxers?.length} loadingText={t('common.loading')} errorText={t('common.loadError')} emptyText={t('stats.noData')}>
                        <RateBars items={toArtistBars(easiest.data?.beatboxers)} />
                    </DataState>
                </section>
            </div>

            <ArtistList
                state={allBeatboxers}
                artists={beatboxerRows(allBeatboxers.data?.beatboxers)}
                title={t('stats.allBeatboxers')}
                help={t('stats.helpBuzzer')}
                titleId="bz-all-beatboxers"
            />
        </div>
    );
}

function AllGamesStats() {
    return (
        <div className="max-w-3xl">
            <RankingSection game="all" titleId="all-leaderboard" />
        </div>
    );
}

function StatsContent() {
    const { t } = useSiteI18n();
    // L'onglet vit dans l'URL : le bouton retour et le partage d'un lien fonctionnent
    const [game, setGame] = useUrlTab('game', GAME_TABS, 'blindtest');

    return (
        <>
            <SEO title={t('stats.seoTitle')} description={t('stats.seoDescription')} url="https://beatboxgames.com/#/stats" />
            <PageContainer>
                <PageHeader title={t('stats.title')} intro={t('stats.intro')}>
                    <Segmented
                        label={t('stats.gameTabs')}
                        value={game}
                        onChange={setGame}
                        options={[
                            { id: 'blindtest', label: t('games.blindtest.name') },
                            { id: 'buzzer', label: t('games.buzzer.name') },
                            { id: 'all', label: t('games.all') },
                        ]}
                    />
                </PageHeader>

                <div className="mt-10">
                    {game === 'blindtest' && <BlindTestStats />}
                    {game === 'buzzer' && <BuzzerStats />}
                    {game === 'all' && <AllGamesStats />}
                </div>
            </PageContainer>
        </>
    );
}

function StatsPage() {
    return (
        <SiteShell>
            <StatsContent />
        </SiteShell>
    );
}

export default StatsPage;