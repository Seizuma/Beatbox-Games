import React from 'react';
import { VolumeControl } from '../UI';

const GameView = ({
    gameState,
    timeLeft,
    answer,
    hasAnswered,
    canAnswer,
    timerStarted,
    players,
    scores,
    pseudo,
    answerFeedback,
    isFirefox,
    // Handlers
    setAnswer,
    handleSubmitAnswer,
    getPlayerAnswerIcon,
    // Props du VolumeControl
    volumeControlProps,
    // UI Components
    modernBackground,
    modernCard,
    modernButton,
    modernInput,
    AnimatedBackground,
    LanguageSwitch,
    t,
    // Props pour l'audio
    userInteracted,
    forceEnableAudio
}) => {
    // ✅ CORRIGÉ : Fonction pour obtenir l'avatar Discord avec optional chaining
    const getPlayerAvatar = (player) => {
        if (player?.isDiscordUser && player?.avatarUrl) {
            return player.avatarUrl;
        }
        return null;
    };

    // ✅ CORRIGÉ : Vérifier si un joueur est un utilisateur Discord avec optional chaining
    const isDiscordPlayer = (player) => {
        return player?.isDiscordUser && player?.discordId;
    };

    // Fonction de test audio pour debug
    const handleTestAudio = () => {
        console.log('🧪 TEST AUDIO DÉCLENCHÉ par utilisateur');
        if (forceEnableAudio) {
            forceEnableAudio();
        }

        if (window.debugAudio) {
            console.log('🧪 Tests directs disponibles:', Object.keys(window.debugAudio));
            window.debugAudio.testCountdownReady();
            setTimeout(() => window.debugAudio.testTension(), 1000);
        }
    };

    return (
        <div className={modernBackground}>
            <AnimatedBackground />
            <LanguageSwitch />

            {/* Bouton de test audio si pas d'interaction */}
            {!userInteracted && process.env.NODE_ENV === 'development' && (
                <div className="fixed top-20 left-4 z-40">
                    <button
                        onClick={handleTestAudio}
                        className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg font-bold text-sm shadow-lg"
                    >
                        🔊 Test Audio
                    </button>
                </div>
            )}

            <div className="flex flex-col items-center justify-center min-h-screen px-4 relative z-10">
                <div className={`${modernCard} p-4 md:p-6 max-w-2xl w-full max-h-[95vh] overflow-y-auto`}>
                    <div className="text-center mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div></div>
                            <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                {t('blindTestTitle')}
                            </h2>

                            {/* Contrôle de volume avec props stables */}
                            <VolumeControl {...volumeControlProps} />
                        </div>

                        {gameState && (
                            <div className="flex justify-center gap-6 mb-4">
                                <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-xl px-4 py-2">
                                    <p className="text-yellow-400 font-bold">
                                        {t('round')} {gameState.round} / {gameState.maxRounds}
                                    </p>
                                </div>
                                <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 rounded-xl px-4 py-2">
                                    <p className="text-cyan-300 font-bold">
                                        {t('level')} {gameState.level} / {gameState.maxLevel}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Indicateur d'état audio en développement */}
                        {process.env.NODE_ENV === 'development' && (
                            <div className="mb-4 p-2 bg-gray-800/50 rounded-lg text-xs">
                                <div className="flex justify-center gap-4 text-gray-300">
                                    <span className={userInteracted ? 'text-green-400' : 'text-red-400'}>
                                        🎵 Audio: {userInteracted ? 'Activé' : 'En attente'}
                                    </span>
                                    <span>Vol: {Math.round(volumeControlProps.audioVolume * 100)}%</span>
                                    <span className={canAnswer ? 'text-green-400' : 'text-red-400'}>
                                        Réponse: {canAnswer ? 'Possible' : 'Bloquée'}
                                    </span>
                                    <span className={timerStarted ? 'text-green-400' : 'text-orange-400'}>
                                        Timer: {timerStarted ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {timeLeft !== null && (
                        <div className={`text-center mb-6 ${timeLeft < 10 ? 'animate-pulse' : ''}`}>
                            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-2xl ${timeLeft < 10
                                ? 'bg-gradient-to-r from-red-500/30 to-pink-500/30 border border-red-400/50 text-red-400'
                                : 'bg-gradient-to-r from-cyan-500/30 to-purple-500/30 border border-cyan-400/50 text-cyan-300'
                                }`}>
                                ⏳ {timeLeft}s
                            </div>
                        </div>
                    )}

                    <div className="mb-4">
                        {/* Affichage du feedback de réponse (priorité absolue) */}
                        {answerFeedback?.show ? (
                            <div className={`text-center p-4 rounded-2xl transition-all duration-300 ${answerFeedback.isCorrect
                                ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30 feedback-bounce'
                                : 'bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-400/30'
                                }`}>
                                <div className="text-3xl mb-2">
                                    {answerFeedback.isCorrect ? '✅' : '❌'}
                                </div>
                                <p className={`font-bold text-base ${answerFeedback.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                    {answerFeedback.isCorrect ? t('goodAnswer') : t('wrongAnswer')}
                                </p>
                            </div>
                        )

                            : players?.find(p => p?.pseudo === pseudo)?.hasFoundThisRound ? (
                                <div className="text-center p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30 rounded-2xl">
                                    <div className="text-3xl mb-2">✅</div>
                                    <p className="text-green-400 font-bold text-base">
                                        {t('youAlreadyFoundThisRound')}
                                    </p>
                                </div>
                            )

                                /* Peut répondre (conditions idéales) */
                                : !hasAnswered && canAnswer && timerStarted ? (
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            placeholder={t('typeYourAnswer')}
                                            value={answer}
                                            onChange={(e) => setAnswer(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && answer.trim()) handleSubmitAnswer();
                                            }}
                                            className={`${modernInput} w-full p-3 text-lg text-center`}
                                            autoFocus={true}
                                        />
                                        <button
                                            onClick={handleSubmitAnswer}
                                            disabled={!answer.trim()}
                                            className={`w-full py-3 rounded-2xl font-bold text-base transition-all duration-300 ${!answer.trim()
                                                ? 'bg-zinc-600 text-zinc-400 cursor-not-allowed'
                                                : `${modernButton} transform hover:scale-105`
                                                }`}
                                        >
                                            {t('sendMyAnswer')}
                                        </button>
                                    </div>
                                )

                                    /* Timer pas encore démarré */
                                    : !timerStarted && !hasAnswered && canAnswer ? (
                                        <div className="text-center p-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 rounded-2xl">
                                            <div className="text-3xl mb-2">⏳</div>
                                            <p className="text-blue-400 font-bold text-base">
                                                {t('waitForSignal')}
                                            </p>
                                        </div>
                                    )

                                        /* A répondu, en attente du serveur */
                                        : hasAnswered ? (
                                            <div className="text-center p-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 rounded-2xl">
                                                <div className="text-lg mb-1">⏳</div>
                                                <p className="text-blue-400 font-bold text-sm">
                                                    {t('waitingForServer')}
                                                </p>
                                            </div>
                                        )

                                            /* Ne peut pas répondre */
                                            : !canAnswer ? (
                                                <div className="text-center p-4 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-400/30 rounded-2xl">
                                                    <div className="text-3xl mb-2">🔒</div>
                                                    <p className="text-orange-400 font-bold text-base">
                                                        {t('waitForSignal')}
                                                    </p>
                                                </div>
                                            )

                                                /* État inconnu (fallback) */
                                                : (
                                                    <div className="text-center p-4 bg-gradient-to-r from-gray-500/20 to-gray-600/20 border border-gray-500/30 rounded-2xl">
                                                        <div className="text-lg mb-1">❓</div>
                                                        <p className="text-gray-400 text-sm">
                                                            {t('unknownState')}
                                                        </p>
                                                    </div>
                                                )}
                    </div>

                    {/* ✅ CORRIGÉ : Scoreboard moderne avec avatars Discord et protection */}
                    <div>
                        <h3 className="text-2xl font-bold text-center mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                            {t('liveScoreboard')}
                        </h3>
                        <div className="bg-zinc-700/30 backdrop-blur-sm rounded-2xl p-4 space-y-3">
                            {players?.filter(Boolean)
                                .sort((a, b) => (scores?.[b?.pseudo] || 0) - (scores?.[a?.pseudo] || 0))
                                .map((player, index) => {
                                    if (!player || !player.pseudo) return null;

                                    return (
                                        <div
                                            key={player.pseudo}
                                            className={`flex justify-between items-center p-4 rounded-xl transition-all duration-300 ${player.pseudo === pseudo
                                                ? 'bg-gradient-to-r from-cyan-500/30 to-purple-500/30 border border-cyan-400/50 transform scale-105'
                                                : player.connected
                                                    ? 'bg-zinc-600/50 hover:bg-zinc-600/70'
                                                    : 'bg-red-900/30 border border-red-500/30'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                {/* ✅ CORRIGÉ : Avatar ou rang avec avatar Discord */}
                                                <div className="flex items-center gap-3">
                                                    {/* Avatar Discord ou rang coloré */}
                                                    {getPlayerAvatar(player) ? (
                                                        <div className="relative">
                                                            <img
                                                                src={getPlayerAvatar(player)}
                                                                alt={`Avatar de ${player.pseudo}`}
                                                                className="w-12 h-12 rounded-full border-2 border-zinc-600"
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                    e.target.nextSibling.style.display = 'flex';
                                                                }}
                                                            />
                                                            {/* Badge rang sur l'avatar */}
                                                            <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black' :
                                                                index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-500 text-black' :
                                                                    index === 2 ? 'bg-gradient-to-r from-orange-400 to-red-500 text-white' :
                                                                        'bg-gradient-to-r from-zinc-500 to-zinc-600 text-white'
                                                                }`}>
                                                                {index + 1}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${index === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black' :
                                                            index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-500 text-black' :
                                                                index === 2 ? 'bg-gradient-to-r from-orange-400 to-red-500 text-white' :
                                                                    'bg-gradient-to-r from-zinc-500 to-zinc-600 text-white'
                                                            }`}>
                                                            {index + 1}
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-bold text-lg ${player.connected ? 'text-white' : 'text-red-400'}`}>
                                                            {player.pseudo}
                                                        </span>

                                                        {/* ✅ CORRIGÉ : Badges Discord et couronne */}
                                                        <div className="flex items-center gap-1">
                                                            {index === 0 && <span className="text-2xl">👑</span>}
                                                            {isDiscordPlayer(player) && (
                                                                <span className="text-xs bg-indigo-500 text-white px-1.5 py-0.5 rounded-full" title="Utilisateur Discord">
                                                                    🔗
                                                                </span>
                                                            )}
                                                        </div>

                                                        {!player.connected && (
                                                            <div className="flex items-center gap-1">
                                                                {player.isReconnecting ? (
                                                                    <span className="text-yellow-400 text-sm animate-pulse">🔄</span>
                                                                ) : (
                                                                    <span className="text-red-400 text-sm">🔴</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!player.connected && (
                                                        <p className={`text-xs ${player.isReconnecting ? 'text-yellow-300' : 'text-red-300'}`}>
                                                            {player.isReconnecting ? t('reconnecting') : t('disconnected')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className={`font-bold text-xl ${player.connected ? 'text-white' : 'text-red-400'}`}>
                                                    {scores?.[player.pseudo] || 0} pts
                                                </span>
                                                <div className="text-2xl">
                                                    {player.connected ? getPlayerAnswerIcon(player) : '🔴'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameView;