import React, { useState } from 'react';
import CharacterPicker from './CharacterPicker';
import PartyScene, { VIEWS, scenePoint } from './board/PartyScene';
import { useNarrow } from './PartyHome';
import { PLAYER_COLORS } from './characters/pixelRig';
import { copyToClipboard } from '../../utils/clipboard';

const MAX = 4;
// Places sur la scène du micro géant, de gauche à droite
export const SEATS = [[704, 326], [772, 320], [840, 320], [908, 326]];

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
            <section className="party-panel overflow-hidden">
                <PartyScene board={board} view={view} actors={actors} stageColor={me ? PLAYER_COLORS[me.seat] : null}>
                    {seats.map((p, seat) => (
                        <span key={seat} className="party-scene-label" style={{ ...scenePoint(view, SEATS[seat][0], SEATS[seat][1] + 8), borderColor: p ? PLAYER_COLORS[seat] : undefined, color: p ? undefined : 'var(--px-muted)' }}>
                            {p ? p.name : t('lobby.empty')}
                        </span>
                    ))}
                    <div className="absolute left-3 top-3 z-[3] flex flex-col gap-1 sm:left-5 sm:top-5">
                        <span className="party-kicker">{t('lobby.room')}</span>
                        <span className="party-lcd party-lcd-digits px-3 py-1 text-3xl tracking-[0.2em] sm:text-4xl">{state.code}</span>
                    </div>
                    <div className="absolute right-3 top-3 z-[3] sm:right-5 sm:top-5">
                        <button type="button" className="party-btn party-btn-white" onClick={copy}>
                            {copied ? t('lobby.copied') : t('lobby.copy')}
                        </button>
                    </div>
                </PartyScene>
                <div aria-label={t('lobby.players')} className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 sm:p-4">
                    {seats.map((p, seat) => (
                        <div key={seat} className="flex min-h-[3.4rem] items-center gap-2 rounded-xl bg-[#0A0F27]/70 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" style={{ boxShadow: p && p.id === myId ? `inset 0 0 0 2px ${PLAYER_COLORS[seat]}` : undefined }}>
                            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p ? PLAYER_COLORS[seat] : '#2A3470', boxShadow: p ? `0 0 10px ${PLAYER_COLORS[seat]}` : 'none' }} aria-hidden="true" />
                            {p ? (
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-extrabold leading-tight">{p.name}</p>
                                    <p className="flex flex-wrap gap-x-2 text-[0.72rem] font-bold text-[color:var(--px-muted)]">
                                        {p.id === myId && <span className="text-[color:var(--px-yellow)]">{t('lobby.you')}</span>}
                                        {p.id === state.hostId && <span>{t('lobby.host')}</span>}
                                        {p.isBot && <span>{t('lobby.bot')}</span>}
                                        {!p.isBot && !p.connected && <span className="text-[color:var(--px-red)]">{t('lobby.offline')}</span>}
                                        {isHost && p.isBot && (
                                            <button type="button" className="underline underline-offset-2 hover:text-[color:var(--px-ink)]" onClick={() => onRemoveBot(p.id)}>
                                                {t('lobby.removeBot')}
                                            </button>
                                        )}
                                    </p>
                                </div>
                            ) : (
                                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                    <span className="text-sm font-bold text-[color:var(--px-muted)]">{t('lobby.empty')}</span>
                                    {isHost && <button type="button" className="party-btn party-btn-ghost !min-h-[2.2rem] !px-3 text-xs" onClick={onAddBot}>{t('lobby.addBot')}</button>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <section className="party-panel flex flex-col gap-3 p-5">
                    <h2 className="party-display text-2xl">{t('lobby.character')}</h2>
                    <CharacterPicker
                        value={me && me.characterId}
                        onChange={onCharacter}
                        takenBy={takenBy}
                        color={me ? PLAYER_COLORS[me.seat] : PLAYER_COLORS[0]}
                        t={t}
                        language={language}
                    />
                </section>

                <div className="flex flex-col gap-6">
                    <section className="party-panel flex flex-col gap-4 p-5">
                        <h2 className="party-display text-2xl">{t('lobby.settings')}</h2>
                        <div>
                            <p className="party-kicker">{t('lobby.board')}</p>
                            <p className="mt-1 text-lg font-extrabold">{t('lobby.boardName')}</p>
                            <p className="text-sm text-[color:var(--px-muted)]">{t('lobby.boardInfo')}</p>
                        </div>
                        <div role="radiogroup" aria-label={t('lobby.turns')} className="flex flex-col gap-2">
                            <p className="party-kicker">{t('lobby.turns')}</p>
                            <div className="flex flex-wrap gap-2">
                                {(state.settings.turnOptions || [5, 10, 15, 20]).map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        role="radio"
                                        aria-checked={state.settings.turns === n}
                                        disabled={!isHost}
                                        onClick={() => onSettings({ turns: n })}
                                        className="party-option disabled:cursor-default"
                                    >
                                        {t('lobby.turnsValue', { n })}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {isHost ? (
                            <>
                                <button type="button" className="party-btn party-btn-big w-full" onClick={onStart}>{t('lobby.start')}</button>
                                {state.players.length < MAX && <p className="text-sm text-[color:var(--px-muted)]">{t('lobby.fillBots')}</p>}
                            </>
                        ) : (
                            <p className="party-blink text-sm font-bold text-[color:var(--px-muted)]">{t('lobby.waitingHost')}</p>
                        )}
                    </section>

                    <section className="party-panel p-5">
                        <h2 className="party-display text-2xl">{t('lobby.rules')}</h2>
                        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-[0.95rem] leading-relaxed marker:font-extrabold marker:text-[color:var(--px-yellow)]">
                            {[1, 2, 3, 4, 5].map((n) => <li key={n}>{t(`lobby.rule${n}`)}</li>)}
                        </ol>
                    </section>
                </div>
            </div>
        </div>
    );
}
