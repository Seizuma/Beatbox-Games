import React, { useEffect, useState, useRef } from 'react';
import socketOnline from './socketOnline';
import { getRandomPseudo } from './utils/randomPseudo';
import SEO from './components/SEO';
import { useI18n } from './utils/i18n';

const VIEWS = {
    LOADING: 'loading',
    CREATE: 'create',
    LOBBY: 'lobby',
    GAME: 'game',
    RESULTS: 'results',
    ERROR: 'error'
};

// ✅ NOUVEAU : Gestion du localStorage pour la reconnexion
const STORAGE_KEY = 'beatbox_user_session';
// ✅ NOUVEAU : Détection de Firefox pour optimisations
const isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('firefox');
const saveUserSession = (pseudo, room) => {
    try {
        if (!pseudo || !room) {
            console.warn('⚠️ Impossible de sauvegarder: pseudo ou room manquant', { pseudo, room });
            return;
        }

        const sessionData = {
            pseudo: pseudo.trim(),
            room: room.trim().toUpperCase(),
            timestamp: Date.now()
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    } catch (error) {
        console.warn('❌ Impossible de sauvegarder la session:', error);
    }
};

const getUserSession = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return null;
        }

        const sessionData = JSON.parse(stored);
        const now = Date.now();

        // ✅ NOUVEAU : Réduire le délai d'expiration
        const maxAge = 5 * 60 * 1000; // 5 minutes au lieu de 10

        if (now - sessionData.timestamp > maxAge) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }

        return sessionData;
    } catch (error) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
};

const clearUserSession = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn('Impossible de nettoyer la session:', error);
    }
};

