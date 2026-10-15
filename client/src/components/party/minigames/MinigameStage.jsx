import React, { useEffect, useState } from 'react';
import PixelCharacter from '../PixelCharacter';
import { PLAYER_COLORS } from '../characters/pixelRig';
import { sfx } from '../partySfx';
import { useMinigameClock } from './shared';
import Degaine from './Degaine';
import Gorgee from './Gorgee';
import MicDrop from './MicDrop';
import Cale from './Cale';

const GAMES = { degaine: Degaine, gorgee: Gorgee, micdrop: MicDrop, cale: Cale };

// Écran d'un mini-jeu : présentation (prêt), décompte, jeu, résultats
export default function MinigameStage({ state, myId, t, clockOffset, onReady, onSubmit }) {
    const mg = state.minigame;
    const clock = useMinigameClock(mg, clockOffset);
    const [countdown, setCountdown] = useState(null);
    const [sent, setSent] = useState(false);
    const me = state.players.find((p) => p.id === myId);

    // Décompte affiché jusqu'au début (horloge locale corrigée)
    useEffect(() => {
        if (state.step !== 'play' || !mg || !mg.startsAt) {
            setCountdown(null);
            return undefined;
        }
        let last = null;
        const timer = setInterval(() => {
            const left = Math.ceil(-clock() / 1000);
            if (left !== last) {
                last = left;
                setCountdown(left > 0 ? left : null);
                if (left > 0 && left <= 3) sfx('count');
                if (left === 0) sfx('go');
            }
        }, 50);
        return () => clearInterval(timer);
    }, [state.step, mg, clock]);

    const seed = mg ? mg.seed : null;
    useEffect(() => {
        setSent(false);
    }, [seed]);

    if (!mg) return null;
    const Game = GAMES[mg.id];
    const name = t(`minigame.${mg.id}.name`);

    if (state.step === 'intro') {
        const readyCount = state.players.filter((p) => p.ready).length;
        return (
            <section className="party-panel party-pop flex flex-col gap-5 p-5 sm:p-7">
                <div>
                    <p className="party-font text-sm text-[color:var(--px-muted)]">{t('minigame.kicker')}</p>
                    <h2 className="party-font mt-1 text-3xl text-[color:var(--px-yellow)] sm:text-4xl">{name}</h2>
                </div>
                <p className="text-lg leading-relaxed">{t(`minigame.${mg.id}.rule`)}</p>
                <p className="text-sm text-[color:var(--px-muted)]"><span className="party-font">{t('minigame.controls')} :</span> {t(`minigame.${mg.id}.control`)}</p>
                <div className="flex flex-wrap items-end gap-3">
                    {state.players.map((p) => (
                        <div key={p.id} className="flex flex-col items-center">
                            <PixelCharacter id={p.characterId} color={PLAYER_COLORS[p.seat]} pose={p.ready ? 'dance' : 'idle'} scale={1.5} />
                            <span className={`party-font mt-1 text-xs ${p.ready ? 'text-[color:var(--px-green)]' : 'text-[color:var(--px-muted)]'}`}>{p.ready ? t('minigame.readyDone') : '…'}</span>
                        </div>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <button type="button" className="party-btn party-btn-big" onClick={onReady} disabled={!me || me.ready}>
                        {t('minigame.ready')}
                    </button>
                    <span className="party-font text-sm text-[color:var(--px-muted)]">{t('minigame.readyCount', { n: readyCount, total: state.players.length })}</span>
                </div>
            </section>
        );
    }

    if (state.step === 'results' && mg.results) {
        return (
            <section className="party-panel party-pop flex flex-col gap-4 p-5 sm:p-7">
                <div>
                    <p className="party-font text-sm text-[color:var(--px-muted)]">{name}</p>
                    <h2 className="party-font mt-1 text-3xl text-[color:var(--px-yellow)]">{t('minigame.results')}</h2>
                </div>
                <ol className="flex flex-col gap-2">
                    {mg.results.map((r) => {
                        const p = state.players.find((player) => player.id === r.playerId);
                        if (!p) return null;
                        const display = r.display || {};
                        const value = display.kind && display.kind !== 'none'
                            ? t(`minigame.display.${display.kind}`, { n: display.value })
                            : t('minigame.display.none');
                        return (
                            <li key={r.playerId} className={`flex items-center gap-3 rounded-md border-2 px-3 py-1 ${r.playerId === myId ? 'border-[color:var(--px-yellow)] bg-[#2A3166]' : 'border-[color:var(--px-line)] bg-[#1A1F45]'}`}>
                                <span className="party-font w-6 text-xl">{r.rank}</span>
                                <PixelCharacter id={p.characterId} color={PLAYER_COLORS[p.seat]} pose={r.rank === 1 ? 'cheer' : r.reward ? 'idle' : 'sad'} base={false} scale={1} />
                                <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
                                <span className="party-font shrink-0 text-xs text-[color:var(--px-muted)] sm:text-sm">{value}</span>
                                <span className={`party-font w-16 shrink-0 text-right text-sm sm:w-20 sm:text-base ${r.reward ? 'text-[color:var(--px-yellow)]' : 'text-[color:var(--px-muted)]'}`}>{r.reward ? t('minigame.reward', { n: r.reward }) : '—'}</span>
                            </li>
                        );
                    })}
                </ol>
            </section>
        );
    }

    if (state.step === 'play' && Game) {
        return (
            <section className="relative flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-3">
                    <h2 className="party-font text-2xl text-[color:var(--px-yellow)]">{name}</h2>
                    {sent && <span className="party-font text-xs text-[color:var(--px-muted)]">{t('minigame.sent')}</span>}
                </div>
                <Game
                    key={mg.seed}
                    minigame={mg}
                    players={state.players}
                    myId={myId}
                    t={t}
                    clock={clock}
                    onSubmit={(raw) => {
                        setSent(true);
                        onSubmit(raw);
                    }}
                />
                {countdown != null && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0B0E22]/80" aria-live="assertive">
                        <span key={countdown} className="party-font party-pop text-8xl text-[color:var(--px-yellow)]">{countdown}</span>
                    </div>
                )}
            </section>
        );
    }
    return null;
}
