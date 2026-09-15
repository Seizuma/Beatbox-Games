import React, { useId, useState } from 'react';
import GameShell from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import ShowModal from '../show/ShowModal';
import Lectern from '../show/Lectern';
import { LecternRow } from '../show/GameHud';
import { RoomPanel, RulesBrief, SettingsSummary, StatusScreen, useRoomSharing } from '../show/LobbyParts';
import Icon from '../icons/Icon';
import BlindTestRulesModal from './BlindTestRulesModal';
import { createShowT, MAX_PLAYERS } from '../../utils/showI18n';

// Nombre de pupitres affichés au minimum, les places vides invitent à partager la salle
const MIN_SEATS = 4;

// Salle d'attente du Blind Test : pupitres des joueurs à gauche, panneau de la salle à droite
const LobbyView = ({
    room,
    pseudo,
    isCreator,
    creatorPseudo,
    players,
    isReady,
    editingPseudo,
    newPseudo,
    showSettings,
    localArtistCount,
    localAnswerTime,
    artistCountRange,
    answerTimeSettings,
    shareLink,
    socketMethods,
    setEditingPseudo,
    setNewPseudo,
    setShowSettings,
    setLocalArtistCount,
    setLocalAnswerTime,
    handleChangePseudo,
    handleToggleReady,
    handleStartGame,
    handleKickPlayer,
    handleTransferHost,
    LanguageSwitch,
    GameModeBadge,
    language,
    onBackToHub,
    forceEnableAudio,
    needsAudioUnlock
}) => {
    const st = createShowT(language);
    const newNameId = useId();
    const [showRules, setShowRules] = useState(false);

    const sharing = useRoomSharing({ roomCode: room, shareLink, shareText: st('lobby.shareText', { room }) });

    const playerList = Array.isArray(players) ? players.filter(Boolean) : [];
    const playerCount = playerList.length;
    const readyCount = playerList.filter((player) => player.ready).length;
    const allPlayersReady = playerCount >= 1 && readyCount === playerCount;
    const currentPlayer = playerList.find((player) => player.pseudo === pseudo);
    const canEditPseudo = !(currentPlayer?.isDiscordUser && currentPlayer?.discordId);
    const otherPlayers = playerList.filter((player) => player.pseudo !== pseudo);
    const emptySeats = Math.max(0, Math.min(MAX_PLAYERS, Math.max(MIN_SEATS, playerCount + 1)) - playerCount);

    const artistMin = artistCountRange?.min || 10;
    const artistMax = artistCountRange?.max || 50;
    const timeMin = answerTimeSettings?.min || 5;
    const timeMax = answerTimeSettings?.max || 60;

    const canStart = isCreator && allPlayersReady;

    const handleStart = () => {
        // Débloque l'audio sur iOS/Safari grâce au geste de l'utilisateur
        if (needsAudioUnlock && forceEnableAudio) {
            forceEnableAudio();
        }
        handleStartGame();
    };

    const statusHint = allPlayersReady
        ? (isCreator ? st('lobby.hostHint') : st('lobby.waitingHost', { host: creatorPseudo }))
        : st('lobby.notAllReady');

    const playerStatus = (player) => {
        if (!player.connected) return 'offline';
        return player.ready ? 'ready' : 'waiting';
    };

    const statusLabel = {
        ready: st('lobby.statusReady'),
        waiting: st('lobby.statusWaiting'),
        offline: st('lobby.statusOffline'),
    };

    return (
        <GameShell
            title={st('blindtest.name')}
            onQuit={onBackToHub}
            quitLabel={st('common.quit')}
            tools={LanguageSwitch ? <LanguageSwitch /> : null}
            actionBar={
                <div className="flex flex-col gap-2">
                    {canStart && (
                        <ShowButton size="lg" block onClick={handleStart}>
                            {st('lobby.start')}
                        </ShowButton>
                    )}
                    <ShowButton
                        size={canStart ? 'md' : 'lg'}
                        block
                        variant={isReady || canStart ? 'outline' : 'yellow'}
                        onClick={handleToggleReady}
                    >
                        {isReady ? st('lobby.unsetReady') : st('lobby.setReady')}
                    </ShowButton>
                    <p className="text-center text-xs text-show-muted" aria-live="polite">{statusHint}</p>
                </div>
            }
        >
            <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
                <section aria-labelledby="lobby-players-title" className="order-2 lg:order-1">
                    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h2 id="lobby-players-title" className="font-brand text-xl leading-none sm:text-2xl">
                            {st('lobby.players', { count: playerCount, max: MAX_PLAYERS })}
                        </h2>
                        <p className="text-sm font-extrabold text-show-muted">
                            {st('lobby.readyCount', { ready: readyCount, total: playerCount })}
                        </p>
                    </div>

                    <LecternRow className="grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" label={st('lobby.players', { count: playerCount, max: MAX_PLAYERS })}>
                        {playerList.map((player) => {
                            const status = playerStatus(player);
                            const isMe = player.pseudo === pseudo;
                            return (
                                <li key={player.pseudo}>
                                    <Lectern
                                        name={player.pseudo}
                                        screen={<StatusScreen state={status} label={statusLabel[status]} />}
                                        lamp={status === 'ready' ? 'ready' : 'idle'}
                                        highlight={isMe}
                                        tag={isMe ? st('lobby.you') : undefined}
                                        host={player.pseudo === creatorPseudo}
                                        hostLabel={st('common.host')}
                                        avatarUrl={player.isDiscordUser ? player.avatarUrl : undefined}
                                        dimmed={status === 'offline'}
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

                    {canEditPseudo && (
                        <div className="mt-8">
                            {editingPseudo ? (
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        handleChangePseudo();
                                    }}
                                    className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-end"
                                >
                                    <div className="flex-1">
                                        <label htmlFor={newNameId} className="mb-1.5 block text-xs font-extrabold">{st('lobby.newNameLabel')}</label>
                                        <input
                                            id={newNameId}
                                            type="text"
                                            value={newPseudo}
                                            onChange={(event) => setNewPseudo(event.target.value)}
                                            maxLength={20}
                                            autoFocus
                                            onKeyDown={(event) => {
                                                if (event.key === 'Escape') {
                                                    setEditingPseudo(false);
                                                    setNewPseudo('');
                                                }
                                            }}
                                            className="w-full rounded-full bg-show-white px-4 py-2.5 text-base font-semibold text-show-night focus:outline-none focus-visible:ring-4 focus-visible:ring-show-yellow"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <ShowButton type="submit" size="md">{st('common.save')}</ShowButton>
                                        <ShowButton
                                            variant="outline"
                                            size="md"
                                            onClick={() => {
                                                setEditingPseudo(false);
                                                setNewPseudo('');
                                            }}
                                        >
                                            {st('common.cancel')}
                                        </ShowButton>
                                    </div>
                                </form>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingPseudo(true);
                                        setNewPseudo(pseudo);
                                    }}
                                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-show-muted underline decoration-show-desk decoration-2 underline-offset-4 hover:text-show-white"
                                >
                                    <Icon name="user" size={15} />
                                    {st('lobby.editName')}
                                </button>
                            )}
                        </div>
                    )}
                </section>

                <div className="order-1 lg:order-2">
                    <RoomPanel
                        codeLabel={st('lobby.roomCode')}
                        roomCode={room}
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
                                { label: st('lobby.artistsLabel'), value: localArtistCount },
                                { label: st('lobby.timeLabel'), value: st('lobby.seconds', { seconds: localAnswerTime }) },
                                ...(GameModeBadge ? [{ label: st('lobby.modeLabel'), value: <GameModeBadge /> }] : []),
                            ]}
                        />
                        <div className="hidden lg:block">
                            <RulesBrief
                                title={st('lobby.rulesTitle')}
                                rules={[st('lobby.rule1'), st('lobby.rule2'), st('lobby.rule3')]}
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
                <ShowModal
                    open={showSettings}
                    onClose={() => setShowSettings(false)}
                    title={st('settings.title')}
                    closeLabel={st('common.close')}
                >
                    <div className="flex flex-col gap-6">
                        <div>
                            <div className="flex items-baseline justify-between">
                                <label htmlFor="lobby-artist-count" className="text-sm font-extrabold">{st('settings.artistCount')}</label>
                                <span className="font-brand text-2xl text-show-yellow">{localArtistCount}</span>
                            </div>
                            <input
                                id="lobby-artist-count"
                                type="range"
                                min={artistMin}
                                max={artistMax}
                                value={localArtistCount}
                                onChange={(event) => {
                                    const value = parseInt(event.target.value, 10);
                                    setLocalArtistCount(value);
                                    socketMethods.updateArtistCount(value);
                                }}
                                className="mt-2 w-full accent-show-yellow"
                            />
                            <p className="mt-1 text-xs text-show-muted">{st('settings.artistHelp', { min: artistMin, max: artistMax })}</p>
                        </div>

                        <div>
                            <div className="flex items-baseline justify-between">
                                <label htmlFor="lobby-answer-time" className="text-sm font-extrabold">{st('settings.answerTime')}</label>
                                <span className="font-brand text-2xl text-show-yellow">{localAnswerTime} s</span>
                            </div>
                            <input
                                id="lobby-answer-time"
                                type="range"
                                min={timeMin}
                                max={timeMax}
                                value={localAnswerTime}
                                onChange={(event) => {
                                    const value = parseInt(event.target.value, 10);
                                    setLocalAnswerTime(value);
                                    socketMethods.updateAnswerTime(value);
                                }}
                                className="mt-2 w-full accent-show-yellow"
                            />
                            <p className="mt-1 text-xs text-show-muted">{st('settings.answerHelp', { min: timeMin, max: timeMax })}</p>
                        </div>

                        <div>
                            <h3 className="text-sm font-extrabold">{st('settings.players')}</h3>
                            {otherPlayers.length === 0 ? (
                                <p className="mt-2 text-sm text-show-muted">{st('settings.noOthers')}</p>
                            ) : (
                                <ul className="mt-2 flex flex-col divide-y divide-show-desk">
                                    {otherPlayers.map((player) => (
                                        <li key={player.pseudo} className="flex items-center gap-2 py-2.5">
                                            <span className={`min-w-0 flex-1 truncate font-semibold ${player.connected ? '' : 'text-show-muted'}`}>
                                                {player.pseudo}
                                            </span>
                                            <ShowButton
                                                variant="white"
                                                size="sm"
                                                aria-label={st('settings.makeHostLabel', { name: player.pseudo })}
                                                onClick={() => handleTransferHost(player.pseudo)}
                                            >
                                                <Icon name="crown" size={14} />
                                                <span className="hidden sm:inline">{st('settings.makeHost')}</span>
                                            </ShowButton>
                                            <ShowButton
                                                variant="buzz"
                                                size="sm"
                                                aria-label={st('settings.kickLabel', { name: player.pseudo })}
                                                onClick={() => handleKickPlayer(player.pseudo)}
                                            >
                                                <Icon name="close" size={14} />
                                                <span className="hidden sm:inline">{st('settings.kick')}</span>
                                            </ShowButton>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </ShowModal>
            )}

            <BlindTestRulesModal open={showRules} onClose={() => setShowRules(false)} st={st} />
        </GameShell>
    );
};

export default LobbyView;