import { io } from 'socket.io-client';

// Détection automatique de l'environnement et de l'URL du serveur
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

    console.warn('⚠️ Environnement non reconnu, utilisation de la production');
    return 'https://beatboxgames.com';
};

const SERVER_URL = getServerUrl();

console.log('🌐 Connexion Socket.IO vers:', SERVER_URL);

// ✅ CORRECTION CRITIQUE : Configuration simplifiée et stable
const socketOnline = io(SERVER_URL, {
    path: "/socket.io/",
    transports: ["polling"],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 3,
    timeout: 10000,
    upgrade: false,
    forceNew: false,
    secure: SERVER_URL.startsWith('https'),
    withCredentials: true,
    // ✅ SUPPRESSION de l'auth par défaut - sera configurée dynamiquement
});

// ✅ NOUVELLE fonction pour mettre à jour l'auth
socketOnline.updateAuth = (discordToken) => {
    if (discordToken) {
        socketOnline.auth = { token: discordToken };
        console.log('🔐 Auth Discord configurée sur socket');
    } else {
        socketOnline.auth = {};
        console.log('🔓 Auth supprimée du socket');
    }
};

// ✅ NOUVELLE fonction pour s'assurer que l'auth est à jour
socketOnline.ensureAuth = () => {
    const discordToken = localStorage.getItem('discord_token');
    if (discordToken) {
        socketOnline.auth = { token: discordToken };
        console.log('🔄 Auth mise à jour depuis localStorage');
    } else {
        socketOnline.auth = {};
    }
};

// Logs de debug
socketOnline.on('connect', () => {
    const env = process.env.REACT_APP_ENV || 'unknown';
    const hasToken = !!socketOnline.auth?.token;
    console.log(`✅ Socket connecté (${env}):`, socketOnline.id);
    console.log(`🔗 URL serveur: ${SERVER_URL}`);
    console.log(`📡 Transport: ${socketOnline.io.engine.transport.name}`);
    console.log(`🔐 Auth Discord: ${hasToken ? 'Configurée' : 'Non configurée'}`);
});

socketOnline.on('disconnect', (reason) => {
    console.log('❌ Socket déconnecté:', reason);
    console.log(`🔗 Serveur était: ${SERVER_URL}`);
});

socketOnline.on('connect_error', (error) => {
    console.error('🚨 Erreur connexion:', error.message);
    console.error(`🔗 Tentative vers: ${SERVER_URL}`);

    if (error.message.includes('CORS')) {
        console.error('💡 Problème CORS détecté. Vérifiez la configuration serveur pour:', window.location.origin);
    }
});

// ✅ CORRECTION : Événements de réception pour debug
socketOnline.onAny((eventName, ...args) => {
    console.log(`📨 Événement reçu: ${eventName}`, args);
});

// Debug pour développement
if (process.env.NODE_ENV === 'development') {
    window.debugSocket = {
        socket: socketOnline,
        serverUrl: SERVER_URL,
        reconnect: () => {
            socketOnline.disconnect();
            socketOnline.connect();
        },
        status: () => ({
            connected: socketOnline.connected,
            id: socketOnline.id,
            transport: socketOnline.io?.engine?.transport?.name,
            serverUrl: SERVER_URL,
            auth: socketOnline.auth
        }),
        updateAuth: socketOnline.updateAuth,
        ensureAuth: socketOnline.ensureAuth
    };
}

export default socketOnline;