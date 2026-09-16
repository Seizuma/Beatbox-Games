import { useEffect, useRef, useCallback } from 'react';
import socketOnline from '../socketOnline';
import { getRandomPseudo } from '../utils/randomPseudo';
import { listenForAudioUnlock, playArtistClip, stopArtistClip } from '../utils/artistAudio';

/**
 * Hook Socket.io - Version corrigée avec Discord + Logique de base fonctionnelle
 * ✅ RETOUR À LA LOGIQUE QUI FONCTIONNAIT + Support Discord
 */
export const useSocket = ({
    // States setters
    setView, setConnected, setError, setRoom, setShareLink, setIsCreator, setGameMode, setPseudo, setCreatorPseudo,
    setPlayers, setScores, setEditingPseudo, setNewPseudo, setArtistCountRange, setLocalArtistCount,
    setAnswerTimeSettings, setLocalAnswerTime, setHasAnswered, setAnswer, setRoundResults, setCanAnswer,
    setTimerStarted, setGameState, setAnswerFeedback, setArtistRevealState, setTimeLeft, setFinalRanking,
    setCountdown, setShowSettings, setIsReady, discordToken,
    discordUser,
    updateDiscordStats,

    // Current state values
    pseudo, room, gameState, view, players, isCreator, artistCountRange, answerTimeSettings, audioVolume, audioRef, gameMode,

    // Utility functions
    t, VIEWS, saveUserSession, clearUserSession, playCountdownReadySound, playCountdownGoSound,
    playTensionMusic, stopTensionMusic,

    // Initial connection params
    detectedMode, roomFromUrl, hasProcessedUrl, isSharedLink
}) => {
    const socketInitialized = useRef(false);
    const hasTriedReconnection = useRef(false);
    const retryAttempts = useRef(0);
    const connectionTimeout = useRef(null);

    // ✅ Nettoyage simple du localStorage et redirection
    const handleCleanAndRedirect = useCallback(() => {
        console.log('🧹 Room inexistante - nettoyage et redirection');
        clearUserSession();
        setRoom('');
        setError('');

        // Nettoyer l'URL
        if (window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname + '#/blindtest-online');
        }

        setView(VIEWS.CREATE);
    }, [clearUserSession, setRoom, setError, setView, VIEWS]);

    // ✅ NOUVEAU : Mise à jour statistiques Discord sécurisée
    const updateGameStatsDiscord = useCallback((gameData, playerPseudo) => {
        if (!updateDiscordStats || !gameData.ranking || !discordUser) return;

        const playerRanking = gameData.ranking.find(r => r.pseudo === playerPseudo);
        if (!playerRanking) return;

        const totalRounds = gameData.totalRounds || 0;
        const playerScore = playerRanking.score || 0;
        const estimatedCorrect = Math.floor(playerScore / 3);

        const gameStats = {
            totalGames: 1,
            totalCorrect: estimatedCorrect,
            totalAnswers: totalRounds * 3,
            bestStreak: Math.min(estimatedCorrect, totalRounds),
            gameMode: gameData.gameMode || detectedMode || 'normal',
            playerScore: playerScore,
            finalRank: playerRanking.rank,
            totalPlayers: gameData.ranking.length,
            timestamp: new Date().toISOString(),
            discordId: discordUser.discordId,
            discordUsername: discordUser.username
        };

        updateDiscordStats(gameStats);
        console.log('📊 Stats Discord mises à jour:', gameStats);
    }, [updateDiscordStats, discordUser, detectedMode]);

    // ✅ INITIALISATION SOCKET - RETOUR À LA LOGIQUE QUI FONCTIONNAIT
    useEffect(() => {
        // Garde critique : Une seule initialisation
        if (socketInitialized.current) {
            console.log('🔄 Socket déjà initialisé, ignorer');
            return;
        }

        // Garde critique : Attendre que hasProcessedUrl soit true
        if (!hasProcessedUrl) {
            console.log('⏳ En attente du traitement URL (hasProcessedUrl = false)');
            return;
        }

        console.log('🚀 INITIALISATION SOCKET PRINCIPALE');
        listenForAudioUnlock();
        socketInitialized.current = true;

        // ✅ DISCORD : Configurer l'auth AVANT tout
        if (discordToken && discordUser) {
            console.log('🔐 Configuration auth Discord:', {
                username: discordUser.username,
                discordId: discordUser.discordId?.substring(0, 8) + '...'
            });
            socketOnline.updateAuth(discordToken);
        } else {
            socketOnline.ensureAuth();
        }

        // Nettoyer les listeners existants
        socketOnline.removeAllListeners();

        // =============================================
        // ✅ TOUS LES LISTENERS EN PREMIER (COMME AVANT)
        // =============================================

        // ✅ RÉSULTAT CRÉATION ROOM - HANDLER PRIORITAIRE
        socketOnline.on('online-room-result', (data) => {
            console.log('🔧 ONLINE-ROOM-RESULT reçu:', data);
            console.log('🔧 Socket connecté au moment de réception:', socketOnline.connected);

            if (data.success) {
                console.log('✅ Création room réussie, navigation vers LOBBY');
                setRoom(data.code);
                setShareLink(data.shareLink);
                setIsCreator(data.isCreator);
                if (data.gameMode) setGameMode(data.gameMode);
                setView(VIEWS.LOBBY);
                setError('');

                // ✅ UTILISER LE PSEUDO CONFIRMÉ par le serveur
                const confirmedPseudo = data.confirmedPseudo || pseudo;
                if (confirmedPseudo !== pseudo) {
                    console.log('📝 Pseudo corrigé par serveur:', pseudo, '→', confirmedPseudo);
                    setPseudo(confirmedPseudo);
                }

                saveUserSession(confirmedPseudo, data.code);
                console.log('📋 Session sauvegardée, changement vue vers LOBBY');
            } else {
                console.log('❌ Échec création room:', data.error);
                setError(data.error);
                setView(VIEWS.CREATE);
            }
        });

        // ✅ RÉSULTAT JOIN ROOM
        socketOnline.on('online-join-result', (data) => {
            console.log('🚪 Résultat join:', data);

            if (data.success) {
                setRoom(data.code);
                setShareLink(data.shareLink);
                setIsCreator(data.isCreator);
                if (data.gameMode) setGameMode(data.gameMode);
                setView(VIEWS.LOBBY);
                setError('');

                const finalPseudo = data.confirmedPseudo || pseudo;
                if (finalPseudo !== pseudo) {
                    setPseudo(finalPseudo);
                }

                saveUserSession(finalPseudo, data.code);
                retryAttempts.current = 0;

            } else {
                console.log('❌ Échec join:', data.error);

                if (data.error?.includes('introuvable')) {
                    handleCleanAndRedirect();
                } else if (data.error?.includes('déjà utilisé') && isSharedLink && retryAttempts.current < 2) {
                    retryAttempts.current++;

                    // ✅ GESTION DISCORD : Ne pas générer de nouveau pseudo si Discord
                    let newPseudo;
                    if (discordUser && discordUser.username) {
                        console.log('⚠️ Conflit pseudo Discord, essai avec suffixe');
                        newPseudo = `${discordUser.username}_${retryAttempts.current}`;
                    } else {
                        newPseudo = getRandomPseudo();
                    }

                    setPseudo(newPseudo);

                    setTimeout(() => {
                        if (roomFromUrl) {
                            socketOnline.emit('join-online-room', {
                                code: roomFromUrl.toUpperCase(),
                                pseudo: newPseudo,
                                gameMode: detectedMode || 'normal',
                                isSharedLinkJoin: true,
                                retryAttempt: retryAttempts.current,
                                discordId: discordUser?.discordId || null,
                                discordAvatar: discordUser?.avatar || null,
                                isDiscordUser: !!discordUser
                            });
                        }
                    }, 1000);
                } else {
                    setError(data.error);
                    setView(VIEWS.CREATE);
                    retryAttempts.current = 0;
                }
            }
        });

        // Déconnexion
        socketOnline.on('disconnect', (reason) => {
            console.log('❌ Socket déconnecté:', reason);
            setConnected(false);
            if (reason === 'io server disconnect') {
                setError('Serveur déconnecté');
            } else if (reason === 'transport error' && view === VIEWS.LOADING) {
                console.log('🔄 Transport error pendant le chargement, reconnexion...');
                setTimeout(() => {
                    if (!socketOnline.connected) {
                        socketOnline.connect();
                    }
                }, 2000);
            }
        });

        socketOnline.on('connect_error', (error) => {
            console.error('❌ Erreur socket:', error);
            setError('Problème de connexion');
            if (connectionTimeout.current) {
                clearTimeout(connectionTimeout.current);
            }
        });

        // ✅ AUTRES ÉVÉNEMENTS
        socketOnline.on('player-kicked', (data) => {
            if (data.kickedPseudo === pseudo) {
                handleCleanAndRedirect();
            }
        });

        socketOnline.on('game-error', (data) => {
            setError(data.error);
        });

        socketOnline.on('room-updated', (data) => {
            setPlayers(data.players || []);
            setScores(data.scores || {});
            setCreatorPseudo(data.creatorPseudo || '');
            if (data.shareLink) setShareLink(data.shareLink);
            if (data.gameMode) setGameMode(data.gameMode);
        });

        socketOnline.on('settings-updated', (data) => {
            if (data.artistCountRange) {
                setArtistCountRange(data.artistCountRange);
                // ✅ Ne mettre à jour localArtistCount QUE si on n'est PAS le créateur
                // ou si on vient de rejoindre (pas encore dans isCreator)
                if (!isCreator) {
                    setLocalArtistCount(data.artistCountRange.current);
                }
            }
            if (data.answerTimeSettings) {
                setAnswerTimeSettings(data.answerTimeSettings);
                // ✅ Ne mettre à jour localAnswerTime QUE si on n'est PAS le créateur
                if (!isCreator) {
                    setLocalAnswerTime(data.answerTimeSettings.current);
                }
            }
        });

        socketOnline.on('pseudo-change-result', (data) => {
            if (data.success) {
                setPseudo(data.newPseudo);
                setIsCreator(data.isCreator);
                setEditingPseudo(false);
                setNewPseudo('');
                if (room) saveUserSession(data.newPseudo, room);
            } else {
                setError(data.error);
            }
        });

        // ÉVÉNEMENTS DE JEU
        socketOnline.on('game-starting', () => {
            console.log('🎮 GAME STARTING');
            setView(VIEWS.GAME);
        });

        // Décompte : chaque chiffre reste affiché jusqu'au suivant pour que l'animation soit continue
        let countdownClearTimer = null;
        socketOnline.on('countdown', ({ count }) => {
            console.log('📢 COUNTDOWN reçu:', count);
            if (countdownClearTimer) clearTimeout(countdownClearTimer);
            if (count > 0) {
                setCountdown(count.toString());
                playCountdownReadySound();
                // Filet de sécurité si le chiffre suivant n'arrive pas
                countdownClearTimer = setTimeout(() => setCountdown(''), 1600);
            } else {
                setCountdown('Go!');
                playCountdownGoSound();
                countdownClearTimer = setTimeout(() => setCountdown(''), 900);
            }
        });

        socketOnline.on('round-started', ({ round, maxRounds, level, maxLevel, audioUrl, answerTime }) => {
            console.log('🎵 Round started:', { audioUrl, round, level, answerTime });

            setGameState({ round, maxRounds, level, maxLevel });
            setHasAnswered(false);
            setAnswer('');
            setRoundResults(null);
            setTimerStarted(false);

            setAnswerFeedback(null);
            setArtistRevealState({ show: false, artist: '', isExiting: false });

            console.log('🔇 Arrêt musique de tension - Nouveau round started');
            stopTensionMusic();

            const currentPlayer = players.find(p => p.pseudo === pseudo);
            if (level === 1) {
                setCanAnswer(true);
            } else {
                const hasFoundManche = currentPlayer?.hasFoundThisRound || false;
                setCanAnswer(!hasFoundManche);
            }

            // Extrait de l'artiste : lecteur unique réutilisé, débloqué au premier toucher (utils/artistAudio.js)
            if (audioUrl) {
                console.log('🎵 Lecture extrait:', audioUrl);
                audioRef.current = playArtistClip(audioUrl, {
                    volume: audioVolume,
                    onEnded: () => {
                        console.log('🎵 Audio artiste terminé - Démarrage musique de tension');
                        setTimeout(() => playTensionMusic(), 500);
                    },
                    onBlocked: () => {
                        const message = t('safariAudioInfo');
                        setError(message && message !== 'safariAudioInfo' ? message : 'Touche l’écran pour activer le son');
                    },
                    onError: () => {
                        setTimeout(() => playTensionMusic(), 5000);
                    },
                });
            } else {
                console.warn('⚠️ Pas d\'URL audio');
                stopArtistClip();
                setTimeout(() => playTensionMusic(), 2000);
            }
        });

        socketOnline.on('answer-phase-started', ({ timeLimit }) => {
            console.log('📝 Phase de réponse démarrée');
            setTimeLeft(timeLimit);
            setTimerStarted(true);
            setCanAnswer(true);
            console.log('🔇 Arrêt musique de tension - Phase de réponse');
            stopTensionMusic();
        });

        socketOnline.on('answer-feedback', ({ isCorrect, answer, pseudo: answerPseudo, level }) => {
            console.log('📨 Feedback reçu:', { isCorrect, answer, pseudo: answerPseudo, level });
            if (answerPseudo === pseudo) {
                setAnswerFeedback({ isCorrect, show: true });
                setTimeout(() => {
                    setAnswerFeedback(prev => prev ? { ...prev, show: false } : null);
                }, 3000);
                setTimeout(() => setAnswerFeedback(null), 3500);
            }
        });

        socketOnline.on('timer-update', (data) => {
            setTimeLeft(data.timeLeft);
        });

        socketOnline.on('round-results', ({ artist, level, results, scores, revealArtist }) => {
            console.log('📊 Résultats du round');

            stopArtistClip();
            audioRef.current = null;
            console.log('🔇 Arrêt musique de tension - Round results');
            stopTensionMusic();

            setTimeLeft(null);
            setTimerStarted(false);
            setRoundResults({
                artist: revealArtist ? artist : null,
                level,
                results,
                revealArtist
            });
            setScores(scores || {});
            setHasAnswered(false);
            setAnswer('');
            setCanAnswer(false);

            if (revealArtist && artist) {
                setTimeout(() => {
                    setArtistRevealState({ show: true, artist, isExiting: false });
                    setTimeout(() => {
                        setArtistRevealState(prev => ({ ...prev, isExiting: true }));
                        setTimeout(() => {
                            setArtistRevealState({ show: false, artist: '', isExiting: false });
                        }, 500);
                    }, 3500);
                }, 1000);
            }
        });

        socketOnline.on('artist-revealed', ({ artist }) => {
            setRoundResults(prev => prev ? { ...prev, artist, revealArtist: true } : null);
        });

        socketOnline.on('game-finished', (data) => {
            console.log('🏆 Jeu terminé, data reçue:', data);
            setFinalRanking(data.ranking || []);
            setView(VIEWS.RESULTS);

            // ✅ SIMPLIFICATION : Ne pas dépendre du tableau players
            console.log('🔍 Vérification conditions pour stats Discord:', {
                hasDiscordUser: !!discordUser,
                hasRanking: !!data.ranking,
                rankingLength: data.ranking?.length,
                pseudo: pseudo,
                discordId: discordUser?.discordId
            });

            // ✅ NOUVEAU : Vérifier directement dans le ranking
            if (discordUser && data.ranking && data.ranking.length > 0) {
                console.log('✅ Conditions OK, recherche du joueur dans ranking...');

                const playerRanking = data.ranking.find(r => r.pseudo === pseudo);
                console.log('🔍 Ranking du joueur trouvé:', playerRanking);

                // ✅ Vérifier si ce joueur est bien un utilisateur Discord
                if (playerRanking && playerRanking.isDiscordUser && playerRanking.discordId === discordUser.discordId) {
                    console.log('✅ Joueur Discord vérifié, préparation stats...');

                    const gameStats = {
                        totalGames: 1,
                        totalCorrect: playerRanking.correctAnswers || 0,
                        totalAnswers: (data.totalRounds || 0) * 3,
                        bestStreak: playerRanking.bestStreak || 0,
                        gameMode: data.gameMode || 'normal',
                        playerScore: playerRanking.score || 0,
                        finalRank: playerRanking.rank,
                        totalPlayers: data.ranking.length,
                        timestamp: new Date().toISOString()
                    };

                    console.log('📊 Stats préparées:', gameStats);

                    const payload = {
                        playerStats: {
                            correctAnswers: gameStats.totalCorrect,
                            totalAnswers: gameStats.totalAnswers,
                            bestStreak: gameStats.bestStreak,
                            score: gameStats.playerScore
                        },
                        gameMode: gameStats.gameMode,
                        totalRounds: data.totalRounds
                    };

                    console.log('📡 ÉMISSION game-ended-stats avec payload:', payload);
                    socketOnline.emit('game-ended-stats', payload);
                    console.log('✅ game-ended-stats émis avec succès');
                } else {
                    console.warn('❌ Joueur non trouvé ou non Discord:', {
                        playerFound: !!playerRanking,
                        isDiscordUser: playerRanking?.isDiscordUser,
                        discordIdMatch: playerRanking?.discordId === discordUser?.discordId,
                        playerDiscordId: playerRanking?.discordId,
                        authDiscordId: discordUser?.discordId
                    });
                }
            } else {
                console.warn('❌ Conditions non remplies:', {
                    hasDiscordUser: !!discordUser,
                    hasRanking: !!data.ranking,
                    rankingLength: data.ranking?.length
                });
            }

            stopTensionMusic();
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        });

        // ✅ ÉVÉNEMENTS DISCORD
        socketOnline.on('discord-identity-verified', (data) => {
            console.log('✅ Identité Discord vérifiée:', data);
        });

        socketOnline.on('discord-stats-updated', (data) => {
            console.log('📊 Stats Discord mises à jour depuis serveur:', data);
        });

        // =============================================
        // ✅ LOGIQUE DE CONNEXION APRÈS LES LISTENERS
        // =============================================

        // Timeout de sécurité
        connectionTimeout.current = setTimeout(() => {
            if (!socketOnline.connected) {
                console.error('⚠️ TIMEOUT connexion socket');
                setError('Connexion impossible au serveur');
                setView(VIEWS.CREATE);
            }
        }, 15000);

        // ✅ FONCTION : Gestion lien partagé avec Discord
        const handleSharedLinkJoin = () => {
            let finalPseudo;
            if (discordUser && discordUser.username) {
                finalPseudo = discordUser.username;
                console.log('👤 Utilisation pseudo Discord pour lien partagé:', finalPseudo);
            } else {
                finalPseudo = pseudo?.trim() || getRandomPseudo();
            }

            if (finalPseudo !== pseudo) {
                setPseudo(finalPseudo);
            }

            setView(VIEWS.LOADING);
            socketOnline.emit('join-online-room', {
                code: roomFromUrl.toUpperCase(),
                pseudo: finalPseudo,
                gameMode: detectedMode || 'normal',
                isSharedLinkJoin: true,
                discordId: discordUser?.discordId || null,
                discordAvatar: discordUser?.avatar || null,
                isDiscordUser: !!discordUser
            });
        };

        // ✅ FONCTION : Gestion reconnexion session avec Discord
        const handleSessionReconnection = () => {
            const session = JSON.parse(localStorage.getItem('blindtest_session') || '{}');

            let sessionPseudo = session.pseudo;
            if (discordUser && discordUser.username) {
                sessionPseudo = discordUser.username;
                console.log('👤 Remplacement pseudo session par Discord:', session.pseudo, '→', sessionPseudo);
            }

            if (sessionPseudo && session.room) {
                console.log('🔄 Tentative reconnexion session:', {
                    pseudo: sessionPseudo,
                    room: session.room,
                    isDiscordUser: !!discordUser
                });
                hasTriedReconnection.current = true;
                setView(VIEWS.LOADING);

                socketOnline.emit('join-online-room', {
                    code: session.room,
                    pseudo: sessionPseudo,
                    gameMode: detectedMode || 'normal',
                    discordId: discordUser?.discordId || null,
                    discordAvatar: discordUser?.avatar || null,
                    isDiscordUser: !!discordUser
                });
            } else {
                console.log('📝 Pas de session valide, aller sur CREATE');
                setView(VIEWS.CREATE);
            }
        };

        // ✅ CONNEXION ÉTABLIE - LOGIQUE AVEC DISCORD
        const handleConnect = () => {
            console.log('✅ Socket connecté');
            setConnected(true);
            setError('');

            // Nettoyer le timeout
            if (connectionTimeout.current) {
                clearTimeout(connectionTimeout.current);
                connectionTimeout.current = null;
            }

            // ✅ LOGIQUE POST-CONNEXION : 3 cas clairs
            setTimeout(() => {
                if (isSharedLink && roomFromUrl) {
                    console.log('🔗 CAS 1: Join depuis lien partagé');
                    handleSharedLinkJoin();
                } else if (!isSharedLink && !hasTriedReconnection.current) {
                    console.log('🔄 CAS 2: Vérifier session pour reconnexion');
                    handleSessionReconnection();
                } else {
                    console.log('🏠 CAS 3: Aller sur CREATE');
                    setView(VIEWS.CREATE);
                }
            }, 100); // Petit délai pour s'assurer que tout est stable
        };

        // Attacher les événements de connexion
        socketOnline.on('connect', handleConnect);

        // CONNEXION INITIALE
        if (!socketOnline.connected) {
            console.log('🔌 Connexion socket...');
            socketOnline.connect();
        } else {
            console.log('🔌 Socket déjà connecté');
            handleConnect();
        }

        // CLEANUP
        return () => {
            console.log('🧹 Cleanup socket');
            if (connectionTimeout.current) {
                clearTimeout(connectionTimeout.current);
            }
            socketOnline.removeAllListeners();
        };

    }, [hasProcessedUrl, discordToken, discordUser]);

    // ✅ MÉTHODES PUBLIQUES AVEC SUPPORT DISCORD
    return {
        createRoom: (pseudo, gameMode) => {
            if (!socketOnline.connected) {
                setError('Non connecté');
                return;
            }

            const finalPseudo = discordUser?.username || pseudo.trim();
            console.log('🎮 Création room:', {
                originalPseudo: pseudo,
                finalPseudo,
                gameMode,
                isDiscordUser: !!discordUser
            });

            socketOnline.emit('create-online-room', {
                pseudo: finalPseudo,
                gameMode,
                discordId: discordUser?.discordId || null,
                discordAvatar: discordUser?.avatar || null,
                isDiscordUser: !!discordUser
            });
        },

        joinRoom: (roomCode, pseudo, gameMode) => {
            if (!socketOnline.connected) {
                setError('Non connecté');
                return;
            }

            const finalPseudo = discordUser?.username || pseudo.trim();
            socketOnline.emit('join-online-room', {
                code: roomCode.trim().toUpperCase(),
                pseudo: finalPseudo,
                gameMode,
                discordId: discordUser?.discordId || null,
                discordAvatar: discordUser?.avatar || null,
                isDiscordUser: !!discordUser
            });
        },

        changePseudo: (oldPseudo, newPseudo) => {
            const currentPlayer = players?.find(p => p.pseudo === oldPseudo);
            if (currentPlayer?.isDiscordUser) { // ← Utilisation de l'optional chaining
                console.log('🚫 Tentative changement pseudo Discord bloquée');
                setError('Les utilisateurs Discord ne peuvent pas changer de pseudo');
                setTimeout(() => setError(''), 3000);
                return;
            }

            if (socketOnline.connected) {
                socketOnline.emit('change-pseudo', { oldPseudo, newPseudo: newPseudo.trim() });
            }
        },

        toggleReady: () => {
            if (socketOnline.connected) socketOnline.emit('toggle-ready');
        },

        startGame: (room) => {
            if (socketOnline.connected) socketOnline.emit('start-game', { room });
        },

        updateArtistCount: (count) => {
            if (socketOnline.connected) socketOnline.emit('update-artist-count', { count });
        },

        updateAnswerTime: (seconds) => {
            if (socketOnline.connected) socketOnline.emit('update-answer-time', { seconds });
        },

        submitAnswer: (answer) => {
            if (socketOnline.connected) {
                socketOnline.emit('submit-answer', {
                    answer: answer.trim(),
                    discordId: discordUser?.discordId || null,
                    isDiscordUser: !!discordUser
                });
            }
        },

        kickPlayer: (targetPseudo) => {
            if (socketOnline.connected) socketOnline.emit('kick-player', { targetPseudo });
        },

        transferHost: (targetPseudo) => {
            if (socketOnline.connected) socketOnline.emit('transfer-host', { targetPseudo });
        },

        refreshRoomData: () => {
            if (socketOnline.connected) socketOnline.emit('refresh-room-data');
        },

        collectGameStats: () => {
            if (socketOnline.connected && discordUser) {
                socketOnline.emit('collect-game-stats', {
                    discordId: discordUser.discordId,
                    pseudo: pseudo
                });
            }
        },

        verifyDiscordIdentity: () => {
            if (socketOnline.connected && discordUser && discordToken) {
                socketOnline.emit('discord:verify-identity', {
                    token: discordToken,
                    discordId: discordUser.discordId,
                    username: discordUser.username
                });
            }
        },

        isConnected: () => socketOnline.connected,
        socketId: socketOnline.id || null,

        reconnect: () => {
            if (!socketOnline.connected) {
                console.log('🔄 Reconnexion manuelle...');
                socketOnline.connect();
            }
        },

        getDiscordUser: () => discordUser,
        isDiscordAuthenticated: () => !!(discordUser && discordToken)
    };
};