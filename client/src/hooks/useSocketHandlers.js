import { useEffect, useRef } from 'react';

export default function useSocketHandlers({
    setConnected, setJoining, setJoined, setError,
    setLastAnswers, setResult, setAnswer, setSubmitted,
    setHasScored, setCanAnswer, setCurrentLevel, stopTimer, setTimeLeft,
    setCountdownText, setCountdownVisible, setScores,
    socketRef // ✅ NOUVEAU : Utiliser la référence du socket
}) {
    const timerRef = useRef(null);
    const countdownTimerRef = useRef(null);

    const stopAllTimers = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }
        if (stopTimer) stopTimer();
    };

    useEffect(() => {
        if (!socketRef || !socketRef.current) return;

        const socket = socketRef.current;

        // ✅ Gestionnaires d'événements pour le mode IRL
        socket.on('joined-room', (data) => {
            setJoining(false);
            if (data.success) {
                setJoined(true);
                setError('');
            } else {
                setJoined(false);
                setError(data.reason || 'Erreur inconnue');
                // Nettoyage localStorage si nécessaire
                if (data.reason) {
                    const reason = data.reason.toLowerCase();
                    if (reason.includes('room inconnue') || reason.includes('expirée')) {
                        localStorage.removeItem('blindtest_room');
                    }
                    if (reason.includes('déjà utilisé')) {
                        localStorage.removeItem('blindtest_pseudo');
                    }
                }
            }
        });

        socket.on('player-answered', ({ pseudo, isCorrect, answer }) => {
            setLastAnswers(prev => ({
                ...prev,
                [pseudo]: { isCorrect, answer }
            }));
        });

        socket.on('next-round', () => {
            setLastAnswers({});
            setResult('');
            setAnswer('');
            setSubmitted(false);
            setHasScored(false);
            setCanAnswer(false);
            setCurrentLevel(null);
            stopAllTimers();
            setTimeLeft(null);
        });

        socket.on('round-started', ({ level }) => {
            setLastAnswers({});
            setAnswer('');
            setResult('');
            setSubmitted(false);
            setHasScored(false);
            setCanAnswer(false);
            setCurrentLevel(level);
            stopAllTimers();
            setTimeLeft(null);
        });

        socket.on('start-countdown', () => {
            stopAllTimers();

            const steps = ['3', '2', '1', 'Beatbox!'];
            let i = 0;
            setCountdownVisible(true);
            setCountdownText(steps[i]);

            countdownTimerRef.current = setInterval(() => {
                i++;
                if (i < steps.length) {
                    setCountdownText(steps[i]);
                } else {
                    clearInterval(countdownTimerRef.current);
                    countdownTimerRef.current = null;
                    setTimeout(() => {
                        setCountdownVisible(false);
                        setCountdownText('');
                    }, 800);
                }
            }, 1000);
        });

        socket.on("start-timer", ({ seconds }) => {
            stopAllTimers();
            setTimeLeft(seconds);
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev === null || prev <= 1) {
                        stopAllTimers();
                        return prev === null ? null : 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        });

        socket.on('stop-timer', () => {
            stopAllTimers();
            setTimeLeft(null);
        });

        socket.on('authorize-answer', () => {
            setCanAnswer(true);
            setAnswer('');
            setResult('');
        });

        socket.on('answer-feedback', ({ correct }) => {
            setResult(correct ? '✅ Bonne réponse !' : '❌ Mauvaise réponse.');
            if (correct) setHasScored(true);
            setSubmitted(true);
            setCanAnswer(false);
        });

        socket.on('update-scores', (newScores) => {
            setScores(newScores);
        });

        socket.on('round-result', ({ message }) => setResult(message));

        // ✅ NETTOYAGE des événements
        return () => {
            stopAllTimers();
            if (socket) {
                socket.off('joined-room');
                socket.off('player-answered');
                socket.off('next-round');
                socket.off('round-started');
                socket.off('start-countdown');
                socket.off('start-timer');
                socket.off('stop-timer');
                socket.off('authorize-answer');
                socket.off('answer-feedback');
                socket.off('update-scores');
                socket.off('round-result');
            }
        };
    }, [socketRef]); // ✅ Dépendance sur socketRef

    return { stopAllTimers };
}