import React, { useState } from 'react';
import CharacterPicker from './CharacterPicker';
import PartyScene, { VIEWS, scenePoint } from './board/PartyScene';
import { useNarrow } from './PartyHome';
import { PLAYER_COLORS } from './characters/pixelRig';
import { Key, Lcd, LcdText, Panel, PlayerRing, Section } from './ui/Hardware';
import { copyToClipboard } from '../../utils/clipboard';

const MAX = 4;
// Places sur les gros pads de piste 2 à 5, de gauche à droite
export const SEATS = [[755, 1008], [1000, 1008], [1245, 1008], [1490, 1008]];

// Salon : les joueurs montent sur scène, choix du personnage, réglages de l'hôte
export default function PartyLobby({ board, state, myId, t, language, onCharacter, onAddBot, onRemoveBot, onSettings, onStart }) {
    const [copied, setCopied] = useState(false);
    const narrow = useNarrow();
    const view = narrow ? VIEWS.lobbyNarrow : VIEWS.lobby;
    const me = state.players.find((p) => p.id === myId);
    const isHost = state.hostId === myId;
    const link = `${window.location.origin}/beatbox-party?room=${state.code}`;
    const takenBy = {};
    state.players.forEach((p) => {
        if (p.id !== myId && !p.isBot) takenBy[p.characterId] = p.name;
    });

    const copy = async () => {
        if (await copyToClipboard(link)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const seats = Array.from({ length: MAX }, (_, seat) => state.players.find((p) => p.seat === seat) || null);
    const actors = seats.map((p, seat) => p && {
        id: p.characterId,
        pose: p.id === myId ? 'beatbox' : p.isBot ? 'idle' : 'dance',
        color: PLAYER_COLORS[seat],
        x: SEATS[seat][0],
        y: SEATS[seat][1],
        facing: seat < 2 ? 1 : -1,
        dim: !p.isBot && !p.connected,
    }).filter(Boolean);

    return (
        <div className="flex flex-col gap-6">
            <Panel className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
                    <div className="flex flex-col gap-2">
                        <span className="hw-label">{t('lobby.room')}</span>
                        <Lcd className="inline-flex px-3 py-2"><LcdText text={state.code} font="bold" scale={4} /></Lcd>
                    </div>
                    <Key size="md" led="green" ledOn={copied} onClick={copy}>
                        {copied ? t('lobby.copied') : t('lobby.copy')}
                    </Key>
                </div>
                <div className="party-scene-bezel">
                    <PartyScene board={board} view={view} actors={actors}>
                        {seats.map((p, seat) => (
                            <span key={seat} className="party-scene-label" style={{ ...scenePoint(view, SEATS[seat][0], SEATS[seat][1] + 70), '--tag': p ? PLAYER_COLORS[seat] : undefined }}>
                                {p ? p.name : t('lobby.empty')}
                            </span>
                        ))}
                    </PartyScene>
                </div>
                <div aria-label={t('lobby.players')} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {seats.map((p, seat) => (
                        <div key={seat} className="hw-strip min-h-[4.2rem]">
                            <PlayerRing player={p} color={PLAYER_COLORS[seat]} size={46} active={Boolean(p && p.id === myId)} dim={!p || (!p.isBot && !p.connected)} />
                            <div className="min-w-0 flex-1">
                                <p className="hw-label !text-[0.62rem]">{`Track ${seat + 1}`}</p>
                                {p ? (
                                    <>
                                        <p className="hw-strip-name">{p.name}</p>
                                        <p className="flex flex-wrap gap-x-2 text-[0.72rem] font-semibold text-[color:var(--hw-silk-dim)]">
                                            {p.id === myId && <span className="text-[color:var(--hw-amber)]">{t('lobby.you')}</span>}
                                            {p.id === state.hostId && <span>{t('lobby.host')}</span>}
                                            {p.isBot && <span>{t('lobby.bot')}</span>}
                                            {!p.isBot && !p.connected && <span className="text-[color:var(--hw-red)]">{t('lobby.offline')}</span>}
                                            {isHost && p.isBot && (
                                                <button type="button" className="underline underline-offset-2 hover:text-[color:var(--hw-silk)]" onClick={() => onRemoveBot(p.id)}>
                                                    {t('lobby.removeBot')}
                                                </button>
                                            )}
                                        </p>
                                    </>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-[color:var(--hw-silk-dim)]">{t('lobby.empty')}</span>
                                        {isHost && <Key size="sm" led="amber" onClick={onAddBot}>{t('lobby.addBot')}</Key>}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </Panel>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Panel className="p-5 pt-7 sm:p-6 sm:pt-8">
                    <Section title={t('lobby.character')}>
                        <CharacterPicker
                            value={me && me.characterId}
                            onChange={onCharacter}
                            takenBy={takenBy}
                            color={me ? PLAYER_COLORS[me.seat] : PLAYER_COLORS[0]}
                            t={t}
                            language={language}
                        />
                    </Section>
                </Panel>

                <div className="flex flex-col gap-6">
                    <Panel className="flex flex-col gap-5 p-5 pt-7 sm:p-6 sm:pt-8">
                        <Section title={t('lobby.board')}>
                            <p className="hw-strip-name !text-xl uppercase">{t('lobby.boardName')}</p>
                            <p className="hw-text mt-1 text-sm">{t('lobby.boardInfo')}</p>
                        </Section>
                        <Section title={t('lobby.turns')}>
                            <div role="radiogroup" aria-label={t('lobby.turns')} className="grid grid-cols-4 gap-2">
                                {(state.settings.turnOptions || [5, 10, 15, 20]).map((n) => (
                                    <Key
                                        key={n}
                                        size="md"
                                        role="radio"
                                        aria-label={t('lobby.turnsValue', { n })}
                                        aria-checked={state.settings.turns === n}
                                        led="amber"
                                        ledOn={state.settings.turns === n}
                                        disabled={!isHost}
                                        className="!flex-col !gap-1 !px-1 disabled:!opacity-80"
                                        onClick={() => onSettings({ turns: n })}
                                    >
                                        {n}
                                    </Key>
                                ))}
                            </div>
                        </Section>
                        {isHost ? (
                            <>
                                <Key size="lg" led="red" className="w-full" onClick={onStart}>{t('lobby.start')}</Key>
                                {state.players.length < MAX && <p className="hw-text text-sm">{t('lobby.fillBots')}</p>}
                            </>
                        ) : (
                            <p className="hw-label hw-blink !text-sm">{t('lobby.waitingHost')}</p>
                        )}
                    </Panel>

                    <Panel className="p-5 pt-7 sm:p-6 sm:pt-8">
                        <Section title={t('lobby.rules')}>
                            <ol className="flex flex-col gap-2.5">
                                {[1, 2, 3, 4, 5].map((n) => (
                                    <li key={n} className="flex gap-3">
                                        <Lcd className="flex h-7 w-7 shrink-0 items-center justify-center"><LcdText text={n} font="bold" scale={1.5} /></Lcd>
                                        <span className="hw-text text-[0.95rem]">{t(`lobby.rule${n}`)}</span>
                                    </li>
                                ))}
                            </ol>
                        </Section>
                    </Panel>
                </div>
            </div>
        </div>
    );
}
