import React from 'react';
import { useDiscordAuth } from '../utils/discordAuth';

function DiscordLoginButton({ className = "", size = "normal", redirectPath = "profile", children }) {
    const { isAuthenticated, user, login, getAvatarUrl, loading } = useDiscordAuth();

    // Si l'utilisateur est connecté, afficher seulement sa photo
    if (isAuthenticated && user) {
        const handleProfileClick = () => {
            window.location.href = '/#/profile';
        };

        return (
            <button
                onClick={handleProfileClick}
                className={`inline-flex items-center justify-center p-2 bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-400/30 hover:from-green-500/30 hover:to-green-600/30 text-green-300 hover:text-green-200 transition-all duration-300 rounded-full ${className}`}
                disabled={loading}
                title={`${user.username} - Voir le profil`}
            >
                <img
                    src={getAvatarUrl(32)}
                    alt={`${user.username} avatar`}
                    className="w-8 h-8 rounded-full"
                />
            </button>
        );
    }

    // Si non connecté, afficher le bouton de connexion
    const handleLogin = () => {
        login(redirectPath);
    };

    const sizeClasses = {
        small: "px-3 py-2 text-sm",
        normal: "px-4 py-2",
        large: "px-6 py-3 text-lg"
    };

    return (
        <button
            onClick={handleLogin}
            disabled={loading}
            className={`inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 hover:from-indigo-500/30 hover:to-purple-500/30 text-indigo-300 hover:text-indigo-200 transition-all duration-300 rounded-xl font-medium ${sizeClasses[size]} ${className}`}
        >
            {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
            ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
            )}
            {children || (loading ? 'Connexion...' : 'Discord')}
        </button>
    );
}

export default DiscordLoginButton;