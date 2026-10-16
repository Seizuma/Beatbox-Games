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

// Le serveur mesure la latence de chaque joueur : on accuse réception de ses pings
partySocket.on('party:ping', (ack) => { if (typeof ack === 'function') ack(); });

// Synchronisation d'horloge façon NTP : quelques allers-retours, on garde celui au plus court
// trajet (le moins bruité). Renvoie { offset, rtt } (heure du serveur = Date.now() + offset).
partySocket.measureClock = async (samples = 4) => {
    let best = null;
    for (let i = 0; i < samples; i += 1) {
        const t0 = Date.now();
        // eslint-disable-next-line no-await-in-loop
        const response = await partySocket.request('party:time', {});
        const t1 = Date.now();
        if (response && response.ok && Number.isFinite(response.now)) {
            const rtt = t1 - t0;
            if (!best || rtt < best.rtt) best = { rtt, offset: Math.round(response.now + rtt / 2 - t1) };
        }
        // eslint-disable-next-line no-await-in-loop
        if (i < samples - 1) await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return best;
};

export default partySocket;
