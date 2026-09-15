import React, { useState, useEffect } from 'react';
import { useI18n } from '../utils/i18n';
import SEO from './SEO';

function StatsPage() {
    const { t, language, switchLanguage, isEnglish } = useI18n();

    // Navigation principale
    const [activeMainTab, setActiveMainTab] = useState('leaderboards');
    const [activeGameMode, setActiveGameMode] = useState('all');
    const [activeCategory, setActiveCategory] = useState('all'); // 'all', 'full_roster', 'selection'
    const [buzzerFilterType, setBuzzerFilterType] = useState('all'); // 'all', 'country', 'event'
    const [buzzerFilterValue, setBuzzerFilterValue] = useState('');
    const [timeFilter, setTimeFilter] = useState('all');

    // États de données
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [globalStats, setGlobalStats] = useState({});
    const [blindTestData, setBlindTestData] = useState({});
    const [buzzerData, setBuzzerData] = useState({});
    const [leaderboards, setLeaderboards] = useState({});
    const [categorizedLeaderboard, setCategorizedLeaderboard] = useState([]);
    const [categoryInfo, setCategoryInfo] = useState({});

    // ✅ CORRECTION : Ajouter activeMainTab dans les dépendances
    useEffect(() => {
        loadAllData();
    }, [activeMainTab, activeGameMode, activeCategory, timeFilter, buzzerFilterType, buzzerFilterValue]);

    // ✅ Réinitialiser les filtres Buzzer quand on quitte l'onglet Classements
    useEffect(() => {
        if (activeMainTab !== 'leaderboards') {
            setBuzzerFilterType('all');
            setBuzzerFilterValue('');
        }
    }, [activeMainTab]);

    const loadAllData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Charger toutes les données en parallèle
            const requests = [
                fetch('/api/stats/general'),
                fetch('/api/stats/artists?type=easiest&limit=5'),
                fetch('/api/stats/artists?type=hardest&limit=5'),
                fetch('/api/stats/artists?type=all'),
                fetch('/api/stats/leaderboard/blindtest?limit=10'),
                fetch('/api/stats/rounds'),
                fetch(`/api/stats/leaderboard/categories?gameMode=${activeGameMode}&category=${activeCategory}&limit=15`),
                fetch(`/api/stats/categories/info?gameMode=${activeGameMode}`)
            ];

            // ✅ Ajouter les requêtes Buzzer si nécessaire
            if (activeGameMode === 'buzzer' || activeMainTab === 'buzzer') {
                // ✅ Construire l'URL du leaderboard avec les filtres
                // Pas de filtres si on est sur l'onglet Buzzer Battle
                let leaderboardUrl = `/api/stats/buzzer/leaderboard?limit=15`;
                if (activeMainTab !== 'buzzer' && buzzerFilterType !== 'all' && buzzerFilterValue) {
                    leaderboardUrl += `&filter=${buzzerFilterType}&filterValue=${encodeURIComponent(buzzerFilterValue)}`;
                }

                // ✅ Build filter parameters for beatboxer requests
                // Pas de filtres si on est sur l'onglet Buzzer Battle
                let beatboxerFilterParams = '';
                if (activeMainTab !== 'buzzer' && buzzerFilterType !== 'all' && buzzerFilterValue) {
                    beatboxerFilterParams = `&filter=${buzzerFilterType}&filterValue=${encodeURIComponent(buzzerFilterValue)}`;
                }

                requests.push(
                    fetch('/api/stats/buzzer/general'),
                    fetch(`/api/stats/buzzer/beatboxers?type=easiest&limit=10${beatboxerFilterParams}`),
                    fetch(`/api/stats/buzzer/beatboxers?type=hardest&limit=10${beatboxerFilterParams}`),
                    fetch(`/api/stats/buzzer/beatboxers?type=all${beatboxerFilterParams}`),
                    fetch(leaderboardUrl),
                    fetch('/api/stats/buzzer/filters')
                );
            }

            const responses = await Promise.all(requests);

            if (responses.some(r => !r.ok)) {
                throw new Error(t('connectionError'));
            }

            // ✅ CORRECTION : Parser toutes les réponses en une seule fois
            const responseData = await Promise.all(responses.map(r => r.json()));

            // Séparer les données de base et les données buzzer
            const baseDataCount = 8;
            const [
                generalData,
                easiestData,
                hardestData,
                allArtistsData,
                leaderboardData,
                roundsData,
                categorizedLeaderboardData,
                categoryInfoData
            ] = responseData.slice(0, baseDataCount);

            // Organiser les données de base
            setGlobalStats(generalData.stats);
            setBlindTestData({
                easiest: easiestData.artists,
                hardest: hardestData.artists,
                all: allArtistsData.artists,
                rounds: roundsData.rounds
            });
            setCategorizedLeaderboard(categorizedLeaderboardData.leaderboard || []);
            setCategoryInfo(categoryInfoData.categories || {});

            // ✅ Traiter les données Buzzer si disponibles
            if ((activeGameMode === 'buzzer' || activeMainTab === 'buzzer') && responseData.length > baseDataCount) {
                const [
                    buzzerGeneralData,
                    buzzerEasiestData,
                    buzzerHardestData,
                    buzzerAllData,
                    buzzerLeaderboardData,
                    buzzerFiltersData
                ] = responseData.slice(baseDataCount);

                setBuzzerData({
                    easiest: buzzerEasiestData.beatboxers || [],
                    hardest: buzzerHardestData.beatboxers || [],
                    all: buzzerAllData.beatboxers || [],
                    leaderboard: buzzerLeaderboardData.leaderboard || [],
                    filters: buzzerFiltersData || { countries: [], events: [] },
                    stats: buzzerGeneralData.stats || {
                        totalMatches: 0,
                        totalPlayers: 0,
                        averageReactionTime: 0,
                        fastestBuzz: 0
                    }
                });

                // ✅ UN SEUL appel à setLeaderboards avec toutes les données
                setLeaderboards({
                    blindtest: leaderboardData.leaderboard,
                    buzzer: buzzerLeaderboardData.leaderboard || [],
                    global: leaderboardData.leaderboard
                });
            } else {
                setBuzzerData({
                    easiest: [],
                    hardest: [],
                    all: [],
                    leaderboard: [],
                    filters: { countries: [], events: [] },
                    stats: {
                        totalMatches: 0,
                        totalPlayers: 0,
                        averageReactionTime: 0,
                        fastestBuzz: 0
                    }
                });

                // ✅ Leaderboards sans données buzzer
                setLeaderboards({
                    blindtest: leaderboardData.leaderboard,
                    buzzer: [],
                    global: leaderboardData.leaderboard
                });
            }
            // ✅ Debug après traitement
            console.log('🔍 DEBUG après traitement buzzer:', {
                activeMainTab,
                activeGameMode,
                buzzerDataStats: buzzerData.stats,
                buzzerLeaderboardLength: buzzerData.leaderboard?.length || 0,
                leaderboardsBuzzerLength: leaderboards.buzzer?.length || 0
            });
            setCategorizedLeaderboard(categorizedLeaderboardData.leaderboard || []);
            setCategoryInfo(categoryInfoData.categories || {});

        } catch (err) {
            console.error('Erreur chargement stats:', err);
            setError(t('connectionError'));
        } finally {
            setLoading(false);
        }
    };

    const handleGoBack = () => {
        window.location.href = '/';
    };

    const getSuccessRateColor = (rate) => {
        if (rate >= 80) return 'text-green-400';
        if (rate >= 60) return 'text-yellow-400';
        if (rate >= 40) return 'text-orange-400';
        return 'text-red-400';
    };

    // ✅ Fonction pour obtenir l'info de catégorie
    const getCategoryInfo = () => {
        if (activeCategory === 'all') return null;
        if (activeCategory === 'full_roster') {
            return {
                name: t('allArtists'),
                icon: '📋',
                color: 'text-blue-400',
                bgColor: 'bg-blue-500/10 border-blue-400/30'
            };
        }
        if (activeCategory === 'selection') {
            return {
                name: t('artistSelection'),
                icon: '🎲',
                color: 'text-purple-400',
                bgColor: 'bg-purple-500/10 border-purple-400/30'
            };
        }
        return null;
    };

    const modernCard = "bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/50 rounded-2xl shadow-2xl";

    // Composant pour les métriques principales
    const MetricCard = ({ icon, value, label, color = "blue", trend = null }) => (
        <div className={`bg-gradient-to-br from-${color}-500/20 to-${color}-600/20 border border-${color}-400/30 rounded-xl p-6 text-center transition-all duration-300 hover:scale-105`}>
            <div className="text-4xl mb-4">{icon}</div>
            <h3 className={`text-2xl font-bold text-${color}-400 mb-2`}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </h3>
            <p className="text-zinc-300 text-sm">{label}</p>
            {trend && (
                <div className={`text-xs mt-2 ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trend > 0 ? '↗️' : '↘️'} {Math.abs(trend)}%
                </div>
            )}
        </div>
    );

    // Composant pour les filtres
    const FilterBar = () => (
        <div className="bg-zinc-800/50 rounded-xl p-4 mb-6">
            <div className="flex flex-wrap gap-4 items-center justify-between">
                {/* Sélecteur de mode de jeu - seulement dans l'onglet leaderboards */}
                {activeMainTab === 'leaderboards' && (
                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                        <span className="text-zinc-400 text-sm self-center mr-2">{isEnglish ? 'Game Mode:' : 'Mode de Jeu:'}</span>
                        {[
                            { key: 'all', label: isEnglish ? 'All Games' : 'Tous les jeux', icon: '🎮' },
                            { key: 'blindtest', label: 'Blind Test', icon: '🎵' },
                            { key: 'buzzer', label: 'Buzzer Battle', icon: '⚡' }
                        ].map(mode => (
                            <button
                                key={mode.key}
                                onClick={() => setActiveGameMode(mode.key)}
                                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${activeGameMode === mode.key
                                    ? 'bg-cyan-500 text-white shadow-lg'
                                    : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50'
                                    }`}
                            >
                                {mode.icon} {mode.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Filtres par catégorie d'artistes - seulement pour leaderboards et blindtest */}
                {/* ✅ Filtres par mode de jeu - seulement sur l'onglet Overview */}
                {activeMainTab === 'overview' && (
                    <div className="flex flex-wrap gap-2">
                        <span className="text-zinc-400 text-sm mr-2">{t('gameMode')}:</span>
                        {[
                            { key: 'all', label: isEnglish ? 'All modes' : 'Tous les modes', icon: '🎮' },
                            { key: 'blindtest', label: t('blindTestGame'), icon: '🎵' },
                            { key: 'buzzer', label: t('buzzerGame'), icon: '⚡' }
                        ].map(mode => (
                            <button
                                key={mode.key}
                                onClick={() => setActiveGameMode(mode.key)}
                                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${activeGameMode === mode.key
                                    ? 'bg-cyan-500 text-white shadow-lg'
                                    : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50'
                                    }`}
                            >
                                {mode.icon} {mode.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* ✅ Filtres par catégorie d'artistes - pour Blind Test uniquement */}
                {(activeMainTab === 'leaderboards' || activeMainTab === 'blindtest') &&
                    (activeGameMode === 'blindtest' || (activeGameMode === 'all' && activeMainTab !== 'buzzer')) && (
                        <div className="flex flex-wrap gap-2">
                            <span className="text-zinc-400 text-sm mr-2">{t('category')}:</span>
                            {[
                                {
                                    key: 'all',
                                    label: isEnglish ? 'All' : 'Toutes',
                                    icon: '🎯'
                                },
                                {
                                    key: 'full_roster',
                                    label: t('allArtists'),
                                    icon: '📋'
                                },
                                {
                                    key: 'selection',
                                    label: t('artistSelection'),
                                    icon: '🎲'
                                }
                            ].map(category => (
                                <button
                                    key={category.key}
                                    onClick={() => setActiveCategory(category.key)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${activeCategory === category.key
                                        ? 'bg-purple-500 text-white shadow-lg'
                                        : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50'
                                        }`}
                                >
                                    {category.icon} {category.label}
                                </button>
                            ))}
                        </div>
                    )}

                {/* ✅ NOUVEAUX : Filtres spécifiques au Buzzer Battle */}
                {activeMainTab === 'leaderboards' &&
                    (activeGameMode === 'buzzer' || (activeGameMode === 'all' && activeMainTab === 'buzzer')) && (
                        <div className="flex flex-wrap gap-4">
                            {/* Filtre par type */}
                            <div className="flex flex-wrap gap-2">
                                <span className="text-zinc-400 text-sm mr-2">{isEnglish ? 'Filter:' : 'Filtre:'}</span>
                                {[
                                    { key: 'all', label: isEnglish ? 'All' : 'Tous', icon: '🎯' },
                                    { key: 'country', label: isEnglish ? 'By Country' : 'Par Pays', icon: '🌍' },
                                    { key: 'event', label: isEnglish ? 'By Event' : 'Par Événement', icon: '🏆' }
                                ].map(filter => (
                                    <button
                                        key={filter.key}
                                        onClick={() => setBuzzerFilterType(filter.key)}
                                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${buzzerFilterType === filter.key
                                            ? 'bg-orange-500 text-white shadow-lg'
                                            : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50'
                                            }`}
                                    >
                                        {filter.icon} {filter.label}
                                    </button>
                                ))}
                            </div>

                            {/* Sélecteur de valeur */}
                            {buzzerFilterType !== 'all' && (
                                <div className="flex flex-wrap gap-2">
                                    <select
                                        value={buzzerFilterValue}
                                        onChange={(e) => setBuzzerFilterValue(e.target.value)}
                                        className="px-3 py-1 rounded-lg text-sm bg-zinc-700 text-white border border-zinc-600 focus:border-orange-400 focus:outline-none"
                                    >
                                        <option value="">{isEnglish ? 'Select...' : 'Sélectionner...'}</option>
                                        {buzzerFilterType === 'country' &&
                                            buzzerData.filters?.countries?.map(country => (
                                                <option key={country} value={country}>{country}</option>
                                            ))
                                        }
                                        {buzzerFilterType === 'event' &&
                                            buzzerData.filters?.events?.map(event => (
                                                <option key={event} value={event}>{event}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            )}

                            {/* Catégorie "Tous les artistes" vs "Sélection" pour le Buzzer */}
                            <div className="flex flex-wrap gap-2">
                                <span className="text-zinc-400 text-sm mr-2">{t('category')}:</span>
                                {[
                                    {
                                        key: 'all',
                                        label: isEnglish ? 'All' : 'Toutes',
                                        icon: '🎯'
                                    },
                                    {
                                        key: 'full_roster',
                                        label: t('allArtists'),
                                        icon: '📋'
                                    },
                                    {
                                        key: 'selection',
                                        label: t('artistSelection'),
                                        icon: '🎲'
                                    }
                                ].map(category => (
                                    <button
                                        key={category.key}
                                        onClick={() => setActiveCategory(category.key)}
                                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${activeCategory === category.key
                                            ? 'bg-purple-500 text-white shadow-lg'
                                            : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50'
                                            }`}
                                    >
                                        {category.icon} {category.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
            </div>
        </div>
    );

    // Onglet dédié au Blind Test
    const BlindTestTab = () => (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2">
                    🎵 {t('blindTestGame')} - {t('gameStatistics')}
                </h2>
                {/* ✅ Affichage de la catégorie active */}
                {/* {getCategoryInfo() && (
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${getCategoryInfo().bgColor} mb-4`}>
                        <span className="text-2xl">{getCategoryInfo().icon}</span>
                        <span className={`font-bold ${getCategoryInfo().color}`}>
                            {getCategoryInfo().name}
                        </span>
                    </div>
                )} */}
            </div>

            {/* Métriques principales Blind Test */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    icon="👥"
                    value={globalStats.uniquePlayers || 0}
                    label={isEnglish ? "Unique Players" : "Joueurs uniques"}
                    color="cyan"
                />
                <MetricCard
                    icon="📝"
                    value={globalStats.totalAnswers || 0}
                    label={isEnglish ? "Total Answers" : "Réponses totales"}
                    color="blue"
                />
                <MetricCard
                    icon="✅"
                    value={globalStats.correctAnswers || 0}
                    label={isEnglish ? "Correct Answers" : "Réponses justes"}
                    color="green"
                />
                <MetricCard
                    icon="❌"
                    value={globalStats.incorrectAnswers || 0}
                    label={isEnglish ? "Wrong Answers" : "Réponses fausses"}
                    color="red"
                />
            </div>

            {/* Statistiques par niveau */}
            <div className="bg-zinc-800/30 rounded-xl p-6">
                <h3 className="text-xl font-bold text-blue-400 mb-4">📊 {t('gameStatistics')} - {isEnglish ? 'Levels' : 'Niveaux'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {blindTestData.rounds?.map((round) => (
                        <div key={round.level} className="bg-zinc-700/30 rounded-lg p-4 text-center">
                            <h4 className="font-bold text-white mb-2">{isEnglish ? 'Level' : 'Niveau'} {round.level}</h4>
                            <p className="text-2xl font-bold text-green-400 mb-1">{round.success_rate}%</p>
                            <p className="text-sm text-zinc-400">{round.total_attempts} {isEnglish ? 'attempts' : 'tentatives'}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top 5 Artistes faciles/difficiles */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Artistes les plus faciles */}
                {blindTestData.easiest?.length > 0 && (
                    <div className="bg-zinc-800/30 rounded-xl p-6">
                        <h3 className="text-xl font-bold text-green-400 mb-4">
                            🎯 {isEnglish ? 'Easiest Artists' : 'Artistes les plus faciles'}
                        </h3>
                        <div className="space-y-3">
                            {blindTestData.easiest.slice(0, 5).map((artist, index) => (
                                <div key={index} className="flex justify-between items-center p-3 bg-zinc-700/30 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-sm font-bold ${index < 3 ? 'text-green-400' : 'text-zinc-400'}`}>
                                            #{index + 1}
                                        </span>
                                        <span className="text-white">{artist.name}</span>
                                        <span className="text-xs text-zinc-400">({artist.totalAppearances} {isEnglish ? 'rounds' : 'manches'})</span>
                                    </div>
                                    <span className="font-bold text-green-400">{artist.successRate}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Artistes les plus difficiles */}
                {blindTestData.hardest?.length > 0 && (
                    <div className="bg-zinc-800/30 rounded-xl p-6">
                        <h3 className="text-xl font-bold text-red-400 mb-4">
                            🔥 {isEnglish ? 'Hardest Artists' : 'Artistes les plus difficiles'}
                        </h3>
                        <div className="space-y-3">
                            {blindTestData.hardest.slice(0, 5).map((artist, index) => (
                                <div key={index} className="flex justify-between items-center p-3 bg-zinc-700/30 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-sm font-bold ${index < 3 ? 'text-red-400' : 'text-zinc-400'}`}>
                                            #{index + 1}
                                        </span>
                                        <span className="text-white">{artist.name}</span>
                                        <span className="text-xs text-zinc-400">({artist.totalAppearances} {isEnglish ? 'rounds' : 'manches'})</span>
                                    </div>
                                    <span className="font-bold text-red-400">{artist.successRate}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Tous les artistes avec pagination/recherche */}
            <div className="bg-zinc-800/30 rounded-xl p-6">
                <h3 className="text-xl font-bold text-purple-400 mb-4">🎤 {t('allArtistsBySuccessRate')}</h3>
                <div className="max-h-80 overflow-y-auto space-y-2">
                    {blindTestData.all?.map((artist, index) => (
                        <div key={artist.name} className="flex items-center justify-between bg-zinc-700/30 rounded-lg p-3">
                            <div className="flex items-center space-x-3">
                                <span className={`text-sm font-bold ${index < 10 ? 'text-cyan-400' : 'text-zinc-400'}`}>
                                    #{index + 1}
                                </span>
                                <span className="text-white">{artist.name}</span>
                                <span className="text-xs text-zinc-400">
                                    ({artist.totalAppearances || artist.rounds || 0} {isEnglish ? 'rounds played' : 'manches jouées'})
                                </span>
                            </div>
                            <span className={`font-bold ${getSuccessRateColor(artist.difficultyScore || artist.successRate)}`}>
                                {artist.difficultyScore || artist.successRate}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    // ✅ Nouvel onglet Buzzer Battle
    const BuzzerTab = () => {
        const buzzerLeaderboard = leaderboards.buzzer || [];
        const hasData = buzzerData.stats?.totalMatches > 0 || buzzerData.easiest?.length > 0 || buzzerData.hardest?.length > 0 || buzzerData.all?.length > 0;

        console.log('🔍 DEBUG BuzzerTab hasData:', {
            totalMatches: buzzerData.stats?.totalMatches,
            easiestLength: buzzerData.easiest?.length,
            hardestLength: buzzerData.hardest?.length,
            allLength: buzzerData.all?.length,
            hasData
        });

        return (
            <div className="space-y-8">
                <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent mb-6 text-center">
                    🔔 {t('buzzerGame')} - {t('gameStatistics')}
                </h2>

                {/* Métriques Buzzer - Première ligne */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <MetricCard
                        icon="👥"
                        value={buzzerData.stats?.uniquePlayers || 0}
                        label={isEnglish ? "Unique Players" : "Joueurs uniques"}
                        color="cyan"
                    />
                    <MetricCard
                        icon="📝"
                        value={buzzerData.stats?.totalAnswers || 0}
                        label={isEnglish ? "Total Answers" : "Réponses totales"}
                        color="blue"
                    />
                    <MetricCard
                        icon="✅"
                        value={buzzerData.stats?.correctAnswers || 0}
                        label={isEnglish ? "Correct Answers" : "Réponses justes"}
                        color="green"
                    />
                    <MetricCard
                        icon="❌"
                        value={buzzerData.stats?.incorrectAnswers || 0}
                        label={isEnglish ? "Wrong Answers" : "Réponses fausses"}
                        color="red"
                    />
                </div>

                {/* Métriques Buzzer - Deuxième ligne (temps de réaction) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MetricCard
                        icon="⏱️"
                        value={buzzerData.stats?.averageReactionTime ? `${buzzerData.stats.averageReactionTime}ms` : '0ms'}
                        label={isEnglish ? "Average Reaction Time" : "Temps de réaction moyen"}
                        color="yellow"
                    />
                </div>

                {/* ✅ Affichage conditionnel basé sur la disponibilité des données */}
                {hasData ? (
                    <div className="space-y-8">
                        {/* Statistiques par artistes en grille */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Beatboxers les plus faciles */}
                            {buzzerData.easiest?.length > 0 && (
                                <div className="bg-zinc-800/30 rounded-xl p-6">
                                    <h3 className="text-xl font-bold text-green-400 mb-4">
                                        🎯 {isEnglish ? 'Easiest Beatboxers' : 'Beatboxers les plus faciles'}
                                    </h3>
                                    <div className="space-y-3">
                                        {buzzerData.easiest.slice(0, 10).map((beatboxer, index) => (
                                            <div key={index} className="flex justify-between items-center p-3 bg-zinc-700/30 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-sm font-bold ${index < 3 ? 'text-green-400' : 'text-zinc-400'}`}>
                                                        #{index + 1}
                                                    </span>
                                                    <span className="text-white">{beatboxer.name}</span>
                                                    <span className="text-xs text-zinc-400">
                                                        ({beatboxer.totalAppearances || beatboxer.attempts} {isEnglish ? 'rounds' : 'manches'})
                                                    </span>
                                                </div>
                                                <span className="font-bold text-green-400">
                                                    {beatboxer.successRate}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Beatboxers les plus difficiles */}
                            {buzzerData.hardest?.length > 0 && (
                                <div className="bg-zinc-800/30 rounded-xl p-6">
                                    <h3 className="text-xl font-bold text-red-400 mb-4">
                                        🔥 {isEnglish ? 'Hardest Beatboxers' : 'Beatboxers les plus difficiles'}
                                    </h3>
                                    <div className="space-y-3">
                                        {buzzerData.hardest.slice(0, 10).map((beatboxer, index) => (
                                            <div key={index} className="flex justify-between items-center p-3 bg-zinc-700/30 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-sm font-bold ${index < 3 ? 'text-red-400' : 'text-zinc-400'}`}>
                                                        #{index + 1}
                                                    </span>
                                                    <span className="text-white">{beatboxer.name}</span>
                                                    <span className="text-xs text-zinc-400">
                                                        ({beatboxer.totalAppearances || beatboxer.attempts} {isEnglish ? 'rounds' : 'manches'})
                                                    </span>
                                                </div>
                                                <span className="font-bold text-red-400">
                                                    {beatboxer.successRate}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tous les beatboxers avec taux de réussite */}
                        <div className="bg-zinc-800/30 rounded-xl p-6">
                            <h3 className="text-xl font-bold text-purple-400 mb-4">
                                🎤 {isEnglish ? 'All Beatboxers by Success Rate' : 'Tous les Beatboxers par Taux de Réussite'}
                            </h3>
                            <div className="max-h-80 overflow-y-auto space-y-2">
                                {/* Utiliser une nouvelle API call pour obtenir tous les beatboxers */}
                                {buzzerData.all?.map((beatboxer, index) => (
                                    <div key={beatboxer.name} className="flex items-center justify-between bg-zinc-700/30 rounded-lg p-3">
                                        <div className="flex items-center space-x-3">
                                            <span className={`text-sm font-bold ${index < 1000 ? 'text-cyan-400' : 'text-zinc-400'}`}>
                                                #{index + 1}
                                            </span>
                                            <span className="text-white">{beatboxer.name}</span>
                                            <span className="text-xs text-zinc-400">
                                                ({beatboxer.totalAppearances || beatboxer.attempts} {isEnglish ? 'rounds' : 'manches'})
                                            </span>
                                        </div>
                                        <span className={`font-bold ${getSuccessRateColor(beatboxer.successRate)}`}>
                                            {beatboxer.successRate}%
                                        </span>
                                    </div>
                                )) || (
                                        <div className="text-center py-8 text-zinc-400">
                                            <p>{isEnglish ? 'No beatboxer data available yet' : 'Aucune donnée de beatboxer disponible'}</p>
                                        </div>
                                    )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-zinc-800/30 rounded-xl p-8 text-center">
                        <div className="text-6xl mb-4">⚡</div>
                        <h3 className="text-2xl font-bold text-white mb-4">{t('buzzerGame')}</h3>
                        <p className="text-zinc-400 text-lg mb-6">
                            {isEnglish
                                ? "No Buzzer Battle games played yet. Be the first to battle!"
                                : "Aucune partie Buzzer Battle jouée pour le moment. Soyez le premier à vous battre !"
                            }
                        </p>
                        <p className="text-zinc-500 text-sm">
                            {isEnglish
                                ? "Statistics will appear here once players start competing in Buzzer Battle mode."
                                : "Les statistiques apparaîtront ici une fois que les joueurs commenceront à jouer en mode Buzzer Battle."
                            }
                        </p>
                    </div>
                )}
            </div>
        );
    };

    // Onglet pour les leaderboards
    const LeaderboardsTab = () => (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent mb-2">
                    🏆 {t('leaderboard')}s
                </h2>

                {/* ✅ Badge de catégorie bien visible */}
                {getCategoryInfo() && (
                    <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-xl ${getCategoryInfo().bgColor} border-2 mb-6`}>
                        <span className="text-3xl">{getCategoryInfo().icon}</span>
                        <div className="text-left">
                            <div className={`font-bold text-lg ${getCategoryInfo().color}`}>
                                {getCategoryInfo().name}
                            </div>
                            <div className="text-sm text-zinc-400">
                                {activeCategory === 'full_roster' ? t('gamesWithAllArtists') :
                                    activeCategory === 'selection' ? 'Parties avec sélection d\'artistes' : ''}
                            </div>
                        </div>
                    </div>
                )}

                {/* Badge de filtre Buzzer actif */}
                {activeGameMode === 'buzzer' && buzzerFilterType !== 'all' && buzzerFilterValue && (
                    <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-orange-500/10 border-2 border-orange-400/30 mb-6">
                        <span className="text-2xl">🔍</span>
                        <div className="text-left">
                            <div className="font-bold text-lg text-orange-400">
                                {buzzerFilterType === 'country' ? (isEnglish ? 'Filtered by Country' : 'Filtré par Pays') : (isEnglish ? 'Filtered by Event' : 'Filtré par Événement')}
                            </div>
                            <div className="text-sm text-zinc-400">
                                {buzzerFilterValue}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Informations sur la catégorie */}
            {activeCategory !== 'all' && categoryInfo[activeCategory] && (
                <div className="bg-zinc-800/30 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-center gap-6 text-sm text-zinc-400">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">📊</span>
                            <span>{categoryInfo[activeCategory].games} parties</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-lg">👥</span>
                            <span>{categoryInfo[activeCategory].players} joueurs</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Leaderboard principal */}
            <div className="bg-zinc-800/30 rounded-xl p-6">
                <h3 className="text-xl font-bold text-yellow-400 mb-4">
                    🥇 {t('leaderboard')}
                    {activeGameMode === 'blindtest' && ` - ${t('blindTestGame')}`}
                    {activeGameMode === 'buzzer' && ` - ${t('buzzerGame')}`}
                </h3>

                {/* Afficher les données buzzer si mode buzzer, sinon categorizedLeaderboard */}
                {(activeGameMode === 'buzzer' ? buzzerData.leaderboard : categorizedLeaderboard)?.length > 0 ? (
                    <div className="space-y-4">
                        {(activeGameMode === 'buzzer' ? buzzerData.leaderboard : categorizedLeaderboard).map((player, index) => (
                            <div key={player.username} className="bg-zinc-700/50 border border-zinc-600/50 rounded-xl p-4 hover:bg-zinc-700/70 transition-all duration-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className={`text-2xl font-bold ${index === 0 ? 'text-yellow-400' :
                                            index === 1 ? 'text-gray-300' :
                                                index === 2 ? 'text-orange-400' : 'text-zinc-400'
                                            }`}>
                                            #{player.rank}
                                        </div>
                                        {player.avatar && (
                                            <img
                                                src={player.avatar}
                                                alt={player.username}
                                                className="w-12 h-12 rounded-full border-2 border-zinc-600"
                                            />
                                        )}
                                        <div>
                                            <h4 className="text-lg font-bold text-white">{player.username}</h4>
                                            <p className="text-sm text-zinc-400">
                                                {player.totalGames} {t('games')} • {player.winRate}% {t('winRate').toLowerCase()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-yellow-400 flex items-center gap-1">
                                            <span className="text-lg">👑</span>
                                            {player.wins} {t('wins')}
                                        </div>
                                        <div className="text-sm text-zinc-400">
                                            {player.totalPoints?.toLocaleString() || 0} {t('points')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">🏆</div>
                        <p className="text-zinc-400 text-lg">{t('noLeaderboard')}</p>
                        {activeCategory !== 'all' && (
                            <p className="text-zinc-500 text-sm mt-2">
                                {isEnglish
                                    ? "Try changing the category filter"
                                    : "Essayez de changer le filtre de catégorie"
                                }
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            <SEO
                title={t('seoStats.title')}
                description={t('seoStats.description')}
                keywords={t('seoStats.keywords')}
            />
            <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 relative overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-purple-500/5 to-pink-500/5"></div>
                <div className="absolute top-0 left-0 w-full h-full">
                    <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
                </div>

                {/* Language Switcher */}
                <div className="absolute top-4 right-4 z-50">
                    <div className="flex gap-2">
                        <button
                            onClick={() => switchLanguage('fr')}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${!isEnglish
                                ? 'bg-cyan-500 text-white shadow-lg'
                                : 'text-zinc-300 hover:text-white hover:bg-zinc-700/50'
                                }`}
                        >
                            🇫🇷 FR
                        </button>
                        <button
                            onClick={() => switchLanguage('en')}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${isEnglish
                                ? 'bg-cyan-500 text-white shadow-lg'
                                : 'text-zinc-300 hover:text-white hover:bg-zinc-700/50'
                                }`}
                        >
                            🇺🇸 EN
                        </button>
                    </div>
                </div>

                <div className="flex flex-col min-h-screen px-4 relative z-10">
                    {/* Header */}
                    <div className="flex-shrink-0 py-8">
                        <div className="max-w-6xl mx-auto">
                            <button
                                onClick={handleGoBack}
                                className="mb-6 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
                            >
                                {t('backToHub')}
                            </button>

                            <div className="text-center">
                                <div className="flex items-center justify-center gap-4 mb-6">
                                    <span className="text-5xl animate-bounce">📊</span>
                                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                        {t('gameStats')}
                                    </h1>
                                    <span className="text-5xl animate-bounce delay-300">📈</span>
                                </div>
                                <p className="text-lg md:text-xl text-zinc-300 max-w-3xl mx-auto">
                                    {t('statsDescription')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col py-8">
                        <div className={`${modernCard} p-6 md:p-8 max-w-6xl w-full mx-auto`}>
                            {loading && (
                                <div className="text-center py-12">
                                    <div className="animate-spin text-4xl mb-4">⏳</div>
                                    <p className="text-zinc-400 text-lg">{t('waitingForServer')}</p>
                                </div>
                            )}

                            {error && (
                                <div className="text-center py-12">
                                    <div className="text-4xl mb-4">❌</div>
                                    <p className="text-red-400 text-lg mb-4">{error}</p>
                                    <button
                                        onClick={loadAllData}
                                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg transition-colors"
                                    >
                                        {t('reconnecting')}
                                    </button>
                                </div>
                            )}

                            {!loading && !error && (
                                <>
                                    {/* Navigation principale */}
                                    <div className="flex flex-wrap gap-2 mb-6 justify-center">
                                        {[
                                            { key: 'leaderboards', label: t('leaderboard') + 's', icon: '🏆' },
                                            { key: 'blindtest', label: t('blindTestGame'), icon: '🎵' },
                                            { key: 'buzzer', label: t('buzzerGame'), icon: '⚡' }
                                        ].map(tab => (
                                            <button
                                                key={tab.key}
                                                onClick={() => setActiveMainTab(tab.key)}
                                                className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${activeMainTab === tab.key
                                                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg'
                                                    : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50'
                                                    }`}
                                            >
                                                {tab.icon} {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Barre de filtres */}
                                    <FilterBar />

                                    {/* Contenu des onglets */}
                                    {activeMainTab === 'blindtest' && <BlindTestTab />}
                                    {activeMainTab === 'buzzer' && <BuzzerTab />}
                                    {activeMainTab === 'leaderboards' && <LeaderboardsTab />}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <footer className="flex-shrink-0 py-6">
                        <div className="text-center">
                            <p className="text-zinc-400 text-sm mb-2">
                                {t('madeBy')}
                            </p>
                            <div className="flex justify-center gap-4 text-xs text-zinc-500">
                                <a href="/#/privacy" className="hover:text-cyan-400 transition-colors">
                                    {t('hubPrivacyPolicy')}
                                </a>
                                <span>•</span>
                                <a href="/#/legal" className="hover:text-cyan-400 transition-colors">
                                    {t('hubLegalNotice')}
                                </a>
                            </div>
                        </div>
                    </footer>
                </div>
            </div>
        </>
    );
}

export default StatsPage;