import { io } from 'socket.io-client';
import { getStoredDiscordToken } from './utils/useApi';

// Connexion temps réel de Beatbox Party (même serveur et mêmes réglages que les autres jeux)
const getServerUrl = () => {
    if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
    const { hostname } = window.location;
    if (hostname === 'dev.beatboxgames.com') return 'https://dev.beatboxgames.com';
    if (hostname === 'beatboxgames.com' || hostname === 'www.beatboxgames.com') return 'https://beatboxgames.com';
    return 'http://localhost:4000';
};

const SERVER_URL = getServerUrl();

const partySocket = io(SERVER_URL, {
    path: '/socket.io/',
    transports: ['polling'],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    timeout: 10000,
    upgrade: false,
    secure: SERVER_URL.startsWith('https'),
    withCredentials: true,
});

// Le jeton Discord accompagne la connexion : nom affiché, et accès à la version de test
partySocket.connectWithAuth = () => {
    const token = getStoredDiscordToken();
    partySocket.auth = token ? { token } : {};
    if (!partySocket.connected) partySocket.connect();
};

// Envoi avec accusé de réception, sous forme de promesse
partySocket.request = (event, payload = {}) => new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: 'timeout' }), 8000);
    partySocket.emit(event, payload, (response) => {
        clearTimeout(timer);
        resolve(response || { ok: false, error: 'no_response' });
    });
});

export default partySocket;
