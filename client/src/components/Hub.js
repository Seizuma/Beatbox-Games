import React from 'react';
import { useI18n } from '../utils/i18n';
import DiscordLoginButton from './DiscordLoginButton';

function Hub() {
    const { t, language, switchLanguage, isEnglish } = useI18n();

    const handlePlayBlindTest = () => {
        window.location.href = '/#/blindtest-online';
    };

    const handlePlayBuzzerBattle = () => {
        window.location.href = '/#/buzzer-battle';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-purple-900/20 to-zinc-800 relative overflow-hidden">
            {/* Animated background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 w-32 h-32 bg-cyan-400/10 rounded-full blur-xl animate-pulse"></div>
                <div className="absolute bottom-20 right-10 w-40 h-40 bg-purple-400/10 rounded-full blur-xl animate-pulse delay-700"></div>
                <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-pink-400/10 rounded-full blur-xl animate-pulse delay-1000"></div>
            </div>

            {/* Navigation avec Discord */}
            <div className="absolute top-4 left-4 right-4 z-20">
                <div className="flex items-center justify-between">
                    <DiscordLoginButton />
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
            </div>

            <div className="flex flex-col items-center justify-center min-h-screen px-4 relative z-10 py-20">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="flex items-center justify-center gap-4 mb-6">
                        <span className="text-5xl md:text-6xl animate-bounce">🎮</span>
                        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                            {t('hubTitle')}
                        </h1>
                        <span className="text-5xl md:text-6xl animate-bounce delay-300">🎧</span>
                    </div>
                    <p className="text-lg md:text-xl text-zinc-300 font-light px-4">
                        ☀️ {t('hubSubtitle')}
                    </p>
                </div>

                {/* Grille de jeux */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl w-full mb-12">
                    {/* Blind Test Online */}
                    <div className="bg-gradient-to-br from-slate-700/90 to-slate-800/90 backdrop-blur-sm border border-slate-600/50 rounded-3xl shadow-2xl p-8 md:p-10 relative group hover:scale-105 transition-all duration-300">
                        {/* Badge Populaire */}
                        <div className="absolute -top-3 -right-3 transform rotate-12">
                            <span className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                                {t('hubBadgePopular')}
                            </span>
                        </div>

                        <div className="text-center">
                            <div className="flex items-center justify-center mb-6">
                                <span className="text-7xl group-hover:scale-110 transition-transform duration-300">🌐</span>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                {t('blindTestOnline')}
                            </h2>
                            <p className="text-base md:text-lg text-zinc-300 leading-relaxed mb-6">
                                {t('blindTestDescription')}
                            </p>

                            <button
                                onClick={handlePlayBlindTest}
                                className="w-full py-4 bg-gradient-to-r from-cyan-400 to-purple-500 hover:from-cyan-300 hover:to-purple-400 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg text-lg mb-6"
                            >
                                {t('playNow')}
                            </button>

                            <div className="flex justify-center space-x-8 text-center">
                                <div className="flex flex-col items-center">
                                    <span className="text-2xl mb-2">⚡</span>
                                    <span className="text-zinc-400 text-sm">{t('instant')}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-2xl mb-2">🔒</span>
                                    <span className="text-zinc-400 text-sm">{t('private')}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-2xl mb-2">⏱️</span>
                                    <span className="text-zinc-400 text-sm">{t('realTime')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Buzzer Battle - NOUVEAU */}
                    <div className="bg-gradient-to-br from-cyan-900/90 to-purple-900/90 backdrop-blur-sm border border-cyan-600/50 rounded-3xl shadow-2xl p-8 md:p-10 relative group hover:scale-105 transition-all duration-300">
                        {/* Badge Nouveau */}
                        <div className="absolute -top-3 -right-3 transform rotate-12">
                            <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                                {t('hubBadgeNew')}
                            </span>
                        </div>

                        <div className="text-center">
                            <div className="flex items-center justify-center mb-6">
                                <span className="text-7xl group-hover:scale-110 transition-transform duration-300 group-hover:rotate-12">🔔</span>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                {t('buzzerGame')}
                            </h2>
                            <p className="text-base md:text-lg text-cyan-100 leading-relaxed mb-6">
                                {t('buzzerDescriptionHub')}
                            </p>

                            <button
                                onClick={handlePlayBuzzerBattle}
                                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg text-lg mb-6"
                            >
                                {t('playNow')}
                            </button>

                            <div className="flex justify-center space-x-8 text-center">
                                <div className="flex flex-col items-center">
                                    <span className="text-2xl mb-2">⚡</span>
                                    <span className="text-cyan-200 text-sm">{t('hubBuzzerSpeed')}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-2xl mb-2">🖼️</span>
                                    <span className="text-cyan-200 text-sm">{t('hubBuzzerBlur')}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-2xl mb-2">🏆</span>
                                    <span className="text-cyan-200 text-sm">{t('hubBuzzerCompetitive')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer avec liens */}
                <div className="text-center space-y-6">
                    <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                        <button
                            onClick={() => window.location.href = '/#/credits'}
                            className="px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 border border-cyan-400/30 hover:from-cyan-500/30 hover:to-cyan-600/30 text-cyan-300 hover:text-cyan-200 transition-all duration-300 text-sm rounded-xl flex items-center gap-2 font-medium"
                        >
                            {t('seeAllArtists')}
                        </button>
                        <button
                            onClick={() => window.location.href = '/#/stats'}
                            className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-purple-600/20 border border-purple-400/30 hover:from-purple-500/30 hover:to-purple-600/30 text-purple-300 hover:text-purple-200 transition-all duration-300 text-sm rounded-xl flex items-center gap-2 font-medium"
                        >
                            {t('seeGameStats')}
                        </button>
                    </div>
                    <p className="text-zinc-500 text-sm mb-2">
                        {t('madeBy')}
                    </p>
                    {/* Contact Widget */}
                    <div className="mb-6">
                        <button
                            onClick={() => window.location.href = '/#/contact'}
                            className="px-6 py-3 bg-gradient-to-r from-orange-500/20 to-orange-600/20 border border-orange-400/30 hover:from-orange-500/30 hover:to-orange-600/30 text-orange-300 hover:text-orange-200 transition-all duration-300 rounded-xl flex items-center gap-2 font-medium mx-auto"
                        >
                            {t('contactWidget')}
                        </button>
                    </div>

                    <div className="flex justify-center gap-4 text-xs text-zinc-600">
                        <a href="/#/privacy" className="hover:text-cyan-400 transition-colors">
                            {t('hubPrivacyPolicy')}
                        </a>
                        <span>•</span>
                        <a href="/#/legal" className="hover:text-cyan-400 transition-colors">
                            {t('hubLegalNotice')}
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Hub;