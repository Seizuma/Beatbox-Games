import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRandomPseudo } from './utils/randomPseudo';
import SEO from './components/SEO';
import { useI18n } from './utils/i18n';

// Import des hooks personnalisés
import { useSocket } from './hooks/useSocket';
import { useAudio } from './hooks/useAudio';
import { useSession } from './hooks/useSession';
import { useUrlParams } from './hooks/useUrlParams';
import { useGameLogic } from './hooks/useGameLogic';

// Import des vues
import CreateView from './components/views/CreateView';
import LoadingView from './components/views/LoadingView';
import LobbyView from './components/views/LobbyView';
import GameView from './components/views/GameView';
import ResultsView from './components/views/ResultsView';

// ✅ IMPORTS DISCORD ET SOCKET CORRIGÉS
import { useDiscordAuth } from './utils/discordAuth';
import socketOnline from './socketOnline';

// Import des composants UI
import {
    GameModeBadge,
    LanguageSwitch,
    VolumeControl,
    CountdownOverlay,
    ArtistRevealOverlay
} from './components/UI';
import { AudioUnlockBanner, GameToast } from './components/show/GameNotices';
import { createShowT } from './utils/showI18n';

// Import des styles
import { STYLES } from './utils/styleConstants';

const VIEWS = {
    LOADING: 'loading',
    CREATE: 'create',
    LOBBY: 'lobby',
    GAME: 'game',
    RESULTS: 'results'
};

const isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('firefox');

