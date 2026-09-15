import React, { useState } from 'react';
import { useI18n } from '../utils/i18n';
import SEO from './SEO';

function StatsPage() {
    const { t, language, switchLanguage, isEnglish } = useI18n();
    const [activeTab, setActiveTab] = useState('general');

    // Données extraites des statistiques
    const generalStats = {
        uniquePlayers: 125,
        totalAnswers: 16405,
        correctAnswers: 6113,
        incorrectAnswers: 10292,
        globalSuccessRate: 37.26
    };

    const easiestArtists = [
        { name: "PACMax", successRate: 87.22, rounds: 30 },
        { name: "Osis", successRate: 85.92, rounds: 29 },
        { name: "Remix", successRate: 84.57, rounds: 23 },
        { name: "Helium", successRate: 84.52, rounds: 32 },
        { name: "Fabley", successRate: 83.81, rounds: 14 },
        { name: "Zekka", successRate: 83.33, rounds: 18 },
        { name: "Frosty", successRate: 82.28, rounds: 30 },
        { name: "Alem", successRate: 81.47, rounds: 34 },
        { name: "Gene", successRate: 80.32, rounds: 30 },
        { name: "Dropical", successRate: 79.24, rounds: 33 }
    ];

    const hardestArtists = [
        { name: "Epock", successRate: 33.65, rounds: 21 },
        { name: "Osy", successRate: 38.48, rounds: 11 },
        { name: "SamyTry", successRate: 39.35, rounds: 18 },
        { name: "Zer0", successRate: 40.37, rounds: 18 },
        { name: "Aelmight", successRate: 43.33, rounds: 12 },
        { name: "Mr Androide", successRate: 49.22, rounds: 23 },
        { name: "Dr koopa", successRate: 51.67, rounds: 18 },
        { name: "Azel", successRate: 52.59, rounds: 27 },
        { name: "Dynamatt", successRate: 53.33, rounds: 29 },
        { name: "Synopsys", successRate: 54.17, rounds: 24 }
    ];

    const allArtists = [
        { name: "PACMax", successRate: 87.22, rounds: 30, levels: "[N1:1, N2:2, N3:2]" },
        { name: "Osis", successRate: 85.92, rounds: 29, levels: "[N1:2, N2:2]" },
        { name: "Remix", successRate: 84.57, rounds: 23, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Helium", successRate: 84.52, rounds: 32, levels: "[N1:1, N2:2]" },
        { name: "Fabley", successRate: 83.81, rounds: 14, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Zekka", successRate: 83.33, rounds: 18, levels: "[N1:1, N2:3, N3:1]" },
        { name: "Frosty", successRate: 82.28, rounds: 30, levels: "[N1:1, N2:1]" },
        { name: "Alem", successRate: 81.47, rounds: 34, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Gene", successRate: 80.32, rounds: 30, levels: "[N1:1, N2:2, N3:2]" },
        { name: "Dropical", successRate: 79.24, rounds: 33, levels: "[N1:3, N2:1, N3:1]" },
        { name: "Rich", successRate: 78.7, rounds: 18, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Colaps", successRate: 78.21, rounds: 42, levels: "[N1:1, N2:1]" },
        { name: "ABX", successRate: 77.94, rounds: 21, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Kaji", successRate: 77.78, rounds: 30, levels: "[N1:2, N2:2, N3:1]" },
        { name: "Derrick", successRate: 77.59, rounds: 29, levels: "[N1:1, N2:1]" },
        { name: "ZVD", successRate: 77.32, rounds: 28, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Den", successRate: 76.33, rounds: 25, levels: "[N1:2, N2:3, N3:1]" },
        { name: "Max", successRate: 76.31, rounds: 28, levels: "[N1:1, N2:1, N3:1]" },
        { name: "River'", successRate: 75.76, rounds: 22, levels: "[N1:2, N2:3]" },
        { name: "FootboxG", successRate: 75.74, rounds: 32, levels: "[N1:3, N2:2, N3:1]" },
        { name: "Pono", successRate: 75.42, rounds: 33, levels: "[N1:1, N2:2, N3:2]" },
        { name: "BizKit", successRate: 74.74, rounds: 18, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Waali", successRate: 73.63, rounds: 17, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Patbox", successRate: 73.19, rounds: 33, levels: "[N1:2, N2:2, N3:1]" },
        { name: "Wawad", successRate: 73.17, rounds: 31, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Exallos", successRate: 73.15, rounds: 33, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Stan", successRate: 73.0, rounds: 25, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Julard", successRate: 72.59, rounds: 37, levels: "[N1:1, N2:1, N3:1]" },
        { name: "BlackRoll", successRate: 72.56, rounds: 42, levels: "[N1:3, N2:2, N3:1]" },
        { name: "Pash", successRate: 72.22, rounds: 33, levels: "[N1:3, N2:3]" },
        { name: "Xiphire", successRate: 71.79, rounds: 27, levels: "[N1:1, N2:2, N3:1]" },
        { name: "Vocodah", successRate: 71.5, rounds: 30, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Madox", successRate: 69.85, rounds: 44, levels: "[N1:2, N2:2, N3:1]" },
        { name: "Antilt", successRate: 69.54, rounds: 18, levels: "[N1:1, N2:1, N3:1]" },
        { name: "ABH", successRate: 68.86, rounds: 38, levels: "[N1:2, N2:2, N3:2]" },
        { name: "Zede", successRate: 68.68, rounds: 13, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Epos", successRate: 68.48, rounds: 22, levels: "[N1:1, N2:2]" },
        { name: "Alexinho", successRate: 68.13, rounds: 23, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Heartzel", successRate: 67.53, rounds: 25, levels: "[N1:3, N2:2, N3:1]" },
        { name: "momimaru", successRate: 67.04, rounds: 27, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Kenozen", successRate: 66.83, rounds: 33, levels: "[N1:3, N2:3, N3:2]" },
        { name: "Amit", successRate: 66.67, rounds: 22, levels: "[N1:2, N2:2, N3:1]" },
        { name: "GTS", successRate: 66.17, rounds: 20, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Jayton", successRate: 65.77, rounds: 41, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Reeps One", successRate: 65.14, rounds: 29, levels: "[N1:3, N2:3, N3:3]" },
        { name: "Kenny Urban", successRate: 64.83, rounds: 17, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Heartgrey", successRate: 64.51, rounds: 17, levels: "[N1:2, N2:1, N3:1]" },
        { name: "Dudz", successRate: 64.24, rounds: 33, levels: "[N1:2, N2:2, N3:1]" },
        { name: "Hobbit", successRate: 63.79, rounds: 29, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Chris Celiz", successRate: 62.88, rounds: 22, levels: "[N1:3, N2:2, N3:1]" },
        { name: "MixFX", successRate: 62.27, rounds: 22, levels: "[N1:1, N2:1, N3:2]" },
        { name: "Akinde", successRate: 62.17, rounds: 20, levels: "[N1:3, N2:3, N3:1]" },
        { name: "Fredy Beats", successRate: 61.67, rounds: 19, levels: "[N1:2, N2:2, N3:2]" },
        { name: "Efaybee", successRate: 60.67, rounds: 30, levels: "[N1:2, N2:2, N3:2]" },
        { name: "Faya Braz", successRate: 58.23, rounds: 32, levels: "[N1:3, N2:2, N3:2]" },
        { name: "Tunecinoo", successRate: 56.59, rounds: 22, levels: "[N1:2, N2:1, N3:1]" },
        { name: "Supernova", successRate: 55.19, rounds: 18, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Bronix", successRate: 54.51, rounds: 27, levels: "[N1:1, N2:2, N3:1]" },
        { name: "G-Wizz", successRate: 54.49, rounds: 22, levels: "[N1:2, N2:3, N3:1]" },
        { name: "Synopsys", successRate: 54.17, rounds: 24, levels: "[N1:3, N2:3, N3:1]" },
        { name: "Dynamatt", successRate: 53.33, rounds: 29, levels: "[N1:2, N2:3, N3:1]" },
        { name: "Azel", successRate: 52.59, rounds: 27, levels: "[N1:2, N2:2, N3:2]" },
        { name: "Dr koopa", successRate: 51.67, rounds: 18, levels: "[N1:1, N2:1, N3:1]" },
        { name: "Mr Androide", successRate: 49.22, rounds: 23, levels: "[N1:1, N2:2, N3:1]" },
        { name: "Aelmight", successRate: 43.33, rounds: 12, levels: "[N1:2, N2:2, N3:2]" },
        { name: "Zer0", successRate: 40.37, rounds: 18, levels: "[N1:2, N2:2, N3:2]" },
        { name: "SamyTry", successRate: 39.35, rounds: 18, levels: "[N1:2, N2:1, N3:2]" },
        { name: "Osy", successRate: 38.48, rounds: 11, levels: "[N1:1, N2:2, N3:2]" },
        { name: "Epock", successRate: 33.65, rounds: 21, levels: "[N1:1, N2:2, N3:2]" }
    ];

    const handleGoBack = () => {
        window.location.href = '/#/';
    };

    const getSuccessRateColor = (rate) => {
        if (rate >= 80) return 'text-green-400';
        if (rate >= 60) return 'text-yellow-400';
        if (rate >= 40) return 'text-orange-400';
        return 'text-red-400';
    };

    const getSuccessRateIcon = (rate) => {
        if (rate >= 80) return '🔥';
        if (rate >= 60) return '✅';
        if (rate >= 40) return '📊';
        return '⚠️';
    };

    // Style moderne
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

    return (
        <>
            <SEO {...t('seoStats')} />
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
                        <div className="max-w-6xl mx-auto">
                            <button
                                onClick={handleGoBack}
                                className="mb-6 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
                            >
                                {t('backToHome')}
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
                            {/* Onglets */}
                            <div className="flex flex-wrap gap-2 mb-8 justify-center">
                                <button
                                    onClick={() => setActiveTab('general')}
                                    className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${activeTab === 'general'
                                        ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg'
                                        : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50'
                                        }`}
                                >
                                    📊 {t('generalStats')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('easiest')}
                                    className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${activeTab === 'easiest'
                                        ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg'
                                        : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50'
                                        }`}
                                >
                                    🔥 {t('easiestArtists')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('hardest')}
                                    className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${activeTab === 'hardest'
                                        ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg'
                                        : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50'
                                        }`}
                                >
                                    ⚠️ {t('hardestArtists')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('all')}
                                    className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${activeTab === 'all'
                                        ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg'
                                        : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50'
                                        }`}
                                >
                                    🎤 {t('allArtists')}
                                </button>
                            </div>

                            {/* Contenu des onglets */}
                            {activeTab === 'general' && (
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-8 text-center">
                                        {t('generalStats')}
                                    </h2>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-400/30 rounded-xl p-6 text-center">
                                            <div className="text-4xl mb-4">👥</div>
                                            <h3 className="text-2xl font-bold text-blue-400 mb-2">{generalStats.uniquePlayers.toLocaleString()}</h3>
                                            <p className="text-zinc-300">{t('uniquePlayers')}</p>
                                        </div>

                                        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-400/30 rounded-xl p-6 text-center">
                                            <div className="text-4xl mb-4">📝</div>
                                            <h3 className="text-2xl font-bold text-purple-400 mb-2">{generalStats.totalAnswers.toLocaleString()}</h3>
                                            <p className="text-zinc-300">{t('totalAnswers')}</p>
                                        </div>

                                        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-400/30 rounded-xl p-6 text-center">
                                            <div className="text-4xl mb-4">✅</div>
                                            <h3 className="text-2xl font-bold text-green-400 mb-2">{generalStats.correctAnswers.toLocaleString()}</h3>
                                            <p className="text-zinc-300">{t('correctAnswers')}</p>
                                        </div>

                                        <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-400/30 rounded-xl p-6 text-center">
                                            <div className="text-4xl mb-4">❌</div>
                                            <h3 className="text-2xl font-bold text-red-400 mb-2">{generalStats.incorrectAnswers.toLocaleString()}</h3>
                                            <p className="text-zinc-300">{t('incorrectAnswers')}</p>
                                        </div>

                                        <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-400/30 rounded-xl p-6 text-center md:col-span-2 lg:col-span-1">
                                            <div className="text-4xl mb-4">🎯</div>
                                            <h3 className="text-2xl font-bold text-yellow-400 mb-2">{generalStats.globalSuccessRate}%</h3>
                                            <p className="text-zinc-300">{t('globalSuccessRate')}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'easiest' && (
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent mb-8 text-center">
                                        🔥 {t('top10EasiestArtists')}
                                    </h2>

                                    <div className="space-y-4">
                                        {easiestArtists.map((artist, index) => (
                                            <div
                                                key={artist.name}
                                                className="bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-400/30 rounded-xl p-6 hover:from-green-500/20 hover:to-cyan-500/20 transition-all duration-300"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-2xl font-bold text-green-400 min-w-[3rem]">#{index + 1}</div>
                                                        <div className="text-3xl">🔥</div>
                                                        <div>
                                                            <h3 className="text-xl font-bold text-white">{artist.name}</h3>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-2xl font-bold text-green-400">{artist.successRate}%</div>
                                                        <div className="text-sm text-zinc-400">{t('successRate')}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'hardest' && (
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent mb-8 text-center">
                                        ⚠️ {t('top10HardestArtists')}
                                    </h2>

                                    <div className="space-y-4">
                                        {hardestArtists.map((artist, index) => (
                                            <div
                                                key={artist.name}
                                                className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-400/30 rounded-xl p-6 hover:from-red-500/20 hover:to-orange-500/20 transition-all duration-300"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-2xl font-bold text-red-400 min-w-[3rem]">#{index + 1}</div>
                                                        <div className="text-3xl">⚠️</div>
                                                        <div>
                                                            <h3 className="text-xl font-bold text-white">{artist.name}</h3>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-2xl font-bold text-red-400">{artist.successRate}%</div>
                                                        <div className="text-sm text-zinc-400">{t('successRate')}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'all' && (
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-8 text-center">
                                        🎤 {t('allArtistsBySuccessRate')}
                                    </h2>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {allArtists.map((artist, index) => (
                                            <div
                                                key={artist.name}
                                                className="bg-gradient-to-r from-zinc-700/30 to-zinc-800/30 border border-zinc-600/30 rounded-xl p-4 hover:from-zinc-600/30 hover:to-zinc-700/30 transition-all duration-300"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-lg font-bold text-zinc-400 min-w-[3rem]">#{index + 1}</div>
                                                        <div className="text-2xl">{getSuccessRateIcon(artist.successRate)}</div>
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="text-lg font-bold text-white truncate">{artist.name}</h3>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`text-xl font-bold ${getSuccessRateColor(artist.successRate)}`}>
                                                            {artist.successRate}%
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <footer className="flex-shrink-0 py-6">
                        <div className="text-center">
                            <p className="text-zinc-400 text-sm mb-2">
                                {t('madeBy')}
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
            </div>
        </>
    );
}

export default StatsPage;