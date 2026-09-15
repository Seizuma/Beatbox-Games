import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

type Props = {
    currentRound: { artist: string; level: number } | null;
    countdown: string;
    onPlay: () => void;
    onAuthorize: () => void;
    timerActive: boolean;
    onNextLevel: () => void;
};

export default function RoundInfo({
    currentRound,
    countdown,
    onPlay,
    onAuthorize,
    timerActive,
    onNextLevel,
}: Props) {
    if (!currentRound) return null;
    return (
        <View style={{ backgroundColor: "#3b3b5b", padding: 15, borderRadius: 10, marginTop: 15 }}>
            <Text style={{ fontSize: 18, color: "#fff" }}>🎤 {currentRound.artist}</Text>
            <Text style={{ color: "#ccc", marginBottom: 10 }}>Niveau : {currentRound.level} / 3</Text>
            {countdown && (
                <Text
                    style={{
                        fontSize: 36,
                        fontWeight: "bold",
                        color: "#f9c74f",
                        textAlign: "center",
                        marginVertical: 10,
                    }}
                >
                    {countdown}
                </Text>
            )}
            <TouchableOpacity
                style={{
                    backgroundColor: "#3a86ff",
                    padding: 10,
                    borderRadius: 8,
                    marginVertical: 6,
                    alignItems: "center",
                }}
                onPress={onPlay}
            >
                <Text style={{ color: "white", fontWeight: "600" }}>▶️ Jouer l'audio</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    {
                        backgroundColor: "#3a86ff",
                        padding: 10,
                        borderRadius: 8,
                        marginVertical: 6,
                        alignItems: "center",
                    },
                    timerActive && { backgroundColor: "#8e9aaf", opacity: 0.6 },
                ]}
                onPress={onAuthorize}
                disabled={timerActive}
            >
                <Text style={{ color: "white", fontWeight: "600" }}>
                    {timerActive ? "Réponses en cours..." : "✅ Autoriser réponses"}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={{
                    backgroundColor: "#3a86ff",
                    padding: 10,
                    borderRadius: 8,
                    marginVertical: 6,
                    alignItems: "center",
                }}
                onPress={onNextLevel}
            >
                <Text style={{ color: "white", fontWeight: "600" }}>🔁 Passer au niveau suivant</Text>
            </TouchableOpacity>
        </View>
    );
}
