import React from 'react';

const ErrorView = ({
    error,
    handleRetry,
    handleNewGame,
    handleCleanSession, // ✅ NOUVELLE PROP
    t,
    modernBackground,
    modernCard,
    modernButton,
    AnimatedBackground,
    LanguageSwitch,
    GameModeBadge
}) => {
    // ✅ Détecter si c'est une erreur de session/room
    const isSessionError = error && (
        error.includes('Room introuvable') ||
        error.includes('sessionCleaned') ||
        error.includes('Partie en cours') ||
        error.includes('Room pleine') ||
        error.includes('connectionError') ||
        error.includes('connectionFailed')
    );

    const isKicked = error && error.includes('exclu');

    return (
        <div className={modernBackground}>
            <AnimatedBackground />
            <LanguageSwitch />
            <div className="flex flex-col items-center justify-center min-h-screen px-4 relative z-10">
                <div className={`${modernCard} p-8 max-w-md w-full`}>
                    <div className="flex flex-col items-center gap-6">
                        {/* Icône d'erreur */}
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isKicked ? 'bg-orange-500/20' : 'bg-red-500/20'
                            }`}>
                            {isKicked ? (
                                <div className="text-4xl">🚫</div>
                            ) : (
                                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            )}
                        </div>

                        {/* Titre */}
                        <h2 className={`text-2xl font-bold text-center ${isKicked ? 'text-orange-400' : 'text-red-400'
                            }`}>
                            {isKicked ? t('excluded') : t('error')}
                        </h2>

                        {/* Message d'erreur */}
                        <div className="text-center">
                            <p className="text-gray-300 mb-4">
                                {error}
                            </p>
                            <GameModeBadge />
                        </div>

                        {/* Boutons d'action pour exclusion */}
                        {isKicked ? (
                            <div className="flex flex-col gap-3 w-full">
                                <div className="bg-orange-500/20 border border-orange-400/30 rounded-xl p-4">
                                    <p className="text-orange-300 text-sm">
                                        {t('youCanCreateOwnRoom')}
                                    </p>
                                </div>

                                <button
                                    onClick={handleNewGame}
                                    className={`${modernButton} bg-green-600 hover:bg-green-700`}
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    {t('createNewRoom')}
                                </button>
                            </div>
                        ) : (
                            /* Boutons d'action pour autres erreurs */
                            <div className="flex flex-col gap-3 w-full">
                                {/* Bouton retry normal */}
                                <button
                                    onClick={handleRetry}
                                    className={`${modernButton} bg-blue-600 hover:bg-blue-700`}
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    {t('retry')}
                                </button>

                                {/* ✅ BOUTON NETTOYAGE DE SESSION (conditionnel) */}
                                {isSessionError && handleCleanSession && (
                                    <button
                                        onClick={handleCleanSession}
                                        className={`${modernButton} bg-orange-600 hover:bg-orange-700`}
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        {t('cleanSession')}
                                    </button>
                                )}

                                {/* Bouton nouvelle partie */}
                                <button
                                    onClick={handleNewGame}
                                    className={`${modernButton} bg-green-600 hover:bg-green-700`}
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    {t('newGame')}
                                </button>
                            </div>
                        )}

                        {/* ✅ INFO SUPPLÉMENTAIRE POUR LES ERREURS DE SESSION */}
                        {isSessionError && !isKicked && (
                            <div className="text-center p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                                <p className="text-orange-300 text-sm">
                                    💡 {t('sessionErrorInfo')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ErrorView;
