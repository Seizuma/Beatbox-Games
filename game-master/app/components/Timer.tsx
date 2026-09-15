import React from "react";
import { Text } from "react-native";

const Timer = ({ timeLeft }: { timeLeft: number | null }) => {
    if (timeLeft === null) return null;
    return (
        <Text
            style={{
                color: timeLeft < 10 ? "#f87171" : "#00ffc8",
                fontSize: 20,
                fontWeight: "bold",
                textAlign: "center",
                marginBottom: 10,
            }}
        >
            ⏳ Temps restant : {timeLeft}s
        </Text>
    );
};

export default Timer;
