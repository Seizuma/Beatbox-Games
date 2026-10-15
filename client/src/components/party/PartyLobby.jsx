import React, { useState } from 'react';
import PixelCharacter from './PixelCharacter';
import CharacterPicker from './CharacterPicker';
import { PLAYER_COLORS } from './characters/pixelRig';
import { copyToClipboard } from '../../utils/clipboard';

const MAX = 4;

// Salon : les quatre places, le choix du personnage, les réglages de l'hôte
export default function PartyLobby({ state, myId, t, language, onCharacter, onAddBot, onRemoveBot, onSettings, onStart }) {
    const [copied, setCopied] = useState(false);
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

    return (
        <div className="flex flex-col gap-6">
            <section className="party-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="party-font text-sm text-[color:var(--px-muted)]">{t('lobby.room')}</p>
                    <p className="party-font text-4xl tracking-[0.2em] text-[color:var(--px-yellow)]">{state.code}</p>
                </div>
                <button type="button" className="party-btn party-btn-ghost" onClick={copy}>
                    {copied ? t('lobby.copied') : t('lobby.copy')}
                </button>
            </section>

            <section aria-label={t('lobby.players')} className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {seats.map((p, seat) => (
                    <div key={seat} className={`party-panel flex flex-col items-center gap-1 px-2 pb-3 pt-2 ${p && p.id === myId ? 'border-[color:var(--px-yellow)]' : ''}`}>
                        {p ? (
                            <>
                                <PixelCharacter id={p.characterId} color={PLAYER_COLORS[seat]} pose={p.isBot ? 'idle' : 'dance'} scale={2.5} label={p.name} />
                                <span className="w-full truncate text-center font-bold">{p.name}</span>
                                <span className="party-font flex flex-wrap justify-center gap-x-2 text-[0.68rem] text-[color:var(--px-muted)]">
                                    {p.id === myId && <span className="text-[color:var(--px-yellow)]">{t('lobby.you')}</span>}
                                    {p.id === state.hostId && <span>{t('lobby.host')}</span>}
                                    {p.isBot && <span>{t('lobby.bot')}</span>}
                                    {!p.isBot && !p.connected && <span className="text-[color:var(--px-red)]">{t('lobby.offline')}</span>}
                                </span>
                                {isHost && p.isBot && (
                                    <button type="button" className="party-font mt-1 text-xs text-[color:var(--px-muted)] underline underline-offset-4 hover:text-[color:var(--px-ink)]" onClick={() => onRemoveBot(p.id)}>
                                        {t('lobby.removeBot')}
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="flex min-h-[10rem] flex-col items-center justify-center gap-3">
                                <span className="party-font text-sm text-[color:var(--px-muted)]">{t('lobby.empty')}</span>
                                {isHost && (
                                    <button type="button" className="party-btn party-btn-ghost text-xs" onClick={onAddBot}>
                                        {t('lobby.addBot')}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <section className="party-panel flex flex-col gap-3 p-5">
                    <h2 className="party-font text-lg">{t('lobby.character')}</h2>
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
                        <h2 className="party-font text-lg">{t('lobby.settings')}</h2>
                        <div>
                            <p className="text-sm text-[color:var(--px-muted)]">{t('lobby.board')}</p>
                            <p className="font-bold">{t('lobby.boardName')}</p>
                            <p className="text-sm text-[color:var(--px-muted)]">{t('lobby.boardInfo')}</p>
                        </div>
                        <div role="radiogroup" aria-label={t('lobby.turns')} className="flex flex-col gap-2">
                            <p className="text-sm text-[color:var(--px-muted)]">{t('lobby.turns')}</p>
                            <div className="flex flex-wrap gap-2">
                                {(state.settings.turnOptions || [5, 10, 15, 20]).map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        role="radio"
                                        aria-checked={state.settings.turns === n}
                                        disabled={!isHost}
                                        onClick={() => onSettings({ turns: n })}
                                        className={`party-font min-h-[2.75rem] rounded-md border-[3px] px-3 text-sm ${state.settings.turns === n ? 'border-[color:var(--px-yellow)] bg-[color:var(--px-yellow)] text-[#1A1C2C]' : 'border-[color:var(--px-line)] bg-[#1A1F45]'} disabled:cursor-default`}
                                    >
                                        {t('lobby.turnsValue', { n })}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {isHost ? (
                            <>
                                <button type="button" className="party-btn party-btn-big" onClick={onStart}>{t('lobby.start')}</button>
                                {state.players.length < MAX && <p className="text-sm text-[color:var(--px-muted)]">{t('lobby.fillBots')}</p>}
                            </>
                        ) : (
                            <p className="party-blink text-sm text-[color:var(--px-muted)]">{t('lobby.waitingHost')}</p>
                        )}
                    </section>

                    <section className="party-panel p-5">
                        <h2 className="party-font text-lg">{t('lobby.rules')}</h2>
                        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-[0.95rem] leading-relaxed">
                            {[1, 2, 3, 4, 5].map((n) => <li key={n}>{t(`lobby.rule${n}`)}</li>)}
                        </ol>
                    </section>
                </div>
            </div>
        </div>
    );
}
