import React from 'react';
import BulbRing from '../show/BulbRing';

/**
 * Compte à rebours avant chaque extrait (3, 2, 1, Go!)
 * La couronne d'ampoules s'éteint à chaque seconde.
 * @param {string} countdown - Texte reçu du serveur
 */
const CountdownOverlay = ({ countdown }) => {
    if (!countdown) return null;

    const text = String(countdown).trim();
    const isGo = /^go!?$/i.test(text);
    const isNumber = /^\d+$/.test(text);
    const progress = isNumber ? Math.min(1, Number(text) / 3) : 1;

    return (
        <div
            className="show-surface pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-show-night/85 font-show text-show-white"
            aria-live="assertive"
        >
            <BulbRing progress={progress} className="h-[min(16rem,70vw)] w-[min(16rem,70vw)]">
                <span key={text} className={`show-pop font-brand leading-none ${isGo ? 'text-6xl text-show-yellow sm:text-7xl' : 'text-8xl sm:text-9xl'}`}>
                    {isGo ? 'GO' : text}
                </span>
            </BulbRing>
        </div>
    );
};

export default CountdownOverlay;