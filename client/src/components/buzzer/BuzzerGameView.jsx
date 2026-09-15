import React, { useState, useEffect } from 'react';

function BuzzerGameView({
    t,
    currentRound,
    totalRounds,
    pixelLevel,
    buzzedPlayer,
    canBuzz,
    currentBeatboxer,
    beatboxerImage,
    players,
    scores,
    onBuzz,
    onGuess,
    myPlayerId,
    wrongGuessFeedback,
    justReconnected
}) {

    const [guess, setGuess] = useState('');
    const [showGuessInput, setShowGuessInput] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    const isBuzzedByMe = buzzedPlayer === myPlayerId;

    useEffect(() => {
        setGuess('');
        setShowGuessInput(false);
        setImageLoaded(false);
    }, [currentRound]);

    useEffect(() => {
        if (isBuzzedByMe && !showGuessInput) {
            setShowGuessInput(true);
        }
    }, [isBuzzedByMe, showGuessInput]);

    const handleSubmitGuess = (e) => {
        e.preventDefault();
        if (guess.trim()) {
            onGuess(guess.trim());
            setGuess('');
            setShowGuessInput(false);
        }
    };

    const getBuzzedPlayerName = () => {
        const player = players.find(p => p.id === buzzedPlayer);
        return player ? player.username : 'Quelqu\'un';
    };

    // ✅ Vérifier si c'est MOI qui ai eu faux
    const isMyWrongGuess = wrongGuessFeedback && wrongGuessFeedback.playerId === myPlayerId;

    return (
        <div className="min-h-screen max-w-7xl mx-auto overflow-hidden pb-4">
            {/* Header compact - FIXE */}
            <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-2 mb-2 border border-zinc-700/50">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-400">
                        {t('buzzerGameRound')} <span className="text-cyan-400 font-bold">{currentRound}/{totalRounds}</span>
                    </span>
                    <span className="text-zinc-500">
                        {t('buzzerGamePixel')}: <span className="text-purple-400 font-bold">{Math.round(pixelLevel)}%</span>
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                {/* Colonne principale - Image + Buzzer */}
                <div className="lg:col-span-3 flex flex-col">
                    <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-3 border border-zinc-700/50 flex flex-col">
                        {/* Zone d'image - RESPONSIVE HEIGHT */}
                        <div className="relative w-full aspect-[4/3] md:aspect-video bg-zinc-900 rounded-lg overflow-hidden mb-3 select-none">
                            {/* ✅ Banner de reconnexion (uniquement si justReconnected) */}
                            {justReconnected && (
                                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 bg-cyan-500/90 border border-cyan-400 rounded-lg px-4 py-2 shadow-lg animate-pulse">
                                    <p className="text-white text-sm font-bold">
                                        {t('buzzerGameReconnected', { currentRound, totalRounds })}
                                    </p>
                                </div>
                            )}
                            {beatboxerImage ? (
                                <div className="w-full h-full relative">
                                    <img
                                        key={currentRound} // âœ… Nouvelle clÃ© Ã  chaque round
                                        src={beatboxerImage.startsWith('http')
                                            ? beatboxerImage
                                            : `${process.env.REACT_APP_API_URL || 'https://dev.beatboxgames.com'}${beatboxerImage}`
                                        }
                                        alt="Beatboxer à deviner"
                                        className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
                                        style={{
                                            filter: currentBeatboxer
                                                ? 'none'
                                                : `blur(${pixelLevel * 0.3}px) brightness(${0.5 + (100 - pixelLevel) / 200})`,
                                            transform: currentBeatboxer
                                                ? 'scale(1)'
                                                : `scale(${1 + (pixelLevel / 300)})`,
                                            transition: 'filter 0.05s linear, transform 0.05s linear',
                                            imageRendering: pixelLevel > 30 ? 'pixelated' : 'auto',
                                            opacity: imageLoaded
                                                ? (currentBeatboxer ? 1 : 0.3 + ((100 - pixelLevel) / 100) * 0.7)
                                                : 0,
                                            userSelect: 'none',
                                            WebkitUserSelect: 'none',
                                            WebkitTouchCallout: 'none'
                                        }}
                                        onLoad={() => {
                                            setImageLoaded(true); // âœ… Afficher l'image une fois chargÃ©e
                                        }}
                                        onError={(e) => {
                                            console.error('âŒ Erreur chargement image:', beatboxerImage);
                                            console.error('âŒ URL complÃ¨te:', e.target.src);
                                            // âœ… Afficher un placeholder au lieu de cacher
                                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23333" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23999" font-size="30"%3EðŸŽ¤%3C/text%3E%3C/svg%3E';
                                            setImageLoaded(true); // âœ… Afficher le placeholder
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <div className="text-center text-zinc-600">
                                        <div className="text-4xl mb-2">🎤</div>
                                        <p className="text-sm">{t('loading')}</p>
                                    </div>
                                </div>
                            )}

                            {/* Overlay si quelqu'un a buzzé */}
                            {buzzedPlayer && !currentBeatboxer && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="text-5xl mb-3 animate-bounce">🔔</div>
                                        <p className="text-xl font-bold text-cyan-400">
                                            {isBuzzedByMe ? t('buzzerGameYouBuzzed') : t('buzzerGamePlayerBuzzed', { player: getBuzzedPlayerName() })}
                                        </p>
                                        <p className="text-zinc-400 text-sm mt-1">
                                            {isBuzzedByMe ? t('buzzerGameGuessNow') : t('buzzerGameWaiting')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Overlay révélation */}
                            {currentBeatboxer && (
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex items-end justify-center pb-6">
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-white mb-1">
                                            {currentBeatboxer}
                                        </p>
                                        <p className="text-cyan-400 text-sm">{t('buzzerGameAnswerRevealed')}</p>
                                    </div>
                                </div>
                            )}

                            {/* ✅ FEEDBACK de mauvaise réponse - UNIQUEMENT POUR MOI */}
                            {isMyWrongGuess && (
                                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
                                    <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-xl animate-bounce">
                                        <p className="font-bold flex items-center gap-2">
                                            <span className="text-2xl">❌</span>
                                            <span>{t('buzzerGameWrongAnswer')}</span>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Section Buzzer + Input - COMPACT */}
                        <div className="space-y-2">
                            {/* Bouton Buzzer COMPACT */}
                            {!currentBeatboxer && !isBuzzedByMe && (
                                <button
                                    onClick={onBuzz}
                                    disabled={!canBuzz || buzzedPlayer}
                                    className={`relative w-full group ${!canBuzz || buzzedPlayer ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className={`relative rounded-xl p-3 shadow-xl transition-all duration-200 ${!canBuzz || buzzedPlayer
                                        ? 'bg-gradient-to-r from-zinc-700 to-zinc-800'
                                        : 'bg-gradient-to-r from-red-500 to-red-700 group-hover:scale-105 group-active:scale-95'
                                        }`}>
                                        <div className="flex items-center justify-center gap-3">
                                            <span className="text-3xl">{buzzedPlayer ? '⏸️' : '🔔'}</span>
                                            <div className="text-left">
                                                <p className={`text-lg font-black ${!canBuzz || buzzedPlayer ? 'text-zinc-400' : 'text-white'}`}>
                                                    {buzzedPlayer ? t('buzzerGameBuzzerBlocked') : t('buzzerGameBuzzer')}
                                                </p>
                                                {!buzzedPlayer && canBuzz && (
                                                    <p className="text-xs text-red-200">{t('buzzerGamePressSpace')}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            )}

                            {/* Input de réponse - INLINE */}
                            {isBuzzedByMe && showGuessInput && !currentBeatboxer && (
                                <form onSubmit={handleSubmitGuess} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={guess}
                                        onChange={(e) => setGuess(e.target.value)}
                                        placeholder={t('buzzerGameEnterName')}
                                        autoFocus
                                        className="flex-1 px-4 py-2 bg-zinc-900/50 border border-cyan-500 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 text-sm"
                                    />
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-lg transition-all text-sm"
                                    >
                                        {t('buzzerGameValidate')}
                                    </button>
                                </form>
                            )}

                            {/* Indicateur d'attente - COMPACT */}
                            {buzzedPlayer && !isBuzzedByMe && !currentBeatboxer && (
                                <div className="text-center py-2 text-zinc-400 text-sm">
                                    <div className="animate-pulse">⏳ En attente...</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Colonne Scores - SCROLLABLE */}
                <div className="lg:col-span-1 h-full overflow-hidden">
                    <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-3 border border-zinc-700/50 h-full overflow-hidden flex flex-col">
                        <h3 className="text-sm font-bold text-purple-400 mb-2 flex-shrink-0">{t('buzzerGameScores')}</h3>

                        <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                            {scores && scores.length > 0 ? (
                                scores.map((player, index) => (
                                    <div
                                        key={player.id}
                                        className={`p-2 rounded-lg border transition-all ${index === 0
                                            ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/50'
                                            : player.id === myPlayerId
                                                ? 'bg-cyan-500/10 border-cyan-500/50'
                                                : 'bg-zinc-900/50 border-zinc-700/50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                {/* ✅ Avatar Discord ou emoji */}
                                                {player.isDiscordUser && player.discordAvatar ? (
                                                    <img
                                                        src={`https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=64`}
                                                        alt={player.username}
                                                        className="w-8 h-8 rounded-full border border-cyan-400 flex-shrink-0"
                                                    />
                                                ) : (
                                                    <span className="text-2xl flex-shrink-0">{player.avatar}</span>
                                                )}

                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-white text-xs truncate">
                                                        {index === 0 && '👑 '}
                                                        {player.username}
                                                        {player.id === myPlayerId && ' (Vous)'}
                                                    </p>
                                                    <p className={`text-xs font-bold ${index === 0 ? 'text-yellow-400' : 'text-cyan-400'}`}>
                                                        {player.score} pts
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-zinc-500 text-sm font-bold flex-shrink-0">
                                                #{index + 1}
                                            </span>
                                        </div>

                                        {/* Stats - ULTRA COMPACT */}
                                        {(player.buzzes > 0 || player.correctGuesses > 0 || player.wrongGuesses > 0) && (
                                            <div className="flex gap-2 text-xs text-zinc-400 mt-1 pt-1 border-t border-zinc-700/30">
                                                {player.buzzes > 0 && <span>🔔{player.buzzes}</span>}
                                                {player.correctGuesses > 0 && <span className="text-green-400">✓{player.correctGuesses}</span>}
                                                {player.wrongGuesses > 0 && <span className="text-red-400">✗{player.wrongGuesses}</span>}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-zinc-500 py-4 text-sm">
                                    <p>{t('buzzerGameNoScore')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BuzzerGameView;