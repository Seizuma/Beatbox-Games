import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SEO from './components/SEO';
import { useI18n } from './utils/i18n';
import socketBuzzer from './buzzer-socket';

// Import des vues
import BuzzerCreateView from './components/buzzer/BuzzerCreateView';
import BuzzerLobbyView from './components/buzzer/BuzzerLobbyView';
import BuzzerGameView from './components/buzzer/BuzzerGameView';
import BuzzerResultsView from './components/buzzer/BuzzerResultsView';

// Import des composants UI
import { LanguageSwitch } from './components/UI';
import { GameToast } from './components/show/GameNotices';

const VIEWS = {
    CREATE: 'create',
    LOBBY: 'lobby',
    GAME: 'game',
    RESULTS: 'results'
};

// Hook pour parser les paramètres d'URL
function useQuery() {
    return new URLSearchParams(useLocation().search);
}

function BuzzerBattle() {
    const { t, language, isEnglish, switchLanguage } = useI18n();
    const [discordUser, setDiscordUser] = useState(null);
    const navigate = useNavigate();
    const query = useQuery();

    // États principaux
    const [currentView, setCurrentView] = useState(VIEWS.CREATE);
    const [roomCode, setRoomCode] = useState('');

    // ✅ CORRECTION : Initialiser username depuis localStorage
    const [username, setUsername] = useState(() => {
        const saved = localStorage.getItem('buzzer_username');
        console.log('🔷 Init username depuis localStorage:', saved);
        return saved || '';
    });

    const [avatar, setAvatar] = useState(() => {
        const saved = localStorage.getItem('buzzer_avatar');
        return saved || '🎤';
    });

    const [gameState, setGameState] = useState(null);
    const [players, setPlayers] = useState([]);
    const [isCreator, setIsCreator] = useState(false);

    // Message d'erreur affiché sur le plateau (remplace les alert())
    const [notice, setNotice] = useState('');
    const noticeTimeoutRef = useRef(null);
    const showError = (message) => {
        setNotice(message || 'Erreur');
        if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
        noticeTimeoutRef.current = setTimeout(() => setNotice(''), 4000);
    };

    // États de jeu
    const [beatboxerImage, setBeatboxerImage] = useState(null);
    const [currentRound, setCurrentRound] = useState(0);
    const [totalRounds, setTotalRounds] = useState(10);
    const [pixelLevel, setPixelLevel] = useState(100);
    const [buzzedPlayer, setBuzzedPlayer] = useState(null);
    const [canBuzz, setCanBuzz] = useState(true);
    const [currentBeatboxer, setCurrentBeatboxer] = useState(null);
    const [scores, setScores] = useState([]);
    const [initialRoomCode, setInitialRoomCode] = useState('');
    const [joinRoomCode, setJoinRoomCode] = useState('');
    const [mySocketId, setMySocketId] = useState(null);
    const [wrongGuessFeedback, setWrongGuessFeedback] = useState(null);
    const [justReconnected, setJustReconnected] = useState(false);
    const [showCountdown, setShowCountdown] = useState(false);
    const [countdownValue, setCountdownValue] = useState(3);
    // ✅ CORRECTION : useEffect pour surveiller et mettre à jour mySocketId
    useEffect(() => {
        const updateSocketId = () => {
            if (socketBuzzer.connected && socketBuzzer.id) {
                console.log('🆔 Mise à jour Socket ID:', socketBuzzer.id);
                setMySocketId(socketBuzzer.id);
            }
        };

        // Vérifier immédiatement si déjà connecté
        updateSocketId();

        // Écouter les reconnexions
        const interval = setInterval(() => {
            if (socketBuzzer.connected && socketBuzzer.id !== mySocketId) {
                updateSocketId();
            }
        }, 500);

        return () => clearInterval(interval);
    }, [mySocketId]);

    // ✅ DEBUG : Logger le username quand il change
    useEffect(() => {
        console.log('👤 Username state mis à jour:', username);
    }, [username]);

    // Connexion Socket.IO
    useEffect(() => {
        socketBuzzer.connect();

        // ✅ Écouter l'événement connect
        socketBuzzer.on('connect', () => {
            console.log('✅ Socket connecté, ID:', socketBuzzer.id);
            setMySocketId(socketBuzzer.id);
        });

        // Écoute des événements
        socketBuzzer.on('buzzer:playerJoined', handlePlayerJoined);
        socketBuzzer.on('buzzer:gameStarted', handleGameStarted);
        socketBuzzer.on('buzzer:pixelUpdate', handlePixelUpdate);
        socketBuzzer.on('buzzer:playerBuzzed', handlePlayerBuzzed);
        socketBuzzer.on('buzzer:guessResult', handleGuessResult);
        socketBuzzer.on('buzzer:wrongGuess', handleWrongGuess);
        socketBuzzer.on('buzzer:fullReveal', handleFullReveal);
        socketBuzzer.on('buzzer:nextRound', handleNextRound);
        socketBuzzer.on('buzzer:gameFinished', handleGameFinished);
        socketBuzzer.on('buzzer:autoReveal', handleAutoReveal);

        return () => {
            socketBuzzer.off('connect');
            socketBuzzer.off('buzzer:playerJoined');
            socketBuzzer.off('buzzer:countdownStarted');
            socketBuzzer.off('buzzer:gameStarted');
            socketBuzzer.off('buzzer:pixelUpdate');
            socketBuzzer.off('buzzer:playerBuzzed');
            socketBuzzer.off('buzzer:guessResult');
            socketBuzzer.off('buzzer:wrongGuess');
            socketBuzzer.off('buzzer:fullReveal');
            socketBuzzer.off('buzzer:nextRound');
            socketBuzzer.off('buzzer:gameFinished');
            socketBuzzer.off('buzzer:autoReveal');
            socketBuzzer.disconnect();
        };
    }, []);

    // Écouter les données Discord depuis le socket
    useEffect(() => {
        const handleDiscordData = (data) => {
            setDiscordUser(data);
        };

        socketBuzzer.on('discord:userInfo', handleDiscordData);

        // Demander les infos Discord au socket
        socketBuzzer.emit('discord:getInfo', (response) => {
            if (response.success && response.user) {
                setDiscordUser(response.user);
            }
        });

        return () => {
            socketBuzzer.off('discord:userInfo', handleDiscordData);
        };
    }, []);

    // ✅ NOUVEAU : Mettre à jour l'auth Discord sur le socket Buzzer
    useEffect(() => {
        const discordToken = localStorage.getItem('discord_token');

        if (discordToken && socketBuzzer) {
            console.log('🔐 Configuration auth Discord sur Buzzer socket');
            socketBuzzer.updateAuth(discordToken);

            // Si déjà connecté, reconnecter pour appliquer l'auth
            if (socketBuzzer.connected) {
                console.log('🔄 Reconnexion pour appliquer auth Discord...');
                socketBuzzer.disconnect();
                socketBuzzer.connect();
            }
        }
    }, []); // Exécuter une seule fois au montage

    // Gérer le paramètre ?room= dans l'URL
    useEffect(() => {
        const roomFromUrl = query.get('room');

        if (roomFromUrl && currentView === VIEWS.CREATE) {
            setJoinRoomCode(roomFromUrl);

            const savedUsername = localStorage.getItem('buzzer_username');
            const savedAvatar = localStorage.getItem('buzzer_avatar');

            if (savedUsername) {
                setUsername(savedUsername);
            }
            if (savedAvatar) {
                setAvatar(savedAvatar);
            }

            if (savedUsername) {
                console.log('🔗 Rejoindre automatiquement la room:', roomFromUrl);
                handleJoinRoom({
                    roomCode: roomFromUrl,
                    username: savedUsername,
                    avatar: savedAvatar || '🎤'
                });
            }
        }
    }, [query]);

    // ✅ Écouter les mises à jour de configuration
    useEffect(() => {
        const handleConfigUpdated = (data) => {
            console.log('⚙️ Configuration mise à jour reçue:', data);
            setGameState(prevState => ({
                ...prevState,
                mode: data.mode,
                filter: data.filter,
                totalRounds: data.totalRounds
            }));
            setTotalRounds(data.totalRounds);
        };

        socketBuzzer.on('buzzer:configUpdated', handleConfigUpdated);

        return () => {
            socketBuzzer.off('buzzer:configUpdated', handleConfigUpdated);
        };
    }, []);


    socketBuzzer.on('buzzer:countdownStarted', () => {
        console.log('⏱️ Countdown démarré par le serveur');
        // Le countdown sera géré par BuzzerLobbyView
    });

    // ✅ NOUVEAU : Écouter le countdown du serveur
    useEffect(() => {
        const handleCountdownStart = () => {
            console.log('⏱️ Countdown reçu depuis le serveur');
            setShowCountdown(true);
            setCountdownValue(3);

            // Countdown 3... 2... 1...
            let current = 3;
            const countdownInterval = setInterval(() => {
                current--;
                setCountdownValue(current);

                if (current <= 0) {
                    clearInterval(countdownInterval);
                    // Le serveur va émettre gameStarted, pas besoin d'appeler onStartGame
                    setTimeout(() => {
                        setShowCountdown(false);
                    }, 500);
                }
            }, 1000);
        };

        socketBuzzer.on('buzzer:countdownStarted', handleCountdownStart);

        return () => {
            socketBuzzer.off('buzzer:countdownStarted', handleCountdownStart);
        };
    }, []);

    // ✅ NOUVEAU : Gestion de la déconnexion et reconnexion
    useEffect(() => {
        socketBuzzer.on('disconnect', (reason) => {
            console.warn('⚠️ Socket déconnecté:', reason);

            // Si on était dans une partie, sauvegarder la session
            if (roomCode && username) {
                localStorage.setItem('buzzer_session', JSON.stringify({
                    roomCode,
                    username,
                    timestamp: Date.now()
                }));
                console.log('💾 Session sauvegardée pour reconnexion');
            }
        });

        socketBuzzer.on('buzzer:playerDisconnected', (data) => {
            console.log('👋 Joueur déconnecté:', data.username);
            // Mettre à jour l'affichage des joueurs
            setPlayers(prev => prev.map(p =>
                p.id === data.playerId
                    ? { ...p, connected: false }
                    : p
            ));
        });

        socketBuzzer.on('buzzer:playerReconnected', (data) => {
            console.log('🔄 Joueur reconnecté:', data.username);

            // Mettre à jour l'affichage des joueurs
            setPlayers(prev => prev.map(p =>
                p.username === data.username
                    ? { ...p, id: data.playerId, connected: true }
                    : p
            ));

            // ✅ Si c'est nous qui nous reconnectons et qu'on est en jeu
            if (data.username === username && currentView === VIEWS.CREATE) {
                console.log('🔄 C\'est nous qui nous reconnectons, on va recharger l\'état');

                // Demander l'état actuel du jeu
                socketBuzzer.emit('buzzer:reconnect', {
                    roomCode: roomCode,
                    username: username
                }, (response) => {
                    if (response.success && response.game.status === 'playing') {
                        // Même logique de restauration que ci-dessus
                        setCurrentView(VIEWS.GAME);

                        if (response.game.currentRoundState) {
                            const roundState = response.game.currentRoundState;
                            setCurrentRound(roundState.currentRound);
                            setTotalRounds(roundState.totalRounds);
                            setBeatboxerImage(roundState.beatboxerImage);
                            setPixelLevel(roundState.pixelLevel);
                            setBuzzedPlayer(roundState.buzzedPlayer);
                            setCurrentBeatboxer(roundState.currentBeatboxer);
                            setCanBuzz(!roundState.buzzedPlayer);
                        }
                    }
                });
            }
        });


        socketBuzzer.on('buzzer:hostTransferred', (data) => {
            console.log('👑 Host transféré:', data);
            setIsCreator(data.newHostId === socketBuzzer.id);
            alert(`${data.newHost} est maintenant le host de la room`);
        });

        socketBuzzer.on('buzzer:playerRemoved', (data) => {
            console.log('🗑️ Joueur supprimé:', data.username);
            setPlayers(prev => prev.filter(p => p.id !== data.playerId));
        });


        // ✅ NOUVEAU : Gestion du kick
        socketBuzzer.on('buzzer:kicked', (data) => {
            console.log('🚫 Vous avez été exclu:', data);
            alert(data.message);

            // Retourner à la page de création
            setCurrentView(VIEWS.CREATE);
            setRoomCode('');
            setPlayers([]);
            localStorage.removeItem('buzzer_session');
        });

        socketBuzzer.on('buzzer:playerKicked', (data) => {
            console.log('🚫 Joueur exclu:', data.username);
            // Mettre à jour la liste des joueurs
            setPlayers(prev => prev.filter(p => p.id !== data.playerId));
        });

        return () => {
            socketBuzzer.off('disconnect');
            socketBuzzer.off('buzzer:playerDisconnected');
            socketBuzzer.off('buzzer:playerReconnected');
            socketBuzzer.off('buzzer:hostTransferred');
            socketBuzzer.off('buzzer:playerRemoved');
            socketBuzzer.off('buzzer:kicked');              // ✅ AJOUT
            socketBuzzer.off('buzzer:playerKicked');        // ✅ AJOUT
        };
    }, [roomCode, username]);

    // ✅ NOUVEAU : Tentative de reconnexion automatique au chargement
    useEffect(() => {
        const savedSession = localStorage.getItem('buzzer_session');

        if (savedSession && socketBuzzer.connected) {
            try {
                const session = JSON.parse(savedSession);
                const age = Date.now() - session.timestamp;

                // Si la session a moins de 5 minutes, tenter la reconnexion
                if (age < 5 * 60 * 1000) {
                    console.log('🔄 Tentative de reconnexion automatique...');

                    socketBuzzer.emit('buzzer:reconnect', {
                        roomCode: session.roomCode,
                        username: session.username
                    }, (response) => {
                        if (response.success) {
                            console.log('✅ Reconnexion automatique réussie!');
                            console.log('📊 État du jeu:', response.game);

                            setRoomCode(response.game.roomCode);
                            setUsername(session.username);
                            setGameState(response.game);
                            setPlayers(Object.values(response.game.players));
                            setIsCreator(response.game.isCreator);

                            // ✅ Si la partie est en cours, restaurer l'état du round
                            if (response.game.status === 'playing') {
                                setCurrentView(VIEWS.GAME);

                                // ✅ Restaurer l'état du round si disponible
                                if (response.game.currentRoundState) {
                                    const roundState = response.game.currentRoundState;

                                    setCurrentRound(roundState.currentRound);
                                    setTotalRounds(roundState.totalRounds);
                                    setBeatboxerImage(roundState.beatboxerImage);
                                    setPixelLevel(roundState.pixelLevel);
                                    setBuzzedPlayer(roundState.buzzedPlayer);
                                    setCurrentBeatboxer(roundState.currentBeatboxer);
                                    setCanBuzz(!roundState.buzzedPlayer);

                                    // ✅ Marquer comme reconnecté et retirer le banner après 3 secondes
                                    setJustReconnected(true);
                                    setTimeout(() => setJustReconnected(false), 3000);

                                    console.log('🔄 État du round restauré:', {
                                        round: roundState.currentRound,
                                        pixelLevel: roundState.pixelLevel,
                                        buzzedPlayer: roundState.buzzedPlayer
                                    });
                                }
                            } else {
                                setCurrentView(VIEWS.LOBBY);
                            }

                            localStorage.removeItem('buzzer_session');
                        } else {
                            console.warn('❌ Reconnexion échouée:', response.error);
                            localStorage.removeItem('buzzer_session');
                        }
                    });
                } else {
                    console.log('⏰ Session expirée');
                    localStorage.removeItem('buzzer_session');
                }
            } catch (error) {
                console.error('❌ Erreur lecture session:', error);
                localStorage.removeItem('buzzer_session');
            }
        }
    }, [socketBuzzer.connected]);

    // Gestion du buzzer avec la barre espace
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.code === 'Space' && currentView === VIEWS.GAME && canBuzz && !buzzedPlayer) {
                e.preventDefault();
                handleBuzz();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [currentView, canBuzz, buzzedPlayer]);

    // ==================== HANDLERS ====================

    const handlePlayerJoined = (data) => {
        console.log('👤 Joueur rejoint:', data);
        console.log('📊 État des joueurs reçus:', Object.values(data.players || {}).map(p => ({
            username: p.username,
            connected: p.connected
        })));

        if (data.players) {
            setPlayers(Object.values(data.players));
        } else if (data.game?.players) {
            setPlayers(Object.values(data.game.players));
        }
    };

    const handleGameStarted = (data) => {
        console.log('🎮 Partie démarrée:', data);
        setCurrentRound(data.currentRound);
        setTotalRounds(data.totalRounds);
        setBeatboxerImage(data.beatboxerImage);
        setCurrentView(VIEWS.GAME);
        setPixelLevel(100);
        setBuzzedPlayer(null);
        setCanBuzz(true);
    };

    const handlePixelUpdate = (data) => {
        setPixelLevel(data.pixelLevel);
    };

    const handlePlayerBuzzed = (data) => {
        console.log('🔔 Joueur a buzzé:', data);
        setBuzzedPlayer(data.playerId);
        setCanBuzz(false);
        if (data.currentPixelLevel !== undefined) {
            setPixelLevel(data.currentPixelLevel);
        }
    };

    const handleWrongGuess = (data) => {
        console.log('❌ Mauvaise réponse:', data);
        console.log('🆔 Mon socket ID:', mySocketId);
        console.log('🆔 Joueur fautif ID:', data.playerId);
        console.log('👤 Mon username:', username);
        console.log('👤 Joueur fautif name:', data.playerName);

        // ✅ Mettre à jour les scores
        if (data.scores) {
            setScores(data.scores);
        }

        // ✅ NOUVEAU : Afficher le feedback de mauvaise réponse
        setWrongGuessFeedback({
            playerName: data.playerName,
            playerId: data.playerId
        });

        // ✅ Effacer le feedback après 1 secondes
        setTimeout(() => {
            setWrongGuessFeedback(null);
        }, 1000);

        // ✅ Réinitialiser le joueur qui avait buzzé
        setBuzzedPlayer(null);

        // ✅ Bloquer UNIQUEMENT le joueur qui s'est trompé
        const isMe = (mySocketId && data.playerId === mySocketId) ||
            (username && data.playerName === username);

        if (isMe) {
            console.log('🚫 C\'est moi qui me suis trompé, blocage 1s');
            setCanBuzz(false);
            setTimeout(() => {
                console.log('✅ Buzzer débloqué après erreur');
                setCanBuzz(true);
            }, 1000);
        } else {
            console.log('✅ Pas moi, buzzer reste actif');
            setCanBuzz(true);
        }
    };

    const handleGuessResult = (data) => {
        console.log('✅ Bonne réponse:', data);
        setCurrentBeatboxer(data.correctAnswer);
        setScores(data.scores);

        setTimeout(() => {
            setCurrentBeatboxer(null);
            setBuzzedPlayer(null);
        }, 3000);
    };

    const handleNextRound = (data) => {
        console.log('➡️ Round suivant:', data);
        setCurrentBeatboxer(null);
        setPixelLevel(100);
        setCurrentRound(data.currentRound);
        setBeatboxerImage(data.beatboxerImage);
        setBuzzedPlayer(null);
        setCanBuzz(true);
    };

    const handleGameFinished = (data) => {
        console.log('🏁 Partie terminée:', data);
        console.log('📊 Room code actuel:', roomCode);
        console.log('📊 Scores finaux:', data.finalScores);

        setScores(data.finalScores);
        setCurrentView(VIEWS.RESULTS);

    };

    const handleFullReveal = (data) => {
        console.log('🌟 Image complètement révélée:', data);
        setPixelLevel(0);
        setCanBuzz(true);
    };

    const handleAutoReveal = (data) => {
        console.log('🎭 Révélation automatique:', data);
        setCurrentBeatboxer(data.correctAnswer);
        setCanBuzz(false);

        setTimeout(() => {
            setCurrentBeatboxer(null);
            setBuzzedPlayer(null);
        }, 3000);
    };

    // ==================== ACTIONS ====================

    const handleCreateRoom = (config) => {
        const finalConfig = {
            ...config,
            username: discordUser?.username || config.username
        };
        localStorage.setItem('buzzer_username', finalConfig.username);
        localStorage.setItem('buzzer_avatar', finalConfig.avatar);

        socketBuzzer.emit('buzzer:createRoom', finalConfig, (response) => {
            console.log('📥 Réponse création room:', response);

            if (response.success) {
                setRoomCode(response.roomCode);
                setUsername(config.username);
                setAvatar(config.avatar || '🎤');
                setIsCreator(true);
                setGameState(response.game);
                setPlayers(Object.values(response.game.players));
                setCurrentView(VIEWS.LOBBY);
            } else {
                showError(response.error);
            }
        });
    };

    const handleJoinRoom = (joinConfig) => {
        const finalJoinConfig = {
            ...joinConfig,
            username: discordUser?.username || joinConfig.username
        };

        localStorage.setItem('buzzer_username', finalJoinConfig.username);
        localStorage.setItem('buzzer_avatar', finalJoinConfig.avatar);

        socketBuzzer.emit('buzzer:joinRoom', finalJoinConfig, (response) => {
            console.log('📥 Réponse du serveur joinRoom:', response);

            if (response.success) {
                console.log('⚙️ Config reçue du serveur:');
                console.log('  - mode:', response.game.mode);
                console.log('  - filter:', response.game.filter);
                console.log('  - totalRounds:', response.game.totalRounds);

                setRoomCode(joinConfig.roomCode);
                setUsername(joinConfig.username);
                console.log('✅ Username défini à:', joinConfig.username);
                setAvatar(joinConfig.avatar || '🎤');
                setIsCreator(false);

                setGameState(response.game);
                setPlayers(Object.values(response.game.players));

                if (response.game.totalRounds) {
                    setTotalRounds(response.game.totalRounds);
                }

                setTimeout(() => {
                    setCurrentView(VIEWS.LOBBY);
                }, 0);

                navigate('/buzzer-battle', { replace: true });
            } else {
                showError(response.error);
            }
        });
    };

    const handleStartGame = () => {
        socketBuzzer.emit('buzzer:startGame', { roomCode }, (response) => {
            if (!response.success) {
                showError(response.error);
            }
        });
    };

    const handleBuzz = () => {
        if (!canBuzz || buzzedPlayer) return;

        socketBuzzer.emit('buzzer:buzz', { roomCode }, (response) => {
            if (!response.success) {
                console.log('Buzz raté:', response.error);
            }
        });
    };

    const handleGuess = (answer) => {
        socketBuzzer.emit('buzzer:guess', { roomCode, answer }, (response) => {
            if (!response.success) {
                showError(response.error);
            }
        });
    };

    const handleBackToHome = () => {
        navigate('/');
    };

    const handlePlayAgain = () => {
        setCurrentView(VIEWS.LOBBY);

        setScores([]);
        setCurrentRound(0);
        setPixelLevel(100);
        setBuzzedPlayer(null);
        setCanBuzz(true);
        setCurrentBeatboxer(null);

        socketBuzzer.emit('buzzer:resetGame', { roomCode }, (response) => {
            if (response.success) {
                setGameState(response.game);
                setPlayers(Object.values(response.game.players));
            }
        });
    };

    // ==================== RENDER ====================

    const languageSwitch = <LanguageSwitch switchLanguage={switchLanguage} isEnglish={isEnglish} />;

    return (
        <>
            <SEO
                title="Buzzer Battle - BeatBox Games"
                description="Devinez les beatboxers avant vos adversaires dans ce jeu de rapidité !"
            />

            <GameToast message={notice} />

            {currentView === VIEWS.CREATE && (
                <BuzzerCreateView
                    language={language}
                    languageSwitch={languageSwitch}
                    onQuit={handleBackToHome}
                    onCreateRoom={handleCreateRoom}
                    onJoinRoom={handleJoinRoom}
                    username={username}
                    setUsername={setUsername}
                    avatar={avatar}
                    discordUser={discordUser}
                />
            )}

            {currentView === VIEWS.LOBBY && (
                <BuzzerLobbyView
                    key={language}
                    language={language}
                    languageSwitch={languageSwitch}
                    onQuit={handleBackToHome}
                    roomCode={roomCode}
                    players={players}
                    isCreator={isCreator}
                    gameState={gameState}
                    onStartGame={handleStartGame}
                    onError={showError}
                />
            )}

            {currentView === VIEWS.GAME && (
                <BuzzerGameView
                    key={language}
                    language={language}
                    languageSwitch={languageSwitch}
                    currentRound={currentRound}
                    totalRounds={totalRounds}
                    pixelLevel={pixelLevel}
                    buzzedPlayer={buzzedPlayer}
                    canBuzz={canBuzz}
                    currentBeatboxer={currentBeatboxer}
                    beatboxerImage={beatboxerImage}
                    players={players}
                    scores={scores}
                    onBuzz={handleBuzz}
                    onGuess={handleGuess}
                    myPlayerId={mySocketId}
                    wrongGuessFeedback={wrongGuessFeedback}
                    justReconnected={justReconnected}
                    onQuit={handleBackToHome}
                />
            )}

            {currentView === VIEWS.RESULTS && (
                <BuzzerResultsView
                    key={language}
                    language={language}
                    languageSwitch={languageSwitch}
                    scores={scores}
                    myPlayerId={mySocketId}
                    onPlayAgain={handlePlayAgain}
                    onBackToHome={handleBackToHome}
                />
            )}
        </>
    );
}

export default BuzzerBattle;