import React, { useState } from 'react';

function RecentGamesPanel({ recentGames, currentUserId, t }) {
    const [selectedGame, setSelectedGame] = useState(null);

    const getGameIcon = (gameMode) => {
        if (gameMode === 'buzzer_country' || gameMode === 'buzzer_event') return '🔔';
        return '🎤';
    };

    const getGameModeName = (gameMode) => {
        if (gameMode === 'buzzer_country' || gameMode === 'buzzer_event') return 'Buzzer Battle';
        return 'Blind Test';
    };

    const getRankEmoji = (rank) => {
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return `#${rank}`;
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return t('today') || 'Aujourd\'hui';
        if (diffDays === 1) return t('yesterday') || 'Hier';
        if (diffDays < 7) return `${t('daysAgo', { count: diffDays }) || `Il y a ${diffDays} jours`}`;
        return date.toLocaleDateString();
    };

    if (!recentGames || recentGames.length === 0) {
        return (
            <div className="text-center py-12 bg-zinc-800/30 rounded-xl border border-zinc-700/30">
                <div className="text-5xl mb-4">🎮</div>
                <p className="text-zinc-400">{t('noGamesYet') || 'Aucune partie jouée'}</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {recentGames.map((game, index) => (
                    <div
                        key={`${game.roomCode || game.gameId}-${index}`}
                        onClick={() => setSelectedGame(game)}
                        className={`bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:border-cyan-500/50 hover:bg-zinc-800/70 ${game.finalRank === 1 ?
                            'border-l-4 border-l-yellow-400' : ''
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="text-3xl">
                                    {getGameIcon(game.gameMode)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-white">
                                            {getGameModeName(game.gameMode)}
                                        </span>
                                        <span className="text-xs text-zinc-500">
                                            #{game.roomCode}
                                        </span>
                                    </div>
                                    <p className="text-sm text-zinc-400">{formatDate(game.finishedAt || game.playedAt)}</p>
                                </div>
                            </div>
                            <div className="text-zinc-400 hover:text-cyan-400 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal détails de la partie */}
            {selectedGame && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => setSelectedGame(null)}
                    ></div>

                    <div className="relative bg-zinc-900 border-2 border-cyan-500/50 rounded-2xl p-6 max-w-2xl w-full shadow-2xl shadow-cyan-500/20 animate-scaleIn max-h-[80vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                                    {getGameIcon(selectedGame.gameMode)} {getGameModeName(selectedGame.gameMode)}
                                </h3>
                                <p className="text-sm text-zinc-400 mt-1">
                                    Room: {selectedGame.roomCode || (selectedGame.gameId ? selectedGame.gameId.substring(0, 6).toUpperCase() : 'N/A')} • {formatDate(selectedGame.finishedAt || selectedGame.playedAt)}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedGame(null)}
                                className="text-zinc-400 hover:text-white text-2xl transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Classement */}
                        <div className="space-y-3">
                            <h4 className="text-lg font-bold text-purple-400 mb-3">
                                📊 {t('finalRanking') || 'Classement final'}
                            </h4>
                            {selectedGame.participants && selectedGame.participants.length > 0 ? (
                                selectedGame.participants.map((participant, index) => {
                                    const isCurrentUser = participant.discordId === currentUserId;
                                    return (
                                        <div
                                            key={`${participant.discordId}-${index}`}
                                            className={`flex items-center gap-4 p-4 rounded-xl transition-all ${isCurrentUser
                                                ? 'bg-cyan-500/20 border-2 border-cyan-400'
                                                : 'bg-zinc-800/50 border border-zinc-700/50'
                                                }`}
                                        >
                                            <div className={`text-2xl font-bold ${participant.rank === 1 ? 'text-yellow-400' :
                                                participant.rank === 2 ? 'text-gray-300' :
                                                    participant.rank === 3 ? 'text-amber-600' :
                                                        'text-zinc-500'
                                                }`}>
                                                {getRankEmoji(participant.rank)}
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-bold ${isCurrentUser ? 'text-cyan-400' : 'text-white'}`}>
                                                    {participant.username || 'Joueur inconnu'}
                                                    {isCurrentUser && <span className="ml-2 text-xs">(Vous)</span>}
                                                </p>
                                                <p className="text-sm text-zinc-400">
                                                    {participant.score} points
                                                </p>
                                            </div>
                                            {participant.roundsWon > 0 && (
                                                <div className="text-green-400 text-sm font-bold">
                                                    🏆 {participant.roundsWon}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-zinc-400 text-center py-4">
                                    {t('noParticipantsData') || 'Données des participants non disponibles'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default RecentGamesPanel;