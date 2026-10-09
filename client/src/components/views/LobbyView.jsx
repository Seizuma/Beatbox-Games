import React, { useId, useState } from 'react';
import GameShell from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import Lectern from '../show/Lectern';
import { LecternRow } from '../show/GameHud';
import { RoomPanel, RulesBrief, SettingsSummary, StatusScreen, useRoomSharing } from '../show/LobbyParts';
import Icon from '../icons/Icon';
import BlindTestRulesModal from './BlindTestRulesModal';
import BlindTestSettingsModal from './BlindTestSettingsModal';
import { PublicRoomBanner } from '../show/PublicPlay';
import { createShowT, MAX_PLAYERS } from '../../utils/showI18n';

// Nombre de pupitres affichés au minimum, les places vides invitent à partager la salle
const MIN_SEATS = 4;

// Salle d'attente du Blind Test : pupitres des joueurs à gauche, panneau de la salle à droite
const LobbyView = ({
    publicInfo,
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
    artistPool,
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
    // L'hôte est prêt d'office : il ne se déclare pas prêt, il lance
    const isPlayerReady = (player) => Boolean(player.ready) || player.pseudo === creatorPseudo;
    const connectedPlayers = playerList.filter((player) => player.connected !== false);
    const readyCount = playerList.filter(isPlayerReady).length;
    const notReadyCount = connectedPlayers.filter((player) => !isPlayerReady(player)).length;
    const allPlayersReady = connectedPlayers.length >= 1 && notReadyCount === 0;
    const currentPlayer = playerList.find((player) => player.pseudo === pseudo);
    const canEditPseudo = !(currentPlayer?.isDiscordUser && currentPlayer?.discordId);
    const otherPlayers = playerList.filter((player) => player.pseudo !== pseudo);
    const emptySeats = Math.max(0, Math.min(MAX_PLAYERS, Math.max(MIN_SEATS, playerCount + 1)) - playerCount);

    const canStart = isCreator && allPlayersReady;

    const handleStart = () => {
        // Débloque l'audio sur iOS/Safari grâce au geste de l'utilisateur
        if (needsAudioUnlock && forceEnableAudio) {
            forceEnableAudio();
        }
        handleStartGame();
    };

    const hostHint = () => {
        if (notReadyCount === 1) return st('lobby.hostWaitingOne');
        if (notReadyCount > 1) return st('lobby.hostWaitingMany', { count: notReadyCount });
        return connectedPlayers.length <= 1 ? st('lobby.hostSolo') : st('lobby.hostHint');
    };

    // Salle publique : personne n'a besoin d'être prêt, le compte à rebours lance la partie
    const statusHint = publicInfo?.isPublic
        ? st('public.hint')
        : isCreator
            ? hostHint()
            : (allPlayersReady ? st('lobby.waitingHost', { host: creatorPseudo }) : st('lobby.notAllReady'));

    const playerStatus = (player) => {
        if (!player.connected) return 'offline';
        return isPlayerReady(player) ? 'ready' : 'waiting';
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
                    {isCreator ? (
                        <ShowButton size="lg" block onClick={handleStart} disabled={!canStart}>
                            {st('lobby.start')}
                        </ShowButton>
                    ) : (
                        <ShowButton
                            size="lg"
                            block
                            variant={isReady ? 'outline' : 'yellow'}
                            onClick={handleToggleReady}
                        >
                            {isReady ? st('lobby.unsetReady') : st('lobby.setReady')}
                        </ShowButton>
                    )}
                    <p className="text-center text-xs text-show-muted" aria-live="polite">{statusHint}</p>
                </div>
            }
        >
            <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
                {publicInfo?.isPublic && (
                    <div className="order-1 lg:col-span-2">
                        <PublicRoomBanner isPublic autoStartAt={publicInfo.autoStartAt} st={st} />
                    </div>
                )}
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
                                { label: st('lobby.roundsLabel'), value: localArtistCount },
                                ...(artistPool?.total ? [{
                                    label: st('lobby.selectionLabel'),
                                    value: st('lobby.selectionValue', { count: artistPool.available, total: artistPool.total }),
                                }] : []),
                                { label: st('lobby.timeLabel'), value: st('lobby.seconds', { seconds: localAnswerTime }) },
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
                <BlindTestSettingsModal
                    open={showSettings}
                    onClose={() => setShowSettings(false)}
                    st={st}
                    artistCount={localArtistCount}
                    answerTime={localAnswerTime}
                    artistCountRange={artistCountRange}
                    answerTimeSettings={answerTimeSettings}
                    artistPool={artistPool}
                    otherPlayers={otherPlayers}
                    onSave={async (settings) => {
                        const result = await socketMethods.updateRoomSettings(settings);
                        setLocalArtistCount(result.artistCount);
                        setLocalAnswerTime(result.answerTime);
                    }}
                    onTransferHost={handleTransferHost}
                    onKickPlayer={handleKickPlayer}
                />
            )}

            <BlindTestRulesModal open={showRules} onClose={() => setShowRules(false)} st={st} />
        </GameShell>
    );
};

export default LobbyView;