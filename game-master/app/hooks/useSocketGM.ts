// hooks/useSocketGM.ts
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import { io } from "socket.io-client";
import { generateRoomCode } from "../utils/generateRoomCode";

// Types
type ScoreMap = { [pseudo: string]: number };
type Answer = { pseudo: string; answer: string; isCorrect: boolean; timestamp?: string };
type DetailedAnswer = { pseudo: string; answer: string; isCorrect: boolean; timestamp: string };
type RoundData = { artist: string; url: string; level: number } | null;
type RemainingRounds = { total: number; remaining: number } | null;

// Singleton socket instance
const socket = io("https://beatboxgames.com", {
    transports: ["websocket"],
    path: "/socket.io",
});

export function useSocketGM() {
    // === ÉTAT PRINCIPAL ===
    const [connected, setConnected] = useState(false);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [scores, setScores] = useState<ScoreMap>({});
    const [players, setPlayers] = useState<string[]>([]);
    const [currentRound, setCurrentRound] = useState<RoundData>(null);
    const [answers, setAnswers] = useState<Answer[]>([]);
    // ✅ NOUVEAU : Réponses détaillées pour le GM
    const [detailedAnswers, setDetailedAnswers] = useState<DetailedAnswer[]>([]);
    const [playCount, setPlayCount] = useState(0);
    const [remainingSongs, setRemainingSongs] = useState<number | null>(null);
    const [remainingRounds, setRemainingRounds] = useState<RemainingRounds>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const timerRef = useRef<NodeJS.Timeout | number | null>(null);
    const playedOnceAtLevel = useRef<Set<string>>(new Set());
    const soundRef = useRef<Audio.Sound | null>(null);
    const popupShownRef = useRef(false);
    const timerActive = timeLeft !== null;
    const [countdown, setCountdown] = useState("");

    // === TIMER CLEANUP ===
    const stopTimer = () => {
        if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    // === HANDLERS ===

    const handleCreateRoom = () => {
        socket.emit("create-room", { code: generateRoomCode() });
    };

    const handleStartRound = () => {
        if (roomCode) {
            socket.emit("start-round", { room: roomCode });
            // ✅ Reset des réponses détaillées
            setDetailedAnswers([]);
        }
    };

    const handlePlay = async () => {
        if (!currentRound || !roomCode) return;
        const levelKey = `${currentRound.artist}-level${currentRound.level}`;
        if (!playedOnceAtLevel.current.has(levelKey)) {
            playedOnceAtLevel.current.add(levelKey);
            socket.emit("request-countdown", { room: roomCode });
            setCountdown("3");
            setTimeout(() => setCountdown("2"), 1000);
            setTimeout(() => setCountdown("1"), 2000);
            setTimeout(() => setCountdown("Beatbox!"), 3000);
            setTimeout(async () => {
                setCountdown("");
                if (soundRef.current) {
                    await soundRef.current.replayAsync();
                    setPlayCount(1);
                }
            }, 4000);
        } else {
            if (soundRef.current) {
                await soundRef.current.replayAsync();
                setPlayCount(playCount + 1);
            }
        }
    };

    const handleNextLevel = () => {
        if (roomCode) socket.emit("gm-confirm-next-level", { room: roomCode });
    };

    const handleAuthorizeAnswer = () => {
        if (!timerActive && roomCode) {
            socket.emit("authorize-answer", { room: roomCode });
        }
    };

    const handleNewGame = () => {
        setRoomCode(null);
        setScores({});
        setPlayers([]);
        setCurrentRound(null);
        setAnswers([]);
        setDetailedAnswers([]); // ✅ Reset des réponses détaillées
        setPlayCount(0);
        setRemainingSongs(null);
        setRemainingRounds(null);
        setTimeLeft(null);
        playedOnceAtLevel.current = new Set();
        popupShownRef.current = false;
        setCountdown("");
        stopTimer();
        if (soundRef.current) soundRef.current.unloadAsync();
        handleCreateRoom();
    };

    // === EFFETS SOCKET/LOGIQUE ===

    useEffect(() => {
        // Initialiser le mode audio au montage
        Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            interruptionModeIOS: InterruptionModeIOS.DoNotMix,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
            playThroughEarpieceAndroid: false,
            staysActiveInBackground: false,
        });

        socket.on("connect", () => setConnected(true));
        socket.on("disconnect", () => setConnected(false));

        socket.on("room-created", ({ success, code, reason }) => {
            if (success) setRoomCode(code);
            else alert(`Erreur : ${reason}`);
        });

        socket.on("update-players", setPlayers);

        socket.on("round-started", async ({ artist, url, level }) => {
            setCurrentRound({ artist, url, level });
            setAnswers([]);
            setDetailedAnswers([]); // ✅ Reset des réponses détaillées
            setPlayCount(0);
            playedOnceAtLevel.current = new Set();
            stopTimer();
            setTimeLeft(null);
            popupShownRef.current = false;
            setCountdown("");
            if (soundRef.current) await soundRef.current.unloadAsync();
            try {
                const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: false });
                soundRef.current = sound;
            } catch (err) {
                console.error("❌ Audio error:", err);
            }
        });

        socket.on("start-timer", ({ seconds }) => {
            stopTimer();
            setTimeLeft(seconds);
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev === null) return null;
                    if (prev <= 1) {
                        stopTimer();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        });

        socket.on("stop-timer", () => {
            stopTimer();
            setTimeLeft(null);
        });

        socket.on("player-answered", ({ pseudo, answer, isCorrect, timestamp }: Answer) => {
            setAnswers((prev) => {
                const withoutPseudo = prev.filter((ans) => ans.pseudo !== pseudo);
                return [...withoutPseudo, { pseudo, answer, isCorrect, timestamp }];
            });
        });

        // ✅ NOUVEAU : Écouter les réponses détaillées pour le GM
        socket.on("gm-answers-update", ({ level, artist, answers: gmAnswers }) => {
            console.log("📝 Réponses détaillées reçues:", gmAnswers);
            setDetailedAnswers(gmAnswers);
        });

        socket.on("update-scores", setScores);
        socket.on("update-remaining", setRemainingSongs);
        socket.on("update-remaining-rounds", setRemainingRounds);

        socket.on("gm-choose-next-level", ({ artist, level }: { artist: string; level: number }) => {
            if (!popupShownRef.current) {
                popupShownRef.current = true;
                Alert.alert(
                    `Passer au niveau ${level} ?`,
                    `Tous les joueurs ont répondu à ${artist}`,
                    [
                        { text: 'Annuler', style: 'cancel', onPress: () => { popupShownRef.current = false; } },
                        {
                            text: 'OK', onPress: () => {
                                socket.emit('gm-confirm-next-level', { room: roomCode });
                                popupShownRef.current = false;
                            }
                        }
                    ]
                );
            }
        });

        // Nettoyage à l'unmount
        return () => {
            stopTimer();
            if (soundRef.current) soundRef.current.unloadAsync();
            socket.off("connect");
            socket.off("disconnect");
            socket.off("room-created");
            socket.off("update-players");
            socket.off("round-started");
            socket.off("start-timer");
            socket.off("stop-timer");
            socket.off("player-answered");
            socket.off("gm-answers-update"); // ✅ Cleanup du nouvel événement
            socket.off("update-scores");
            socket.off("update-remaining");
            socket.off("update-remaining-rounds");
            socket.off("gm-choose-next-level");
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomCode]);

    // === EXPORT DES VALEURS ET HANDLERS ===
    return {
        connected,
        roomCode,
        remainingSongs,
        remainingRounds,
        players,
        currentRound,
        answers,
        detailedAnswers, // ✅ Nouveau : réponses détaillées
        scores,
        countdown,
        timeLeft,
        timerActive,
        handleCreateRoom,
        handleNewGame,
        handleStartRound,
        handlePlay,
        handleNextLevel,
        handleAuthorizeAnswer,
    };
}
export default {};