function BlindTestOnline() {
    // ✅ HOOKS PERSONNALISÉS
    const navigate = useNavigate();
    const { t, language, switchLanguage, isEnglish } = useI18n();
    const { saveUserSession, getUserSession, clearUserSession } = useSession();
    const { detectedMode, roomFromUrl, hasProcessedUrl, isSharedLink } = useUrlParams(getUserSession, clearUserSession);

    const {
        audioVolume,
        showVolumeControl,
        audioRef,
        userInteracted,
        isSafari,
        setShowVolumeControl,
        playCountdownReadySound,
        playCountdownGoSound,
        playTensionMusic,
        stopTensionMusic,
        handleVolumeChange,
        stopAllAudio,
        forceEnableAudio,
        needsAudioUnlock
    } = useAudio();

    // ✅ HOOK DISCORD
    const { isAuthenticated, user, updateStats, handleAuthCallback } = useDiscordAuth();

    // ✅ ÉTATS PRINCIPAUX
    const [view, setView] = useState(VIEWS.LOADING);

    // PSEUDO avec priorité Discord
    const [pseudo, setPseudo] = useState(() => {
        if (isAuthenticated && user?.username) {
            return user.username;
        }
        const session = getUserSession();
        return session?.pseudo || getRandomPseudo();
    });

    // États de base
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
    const [roundResults, setRoundResults] = useState(null);
    const [finalRanking, setFinalRanking] = useState([]);

    // États pour overlays
    const [answerFeedback, setAnswerFeedback] = useState({ show: false, isCorrect: false, correctAnswer: null });
    const [countdown, setCountdown] = useState('');
    const [artistRevealState, setArtistRevealState] = useState({ show: false, artist: '', isExiting: false });

    // Mode de jeu et configuration
    const [gameMode, setGameMode] = useState('normal');
    const [artistCountRange, setArtistCountRange] = useState({ min: 10, max: 50, current: 10 });
    const [answerTimeSettings, setAnswerTimeSettings] = useState({ min: 5, max: 60, current: 30 });
    const [localAnswerTime, setLocalAnswerTime] = useState(30);
    const [localArtistCount, setLocalArtistCount] = useState(10);

    // ✅ SYNCHRONISATION PSEUDO DISCORD
    useEffect(() => {
        if (isAuthenticated && user?.username && pseudo !== user.username) {
            setPseudo(user.username);
            console.log('📱 Pseudo synchronisé avec Discord:', user.username);
        }
    }, [isAuthenticated, user?.username, pseudo]);

    // ✅ GESTION CALLBACK DISCORD - VERSION SIMPLIFIÉE
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const discordTokenFromUrl = urlParams.get('discord_token');
        const redirectPath = urlParams.get('redirect');

        if (discordTokenFromUrl) {
            console.log('🔐 Token Discord reçu depuis callback');

            // Utiliser le hook pour gérer l'auth
            const success = handleAuthCallback(discordTokenFromUrl);

            if (success) {
                console.log('✅ Authentification Discord réussie');

                // Mettre à jour l'auth du socket si disponible
                if (socketOnline && socketOnline.updateAuth) {
                    socketOnline.updateAuth(discordTokenFromUrl);
                }

                // Nettoyer l'URL
                const cleanUrl = window.location.pathname + window.location.hash;
                window.history.replaceState({}, document.title, cleanUrl);

                // Redirection si nécessaire
                if (redirectPath === 'profile') {
                    window.location.href = '/#/profile';
                    return;
                }
            } else {
                console.error('❌ Échec authentification Discord');
                setError('Erreur lors de l\'authentification Discord');
            }
        }
    }, [handleAuthCallback]);

    // ✅ MISE À JOUR AUTH SOCKET
    useEffect(() => {
        const discordToken = localStorage.getItem('discord_token');

        if (isAuthenticated && discordToken && socketOnline && socketOnline.updateAuth) {
            console.log('🔄 Mise à jour auth socket pour utilisateur Discord:', user?.username);
            socketOnline.updateAuth(discordToken);
        } else if (socketOnline && socketOnline.updateAuth) {
            console.log('🔓 Suppression auth socket - utilisateur déconnecté');
            socketOnline.updateAuth(null);
        }
    }, [isAuthenticated, user?.username]);

    // ✅ APPLICATION DU MODE DE JEU DÉTECTÉ
    useEffect(() => {
        if (hasProcessedUrl && detectedMode) {
            setGameMode(detectedMode);
            console.log('🎮 Mode de jeu détecté:', detectedMode);
        }
    }, [detectedMode, hasProcessedUrl]);

    // ✅ HOOK SOCKET
    const socketMethods = useSocket({
        // States setters
        setView, setConnected, setError, setRoom, setShareLink, setIsCreator, setGameMode, setPseudo, setCreatorPseudo,
        setPlayers, setScores, setEditingPseudo, setNewPseudo, setArtistCountRange, setLocalArtistCount,
        setAnswerTimeSettings, setLocalAnswerTime, setHasAnswered, setAnswer, setRoundResults, setCanAnswer,
        setTimerStarted, setGameState, setAnswerFeedback, setArtistRevealState, setTimeLeft, setFinalRanking,
        setCountdown, setShowSettings, setIsReady,

        // Current state values
        pseudo, room, gameState, view, players, isCreator, artistCountRange, answerTimeSettings, audioVolume, audioRef, gameMode,

        // Utility functions
        t, VIEWS, saveUserSession, clearUserSession, playCountdownReadySound, playCountdownGoSound,
        playTensionMusic, stopTensionMusic,

        // Discord data
        discordToken: isAuthenticated ? localStorage.getItem('discord_token') : null,
        discordUser: isAuthenticated ? user : null,
        updateDiscordStats: isAuthenticated ? updateStats : null,

        // Initial connection params
        detectedMode, roomFromUrl, hasProcessedUrl, isSharedLink
    });

    // ✅ HOOK GAME LOGIC
    const {
        handleCreateRoom,
        handleJoinRoom,
        handleRetry,
        handleNewGame,
        handleChangePseudo,
        handleToggleReady,
        handleStartGame,
        handleSubmitAnswer,
        handleKickPlayer,
        handleTransferHost,
        getPlayerAnswerIcon
    } = useGameLogic({
        pseudo, room, gameMode, localArtistCount, localAnswerTime, artistCountRange, answerTimeSettings,
        answer, hasAnswered, canAnswer, timerStarted, players, newPseudo, isCreator, shareLink,
        socketMethods, saveUserSession, clearUserSession, stopAllAudio,
        setError, setView, setIsReady, setEditingPseudo, setNewPseudo, setHasAnswered, setPseudo,
        VIEWS, t
    });

    // ✅ SAUVEGARDE SESSION
    useEffect(() => {
        if (pseudo && room) {
            const sessionData = {
                pseudo,
                room,
                discordId: isAuthenticated ? user?.discordId : null
            };
            saveUserSession(sessionData.pseudo, sessionData.room, sessionData);
        }
    }, [pseudo, room, isAuthenticated, user?.discordId, saveUserSession]);

    // ✅ NETTOYAGE DES ERREURS
    useEffect(() => {
        if (error) {
            const timeout = error.includes('suggestedPseudo') || error.includes('Pseudo déjà utilisé') ? 8000 : 5000;
            const timer = setTimeout(() => setError(''), timeout);
            return () => clearTimeout(timer);
        }
    }, [error]);

    // ✅ SEO DYNAMIQUE
    const getSEOData = useCallback(() => {
        const baseData = {
            keywords: "beatbox, beatboxer, blind test, jeu musical, human beatbox, multijoueur, gratuit"
        };

        switch (view) {
            case VIEWS.CREATE:
                return {
                    ...t('seoCreateRoom'),
                    ...baseData,
                    url: "https://beatboxgames.com/#/blindtest-online"
                };
            case VIEWS.LOBBY:
                const mode = gameMode === 'quick' ? t('quickMode') : t('normalMode');
                const lobbyData = t('seoLobby', { room, mode });
                return {
                    ...lobbyData,
                    ...baseData,
                    url: `https://beatboxgames.com/#/blindtest-online?room=${room}${gameMode !== 'normal' ? `&mode=${gameMode}` : ''}`
                };
            case VIEWS.GAME:
                const count = gameMode === 'quick' ? '10' : '50+';
                const gameData = t('seoGame', { room, count });
                return {
                    ...gameData,
                    ...baseData,
                    url: `https://beatboxgames.com/#/blindtest-online?room=${room}${gameMode !== 'normal' ? `&mode=${gameMode}` : ''}`
                };
            case VIEWS.RESULTS:
                const resultsData = t('seoResults', { room });
                return {
                    ...resultsData,
                    ...baseData,
                    url: `https://beatboxgames.com/#/blindtest-online?room=${room}${gameMode !== 'normal' ? `&mode=${gameMode}` : ''}`
                };
            default:
                return {
                    title: "BeatBox Games - Blind Test Musical & Univers Beatbox | Jeu Multijoueur Gratuit",
                    description: "Plongez dans l'univers du beatbox avec BeatBox Games ! Blind Test musical multijoueur, découvrez les plus grands beatboxers, créez votre room privée et défiez vos amis.",
                    ...baseData,
                    url: "https://beatboxgames.com/#/blindtest-online"
                };
        }
    }, [view, gameMode, room, t]);

    const seoData = getSEOData();

    // ✅ PROPS COMMUNES
    // ✅ SOLUTION - composants stables
    const LanguageSwitchComponent = useCallback(() =>
        <LanguageSwitch switchLanguage={switchLanguage} isEnglish={isEnglish} />,
        [switchLanguage, isEnglish]
    );

    const GameModeBadgeComponent = useCallback(() =>
        <GameModeBadge gameMode={gameMode} t={t} />,
        [gameMode, t]
    );

    const commonViewProps = useMemo(() => ({
        LanguageSwitch: LanguageSwitchComponent,
        GameModeBadge: GameModeBadgeComponent,
        t,
        language
    }), [LanguageSwitchComponent, GameModeBadgeComponent, t, language]);
    // ✅ AFFICHAGES CONDITIONNELS
    const showSafariAudioInfo = isSafari && !userInteracted && (view === VIEWS.LOBBY || view === VIEWS.GAME);
    const showError = error && !showSafariAudioInfo;
    const isSharedLinkError = error && (error.includes('Pseudo déjà utilisé') || error.includes('suggestedPseudo'));

    // ✅ RENDU
    return (
        <>
            {/* Alerte audio (Safari / iOS) */}
            {showSafariAudioInfo && (
                <AudioUnlockBanner message={createShowT(language)('notices.audioUnlock')} />
            )}

            {/* Notification d'erreur/succès */}
            {showError && (
                <GameToast
                    message={error}
                    hint={isSharedLinkError ? createShowT(language)('notices.sharedLinkHint') : null}
                />
            )}

            {/* Debug overlay en développement */}
            {process.env.NODE_ENV === 'development' && isSharedLink && (
                <div className="fixed bottom-4 right-4 z-40 bg-black/80 text-white p-2 rounded text-xs max-w-xs">
                    <div className="font-bold">🔗 DEBUG - Lien partagé</div>
                    <div>Room: {roomFromUrl}</div>
                    <div>Mode: {detectedMode || 'normal'}</div>
                    <div>Pseudo: {pseudo}</div>
                    <div>Discord: {isAuthenticated ? user?.username : 'Non'}</div>
                    <div>Processed: {hasProcessedUrl ? '✅' : '❌'}</div>
                </div>
            )}

            {/* Overlays globaux */}
            <CountdownOverlay countdown={countdown} isFirefox={isFirefox} />
            <ArtistRevealOverlay artistRevealState={artistRevealState} t={t} />

            {/* Vue principale */}
            <SEO {...seoData} />

            {view === VIEWS.LOADING && (
                <LoadingView
                    {...commonViewProps}
                    room={room}
                    message={
                        isSharedLink
                            ? t('loadingSharedLink') || 'Connexion via lien partagé...'
                            : t('loading') || 'Chargement...'
                    }
                />
            )}

            {view === VIEWS.CREATE && (
                <CreateView
                    {...commonViewProps}
                    pseudo={pseudo}
                    setPseudo={setPseudo}
                    gameMode={gameMode}
                    error={error}
                    handleCreateRoom={handleCreateRoom}
                    handleJoinRoom={handleJoinRoom}
                    isFromSharedLink={isSharedLink}
                    suggestedRoom={roomFromUrl}
                    onBackToHub={() => navigate('/')}
                />
            )}

            {view === VIEWS.LOBBY && (
                <LobbyView
                    {...commonViewProps}
                    room={room}
                    pseudo={pseudo}
                    isCreator={isCreator}
                    creatorPseudo={creatorPseudo}
                    players={players}
                    scores={scores}
                    isReady={isReady}
                    editingPseudo={editingPseudo}
                    newPseudo={newPseudo}
                    showSettings={showSettings}
                    localArtistCount={localArtistCount}
                    localAnswerTime={localAnswerTime}
                    artistCountRange={artistCountRange}
                    answerTimeSettings={answerTimeSettings}
                    shareLink={shareLink}
                    error={error}
                    setEditingPseudo={setEditingPseudo}
                    setNewPseudo={setNewPseudo}
                    setShowSettings={setShowSettings}
                    setLocalArtistCount={setLocalArtistCount}
                    setLocalAnswerTime={setLocalAnswerTime}
                    handleChangePseudo={handleChangePseudo}
                    handleToggleReady={handleToggleReady}
                    handleStartGame={handleStartGame}
                    handleKickPlayer={handleKickPlayer}
                    handleTransferHost={handleTransferHost}
                    isFromSharedLink={isSharedLink}
                    socketMethods={socketMethods}
                    forceEnableAudio={forceEnableAudio}
                    needsAudioUnlock={needsAudioUnlock}
                    onBackToHub={() => {
                        // ✅ Déconnecter le socket
                        if (room) {
                            socketOnline.emit('leaveRoom', { room });
                        }
                        // ✅ Nettoyer les états
                        setRoom('');
                        setView(VIEWS.CREATE);
                        // ✅ Naviguer vers le Hub
                        navigate('/');
                    }}
                />
            )}

            {view === VIEWS.GAME && (
                <GameView
                    {...commonViewProps}
                    gameState={gameState}
                    timeLeft={timeLeft}
                    answer={answer}
                    hasAnswered={hasAnswered}
                    canAnswer={canAnswer}
                    timerStarted={timerStarted}
                    players={players}
                    scores={scores}
                    pseudo={pseudo}
                    answerFeedback={answerFeedback}
                    isFirefox={isFirefox}
                    setAnswer={setAnswer}
                    handleSubmitAnswer={handleSubmitAnswer}
                    getPlayerAnswerIcon={getPlayerAnswerIcon}
                    volumeControlProps={{
                        audioVolume,
                        showVolumeControl,
                        handleVolumeChange,
                        setShowVolumeControl,
                        t
                    }}
                    userInteracted={userInteracted}
                    forceEnableAudio={forceEnableAudio}
                />
            )}

            {view === VIEWS.RESULTS && (
                <ResultsView
                    {...commonViewProps}
                    finalRanking={finalRanking}
                    pseudo={pseudo}
                    handleNewGame={handleNewGame}
                    shareLink={shareLink}
                    room={room}
                />
            )}
        </>
    );
}

export default BlindTestOnline;