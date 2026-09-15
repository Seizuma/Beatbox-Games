import { io } from 'socket.io-client';

const getServerUrl = () => {
    if (process.env.REACT_APP_API_URL) {
        console.log('🔗 URL serveur depuis REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
        return process.env.REACT_APP_API_URL;
    }

    const hostname = window.location.hostname;

    if (hostname === 'dev.beatboxgames.com') {
        console.log('🔧 Environnement staging détecté');
        return 'https://dev.beatboxgames.com';
    } else if (hostname === 'beatboxgames.com' || hostname === 'www.beatboxgames.com') {
        console.log('🎵 Environnement production détecté');
        return 'https://beatboxgames.com';
    } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
        console.log('💻 Environnement développement local détecté');
        return 'http://localhost:4000';
    }

    console.warn('⚠️ Environnement non reconnu, utilisation de localhost');
    return 'http://localhost:4000';
};

const SERVER_URL = getServerUrl();

console.log('🌐 Buzzer Socket.IO vers:', SERVER_URL);

// ✅ Configuration identique à socketOnline pour la cohérence
const socketBuzzer = io(SERVER_URL, {
    path: "/socket.io/",
    transports: ["polling"], // ✅ IMPORTANT : Commencer avec polling comme socketOnline
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 3,
    timeout: 10000,
    upgrade: false,
    forceNew: false,
    secure: SERVER_URL.startsWith('https'),
    withCredentials: true,
});

// ✅ AJOUT : Fonction pour mettre à jour l'auth Discord
socketBuzzer.updateAuth = (discordToken) => {
    if (discordToken) {
        socketBuzzer.auth = { token: discordToken };
        console.log('🔐 Auth Discord configurée sur Buzzer socket');
    } else {
        socketBuzzer.auth = {};
        console.log('🔓 Auth supprimée du Buzzer socket');
    }
};

// ✅ AJOUT : Fonction pour s'assurer que l'auth est à jour
socketBuzzer.ensureAuth = () => {
    const discordToken = localStorage.getItem('discord_token');
    if (discordToken) {
        socketBuzzer.auth = { token: discordToken };
        console.log('🔄 Auth Buzzer mise à jour depuis localStorage');
    } else {
        socketBuzzer.auth = {};
    }
};

// Logs de debug
socketBuzzer.on('connect', () => {
    const env = process.env.REACT_APP_ENV || 'unknown';
    const hasToken = !!socketBuzzer.auth?.token;
    console.log(`✅ Buzzer Socket connecté (${env}):`, socketBuzzer.id);
    console.log(`🔗 URL serveur: ${SERVER_URL}`);
    console.log(`📡 Transport: ${socketBuzzer.io.engine.transport.name}`);
    console.log(`🔐 Auth Discord: ${hasToken ? 'Configurée ✓' : 'Non configurée ✗'}`);
});

socketBuzzer.on('disconnect', (reason) => {
    console.log('❌ Buzzer Socket déconnecté:', reason);
    console.log(`🔗 Serveur était: ${SERVER_URL}`);
});

socketBuzzer.on('connect_error', (error) => {
    console.error('🚨 Erreur connexion Buzzer Socket:', error.message);
    console.error(`🔗 Tentative vers: ${SERVER_URL}`);

    if (error.message.includes('CORS')) {
        console.error('💡 Problème CORS détecté. Vérifiez la configuration serveur pour:', window.location.origin);
    }
});

// ✅ Debug : Logger tous les événements reçus
socketBuzzer.onAny((eventName, ...args) => {
    console.log(`📨 [Buzzer] Événement reçu: ${eventName}`, args);
});

// Helper pour debug en développement
if (process.env.NODE_ENV === 'development') {
    window.debugBuzzerSocket = {
        socket: socketBuzzer,
        serverUrl: SERVER_URL,
        reconnect: () => {
            socketBuzzer.disconnect();
            socketBuzzer.connect();
        },
        status: () => ({
            connected: socketBuzzer.connected,
            id: socketBuzzer.id,
            transport: socketBuzzer.io?.engine?.transport?.name,
            serverUrl: SERVER_URL
        })
    };
}

export default socketBuzzer;