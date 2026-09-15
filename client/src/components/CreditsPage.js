import React from 'react';
import { useI18n } from '../utils/i18n';
import SEO from './SEO';

function CreditsPage() {
    const { t, language, switchLanguage, isEnglish } = useI18n();

    // ✅ Liste statique des artistes
    const artists = [
        "ABH", "ABX", "Aelmight", "Akinde", "Alem", "Alexinho", "Amit", "Antilt", "Azel", "BizKit", "BlackRoll", "Bookie Blanco",
        "Bronix", "Chris Celiz", "Colaps", "Den", "Derrick", "Dr koopa", "Dropical", "Dudz", "Dynamatt", "Efaybee", "Epock", "Epos", "Exallos", "Fabley", "Faya Braz", "FootboxG",
        "Fredy Beats", "Frosty", "Gene", "GTS", "G-Wizz", "Heartgrey", "Heartzel", "Helium", "Hobbit", "Jayton", "Julard",
        "Kaji", "Kenny Urban", "Kenozen", "Madox", "Max", "MixFX", "momimaru", "Mr Androide", "Osis", "Osy",
        "PACMax", "Pash", "Patbox", "Pono", "Reeps One", "Remix", "Rich", "River'", "SamyTry", "Stan",
        "Supernova", "Synopsys", "Tunecinoo", "Vocodah", "Waali", "Wawad", "Xiphire", "Zede", "Zekka", "Zer0", "ZVD"
    ];

    const handleGoBack = () => {
        window.location.href = '/#/';
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
            <SEO {...t('seoCredits')} />
            <div className={modernBackground}>
                <AnimatedBackground />

                {/* ✅ NOUVEAU : Switch de langue */}
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
                                {t('backToHome')}
                            </button>

                            <div className="text-center">
                                <div className="flex items-center justify-center gap-4 mb-6">
                                    <span className="text-5xl animate-bounce">🎤</span>
                                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                        {t('artistCredits')}
                                    </h1>
                                    <span className="text-5xl animate-bounce delay-300">🎵</span>
                                </div>
                                <p className="text-lg md:text-xl text-zinc-300 max-w-2xl mx-auto">
                                    {t('discoverArtists')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex items-center justify-center py-8">
                        <div className={`${modernCard} p-6 md:p-8 max-w-6xl w-full mx-4`}>
                            <div>
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2">
                                        {t('ourArtists', { count: artists.length })}
                                    </h2>
                                    <p className="text-zinc-400">
                                        {t('thanksArtists')}
                                    </p>
                                </div>

                                {/* Grille d'artistes */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {artists.map((artist, index) => (
                                        <div
                                            key={artist}
                                            className="bg-gradient-to-br from-zinc-700/50 to-zinc-800/50 backdrop-blur-sm border border-zinc-600/30 rounded-xl p-4 hover:bg-gradient-to-br hover:from-zinc-600/50 hover:to-zinc-700/50 transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
                                        >
                                            <div className="text-center">
                                                <div className="text-2xl mb-2">
                                                    {index % 6 === 0 ? '🎤' :
                                                        index % 6 === 1 ? '🎵' :
                                                            index % 6 === 2 ? '🎶' :
                                                                index % 6 === 3 ? '🎧' :
                                                                    index % 6 === 4 ? '🔊' : '🎼'}
                                                </div>
                                                <h3 className="text-white font-bold text-sm md:text-base truncate" title={artist}>
                                                    {artist}
                                                </h3>
                                                <div className="text-xs text-zinc-400 mt-1">
                                                    {t('beatboxer', { number: index + 1 })}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-12">
                                    <div className="text-center mb-6">
                                        <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2">
                                            {t('audioCredits')}
                                        </h2>
                                    </div>

                                    <div className="bg-gradient-to-br from-zinc-700/50 to-zinc-800/50 backdrop-blur-sm border border-zinc-600/30 rounded-xl p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="text-3xl flex-shrink-0">🎵</div>
                                            <div className="flex-1">
                                                <h3 className="text-white font-bold text-lg mb-2">
                                                    {t('backgroundMusic')}
                                                </h3>
                                                <div className="text-zinc-300 text-sm space-y-1">
                                                    <p>
                                                        <a
                                                            href="https://freesound.org/people/gis_sweden/sounds/696385/"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-cyan-400 hover:text-cyan-300 underline transition-colors"
                                                        >
                                                            Minimal Tech Background Music - MTBM01
                                                        </a>
                                                    </p>
                                                    <p>
                                                        by{' '}
                                                        <a
                                                            href="https://freesound.org/people/gis_sweden/"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-cyan-400 hover:text-cyan-300 underline transition-colors"
                                                        >
                                                            gis_sweden
                                                        </a>
                                                    </p>
                                                    <p>
                                                        {t('audioLicense')}:{' '}
                                                        <a
                                                            href="https://creativecommons.org/licenses/by/4.0/"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-cyan-400 hover:text-cyan-300 underline transition-colors"
                                                        >
                                                            {t('attribution')}
                                                        </a>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Message de remerciement */}
                                <div className="mt-8 text-center">
                                    <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-xl p-6">
                                        <div className="text-4xl mb-4">🙏</div>
                                        <h3 className="text-xl font-bold text-yellow-400 mb-2">
                                            {t('bigThanks')}
                                        </h3>
                                        <p className="text-zinc-300">
                                            {t('artistsContribution')}
                                        </p>
                                    </div>
                                </div>
                            </div>
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

export default CreditsPage;