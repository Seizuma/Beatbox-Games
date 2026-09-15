import React, { useState, useEffect } from 'react';
import socketBuzzer from '../../buzzer-socket';
import { getRandomPseudo } from '../../utils/randomPseudo';

const AVATARS = ['🎤', '🎵', '🎧', '🎼', '🎹', '🎸', '🥁', '🎺', '🎷'];

const MODES = {
    COUNTRY: 'buzzer_country',
    EVENT: 'buzzer_event'
};

function BuzzerCreateView({
    t,
    onCreateRoom,
    onJoinRoom,
    username,
    setUsername,
    avatar,
    setAvatar,
    discordUser = null
}) {
    const [activeTab, setActiveTab] = useState('create');
    const [joinRoomCode, setJoinRoomCode] = useState('');
    const [showInstructions, setShowInstructions] = useState(false);

    const defaultConfig = {
        mode: MODES.EVENT,
        filter: 'Grand Beatbox Battle',
        totalRounds: 10
    };

    useEffect(() => {
        if (discordUser?.username) {
            setUsername(discordUser.username);
        } else if (!username || username.trim() === '') {
            const randomPseudo = getRandomPseudo();
            setUsername(randomPseudo);
        }
    }, [discordUser]);

    const handleCreate = () => {
        if (!username.trim()) {
            alert(t('buzzerPleaseEnterUsername'));
            return;
        }

        const config = {
            mode: defaultConfig.mode,
            filter: defaultConfig.filter,
            totalRounds: defaultConfig.totalRounds,
            username: username.trim(),
            avatar: avatar
        };

        onCreateRoom(config);
    };

    const handleJoin = () => {
        if (!username.trim()) {
            alert(t('buzzerPleaseEnterUsername'));
            return;
        }

        if (!joinRoomCode.trim()) {
            alert(t('buzzerPleaseEnterRoomCode'));
            return;
        }

        onJoinRoom({
            roomCode: joinRoomCode.trim().toUpperCase(),
            username: username.trim(),
            avatar
        });
    };

    const getDiscordAvatarUrl = () => {
        if (discordUser?.discordId && discordUser?.avatar) {
            return `https://cdn.discordapp.com/avatars/${discordUser.discordId}/${discordUser.avatar}.png?size=64`;
        }
        return null;
    };

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <span className="text-4xl md:text-5xl animate-bounce">🥊</span>
                    <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        {t('buzzerWelcome')}
                    </h2>
                    <span className="text-4xl md:text-5xl animate-bounce delay-300">🎤</span>
                </div>
                <p className="text-sm md:text-base text-zinc-400 mb-3">
                    {t('buzzerWelcomeSubtitle')}
                </p>
                <button
                    onClick={() => setShowInstructions(true)}
                    className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 rounded-lg transition-all duration-300 text-sm font-semibold inline-flex items-center gap-2"
                >
                    📖 {t('buzzerHowToPlay')}
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
                    {t('buzzerCreateGame')}
                </button>
                <button
                    onClick={() => setActiveTab('join')}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all duration-300 ${activeTab === 'join'
                            ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg'
                            : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50'
                        }`}
                >
                    {t('buzzerJoinGame')}
                </button>
            </div>

            {/* Profil utilisateur (commun) */}
            <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 mb-4 border border-zinc-700/50">
                <h3 className="text-lg font-bold text-cyan-400 mb-3">
                    {t('buzzerYourProfile')}
                </h3>

                {/* Pseudo */}
                <div className="mb-3">
                    <label className="block text-sm font-semibold text-zinc-300 mb-2">
                        {t('buzzerPseudo')} {discordUser && <span className="text-xs text-cyan-400">{t('buzzerDiscordLabel')}</span>}
                    </label>
                    <div className="flex gap-2 items-center">
                        {discordUser && getDiscordAvatarUrl() && (
                            <img
                                src={getDiscordAvatarUrl()}
                                alt={discordUser.username}
                                className="w-10 h-10 rounded-full border-2 border-cyan-400 flex-shrink-0"
                            />
                        )}
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={t('buzzerUsernamePlaceholder')}
                            maxLength={20}
                            disabled={!!discordUser}
                            className={`flex-1 px-3 py-2 bg-zinc-900/50 border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-all text-sm ${discordUser ? 'opacity-60 cursor-not-allowed' : ''
                                }`}
                        />
                        {!discordUser && (
                            <button
                                type="button"
                                onClick={() => setUsername(getRandomPseudo())}
                                className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-400 rounded-lg transition-all duration-300 font-bold text-lg"
                                title={t('buzzerGenerateRandomPseudo')}
                            >
                                🎲
                            </button>
                        )}
                    </div>
                    {discordUser && (
                        <p className="text-xs text-cyan-400 mt-1">
                            {t('buzzerDiscordConnected')}
                        </p>
                    )}
                </div>

                {/* Avatar */}
                <div>
                    <label className="block text-sm font-semibold text-zinc-300 mb-2">
                        {t('buzzerAvatar')}
                    </label>
                    <div className="flex gap-2 flex-wrap">
                        {AVATARS.map((emo) => (
                            <button
                                key={emo}
                                type="button"
                                onClick={() => setAvatar(emo)}
                                className={`text-2xl p-2 rounded-lg transition-all duration-300 ${avatar === emo
                                        ? 'bg-cyan-500/30 border-2 border-cyan-400 scale-110'
                                        : 'bg-zinc-900/50 border border-zinc-700 hover:scale-105'
                                    }`}
                            >
                                {emo}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Contenu selon l'onglet */}
            {activeTab === 'create' ? (
                <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50">
                    <h3 className="text-lg font-bold text-purple-400 mb-2">
                        {t('buzzerCreateGame')}
                    </h3>
                    <p className="text-zinc-400 text-sm mb-4">
                        {t('buzzerConfigInLobby')}
                    </p>
                    <button
                        onClick={handleCreate}
                        className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-bold rounded-lg transition-all duration-300 transform hover:scale-105"
                    >
                        {t('buzzerCreateRoom')}
                    </button>
                </div>
            ) : (
                <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50">
                    <h3 className="text-lg font-bold text-purple-400 mb-3">
                        {t('buzzerJoinGame')}
                    </h3>
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-zinc-300 mb-2">
                            {t('buzzerRoomCode')}
                        </label>
                        <input
                            type="text"
                            value={joinRoomCode}
                            onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                            placeholder={t('buzzerRoomCodePlaceholder')}
                            maxLength={6}
                            className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-600 rounded-lg text-white text-center text-xl font-bold placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-all tracking-wider"
                        />
                    </div>
                    <button
                        onClick={handleJoin}
                        className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-lg transition-all duration-300 transform hover:scale-105"
                    >
                        {t('buzzerJoinRoom')}
                    </button>
                </div>
            )}

            {/* Modal Instructions */}
            {showInstructions && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => setShowInstructions(false)}
                    ></div>
                    <div className="relative bg-zinc-900 border-2 border-cyan-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-cyan-500/20 animate-scaleIn">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-cyan-400">📖 {t('buzzerHowToPlay')}</h3>
                            <button
                                onClick={() => setShowInstructions(false)}
                                className="text-zinc-400 hover:text-white text-2xl transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="space-y-3 text-zinc-300 text-sm">
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">🖼️</span>
                                <div><strong>1.</strong> {t('buzzerInstruction1')}</div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">⌨️</span>
                                <div><strong>2.</strong> {t('buzzerInstruction2')}</div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">⏱️</span>
                                <div><strong>3.</strong> {t('buzzerInstruction3')}</div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">🌫️</span>
                                <div><strong>4.</strong> {t('buzzerInstruction4')}</div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">⏳</span>
                                <div><strong>5.</strong> {t('buzzerInstruction5')}</div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">🏆</span>
                                <div><strong>6.</strong> {t('buzzerInstruction6')}</div>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowInstructions(false)}
                            className="w-full mt-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-bold rounded-lg transition-all"
                        >
                            {t('buzzerUnderstood')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default BuzzerCreateView;