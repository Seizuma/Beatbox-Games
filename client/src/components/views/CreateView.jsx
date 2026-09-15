import React, { useState } from 'react';

const CreateView = ({
    pseudo,
    setPseudo,
    gameMode,
    error,
    handleCreateRoom,
    handleJoinRoom,
    t,
    modernBackground,
    modernCard,
    modernButton,
    modernInput,
    AnimatedBackground,
    LanguageSwitch,
    GameModeBadge,
    seoData,
    onBackToHub
}) => {
    const [activeTab, setActiveTab] = useState('create');
    const [joinRoomCode, setJoinRoomCode] = useState('');
    const [showInstructions, setShowInstructions] = useState(false);

    const handleJoinRoomSubmit = (code) => {
        const cleanCode = code.trim().toUpperCase();
        if (cleanCode && cleanCode.length === 5) {
            handleJoinRoom(cleanCode);
        }
    };

    return (
        <div className={modernBackground}>
            <AnimatedBackground />
            <LanguageSwitch />

            {/* Bouton retour Hub */}
            {onBackToHub && (
                <div className="fixed top-4 left-4 z-40">
                    <button
                        onClick={onBackToHub}
                        className="px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700/80 backdrop-blur-sm border border-zinc-600/50 text-zinc-300 hover:text-white rounded-lg transition-all duration-300 text-sm font-semibold inline-flex items-center gap-2"
                    >
                        ← {t('backToHub')}
                    </button>
                </div>
            )}

            <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 relative z-10">
                <div className={`${modernCard} p-6 md:p-8 max-w-2xl w-full mx-4`}>

                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <span className="text-4xl md:text-5xl animate-bounce">🌍</span>
                            <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                {t('blindTestOnline')}
                            </h1>
                            <span className="text-4xl md:text-5xl animate-bounce delay-300">🎵</span>
                        </div>
                        <div className="mb-3">
                            <GameModeBadge />
                        </div>
                        <p className="text-sm md:text-base text-zinc-400 mb-3">
                            ✨ {t('createRoomDescription')}
                        </p>
                        <button
                            onClick={() => setShowInstructions(true)}
                            className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 rounded-lg transition-all duration-300 text-sm font-semibold inline-flex items-center gap-2"
                        >
                            📖 {t('howToPlay')}
                        </button>
                    </div>

                    {/* Onglets Créer / Rejoindre */}
                    <div className="flex gap-3 mb-6">
                        <button
                            onClick={() => setActiveTab('create')}
                            className={`flex-1 py-3 rounded-lg font-bold transition-all duration-300 ${activeTab === 'create'
                                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg'
                                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50'
                                }`}
                        >
                            {t('createGame')}
                        </button>
                        <button
                            onClick={() => setActiveTab('join')}
                            className={`flex-1 py-3 rounded-lg font-bold transition-all duration-300 ${activeTab === 'join'
                                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg'
                                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50'
                                }`}
                        >
                            {t('joinRoom')}
                        </button>
                    </div>

                    {/* Formulaire Pseudo (commun) */}
                    <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 mb-4 border border-zinc-700/50">
                        <label className="block text-sm font-semibold text-zinc-300 mb-2">
                            {t('yourPseudo')}
                        </label>
                        <input
                            type="text"
                            placeholder={t('yourPseudo')}
                            value={pseudo}
                            onChange={(e) => setPseudo(e.target.value)}
                            className={`${modernInput} w-full p-3 text-base text-center`}
                            maxLength={20}
                        />
                    </div>

                    {/* Contenu selon l'onglet */}
                    {activeTab === 'create' ? (
                        <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50">
                            <h3 className="text-lg font-bold text-purple-400 mb-2">{t('createGame')}</h3>
                            <p className="text-zinc-400 text-sm mb-4">
                                {t('createRoomDescription')}
                            </p>
                            <button
                                onClick={handleCreateRoom}
                                disabled={!pseudo.trim()}
                                className={`${modernButton} w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {t('createGame')}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50">
                            <h3 className="text-lg font-bold text-purple-400 mb-3">{t('joinRoom')}</h3>
                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                                    {t('roomCode')}
                                </label>
                                <input
                                    type="text"
                                    placeholder={t('roomCode')}
                                    value={joinRoomCode}
                                    onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                                    className={`${modernInput} w-full p-3 text-xl text-center font-bold tracking-wider`}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && joinRoomCode.trim()) {
                                            handleJoinRoomSubmit(joinRoomCode);
                                        }
                                    }}
                                    maxLength={5}
                                />
                            </div>
                            <button
                                onClick={() => handleJoinRoomSubmit(joinRoomCode)}
                                disabled={!pseudo.trim() || joinRoomCode.length !== 5}
                                className={`w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                            >
                                {t('joinRoom')} {joinRoomCode}
                            </button>
                        </div>
                    )}

                    {/* Erreur */}
                    {error && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 rounded-xl">
                            <p className="text-red-400 text-center text-sm">{error}</p>
                        </div>
                    )}
                </div>

                {/* Modal Instructions */}
                {showInstructions && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
                        <div
                            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                            onClick={() => setShowInstructions(false)}
                        ></div>
                        <div className="relative bg-zinc-900 border-2 border-cyan-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-cyan-500/20 animate-scaleIn">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-cyan-400">📖 {t('howToPlay')}</h3>
                                <button
                                    onClick={() => setShowInstructions(false)}
                                    className="text-zinc-400 hover:text-white text-2xl transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="space-y-3 text-zinc-300 text-sm">
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">🎵</span>
                                    <div><strong>1.</strong> {t('blindTestInstruction1')}</div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">⏱️</span>
                                    <div><strong>2.</strong> {t('blindTestInstruction2')}</div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">✏️</span>
                                    <div><strong>3.</strong> {t('blindTestInstruction3')}</div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">✅</span>
                                    <div><strong>4.</strong> {t('blindTestInstruction4')}</div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">🏆</span>
                                    <div><strong>5.</strong> {t('blindTestInstruction5')}</div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">👥</span>
                                    <div><strong>6.</strong> {t('blindTestInstruction6')}</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowInstructions(false)}
                                className="w-full mt-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-bold rounded-lg transition-all"
                            >
                                {t('understood')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreateView;