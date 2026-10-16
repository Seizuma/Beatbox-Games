import React, { useState } from 'react';
import { PLAYER_COLORS } from '../characters/pixelRig';
import { sfx } from '../partySfx';
import { PlayerRing } from '../ui/Hardware';
import SoundPads from './SoundPads';
import { SOUNDS, roleOf, useFrame, usePadKeys } from './shared';

// Même vibe (deux contre deux), en 5 manches : chacun choisit en secret un des 4 sons. Une
// équipe marque quand ses deux joueurs ont choisi le même. Pas le droit de se parler !
export default function Vibe({ minigame, players, myId, t, clock, onInput }) {
    const { rounds } = minigame.params;
    const { side, mate } = roleOf(minigame, myId);
    const live = minigame.live || {};
    const revealed = live.rounds || [];
    const score = live.score || { a: 0, b: 0 };
    const [round, setRound] = useState(0);
    const [phase, setPhase] = useState('pick');
    const [mine, setMine] = useState({});
    const byId = (id) => players.find((p) => p.id === id);

    useFrame(() => {
        const elapsed = clock();
        if (elapsed < 0) return;
        let r = rounds.findIndex((rd, i) => elapsed < (rounds[i + 1] ? rounds[i + 1].startAt : Infinity));
        if (r < 0) r = rounds.length - 1;
        const p = elapsed < rounds[r].revealAt ? 'pick' : 'reveal';
        if (r !== round) setRound(r);
        if (p !== phase) {
            setPhase(p);
            if (p === 'reveal') {
                const res = revealed[r];
                sfx(res && res.match && res.match[side] ? 'star' : 'tick');
            }
        }
    });

    const pick = (i) => {
        if (phase !== 'pick' || mine[round] != null) return;
        sfx(SOUNDS[i].id);
        setMine({ ...mine, [round]: i });
        onInput({ round, pick: i });
    };
    usePadKeys(pick);

    const shown = phase === 'reveal' ? revealed[round] : null;
    const teamRow = (s) => (minigame.teams ? minigame.teams[s] : []).map((id) => byId(id)).filter(Boolean);
    const sideLabel = (s) => t(`minigame.teams.${(minigame.colors || {})[s] || (s === 'a' ? 'blue' : 'red')}`);
    let status = mine[round] != null ? t('minigame.vibe.waiting') : t('minigame.vibe.pick');
    if (shown) status = shown.match[side] ? t('minigame.vibe.match') : t('minigame.vibe.nomatch');
    return (
        <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4">
            <div className="hw-panel flex flex-col items-center gap-3 p-4">
                <p className="hw-label">{t('minigame.echo.round', { n: round + 1, total: rounds.length })} · {t('minigame.vibe.with', { name: (byId(mate) || {}).name || '' })}</p>
                <p className="hw-title text-center text-3xl text-[color:var(--hw-amber)]" aria-live="polite">{status}</p>
                <div className="grid w-full grid-cols-2 gap-3">
                    {['a', 'b'].map((s) => (
                        <div key={s} className={`party-vibe-team ${s === side ? 'is-mine' : ''}`}>
                            <span className="hw-label">{sideLabel(s)} · {score[s]}</span>
                            <span className="flex items-center gap-2">
                                {teamRow(s).map((p) => {
                                    const v = shown ? shown.picks[p.id] : null;
                                    return (
                                        <span key={p.id} className="flex flex-col items-center gap-1">
                                            <PlayerRing player={p} color={PLAYER_COLORS[p.seat]} size={38} active={(live.ready || []).includes(p.id)} pose={shown && shown.match[s] ? 'cheer' : 'idle'} />
                                            <span className="h-5 min-w-[2.2rem] rounded px-1 text-center text-xs font-bold leading-5" style={{ background: v != null ? SOUNDS[v].color : '#2a2a30', color: '#141210' }}>{v != null ? SOUNDS[v].label : shown ? '–' : ''}</span>
                                        </span>
                                    );
                                })}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            <SoundPads onPad={pick} picked={mine[round]} disabled={phase !== 'pick' || mine[round] != null} />
        </div>
    );
}
