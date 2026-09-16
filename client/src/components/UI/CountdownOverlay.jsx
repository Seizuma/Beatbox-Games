import React, { useRef } from 'react';

const parseCountdown = (countdown) => {
    const text = String(countdown).trim();
    const isGo = /^(go!?|0)$/i.test(text);
    const number = /^\d+$/.test(text) ? Number(text) : null;
    return { text, isGo, number };
};

// Scène du décompte : montée tant que le décompte est en cours, pour que la couronne se vide d'un seul tenant
function CountdownStage({ countdown }) {
    const { text, isGo, number } = parseCountdown(countdown);

    // Durée totale fixée au premier chiffre reçu (3 en général)
    const drainSecondsRef = useRef(number && number > 0 ? number : 3);

    return (
        <div
            className="countdown-backdrop show-surface pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-show-night/90 font-show text-show-white"
            aria-live="assertive"
        >
            {/* Halo de scène */}
            <div
                className="absolute inset-0"
                style={{ background: 'radial-gradient(circle at 50% 50%, rgb(42 79 176 / 0.55), transparent 60%)' }}
                aria-hidden="true"
            />

            {isGo && <div key="flash" className="countdown-flash absolute inset-0 bg-show-yellow" aria-hidden="true" />}

            <div className="relative h-[min(17rem,72vw)] w-[min(17rem,72vw)]">
                {/* Couronne d'ampoules qui se vide en continu */}
                <div
                    className="countdown-ring bulb-ring absolute inset-0"
                    data-go={isGo ? 'true' : 'false'}
                    style={{ '--drain-duration': `${drainSecondsRef.current}s` }}
                    aria-hidden="true"
                />

                {/* Pulsation à chaque seconde */}
                {!isGo && (
                    <div
                        key={`tick-${text}`}
                        className="countdown-tick absolute inset-[8%] rounded-full border-4 border-show-yellow/70"
                        aria-hidden="true"
                    />
                )}

                {/* Ondes de départ */}
                {isGo && (
                    <>
                        <div className="countdown-wave absolute inset-[6%] rounded-full border-[6px] border-show-yellow" aria-hidden="true" />
                        <div className="countdown-wave absolute inset-[6%] rounded-full border-4 border-show-white" style={{ animationDelay: '140ms' }} aria-hidden="true" />
                    </>
                )}

                <div className="absolute inset-0 flex items-center justify-center">
                    {isGo ? (
                        <span key="go" className="countdown-go font-brand text-7xl leading-none text-show-yellow drop-shadow-[0_6px_0_#0A1B45] sm:text-8xl">
                            GO
                        </span>
                    ) : (
                        <span key={`n-${text}`} className="countdown-number font-brand text-[7rem] leading-none sm:text-[9rem]">
                            {text}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Décompte avant chaque extrait ou partie (3, 2, 1, GO)
 * @param {string|number} countdown - Valeur reçue du serveur ; vide quand il n'y a pas de décompte
 */
const CountdownOverlay = ({ countdown }) => {
    if (countdown === null || countdown === undefined || countdown === '' || countdown === false) {
        return null;
    }
    return <CountdownStage countdown={countdown} />;
};

export default CountdownOverlay;