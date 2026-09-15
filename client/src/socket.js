// socket.js - Version ultra-robuste avec polling prioritaire pour IRL
import { io } from 'socket.io-client';

let socketInstance = null;

const createSocket = () => {
    if (socketInstance && socketInstance.connected) {
        return socketInstance;
    }

    console.log('🔧 Création socket IRL avec polling prioritaire...');

    socketInstance = io("https://beatboxgames.com", {
        path: "/socket.io/",
        // ✅ CORRECTION CRITIQUE : Polling en premier pour IRL aussi
        transports: ["polling"], // Commencer SEULEMENT avec polling
        autoConnect: false,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        timeout: 20000,
        forceNew: false,
        // ✅ Configuration spécifique pour reverse proxy
        upgrade: false, // Désactiver l'upgrade automatique
        rememberUpgrade: false,
        secure: true,
        withCredentials: false,
        // ✅ Retry strategy
        randomizationFactor: 0.5,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: 10
    });

    // ✅ Logs détaillés pour debugging
    socketInstance.on('connect', () => {
        console.log('✅ Socket IRL connecté:', socketInstance.id);
        console.log('📡 Transport utilisé:', socketInstance.io.engine.transport.name);
        console.log('🔗 URL:', socketInstance.io.uri);
    });

    socketInstance.on('disconnect', (reason) => {
        console.log('❌ Socket IRL déconnecté:', reason);
    });

    socketInstance.on('connect_error', (error) => {
        console.error('🚨 Erreur connexion IRL:', error.message);
        console.error('🔍 Type d\'erreur:', error.type);
        console.error('📊 Description:', error.description);

        // ✅ Diagnostics avancés
        if (error.description && error.description.includes('websocket')) {
            console.log('⚠️ Erreur WebSocket détectée, reste en polling');
        }
        if (error.code) {
            console.log('🔢 Code erreur:', error.code);
        }
    });

    socketInstance.on('reconnect', (attemptNumber) => {
        console.log('🔄 Reconnexion IRL réussie après', attemptNumber, 'tentatives');
    });

    socketInstance.on('reconnect_error', (error) => {
        console.error('❌ Échec reconnexion IRL:', error.message);
    });

    socketInstance.on('reconnect_failed', () => {
        console.error('💥 Reconnexion IRL échouée définitivement');
    });

    // ✅ Monitoring du transport
    socketInstance.io.on('error', (error) => {
        console.error('🚨 Erreur moteur Socket.io:', error);
    });

    // ✅ Pas d'upgrade vers WebSocket
    socketInstance.io.on('upgrade', () => {
        console.log('⬆️ Upgrade vers WebSocket (ne devrait pas arriver)');
    });

    socketInstance.io.on('upgradeError', (error) => {
        console.log('⬇️ Échec upgrade WebSocket (attendu):', error.message);
    });

    return socketInstance;
};

const getSocket = () => {
    if (!socketInstance) {
        return createSocket();
    }
    return socketInstance;
};

const connectSocket = () => {
    const socket = getSocket();
    if (!socket.connected) {
        console.log('🔄 Connexion socket IRL (polling uniquement)...');
        socket.connect();
    }
    return socket;
};

const disconnectSocket = () => {
    if (socketInstance) {
        console.log('🔌 Déconnexion socket IRL...');
        socketInstance.removeAllListeners();
        if (socketInstance.connected) {
            socketInstance.disconnect();
        }
        socketInstance = null;
    }
};

export default {
    get: getSocket,
    connect: connectSocket,
    disconnect: disconnectSocket
};