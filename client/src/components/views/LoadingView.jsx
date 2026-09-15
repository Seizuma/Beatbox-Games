import React from 'react';

const LoadingView = ({
    room,
    t,
    modernBackground,
    modernCard,
    AnimatedBackground,
    LanguageSwitch,
    GameModeBadge
}) => {
    return (
        <div className={modernBackground}>
            <AnimatedBackground />
            <LanguageSwitch />
            <div className="flex flex-col items-center justify-center min-h-screen px-4 relative z-10">
                <div className={`${modernCard} p-8 max-w-md w-full`}>
                    <div className="flex flex-col items-center gap-6">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"></div>
                            <div className="absolute inset-2 bg-zinc-800 rounded-full"></div>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2">
                                {t('connecting')}
                            </p>
                            <GameModeBadge />
                            <p className="text-green-400 text-sm flex items-center gap-2 justify-center mt-2">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                {t('socketStable')}
                            </p>
                            {room && (
                                <p className="text-yellow-400 text-sm mt-2">
                                    {t('joiningRoom', { room })}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoadingView;