import React from "react";
import { View, Text } from "react-native";

export default function PlayerList({ players }: { players: string[] }) {
    if (!players || players.length === 0) {
        return <Text style={{ fontStyle: "italic", color: "#aaa" }}>Aucun joueur connecté</Text>;
    }
    return (
        <View>
            {players.map((p, i) => (
                <Text key={i} style={{ color: "#f1f1f1", fontSize: 16, marginVertical: 2 }}>
                    • {p}
                </Text>
            ))}
        </View>
    );
}
