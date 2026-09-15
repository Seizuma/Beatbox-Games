import React, { useEffect, useId, useRef, useState } from 'react';
import socketBuzzer from '../../buzzer-socket';
import GameShell, { StatusPill } from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import ShowModal from '../show/ShowModal';
import Lectern from '../show/Lectern';
import Icon from '../icons/Icon';
import { CountdownOverlay } from '../UI';
import BuzzerRulesModal from './BuzzerRulesModal';
import { copyToClipboard } from '../../utils/clipboard';
import { createShowT, MAX_PLAYERS } from '../../utils/showI18n';

const MODES = {
    COUNTRY: 'buzzer_country',
    EVENT: 'buzzer_event'
};

const MIN_ROUNDS = 5;

// Salle d'attente du Buzzer Battle : code à partager, pupitres, réglages de l'hôte
function BuzzerLobbyView({
    roomCode,
    players,
    isCreator,
    gameState,
    onStartGame,
    language,
    languageSwitch,
    onQuit
}) {
    const st = createShowT(language);
    const filterId = useId();
    const roundsId = useId();

    const [showSettings, setShowSettings] = useState(false);
    const [showRules, setShowRules] = useState(false);
    const [showCountdown, setShowCountdown] = useState(false);
    const [countdownValue, setCountdownValue] = useState(3);
    const [copyState, setCopyState] = useState(null);
    const copyTimeoutRef = useRef(null);

    // Configuration
    const [selectedMode, setSelectedMode] = useState(() => gameState?.mode || MODES.EVENT);
    const [selectedFilter, setSelectedFilter] = useState(() => gameState?.filter || '');
    const [totalRounds, setTotalRounds] = useState(() => gameState?.totalRounds || 10);
    const [maxAvailableRounds, setMaxAvailableRounds] = useState(20);

    // Filtres disponibles
    const [countries, setCountries] = useState([]);
    const [events, setEvents] = useState([]);
    const [loadingFilters, setLoadingFilters] = useState(true);

    const handleConfigUpdated = (data) => {
        setSelectedMode(data.mode);
        setSelectedFilter(data.filter);
        setTotalRounds(data.totalRounds);
    };

    // Synchroniser avec gameState quand il change
    useEffect(() => {
        if (gameState) {
            setSelectedMode(gameState.mode);
            setSelectedFilter(gameState.filter);
            setTotalRounds(gameState.totalRounds);
        }
    }, [gameState]);

    // Compte à rebours envoyé par le serveur
    useEffect(() => {
        socketBuzzer.on('buzzer:countdown', (value) => {
            setShowCountdown(true);
            setCountdownValue(value);
        });

        socketBuzzer.on('buzzer:countdownEnd', () => {
            setCountdownValue(0);
            setTimeout(() => setShowCountdown(false), 800);
            onStartGame();
        });

        return () => {
            socketBuzzer.off('buzzer:countdown');
            socketBuzzer.off('buzzer:countdownEnd');
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Charger les filtres au montage
    useEffect(() => {
        socketBuzzer.emit('buzzer:getFilters', (response) => {
            if (response.success) {
                setCountries(response.countries);
                setEvents(response.events);

                // Filtre par défaut seulement si gameState n'en a pas
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // Filtre par défaut seulement si aucun n'est déjà défini
        if (!selectedFilter) {
            if (selectedMode === MODES.COUNTRY && countries.length > 0) {
                setSelectedFilter(countries[0]);
            } else if (selectedMode === MODES.EVENT && events.length > 0) {
                setSelectedFilter(events[0]);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMode, countries, events]);

    // Nombre maximum de beatboxers disponibles pour le filtre choisi
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMode, selectedFilter]);

    useEffect(() => () => {
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    }, []);

    const handleStartWithCountdown = () => {
        socketBuzzer.emit('buzzer:startGame', { roomCode }, (response) => {
            if (!response.success) {
                alert('Erreur: ' + response.error);
            }
        });
    };

    const handleKickPlayer = (player) => {
        if (!window.confirm(st('buzzerLobby.kickConfirm', { name: player.username }))) {
            return;
        }

        socketBuzzer.emit('buzzer:kickPlayer', {
            roomCode,
            targetPlayerId: player.id
        }, (response) => {
            if (!response.success) {
                alert('Erreur: ' + response.error);
            }
        });
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

    const flashCopyState = (state) => {
        setCopyState(state);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopyState(null), 2000);
    };

    const shareLink = `${window.location.origin}/#/buzzer-battle?room=${roomCode}`;

    const handleCopyCode = async () => {
        flashCopyState((await copyToClipboard(roomCode)) ? 'code' : 'error');
    };

    const handleShareLink = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: 'BeatBox Games', text: `Buzzer Battle : ${roomCode}`, url: shareLink });
                return;
            } catch (error) {
                if (error?.name === 'AbortError') return;
            }
        }
        flashCopyState((await copyToClipboard(shareLink)) ? 'link' : 'error');
    };

    const playerList = Array.isArray(players) ? players.filter(Boolean) : [];
    const creatorId = gameState?.creatorId;
    const currentFilters = selectedMode === MODES.COUNTRY ? countries : events;
    const configMode = gameState?.mode || selectedMode;
    const configFilter = gameState?.filter || selectedFilter;
    const configLabel = configFilter
        ? st(configMode === MODES.COUNTRY ? 'buzzerLobby.byCountry' : 'buzzerLobby.byEvent', { filter: configFilter })
        : null;
    const kickablePlayers = playerList.filter((player) => player.id !== creatorId);
    const roundsMax = Math.max(MIN_ROUNDS, maxAvailableRounds);

    const hint = isCreator
        ? (playerList.length < 1 ? st('buzzerLobby.needPlayers') : st('buzzerLobby.hostHint'))
        : st('buzzerLobby.waitingCreator');

    return (
        <GameShell
            title={st('buzzer.name')}
            onQuit={onQuit}
            quitLabel={st('common.quit')}
            tools={languageSwitch}
            actionBar={
                <div className="flex flex-col gap-2">
                    {isCreator && (
                        <ShowButton size="lg" block onClick={handleStartWithCountdown} disabled={playerList.length < 1}>
                            {st('buzzerLobby.start')}
                        </ShowButton>
                    )}
                    <p className="text-center text-xs text-show-muted" aria-live="polite">{hint}</p>
                </div>
            }
        >
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <section className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <div className="flex-1 rounded-xl bg-show-yellow px-4 py-3 text-center text-show-night">
                        <div className="text-xs font-extrabold">{st('lobby.roomCode')}</div>
                        <div className="font-brand text-4xl leading-tight tracking-[0.08em] sm:text-5xl">{roomCode}</div>
                    </div>
                    <div className="flex gap-2 sm:w-48 sm:flex-col">
                        <ShowButton variant="outline" size="sm" block onClick={handleCopyCode}>
                            <Icon name={copyState === 'code' ? 'check' : 'copy'} size={16} />
                            {copyState === 'code' ? st('lobby.codeCopied') : st('lobby.copyCode')}
                        </ShowButton>
                        <ShowButton variant="outline" size="sm" block onClick={handleShareLink}>
                            <Icon name={copyState === 'link' ? 'check' : 'link'} size={16} />
                            {copyState === 'link' ? st('lobby.linkCopied') : st('lobby.shareLink')}
                        </ShowButton>
                    </div>
                </section>
                {copyState === 'error' && (
                    <p role="alert" className="-mt-3 text-center text-sm font-semibold text-show-yellow">{st('lobby.copyFailed')}</p>
                )}

                <div className="flex flex-wrap items-center justify-center gap-2">
                    {configLabel && <StatusPill>{configLabel}</StatusPill>}
                    <StatusPill>{st('buzzerLobby.rounds', { count: gameState?.totalRounds || totalRounds })}</StatusPill>
                    {isCreator && (
                        <button
                            type="button"
                            onClick={() => setShowSettings(true)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-show-white px-3 py-1 text-xs font-extrabold text-show-night hover:brightness-95"
                        >
                            <Icon name="settings" size={14} />
                            {st('lobby.settings')}
                        </button>
                    )}
                </div>

                <section aria-labelledby="buzzer-lobby-players-title">
                    <div className="mb-4 flex items-baseline justify-between gap-4">
                        <h2 id="buzzer-lobby-players-title" className="font-brand text-lg leading-none">
                            {st('lobby.players', { count: playerList.length, max: MAX_PLAYERS })}
                        </h2>
                        <button
                            type="button"
                            onClick={() => setShowRules(true)}
                            className="text-sm font-semibold text-show-muted underline decoration-show-yellow decoration-2 underline-offset-4 hover:text-show-white"
                        >
                            {st('common.howToPlay')}
                        </button>
                    </div>

                    <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-5">
                        {playerList.map((player, index) => {
                            const offline = player.connected === false;
                            return (
                                <li key={player.id || index}>
                                    <Lectern
                                        name={player.username}
                                        caption={offline ? st('common.offline') : undefined}
                                        lamp={offline ? 'idle' : 'ready'}
                                        host={Boolean(creatorId) && player.id === creatorId}
                                        hostLabel={st('common.host')}
                                        dimmed={offline}
                                        baseClassName="min-h-[2.25rem]"
                                    />
                                </li>
                            );
                        })}
                    </ul>
                </section>
            </div>

            {isCreator && (
                <ShowModal
                    open={showSettings}
                    onClose={() => setShowSettings(false)}
                    title={st('buzzerSettings.title')}
                    closeLabel={st('common.close')}
                    footer={
                        <div className="flex gap-2">
                            <ShowButton variant="outline" size="md" block onClick={() => setShowSettings(false)}>
                                {st('common.cancel')}
                            </ShowButton>
                            <ShowButton size="md" block onClick={handleSaveConfig} disabled={!selectedFilter}>
                                {st('buzzerSettings.save')}
                            </ShowButton>
                        </div>
                    }
                >
                    <div className="flex flex-col gap-6">
                        <fieldset>
                            <legend className="mb-2 text-sm font-extrabold">{st('buzzerSettings.mode')}</legend>
                            <div className="grid grid-cols-2 gap-1 rounded-full bg-show-night p-1">
                                {[
                                    { id: MODES.COUNTRY, key: 'buzzerSettings.modeCountry' },
                                    { id: MODES.EVENT, key: 'buzzerSettings.modeEvent' },
                                ].map((mode) => {
                                    const active = selectedMode === mode.id;
                                    return (
                                        <label
                                            key={mode.id}
                                            className={`cursor-pointer rounded-full px-3 py-2 text-center text-sm font-extrabold transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-show-yellow ${active ? 'bg-show-yellow text-show-night' : 'text-show-muted hover:text-show-white'}`}
                                        >
                                            <input
                                                type="radio"
                                                name="buzzer-mode"
                                                value={mode.id}
                                                checked={active}
                                                onChange={() => {
                                                    setSelectedMode(mode.id);
                                                    setSelectedFilter('');
                                                }}
                                                className="sr-only"
                                            />
                                            {st(mode.key)}
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>

                        <div>
                            <label htmlFor={filterId} className="mb-2 block text-sm font-extrabold">
                                {st(selectedMode === MODES.COUNTRY ? 'buzzerSettings.filterCountry' : 'buzzerSettings.filterEvent')}
                            </label>
                            <div className="relative">
                                <select
                                    id={filterId}
                                    value={selectedFilter || ''}
                                    onChange={(event) => setSelectedFilter(event.target.value)}
                                    disabled={loadingFilters || currentFilters.length === 0}
                                    className="w-full appearance-none rounded-full bg-show-white py-3 pl-4 pr-10 text-base font-semibold text-show-night focus:outline-none focus-visible:ring-4 focus-visible:ring-show-yellow disabled:opacity-60"
                                >
                                    {loadingFilters && <option value="">{st('buzzerSettings.loadingFilters')}</option>}
                                    {!loadingFilters && !selectedFilter && <option value="" disabled>—</option>}
                                    {currentFilters.map((filter) => (
                                        <option key={filter} value={filter}>{filter}</option>
                                    ))}
                                </select>
                                <Icon name="chevron-down" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-show-night" />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-baseline justify-between">
                                <label htmlFor={roundsId} className="text-sm font-extrabold">{st('buzzerSettings.rounds')}</label>
                                <span className="font-brand text-2xl text-show-yellow">{totalRounds}</span>
                            </div>
                            <input
                                id={roundsId}
                                type="range"
                                min={MIN_ROUNDS}
                                max={roundsMax}
                                step="1"
                                value={totalRounds}
                                onChange={(event) => setTotalRounds(parseInt(event.target.value, 10))}
                                className="mt-2 w-full accent-show-yellow"
                            />
                            <p className="mt-1 text-xs text-show-muted">{st('buzzerSettings.roundsHelp', { max: roundsMax })}</p>
                        </div>

                        {kickablePlayers.length > 0 && (
                            <div>
                                <h3 className="text-sm font-extrabold">{st('settings.players')}</h3>
                                <ul className="mt-2 flex flex-col divide-y divide-show-desk">
                                    {kickablePlayers.map((player) => (
                                        <li key={player.id} className="flex items-center gap-2 py-2.5">
                                            <span className={`min-w-0 flex-1 truncate font-semibold ${player.connected === false ? 'text-show-muted' : ''}`}>
                                                {player.username}
                                            </span>
                                            <ShowButton
                                                variant="buzz"
                                                size="sm"
                                                aria-label={st('settings.kickLabel', { name: player.username })}
                                                onClick={() => handleKickPlayer(player)}
                                            >
                                                <Icon name="close" size={14} />
                                                <span className="hidden sm:inline">{st('settings.kick')}</span>
                                            </ShowButton>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </ShowModal>
            )}

            <BuzzerRulesModal open={showRules} onClose={() => setShowRules(false)} st={st} />

            {showCountdown && <CountdownOverlay countdown={countdownValue > 0 ? String(countdownValue) : 'Go!'} />}
        </GameShell>
    );
}

export default BuzzerLobbyView;