import React, { useCallback, useEffect, useRef, useState } from 'react';
import socketBuzzer from '../../buzzer-socket';
import GameShell from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import ShowModal from '../show/ShowModal';
import Lectern from '../show/Lectern';
import { LecternRow } from '../show/GameHud';
import { RoomPanel, RulesBrief, SettingsSummary, StatusScreen, useRoomSharing } from '../show/LobbyParts';
import { CountdownOverlay } from '../UI';
import BuzzerRulesModal from './BuzzerRulesModal';
import BuzzerSettingsModal, { BUZZER_MODES as MODES, poolKey } from './BuzzerSettingsModal';
import { createShowT, MAX_PLAYERS } from '../../utils/showI18n';

const MIN_SEATS = 4;

const discordAvatar = (player) => (player?.isDiscordUser && player?.discordId && player?.discordAvatar
    ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=64`
    : undefined);

// Salle d'attente du Buzzer Battle : pupitres à gauche, panneau de la salle à droite
function BuzzerLobbyView({
    roomCode,
    players,
    isCreator,
    gameState,
    onStartGame,
    language,
    languageSwitch,
    onQuit,
    onError
}) {
    const st = createShowT(language);

    const [showSettings, setShowSettings] = useState(false);
    const [showRules, setShowRules] = useState(false);
    const [showCountdown, setShowCountdown] = useState(false);
    const [countdownValue, setCountdownValue] = useState(3);
    const [kickTarget, setKickTarget] = useState(null);

    // Filtres disponibles
    const [countries, setCountries] = useState([]);
    const [events, setEvents] = useState([]);
    const [loadingFilters, setLoadingFilters] = useState(true);

    // Noms des beatboxers par mode|filtre (jamais les photos, pour ne rien dévoiler)
    const [pools, setPools] = useState({});
    const requestedPools = useRef(new Set());

    const config = {
        mode: gameState?.mode || MODES.EVENT,
        filter: gameState?.filter || '',
        totalRounds: gameState?.totalRounds || 10,
        excluded: gameState?.excludedBeatboxers || [],
    };

    const shareLink = `${window.location.origin}/#/buzzer-battle?room=${roomCode}`;
    const sharing = useRoomSharing({ roomCode, shareLink, shareText: `Buzzer Battle : ${roomCode}` });

    const reportError = (message) => {
        if (onError) onError(message);
        else console.error(message);
    };

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
            }
            setLoadingFilters(false);
        });
    }, []);

    const requestPool = useCallback((mode, filter) => {
        const key = poolKey(mode, filter);
        if (requestedPools.current.has(key)) return;
        requestedPools.current.add(key);
        setPools((current) => ({ ...current, [key]: { status: 'loading', names: [] } }));

        socketBuzzer.emit('buzzer:getMaxBeatboxers', { mode, filter }, (response) => {
            if (response?.success && Array.isArray(response.names)) {
                setPools((current) => ({ ...current, [key]: { status: 'ready', names: response.names } }));
            } else {
                requestedPools.current.delete(key);
                setPools((current) => ({ ...current, [key]: { status: 'error', names: [] } }));
            }
        });
    }, []);

    // Liste de la configuration en vigueur, pour le résumé de la salle
    useEffect(() => {
        if (config.filter) requestPool(config.mode, config.filter);
    }, [config.mode, config.filter, requestPool]);

    const handleStartWithCountdown = () => {
        socketBuzzer.emit('buzzer:startGame', { roomCode }, (response) => {
            if (!response.success) {
                reportError(response.error);
            }
        });
    };

    const confirmKickPlayer = () => {
        const player = kickTarget;
        setKickTarget(null);
        if (!player) return;

        socketBuzzer.emit('buzzer:kickPlayer', {
            roomCode,
            targetPlayerId: player.id
        }, (response) => {
            if (!response.success) {
                reportError(response.error);
            }
        });
    };

    const handleSaveConfig = (draft) => new Promise((resolve, reject) => {
        socketBuzzer.timeout(5000).emit('buzzer:updateConfig', { roomCode, ...draft }, (error, response) => {
            if (error) reject(new Error(st('settings.saveError')));
            else if (response?.success) resolve(response);
            else reject(new Error(response?.error || st('settings.saveError')));
        });
    });

    const playerList = Array.isArray(players) ? players.filter(Boolean) : [];
    const creatorId = gameState?.creatorId;
    const kickablePlayers = playerList.filter((player) => player.id !== creatorId);
    const configPool = config.filter ? pools[poolKey(config.mode, config.filter)] : null;
    const configExcluded = new Set(config.excluded);
    const configSelected = configPool?.status === 'ready'
        ? configPool.names.filter((name) => !configExcluded.has(name)).length
        : null;
    const emptySeats = Math.max(0, Math.min(MAX_PLAYERS, Math.max(MIN_SEATS, playerList.length + 1)) - playerList.length);

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
            <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
                <section aria-labelledby="buzzer-lobby-players-title" className="order-2 lg:order-1">
                    <div className="mb-6">
                        <h2 id="buzzer-lobby-players-title" className="font-brand text-xl leading-none sm:text-2xl">
                            {st('lobby.players', { count: playerList.length, max: MAX_PLAYERS })}
                        </h2>
                    </div>

                    <LecternRow className="grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" label={st('lobby.players', { count: playerList.length, max: MAX_PLAYERS })}>
                        {playerList.map((player, index) => {
                            const offline = player.connected === false;
                            return (
                                <li key={player.id || index}>
                                    <Lectern
                                        name={player.username}
                                        screen={
                                            <StatusScreen
                                                state={offline ? 'offline' : 'ready'}
                                                label={offline ? st('lobby.statusOffline') : st('buzzerLobby.statusOnline')}
                                            />
                                        }
                                        lamp={offline ? 'idle' : 'ready'}
                                        host={Boolean(creatorId) && player.id === creatorId}
                                        hostLabel={st('common.host')}
                                        avatarUrl={discordAvatar(player)}
                                        dimmed={offline}
                                    />
                                </li>
                            );
                        })}
                        {Array.from({ length: emptySeats }, (_, index) => (
                            <li key={`seat-${index}`}>
                                <Lectern
                                    empty
                                    emptyLabel={index === 0 ? st('lobby.inviteSeat') : st('lobby.emptySeat')}
                                    onEmptyClick={sharing.shareRoom}
                                />
                            </li>
                        ))}
                    </LecternRow>
                </section>

                <div className="order-1 lg:order-2">
                    <RoomPanel
                        codeLabel={st('lobby.roomCode')}
                        roomCode={roomCode}
                        sharing={sharing}
                        labels={{
                            copyCode: st('lobby.copyCode'),
                            codeCopied: st('lobby.codeCopied'),
                            shareLink: st('lobby.shareLink'),
                            linkCopied: st('lobby.linkCopied'),
                            copyFailed: st('lobby.copyFailed'),
                        }}
                    >
                        <SettingsSummary
                            title={st('lobby.settingsTitle')}
                            editLabel={st('lobby.edit')}
                            onEdit={isCreator ? () => setShowSettings(true) : undefined}
                            rows={[
                                {
                                    label: st('buzzerLobby.selectionLabel'),
                                    value: config.filter
                                        ? st(config.mode === MODES.COUNTRY ? 'buzzerLobby.byCountry' : 'buzzerLobby.byEvent', { filter: config.filter })
                                        : '—',
                                },
                                ...(configSelected !== null ? [{
                                    label: st('buzzerLobby.beatboxersLabel'),
                                    value: st('lobby.selectionValue', { count: configSelected, total: configPool.names.length }),
                                }] : []),
                                { label: st('buzzerLobby.roundsLabel'), value: config.totalRounds },
                            ]}
                        />
                        <div className="hidden lg:block">
                            <RulesBrief
                                title={st('lobby.rulesTitle')}
                                rules={[st('buzzerLobby.rule1'), st('buzzerLobby.rule2'), st('buzzerLobby.rule3')]}
                                moreLabel={st('lobby.allRules')}
                                onMore={() => setShowRules(true)}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowRules(true)}
                            className="text-left text-xs font-extrabold text-show-muted underline decoration-show-yellow decoration-2 underline-offset-4 hover:text-show-white lg:hidden"
                        >
                            {st('common.howToPlay')}
                        </button>
                    </RoomPanel>
                </div>
            </div>

            {isCreator && (
                <BuzzerSettingsModal
                    open={showSettings}
                    onClose={() => setShowSettings(false)}
                    st={st}
                    config={config}
                    countries={countries}
                    events={events}
                    loadingFilters={loadingFilters}
                    pools={pools}
                    requestPool={requestPool}
                    kickablePlayers={kickablePlayers}
                    onKick={(player) => {
                        setShowSettings(false);
                        setKickTarget(player);
                    }}
                    onSave={handleSaveConfig}
                />
            )}

            <BuzzerRulesModal open={showRules} onClose={() => setShowRules(false)} st={st} />

            <ShowModal
                open={Boolean(kickTarget)}
                onClose={() => setKickTarget(null)}
                title={kickTarget ? st('buzzerLobby.kickConfirm', { name: kickTarget.username }) : ''}
                closeLabel={st('common.close')}
                footer={
                    <div className="flex gap-2">
                        <ShowButton variant="outline" size="md" block onClick={() => setKickTarget(null)}>
                            {st('common.cancel')}
                        </ShowButton>
                        <ShowButton variant="buzz" size="md" block onClick={confirmKickPlayer}>
                            {st('settings.kick')}
                        </ShowButton>
                    </div>
                }
            />

            <CountdownOverlay countdown={showCountdown ? (countdownValue > 0 ? String(countdownValue) : 'Go!') : null} />
        </GameShell>
    );
}

export default BuzzerLobbyView;