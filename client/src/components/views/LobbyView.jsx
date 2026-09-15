import { useEffect, useRef, useState } from 'react';

const LobbyView = ({
    room,
    pseudo,
    isCreator,
    creatorPseudo,
    players,
    scores,
    isReady,
    editingPseudo,
    newPseudo,
    showSettings,
    localArtistCount,
    localAnswerTime,
    artistCountRange,
    answerTimeSettings,
    shareLink,
    error,
    socketMethods,  // ✅ AJOUTER CETTE LIGNE
    // Handlers
    setEditingPseudo,
    setNewPseudo,
    setShowSettings,
    setLocalArtistCount,
    setLocalAnswerTime,
    handleChangePseudo,
    handleToggleReady,
    handleStartGame,
    handleKickPlayer,
    handleTransferHost,
    // UI Components
    modernBackground,
    modernCard,
    modernButton,
    modernInput,
    AnimatedBackground,
    LanguageSwitch,
    GameModeBadge,
    t,
    onBackToHub,
    forceEnableAudio, // ✅ NOUVEAU
    needsAudioUnlock   // ✅ NOUVEAU
}) => {
    const allPlayersReady = players.length >= 1 && players.every(p => p.ready);

    // État local pour gérer le bouton copier lien
    const [copyButtonText, setCopyButtonText] = useState(t('copyLink') || 'Copier lien');
    const [isCopying, setIsCopying] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false); // ✅ NOUVEAU

    // ✅ NOUVEAU : Fonction pour obtenir l'avatar Discord avec vérifications
    const getPlayerAvatar = (player) => {
        if (!player) return null;
        if (player.isDiscordUser && player.avatarUrl) {
            return player.avatarUrl;
        }
        return null;
    };

    // ✅ NOUVEAU : Vérifier si un joueur est un utilisateur Discord avec vérifications
    const isDiscordPlayer = (player) => {
        if (!player) return false;
        return player.isDiscordUser && player.discordId;
    };

    // ✅ CORRECTION : Vérifier si le pseudo peut être édité avec vérifications de sécurité
    const canEditPseudo = (playerPseudo) => {
        if (!playerPseudo || !Array.isArray(players)) return true;
        const player = players.find(p => p && p.pseudo === playerPseudo);
        if (!player) return true; // Si le joueur n'est pas trouvé, permettre l'édition
        return !isDiscordPlayer(player);
    };

    // Fonction locale pour copier le lien
    const handleLocalCopyLink = async () => {
        if (!shareLink || isCopying) return;

        setIsCopying(true);

        try {
            await navigator.clipboard.writeText(shareLink);
            setCopyButtonText('✅ Lien copié !');
            console.log('📋 Lien copié:', shareLink);
        } catch (err) {
            console.warn('Erreur copie lien:', err);
            try {
                const textArea = document.createElement('textarea');
                textArea.value = shareLink;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                setCopyButtonText('✅ Lien copié !');
            } catch (fallbackErr) {
                setCopyButtonText('❌ Erreur');
            }
        }

        setTimeout(() => {
            setCopyButtonText(t('copyLink') || 'Copier lien');
            setIsCopying(false);
        }, 2000);
    };

    // ✅ CORRECTION : Fonction sécurisée pour trouver le joueur actuel
    const getCurrentPlayer = () => {
        if (!Array.isArray(players) || !pseudo) return null;
        return players.find(p => p && p.pseudo === pseudo);
    };

    return (
        <div className={modernBackground}>
            <AnimatedBackground />
            <LanguageSwitch />

            {/* ✅ NOUVEAU : Boutons en haut à gauche */}
            <div className="fixed top-4 left-4 z-40 flex gap-2">
                {onBackToHub && (
                    <button
                        onClick={onBackToHub}
                        className="px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700/80 backdrop-blur-sm border border-zinc-600/50 text-zinc-300 hover:text-white rounded-lg transition-all duration-300 text-sm font-semibold inline-flex items-center gap-2"
                    >
                        ← {t('backToHub')}
                    </button>
                )}
                <button
                    onClick={() => setShowInstructions(true)}
                    className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 rounded-lg transition-all duration-300 text-sm font-semibold inline-flex items-center gap-2"
                >
                    📖 {t('howToPlay')}
                </button>
            </div>

            <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 relative z-10">
                <div className={`${modernCard} p-6 md:p-8 max-w-4xl w-full mx-4 relative`}>
                    {/* Header avec bouton de configuration */}
                    <div className="text-center mb-6 md:mb-8 relative">
                        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2 md:mb-3">
                            Room {room}
                        </h2>
                        <div className="flex items-center justify-center gap-2 mb-2 md:mb-3">
                            <GameModeBadge />
                        </div>
                        <div className="flex items-center justify-center gap-2">
                            {isCreator && (
                                <>
                                    <span className="text-yellow-400 text-lg md:text-xl">👑</span>
                                    <span className="text-green-400 text-sm md:text-base font-semibold">{t('youAreTheCreator')}</span>
                                    <button
                                        onClick={() => setShowSettings(!showSettings)}
                                        className="ml-4 px-3 py-1 bg-purple-500 hover:bg-purple-400 text-white rounded-lg text-xs md:text-sm transition-all duration-300 flex items-center gap-1"
                                    >
                                        {t('config')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Panneau de configuration coulissant */}
                    {isCreator && showSettings && (
                        <div className="absolute top-0 right-0 h-full w-80 bg-gradient-to-br from-zinc-800/95 to-zinc-900/95 backdrop-blur-sm border border-zinc-700/50 rounded-r-3xl transform transition-transform duration-300 z-20 translate-x-0">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-purple-400">{t('configuration')}</h3>
                                    <button
                                        onClick={() => setShowSettings(false)}
                                        className="px-2 py-1 bg-red-500 hover:bg-red-400 text-white rounded text-sm transition"
                                    >
                                        {t('close')}
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {/* Configuration des artistes */}
                                    <div>
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-cyan-400 font-semibold text-sm">{t('numberOfArtists')}</span>
                                            <div className="text-right">
                                                <span className="text-white font-bold text-xl">
                                                    {localArtistCount}
                                                </span>
                                                <div className="text-xs text-zinc-400">
                                                    {t('outOfAvailable', { max: artistCountRange?.max || 50 })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <input
                                                type="range"
                                                min={artistCountRange?.min || 10}
                                                max={artistCountRange?.max || 50}
                                                value={localArtistCount}
                                                onChange={(e) => {
                                                    const newValue = parseInt(e.target.value);
                                                    setLocalArtistCount(newValue);
                                                    // ✅ Envoyer immédiatement au serveur
                                                    if (isCreator) {
                                                        socketMethods.updateArtistCount(newValue);
                                                    }
                                                }}
                                                className="slider w-full"
                                                style={{
                                                    background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${((localArtistCount - (artistCountRange?.min || 10)) / ((artistCountRange?.max || 50) - (artistCountRange?.min || 10))) * 100}%, #4b5563 ${((localArtistCount - (artistCountRange?.min || 10)) / ((artistCountRange?.max || 50) - (artistCountRange?.min || 10))) * 100}%, #4b5563 100%)`
                                                }}
                                            />
                                        </div>

                                        <div className="flex justify-between text-xs text-zinc-400 mt-2">
                                            <span>{t('minLabel', { min: artistCountRange?.min || 10 })}</span>
                                            <span>{t('maxLabel', { max: artistCountRange?.max || 50 })}</span>
                                        </div>

                                        <div className="mt-3 text-center">
                                            <p className="text-zinc-500 text-xs">
                                                {t('appliedAtGameStart')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Configuration du temps de réponse */}
                                    <div>
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-cyan-400 font-semibold text-sm">{t('answerTime')}</span>
                                            <div className="text-right">
                                                <span className="text-white font-bold text-xl">
                                                    {localAnswerTime}s
                                                </span>
                                                <div className="text-xs text-zinc-400">
                                                    {t('timeBetween', { min: answerTimeSettings?.min || 5, max: answerTimeSettings?.max || 60 })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <input
                                                type="range"
                                                min={answerTimeSettings?.min || 5}
                                                max={answerTimeSettings?.max || 60}
                                                value={localAnswerTime}
                                                onChange={(e) => {
                                                    const newValue = parseInt(e.target.value);
                                                    setLocalAnswerTime(newValue);
                                                    // ✅ Envoyer immédiatement au serveur
                                                    if (isCreator) {
                                                        socketMethods.updateAnswerTime(newValue);
                                                    }
                                                }}
                                                className="slider w-full"
                                                style={{
                                                    background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${((localAnswerTime - (answerTimeSettings?.min || 5)) / ((answerTimeSettings?.max || 60) - (answerTimeSettings?.min || 5))) * 100}%, #4b5563 ${((localAnswerTime - (answerTimeSettings?.min || 5)) / ((answerTimeSettings?.max || 60) - (answerTimeSettings?.min || 5))) * 100}%, #4b5563 100%)`
                                                }}
                                            />
                                        </div>

                                        <div className="flex justify-between text-xs text-zinc-400 mt-2">
                                            <span>{t('minLabel', { min: answerTimeSettings?.min || 5 })}s</span>
                                            <span>{t('maxLabel', { max: answerTimeSettings?.max || 60 })}s</span>
                                        </div>

                                        <div className="mt-3 text-center">
                                            <p className="text-zinc-500 text-xs">
                                                {t('timeToGuessArtist')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Gestion des joueurs */}
                                    <div>
                                        <h4 className="text-cyan-400 font-semibold text-sm mb-3">{t('playerManagement')}</h4>
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {Array.isArray(players) && players.filter(p => p && p.pseudo !== pseudo).map((player) => (
                                                <div key={player.pseudo} className="flex items-center justify-between p-2 bg-zinc-700/50 rounded-lg">
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        {/* ✅ NOUVEAU : Avatar Discord avec vérifications */}
                                                        {getPlayerAvatar(player) ? (
                                                            <img
                                                                src={getPlayerAvatar(player)}
                                                                alt={`Avatar de ${player.pseudo}`}
                                                                className="w-6 h-6 rounded-full border border-zinc-600"
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 flex items-center justify-center text-xs font-bold text-black">
                                                                {player.pseudo ? player.pseudo.charAt(0).toUpperCase() : '?'}
                                                            </div>
                                                        )}

                                                        <span className="text-white text-sm truncate flex items-center gap-1">
                                                            {player.pseudo}
                                                            {/* ✅ NOUVEAU : Badge Discord avec vérifications */}
                                                            {isDiscordPlayer(player) && (
                                                                <span className="text-xs bg-indigo-500 text-white px-1 rounded" title="Utilisateur Discord">
                                                                    🔗
                                                                </span>
                                                            )}
                                                        </span>

                                                        {player.pseudo === creatorPseudo && <span className="text-yellow-400 text-xs">👑</span>}
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <button
                                                            onClick={() => handleTransferHost(player.pseudo)}
                                                            className="px-2 py-1 bg-yellow-500 hover:bg-yellow-400 text-white rounded text-xs font-bold transition shadow-lg hover:shadow-xl transform hover:scale-105"
                                                            title={t('giveHostTo', { pseudo: player.pseudo })}
                                                        >
                                                            👑
                                                        </button>
                                                        <button
                                                            onClick={() => handleKickPlayer(player.pseudo)}
                                                            className="px-2 py-1 bg-red-500 hover:bg-red-400 text-white rounded text-xs font-bold transition shadow-lg hover:shadow-xl transform hover:scale-105"
                                                            title={t('excludePlayer', { pseudo: player.pseudo })}
                                                        >
                                                            ❌
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!Array.isArray(players) || players.filter(p => p && p.pseudo !== pseudo).length === 0) && (
                                                <p className="text-zinc-500 text-xs text-center py-2">
                                                    {t('noOtherPlayersToManage')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Overlay pour fermer le panneau */}
                    {isCreator && showSettings && (
                        <div
                            className="absolute inset-0 bg-black/30 backdrop-blur-sm z-10"
                            onClick={() => setShowSettings(false)}
                        />
                    )}

                    <div className="space-y-4 md:space-y-5 max-w-3xl mx-auto">
                        {/* ✅ MODIFICATION : Section pseudo avec protection Discord et vérifications */}
                        <div className="bg-zinc-700/30 backdrop-blur-sm rounded-xl p-3 border border-zinc-600/30">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {/* ✅ NOUVEAU : Avatar du joueur actuel avec vérifications */}
                                    {(() => {
                                        const currentPlayer = getCurrentPlayer();
                                        const avatarUrl = getPlayerAvatar(currentPlayer);
                                        return avatarUrl ? (
                                            <img
                                                src={avatarUrl}
                                                alt="Mon avatar"
                                                className="w-8 h-8 rounded-full border border-zinc-600"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 flex items-center justify-center text-sm font-bold text-black">
                                                {pseudo ? pseudo.charAt(0).toUpperCase() : '?'}
                                            </div>
                                        );
                                    })()}

                                    <span className="text-cyan-400 font-semibold text-sm whitespace-nowrap">{t('pseudo')}</span>

                                    {editingPseudo ? (
                                        <input
                                            type="text"
                                            value={newPseudo}
                                            onChange={(e) => setNewPseudo(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleChangePseudo();
                                                if (e.key === 'Escape') {
                                                    setEditingPseudo(false);
                                                    setNewPseudo('');
                                                }
                                            }}
                                            onBlur={() => {
                                                setTimeout(() => {
                                                    if (editingPseudo) {
                                                        setEditingPseudo(false);
                                                        setNewPseudo('');
                                                    }
                                                }, 100);
                                            }}
                                            className={`${modernInput} px-2 py-1 text-sm flex-1 min-w-0`}
                                            placeholder={pseudo}
                                            autoFocus
                                            maxLength={20}
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className="text-white font-bold text-sm truncate">{pseudo}</span>
                                            {/* ✅ NOUVEAU : Badge Discord pour le joueur actuel avec vérifications */}
                                            {(() => {
                                                const currentPlayer = getCurrentPlayer();
                                                return isDiscordPlayer(currentPlayer) && (
                                                    <span className="text-xs bg-indigo-500 text-white px-2 py-1 rounded-full" title="Connecté via Discord">
                                                        🔗 Discord
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                    {editingPseudo ? (
                                        <>
                                            <button
                                                onClick={handleChangePseudo}
                                                className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-400 transition"
                                            >
                                                ✅
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingPseudo(false);
                                                    setNewPseudo('');
                                                }}
                                                className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-400 transition"
                                            >
                                                ❌
                                            </button>
                                        </>
                                    ) : (
                                        /* ✅ MODIFICATION : Bouton d'édition seulement si pas Discord avec vérifications */
                                        canEditPseudo(pseudo) && (
                                            <button
                                                onClick={() => {
                                                    setEditingPseudo(true);
                                                    setNewPseudo(pseudo);
                                                }}
                                                className="px-2 py-1 bg-cyan-500 text-white rounded text-xs hover:bg-cyan-400 transition"
                                            >
                                                ✏️
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Section de partage */}
                        <div className="bg-zinc-700/30 backdrop-blur-sm rounded-xl p-3 border border-zinc-600/30">
                            <div className="flex items-center gap-3">
                                <span className="text-zinc-300 font-semibold text-sm whitespace-nowrap">🔗 Code :</span>
                                <div className="flex-1 p-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/30 rounded-lg text-cyan-300 font-mono text-lg text-center font-bold">
                                    {room}
                                </div>
                                <button
                                    onClick={handleLocalCopyLink}
                                    disabled={isCopying}
                                    className={`px-3 py-2 text-white rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-300 ${isCopying
                                        ? 'bg-green-500'
                                        : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400'
                                        }`}
                                >
                                    {copyButtonText}
                                </button>
                            </div>
                        </div>

                        {/* Liste des joueurs - GRILLE UNIFORMISÉE */}
                        <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm md:text-base font-bold text-cyan-400">
                                    {t('players', { count: Array.isArray(players) ? players.length : 0 })}
                                </h3>
                                {(Array.isArray(players) ? players.length : 0) < 1 && (
                                    <p className="text-xs text-amber-400 animate-pulse">
                                        {t('minimumTwoPlayersToStart')}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {Array.isArray(players) && players.map((player, index) => {
                                    if (!player) return null;
                                    const isCurrentPlayer = player.pseudo === pseudo;
                                    const avatarUrl = getPlayerAvatar(player);
                                    const isDiscord = isDiscordPlayer(player);

                                    return (
                                        <div
                                            key={player.pseudo || index}
                                            className={`bg-zinc-900/50 border rounded-xl p-3 text-center transition-all duration-300 relative ${player.connected
                                                ? 'border-zinc-700/50 hover:border-cyan-500/50'
                                                : 'border-red-500/50 opacity-60'
                                                } ${isCurrentPlayer ? 'ring-2 ring-cyan-500/50' : ''}`}
                                        >
                                            {/* Bouton kick (créateur seulement) */}
                                            {isCreator && !isCurrentPlayer && (
                                                <button
                                                    onClick={() => handleKickPlayer(player.pseudo)}
                                                    className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 hover:bg-red-600 text-white rounded-full text-xs font-bold transition-all duration-200 flex items-center justify-center z-10"
                                                    title={t('excludePlayer', { pseudo: player.pseudo })}
                                                >
                                                    ✕
                                                </button>
                                            )}

                                            {/* Avatar ou photo Discord */}
                                            {avatarUrl ? (
                                                <img
                                                    src={avatarUrl}
                                                    alt={player.pseudo}
                                                    className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-cyan-400 mx-auto mb-2"
                                                />
                                            ) : (
                                                <div className="text-3xl md:text-4xl mb-2">
                                                    {player.emoji || '🎤'}
                                                </div>
                                            )}

                                            {/* Pseudo */}
                                            <div className="mb-2">
                                                {isCurrentPlayer && editingPseudo ? (
                                                    <div className="flex flex-col gap-1">
                                                        <input
                                                            type="text"
                                                            value={newPseudo}
                                                            onChange={(e) => setNewPseudo(e.target.value)}
                                                            className="w-full px-2 py-1 bg-zinc-800 border border-cyan-500 rounded text-white text-xs text-center"
                                                            maxLength={20}
                                                            autoFocus
                                                        />
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={handleChangePseudo}
                                                                className="flex-1 px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs"
                                                            >
                                                                ✓
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingPseudo(false);
                                                                    setNewPseudo(pseudo);
                                                                }}
                                                                className="flex-1 px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <p className="text-sm md:text-base font-bold text-white truncate px-1">
                                                            {player.pseudo}
                                                        </p>
                                                        {isCurrentPlayer && canEditPseudo(player.pseudo) && (
                                                            <button
                                                                onClick={() => {
                                                                    setEditingPseudo(true);
                                                                    setNewPseudo(player.pseudo);
                                                                }}
                                                                className="text-cyan-400 hover:text-cyan-300 text-xs"
                                                                title={t('changePseudo')}
                                                            >
                                                                ✏️
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Badges */}
                                            <div className="flex flex-col gap-1 items-center">
                                                {/* Badge Discord */}
                                                {isDiscord && (
                                                    <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30">
                                                        Discord
                                                    </span>
                                                )}

                                                {/* Badge Créateur */}
                                                {player.pseudo === creatorPseudo && (
                                                    <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full border border-yellow-500/30">
                                                        👑 {t('host')}
                                                    </span>
                                                )}

                                                {/* Badge Déconnecté */}
                                                {!player.connected && (
                                                    <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
                                                        🔴 {t('disconnected')}
                                                    </span>
                                                )}

                                                {/* Score */}
                                                <span className="text-sm font-bold text-zinc-300">
                                                    {(scores && scores[player.pseudo]) || 0} pts
                                                </span>

                                                {/* Status Ready */}
                                                <div className="text-xl">
                                                    {!player.connected ? '🔴' : player.ready ? '✅' : '⏳'}
                                                </div>
                                            </div>

                                            {/* Menu gestion (créateur uniquement) */}
                                            {isCreator && !isCurrentPlayer && (
                                                <div className="mt-2 pt-2 border-t border-zinc-700/50">
                                                    <button
                                                        onClick={() => handleTransferHost(player.pseudo)}
                                                        className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
                                                        title={t('giveHostTo', { pseudo: player.pseudo })}
                                                    >
                                                        👑 {t('giveHost')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {(!Array.isArray(players) || players.length === 0) && (
                                    <div className="col-span-full text-center text-zinc-400 py-4">
                                        <p className="text-sm">{t('noPlayersConnected')}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Boutons d'action */}
                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    // ✅ Débloquer l'audio sur iOS/Safari au premier clic
                                    if (needsAudioUnlock && forceEnableAudio) {
                                        forceEnableAudio();
                                    }
                                    handleToggleReady();
                                }}
                                className={`w-full py-3 rounded-xl font-bold text-base transition-all duration-300 transform hover:scale-105 ${isReady
                                    ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white'
                                    : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white'
                                    }`}
                            >
                                {isReady ? t('notReady') : t('ready')}
                            </button>

                            {isCreator && allPlayersReady && (
                                <button
                                    onClick={() => {
                                        // ✅ Débloquer l'audio sur iOS/Safari au clic
                                        if (needsAudioUnlock && forceEnableAudio) {
                                            forceEnableAudio();
                                        }
                                        handleStartGame();
                                    }}
                                    className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-zinc-900 font-bold text-base transition-all duration-300 transform hover:scale-105 animate-pulse"
                                >
                                    {t('startTheGame')}
                                </button>
                            )}

                            {allPlayersReady && !isCreator && (
                                <div className="text-center text-green-400 font-semibold bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                                    <p className="text-sm">{t('waitingForHostToStart', { host: creatorPseudo })}</p>
                                </div>
                            )}

                            {!allPlayersReady && (
                                <div className="text-center text-zinc-400 bg-zinc-700/30 rounded-xl p-3">
                                    <p className="text-sm">
                                        {(Array.isArray(players) ? players.length : 0) < 1
                                            ? t('minimumTwoPlayersToStart')
                                            : t('allPlayersMustBeReady')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="mt-4 p-3 bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 rounded-xl max-w-3xl mx-auto">
                            <p className="text-red-400 text-center text-sm">{error}</p>
                        </div>
                    )}

                    {showInstructions && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
                            <div
                                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                                onClick={() => setShowInstructions(false)}
                            ></div>

                            <div className="relative bg-zinc-900 border-2 border-cyan-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-cyan-500/20 animate-scaleIn">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold text-cyan-400">📖 {t('howToPlay')}</h3>
                                    <button
                                        onClick={() => setShowInstructions(false)}
                                        className="text-zinc-400 hover:text-white text-2xl transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {/* Contenu */}
                                <div className="space-y-3 text-zinc-300 text-sm">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">🎵</span>
                                        <div>
                                            <strong>1.</strong> {t('blindTestInstruction1')}
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">⏱️</span>
                                        <div>
                                            <strong>2.</strong> {t('blindTestInstruction2')}
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">✍️</span>
                                        <div>
                                            <strong>3.</strong> {t('blindTestInstruction3')}
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">✅</span>
                                        <div>
                                            <strong>4.</strong> {t('blindTestInstruction4')}
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">🏆</span>
                                        <div>
                                            <strong>5.</strong> {t('blindTestInstruction5')}
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">👥</span>
                                        <div>
                                            <strong>6.</strong> {t('blindTestInstruction6')}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowInstructions(false)}
                                    className="w-full mt-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-bold rounded-lg transition-all"
                                >
                                    {t('understood')}
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default LobbyView;