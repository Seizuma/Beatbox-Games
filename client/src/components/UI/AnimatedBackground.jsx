import React from 'react';

/**
 * Composant d'arrière-plan animé avec des cercles flottants
 * Utilisé sur toutes les vues pour créer l'ambiance visuelle
 */
const AnimatedBackground = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-cyan-400/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-purple-400/10 rounded-full blur-xl animate-pulse delay-700"></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-pink-400/10 rounded-full blur-xl animate-pulse delay-1000"></div>
    </div>
);

export default AnimatedBackground;