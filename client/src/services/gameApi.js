// client/src/services/gameApi.js - Service API REST + SSE
const API_BASE = 'https://beatboxgames.com/api';

class GameApiService {
    constructor() {
        this.eventSource = null;
        this.playerId = null;
        this.roomCode = null;
        this.eventHandlers = new Map();
    }

    // ✅ 1. CRÉER UNE ROOM
    async createRoom(pseudo) {
        try {
            const response = await fetch(`${API_BASE}/rooms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ pseudo })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erreur lors de la création');
            }

            const data = await response.json();
            this.playerId = data.playerId;
            this.roomCode = data.roomCode;

            console.log('✅ Room créée:', data);
            return data;
        } catch (error) {
            console.error('❌ Erreur création room:', error);
            throw error;
        }
    }

    // ✅ 2. REJOINDRE UNE ROOM
    async joinRoom(roomCode, pseudo) {
        try {
            const response = await fetch(`${API_BASE}/rooms/${roomCode}/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ pseudo })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erreur lors du join');
            }

            const data = await response.json();
            this.playerId = data.playerId;
            this.roomCode = data.roomCode;

            console.log('✅ Room rejointe:', data);
            return data;
        } catch (error) {
            console.error('❌ Erreur join room:', error);
            throw error;
        }
    }

    // ✅ 3. OBTENIR L'ÉTAT D'UNE ROOM
    async getRoomState(roomCode) {
        try {
            const response = await fetch(`${API_BASE}/rooms/${roomCode}`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Room introuvable');
            }

            return await response.json();
        } catch (error) {
            console.error('❌ Erreur état room:', error);
            throw error;
        }
    }

    // ✅ 4. CHANGER L'ÉTAT "PRÊT"
    async toggleReady() {
        if (!this.roomCode || !this.playerId) {
            throw new Error('Pas de room active');
        }

        try {
            const response = await fetch(`${API_BASE}/rooms/${this.roomCode}/ready`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ playerId: this.playerId })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erreur changement état');
            }

            return await response.json();
        } catch (error) {
            console.error('❌ Erreur toggle ready:', error);
            throw error;
        }
    }

    // ✅ 5. ENVOYER UNE RÉPONSE
    async submitAnswer(answer) {
        if (!this.roomCode || !this.playerId) {
            throw new Error('Pas de room active');
        }

        try {
            const response = await fetch(`${API_BASE}/rooms/${this.roomCode}/answer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    playerId: this.playerId,
                    answer: answer.trim()
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erreur envoi réponse');
            }

            return await response.json();
        } catch (error) {
            console.error('❌ Erreur submit answer:', error);
            throw error;
        }
    }

    // ✅ 6. CONNECTER AUX ÉVÉNEMENTS TEMPS RÉEL (SSE)
    connectToEvents() {
        if (!this.roomCode || !this.playerId) {
            throw new Error('Pas de room active pour les événements');
        }

        if (this.eventSource) {
            this.eventSource.close();
        }

        const eventUrl = `${API_BASE}/rooms/${this.roomCode}/events/${this.playerId}`;
        console.log('🔄 Connexion aux événements:', eventUrl);

        this.eventSource = new EventSource(eventUrl);

        // Événements standards
        this.eventSource.onopen = () => {
            console.log('✅ Connexion SSE établie');
            this.emit('connected');
        };

        this.eventSource.onerror = (error) => {
            console.error('❌ Erreur SSE:', error);
            this.emit('error', error);
        };

        // Événements personnalisés
        this.eventSource.addEventListener('room-state', (event) => {
            const data = JSON.parse(event.data);
            console.log('📊 État room:', data);
            this.emit('room-updated', data);
        });

        this.eventSource.addEventListener('player-joined', (event) => {
            const data = JSON.parse(event.data);
            console.log('➕ Joueur rejoint:', data);
            this.emit('room-updated', data);
        });

        this.eventSource.addEventListener('player-left', (event) => {
            const data = JSON.parse(event.data);
            console.log('➖ Joueur parti:', data);
            this.emit('room-updated', data);
        });

        this.eventSource.addEventListener('player-ready', (event) => {
            const data = JSON.parse(event.data);
            console.log('✅ État prêt changé:', data);
            this.emit('room-updated', data);
        });

        this.eventSource.addEventListener('game-starting', (event) => {
            console.log('🚀 Jeu commence');
            this.emit('game-starting');
        });

        this.eventSource.addEventListener('round-started', (event) => {
            const data = JSON.parse(event.data);
            console.log('🎵 Round démarré:', data);
            this.emit('round-started', data);
        });

        this.eventSource.addEventListener('player-answered', (event) => {
            const data = JSON.parse(event.data);
            console.log('📝 Joueur a répondu:', data);
            this.emit('player-answered', data);
        });

        this.eventSource.addEventListener('round-results', (event) => {
            const data = JSON.parse(event.data);
            console.log('📊 Résultats round:', data);
            this.emit('round-results', data);
        });

        this.eventSource.addEventListener('game-finished', (event) => {
            const data = JSON.parse(event.data);
            console.log('🏁 Jeu terminé:', data);
            this.emit('game-finished', data);
        });

        this.eventSource.addEventListener('ping', (event) => {
            // Ping silencieux pour maintenir la connexion
        });

        return this.eventSource;
    }

    // ✅ 7. GESTION DES ÉVÉNEMENTS (pattern EventEmitter simple)
    on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        this.eventHandlers.get(eventName).push(handler);
    }

    off(eventName, handler) {
        if (this.eventHandlers.has(eventName)) {
            const handlers = this.eventHandlers.get(eventName);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(eventName, data) {
        if (this.eventHandlers.has(eventName)) {
            this.eventHandlers.get(eventName).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Erreur handler ${eventName}:`, error);
                }
            });
        }
    }

    // ✅ 8. DÉCONNEXION ET NETTOYAGE
    disconnect() {
        console.log('🔌 Déconnexion service API...');

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        this.eventHandlers.clear();
        this.playerId = null;
        this.roomCode = null;
    }

    // ✅ 9. GETTERS
    isConnected() {
        return this.eventSource && this.eventSource.readyState === EventSource.OPEN;
    }

    getPlayerId() {
        return this.playerId;
    }

    getRoomCode() {
        return this.roomCode;
    }
}

// Instance singleton
const gameApi = new GameApiService();

export default gameApi;