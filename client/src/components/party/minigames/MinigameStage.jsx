import React, { useEffect, useState } from 'react';
import { Led, Lcd, LcdText, LoopPad, Panel, PlayerRing, Section } from '../ui/Hardware';
import { PLAYER_COLORS } from '../characters/pixelRig';
import { sfx } from '../partySfx';
import { roleOf, useMinigameClock } from './shared';
import Degaine from './Degaine';
import Gorgee from './Gorgee';
import MicDrop from './MicDrop';
import Cale from './Cale';
import Roulement from './Roulement';
import Echo from './Echo';
import Crowd from './Crowd';
import LeDrop from './LeDrop';
import Tug from './Tug';
import Loop2 from './Loop2';
import Bottle2 from './Bottle2';
import Vibe from './Vibe';

const GAMES = { degaine: Degaine, gorgee: Gorgee, micdrop: MicDrop, cale: Cale, roulement: Roulement, echo: Echo, crowd: Crowd, ledrop: LeDrop, tug: Tug, loop2: Loop2, bottle2: Bottle2, vibe: Vibe };
const TEAM_COLOR = { blue: '#3F7EEA', red: '#E2402F' };

// Les équipes, comme sur l'écran d'avant mini-jeu de Mario Party : couleurs et joueurs de chaque camp
function TeamsBanner({ mg, players, myId, t }) {
    const byId = (id) => players.find((p) => p.id === id);
    const ring = (id, size = 52) => {
        const p = byId(id);
        return p ? (
            <span key={id} className="flex flex-col items-center gap-1">
                <PlayerRing player={p} color={PLAYER_COLORS[p.seat]} size={size} active={id === myId} pose="present" />
                <span className="hw-strip-name !text-xs">{p.name}</span>
            </span>
        ) : null;
    };
    if (!mg.teams) {
        const ids = mg.participants || players.map((p) => p.id);
        return (
            <div className="party-teams">
                <div className="party-team" style={{ '--team': '#F0AE22' }}>
                    <span className="hw-label">{mg.kind === 'duel' ? t('minigame.kinds.duel') : t('minigame.kinds.ffa')}</span>
                    <span className="flex flex-wrap items-center justify-center gap-3">
                        {ids.map((id, i) => (
                            <React.Fragment key={id}>
                                {mg.kind === 'duel' && i === 1 && <span className="hw-title text-3xl">VS</span>}
                                {ring(id)}
                            </React.Fragment>
                        ))}
                    </span>
                </div>
            </div>
        );
    }
    const colors = mg.colors || { a: 'blue', b: 'red' };
    return (
        <div className="party-teams">
            {['b', 'a'].map((side, i) => (
                <React.Fragment key={side}>
                    {i === 1 && <span className="hw-title party-teams-vs">VS</span>}
                    <div className="party-team" style={{ '--team': TEAM_COLOR[colors[side]] }}>
                        <span className="hw-label">{mg.kind === '1v3' ? (side === 'b' ? t('minigame.roles.solo') : t('minigame.roles.crowd')) : t(`minigame.teams.${colors[side]}`)}</span>
                        <span className="flex flex-wrap items-center justify-center gap-3">{mg.teams[side].map((id) => ring(id, mg.kind === '1v3' && side === 'b' ? 64 : 48))}</span>
                    </div>
                </React.Fragment>
            ))}
        </div>
    );
}

// Résultat d'un mini-jeu d'équipe, en une phrase
function outcomeLine(mg, players, t) {
    if (!mg.teams || !mg.outcome) return null;
    const { winner } = mg.outcome;
    if (!winner) return t('minigame.outcome.tie');
    const colors = mg.colors || { a: 'blue', b: 'red' };
    if (mg.kind === '1v3') {
        const solo = players.find((p) => p.id === mg.solo);
        return winner === 'b' ? t('minigame.outcome.solo', { name: solo ? solo.name : '' }) : t('minigame.outcome.crowd');
    }
    return t('minigame.outcome.team', { team: t(`minigame.teams.${colors[winner]}`) });
}

