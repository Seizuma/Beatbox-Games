import React from 'react';

const ResultsView = ({
    finalRanking,
    pseudo,
    handleNewGame,
    // UI Components
    modernBackground,
    modernCard,
    modernButton,
    AnimatedBackground,
    LanguageSwitch,
    GameModeBadge,
    t
}) => {
    return (
        <div className={modernBackground}>
            <AnimatedBackground />
            <LanguageSwitch />
            <div className="flex flex-col items-center justify-center min-h-screen px-4 relative z-10">
                <div className={`${modernCard} p-8 max-w-2xl w-full`}>
                    <div className="text-center mb-8">
                        <div className="text-6xl mb-4">🏁</div>
                        <h2 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent mb-2">
                            {t('gameFinished')}
                        </h2>
                        <GameModeBadge />
                        <p className="text-zinc-300 mt-2">{t('congratsToAll')}</p>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-2xl font-bold text-center bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                            {t('finalRanking')}
                        </h3>

                        <div className="space-y-4">
                            {finalRanking.map((player, index) => (
                                <div
                                    key={player.pseudo}
                                    className={`flex justify-between items-center p-6 rounded-2xl transition-all duration-300 ${player.pseudo === pseudo
                                        ? 'bg-gradient-to-r from-cyan-500/30 to-purple-500/30 border border-cyan-400/50 transform scale-105'
                                        : 'bg-zinc-700/50'
                                        } ${index < 3 ? 'ring-2 ring-yellow-400/30' : ''}`}
                                >
                                    <div className="flex items-center gap-6">
                                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${player.rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black' :
                                            player.rank === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-500 text-black' :
                                                player.rank === 3 ? 'bg-gradient-to-r from-orange-400 to-red-500 text-white' :
                                                    'bg-gradient-to-r from-zinc-500 to-zinc-600 text-white'
                                            }`}>
                                            {player.rank}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-white font-bold text-xl">{player.pseudo}</span>
                                                {player.rank === 1 && <span className="text-3xl">👑</span>}
                                                {player.rank === 2 && <span className="text-2xl">🥈</span>}
                                                {player.rank === 3 && <span className="text-2xl">🥉</span>}
                                            </div>
                                            {player.pseudo === pseudo && (
                                                <p className="text-cyan-400 text-sm font-semibold">{t('itsYou')}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                                            {player.score}
                                        </span>
                                        <p className="text-zinc-400 text-sm">{t('points')}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-6">
                            <button
                                onClick={handleNewGame}
                                className={`${modernButton} w-full py-4 text-xl`}
                            >
                                {t('newGame')}
                            </button>
                        </div>
                        <button
                            onClick={() => window.location.href = '/#/'}
                            className="w-full px-6 py-3 bg-zinc-700/50 hover:bg-zinc-600/50 border border-zinc-600/50 text-zinc-300 hover:text-white font-medium rounded-xl transition-all duration-300"
                        >
                            🏠 {t('backToHub') || 'Retour au hub'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResultsView;