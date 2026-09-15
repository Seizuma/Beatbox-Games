import React, { useEffect, useId, useRef, useState } from 'react';
import GameShell, { StatusPill } from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import ShowModal from '../show/ShowModal';
import Lectern from '../show/Lectern';
import Icon from '../icons/Icon';
import BlindTestRulesModal from './BlindTestRulesModal';
import { createShowT, MAX_PLAYERS } from '../../utils/showI18n';

const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.setAttribute('readonly', '');
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            const copied = document.execCommand('copy');
            document.body.removeChild(textArea);
            return copied;
        } catch (fallbackError) {
            return false;
        }
    }
};

// Salle d'attente : code à partager, pupitres des joueurs, réglages de l'hôte
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

    const [copyState, setCopyState] = useState(null);
    const [showRules, setShowRules] = useState(false);
    const copyTimeoutRef = useRef(null);

    useEffect(() => () => {
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    }, []);

    const playerList = Array.isArray(players) ? players.filter(Boolean) : [];
    const playerCount = playerList.length;
    const allPlayersReady = playerCount >= 1 && playerList.every((player) => player.ready);
    const currentPlayer = playerList.find((player) => player.pseudo === pseudo);
    const canEditPseudo = !(currentPlayer?.isDiscordUser && currentPlayer?.discordId);
    const otherPlayers = playerList.filter((player) => player.pseudo !== pseudo);

    const artistMin = artistCountRange?.min || 10;
    const artistMax = artistCountRange?.max || 50;
    const timeMin = answerTimeSettings?.min || 5;
    const timeMax = answerTimeSettings?.max || 60;

    const flashCopyState = (state) => {
        setCopyState(state);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopyState(null), 2000);
    };

    const handleCopyCode = async () => {
        if (!room) return;
        flashCopyState((await copyToClipboard(room)) ? 'code' : 'error');
    };

    const handleShareLink = async () => {
        if (!shareLink) return;
        if (navigator.share) {
            try {
                await navigator.share({ title: 'BeatBox Games', text: st('lobby.shareText', { room }), url: shareLink });
                return;
            } catch (error) {
                if (error?.name === 'AbortError') return;
            }
        }
        flashCopyState((await copyToClipboard(shareLink)) ? 'link' : 'error');
    };

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

    const canStart = isCreator && allPlayersReady;

    return (
        <GameShell
            title={st('blindtest.name')}
            onQuit={onBackToHub}
            quitLabel={st('common.quit')}
            status={GameModeBadge ? <GameModeBadge /> : null}
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
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <section className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <div className="flex-1 rounded-xl bg-show-yellow px-4 py-3 text-center text-show-night">
                        <div className="text-xs font-extrabold">{st('lobby.roomCode')}</div>
                        <div className="font-brand text-4xl leading-tight tracking-[0.08em] sm:text-5xl">{room}</div>
                    </div>
                    <div className="flex gap-2 sm:w-48 sm:flex-col">
                        <ShowButton variant="outline" size="sm" block onClick={handleCopyCode}>
                            <Icon name={copyState === 'code' ? 'check' : 'copy'} size={16} />
                            {copyState === 'code' ? st('lobby.codeCopied') : st('lobby.copyCode')}
                        </ShowButton>
                        <ShowButton variant="outline" size="sm" block onClick={handleShareLink} disabled={!shareLink}>
                            <Icon name={copyState === 'link' ? 'check' : 'link'} size={16} />
                            {copyState === 'link' ? st('lobby.linkCopied') : st('lobby.shareLink')}
                        </ShowButton>
                    </div>
                </section>
                {copyState === 'error' && (
                    <p role="alert" className="-mt-3 text-center text-sm font-semibold text-show-yellow">{st('lobby.copyFailed')}</p>
                )}

                <div className="flex flex-wrap items-center justify-center gap-2">
                    <StatusPill>{st('lobby.artists', { count: localArtistCount })}</StatusPill>
                    <StatusPill>{st('lobby.answerTime', { seconds: localAnswerTime })}</StatusPill>
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

                <section aria-labelledby="lobby-players-title">
                    <div className="mb-4 flex items-baseline justify-between gap-4">
                        <h2 id="lobby-players-title" className="font-brand text-lg leading-none">
                            {st('lobby.players', { count: playerCount, max: MAX_PLAYERS })}
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
                        {playerList.map((player) => {
                            const isMe = player.pseudo === pseudo;
                            const status = !player.connected
                                ? st('common.offline')
                                : player.ready ? st('lobby.ready') : st('lobby.waiting');
                            return (
                                <li key={player.pseudo}>
                                    <Lectern
                                        name={player.pseudo}
                                        caption={status}
                                        lamp={player.connected && player.ready ? 'ready' : 'idle'}
                                        highlight={isMe}
                                        host={player.pseudo === creatorPseudo}
                                        hostLabel={st('common.host')}
                                        dimmed={!player.connected}
                                    />
                                </li>
                            );
                        })}
                    </ul>

                    {canEditPseudo && (
                        <div className="mt-6">
                            {editingPseudo ? (
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        handleChangePseudo();
                                    }}
                                    className="flex flex-col gap-2 sm:flex-row sm:items-end"
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
                                    className="text-sm font-semibold text-show-muted underline decoration-show-desk decoration-2 underline-offset-4 hover:text-show-white"
                                >
                                    {st('lobby.editName')}
                                </button>
                            )}
                        </div>
                    )}
                </section>
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