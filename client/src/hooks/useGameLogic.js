import { useCallback } from 'react';
import socketOnline from '../socketOnline';
/**
 * Hook personnalisé pour gérer la logique métier du jeu
 * ✅ VERSION SIMPLIFIÉE avec fix pour les messages de succès
 */
export const useGameLogic = ({
    pseudo,
    room,
    gameMode,
    localArtistCount,
    localAnswerTime,
    artistCountRange,
    answerTimeSettings,
    answer,
    hasAnswered,
    canAnswer,
    timerStarted,
    players,
    newPseudo,
    isCreator,
    shareLink,
    socketMethods,
    saveUserSession,
    clearUserSession,
    stopAllAudio,
    setError,
    setView,
    setIsReady,
    setEditingPseudo,
    setNewPseudo,
    setHasAnswered,
    setPseudo,
    VIEWS,
    t
}) => {

    // ✅ NOUVEAU : Fonction pour les messages de succès
    const showSuccess = useCallback((message) => {
        // Utiliser setError mais on sait que c'est un succès
        // On pourrait créer un état séparé pour les succès mais gardons simple
        setError(`✅ ${message}`);
        setTimeout(() => setError(''), 2000); // Plus court pour les succès
    }, [setError]);

    // ✅ HANDLERS DE ROOM AVEC VALIDATION AMÉLIORÉE
    const handleCreateRoom = useCallback(() => {
        if (!pseudo?.trim()) {
            setError(t('pseudoRequired') || 'Pseudo requis');
            setTimeout(() => setError(''), 3000);
            return false;
        }

        if (!socketMethods.isConnected()) {
            setError(t('notConnected') || 'Non connecté au serveur');
            setTimeout(() => setError(''), 3000);
            return false;
        }

        const trimmedPseudo = pseudo.trim();
        setPseudo(trimmedPseudo);

        console.log('🎮 Création de room:', { pseudo: trimmedPseudo, gameMode });
        setView(VIEWS.LOADING);
        socketMethods.createRoom(trimmedPseudo, gameMode);
        return true;
    }, [pseudo, gameMode, socketMethods, setError, setView, setPseudo, t, VIEWS]);

    const handleJoinRoom = useCallback((roomCode = room) => {
        if (!pseudo?.trim()) {
            setError(t('pseudoRequired') || 'Pseudo requis');
            setTimeout(() => setError(''), 3000);
            return false;
        }

        if (!roomCode?.trim()) {
            setError(t('roomCodeRequired') || 'Code de room requis');
            setTimeout(() => setError(''), 3000);
            return false;
        }

        if (!socketMethods.isConnected()) {
            setError(t('notConnected') || 'Non connecté au serveur');
            setTimeout(() => setError(''), 3000);
            return false;
        }

        const trimmedPseudo = pseudo.trim();
        const trimmedRoom = roomCode.trim().toUpperCase();

        setPseudo(trimmedPseudo);
        console.log('🚪 Join room:', { pseudo: trimmedPseudo, room: trimmedRoom, gameMode });

        setView(VIEWS.LOADING);
        socketMethods.joinRoom(trimmedRoom, trimmedPseudo, gameMode);
        return true;
    }, [pseudo, room, gameMode, socketMethods, setError, setView, setPseudo, t, VIEWS]);

    // ✅ NOUVELLE PARTIE SIMPLIFIÉE
    const handleNewGame = useCallback(() => {
        console.log('🆕 Nouvelle partie demandée par l\'utilisateur');

        // Nettoyage complet
        clearUserSession();
        stopAllAudio();

        // Nettoyer l'URL
        if (window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname + '#/blindtest-online');
        }

        showSuccess('Session nettoyée');

        // Redirection vers CREATE après confirmation
        setTimeout(() => {
            setView(VIEWS.CREATE);
        }, 1000);
    }, [clearUserSession, stopAllAudio, showSuccess, setView, VIEWS]);

    // ✅ RETRY SIMPLIFIÉ
    const handleRetry = useCallback(() => {
        console.log('🔄 Retry demandé par l\'utilisateur');

        if (socketMethods.isConnected()) {
            showSuccess('Déjà connecté');
            return;
        }

        setError('Reconnexion en cours...');
        socketMethods.reconnect();

        setTimeout(() => {
            if (!socketMethods.isConnected()) {
                setError('Échec de reconnexion. Vérifiez votre connexion internet.');
                setTimeout(() => setError(''), 5000);
            } else {
                showSuccess('Reconnecté !');
            }
        }, 5000);
    }, [socketMethods, setError, showSuccess]);

    // ✅ HANDLERS DE LOBBY
    const handleChangePseudo = useCallback(() => {
        if (!newPseudo?.trim() || newPseudo.trim() === pseudo?.trim()) {
            setEditingPseudo(false);
            setNewPseudo('');
            return;
        }

        if (!socketMethods.isConnected()) {
            setError(t('notConnected') || 'Non connecté');
            setTimeout(() => setError(''), 3000);
            return;
        }

        socketMethods.changePseudo(pseudo, newPseudo.trim());
    }, [newPseudo, pseudo, socketMethods, setEditingPseudo, setNewPseudo, setError, t]);

    const handleToggleReady = useCallback(() => {
        if (!socketMethods.isConnected()) {
            setError(t('notConnected') || 'Non connecté');
            setTimeout(() => setError(''), 3000);
            return;
        }

        setIsReady(prev => !prev);
        socketMethods.toggleReady();
    }, [setIsReady, socketMethods, setError, t]);

    const handleStartGame = useCallback(async () => {
        if (!isCreator) {
            setError(t('notCreator') || 'Vous n\'êtes pas le créateur');
            setTimeout(() => setError(''), 3000);
            return;
        }

        if (!socketMethods.isConnected()) {
            setError(t('notConnected') || 'Non connecté');
            setTimeout(() => setError(''), 3000);
            return;
        }

        const needsArtistUpdate = localArtistCount !== artistCountRange.current;
        const needsTimeUpdate = localAnswerTime !== answerTimeSettings.current;

        console.log('🚀 Démarrage de partie:', {
            artistUpdate: needsArtistUpdate,
            timeUpdate: needsTimeUpdate,
            localArtistCount,
            localAnswerTime,
            room
        });

        try {
            // ✅ NOUVEAU : Attendre les confirmations des mises à jour
            const updatePromises = [];

            if (needsArtistUpdate) {
                updatePromises.push(
                    new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject('Timeout artist count'), 3000);

                        const handler = (result) => {
                            clearTimeout(timeout);
                            socketOnline.off('artist-count-update-result', handler);
                            if (result.success) {
                                console.log('✅ Artist count confirmé:', result.newCount);
                                resolve();
                            } else {
                                reject(result.error);
                            }
                        };

                        socketOnline.on('artist-count-update-result', handler);
                        socketMethods.updateArtistCount(localArtistCount);
                    })
                );
            }

            if (needsTimeUpdate) {
                updatePromises.push(
                    new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject('Timeout answer time'), 3000);

                        const handler = (result) => {
                            clearTimeout(timeout);
                            socketOnline.off('answer-time-update-result', handler);
                            if (result.success) {
                                console.log('✅ Answer time confirmé:', result.newTime);
                                resolve();
                            } else {
                                reject(result.error);
                            }
                        };

                        socketOnline.on('answer-time-update-result', handler);
                        socketMethods.updateAnswerTime(localAnswerTime);
                    })
                );
            }

            // ✅ Attendre que toutes les mises à jour soient confirmées
            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
                console.log('✅ Toutes les configurations confirmées, démarrage...');
            }

            // ✅ Démarrer maintenant que tout est synchronisé
            socketMethods.startGame(room);

        } catch (error) {
            console.error('❌ Erreur lors de la configuration:', error);
            setError('Erreur de configuration - Réessayez');
            setTimeout(() => setError(''), 3000);
        }
    }, [isCreator, localArtistCount, localAnswerTime, artistCountRange.current, answerTimeSettings.current, room, socketMethods, setError, t]);

    // ✅ HANDLERS DE JEU
    const handleSubmitAnswer = useCallback(() => {
        if (!answer?.trim()) {
            console.log('❌ Pas de réponse à soumettre');
            return;
        }

        if (hasAnswered) {
            console.log('❌ Déjà répondu');
            return;
        }

        if (!canAnswer || !timerStarted) {
            console.log('❌ Ne peut pas répondre maintenant');
            return;
        }

        if (!socketMethods.isConnected()) {
            setError(t('notConnected') || 'Non connecté');
            setTimeout(() => setError(''), 3000);
            return;
        }

        // Synchronisation avec le serveur si nécessaire
        const serverPlayer = players.find(p => p.socketId === socketMethods.socketId && p.connected);
        if (serverPlayer && serverPlayer.pseudo !== pseudo) {
            console.log('🔄 Synchronisation pseudo:', serverPlayer.pseudo);
            setPseudo(serverPlayer.pseudo);
            if (room) {
                saveUserSession(serverPlayer.pseudo, room);
            }
        }

        console.log('📝 Soumission réponse:', answer.trim());
        socketMethods.submitAnswer(answer);
        setHasAnswered(true);
    }, [answer, hasAnswered, canAnswer, timerStarted, players, socketMethods, pseudo, room, saveUserSession, setPseudo, setHasAnswered, setError, t]);

    // ✅ HANDLERS UTILITAIRES (handleCopyLink supprimé car géré dans LobbyView)
    const handleKickPlayer = useCallback((targetPseudo) => {
        if (!isCreator) {
            setError('Seul le créateur peut exclure des joueurs');
            setTimeout(() => setError(''), 3000);
            return;
        }

        if (!targetPseudo) {
            setError('Aucun joueur sélectionné');
            setTimeout(() => setError(''), 2000);
            return;
        }

        if (targetPseudo === pseudo) {
            setError('Vous ne pouvez pas vous exclure vous-même');
            setTimeout(() => setError(''), 3000);
            return;
        }

        if (!socketMethods.isConnected()) {
            setError(t('notConnected') || 'Non connecté');
            setTimeout(() => setError(''), 3000);
            return;
        }

        console.log('👢 Exclusion joueur:', targetPseudo);
        socketMethods.kickPlayer(targetPseudo);
    }, [isCreator, pseudo, socketMethods, setError, t]);

    const handleTransferHost = useCallback((targetPseudo) => {
        if (!isCreator) {
            setError('Seul le créateur peut transférer le host');
            setTimeout(() => setError(''), 3000);
            return;
        }

        if (!targetPseudo) {
            setError('Aucun joueur sélectionné');
            setTimeout(() => setError(''), 2000);
            return;
        }

        if (targetPseudo === pseudo) {
            setError('Vous êtes déjà le host');
            setTimeout(() => setError(''), 3000);
            return;
        }

        if (!socketMethods.isConnected()) {
            setError(t('notConnected') || 'Non connecté');
            setTimeout(() => setError(''), 3000);
            return;
        }

        console.log('👑 Transfert host vers:', targetPseudo);
        socketMethods.transferHost(targetPseudo);
    }, [isCreator, pseudo, socketMethods, setError, t]);

    // ✅ UTILITAIRES DE JEU (inchangés)
    const getPlayerAnswerIcon = useCallback((player) => {
        if (!player) return '';

        if (player.hasFoundThisRound) return '✅';
        if (!player.currentAnswer || (players.find(p => p.pseudo === pseudo)?.gameState && player.currentAnswer.level < players.find(p => p.pseudo === pseudo).gameState.level)) {
            return '⏳';
        }
        return player.currentAnswer.isCorrect ? '✅' : '❌';
    }, [players, pseudo]);

    return {
        // Room handlers
        handleCreateRoom,
        handleJoinRoom,
        handleRetry,
        handleNewGame,

        // Lobby handlers
        handleChangePseudo,
        handleToggleReady,
        handleStartGame,

        // Game handlers
        handleSubmitAnswer,

        // Utility handlers (handleCopyLink supprimé - géré dans LobbyView)
        handleKickPlayer,
        handleTransferHost,

        // Game utilities
        getPlayerAnswerIcon
    };
};