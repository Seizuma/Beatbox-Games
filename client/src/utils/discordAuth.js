import React from 'react'; // ✅ AJOUT de l'import React
// utils/discordAuth.js
const getApiBaseUrl = () => {
    // 1. Priorité a  la variable d'environnement
    if (process.env.REACT_APP_API_URL) {
        console.log('"— API URL depuis REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
        return process.env.REACT_APP_API_URL;
    }

    // 2. DÃ©tection automatique selon le hostname
    const hostname = window.location.hostname;

    if (hostname === 'dev.beatboxgames.com') {
        console.log('" API Staging détectée');
        return 'https://dev.beatboxgames.com';
    } else if (hostname === 'beatboxgames.com' || hostname === 'www.beatboxgames.com') {
        console.log(' API Production détectée');
        return 'https://beatboxgames.com';
    } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
        console.log('API Locale détectée');
        return 'http://localhost:4000';
    }

    // 3. Fallback sur production
    console.warn(' Hostname non reconnu, utilisation de la production');
    return 'https://beatboxgames.com';
};

const API_BASE_URL = getApiBaseUrl();

class DiscordAuthClient {
    constructor() {
        this.token = localStorage.getItem('discord_token');
        this.user = null;
        this.isAuthenticated = false;
        this.listeners = new Set();

        // Initialiser si token existe
        if (this.token) {
            this.loadUserData();
        }
    }


    /**
     * Ajouter un listener pour les changements d'authentification
     */
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notifier tous les listeners
     */
    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback({
                    isAuthenticated: this.isAuthenticated,
                    user: this.user,
                    token: this.token
                });
            } catch (error) {
                console.error('Erreur dans le listener auth:', error);
            }
        });
    }

    /**
     * Rediriger vers Discord pour l'authentification
     */
    login(redirectPath = 'profile') {
        const authUrl = `${API_BASE_URL}/auth/discord?redirect=${redirectPath}`;
        console.log('Redirection vers:', authUrl);
        window.location.href = authUrl;
    }
    /**
     * Gérer le token reçu après authentification
     */
    handleAuthCallback(token) {
        if (token) {
            this.token = token;
            localStorage.setItem('discord_token', token);
            this.loadUserData();
            return true;
        }
        return false;
    }

    /**
     * Charger les données utilisateur depuis l'API
     */
    async loadUserData() {
        if (!this.token) {
            this.user = null;
            this.isAuthenticated = false;
            this.notifyListeners();
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Token invalide');
            }

            const data = await response.json();
            this.user = data.user;
            this.isAuthenticated = true;
            this.notifyListeners();

            return data;
        } catch (error) {
            console.error('Erreur lors du chargement des données utilisateur:', error);
            this.logout();
            throw error;
        }
    }

    /**
     * Mettre à jour les statistiques après une partie
     */
    async updateStats(gameStats) {
        if (!this.token) {
            throw new Error('Non authentifié');
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/update-stats`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(gameStats)
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la mise à jour des stats');
            }

            return await response.json();
        } catch (error) {
            console.error('Erreur mise à jour stats:', error);
            throw error;
        }
    }

    /**
     * Récupérer le classement
     */
    async getLeaderboard(limit = 10) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/leaderboard?limit=${limit}`);

            if (!response.ok) {
                throw new Error('Erreur lors de la récupération du classement');
            }

            return await response.json();
        } catch (error) {
            console.error('Erreur classement:', error);
            throw error;
        }
    }

    /**
     * Déconnexion
     */
    async logout() {
        try {
            if (this.token) {
                await fetch(`${API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });
            }
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
        } finally {
            this.token = null;
            this.user = null;
            this.isAuthenticated = false;
            localStorage.removeItem('discord_token');
            this.notifyListeners();
        }
    }

    /**
     * Supprimer le compte
     */
    async deleteAccount() {
        if (!this.token) {
            throw new Error('Non authentifié');
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/account`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la suppression du compte');
            }

            // Déconnexion automatique après suppression
            this.logout();

            return await response.json();
        } catch (error) {
            console.error('Erreur suppression compte:', error);
            throw error;
        }
    }

    /**
     * Obtenir l'URL de l'avatar Discord
     */
    getAvatarUrl(size = 128) {
        if (!this.user || !this.user.avatar) {
            // Avatar par défaut Discord
            const defaultAvatar = parseInt(this.user?.discriminator || '0') % 5;
            return `https://cdn.discordapp.com/embed/avatars/${defaultAvatar}.png`;
        }

        return `https://cdn.discordapp.com/avatars/${this.user.discordId}/${this.user.avatar}.png?size=${size}`;
    }

    /**
     * Vérifier si le token est encore valide
     */
    async verifyToken() {
        if (!this.token) return false;

        try {
            await this.loadUserData();
            return this.isAuthenticated;
        } catch {
            return false;
        }
    }
}

// Instance singleton
const discordAuthClient = new DiscordAuthClient();

// Hook React personnalisé
export const useDiscordAuth = () => {
    const [authState, setAuthState] = React.useState({
        isAuthenticated: discordAuthClient.isAuthenticated,
        user: discordAuthClient.user,
        token: discordAuthClient.token,
        loading: false
    });

    React.useEffect(() => {
        return discordAuthClient.addListener(setAuthState);
    }, []);

    const login = (redirectPath) => {
        discordAuthClient.login(redirectPath);
    };

    const logout = async () => {
        setAuthState(prev => ({ ...prev, loading: true }));
        try {
            await discordAuthClient.logout();
        } finally {
            setAuthState(prev => ({ ...prev, loading: false }));
        }
    };

    const updateStats = async (gameStats) => {
        if (!authState.isAuthenticated) {
            console.warn('Tentative de mise à jour stats sans authentification Discord');
            return null;
        }

        try {
            return await discordAuthClient.updateStats(gameStats);
        } catch (error) {
            console.error('Erreur update stats depuis hook:', error);
            throw error;
        }
    };

    const getLeaderboard = async (limit) => {
        return await discordAuthClient.getLeaderboard(limit);
    };

    const deleteAccount = async () => {
        setAuthState(prev => ({ ...prev, loading: true }));
        try {
            await discordAuthClient.deleteAccount();
        } finally {
            setAuthState(prev => ({ ...prev, loading: false }));
        }
    };

    return {
        ...authState,
        login,
        logout,
        updateStats,
        getLeaderboard,
        deleteAccount,
        getAvatarUrl: () => discordAuthClient.getAvatarUrl(),
        handleAuthCallback: (token) => discordAuthClient.handleAuthCallback(token)
    };
};

export default discordAuthClient;