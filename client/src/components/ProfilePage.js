import React, { useState, useEffect } from 'react';
import { useI18n } from '../utils/i18n';
import { useDiscordAuth } from '../utils/discordAuth';
import SEO from './SEO';
import RecentGamesPanel from './RecentGamesPanel';

function ProfilePage() {
    const { t, language, switchLanguage, isEnglish } = useI18n();
    const { isAuthenticated, user, loading, login, logout, deleteAccount, getAvatarUrl, updateStats, getLeaderboard, handleAuthCallback } = useDiscordAuth();
    const [stats, setStats] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [loadingStats, setLoadingStats] = useState(false);
    const [buzzerStats, setBuzzerStats] = useState(null);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
    const [selectedGame, setSelectedGame] = useState('blindtest');
    const [activeTab, setActiveTab] = useState('games'); // 'games' ou 'settings'
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [statsModalGame, setStatsModalGame] = useState(null);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [recentGames, setRecentGames] = useState([]);
    const [loadingRecentGames, setLoadingRecentGames] = useState(false);

    const API_BASE_URL = process.env.REACT_APP_API_URL ||
        (window.location.hostname === 'beatboxgames.com' || window.location.hostname === 'www.beatboxgames.com'
            ? 'https://beatboxgames.com'
            : window.location.hostname === 'dev.beatboxgames.com'
                ? 'https://dev.beatboxgames.com'
                : 'http://localhost:4000');

    // Gérer l'authentification depuis l'URL
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const token = urlParams.get('token');
        const success = urlParams.get('success');
        const error = urlParams.get('error');

        console.log('URL complète:', window.location.href);
        console.log('Token récupéré:', token?.substring(0, 20) + '...');
        console.log('Success flag:', success);

        if (token && success) {
            console.log('Tentative handleAuthCallback...');
            const result = handleAuthCallback(token);
            console.log('Résultat handleAuthCallback:', result);
            // Nettoyer l'URL
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash.split('?')[0]);
        } else if (error) {
            console.error('Erreur d\'authentification:', error);
        }
    }, [handleAuthCallback]);

    const loadBuzzerStats = async () => {
        try {
            const token = localStorage.getItem('discord_token');
            if (!token) {
                console.warn('⚠️ Pas de token Discord - Stats Buzzer non disponibles');
                return;
            }

            console.log('🔍 Chargement stats Buzzer depuis:', `${API_BASE_URL}/api/stats/me/buzzer`);

            const response = await fetch(`${API_BASE_URL}/api/stats/me/buzzer`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('📊 Réponse stats Buzzer:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Stats Buzzer chargées:', data);
                console.log('✅ Recent games buzzer:', data.recentGames);
                console.log('✅ ALL games:', data.allRecentGames);

                setBuzzerStats({
                    ...data.stats,
                    recentGames: data.recentGames || [],
                    allRecentGames: data.allRecentGames || [] // ✅ NOUVEAU
                });
            } else {
                const errorData = await response.json();
                console.error('❌ Erreur API stats Buzzer:', errorData);
            }
        } catch (error) {
            console.error('❌ Erreur chargement stats Buzzer:', error);
        }
    };

    // ✅ NOUVEAU : Charger les stats depuis la base de données
    useEffect(() => {
        if (isAuthenticated && user) {
            loadUserStats();
            loadBuzzerStats();
            loadLeaderboard();
            loadRecentGames();
        }
    }, [isAuthenticated, user]);

    const loadUserStats = async () => {
        setLoadingStats(true);
        try {
            const token = localStorage.getItem('discord_token');
            if (!token) {
                console.warn('⚠️ Pas de token Discord - Stats Blind Test non disponibles');
                return;
            }

            console.log('🔍 Chargement stats Blind Test depuis:', `${API_BASE_URL}/api/stats/me/blindtest`);

            const response = await fetch(`${API_BASE_URL}/api/stats/me/blindtest`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('📊 Réponse stats Blind Test:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Stats Blind Test chargées:', data);
                console.log('✅ Recent games blindtest:', data.recentGames);
                console.log('✅ ALL games:', data.allRecentGames);

                setStats({
                    totalGames: data.stats.totalGames || 0,
                    totalPoints: data.stats.totalPoints || 0,
                    totalCorrect: data.stats.totalPoints || 0,
                    totalAnswers: (data.stats.totalGames || 0) * 15,
                    wins: data.stats.wins || 0,
                    averageScore: data.stats.averageScore || 0,
                    bestStreak: data.stats.wins || 0,
                    favoriteArtists: {},
                    lastPlayed: data.recentGames?.[0]?.finishedAt || null,
                    recentGames: data.recentGames || [],
                    allRecentGames: data.allRecentGames || [], // ✅ NOUVEAU
                    successRate: data.stats.totalGames > 0
                        ? Math.round((data.stats.wins / data.stats.totalGames) * 100)
                        : 0
                });
            } else {
                const errorData = await response.json();
                console.error('❌ Erreur API stats Blind Test:', errorData);
            }
        } catch (error) {
            console.error('❌ Erreur chargement stats Blind Test:', error);
        } finally {
            setLoadingStats(false);
        }
    };

    const loadLeaderboard = async () => {
        setLoadingLeaderboard(true);
        try {
            const data = await getLeaderboard(10);
            setLeaderboard(data.leaderboard || []);
        } catch (error) {
            console.error('Erreur lors du chargement du classement:', error);
        } finally {
            setLoadingLeaderboard(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        window.location.href = '/#/';
    };

    const handleDeleteAccount = async () => {
        if (!showDeleteConfirm) {
            setShowDeleteConfirm(true);
            return;
        }

        try {
            await deleteAccount();
            alert(t('accountDeleted') || 'Compte supprimé avec succès');
            window.location.href = '/#/';
        } catch (error) {
            alert(t('deleteError') || 'Erreur lors de la suppression du compte');
        }
    };

    const handleGoBack = () => {
        window.location.href = '/#/';
    };

    const openStatsModal = (game) => {
        setStatsModalGame(game);
        setShowStatsModal(true);
    };

    const closeStatsModal = () => {
        setShowStatsModal(false);
        setStatsModalGame(null);
    };

    const modernBackground = "min-h-screen bg-gradient-to-br from-zinc-900 via-purple-900/20 to-zinc-800 relative overflow-hidden";
    const modernCard = "bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 backdrop-blur-sm border border-zinc-700/50 rounded-3xl shadow-2xl";

    // Animated background
    const AnimatedBackground = () => (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 left-10 w-32 h-32 bg-cyan-400/10 rounded-full blur-xl animate-pulse"></div>
            <div className="absolute bottom-20 right-10 w-40 h-40 bg-purple-400/10 rounded-full blur-xl animate-pulse delay-700"></div>
            <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-pink-400/10 rounded-full blur-xl animate-pulse delay-1000"></div>
        </div>
    );

    // Charger les parties récentes
    const loadRecentGames = async () => {
        if (!user?.id) return;

        setLoadingRecentGames(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/stats/recent-games/${user.id}?limit=20`);
            if (!response.ok) throw new Error('Failed to fetch recent games');

            const data = await response.json();
            setRecentGames(data.games || []);
        } catch (error) {
            console.error('Erreur chargement parties récentes:', error);
            setRecentGames([]);
        } finally {
            setLoadingRecentGames(false);
        }
    };

    // Configuration des jeux disponibles
    const availableGames = [
        {
            id: 'blindtest',
            name: t('blindTestGame') || 'Blind Test Beatbox',
            icon: '🎵',
            description: t('blindTestDescription') || 'Devinez les plus grands beatboxers du monde',
            color: 'from-purple-500/20 to-indigo-500/20',
            borderColor: 'border-purple-400/30'
        },
        {
            id: 'buzzer',
            name: t('buzzerGame') || 'Buzzer Battle',
            icon: '⚡',
            description: t('buzzerDescription') || 'Duel intense au buzzer - Qui sera le plus rapide ?',
            color: 'from-orange-500/20 to-red-500/20',
            borderColor: 'border-orange-400/30',
            comingSoon: false  // ✅ MODIFIÉ
        }
    ];

    const StatsModal = ({ game, isOpen, onClose }) => {
        if (!isOpen || !game) return null;

        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className={`${modernCard} p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="text-3xl">{game.icon}</span>
                            {t('gameStats') || 'Statistiques de'} {game.name}
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-zinc-400 hover:text-white text-2xl font-bold"
                        >
                            ✕
                        </button>
                    </div>


                    {loadingStats ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto"></div>
                        </div>
                    ) : (
                        <div>
                            {/* ✅ Grille de stats universelle */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                                <div className={`bg-gradient-to-br ${game.id === 'buzzer' ? 'from-orange-500/20 to-orange-600/20 border-orange-400/30' : 'from-blue-500/20 to-blue-600/20 border-blue-400/30'} border rounded-xl p-6 text-center`}>
                                    <div className="text-3xl mb-2">🎮</div>
                                    <div className={`text-2xl font-bold ${game.id === 'buzzer' ? 'text-orange-400' : 'text-blue-400'}`}>
                                        {game.id === 'buzzer' ? (buzzerStats?.totalGames || 0) : (stats?.totalGames || 0)}
                                    </div>
                                    <div className="text-zinc-300 text-sm">{t('totalGames') || 'Parties jouées'}</div>
                                </div>

                                <div className={`bg-gradient-to-br ${game.id === 'buzzer' ? 'from-red-500/20 to-red-600/20 border-red-400/30' : 'from-green-500/20 to-green-600/20 border-green-400/30'} border rounded-xl p-6 text-center`}>
                                    <div className="text-3xl mb-2">🏆</div>
                                    <div className={`text-2xl font-bold ${game.id === 'buzzer' ? 'text-red-400' : 'text-green-400'}`}>
                                        {game.id === 'buzzer' ? (buzzerStats?.wins || 0) : (stats?.wins || 0)}
                                    </div>
                                    <div className="text-zinc-300 text-sm">{t('victories') || 'Victoires'}</div>
                                </div>

                                <div className={`bg-gradient-to-br ${game.id === 'buzzer' ? 'from-pink-500/20 to-pink-600/20 border-pink-400/30' : 'from-purple-500/20 to-purple-600/20 border-purple-400/30'} border rounded-xl p-6 text-center`}>
                                    <div className="text-3xl mb-2">⭐</div>
                                    <div className={`text-2xl font-bold ${game.id === 'buzzer' ? 'text-pink-400' : 'text-purple-400'}`}>
                                        {game.id === 'buzzer'
                                            ? (buzzerStats?.averageScore || 0)
                                            : (stats?.averageScore || 0)
                                        }
                                    </div>
                                    <div className="text-zinc-300 text-sm">{t('averageScore') || 'Score moyen'}</div>
                                </div>

                                <div className={`bg-gradient-to-br ${game.id === 'buzzer' ? 'from-purple-500/20 to-purple-600/20 border-purple-400/30' : 'from-yellow-500/20 to-yellow-600/20 border-yellow-400/30'} border rounded-xl p-6 text-center`}>
                                    <div className="text-3xl mb-2">📊</div>
                                    <div className={`text-2xl font-bold ${game.id === 'buzzer' ? 'text-purple-400' : 'text-yellow-400'}`}>
                                        {game.id === 'buzzer'
                                            ? (buzzerStats?.totalPoints || 0)
                                            : (stats?.totalPoints || 0)
                                        }
                                    </div>
                                    <div className="text-zinc-300 text-sm">{t('totalPoints') || 'Points totaux'}</div>
                                </div>
                            </div>

                            {/* ✅ Parties récentes (universel) */}
                            {((game.id === 'buzzer' && buzzerStats?.recentGames?.length > 0) ||
                                (game.id === 'blindtest' && stats?.recentGames?.length > 0)) && (
                                    <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-6 border border-zinc-700/50 mb-8">
                                        <h4 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                            <span>{game.id === 'buzzer' ? '🔔' : '🎤'}</span>
                                            {t('recentGames') || 'Parties récentes'}
                                        </h4>
                                        <div className="space-y-3">
                                            {(game.id === 'buzzer' ? buzzerStats.recentGames : stats.recentGames).map((gameData, index) => (
                                                <div
                                                    key={index}
                                                    className="bg-zinc-900/50 rounded-lg p-4 flex items-center justify-between"
                                                >
                                                    <div>
                                                        <div className="font-semibold text-white">
                                                            {gameData.gameMode === 'buzzer_country' ? '🌍 Par Pays' :
                                                                gameData.gameMode === 'buzzer_event' ? '🏆 Par Événement' :
                                                                    gameData.gameMode === 'normal' ? '🎵 Mode Normal' :
                                                                        gameData.gameMode === 'quick' ? '⚡ Mode Rapide' :
                                                                            game.id === 'buzzer' ? '⚡ Buzzer Battle' : '🎵 Blind Test'}
                                                        </div>
                                                        <div className="text-sm text-zinc-400">
                                                            {gameData.date}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`text-lg font-bold ${game.id === 'buzzer' ? 'text-orange-400' : 'text-cyan-400'}`}>
                                                            {gameData.finalScore} pts
                                                        </div>
                                                        <div className="text-sm text-zinc-400">
                                                            #{gameData.finalRank}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                        </div>
                    )}
                </div>
            </div>
        );
    };


    return (
        <>
            <SEO title={t('profile') || 'Profil'} description={t('profileDescription') || 'Gérez votre profil Discord et consultez vos statistiques'} />
            <div className={modernBackground}>
                <AnimatedBackground />

                {/* Switch de langue */}
                <div className="absolute top-4 right-4 z-20">
                    <div className="flex items-center gap-2 bg-zinc-800/90 backdrop-blur-sm border border-zinc-700/50 rounded-full p-1">
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
                        <div className="max-w-4xl mx-auto">
                            <button
                                onClick={handleGoBack}
                                className="mb-6 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
                            >
                                {t('backToHome') || 'Retour à l\'accueil'}
                            </button>

                            <div className="text-center">
                                <div className="flex items-center justify-center gap-4 mb-6">
                                    <span className="text-5xl animate-bounce">👤</span>
                                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                        {t('profile') || 'Mon Profil'}
                                    </h1>
                                    <span className="text-5xl animate-bounce delay-300">🎮</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex items-center justify-center py-8">
                        <div className={`${modernCard} p-6 md:p-8 max-w-4xl w-full mx-4`}>
                            {loading ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                                    <p className="text-zinc-300">{t('loading') || 'Chargement...'}</p>
                                </div>
                            ) : !isAuthenticated ? (
                                <div className="text-center py-12">
                                    <div className="text-6xl mb-6">🎮</div>
                                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                                        {t('connectDiscord') || 'Connectez votre compte Discord'}
                                    </h2>
                                    <p className="text-zinc-300 mb-8 max-w-2xl mx-auto">
                                        {t('discordBenefits') || 'Liez votre compte Discord pour sauvegarder vos statistiques, participer au classement et débloquer des fonctionnalités exclusives !'}
                                    </p>
                                    <button
                                        onClick={() => login('profile')}
                                        className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
                                    >
                                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                                        </svg>
                                        {t('connectWithDiscord') || 'Se connecter avec Discord'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-8">

                                    {/* En-tête du profil avec icône paramètres */}
                                    <div className="relative">
                                        {/* Icône paramètres en haut à droite */}
                                        <button
                                            onClick={() => setShowSettingsModal(true)}
                                            className="absolute top-0 right-0 p-3 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-600/30 rounded-xl transition-all duration-300 hover:scale-110 group"
                                            title={t('settings') || 'Paramètres'}
                                        >
                                            <svg
                                                className="w-6 h-6 text-zinc-400 group-hover:text-cyan-400 transition-colors duration-300 group-hover:rotate-90 transform transition-transform"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </button>

                                        {/* Informations utilisateur */}
                                        <div className="flex flex-col items-center mb-8">
                                            <img
                                                src={getAvatarUrl(128)}
                                                alt={`${user.username} avatar`}
                                                className="w-32 h-32 rounded-full border-4 border-cyan-400 shadow-lg mb-4"
                                            />
                                            <h2 className="text-3xl font-bold text-white mb-2">
                                                {user.username}
                                            </h2>
                                            {user.discriminator && user.discriminator !== '0' && (
                                                <p className="text-zinc-400 text-lg">
                                                    #{user.discriminator}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contenu des onglets */}
                                    {activeTab === 'games' ? (
                                        <div>
                                            <h3 className="text-2xl font-bold text-white mb-6">
                                                {t('gameStatistics') || 'Statistiques par Jeu'}
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                                {availableGames.map((game) => (
                                                    <div
                                                        key={game.id}
                                                        onClick={() => openStatsModal(game)}
                                                        className={`relative p-6 rounded-xl border transition-all duration-300 cursor-pointer hover:scale-105 ${game.comingSoon
                                                            ? 'opacity-50 cursor-not-allowed bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border-zinc-700/30'
                                                            : `bg-gradient-to-br ${game.color} ${game.borderColor} hover:shadow-xl hover:shadow-cyan-500/20`
                                                            }`}
                                                    >
                                                        <div className="text-4xl mb-3">{game.icon}</div>
                                                        <h4 className="text-xl font-bold text-white mb-2">{game.name}</h4>
                                                        <p className="text-zinc-300 text-sm mb-4">{game.description}</p>

                                                        {game.comingSoon ? (
                                                            <span className="inline-block px-3 py-1 bg-zinc-700/50 text-zinc-400 text-xs rounded-full">
                                                                {t('comingSoon') || '🚧 Bientôt'}
                                                            </span>
                                                        ) : (
                                                            <p className="text-sm text-zinc-400">
                                                                {game.id === 'buzzer'
                                                                    ? (buzzerStats?.totalGames > 0
                                                                        ? `${buzzerStats.totalGames} ${buzzerStats.totalGames > 1 ? (t('games') || 'parties') : (t('game') || 'partie')} ${t('played') || 'jouées'}`
                                                                        : (t('noGamesYet') || 'Aucune partie jouée'))
                                                                    : (stats?.totalGames > 0
                                                                        ? `${stats.totalGames} ${stats.totalGames > 1 ? (t('games') || 'parties') : (t('game') || 'partie')} ${t('played') || 'jouées'}`
                                                                        : (t('noGamesYet') || 'Aucune partie jouée'))
                                                                }
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* ✅ NOUVEAU : Affichage combiné de toutes les parties récentes */}
                                            <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-6 border border-zinc-700/50">
                                                <h3 className="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
                                                    📜 {t('recentGames') || 'Parties récentes'}
                                                </h3>
                                                {loadingStats ? (
                                                    <p className="text-zinc-400 text-center py-8">Chargement...</p>
                                                ) : (
                                                    <RecentGamesPanel
                                                        recentGames={
                                                            // Combiner toutes les parties récentes
                                                            stats?.allRecentGames || buzzerStats?.allRecentGames || []
                                                        }
                                                        currentUserId={user?.discordId}
                                                        t={t}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <h3 className="text-2xl font-bold text-white mb-6">
                                                ⚙️ {t('settings') || 'Paramètres'}
                                            </h3>

                                            <div className="space-y-6">
                                                {/* Section Compte */}
                                                <div className="bg-gradient-to-r from-zinc-700/30 to-zinc-800/30 border border-zinc-600/30 rounded-xl p-6">
                                                    <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                                        👤 {t('accountSection') || 'Compte'}
                                                    </h4>

                                                    <div className="space-y-4">
                                                        <button
                                                            onClick={handleLogout}
                                                            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-zinc-600 to-zinc-700 hover:from-zinc-500 hover:to-zinc-600 text-white rounded-lg transition-all duration-300"
                                                        >
                                                            <span className="text-xl">🚪</span>
                                                            {t('logout') || 'Se déconnecter'}
                                                        </button>

                                                        <button
                                                            onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                                                            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-lg transition-all duration-300"
                                                        >
                                                            <span className="text-xl">🗑️</span>
                                                            {showDeleteConfirm ? (t('confirmDelete') || 'Confirmer la suppression') : (t('deleteAccount') || 'Supprimer le compte')}
                                                        </button>

                                                        {showDeleteConfirm && (
                                                            <div className="mt-4 p-4 bg-red-500/20 border border-red-400/30 rounded-lg animate-fadeIn">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <span className="text-2xl">⚠️</span>
                                                                    <p className="text-red-300 font-medium">
                                                                        {t('deleteWarning') || 'Cette action est irréversible. Toutes vos données seront supprimées.'}
                                                                    </p>
                                                                </div>
                                                                <div className="flex flex-col sm:flex-row gap-3">
                                                                    <button
                                                                        onClick={handleDeleteAccount}
                                                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                                                    >
                                                                        <span>✅</span>
                                                                        {t('confirmDelete') || 'Oui, supprimer'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setShowDeleteConfirm(false)}
                                                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-600 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                                                                    >
                                                                        <span>❌</span>
                                                                        {t('cancel') || 'Annuler'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Section Langue */}
                                                <div className="bg-gradient-to-r from-zinc-700/30 to-zinc-800/30 border border-zinc-600/30 rounded-xl p-6">
                                                    <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                                        🌍 {t('languageSection') || 'Langue'}
                                                    </h4>

                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={() => switchLanguage('fr')}
                                                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${!isEnglish
                                                                ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg'
                                                                : 'bg-zinc-600/50 text-zinc-300 hover:text-white hover:bg-zinc-600'
                                                                }`}
                                                        >
                                                            🇫🇷 Français
                                                        </button>
                                                        <button
                                                            onClick={() => switchLanguage('en')}
                                                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${isEnglish
                                                                ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg'
                                                                : 'bg-zinc-600/50 text-zinc-300 hover:text-white hover:bg-zinc-600'
                                                                }`}
                                                        >
                                                            🇺🇸 English
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Section Informations */}
                                                <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-400/30 rounded-xl p-6">
                                                    <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                                        ℹ️ {t('infoSection') || 'Informations'}
                                                    </h4>

                                                    <div className="space-y-3 text-sm text-zinc-300">
                                                        <div className="flex items-center justify-between">
                                                            <span>{t('userIdLabel') || 'ID Utilisateur'}:</span>
                                                            <span className="font-mono text-xs bg-zinc-700/50 px-2 py-1 rounded">
                                                                {user.discordId}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span>{t('totalGamesLabel') || 'Parties jouées'}:</span>
                                                            <span>{stats?.totalGames || 0}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span>{t('totalPlaytimeLabel') || 'Temps de jeu total'}:</span>
                                                            <span>{Math.round((stats?.totalGames || 0) * 5)} min</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <footer className="flex-shrink-0 py-6">
                        <div className="text-center">
                            <p className="text-zinc-400 text-sm mb-2">
                                {t('madeBy') || 'Made with ❤️ by BeatBox Games'}
                            </p>
                            {/* ✅ AJOUT : Liens légaux */}
                            <div className="flex justify-center gap-4 text-xs text-zinc-500">
                                <a href="/#/privacy" className="hover:text-cyan-400 transition-colors">
                                    Politique de Confidentialité
                                </a>
                                <span>•</span>
                                <a href="/#/legal" className="hover:text-cyan-400 transition-colors">
                                    Mentions Légales
                                </a>
                            </div>
                        </div>
                    </footer>
                </div>

                {/* Modal des statistiques */}
                <StatsModal
                    game={statsModalGame}
                    isOpen={showStatsModal}
                    onClose={closeStatsModal}
                />
            </div >

            {/* Modal des paramètres */}
            {
                showSettingsModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-scaleIn">
                            {/* En-tête de la modal */}
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <span className="text-3xl">⚙️</span>
                                    {t('settings') || 'Paramètres'}
                                </h3>
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="p-2 hover:bg-zinc-700/50 rounded-lg transition-colors"
                                >
                                    <svg className="w-6 h-6 text-zinc-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Contenu de la modal */}
                            <div className="space-y-4">
                                {/* Section Compte */}
                                <div className="bg-zinc-700/30 border border-zinc-600/30 rounded-xl p-4">
                                    <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <span className="text-xl">👤</span>
                                        {t('accountSection') || 'Compte'}
                                    </h4>

                                    <div className="space-y-3">
                                        {/* Bouton Déconnexion */}
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-zinc-600 to-zinc-700 hover:from-zinc-500 hover:to-zinc-600 text-white rounded-lg transition-all duration-300 transform hover:scale-105"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                            </svg>
                                            {t('logout') || 'Se déconnecter'}
                                        </button>

                                        {/* Bouton Suppression */}
                                        <button
                                            onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                                            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-lg transition-all duration-300 transform hover:scale-105"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            {showDeleteConfirm
                                                ? (t('confirmDelete') || 'Confirmer la suppression')
                                                : (t('deleteAccount') || 'Supprimer le compte')
                                            }
                                        </button>

                                        {/* Confirmation de suppression */}
                                        {showDeleteConfirm && (
                                            <div className="mt-4 p-4 bg-red-500/20 border border-red-400/30 rounded-lg animate-fadeIn">
                                                <div className="flex items-start gap-2 mb-3">
                                                    <span className="text-2xl">⚠️</span>
                                                    <p className="text-red-300 text-sm">
                                                        {t('deleteWarning') || 'Cette action est irréversible. Toutes vos données seront supprimées.'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={handleDeleteAccount}
                                                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-all duration-300"
                                                >
                                                    {t('confirmDelete') || 'Confirmer la suppression'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Bouton Fermer */}
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="w-full px-4 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 text-cyan-300 hover:text-cyan-200 rounded-lg transition-all duration-300 font-medium"
                                >
                                    {t('closeSettings') || 'Fermer'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}

export default ProfilePage;