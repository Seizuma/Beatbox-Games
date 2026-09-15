import React from "react";
import { View, Text, ScrollView } from "react-native";

type Answer = { pseudo: string; answer: string; isCorrect: boolean };
type DetailedAnswer = { pseudo: string; answer: string; isCorrect: boolean; timestamp: string };

type Props = {
    scores: Record<string, number>;
    answers: Answer[];
    detailedAnswers?: DetailedAnswer[]; // ✅ Nouveau : réponses détaillées
    currentRound?: { artist: string; level: number } | null;
};

export default function ScoreBoard({ scores, answers, detailedAnswers, currentRound }: Props) {
    if (!scores || Object.keys(scores).length === 0) return null;

    return (
        <ScrollView style={{ backgroundColor: "#444", padding: 15, borderRadius: 10, marginTop: 15, maxHeight: 400 }}>
            <Text style={{ fontSize: 18, color: "#fff", marginBottom: 10 }}>🏆 Scores :</Text>

            {/* ✅ Affichage des scores */}
            {Object.entries(scores)
                .sort(([, a], [, b]) => b - a)
                .map(([pseudo, score]) => {
                    const lastAnswer = answers.find(ans => ans.pseudo === pseudo);
                    return (
                        <Text key={pseudo} style={{ color: "#f1f1f1", fontSize: 16, marginVertical: 2 }}>
                            • {pseudo} : {score} pts {lastAnswer && (lastAnswer.isCorrect ? "✅" : "❌")}
                        </Text>
                    );
                })}

            {/* ✅ NOUVEAU : Section des réponses détaillées pour la manche actuelle */}
            {detailedAnswers && detailedAnswers.length > 0 && currentRound && (
                <View style={{ marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: "#666" }}>
                    <Text style={{ fontSize: 16, color: "#f9c74f", fontWeight: "bold", marginBottom: 10 }}>
                        📝 Réponses - Niveau {currentRound.level} :
                    </Text>
                    <Text style={{ fontSize: 14, color: "#ccc", marginBottom: 10, fontStyle: "italic" }}>
                        Réponse attendue : "{currentRound.artist}"
                    </Text>

                    {detailedAnswers
                        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                        .map((answer, index) => (
                            <View key={`${answer.pseudo}-${answer.timestamp}`} style={{
                                marginBottom: 8,
                                padding: 8,
                                backgroundColor: answer.isCorrect ? "#2d5016" : "#4a1e1e",
                                borderRadius: 6,
                                borderLeftWidth: 3,
                                borderLeftColor: answer.isCorrect ? "#4ade80" : "#ef4444"
                            }}>
                                <Text style={{
                                    color: answer.isCorrect ? "#86efac" : "#fca5a5",
                                    fontSize: 14,
                                    fontWeight: "600"
                                }}>
                                    {index + 1}. {answer.pseudo} {answer.isCorrect ? "✅" : "❌"}
                                </Text>
                                <Text style={{
                                    color: "#f1f1f1",
                                    fontSize: 13,
                                    marginTop: 2,
                                    fontStyle: answer.answer ? "normal" : "italic"
                                }}>
                                    "{answer.answer || "Pas de réponse"}"
                                </Text>
                                <Text style={{
                                    color: "#999",
                                    fontSize: 11,
                                    marginTop: 2
                                }}>
                                    {new Date(answer.timestamp).toLocaleTimeString('fr-FR', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                    })}
                                </Text>
                            </View>
                        ))}
                </View>
            )}

            {/* ✅ Message si pas encore de réponses */}
            {currentRound && (!detailedAnswers || detailedAnswers.length === 0) && (
                <View style={{ marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: "#666" }}>
                    <Text style={{ fontSize: 14, color: "#999", fontStyle: "italic", textAlign: "center" }}>
                        En attente des réponses des joueurs...
                    </Text>
                </View>
            )}
        </ScrollView>
    );
}