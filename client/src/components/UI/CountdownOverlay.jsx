import React from 'react';

/**
 * Overlay de countdown animé pour le début des rounds
 * ✅ VERSION FINALE : Gestion correcte de tous les cas de countdown
 * @param {string} countdown - Texte à afficher (3, 2, 1, Go!)
 * @param {boolean} isFirefox - Détection Firefox pour optimisations
 */
const CountdownOverlay = ({ countdown, isFirefox }) => {
    if (!countdown) return null;

    // ✅ CORRECTION : Normaliser et identifier le type de countdown
    const countdownStr = String(countdown);
    const isGo = countdownStr === 'Go!' || countdownStr === 'GO!' || countdownStr === 'go!';
    const isNumber = !isNaN(parseInt(countdownStr)) && isFinite(countdownStr);

    // ✅ LOG pour debug
    console.log('🎭 CountdownOverlay render:', {
        original: countdown,
        processed: countdownStr,
        isGo,
        isNumber,
        shouldShow: isGo || isNumber
    });

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="relative w-80 h-80 flex items-center justify-center">
                {/* Effet de background animé */}
                <div
                    className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 rounded-full animate-spin"
                    style={{ animationDuration: '3s' }}
                ></div>
                <div
                    className="absolute inset-4 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-cyan-500/5 rounded-full animate-spin"
                    style={{ animationDuration: '2s', animationDirection: 'reverse' }}
                ></div>

                {/* Container pour le texte avec overlay smooth */}
                <div className="relative w-full h-full flex items-center justify-center">
                    {/* Texte principal avec transition en fondu */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span
                            key={countdown}
                            className={`text-9xl md:text-[12rem] font-black font-mono ${isGo ? 'text-green-400' : 'text-cyan-400'
                                }`}
                            style={{
                                textShadow: isFirefox
                                    ? '0 0 25px currentColor'
                                    : '0 0 40px currentColor, 0 0 80px currentColor',
                                minWidth: '2em',
                                textAlign: 'center',
                                animation: 'countdownFadeIn 0.3s ease-out'
                            }}
                        >
                            {countdownStr}
                        </span>
                    </div>

                    {/* Pulse ring synchronisé */}
                    <div
                        key={`ring-${countdown}`}
                        className="absolute inset-8 border-4 border-current rounded-full opacity-30"
                        style={{
                            color: isGo ? '#4ade80' : '#22d3ee',
                            animation: 'pulseRing 0.6s ease-out'
                        }}
                    ></div>
                </div>

                {/* Indicateur de debug en mode développement */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="absolute bottom-4 left-4 text-white text-xs bg-black/50 p-2 rounded">
                        <div>Original: "{countdown}"</div>
                        <div>String: "{countdownStr}"</div>
                        <div>Type: {typeof countdown}</div>
                        <div>IsGo: {isGo ? '✅' : '❌'}</div>
                        <div>IsNumber: {isNumber ? '✅' : '❌'}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CountdownOverlay;