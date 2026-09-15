

function BuzzerResultsView({ t, scores, onPlayAgain, onBackToHome }) {

    if (!scores || scores.length === 0) {
        return (
            <div className="max-w-4xl mx-auto text-center">
                <h2 className="text-4xl font-bold mb-8 text-white">
                    {t('buzzerResultsNoResults')}
                </h2>
                <button
                    onClick={onBackToHome}
                    className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105"
                >
                    {t('backToHome')}
                </button>
            </div>
        );
    }

    const winner = scores[0];
    const podium = scores.slice(0, 3);
    const others = scores.slice(3);

    return (
        <div className="max-w-6xl mx-auto">
            {/* Titre */}
            <div className="text-center mb-8">
                <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent animate-pulse">
                    {t('buzzerResultsGameOver')}
                </h2>
                <p className="text-zinc-400 text-xl">
                    {t('buzzerResultsCongrats')}
                </p>
            </div>

            {/* Champion */}
            <div className="mb-8">
                <div className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 border-yellow-500/50 rounded-2xl p-8 text-center transform hover:scale-105 transition-all duration-300">
                    <div className="text-6xl mb-4 animate-bounce">👑</div>
                    <p className="text-3xl font-black text-yellow-400 mb-2">
                        {t('buzzerResultsChampion')}
                    </p>
                    <div className="flex flex-col items-center justify-center mb-4">
                        {/* ✅ Avatar Discord ou emoji */}
                        {winner.isDiscordUser && winner.discordAvatar ? (
                            <img
                                src={`https://cdn.discordapp.com/avatars/${winner.discordId}/${winner.discordAvatar}.png?size=128`}
                                alt={winner.username}
                                className="w-20 h-20 rounded-full border-4 border-yellow-400 mb-3"
                            />
                        ) : (
                            <div className="text-5xl mb-3">{winner.avatar}</div>
                        )}

                        <div className="text-center">
                            <p className="text-4xl font-bold text-white mb-2">
                                {winner.username}
                            </p>
                            <p className="text-2xl text-yellow-400 font-bold">
                                {winner.score} {winner.score > 1 ? t('points') : t('buzzerResultsPoint')}
                            </p>
                        </div>
                    </div>

                    {/* Stats du champion */}
                    <div className="flex justify-center gap-8 mt-6 text-lg">
                        <div className="bg-zinc-900/50 px-6 py-3 rounded-lg">
                            <p className="text-zinc-400 text-sm">Buzzes</p>
                            <p className="text-cyan-400 font-bold text-2xl">
                                {winner.buzzes || 0}
                            </p>
                        </div>
                        <div className="bg-zinc-900/50 px-6 py-3 rounded-lg">
                            <p className="text-zinc-400 text-sm">Bonnes réponses</p>
                            <p className="text-green-400 font-bold text-2xl">
                                {winner.correctGuesses || 0}
                            </p>
                        </div>
                        <div className="bg-zinc-900/50 px-6 py-3 rounded-lg">
                            <p className="text-zinc-400 text-sm">Erreurs</p>
                            <p className="text-red-400 font-bold text-2xl">
                                {winner.wrongGuesses || 0}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Podium (2ème et 3ème uniquement) */}
            {podium.length > 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {podium.slice(1).map((player, index) => {
                        const position = index + 2; // 2ème ou 3ème
                        const medal = position === 2 ? '🥈' : '🥉';
                        const borderColor = position === 2 ? 'border-gray-400/50' : 'border-orange-600/50';
                        const bgColor = position === 2 ? 'from-gray-400/20 to-gray-500/20' : 'from-orange-500/20 to-orange-600/20';

                        return (
                            <div
                                key={player.id}
                                className={`bg-gradient-to-r ${bgColor} border ${borderColor} rounded-xl p-6`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="text-5xl">{medal}</div>

                                    {/* ✅ Avatar Discord ou emoji */}
                                    {player.isDiscordUser && player.discordAvatar ? (
                                        <img
                                            src={`https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=96`}
                                            alt={player.username}
                                            className="w-16 h-16 rounded-full border-3 border-gray-400"
                                        />
                                    ) : (
                                        <div className="text-4xl">{player.avatar}</div>
                                    )}

                                    <div className="flex-1 min-w-0">
                                        <p className="text-2xl font-bold text-white break-words">
                                            {player.username}
                                        </p>
                                        <p className="text-xl text-cyan-400 font-bold">
                                            {player.score} {player.score > 1 ? 'points' : 'point'}
                                        </p>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="flex gap-4 mt-4 text-sm">
                                    <div className="bg-zinc-900/50 px-4 py-2 rounded-lg flex-1 text-center">
                                        <p className="text-zinc-400">{t('buzzerResultsBuzzes')}</p>
                                        <p className="text-cyan-400 font-bold text-lg">
                                            {player.buzzes || 0}
                                        </p>
                                    </div>
                                    <div className="bg-zinc-900/50 px-4 py-2 rounded-lg flex-1 text-center">
                                        <p className="text-zinc-400">{t('buzzerResultsCorrect')}</p>
                                        <p className="text-green-400 font-bold text-lg">
                                            {player.correctGuesses || 0}
                                        </p>
                                    </div>
                                    <div className="bg-zinc-900/50 px-4 py-2 rounded-lg flex-1 text-center">
                                        <p className="text-zinc-400">{t('buzzerResultsErrors')}</p>
                                        <p className="text-red-400 font-bold text-lg">
                                            {player.wrongGuesses || 0}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Autres joueurs */}
            {others.length > 0 && (
                <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-6 border border-zinc-700/50 mb-8">
                    <h3 className="text-2xl font-bold text-cyan-400 mb-4">
                        {t('buzzerResultsFullRanking')}
                    </h3>
                    <div className="space-y-3">
                        {others.map((player, index) => {
                            const position = index + 4; // Commence à la 4ème place

                            return (
                                <div
                                    key={player.id}
                                    className="bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-4 flex items-center gap-4"
                                >
                                    <div className="text-2xl font-bold text-zinc-500 w-8 text-center">
                                        #{position}
                                    </div>
                                    {player.isDiscordUser && player.discordAvatar ? (
                                        <img
                                            src={`https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=64`}
                                            alt={player.username}
                                            className="w-12 h-12 rounded-full border-2 border-zinc-600"
                                        />
                                    ) : (
                                        <div className="text-3xl">{player.avatar}</div>
                                    )}
                                    <div className="flex-1">
                                        <p className="text-xl font-bold text-white">
                                            {player.username}
                                        </p>
                                        <p className="text-cyan-400 font-bold">
                                            {player.score} {player.score > 1 ? t('points') : t('buzzerResultsPoint')}
                                        </p>
                                    </div>
                                    <div className="flex gap-3 text-sm">
                                        <span className="text-cyan-400">🔔 {player.buzzes || 0}</span>
                                        <span className="text-green-400">✓ {player.correctGuesses || 0}</span>
                                        <span className="text-red-400">✗ {player.wrongGuesses || 0}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Boutons d'action */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                    onClick={onPlayAgain}
                    className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                    {t('buzzerResultsPlayAgain')}
                </button>
                <button
                    onClick={onBackToHome}
                    className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                    {t('backToHome')}
                </button>
            </div>
        </div>
    );
}

export default BuzzerResultsView;