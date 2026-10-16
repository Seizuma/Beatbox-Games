import React, { useState } from 'react';
import { PLAYER_COLORS } from '../characters/pixelRig';
import { sfx } from '../partySfx';
import { PlayerRing } from '../ui/Hardware';
import { roleOf, useFrame } from './shared';

// Le Drop (un contre trois), en 3 manches. Chaque joueur de la foule se place en secret sur
// une des 5 pistes ; le solo lâche le drop sur deux pistes. Ceux qui y sont sont éliminés.
// La foule gagne s'il reste au moins un survivant après la 3e manche.
export default function LeDrop({ minigame, players, myId, t, clock, onInput }) {
    const { tracks, drops, rounds } = minigame.params;
    const { solo } = roleOf(minigame, myId);
    const live = minigame.live || {};
    const alive = live.alive || (minigame.teams ? minigame.teams.a : []);
    const revealed = live.rounds || [];
    const [round, setRound] = useState(0);
    const [phase, setPhase] = useState('pick');
    const [mine, setMine] = useState({}); // manche -> choix (piste ou [pistes])
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
            if (p === 'reveal') sfx('drop');
        }
    });

    const meAlive = alive.includes(myId);
    const canPick = phase === 'pick' && (solo || meAlive);
    const pick = (track) => {
        if (!canPick) return;
        sfx('hit');
        if (solo) {
            const current = Array.isArray(mine[round]) ? mine[round] : [];
            let next = current.includes(track) ? current.filter((x) => x !== track) : [...current, track];
            if (next.length > drops) next = next.slice(-drops);
            setMine({ ...mine, [round]: next });
            if (next.length === drops) onInput({ round, drops: next });
        } else {
            setMine({ ...mine, [round]: track });
            onInput({ round, pick: track });
        }
    };

    const shown = phase === 'reveal' ? revealed[round] : null;
    const myChoice = mine[round];
    let status;
    if (phase === 'reveal') status = t('minigame.ledrop.reveal');
    else if (solo) status = t('minigame.ledrop.soloPick', { n: drops });
    else if (meAlive) status = t('minigame.ledrop.crowdPick');
    else status = t('minigame.ledrop.out');

    return (
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
            <div className="hw-panel flex flex-col items-center gap-2 p-4">
                <p className="hw-label">{t('minigame.echo.round', { n: round + 1, total: rounds.length })} · {solo ? t('minigame.roles.solo') : t('minigame.roles.crowd')}</p>
                <p className="hw-title text-center text-3xl text-[color:var(--hw-amber)]" aria-live="polite">{status}</p>
                <div className="flex flex-wrap justify-center gap-2" aria-label={t('minigame.ledrop.alive')}>
                    {(minigame.teams ? minigame.teams.a : []).map((id) => {
                        const p = byId(id);
                        if (!p) return null;
                        const ready = (live.ready || []).includes(id);
                        return (
                            <span key={id} className={`flex items-center gap-1 ${alive.includes(id) ? '' : 'opacity-35'}`}>
                                <PlayerRing player={p} color={PLAYER_COLORS[p.seat]} size={34} active={ready} pose={alive.includes(id) ? 'idle' : 'sad'} dim={!alive.includes(id)} />
                            </span>
                        );
                    })}
                </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: tracks }, (_, i) => {
                    const chosen = solo ? Array.isArray(myChoice) && myChoice.includes(i) : myChoice === i;
                    const dropped = shown && shown.drops.includes(i);
                    const standing = shown ? Object.entries(shown.picks).filter(([id, v]) => id !== minigame.solo && v === i).map(([id]) => byId(id)).filter(Boolean) : [];
                    return (
                        <button
                            key={i}
                            type="button"
                            className={`party-track ${chosen ? 'is-chosen' : ''} ${dropped ? 'is-dropped' : ''}`}
                            disabled={!canPick}
                            onPointerDown={(event) => { event.preventDefault(); pick(i); }}
                        >
                            <span className="party-track-num">{i + 1}</span>
                            <span className="flex min-h-[2.4rem] flex-wrap justify-center gap-0.5">
                                {standing.map((p) => <PlayerRing key={p.id} player={p} color={PLAYER_COLORS[p.seat]} size={30} pose={dropped ? 'shock' : 'cheer'} />)}
                            </span>
                            {dropped && <span className="party-track-drop">DROP</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
