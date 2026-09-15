import React from 'react';

/**
 * Overlay pour révéler l'artiste à la fin d'un round
 * @param {object} artistRevealState - État de révélation { show, artist, isExiting }
 * @param {function} t - Fonction de traduction
 */
const ArtistRevealOverlay = ({ artistRevealState, t }) => {
    if (!artistRevealState.show) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40">
            <div
                className={`bg-gradient-to-r from-yellow-500/90 to-orange-500/90 border border-yellow-400/50 rounded-3xl p-8 max-w-md mx-4 text-center animate-optimized ${artistRevealState.isExiting ? 'reveal-exit' : 'reveal-enter'
                    }`}
            >
                <div className="text-6xl mb-4 animate-bounce">🎤</div>
                <h3 className="text-2xl font-bold text-white mb-3">
                    {t('itWas')}
                </h3>
                <p className="text-3xl font-bold text-white">
                    "{artistRevealState.artist}"
                </p>
            </div>
        </div>
    );
};

export default ArtistRevealOverlay;