// Écran d'un mini-jeu : présentation (équipes, prêt), décompte, jeu, résultats
export default function MinigameStage({ state, myId, t, clockOffset, onReady, onSubmit, onInput }) {
    const mg = state.minigame;
    const clock = useMinigameClock(mg, clockOffset);
    const [countdown, setCountdown] = useState(null);
    const [sent, setSent] = useState(false);
    const me = state.players.find((p) => p.id === myId);
    const playing = mg && (mg.participants || []).includes(myId);

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
    const kicker = mg.context === 'battle' ? t('events2.battleTitle') : mg.context === 'duel' ? t('minigame.kinds.duel') : t(`minigame.kinds.${mg.kind || 'ffa'}`);
    const role = roleOf(mg, myId);

    if (state.step === 'intro') {
        const participants = state.players.filter((p) => (mg.participants || []).includes(p.id));
        const readyCount = participants.filter((p) => p.ready).length;
        return (
            <Panel className="hw-pop flex flex-col gap-5 p-5 pt-8 sm:p-7 sm:pt-9" label={kicker}>
                <h2 className="hw-title text-5xl sm:text-6xl">{name}</h2>
                {mg.context === 'battle' && <p className="hw-title text-2xl text-[color:var(--hw-amber)]">{t('events2.battlePot', { n: mg.pot })} · {t('events2.battleSplit')}</p>}
                {mg.context === 'duel' && <p className="hw-title text-2xl text-[color:var(--hw-amber)]">{t('minigame.duelStake', { n: mg.pot })}</p>}
                <TeamsBanner mg={mg} players={state.players} myId={myId} t={t} />
                {playing && mg.teams && (
                    <p className="hw-title text-2xl text-[color:var(--hw-amber)]">
                        {mg.kind === '1v3' ? (role.solo ? t('minigame.roles.youSolo') : t('minigame.roles.youCrowd')) : t('minigame.roles.youTeam', { name: (state.players.find((p) => p.id === role.mate) || {}).name || '' })}
                    </p>
                )}
                <p className="hw-text max-w-2xl text-lg">{t(`minigame.${mg.id}.rule`)}</p>
                <Section title={t('minigame.controls')}>
                    <p className="hw-text text-sm">{t(`minigame.${mg.id}.control`)}</p>
                </Section>
                <div className="flex flex-wrap items-center gap-6">
                    {playing ? (
                        <LoopPad color="green" onClick={onReady} disabled={!me || me.ready} spinning={Boolean(me && !me.ready)}>
                            {t('minigame.ready')}
                        </LoopPad>
                    ) : (
                        <p className="hw-label hw-blink !text-sm">{t('minigame.spectate')}</p>
                    )}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            {participants.map((p) => (
                                <span key={p.id} className="flex items-center gap-1.5">
                                    <Led color="green" on={p.ready} />
                                    <span className="hw-strip-name !text-xs">{p.name}</span>
                                </span>
                            ))}
                        </div>
                        <Lcd className="inline-flex self-start px-2 py-1"><LcdText text={t('minigame.readyCount', { n: readyCount, total: participants.length })} scale={2} /></Lcd>
                    </div>
                </div>
            </Panel>
        );
    }

    if (state.step === 'results' && mg.results) {
        const line = outcomeLine(mg, state.players, t);
        return (
            <Panel className="hw-pop flex flex-col gap-4 p-5 pt-8 sm:p-7 sm:pt-9" label={name}>
                <h2 className="hw-title text-5xl">{t('minigame.results')}</h2>
                {line && <p className="hw-title text-3xl text-[color:var(--hw-amber)]">{line}</p>}
                <ol className="flex flex-col gap-2">
                    {mg.results.map((r) => {
                        const p = state.players.find((player) => player.id === r.playerId);
                        if (!p) return null;
                        const display = r.display || {};
                        const value = display.kind && display.kind !== 'none'
                            ? t(`minigame.display.${display.kind}`, { n: display.value })
                            : t('minigame.display.none');
                        const won = r.rank === 1;
                        return (
                            <li key={r.playerId} className={`hw-strip ${r.playerId === myId ? 'is-active' : ''}`}>
                                <Lcd className="flex h-10 w-10 shrink-0 items-center justify-center"><LcdText text={r.rank} font="bold" scale={2} color={won ? '#F0AE22' : undefined} /></Lcd>
                                <PlayerRing player={p} color={PLAYER_COLORS[p.seat]} size={46} active={won} pose={won ? 'cheer' : r.reward > 0 ? 'idle' : 'sad'} />
                                <span className="hw-strip-name min-w-0 flex-1 !text-lg">{p.name}</span>
                                <span className="hw-label shrink-0 !text-xs !tracking-[0.08em]">{value}</span>
                                <Lcd className="flex w-20 shrink-0 items-center justify-center px-2 py-2">
                                    <LcdText text={r.reward > 0 ? `+${r.reward}` : r.reward < 0 ? `${r.reward}` : '-'} font="bold" scale={2} color={r.reward > 0 ? '#F0AE22' : r.reward < 0 ? '#E2402F' : '#4a595a'} />
                                </Lcd>
                            </li>
                        );
                    })}
                </ol>
            </Panel>
        );
    }

    if (state.step === 'play' && Game) {
        // Duel : ceux qui ne jouent pas regardent
        if (!playing) {
            return (
                <Panel className="flex flex-col items-center gap-4 p-6 pt-9" label={kicker}>
                    <h2 className="hw-title text-4xl">{name}</h2>
                    <TeamsBanner mg={mg} players={state.players} myId={myId} t={t} />
                    <p className="hw-label hw-blink !text-sm">{t('minigame.spectate')}</p>
                </Panel>
            );
        }
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
                    onInput={onInput}
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
