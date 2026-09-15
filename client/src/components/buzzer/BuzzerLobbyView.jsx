import React, { useState, useEffect } from 'react';
import CustomSelect from './CustomSelect';
import socketBuzzer from '../../buzzer-socket';

const MODES = {
    COUNTRY: 'buzzer_country',
    EVENT: 'buzzer_event'
};


function BuzzerLobbyView({ t, roomCode, players, isCreator, gameState, onStartGame }) {
    const [showCopiedNotif, setShowCopiedNotif] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false); // ✅ NOUVEAU
    const [showCountdown, setShowCountdown] = useState(false);
    const [countdownValue, setCountdownValue] = useState(3);
    // États de configuration
    const [selectedMode, setSelectedMode] = useState(() => {
        console.log('🎮 Init selectedMode, gameState:', gameState);
        return gameState?.mode || MODES.EVENT;
    });
    const [selectedFilter, setSelectedFilter] = useState(() => {
        console.log('🎯 Init selectedFilter, gameState?.filter:', gameState?.filter);
        return gameState?.filter || '';
    });
    const [totalRounds, setTotalRounds] = useState(() => {
        console.log('🔢 Init totalRounds, gameState?.totalRounds:', gameState?.totalRounds);
        return gameState?.totalRounds || 10;
    });
    const [maxAvailableRounds, setMaxAvailableRounds] = useState(20); // ✅ NOUVEAU
    // ✅ Fonction pour obtenir l'avatar (Discord ou emoji)
    const getPlayerAvatar = (player) => {
        if (player.isDiscordUser && player.discordAvatar) {
            return `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=64`;
        }
        return null; // Retourner null pour afficher l'emoji à la place
    };
    // Filtres disponibles
    const [countries, setCountries] = useState([]);
    const [events, setEvents] = useState([]);
    const [loadingFilters, setLoadingFilters] = useState(true);

    // ✅ NOUVEAU : Synchroniser avec gameState quand il change
    useEffect(() => {
        if (gameState) {
            setSelectedMode(gameState.mode);
            setSelectedFilter(gameState.filter);
            setTotalRounds(gameState.totalRounds);
        }
    }, [gameState]);

    useEffect(() => {
        socketBuzzer.on('buzzer:countdown', (value) => {
            setShowCountdown(true);
            setCountdownValue(value);
        });

        socketBuzzer.on('buzzer:countdownEnd', () => {
            setCountdownValue(0);
            setTimeout(() => setShowCountdown(false), 800);
            onStartGame(); // Lancer la partie
        });

        return () => {
            socketBuzzer.off('buzzer:countdown');
            socketBuzzer.off('buzzer:countdownEnd');
        };
    }, []);


    // Charger les filtres au montage
    useEffect(() => {
        socketBuzzer.emit('buzzer:getFilters', (response) => {
            if (response.success) {
                setCountries(response.countries);
                setEvents(response.events);

                // ✅ Ne définir un filtre par défaut QUE si gameState n'en a pas
                if (!gameState?.filter) {
                    if (selectedMode === MODES.COUNTRY && response.countries.length > 0) {
                        setSelectedFilter(response.countries[0]);
                    } else if (selectedMode === MODES.EVENT && response.events.length > 0) {
                        setSelectedFilter(response.events[0]);
                    }
                }
            }
            setLoadingFilters(false);
        });

        socketBuzzer.on('buzzer:configUpdated', handleConfigUpdated);

        return () => {
            socketBuzzer.off('buzzer:configUpdated', handleConfigUpdated);
        };
    }, []);

    useEffect(() => {
        // ✅ Ne définir un filtre par défaut QUE si aucun n'est déjà défini
        if (!selectedFilter) {
            if (selectedMode === MODES.COUNTRY && countries.length > 0) {
                setSelectedFilter(countries[0]);
            } else if (selectedMode === MODES.EVENT && events.length > 0) {
                setSelectedFilter(events[0]);
            }
        }
    }, [selectedMode, countries, events]);

    // ✅ NOUVEAU : Obtenir le nombre max de beatboxers disponibles
    useEffect(() => {
        if (selectedMode && selectedFilter) {
            socketBuzzer.emit('buzzer:getMaxBeatboxers', {
                mode: selectedMode,
                filter: selectedFilter
            }, (response) => {
                if (response.success && response.maxBeatboxers) {
                    setMaxAvailableRounds(Math.min(response.maxBeatboxers, 1000));
                    if (totalRounds > response.maxBeatboxers) {
                        setTotalRounds(Math.min(response.maxBeatboxers, 20));
                    }
                }
            });
        }
    }, [selectedMode, selectedFilter]);

    const handleStartWithCountdown = () => {
        socketBuzzer.emit('buzzer:startGame', { roomCode }, (response) => {
            if (!response.success) {
                alert('Erreur: ' + response.error);
            }
        });
    };


    const handleConfigUpdated = (data) => {
        setSelectedMode(data.mode);
        setSelectedFilter(data.filter);
        setTotalRounds(data.totalRounds);
    };

    const handleKickPlayer = (targetPlayerId) => {
        if (!window.confirm('Êtes-vous sûr de vouloir exclure ce joueur ?')) {
            return;
        }

        socketBuzzer.emit('buzzer:kickPlayer', {
            roomCode,
            targetPlayerId
        }, (response) => {
            if (response.success) {
                console.log(`✅ ${response.kickedUsername} exclu avec succès`);
            } else {
                alert('Erreur: ' + response.error);
            }
        });
    };

    const copyRoomCode = () => {
        navigator.clipboard.writeText(roomCode);
        setShowCopiedNotif(true);
        setTimeout(() => setShowCopiedNotif(false), 2000);
    };

    const shareLink = () => {
        const link = `${window.location.origin}/#/buzzer-battle?room=${roomCode}`;
        navigator.clipboard.writeText(link);
        setShowCopiedNotif(true);
        setTimeout(() => setShowCopiedNotif(false), 2000);
    };

    const getModeDisplay = () => {
        if (!gameState) return '';

        if (gameState.mode === MODES.COUNTRY || selectedMode === MODES.COUNTRY) {
            return `${t('buzzerByCountry')}: ${selectedFilter || gameState.filter}`;
        } else if (gameState.mode === MODES.EVENT || selectedMode === MODES.EVENT) {
            return `${t('buzzerByEvent')}: ${selectedFilter || gameState.filter}`;
        }
        return '';
    };

    const handleSaveConfig = () => {
        socketBuzzer.emit('buzzer:updateConfig', {
            roomCode,
            mode: selectedMode,
            filter: selectedFilter,
            totalRounds
        }, (response) => {
            if (response.success) {
                setShowSettings(false);
            } else {
                alert('Erreur: ' + response.error);
            }
        });
    };

    const currentFilters = selectedMode === MODES.COUNTRY ? countries : events;

    return (
        <div className="max-w-4xl mx-auto">
            {/* Titre avec bouton instructions - ✅ NOUVEAU */}
            <div className="text-center mb-6">
                <p className="text-zinc-400 text-lg mb-3">
                    {t('buzzerWaitingForStart')}
                </p>
                <button
                    onClick={() => setShowInstructions(true)}
                    className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 rounded-lg transition-all duration-300 text-sm font-semibold inline-flex items-center gap-2"
                >
                    📖 {t('buzzerHowToPlay')}
                </button>
            </div>

            {/* Notification copiée */}
            {showCopiedNotif && (
                <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-bounce z-50">
                    {t('copied')}
                </div>
            )}

            {/* Code de la room */}
            <div className="bg-zinc-800/50 backdrop-blur-sm rounded-lg p-4 mb-4 border border-zinc-700/50">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="text-center sm:text-left">
                        <p className="text-zinc-400 text-sm mb-1">{t('buzzerRoomCode')}</p>
                        <p className="text-3xl font-black text-transparent bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text tracking-wider">
                            {roomCode}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={copyRoomCode}
                            className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 rounded-lg transition-all duration-300 text-sm font-semibold"
                        >
                            {t('buzzerCopyCode')}
                        </button>
                        <button
                            onClick={shareLink}
                            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-400 rounded-lg transition-all duration-300 text-sm font-semibold"
                        >
                            {t('buzzerShareLink')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Configuration */}
            <div className="bg-zinc-800/50 backdrop-blur-sm rounded-lg p-4 mb-4 border border-zinc-700/50">
                <div className="flex justify-between items-center">
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-purple-400 mb-2">📋 {t('buzzerConfiguration')}</h3>
                        <div className="flex gap-4 text-sm">
                            <div>
                                <span className="text-zinc-400">{t('buzzerMode')}: </span>
                                <span className="text-white font-semibold">{getModeDisplay()}</span>
                            </div>
                            <div>
                                <span className="text-zinc-400">{t('buzzerRounds')}: </span>
                                <span className="text-white font-semibold">{totalRounds}</span>
                            </div>
                        </div>
                    </div>
                    {isCreator && (
                        <button
                            onClick={() => setShowSettings(true)}
                            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-400 rounded-lg transition-all duration-300 text-sm font-semibold"
                        >
                            {t('buzzerEdit')}
                        </button>
                    )}
                </div>
            </div>

            {/* Liste des joueurs */}
            <div className="bg-zinc-800/50 backdrop-blur-sm rounded-lg p-4 mb-4 border border-zinc-700/50">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-cyan-400">
                        {t('buzzerPlayers', { count: players.length, max: 10 })}
                    </h3>
                    {players.length < 1 && (
                        <p className="text-xs text-amber-400 animate-pulse">
                            {t('buzzerWaitingForPlayers')}
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-cols-fr">
                    {players.map((player, index) => (
                        <div
                            key={player.id || index}
                            className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl p-4 text-center transition-all duration-300 hover:border-cyan-500/50 relative min-w-0"
                        >
                            {/* ✅ AJOUT : Bouton kick (visible uniquement pour le créateur) */}
                            {isCreator && player.id !== players.find(p => p.username === gameState?.players?.[0]?.username)?.id && (
                                <button
                                    onClick={() => handleKickPlayer(player.id)}
                                    className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 hover:bg-red-600 text-white rounded-full text-xs font-bold transition-all duration-200 flex items-center justify-center"
                                    title={t('buzzerKickPlayer')}
                                >
                                    ✕
                                </button>
                            )}

                            {/* ✅ Afficher l'avatar Discord ou emoji */}
                            {player.isDiscordUser && player.discordAvatar ? (
                                <img
                                    src={`https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=64`}
                                    alt={player.username}
                                    className="w-16 h-16 rounded-full border-2 border-cyan-400 mx-auto mb-2"
                                />
                            ) : (
                                <div className="text-4xl mb-2">{player.avatar}</div>
                            )}
                            <p className="text-lg font-bold text-white px-2 break-words">
                                {player.username}
                            </p>

                            {/* ✅ Badge Discord */}
                            {player.isDiscordUser && (
                                <div className="mt-1">
                                    <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30">
                                        Discord
                                    </span>
                                </div>
                            )}

                            {/* ✅ Badge déconnecté (uniquement si explicitement false) */}
                            {player.connected === false && (
                                <div className="mt-1">
                                    <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
                                        Déconnecté
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Bouton démarrer */}
            {isCreator && (
                <button
                    onClick={handleStartWithCountdown}
                    disabled={players.length < 1}
                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 transform ${players.length < 1
                        ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white hover:scale-105 shadow-lg'
                        }`}
                >
                    {players.length < 1 ? t('buzzerWaitingForPlayers') : t('buzzerStartGame')}
                </button>
            )}

            {!isCreator && (
                <div className="text-center py-4 text-zinc-400">
                    <p className="text-lg">{t('buzzerWaitingForCreator')}</p>
                    <p className="text-sm mt-2">{t('buzzerCreatorWillStart')}</p>
                </div>
            )}

            {/* ✅ MODAL DES INSTRUCTIONS */}
            {showInstructions && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
                    {/* Overlay */}
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => setShowInstructions(false)}
                    ></div>

                    {/* Modal */}
                    <div className="relative bg-zinc-900 border-2 border-cyan-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-cyan-500/20 animate-scaleIn">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-cyan-400">📖 {t('buzzerHowToPlay')}</h3>
                            <button
                                onClick={() => setShowInstructions(false)}
                                className="text-zinc-400 hover:text-white text-2xl transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Contenu */}
                        <div className="space-y-3 text-zinc-300 text-sm">
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">🖼️</span>
                                <div>
                                    <strong>1.</strong> {t('buzzerInstruction1')}
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">⌨️</span>
                                <div>
                                    <strong>2.</strong> {t('buzzerPressSpace')} <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-cyan-400 font-mono">{t('buzzerSpace')}</kbd> {t('buzzerInstruction2')}
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">⏱️</span>
                                <div>
                                    <strong>3.</strong> {t('buzzerYouHave')} <span className="text-amber-400 font-bold">{t('buzzer5Seconds')}</span> {t('buzzerInstruction3')}
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">🌫️</span>
                                <div>
                                    <strong>4.</strong> {t('buzzerInstruction4')}
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">⏳</span>
                                <div>
                                    <strong>5.</strong> {t('buzzerInstruction5')}
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">🏆</span>
                                <div>
                                    <strong>6.</strong> <span className="text-green-400 font-bold">{t('buzzerCorrectPoints')}</span> {t('buzzerInstruction6')} <span className="text-red-400 font-bold">{t('buzzerWrongPoints')}</span> {t('buzzerInstruction6b')}
                                </div>
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

            {/* Modal des paramètres */}
            {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => setShowSettings(false)}
                    ></div>

                    <div className="relative bg-zinc-900 border-2 border-purple-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-purple-500/20 animate-scaleIn">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-purple-400">⚙️ {t('buzzerConfiguration')}</h3>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="text-zinc-400 hover:text-white text-2xl transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Mode de jeu */}
                            <div>
                                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                                    {t('buzzerGameMode')}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setSelectedMode(MODES.COUNTRY)}
                                        className={`p-3 rounded-lg font-bold transition-all duration-300 ${selectedMode === MODES.COUNTRY
                                            ? 'bg-cyan-500/30 border-2 border-cyan-400'
                                            : 'bg-zinc-800 border border-zinc-700 hover:bg-zinc-700'
                                            }`}
                                    >
                                        {t('buzzerModeCountry')}
                                    </button>
                                    <button
                                        onClick={() => setSelectedMode(MODES.EVENT)}
                                        className={`p-3 rounded-lg font-bold transition-all duration-300 ${selectedMode === MODES.EVENT
                                            ? 'bg-cyan-500/30 border-2 border-cyan-400'
                                            : 'bg-zinc-800 border border-zinc-700 hover:bg-zinc-700'
                                            }`}
                                    >
                                        {t('buzzerModeEvent')}
                                    </button>
                                </div>
                            </div>

                            {/* Sélection du filtre */}
                            <div>
                                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                                    {selectedMode === MODES.COUNTRY ? t('buzzerModeCountry') : t('buzzerModeEvent')}
                                </label>
                                <CustomSelect
                                    value={selectedFilter}
                                    onChange={setSelectedFilter}
                                    options={currentFilters}
                                    placeholder={loadingFilters ? t('loading') : t('buzzerSelectFilter')}
                                    icon={selectedMode === MODES.COUNTRY ? '🌍' : '🏆'}
                                    disabled={loadingFilters || currentFilters.length === 0}
                                />
                            </div>

                            {/* Nombre de rounds */}
                            <div>
                                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                                    {t('buzzerNumberOfRounds', { max: maxAvailableRounds })}
                                    <span className="text-xs text-zinc-500 ml-2">(Max: {maxAvailableRounds})</span>
                                </label>

                                {/* ✅ Affichage de la valeur actuelle */}
                                <div className="text-center mb-2">
                                    <span className="text-2xl font-bold text-purple-400">{totalRounds}</span>
                                    <span className="text-sm text-zinc-400 ml-2">{t('buzzerRounds')}</span>
                                </div>

                                <input
                                    type="range"
                                    min="5"
                                    max={maxAvailableRounds}
                                    step="1"
                                    value={totalRounds}
                                    onChange={(e) => setTotalRounds(parseInt(e.target.value))}
                                    className="w-full accent-purple-500"
                                />
                                <div className="flex justify-between text-xs text-zinc-500 mt-1">
                                    <span>5</span>
                                    <span>{maxAvailableRounds}</span>
                                </div>
                            </div>

                            {/* Boutons */}
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowSettings(false)}
                                    className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-bold rounded-lg transition-all"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={handleSaveConfig}
                                    className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-lg transition-all"
                                >
                                    {t('buzzerSaveConfig')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Countdown */}
            {showCountdown && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50">
                    <div className="text-center">
                        {countdownValue > 0 ? (
                            <>
                                <div className="text-9xl font-black text-transparent bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text animate-pulse mb-4">
                                    {countdownValue}
                                </div>
                                <p className="text-2xl text-white font-bold">
                                    {t('buzzerGameStarting')}
                                </p>
                            </>
                        ) : (
                            <div className="text-7xl font-black text-transparent bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text animate-bounce">
                                {t('buzzerGo')}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default BuzzerLobbyView;