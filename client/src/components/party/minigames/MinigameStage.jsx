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
            <section className="party-panel party-pop flex flex-col gap-5 overflow-hidden p-5 sm:p-7">
                <div>
                    <span className="party-chip !bg-[#FF5FA8] !text-[#0A1B45]">{t('minigame.kicker')}</span>
                    <h2 className="party-display mt-3 text-4xl text-[color:var(--px-yellow)] sm:text-5xl">{name}</h2>
                </div>
                <p className="max-w-2xl text-lg leading-relaxed">{t(`minigame.${mg.id}.rule`)}</p>
                <p className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--px-muted)]">
                    <span className="party-kicker">{t('minigame.controls')}</span> {t(`minigame.${mg.id}.control`)}
                </p>
                <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-[#060E2B] px-3 pt-2 shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]">
                    {state.players.map((p) => (
                        <div key={p.id} className="flex flex-col items-center pb-2">
                            <PixelCharacter id={p.characterId} color={PLAYER_COLORS[p.seat]} pose={p.ready ? 'dance' : 'idle'} crop="body" scale={1} />
                            <span className={`mt-1 rounded-full px-2 py-0.5 text-xs font-extrabold ${p.ready ? 'bg-[#2DBE6C] text-[#0A1B45]' : 'text-[color:var(--px-muted)]'}`}>{p.ready ? t('minigame.readyDone') : p.name}</span>
                        </div>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <button type="button" className="party-btn party-btn-big" onClick={onReady} disabled={!me || me.ready}>
                        {t('minigame.ready')}
                    </button>
                    <span className="text-sm font-extrabold text-[color:var(--px-muted)]">{t('minigame.readyCount', { n: readyCount, total: state.players.length })}</span>
                </div>
            </section>
        );
    }

    if (state.step === 'results' && mg.results) {
        return (
            <section className="party-panel party-pop flex flex-col gap-4 p-5 sm:p-7">
                <div>
                    <p className="party-kicker">{name}</p>
                    <h2 className="party-display mt-1 text-4xl text-[color:var(--px-yellow)]">{t('minigame.results')}</h2>
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
                            <li
                                key={r.playerId}
                                className="flex items-center gap-3 rounded-xl bg-[#0A0F27]/70 px-3 py-1.5"
                                style={{ boxShadow: r.playerId === myId ? `inset 0 0 0 2px ${PLAYER_COLORS[p.seat]}` : 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
                            >
                                <span className="party-display w-7 text-center text-2xl" style={{ color: PLAYER_COLORS[p.seat] }}>{r.rank}</span>
                                <span className="overflow-hidden rounded-lg" style={{ background: `radial-gradient(circle at 50% 30%, ${PLAYER_COLORS[p.seat]}55, #0a0f27 75%)` }}>
                                    <PixelCharacter id={p.characterId} color={PLAYER_COLORS[p.seat]} pose={r.rank === 1 ? 'cheer' : r.reward ? 'idle' : 'sad'} crop="bust" scale={1} />
                                </span>
                                <span className="min-w-0 flex-1 truncate text-lg font-extrabold">{p.name}</span>
                                <span className="shrink-0 text-xs font-bold text-[color:var(--px-muted)] sm:text-sm">{value}</span>
                                <span className={`party-lcd party-lcd-digits w-16 shrink-0 px-2 py-1 text-center text-sm sm:w-20 sm:text-base ${r.reward ? '' : '!text-[color:var(--px-muted)]'}`}>{r.reward ? t('minigame.reward', { n: r.reward }) : '—'}</span>
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
                    <h2 className="party-display text-3xl text-[color:var(--px-yellow)]">{name}</h2>
                    {sent && <span className="text-xs font-extrabold text-[color:var(--px-muted)]">{t('minigame.sent')}</span>}
                </div>
                <Game
                    key={mg.seed}
                    board={state.board}
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
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-[#05060E]/80" aria-live="assertive">
                        <span key={countdown} className="party-display party-pop text-9xl text-[color:var(--px-yellow)] drop-shadow-[0_0_30px_rgba(255,199,44,0.5)]">{countdown}</span>
                    </div>
                )}
            </section>
        );
    }
    return null;
}