function BlindTestOnline() {
    const [view, setView] = useState(VIEWS.LOADING);
    const [pseudo, setPseudo] = useState(() => {
        const session = getUserSession();
        return session?.pseudo || getRandomPseudo();
    });
    const [room, setRoom] = useState('');
    const [shareLink, setShareLink] = useState('');
    const [error, setError] = useState('');
    const [connected, setConnected] = useState(false);

    // États de créateur
    const [isCreator, setIsCreator] = useState(false);
    const [creatorPseudo, setCreatorPseudo] = useState('');

    // États de lobby
    const [players, setPlayers] = useState([]);
    const [scores, setScores] = useState({});
    const [isReady, setIsReady] = useState(false);
    const [editingPseudo, setEditingPseudo] = useState(false);
    const [newPseudo, setNewPseudo] = useState('');
    const [showSettings, setShowSettings] = useState(false);

    // États de jeu
    const [gameState, setGameState] = useState(null);
    const [timeLeft, setTimeLeft] = useState(null);
    const [answer, setAnswer] = useState('');
    const [hasAnswered, setHasAnswered] = useState(false);
    const [canAnswer, setCanAnswer] = useState(true);
    const [timerStarted, setTimerStarted] = useState(false);
    const countdownReadyAudioRef = useRef(null);
    const countdownGoAudioRef = useRef(null);
    const tensionAudioRef = useRef(null);
    const [audioVolume, setAudioVolume] = useState(0.7); // Volume par défaut à 70%
    const [showVolumeControl, setShowVolumeControl] = useState(false);
    const [roundResults, setRoundResults] = useState(null);
    const [finalRanking, setFinalRanking] = useState([]);

    // États simples pour les résultats
    // États simples pour les résultats
    const [answerFeedback, setAnswerFeedback] = useState(null);
    const [countdown, setCountdown] = useState('');
    const [artistRevealState, setArtistRevealState] = useState({ show: false, artist: '', isExiting: false });

    // Mode de jeu
    const [gameMode, setGameMode] = useState('normal');


    const [artistCountRange, setArtistCountRange] = useState({ min: 10, max: 50, current: 10 });
    const [answerTimeSettings, setAnswerTimeSettings] = useState({ min: 5, max: 60, current: 30 });
    const [localAnswerTime, setLocalAnswerTime] = useState(30);
    const [isEditingArtistCount, setIsEditingArtistCount] = useState(false);

    const [localArtistCount, setLocalArtistCount] = useState(10);
    const { t, language, switchLanguage, isEnglish } = useI18n();

    const audioRef = useRef(null);


    useEffect(() => {
        const detectMode = () => {
            let detectedMode = 'normal';
            let roomFromUrl = null;

            // ✅ NOUVEAU : Vérifier d'abord la session stockée
            const session = getUserSession();

            // Méthode hash (React Router)
            const hash = window.location.hash;
            if (hash.includes('?')) {
                const hashQuery = hash.split('?')[1];
                const hashParams = new URLSearchParams(hashQuery);
                const hashMode = hashParams.get('mode');
                roomFromUrl = hashParams.get('room');

                if (hashMode === 'quick') {
                    detectedMode = 'quick';
                }
            }

            // Fallback URL complète
            if (detectedMode === 'normal' && window.location.href.includes('mode=quick')) {
                detectedMode = 'quick';
            }


            if (!roomFromUrl && session?.room) {
                const sessionAge = Date.now() - session.timestamp;
                const maxRecentAge = 2 * 60 * 1000; // 2 minutes maximum

                if (sessionAge < maxRecentAge) {
                    roomFromUrl = session.room;
                } else {
                    clearUserSession();
                }
            }

            setGameMode(detectedMode);
            if (roomFromUrl) {
                setRoom(roomFromUrl);
            }

            return { detectedMode, roomFromUrl };
        };

        // 2. Détecter immédiatement
        const { detectedMode, roomFromUrl } = detectMode();

        // 3. Attendre un tick pour s'assurer que le state est mis à jour
        setTimeout(() => {


            const handleConnect = () => {

                setConnected(true);

                if (roomFromUrl && pseudo) {

                    socketOnline.emit('join-online-room', {
                        code: roomFromUrl.toUpperCase(),
                        pseudo: pseudo.trim(),
                        gameMode: detectedMode
                    });
                    setView(VIEWS.LOADING);
                } else {
                    setView(VIEWS.CREATE);
                }
                setError('');
            };

            const handleDisconnect = () => {
                setConnected(false);
                setView(VIEWS.ERROR);
                setError(t('connectionLost')); // ✅ MODIFIÉ
            };

            const handleError = (error) => {
                setConnected(false);
                setView(VIEWS.ERROR);
                setError(t('connectionError')); // ✅ MODIFIÉ
            };


            // Nettoyer les anciens listeners
            socketOnline.removeAllListeners();

            socketOnline.on('connect', handleConnect);
            socketOnline.on('disconnect', handleDisconnect);
            socketOnline.on('connect_error', handleError);

            socketOnline.on('online-room-result', ({ success, code, shareLink, error, message, isCreator, gameMode: serverGameMode }) => {
                if (success) {
                    setRoom(code);
                    setShareLink(shareLink);
                    setIsCreator(isCreator);
                    if (serverGameMode) setGameMode(serverGameMode);
                    setView(VIEWS.LOBBY);
                    setError('');

                    // ✅ NOUVEAU : Sauvegarder la session lors de la création
                    saveUserSession(pseudo, code);
                } else {
                    setError(error || t('roomCreationError')); // ✅ MODIFIÉ
                    setView(VIEWS.CREATE);
                }
            });

            socketOnline.on('online-join-result', ({ success, code, shareLink, error, message, isCreator, gameMode: serverGameMode, isReconnection, gameState }) => {
                if (success) {
                    setRoom(code);
                    setShareLink(shareLink);
                    setIsCreator(isCreator);
                    if (serverGameMode) setGameMode(serverGameMode);

                    // ✅ NOUVEAU : Sauvegarder la session
                    saveUserSession(pseudo, code);

                    // ✅ NOUVEAU : Gestion intelligente de la reconnexion
                    if (isReconnection && gameState) {

                        if (gameState.isInGame) {
                            // Reconnexion pendant une partie
                            setView(VIEWS.GAME);
                            setGameState({
                                round: gameState.round,
                                maxRounds: gameState.maxRounds,
                                level: gameState.level,
                                maxLevel: gameState.maxLevel
                            });

                            // Afficher une notification de reconnexion
                            setError(t('reconnectionInProgress')); // ✅ MODIFIÉ
                            setTimeout(() => setError(''), 3000);
                        } else {
                            // Reconnexion dans le lobby
                            setView(VIEWS.LOBBY);
                        }
                    } else if (isReconnection) {
                        // Reconnexion simple dans le lobby
                        setView(VIEWS.LOBBY);
                        setError(t('reconnectionSuccess')); // ✅ MODIFIÉ
                        setTimeout(() => setError(''), 2000);
                    } else {
                        // Première connexion normale
                        setView(VIEWS.LOBBY);
                    }

                    setError('');
                } else {
                    console.error('❌ Échec join room:', error);

                    // ✅ NOUVEAU : Gestion spécifique selon le type d'erreur
                    if (error === 'Room introuvable') {
                        // Nettoyer la session car la room n'existe plus
                        clearUserSession();

                        // ✅ CORRECTION : Ne pas afficher l'erreur si c'est une tentative automatique
                        const hasRoomInUrl = window.location.href.includes('room=') || window.location.hash.includes('room=');

                        if (!hasRoomInUrl && room) {
                            // Tentative automatique échouée - nettoyage silencieux
                            console.log('🧹 Tentative automatique échouée, nettoyage silencieux');
                            setRoom('');
                            setView(VIEWS.CREATE);
                            // PAS de setError() pour éviter l'affichage
                        } else {
                            // Tentative manuelle - afficher l'erreur
                            setError(error);
                            setView(VIEWS.CREATE);
                        }
                    } else {
                        // Autres erreurs : afficher normalement
                        setError(error || t('joinRoomError')); // ✅ MODIFIÉ
                        setView(VIEWS.CREATE);
                    }
                }
            });

            socketOnline.on('pseudo-change-result', ({ success, error, newPseudo: confirmedPseudo, isCreator }) => {
                if (success) {
                    console.log('✅ Changement de pseudo confirmé:', {
                        oldPseudo: pseudo,
                        newPseudo: confirmedPseudo
                    });

                    // ✅ CORRECTION CRITIQUE : Mettre à jour immédiatement le pseudo AVANT tout autre état
                    setPseudo(confirmedPseudo);

                    // ✅ NOUVEAU : Forcer une mise à jour du localStorage immédiatement
                    if (room) {
                        saveUserSession(confirmedPseudo, room);
                    }

                    // Mettre à jour les autres états
                    setIsCreator(isCreator);
                    setEditingPseudo(false);
                    setNewPseudo('');
                    setError('');

                    console.log('🔄 Pseudo mis à jour dans le state:', confirmedPseudo);

                    // ✅ NOUVEAU : Forcer une re-synchronisation avec le serveur
                    setTimeout(() => {
                        socketOnline.emit('refresh-room-data');
                    }, 100);
                } else {
                    setError(error || t('pseudoChangeError')); // ✅ MODIFIÉ
                    setTimeout(() => setError(''), 3000);
                    setEditingPseudo(false);
                    setNewPseudo('');
                }
            });

            socketOnline.on('room-updated', ({ players, scores, shareLink, creatorPseudo, gameMode: serverGameMode }) => {
                console.log('🔄 Room-updated reçu:', {
                    currentPseudo: pseudo,
                    socketId: socketOnline.id,
                    players: (players || []).map(p => ({ pseudo: p.pseudo, socketId: p.socketId, connected: p.connected })),
                    serverCreator: creatorPseudo,
                    localCreator: creatorPseudo
                });

                setPlayers(players || []);
                setScores(scores || {});

                // ✅ AMÉLIORATION : Vérifier si le créateur a changé
                if (creatorPseudo && creatorPseudo !== creatorPseudo) {
                    console.log('👑 Changement de créateur détecté:', creatorPseudo, '→', creatorPseudo);
                    setCreatorPseudo(creatorPseudo);

                    // Mettre à jour le statut local
                    setIsCreator(creatorPseudo === pseudo);
                } else {
                    setCreatorPseudo(creatorPseudo || '');
                }

                if (shareLink) setShareLink(shareLink);
                if (serverGameMode) setGameMode(serverGameMode);

                // ✅ AMÉLIORATION : Synchronisation du pseudo avec gestion des priorités
                const currentPlayerBySocket = (players || []).find(p => p.socketId === socketOnline.id && p.connected);

                if (currentPlayerBySocket) {
                    console.log('👤 Joueur trouvé par socketId:', {
                        serverPseudo: currentPlayerBySocket.pseudo,
                        localPseudo: pseudo,
                        needsUpdate: currentPlayerBySocket.pseudo !== pseudo
                    });

                    // ✅ NOUVEAU : Vérifier si c'est une mise à jour nécessaire
                    if (currentPlayerBySocket.pseudo !== pseudo) {
                        console.log('🔄 Mise à jour pseudo critique:', pseudo, '→', currentPlayerBySocket.pseudo);

                        // Mise à jour immédiate et synchrone
                        setPseudo(currentPlayerBySocket.pseudo);

                        // Mise à jour du localStorage
                        if (room) {
                            saveUserSession(currentPlayerBySocket.pseudo, room);
                        }
                    }
                } else {
                    console.warn('⚠️ Joueur non trouvé par socketId dans room-updated');

                    // ✅ NOUVEAU : Fallback - chercher par pseudo si pas trouvé par socket
                    const currentPlayerByPseudo = (players || []).find(p => p.pseudo === pseudo && p.connected);
                    if (currentPlayerByPseudo && currentPlayerByPseudo.socketId !== socketOnline.id) {
                        console.log('🔄 Fallback: Mise à jour socketId', socketOnline.id, '→', currentPlayerByPseudo.socketId);
                    }
                }

                // ✅ CORRECTION : Utiliser le pseudo le plus à jour disponible
                const effectivePseudo = currentPlayerBySocket?.pseudo || pseudo;
                const currentPlayer = (players || []).find(p => p.pseudo === effectivePseudo);

                if (currentPlayer && gameState) {
                    setCanAnswer(!currentPlayer.hasFoundThisRound);
                    console.log('🎮 État joueur mis à jour:', {
                        pseudo: effectivePseudo,
                        canAnswer: !currentPlayer.hasFoundThisRound,
                        hasFoundThisRound: currentPlayer.hasFoundThisRound
                    });
                }
            });

            // ✅ NOUVEAU : Événement séparé pour les settings
            socketOnline.on('settings-updated', ({ artistCountRange: range, answerTimeSettings: timeSettings }) => {
                console.log('🎛️ Mise à jour des settings reçue:', { range, timeSettings });

                if (range) {
                    setArtistCountRange(range);
                    // Ne mettre à jour la valeur locale que pour les non-créateurs ou si pas modifiée
                    if (!isCreator || localArtistCount === artistCountRange.current) {
                        setLocalArtistCount(range.current);
                    }
                }

                if (timeSettings) {
                    setAnswerTimeSettings(timeSettings);
                    // Ne mettre à jour la valeur locale que pour les non-créateurs ou si pas modifiée
                    if (!isCreator || localAnswerTime === answerTimeSettings.current) {
                        setLocalAnswerTime(timeSettings.current);
                    }
                }
            });

            socketOnline.on('game-starting', () => {
                setView(VIEWS.GAME);
                setError('');
                setHasAnswered(false);
                setAnswer('');
                setRoundResults(null);
                setCanAnswer(true);
                setTimerStarted(false);
            });

            socketOnline.on('game-started', () => {
                setView(VIEWS.GAME);
                setError('');
                setHasAnswered(false);
                setAnswer('');
                setRoundResults(null);
                setCanAnswer(true);
                setTimerStarted(false);
            });

            socketOnline.on('countdown', ({ count }) => {
                if (count > 0) {
                    // Pour 3, 2, 1 : jouer countdown-ready
                    setCountdown(count.toString());
                    playCountdownReadySound();
                    setTimeout(() => setCountdown(''), 800);
                } else {
                    // Pour "Go!" : jouer countdown-go
                    setCountdown('Go!');
                    playCountdownGoSound();
                    setTimeout(() => setCountdown(''), 800);
                }
            });

            socketOnline.on('round-started', ({ round, maxRounds, level, maxLevel, audioUrl, answerTime }) => {
                console.log('🎵 Round started:', { round, level, pseudo });

                setGameState({ round, maxRounds, level, maxLevel });
                setHasAnswered(false);
                setAnswer('');
                setRoundResults(null);
                setTimerStarted(false);

                // Reset des états de résultats
                setAnswerFeedback(null);
                setArtistRevealState({ show: false, artist: '', isExiting: false });

                // ✅ NOUVEAU : Arrêter la musique de tension si elle joue
                stopTensionMusic();

                const currentPlayer = players.find(p => p.pseudo === pseudo);
                if (level === 1) {
                    setCanAnswer(true);
                } else {
                    const hasFoundManche = currentPlayer?.hasFoundThisRound || false;
                    setCanAnswer(!hasFoundManche);
                }

                if (level > 1) {
                    setPlayers(prevPlayers => [...prevPlayers]);
                }

                // Gestion audio principale avec détection de fin
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current = null;
                }

                if (audioUrl) {
                    audioRef.current = new Audio(audioUrl);
                    audioRef.current.volume = audioVolume;

                    const playAudioWithVolume = () => {
                        if (audioRef.current) {
                            audioRef.current.volume = audioVolume;
                            audioRef.current.play().catch(err => {
                                console.error('❌ Erreur audio:', err);
                            });

                            // ✅ NOUVEAU : Démarrer la musique de tension quand l'audio se termine
                            audioRef.current.addEventListener('ended', () => {
                                console.log('🎵 Audio terminé, démarrage musique de tension');
                                // Petit délai pour éviter la superposition avec l'audio principal
                                setTimeout(() => {
                                    playTensionMusic();
                                }, 500);
                            });
                        }
                    };

                    // Événements de chargement audio (existant)
                    audioRef.current.addEventListener('loadstart', () => {
                        if (audioRef.current) audioRef.current.volume = audioVolume;
                    });

                    audioRef.current.addEventListener('loadedmetadata', () => {
                        if (audioRef.current) audioRef.current.volume = audioVolume;
                    });

                    audioRef.current.addEventListener('loadeddata', () => {
                        if (audioRef.current) audioRef.current.volume = audioVolume;
                    });

                    audioRef.current.addEventListener('canplaythrough', () => {
                        if (audioRef.current) audioRef.current.volume = audioVolume;
                    });

                    if (audioRef.current.readyState >= 3) {
                        playAudioWithVolume();
                    } else {
                        audioRef.current.addEventListener('canplaythrough', playAudioWithVolume, { once: true });
                        audioRef.current.load();
                    }
                }
            });

            socketOnline.on('answer-phase-started', ({ timeLimit }) => {
                setTimeLeft(timeLimit);
                setTimerStarted(true);

                // ✅ NOUVEAU : Arrêter la musique de tension quand la phase de réponse commence
                stopTensionMusic();
            });

            socketOnline.on('timer-update', ({ timeLeft }) => {
                setTimeLeft(timeLeft);
            });

            socketOnline.on('round-results', ({ artist, level, results, scores, revealArtist }) => {
                // Arrêter tous les audios
                if (audioRef.current) {
                    audioRef.current.pause();
                }
                stopTensionMusic(); // ✅ NOUVEAU : Arrêter aussi la tension

                setTimeLeft(null);
                setTimerStarted(false);

                console.log('📊 Résultats reçus:', { level, resultsCount: results.length });

                setRoundResults({
                    artist: revealArtist ? artist : null,
                    level,
                    results,
                    revealArtist
                });
                setScores(scores || {});

                // Animation de révélation d'artiste (existant)
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

            socketOnline.on('answer-feedback', ({ isCorrect, answer, pseudo, level }) => {
                console.log('📨 Feedback reçu:', { isCorrect, answer, pseudo, level });

                setAnswerFeedback({ isCorrect, show: true });

                setTimeout(() => {
                    setAnswerFeedback(prev => prev ? { ...prev, show: false } : null);
                }, 3000);

                setTimeout(() => {
                    setAnswerFeedback(null);
                }, 3500);
            });

            socketOnline.on('artist-revealed', ({ artist }) => {
                setRoundResults(prev => prev ? { ...prev, artist, revealArtist: true } : null);
            });

            socketOnline.on('game-finished', ({ ranking }) => {
                setView(VIEWS.RESULTS);
                setFinalRanking(ranking || []);
            });

            socketOnline.on('game-error', ({ error }) => {
                setError(error);
                setTimeout(() => setError(''), 5000);
            });

            if (!socketOnline.connected) {
                socketOnline.connect();
            } else {
                handleConnect();
            }

            socketOnline.on('game-state-sync', ({ gameState, isInGame, currentSong, playerState }) => {

                if (isInGame && gameState) {
                    setView(VIEWS.GAME);
                    setGameState({
                        round: gameState.round,
                        maxRounds: gameState.maxRounds,
                        level: gameState.level,
                        maxLevel: gameState.maxLevel
                    });

                    // ✅ NOUVEAU : Synchroniser l'état du joueur
                    if (playerState) {
                        setCanAnswer(playerState.canAnswer);
                        setHasAnswered(!!playerState.currentAnswer);

                        if (playerState.hasFoundThisRound) {
                            setCanAnswer(false);
                        }
                    }

                    // ✅ NOUVEAU : Notification de synchronisation
                    setError(t('syncComplete')); // ✅ MODIFIÉ
                    setTimeout(() => setError(''), 3000);
                }
            });

            socketOnline.on('artist-count-update-result', ({ success, error }) => {
                if (!success && error) {
                    setError(error);
                    setTimeout(() => setError(''), 3000);
                }
            });

            socketOnline.on('answer-time-update-result', ({ success, error }) => {
                if (!success && error) {
                    console.error('❌ Erreur config temps:', error);
                    setError(error);
                    setTimeout(() => setError(''), 3000);
                }
            });

            socketOnline.on('player-kicked', ({ kickedPseudo, message }) => {
                if (kickedPseudo === pseudo) {
                    // Le joueur actuel a été exclu - Affichage immédiat
                    setView(VIEWS.ERROR);
                    setError(t('youWereKicked'));

                    // ✅ CORRECTION : Redirection automatique après 4 secondes
                    setTimeout(() => {

                        // Nettoyage complet comme dans handleNewGame
                        if (audioRef.current) {
                            audioRef.current.pause();
                            audioRef.current = null;
                        }

                        // Reset de tous les états
                        setView(VIEWS.CREATE);
                        setRoom('');
                        setShareLink('');
                        setError('');
                        setIsReady(false);
                        setIsCreator(false);
                        setCreatorPseudo('');
                        setPlayers([]);
                        setScores({});
                        setHasAnswered(false);
                        setCanAnswer(true);
                        setTimerStarted(false);
                        setAnswer('');
                        setGameState(null);
                        setRoundResults(null);
                        setFinalRanking([]);
                        setEditingPseudo(false);
                        setNewPseudo('');
                        setShowSettings(false);
                        setCountdown('');
                        setTimeLeft(null);

                        // Nettoyage URL
                        window.history.replaceState({}, document.title, window.location.pathname);

                    }, 4000);
                } else {
                    // Un autre joueur a été exclu - notification discrète
                    setError(t('playerExcluded', { player: kickedPseudo })); // ✅ MODIFIÉ
                    setTimeout(() => setError(''), 2000);

                }
            });

            socketOnline.on('kick-result', ({ success, error, kickedPseudo }) => {
                if (success) {
                } else {
                    setError(error || t('exclusionError')); // ✅ MODIFIÉ
                    setTimeout(() => setError(''), 3000);
                }

            });

            socketOnline.on('player-reconnected', ({ pseudo, message }) => {
                // Notification discrète pour les autres joueurs
                setError(t('playerReconnected', { pseudo })); // ✅ MODIFIÉ
                setTimeout(() => setError(''), 2000);

            });

            // ✅ NOUVEAU : Gestion du transfert de host
            // ✅ AMÉLIORATION de l'événement host-transferred
            socketOnline.on('host-transferred', ({ newHost, oldHost, message, isAutomatic }) => {
                console.log('👑 Transfert de host reçu:', { newHost, oldHost, currentPseudo: pseudo });

                // Mettre à jour le créateur localement
                setCreatorPseudo(newHost);

                // Mettre à jour le statut de créateur si c'est le joueur local
                if (newHost === pseudo) {
                    setIsCreator(true);
                    setError(t('youAreNowHost')); // ✅ MODIFIÉ
                } else if (oldHost === pseudo) {
                    setIsCreator(false);
                    setError(t('newHostIs', { host: newHost })); // ✅ MODIFIÉ
                } else {
                    setError(message);
                }

                // ✅ AJOUT : Forcer une synchronisation après un court délai
                setTimeout(() => {
                    socketOnline.emit('refresh-room-data');
                }, 100);

                setTimeout(() => setError(''), 3000);
            });
            socketOnline.on('transfer-host-result', ({ success, error, newHost, oldHost }) => {
                if (success) {
                    setError(t('hostTransferredSuccessfully', { host: newHost })); // ✅ MODIFIÉ
                } else {
                    setError(error || t('hostTransferError')); // ✅ MODIFIÉ
                }

                setTimeout(() => setError(''), 3000);
            });

        }, 10); // Petit délai pour s'assurer que les states sont mis à jour

        return () => {
            socketOnline.removeAllListeners();
            if (audioRef.current) {
                audioRef.current.pause();
            }
            socketOnline.disconnect();
            socketOnline.off('game-started');
        };
    }, []); // ✅ Plus de dépendance sur pseudo pour éviter les reconnexions

    // ✅ NOUVEAU : Hook pour mettre à jour la session quand le pseudo change
    useEffect(() => {
        if (pseudo && room) {
            saveUserSession(pseudo, room);
        }
    }, [pseudo, room]);

    const playCountdownReadySound = () => {
        try {
            if (countdownReadyAudioRef.current) {
                countdownReadyAudioRef.current.pause();
                countdownReadyAudioRef.current.currentTime = 0; // Reset au début
            }

            countdownReadyAudioRef.current = new Audio('/audio/countdown-ready.wav');
            countdownReadyAudioRef.current.volume = audioVolume * 0.8; // Volume légèrement plus fort
            countdownReadyAudioRef.current.play().catch(err => {
                console.log('Countdown ready audio autoplay blocked:', err);
            });
        } catch (error) {
            console.warn('Erreur countdown ready audio:', error);
        }
    };

    const playCountdownGoSound = () => {
        try {
            if (countdownGoAudioRef.current) {
                countdownGoAudioRef.current.pause();
                countdownGoAudioRef.current.currentTime = 0;
            }

            countdownGoAudioRef.current = new Audio('/audio/countdown-go.wav');
            countdownGoAudioRef.current.volume = audioVolume * 0.9; // Volume plus fort pour "Go!"
            countdownGoAudioRef.current.play().catch(err => {
                console.log('Countdown go audio autoplay blocked:', err);
            });
        } catch (error) {
            console.warn('Erreur countdown go audio:', error);
        }
    };

    const playTensionMusic = () => {
        try {
            if (tensionAudioRef.current) {
                tensionAudioRef.current.pause();
            }

            tensionAudioRef.current = new Audio('/audio/Tension-music.wav');
            tensionAudioRef.current.volume = audioVolume * 0.25; // Volume très discret
            tensionAudioRef.current.loop = true; // Boucle continue
            tensionAudioRef.current.play().catch(err => {
                console.log('Tension audio autoplay blocked:', err);
            });
        } catch (error) {
            console.warn('Erreur tension audio:', error);
        }
    };

    const stopTensionMusic = () => {
        try {
            if (tensionAudioRef.current) {
                tensionAudioRef.current.pause();
                tensionAudioRef.current = null;
            }
        } catch (error) {
            console.warn('Erreur arrêt tension audio:', error);
        }
    };

    // ✅ NOUVEAU : Fonction pour gérer le volume
    const handleVolumeChange = (newVolume) => {
        setAudioVolume(newVolume);

        // Appliquer à tous les audios
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
        if (countdownReadyAudioRef.current) {
            countdownReadyAudioRef.current.volume = newVolume * 0.8;
        }
        if (countdownGoAudioRef.current) {
            countdownGoAudioRef.current.volume = newVolume * 0.9;
        }
        if (tensionAudioRef.current) {
            tensionAudioRef.current.volume = newVolume * 0.25;
        }

        // Sauvegarder le volume
        try {
            localStorage.setItem('beatbox_audio_volume', newVolume.toString());
        } catch (error) {
            console.warn('Impossible de sauvegarder le volume:', error);
        }
    };
    useEffect(() => {
        try {
            const savedVolume = localStorage.getItem('beatbox_audio_volume');
            if (savedVolume) {
                const volume = parseFloat(savedVolume);
                if (!isNaN(volume) && volume >= 0 && volume <= 1) {
                    setAudioVolume(volume);
                }
            }
        } catch (error) {
            console.warn('Impossible de récupérer le volume sauvegardé:', error);
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showVolumeControl && !event.target.closest('.relative')) {
                setShowVolumeControl(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showVolumeControl]);

    const handleCreateRoom = () => {
        if (!pseudo.trim()) {
            setError(t('pseudoRequired'));
            return;
        }

        setError('');
        setView(VIEWS.LOADING);

        socketOnline.emit('create-online-room', {
            pseudo: pseudo.trim(),
            gameMode: gameMode
        });
    };

    const handleJoinRoom = (roomCode) => {
        if (!pseudo.trim() || !roomCode.trim()) {
            setError(t('pseudoAndCodeRequired'));
            return;
        }
        setError('');
        setView(VIEWS.LOADING);
        socketOnline.emit('join-online-room', {
            code: roomCode.trim().toUpperCase(),
            pseudo: pseudo.trim(),
            gameMode: gameMode // Force la transmission
        });
    };

    const handleChangePseudo = () => {
        if (!newPseudo.trim() || newPseudo.trim() === pseudo) {
            setEditingPseudo(false);
            setNewPseudo('');
            return;
        }


        socketOnline.emit('change-pseudo', {
            oldPseudo: pseudo,
            newPseudo: newPseudo.trim()
        });

        // Pas de changement d'état ici, on attend la confirmation du serveur
    };

    const handleToggleReady = () => {
        setIsReady(!isReady);
        socketOnline.emit('toggle-ready');
    };

    const handleStartGame = () => {
        if (!isCreator) return;

        // ✅ CORRECTION : Comparer avec les vraies valeurs actuelles
        const needsArtistUpdate = localArtistCount !== artistCountRange.current;
        const needsTimeUpdate = localAnswerTime !== answerTimeSettings.current;

        //     localArtistCount,
        //     currentServer: artistCountRange.current,
        //     needsArtistUpdate,
        //     localAnswerTime,
        //     currentServerTime: answerTimeSettings.current,
        //     needsTimeUpdate
        // });

        if (needsArtistUpdate || needsTimeUpdate) {
            if (needsArtistUpdate) {
                socketOnline.emit('update-artist-count', { count: localArtistCount });
            }
            if (needsTimeUpdate) {
                socketOnline.emit('update-answer-time', { seconds: localAnswerTime });
            }

            // Attendre que les mises à jour soient appliquées
            setTimeout(() => {
                socketOnline.emit('start-game', { room });
            }, 300); // Augmenter légèrement le délai
        } else {
            socketOnline.emit('start-game', { room });
        }
    };


    const handleSubmitAnswer = () => {
        if (!answer.trim() || hasAnswered || !canAnswer || !timerStarted) {
            return;
        }

        // ✅ AMÉLIORATION : Synchronisation plus robuste du pseudo
        const serverPlayer = players.find(p => p.socketId === socketOnline.id && p.connected);
        const effectivePseudo = serverPlayer?.pseudo || pseudo;

        console.log('📤 Envoi réponse avec sync:', {
            answer: answer.trim(),
            localPseudo: pseudo,
            serverPseudo: serverPlayer?.pseudo,
            effectivePseudo,
            socketId: socketOnline.id,
            needsSync: serverPlayer && serverPlayer.pseudo !== pseudo
        });

        // ✅ SYNCHRONISATION PRÉVENTIVE : Mettre à jour le pseudo si différent
        if (serverPlayer && serverPlayer.pseudo !== pseudo) {
            console.log('🔄 Sync pseudo AVANT envoi réponse:', pseudo, '→', serverPlayer.pseudo);
            setPseudo(serverPlayer.pseudo);
            if (room) {
                saveUserSession(serverPlayer.pseudo, room);
            }
        }

        socketOnline.emit('submit-answer', { answer: answer.trim() });
        setHasAnswered(true);

        // ✅ NOUVEAU : Pas d'état d'attente, le feedback viendra directement du serveur
    };

    const handleNewGame = () => {
        clearUserSession();

        // Arrêter tous les audios
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        stopTensionMusic(); // ✅ NOUVEAU
        if (countdownReadyAudioRef.current) { // ✅ NOUVEAU
            countdownReadyAudioRef.current.pause();
            countdownReadyAudioRef.current = null;
        }
        if (countdownGoAudioRef.current) { // ✅ NOUVEAU
            countdownGoAudioRef.current.pause();
            countdownGoAudioRef.current = null;
        }

        // Quitter la room socket si connecté
        if (room && socketOnline.connected) {
            socketOnline.emit('leave-room', { room });
        }

        // Reset de tous les états
        setView(VIEWS.CREATE);
        setRoom('');
        setShareLink('');
        setError('');
        setIsReady(false);
        setIsCreator(false);
        setCreatorPseudo('');
        setPlayers([]);
        setScores({});
        setHasAnswered(false);
        setCanAnswer(true);
        setTimerStarted(false);
        setAnswer('');
        setGameState(null);
        setRoundResults(null);
        setFinalRanking([]);
        setEditingPseudo(false);
        setNewPseudo('');
        setShowSettings(false);
        setCountdown('');
        setTimeLeft(null);
        setAnswerTimeSettings({ min: 5, max: 60, current: 30 });
        setLocalAnswerTime(30);

        // Nettoyage URL
        window.history.replaceState({}, document.title, window.location.pathname);

    };

    const handleRetry = () => {
        setView(VIEWS.LOADING);
        setError('');
        socketOnline.connect();
    };

    const handleCopyLink = async () => {
        if (!shareLink) return;

        try {
            await navigator.clipboard.writeText(shareLink);
            const button = document.querySelector('.copy-link-btn');
            if (button) {
                const originalText = button.textContent;
                button.textContent = t('copied');
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            }
        } catch (err) {
        }
    };

    const handleKickPlayer = (targetPseudo) => {
        if (!isCreator || !targetPseudo) return;
        socketOnline.emit('kick-player', { targetPseudo });
    };

    // ✅ NOUVEAU : Fonction pour transférer le host
    const handleTransferHost = (targetPseudo) => {
        if (!isCreator || !targetPseudo) return;
        socketOnline.emit('transfer-host', { targetPseudo });
    };

    const getPlayerAnswerIcon = (player) => {
        // ✅ CORRECTION : Vérifier d'abord si le joueur a trouvé cette manche
        if (player.hasFoundThisRound) return '✅';

        // ✅ NOUVEAU : Si pas de réponse actuelle OU si la réponse est d'un niveau précédent, afficher sablier
        if (!player.currentAnswer ||
            (gameState && player.currentAnswer.level < gameState.level)) {
            return '⏳';
        }

        // Sinon, afficher le résultat de la réponse actuelle
        return player.currentAnswer.isCorrect ? '✅' : '❌';
    };

    // SEO dynamique selon la vue
    const getSEOData = () => {
        switch (view) {
            case VIEWS.CREATE:
                return {
                    ...t('seoCreateRoom'),
                    url: "https://beatboxgames.com/#/blindtest-online"
                };
            case VIEWS.LOBBY:
                const mode = gameMode === 'quick' ?
                    t('quickMode') :
                    t('normalMode');
                return {
                    ...t('seoLobby', { room, mode }),
                    url: `https://beatboxgames.com/#/blindtest-online?room=${room}`
                };
            case VIEWS.GAME:
                const count = gameMode === 'quick' ? '10' : '50+';
                return {
                    ...t('seoGame', { room, count }),
                    url: `https://beatboxgames.com/#/blindtest-online?room=${room}`
                };
            case VIEWS.RESULTS:
                return {
                    ...t('seoResults', { room }),
                    url: `https://beatboxgames.com/#/blindtest-online?room=${room}`
                };
            default:
                return {
                    title: "BeatBox Games - Blind Test Musical & Univers Beatbox | Jeu Multijoueur Gratuit",
                    description: "Plongez dans l'univers du beatbox avec BeatBox Games ! Blind Test musical multijoueur, découvrez les plus grands beatboxers, créez votre room privée et défiez vos amis.",
                    keywords: "beatbox, beatboxer, blind test, jeu musical, human beatbox, multijoueur, gratuit",
                    url: "https://beatboxgames.com/#/blindtest-online"
                };
        }
    };

    // Style moderne
    const modernBackground = "min-h-screen bg-gradient-to-br from-zinc-900 via-purple-900/20 to-zinc-800 relative overflow-hidden";
    const modernCard = "bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 backdrop-blur-sm border border-zinc-700/50 rounded-3xl shadow-2xl";
    const modernButton = "bg-gradient-to-r from-cyan-400 to-purple-500 hover:from-cyan-300 hover:to-purple-400 text-white font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg";
    const modernInput = "bg-zinc-700/50 backdrop-blur-sm border border-zinc-600/50 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all duration-300";

    const seoData = getSEOData();

    // Animated background
    const AnimatedBackground = () => (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 left-10 w-32 h-32 bg-cyan-400/10 rounded-full blur-xl animate-pulse"></div>
            <div className="absolute bottom-20 right-10 w-40 h-40 bg-purple-400/10 rounded-full blur-xl animate-pulse delay-700"></div>
            <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-pink-400/10 rounded-full blur-xl animate-pulse delay-1000"></div>
        </div>
    );

    // Badge de mode
    const GameModeBadge = () => {
        if (gameMode === 'quick') {
            return (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-full text-yellow-400 text-sm font-bold">
                    {t('quickMode')}
                </div>
            );
        }
        return (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/30 rounded-full text-cyan-400 text-sm font-bold">
                {t('normalMode')}
            </div>
        );
    };

    // ✅ NOUVEAU : Composant LanguageSwitch
    const LanguageSwitch = () => (
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
    );

    // Rendu des vues
    if (view === VIEWS.LOADING) {
        return (
            <>
                <SEO {...seoData} />
                <div className={modernBackground}>
                    <AnimatedBackground />
                    <LanguageSwitch />
                    <div className="flex flex-col items-center justify-center min-h-screen px-4 relative z-10">
                        <div className={`${modernCard} p-8 max-w-md w-full`}>
                            <div className="flex flex-col items-center gap-6">
                                <div className="relative">
                                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"></div>
                                    <div className="absolute inset-2 bg-zinc-800 rounded-full"></div>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2">
                                        {t('connecting')}
                                    </p>
                                    <GameModeBadge />
                                    <p className="text-green-400 text-sm flex items-center gap-2 justify-center mt-2">
                                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                        {t('socketStable')}
                                    </p>
                                    {room && (
                                        <p className="text-yellow-400 text-sm mt-2">
                                            {t('joiningRoom', { room })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (view === VIEWS.ERROR) {
        const isKicked = error.includes('exclu');

        return (
            <>
                <SEO {...seoData} />
                <div className={modernBackground}>
                    <AnimatedBackground />
                    <LanguageSwitch />
                    <div className="flex flex-col items-center justify-center min-h-screen px-4 relative z-10">
                        <div className={`${modernCard} p-8 max-w-md w-full`}>
                            <div className="flex flex-col items-center gap-6">
                                <div className="text-6xl">{isKicked ? '🚫' : '⚠️'}</div>
                                <div className="text-center">
                                    <p className={`text-xl font-semibold mb-4 ${isKicked ? 'text-orange-400' : 'text-red-400'}`}>
                                        {error}
                                    </p>

                                    {isKicked ? (
                                        <div className="space-y-4">
                                            <div className="bg-orange-500/20 border border-orange-400/30 rounded-xl p-4">
                                                <p className="text-orange-300 text-sm">
                                                    {t('youCanCreateOwnRoom')} {/* ✅ MODIFIÉ */}
                                                </p>
                                            </div>

                                            <div className="text-zinc-400 text-sm">
                                                <p>{t('automaticRedirection')}</p> {/* ✅ MODIFIÉ */}
                                            </div>

                                            <button
                                                onClick={handleNewGame}
                                                className={`${modernButton} px-6 py-3 w-full`}
                                            >
                                                {t('createNewRoom')} {/* ✅ MODIFIÉ */}
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleRetry}
                                            className={`${modernButton} px-6 py-3`}
                                        >
                                            {t('retryConnection')} {/* ✅ MODIFIÉ */}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (view === VIEWS.CREATE) {
        return (
            <>
                <SEO {...seoData} />
                <div className={modernBackground}>
                    <AnimatedBackground />
                    <LanguageSwitch />
                    <div className="flex flex-col items-center justify-center min-h-screen px-4 relative z-10">
                        <div className={`${modernCard} p-8 md:p-12 lg:p-16 max-w-5xl w-full mx-4`}>
                            <div className="text-center mb-8 md:mb-12">
                                <div className="flex items-center justify-center gap-3 md:gap-4 mb-4 md:mb-6">
                                    <span className="text-4xl md:text-5xl lg:text-6xl animate-bounce">🌐</span>
                                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                        {t('blindTestOnline')}
                                    </h1>
                                    <span className="text-4xl md:text-5xl lg:text-6xl animate-bounce delay-300">🎵</span>
                                </div>
                                <div className="mb-4 md:mb-6">
                                    <GameModeBadge />
                                </div>
                                <p className="text-lg md:text-xl text-zinc-300 mt-2 md:mt-4 px-4">
                                    ✨ {t('createRoomDescription')}
                                </p>
                            </div>

                            <div className="space-y-6 md:space-y-8 max-w-2xl mx-auto">
                                <input
                                    type="text"
                                    placeholder={t('yourPseudo')}
                                    value={pseudo}
                                    onChange={(e) => setPseudo(e.target.value)}
                                    className={`${modernInput} w-full p-4 md:p-6 text-lg md:text-xl text-center`}
                                />

                                <button
                                    onClick={handleCreateRoom}
                                    disabled={!pseudo.trim()}
                                    className={`${modernButton} w-full py-4 md:py-6 text-lg md:text-xl disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {t('createGame')}
                                </button>

                                <div className="flex items-center gap-4 md:gap-6">
                                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-600 to-transparent"></div>
                                    <span className="text-zinc-400 text-base md:text-lg">{t('or')}</span>
                                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-600 to-transparent"></div>
                                </div>

                                <div className="space-y-3 md:space-y-4">
                                    <input
                                        type="text"
                                        placeholder={t('roomCode')}
                                        className={`${modernInput} w-full p-4 md:p-6 text-lg md:text-xl text-center`}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && e.target.value.trim()) {
                                                handleJoinRoom(e.target.value);
                                            }
                                        }}
                                    />
                                    <p className="text-zinc-500 text-base md:text-lg text-center">
                                        {t('joinExistingRoom')}
                                    </p>
                                </div>
                            </div>

                            {error && (
                                <div className="mt-6 md:mt-8 p-4 md:p-6 bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 rounded-xl max-w-2xl mx-auto">
                                    <p className="text-red-400 text-center text-sm md:text-lg">{error}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </>
        );
    }


    if (view === VIEWS.LOBBY) {
        const allPlayersReady = players.length >= 2 && players.every(p => p.ready);

        return (
            <>
                <SEO {...seoData} />
                <div className={modernBackground}>
                    <AnimatedBackground />
                    <LanguageSwitch />
                    <div className="flex flex-col items-center justify-center min-h-screen px-4 relative z-10">
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
                                            {/* Bouton de configuration */}
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
                                                            {t('outOfAvailable', { max: artistCountRange.max })} {/* ✅ MODIFIÉ */}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="relative">
                                                    <input
                                                        type="range"
                                                        min={artistCountRange.min}
                                                        max={artistCountRange.max}
                                                        value={localArtistCount}
                                                        onChange={(e) => setLocalArtistCount(parseInt(e.target.value))}
                                                        className="slider w-full"
                                                        style={{
                                                            background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${((localArtistCount - artistCountRange.min) / (artistCountRange.max - artistCountRange.min)) * 100}%, #4b5563 ${((localArtistCount - artistCountRange.min) / (artistCountRange.max - artistCountRange.min)) * 100}%, #4b5563 100%)`
                                                        }}
                                                    />
                                                </div>

                                                <div className="flex justify-between text-xs text-zinc-400 mt-2">
                                                    <span>{t('minLabel', { min: artistCountRange.min })}</span> {/* ✅ MODIFIÉ */}
                                                    <span>{t('maxLabel', { max: artistCountRange.max })}</span> {/* ✅ MODIFIÉ */}
                                                </div>

                                                <div className="mt-3 text-center">
                                                    <p className="text-zinc-500 text-xs">
                                                        {t('appliedAtGameStart')} {/* ✅ MODIFIÉ */}
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
                                                            {t('timeBetween', { min: answerTimeSettings.min, max: answerTimeSettings.max })} {/* ✅ MODIFIÉ */}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="relative">
                                                    <input
                                                        type="range"
                                                        min={answerTimeSettings.min}
                                                        max={answerTimeSettings.max}
                                                        value={localAnswerTime}
                                                        onChange={(e) => setLocalAnswerTime(parseInt(e.target.value))}
                                                        className="slider w-full"
                                                        style={{
                                                            background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${((localAnswerTime - answerTimeSettings.min) / (answerTimeSettings.max - answerTimeSettings.min)) * 100}%, #4b5563 ${((localAnswerTime - answerTimeSettings.min) / (answerTimeSettings.max - answerTimeSettings.min)) * 100}%, #4b5563 100%)`
                                                        }}
                                                    />
                                                </div>

                                                <div className="flex justify-between text-xs text-zinc-400 mt-2">
                                                    <span>{t('minLabel', { min: answerTimeSettings.min })}s</span> {/* ✅ MODIFIÉ */}
                                                    <span>{t('maxLabel', { max: answerTimeSettings.max })}s</span> {/* ✅ MODIFIÉ */}
                                                </div>

                                                <div className="mt-3 text-center">
                                                    <p className="text-zinc-500 text-xs">
                                                        {t('timeToGuessArtist')} {/* ✅ MODIFIÉ */}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Gestion des joueurs */}
                                            <div>
                                                <h4 className="text-cyan-400 font-semibold text-sm mb-3">{t('playerManagement')}</h4>
                                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                                    {players.filter(p => p.pseudo !== pseudo).map((player) => (
                                                        <div key={player.pseudo} className="flex items-center justify-between p-2 bg-zinc-700/50 rounded-lg">
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                <span className="text-white text-sm truncate">{player.pseudo}</span>
                                                                {player.pseudo === creatorPseudo && <span className="text-yellow-400 text-xs">👑</span>}
                                                            </div>
                                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                                {/* ✅ NOUVEAU : Bouton pour donner le host */}
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
                                                    {players.filter(p => p.pseudo !== pseudo).length === 0 && (
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
                                {/* Section pseudo avec édition - plus compacte */}
                                <div className="bg-zinc-700/30 backdrop-blur-sm rounded-xl p-3 border border-zinc-600/30">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
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
                                                        // Auto-annuler si on clique ailleurs sans valider
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
                                                <span className="text-white font-bold text-sm truncate">{pseudo}</span>
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
                                                <button
                                                    onClick={() => {
                                                        setEditingPseudo(true);
                                                        setNewPseudo(pseudo);
                                                    }}
                                                    className="px-2 py-1 bg-cyan-500 text-white rounded text-xs hover:bg-cyan-400 transition"
                                                >
                                                    ✏️
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Section de partage - ligne unique */}
                                <div className="bg-zinc-700/30 backdrop-blur-sm rounded-xl p-3 border border-zinc-600/30">
                                    <div className="flex items-center gap-3">
                                        <span className="text-zinc-300 font-semibold text-sm whitespace-nowrap">🔗 Code :</span>
                                        <div className="flex-1 p-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/30 rounded-lg text-cyan-300 font-mono text-lg text-center font-bold">
                                            {room}
                                        </div>
                                        <button
                                            onClick={handleCopyLink}
                                            className="copy-link-btn px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-400 hover:to-emerald-400 transition text-xs font-medium whitespace-nowrap"
                                        >
                                            {t('copyLink')} {/* ✅ MODIFIÉ */}
                                        </button>
                                    </div>
                                </div>

                                {/* Liste des joueurs - plus compacte */}
                                <div>
                                    <h3 className="text-base text-cyan-300 font-bold mb-3 text-center">
                                        {t('players', { count: players.length })}
                                    </h3>
                                    <div className="bg-zinc-700/30 backdrop-blur-sm rounded-xl p-3 space-y-2">
                                        {players.map((player) => (
                                            <div
                                                key={player.pseudo}
                                                className={`flex items-center justify-between p-3 rounded-lg ${player.pseudo === pseudo
                                                    ? 'bg-gradient-to-r from-cyan-500/30 to-purple-500/30 border border-cyan-400/50'
                                                    : player.connected
                                                        ? 'bg-zinc-600/50'
                                                        : 'bg-red-900/30 border border-red-500/30' // ✅ NOUVEAU : Style pour déconnectés
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <span className={`font-bold text-sm truncate ${player.connected ? 'text-white' : 'text-red-400'
                                                        }`}>
                                                        {player.pseudo}
                                                    </span>
                                                    {player.pseudo === creatorPseudo && <span className="text-yellow-400 text-sm flex-shrink-0">👑</span>}
                                                    {/* ✅ NOUVEAU : Indicateur de déconnexion */}
                                                    {!player.connected && (
                                                        <span className={`text-xs px-2 py-1 rounded ${player.isReconnecting
                                                            ? 'bg-yellow-500/20 text-yellow-400 animate-pulse'
                                                            : 'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {player.isReconnecting ? '🔄' : '📴'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className={`font-bold text-sm ${player.connected ? 'text-white' : 'text-red-400'
                                                        }`}>
                                                        {scores[player.pseudo] || 0} pts
                                                    </span>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${player.ready && player.connected
                                                        ? 'bg-green-500 text-white'
                                                        : !player.connected
                                                            ? 'bg-red-500 text-white'
                                                            : 'bg-zinc-500 text-zinc-200'
                                                        }`}>
                                                        {!player.connected ? '📴' : player.ready ? '✅' : '⏳'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Boutons d'action */}
                                <div className="space-y-3">
                                    <button
                                        onClick={handleToggleReady}
                                        className={`w-full py-3 rounded-xl font-bold text-base transition-all duration-300 transform hover:scale-105 ${isReady
                                            ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white'
                                            : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white'
                                            }`}
                                    >
                                        {isReady ? t('notReady') : t('ready')} {/* ✅ MODIFIÉ */}
                                    </button>


                                    {isCreator && allPlayersReady && (
                                        <button
                                            onClick={handleStartGame}
                                            className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-zinc-900 font-bold text-base transition-all duration-300 transform hover:scale-105 animate-pulse"
                                        >
                                            {t('startTheGame')} {/* ✅ MODIFIÉ */}
                                        </button>
                                    )}

                                    {allPlayersReady && !isCreator && (
                                        <div className="text-center text-green-400 font-semibold bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                                            <p className="text-sm">{t('waitingForHostToStart', { host: creatorPseudo })}</p> {/* ✅ MODIFIÉ */}
                                        </div>
                                    )}

                                    {!allPlayersReady && (
                                        <div className="text-center text-zinc-400 bg-zinc-700/30 rounded-xl p-3">
                                            <p className="text-sm">
                                                {players.length < 2
                                                    ? t('minimumTwoPlayersToStart') /* ✅ MODIFIÉ */
                                                    : t('allPlayersMustBeReady') /* ✅ MODIFIÉ */}
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
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (view === VIEWS.GAME) {
        return (
            <>
                <SEO {...seoData} />
                <div className={modernBackground}>
                    <AnimatedBackground />
                    <LanguageSwitch />

                    {artistRevealState.show && (
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40">
                            <div
                                className={`bg-gradient-to-r from-yellow-500/90 to-orange-500/90 border border-yellow-400/50 rounded-3xl p-8 max-w-md mx-4 text-center animate-optimized ${artistRevealState.isExiting ? 'reveal-exit' : 'reveal-enter'
                                    }`}
                            >
                                <div className="text-6xl mb-4 animate-bounce">🎤</div>
                                <h3 className="text-2xl font-bold text-white mb-3">
                                    {t('itWas')}
                                </h3>
                                <p className="text-3xl font-bold text-white">
                                    "{artistRevealState.artist}"
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col items-center justify-center min-h-screen px-4 relative z-10">
                        {/* ✅ CORRECTION : Container plus compact pour éviter le scroll */}
                        <div className={`${modernCard} p-4 md:p-6 max-w-2xl w-full max-h-[95vh] overflow-y-auto`}>
                            <div className="text-center mb-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div></div> {/* Spacer pour centrer le titre */}
                                    <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                        {t('blindTestTitle')}
                                    </h2>

                                    {/* ✅ NOUVEAU : Contrôle de volume */}
                                    {/* ✅ CORRECTION : Contrôle de volume fixé */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowVolumeControl(!showVolumeControl)}
                                            className="p-2 bg-zinc-700/50 hover:bg-zinc-600/50 rounded-xl transition-all duration-300 group"
                                            title={t('controlVolume')}  // ✅ TRADUIT
                                        >
                                            <span className="text-xl group-hover:scale-110 transition-transform duration-200">
                                                {audioVolume === 0 ? '🔇' : audioVolume < 0.3 ? '🔈' : audioVolume < 0.7 ? '🔉' : '🔊'}
                                            </span>
                                        </button>

                                        {showVolumeControl && (
                                            <div className="absolute top-full right-0 mt-2 p-3 bg-zinc-800/90 backdrop-blur-sm border border-zinc-600/50 rounded-xl shadow-xl z-50 volume-control-enter"
                                                style={{ minWidth: '140px' }}> {/* ✅ AJOUT : Largeur fixe */}
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm flex-shrink-0">🔈</span>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.1"
                                                        value={audioVolume}
                                                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                                        className="volume-slider flex-1"
                                                    />
                                                    <span className="text-sm flex-shrink-0">🔊</span>
                                                </div>
                                                <div className="text-center mt-2">
                                                    <span className="text-xs text-zinc-400">
                                                        {Math.round(audioVolume * 100)}%
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
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
                            </div>
                            {countdown && (
                                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                                    <div className="relative w-80 h-80 flex items-center justify-center">
                                        {/* Effet de background animé */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 rounded-full animate-spin" style={{ animationDuration: '3s' }}></div>
                                        <div className="absolute inset-4 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-cyan-500/5 rounded-full animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>

                                        {/* Container pour le texte avec overlay smooth */}
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            {/* Texte principal avec transition en fondu */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span
                                                    key={countdown}
                                                    className={`text-9xl md:text-[12rem] font-black font-mono ${countdown === 'Go!'
                                                        ? 'text-green-400'
                                                        : 'text-cyan-400'
                                                        }`}
                                                    style={{
                                                        textShadow: isFirefox
                                                            ? '0 0 25px currentColor'
                                                            : '0 0 40px currentColor, 0 0 80px currentColor',
                                                        minWidth: '2em',
                                                        textAlign: 'center',
                                                        // ✅ Animation d'apparition douce
                                                        animation: 'countdownFadeIn 0.3s ease-out'
                                                    }}
                                                >
                                                    {countdown}
                                                </span>
                                            </div>

                                            {/* Pulse ring synchronisé */}
                                            <div
                                                key={`ring-${countdown}`}
                                                className="absolute inset-8 border-4 border-current rounded-full opacity-30"
                                                style={{
                                                    color: countdown === 'Go!' ? '#4ade80' : '#22d3ee',
                                                    animation: 'pulseRing 0.6s ease-out'
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {timeLeft !== null && (
                                <div className={`text-center mb-6 ${timeLeft < 10 ? 'animate-pulse' : ''
                                    }`}>
                                    <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-2xl ${timeLeft < 10
                                        ? 'bg-gradient-to-r from-red-500/30 to-pink-500/30 border border-red-400/50 text-red-400'
                                        : 'bg-gradient-to-r from-cyan-500/30 to-purple-500/30 border border-cyan-400/50 text-cyan-300'
                                        }`}>
                                        ⏳ {timeLeft}s
                                    </div>
                                </div>
                            )}

                            {/* Interface de réponse avec feedback instantané */}
                            <div className="mb-4">
                                {!hasAnswered && canAnswer && !players.find(p => p.pseudo === pseudo)?.hasFoundThisRound ? (
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            placeholder={timerStarted ? t('typeYourAnswer') : t('waitForSignal')}
                                            value={answer}
                                            onChange={(e) => setAnswer(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && timerStarted) handleSubmitAnswer();
                                            }}
                                            className={`${modernInput} w-full p-3 text-lg text-center ${!timerStarted ? 'opacity-50' : ''}`}
                                            disabled={!timerStarted}
                                            autoFocus={timerStarted}
                                        />
                                        <button
                                            onClick={handleSubmitAnswer}
                                            disabled={!answer.trim() || !timerStarted}
                                            className={`w-full py-3 rounded-2xl font-bold text-base transition-all duration-300 ${!timerStarted || !answer.trim()
                                                ? 'bg-zinc-600 text-zinc-400 cursor-not-allowed'
                                                : `${modernButton} transform hover:scale-105`
                                                }`}
                                        >
                                            {!timerStarted ? t('waitingForSignal') : t('sendMyAnswer')}
                                        </button>
                                    </div>
                                ) : !canAnswer ? (
                                    <div className="text-center p-4 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-400/30 rounded-2xl">
                                        <div className="text-3xl mb-2">🔒</div>
                                        <p className="text-orange-400 font-bold text-base">
                                            {t('youAlreadyFoundThisRound')}
                                        </p>
                                    </div>
                                ) : hasAnswered && answerFeedback?.show ? (
                                    // ✅ NOUVEAU : Affichage direct du feedback sans attente
                                    <div className={`text-center p-4 rounded-2xl transition-all duration-300 ${answerFeedback.isCorrect
                                        ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30 feedback-bounce'
                                        : 'bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-400/30'
                                        }`}>
                                        <div className="text-3xl mb-2">
                                            {answerFeedback.isCorrect ? '✅' : '❌'}
                                        </div>
                                        <p className={`font-bold text-base ${answerFeedback.isCorrect ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                            {answerFeedback.isCorrect ? t('goodAnswer') : t('wrongAnswer')}
                                        </p>
                                    </div>
                                ) : hasAnswered ? (
                                    // ✅ État temporaire minimal en attendant le feedback
                                    <div className="text-center p-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 rounded-2xl">
                                        <div className="text-lg mb-1">⏳</div>
                                        <p className="text-blue-400 font-bold text-sm">
                                            {t('waitingForServer')}
                                        </p>
                                    </div>
                                ) : null}
                            </div>
                            {/* Scoreboard moderne */}
                            <div>
                                <h3 className="text-2xl font-bold text-center mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                                    {t('liveScoreboard')}
                                </h3>
                                <div className="bg-zinc-700/30 backdrop-blur-sm rounded-2xl p-4 space-y-3">
                                    {players
                                        .sort((a, b) => (scores[b.pseudo] || 0) - (scores[a.pseudo] || 0))
                                        .map((player, index) => (
                                            <div
                                                key={player.pseudo}
                                                className={`flex justify-between items-center p-4 rounded-xl transition-all duration-300 ${player.pseudo === pseudo
                                                    ? 'bg-gradient-to-r from-cyan-500/30 to-purple-500/30 border border-cyan-400/50 transform scale-105'
                                                    : player.connected
                                                        ? 'bg-zinc-600/50 hover:bg-zinc-600/70'
                                                        : 'bg-red-900/30 border border-red-500/30' // ✅ NOUVEAU : Style pour joueurs déconnectés
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${index === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black' :
                                                        index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-500 text-black' :
                                                            index === 2 ? 'bg-gradient-to-r from-orange-400 to-red-500 text-white' :
                                                                'bg-gradient-to-r from-zinc-500 to-zinc-600 text-white'
                                                        }`}>
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-bold text-lg ${player.connected ? 'text-white' : 'text-red-400'
                                                                }`}>
                                                                {player.pseudo}
                                                            </span>
                                                            {index === 0 && <span className="text-2xl">👑</span>}
                                                            {/* ✅ NOUVEAU : Indicateur de statut de connexion */}
                                                            {!player.connected && (
                                                                <div className="flex items-center gap-1">
                                                                    {player.isReconnecting ? (
                                                                        <span className="text-yellow-400 text-sm animate-pulse">🔄</span>
                                                                    ) : (
                                                                        <span className="text-red-400 text-sm">📴</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* ✅ NOUVEAU : Message de statut */}
                                                        {!player.connected && (
                                                            <p className={`text-xs ${player.isReconnecting ? 'text-yellow-300' : 'text-red-300'}`}>
                                                                {player.isReconnecting ? t('reconnecting') : t('disconnected')}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className={`font-bold text-xl ${player.connected ? 'text-white' : 'text-red-400'
                                                        }`}>
                                                        {scores[player.pseudo] || 0} pts
                                                    </span>
                                                    <div className="text-2xl">
                                                        {player.connected ? getPlayerAnswerIcon(player) : '📴'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (view === VIEWS.RESULTS) {
        return (
            <>
                <SEO {...seoData} />
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
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return null;
}

export default BlindTestOnline;