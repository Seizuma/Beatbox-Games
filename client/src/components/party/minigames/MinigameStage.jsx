import React, { useEffect, useState } from 'react';
import { Led, Lcd, LcdText, LoopPad, Panel, PlayerRing, Section } from '../ui/Hardware';
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
            <Panel className="hw-pop flex flex-col gap-5 p-5 pt-8 sm:p-7 sm:pt-9" label={t('minigame.kicker')}>
                <h2 className="hw-title text-5xl sm:text-6xl">{name}</h2>
                <p className="hw-text max-w-2xl text-lg">{t(`minigame.${mg.id}.rule`)}</p>
                <Section title={t('minigame.controls')}>
                    <p className="hw-text text-sm">{t(`minigame.${mg.id}.control`)}</p>
                </Section>
                <div className="flex flex-wrap items-center gap-6">
                    <LoopPad color="green" onClick={onReady} disabled={!me || me.ready} spinning={Boolean(me && !me.ready)}>
                        {t('minigame.ready')}
                    </LoopPad>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            {state.players.map((p) => (
                                <div key={p.id} className="flex flex-col items-center gap-1.5">
                                    <PlayerRing player={p} color={PLAYER_COLORS[p.seat]} size={56} active={p.ready} pose={p.ready ? 'dance' : 'idle'} dim={!p.ready} />
                                    <span className="flex items-center gap-1.5">
                                        <Led color="green" on={p.ready} />
                                        <span className="hw-strip-name !text-xs">{p.name}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                        <Lcd className="inline-flex self-start px-2 py-1"><LcdText text={t('minigame.readyCount', { n: readyCount, total: state.players.length })} scale={2} /></Lcd>
                    </div>
                </div>
            </Panel>
        );
    }

    if (state.step === 'results' && mg.results) {
        return (
            <Panel className="hw-pop flex flex-col gap-4 p-5 pt-8 sm:p-7 sm:pt-9" label={name}>
                <h2 className="hw-title text-5xl">{t('minigame.results')}</h2>
                <ol className="flex flex-col gap-2">
                    {mg.results.map((r) => {
                        const p = state.players.find((player) => player.id === r.playerId);
                        if (!p) return null;
                        const display = r.display || {};
                        const value = display.kind && display.kind !== 'none'
                            ? t(`minigame.display.${display.kind}`, { n: display.value })
                            : t('minigame.display.none');
                        return (
                            <li key={r.playerId} className={`hw-strip ${r.playerId === myId ? 'is-active' : ''}`}>
                                <Lcd className="flex h-10 w-10 shrink-0 items-center justify-center"><LcdText text={r.rank} font="bold" scale={2} color={r.rank === 1 ? '#F0AE22' : undefined} /></Lcd>
                                <PlayerRing player={p} color={PLAYER_COLORS[p.seat]} size={46} active={r.rank === 1} pose={r.rank === 1 ? 'cheer' : r.reward ? 'idle' : 'sad'} />
                                <span className="hw-strip-name min-w-0 flex-1 !text-lg">{p.name}</span>
                                <span className="hw-label shrink-0 !text-xs !tracking-[0.08em]">{value}</span>
                                <Lcd className="flex w-20 shrink-0 items-center justify-center px-2 py-2">
                                    <LcdText text={r.reward ? `+${r.reward}` : '-'} font="bold" scale={2} color={r.reward ? '#F0AE22' : '#4a595a'} />
                                </Lcd>
                            </li>
                        );
                    })}
                </ol>
            </Panel>
        );
    }

    if (state.step === 'play' && Game) {
        return (
            <section className="relative flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-3">
                    <h2 className="hw-title text-4xl">{name}</h2>
                    {sent && <span className="hw-label hw-blink">{t('minigame.sent')}</span>}
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
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-[#050404]/80" aria-live="assertive">
                        <Lcd key={countdown} className="hw-pop flex h-32 w-32 items-center justify-center"><LcdText text={countdown} font="bold" scale={9} color="#F0AE22" /></Lcd>
                    </div>
                )}
            </section>
        );
    }
    return null;
}
