import React from 'react';
import { stripEmoji } from '../../utils/showI18n';

/**
 * Révélation de l'artiste à la fin d'une manche
 * @param {object} artistRevealState - { show, artist, isExiting }
 * @param {function} t - Fonction de traduction
 */
const ArtistRevealOverlay = ({ artistRevealState, t }) => {
    if (!artistRevealState?.show) return null;

    const label = stripEmoji(t('itWas')).replace(/\s*:\s*$/, '');

    return (
        <div
            role="status"
            aria-live="polite"
            className={`show-surface fixed inset-0 z-40 flex items-center justify-center bg-show-night/80 px-6 font-show transition-opacity duration-500 ${artistRevealState.isExiting ? 'opacity-0' : 'opacity-100'}`}
        >
            <div className="show-pop w-full max-w-sm rounded-2xl bg-show-white px-6 pb-7 pt-6 text-center text-show-night shadow-2xl">
                <p className="text-sm font-extrabold text-show-desk">{label}</p>
                <p className="mt-2 break-words font-brand text-4xl leading-tight">{artistRevealState.artist}</p>
            </div>
        </div>
    );
};

export default ArtistRevealOverlay;