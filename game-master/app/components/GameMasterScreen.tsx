import React from "react";
import { ScrollView, View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useSocketGM } from "../hooks/useSocketGM";
import PlayerList from "./PlayerList";
import RoundInfo from "./RoundInfo";
import ScoreBoard from "./ScoreBoard";
import Timer from "./Timer";

const GameMasterScreen = () => {
    const {
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
    } = useSocketGM();

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={{ width: "100%", alignItems: "flex-end", marginBottom: 10 }}>
                <TouchableOpacity style={styles.smallButton} onPress={handleNewGame}>
                    <Text style={styles.smallButtonText}>🔄 Nouvelle partie</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.title}>🎛 Game Master</Text>
            <Text style={styles.status}>
                Connexion : {connected ? "🟢 Connecté" : "🔴 Déconnecté"}
            </Text>
            {!roomCode ? (
                <TouchableOpacity style={styles.button} onPress={handleCreateRoom}>
                    <Text style={styles.buttonText}>Créer une partie</Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.card}>
                    <Text style={styles.code}>🎯 Code : {roomCode}</Text>
                    {remainingSongs !== null && (
                        <Text style={styles.remaining}>
                            🎼 Chansons restantes : {remainingSongs}
                        </Text>
                    )}
                    {remainingRounds &&
                        typeof remainingRounds.remaining === "number" &&
                        typeof remainingRounds.total === "number" && (
                            <Text style={styles.remaining}>
                                📀 Manches restantes : {remainingRounds.remaining} / {remainingRounds.total}
                            </Text>
                        )}
                    <PlayerList players={players} />
                    <TouchableOpacity style={styles.button} onPress={handleStartRound}>
                        <Text style={styles.buttonText}>🎲 Nouvelle manche</Text>
                    </TouchableOpacity>
                    <RoundInfo
                        currentRound={currentRound}
                        countdown={countdown}
                        onPlay={handlePlay}
                        onAuthorize={handleAuthorizeAnswer}
                        onNextLevel={handleNextLevel}
                        timerActive={timerActive}
                    />
                    <Timer timeLeft={timeLeft} />
                    {/* ✅ AMÉLIORATION : Passer les réponses détaillées au ScoreBoard */}
                    <ScoreBoard
                        answers={answers}
                        scores={scores}
                        detailedAnswers={detailedAnswers}
                        currentRound={currentRound}
                    />
                </View>
            )}
        </ScrollView>
    );
};

export default GameMasterScreen;

const styles = StyleSheet.create({
    container: {
        paddingVertical: 40,
        paddingHorizontal: 20,
        backgroundColor: "#1e1e2f",
        flexGrow: 1,
        minHeight: 650,
        alignItems: "center",
    },
    title: { fontSize: 28, fontWeight: "bold", color: "#fff", marginBottom: 10 },
    status: { fontSize: 16, color: "#ccc", marginBottom: 20 },
    code: { fontSize: 22, fontWeight: "bold", color: "#f9c74f", textAlign: "center", marginBottom: 10 },
    remaining: { fontSize: 16, color: "#ccc", textAlign: "center", marginBottom: 10 },
    card: { backgroundColor: "#2d2d44", padding: 20, borderRadius: 12, width: "100%", maxWidth: 500 },
    button: {
        backgroundColor: "#3a86ff",
        padding: 10,
        borderRadius: 8,
        marginVertical: 6,
        alignItems: "center",
        opacity: 1,
    },
    buttonText: { color: "white", fontWeight: "600" },
    smallButton: {
        backgroundColor: "#ffd166",
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 22,
        minWidth: 44,
        minHeight: 36,
        alignSelf: "flex-end",
    },
    smallButtonText: {
        color: "#252525",
        fontWeight: "700",
        fontSize: 14,
    },
});