import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { io } from 'socket.io-client';

const socket = io('http://192.168.1.203:3000'); // ✅ BONNE IP ICI

export default function App() {
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        socket.on('connect', () => {
            console.log('✅ Connecté au serveur');
            setConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('❌ Déconnecté');
            setConnected(false);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const handleLaunch = (level) => {
        socket.emit('launch-audio', { level, room: 'test' });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.nonExistant}>TEST</Text>
            <Text>Connexion : {connected ? '🟢 Connecté' : '🔴 Déconnecté'}</Text>

            {[1, 2, 3].map((lvl) => (
                <Button key={lvl} title={`Lancer Level ${lvl}`} onPress={() => handleLaunch(lvl)} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 24, marginBottom: 20 }
});
