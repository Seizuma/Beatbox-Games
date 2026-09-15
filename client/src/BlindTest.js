import React, { useEffect, useState, useRef } from 'react';
import socketManager from './socket';
import useSocketHandlers from './hooks/useSocketHandlers';
import JoinForm from './components/JoinForm';
import GameScreen from './components/GameScreen';
import './App.css';

function BlindTest() {
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState('');
    const [pseudo, setPseudo] = useState('');
    const [room, setRoom] = useState('');
    const [joining, setJoining] = useState(false);
    const [joined, setJoined] = useState(false);
    const [error, setError] = useState('');
    const [canAnswer, setCanAnswer] = useState(false);
    const [answer, setAnswer] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState('');
    const [hasScored, setHasScored] = useState(false);
    const [currentLevel, setCurrentLevel] = useState(null);
    const [scores, setScores] = useState({});
    const [lastAnswers, setLastAnswers] = useState({});
    const [countdownText, setCountdownText] = useState('');
    const [countdownVisible, setCountdownVisible] = useState(false);
    const [timeLeft, setTimeLeft] = useState(null);

    const timerRef = useRef(null);
    const socketRef = useRef(null);

    function stopTimer() {
        if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }

    // ✅ Initialiser les handlers
    const { stopAllTimers } = useSocketHandlers({
        setConnected, setJoining, setJoined, setError,
        setLastAnswers, setResult, setAnswer, setSubmitted,
        setHasScored, setCanAnswer, setCurrentLevel, stopTimer, setTimeLeft,
        setCountdownText, setCountdownVisible, setScores,
        socketRef
    });

    // ✅ Connexion Socket SEULEMENT quand on arrive sur cette page
    useEffect(() => {
        console.log('🎮 Initialisation BlindTest IRL...');

        // Pré-remplir les champs depuis localStorage
        const savedPseudo = localStorage.getItem('blindtest_pseudo') || '';
        const savedRoom = localStorage.getItem('blindtest_room') || '';

        if (savedPseudo) setPseudo(savedPseudo);
        if (savedRoom) setRoom(savedRoom);

        // ✅ CONNEXION CONDITIONNELLE
        setConnecting(true);
        setConnectionError('');

        const socket = socketManager.connect();
        socketRef.current = socket;

        // Gestionnaires d'événements
        const handleConnect = () => {
            console.log('✅ Socket IRL connecté');
            setConnected(true);
            setConnecting(false);
            setConnectionError('');
        };

        const handleDisconnect = (reason) => {
            console.log('❌ Socket IRL déconnecté:', reason);
            setConnected(false);
            if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
                setTimeout(() => {
                    if (socketRef.current && !socketRef.current.connected) {
                        setConnecting(true);
                        socketRef.current.connect();
                    }
                }, 2000);
            }
        };

        const handleConnectError = (error) => {
            console.error('🚨 Erreur de connexion IRL:', error);
            setConnected(false);
            setConnecting(false);
            setConnectionError(error.message || 'Erreur de connexion au serveur');
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);

        if (socket.connected) {
            handleConnect();
        }

        // ✅ NETTOYAGE à la sortie de la page
        return () => {
            console.log('🧹 Nettoyage BlindTest IRL...');
            if (socketRef.current) {
                socketRef.current.off('connect', handleConnect);
                socketRef.current.off('disconnect', handleDisconnect);
                socketRef.current.off('connect_error', handleConnectError);
            }
            stopTimer();
            stopAllTimers();
            // ✅ DÉCONNEXION complète lors de la sortie
            socketManager.disconnect();
        };
    }, []);

    const handleJoin = () => {
        if (!pseudo.trim() || !room.trim() || joining || !socketRef.current) return;

        setJoining(true);
        setError('');

        localStorage.setItem("blindtest_pseudo", pseudo.trim());
        localStorage.setItem("blindtest_room", room.trim());

        socketRef.current.emit('join-room', { pseudo: pseudo.trim(), room: room.trim() });
    };

    const handleSubmit = () => {
        if (!answer.trim() || !socketRef.current) return;

        socketRef.current.emit('player-answer', {
            pseudo: pseudo.trim(),
            room: room.trim(),
            answer: answer.trim()
        });
        setSubmitted(true);
    };

    const handleRetryConnection = () => {
        console.log('🔄 Tentative de reconnexion manuelle...');
        setConnecting(true);
        setConnectionError('');
        if (socketRef.current) {
            socketRef.current.connect();
        }
    };

    // Auto-submit au timeout
    useEffect(() => {
        if (timeLeft === 0 && canAnswer && !submitted && socketRef.current) {
            console.log('⏰ Temps écoulé, envoi automatique...');
            socketRef.current.emit('player-answer', {
                pseudo: pseudo.trim(),
                room: room.trim(),
                answer: answer.trim() || ''
            });
            setSubmitted(true);
            setCanAnswer(false);
        }
    }, [timeLeft, canAnswer, submitted, pseudo, room, answer]);

    // ✅ Interface selon l'état de connexion
    if (connecting) {
        return (
            <div className="app-container">
                <div className="card join-card bg-zinc-800 rounded-2xl p-8 shadow-xl flex flex-col items-center max-w-md w-full mx-auto mt-10">
                    <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
                        <p className="status text-cyan-400 text-lg">🔄 Connexion au serveur...</p>
                        <p className="text-gray-400 text-sm">Mode IRL - Connexion à beatboxgames.com</p>
                    </div>
                </div>
            </div>
        );
    }

    if (connectionError) {
        return (
            <div className="app-container">
                <div className="card join-card bg-zinc-800 rounded-2xl p-8 shadow-xl flex flex-col items-center max-w-md w-full mx-auto mt-10">
                    <div className="flex flex-col items-center gap-4">
                        <p className="text-red-400 text-lg">❌ Erreur de connexion</p>
                        <p className="text-gray-400 text-sm text-center">{connectionError}</p>
                        <button
                            onClick={handleRetryConnection}
                            className="px-4 py-2 bg-cyan-400 text-zinc-900 rounded-md font-semibold hover:bg-cyan-300 transition"
                        >
                            🔄 Réessayer
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!connected) {
        return (
            <div className="app-container">
                <div className="card join-card bg-zinc-800 rounded-2xl p-8 shadow-xl flex flex-col items-center max-w-md w-full mx-auto mt-10">
                    <p className="status text-red-400 text-lg">❌ Connexion perdue</p>
                    <button
                        onClick={handleRetryConnection}
                        className="mt-4 px-4 py-2 bg-cyan-400 text-zinc-900 rounded-md font-semibold hover:bg-cyan-300 transition"
                    >
                        🔄 Reconnecter
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            {!joined ? (
                <JoinForm
                    pseudo={pseudo}
                    setPseudo={setPseudo}
                    room={room}
                    setRoom={setRoom}
                    handleJoin={handleJoin}
                    joining={joining}
                    error={error}
                />
            ) : (
                <GameScreen
                    pseudo={pseudo}
                    currentLevel={currentLevel}
                    countdownVisible={countdownVisible}
                    countdownText={countdownText}
                    canAnswer={canAnswer}
                    submitted={submitted}
                    timeLeft={timeLeft}
                    hasScored={hasScored}
                    answer={answer}
                    setAnswer={setAnswer}
                    handleSubmit={handleSubmit}
                    result={result}
                    scores={scores}
                    lastAnswers={lastAnswers}
                />
            )}
        </div>
    );
}

export default BlindTest;