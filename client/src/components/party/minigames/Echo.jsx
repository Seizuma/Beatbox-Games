import React, { useRef, useState } from 'react';
import { sfx } from '../partySfx';
import SoundPads from './SoundPads';
import { SOUNDS, useFrame, useOnce, usePadKeys } from './shared';

// Écho : la loopstation joue une suite de sons ; il faut la rejouer à l'identique.
// Trois manches (4, 5 puis 6 sons). Une erreur arrête la manche.
export default function Echo({ minigame, t, clock, onSubmit }) {
    const { sequence, stepMs, rounds, duration } = minigame.params;
    const [done, mark] = useOnce();
    const answers = useRef(rounds.map(() => []));
    const failed = useRef(rounds.map(() => false));
    const lastAt = useRef(rounds.map(() => null));
    const played = useRef({});
    const [view, setView] = useState({ round: 0, phase: 'wait', lit: null, count: 0 });

    const phaseAt = (elapsed) => {
        const r = rounds.findIndex((rd) => elapsed < rd.endAt + 250);
        if (r < 0) return { round: rounds.length - 1, phase: 'over' };
        const rd = rounds[r];
        if (elapsed < rd.listenAt) return { round: r, phase: 'wait' };
        if (elapsed < rd.answerAt) return { round: r, phase: 'listen' };
        if (elapsed < rd.endAt) return { round: r, phase: 'answer' };
        return { round: r, phase: 'between' };
    };

    const press = (i) => {
        const elapsed = clock();
        const { round, phase } = phaseAt(elapsed);
        if (done || phase !== 'answer' || failed.current[round]) return;
        const list = answers.current[round];
        if (list.length >= rounds[round].len) return;
        sfx(SOUNDS[i].id);
        list.push(i);
        lastAt.current[round] = elapsed - rounds[round].answerAt;
        if (sequence[list.length - 1] !== i) {
            failed.current[round] = true;
            sfx('fail', 0.12);
        } else if (list.length === rounds[round].len) sfx('coin', 0.1);
        setView((v) => ({ ...v, count: list.length }));
    };
    usePadKeys(press);

    useFrame(() => {
        const elapsed = clock();
        if (elapsed < 0) return;
        const { round, phase } = phaseAt(elapsed);
        let lit = null;
        if (phase === 'listen') {
            const rd = rounds[round];
            const i = Math.floor((elapsed - rd.listenAt) / stepMs);
            const within = (elapsed - rd.listenAt) % stepMs < stepMs * 0.7;
            if (i < rd.len && within) {
                lit = sequence[i];
                const key = `${round}-${i}`;
                if (!played.current[key]) {
                    played.current[key] = true;
                    sfx(SOUNDS[sequence[i]].id);
                }
            }
        }
        if (!done && (phase === 'over' || elapsed > duration)) {
            mark();
            const ms = lastAt.current.reduce((sum, v) => sum + (v == null ? 9000 : v), 0);
            onSubmit({ answers: answers.current, ms: Math.round(ms) });
        }
        if (view.round !== round || view.phase !== phase || view.lit !== lit) setView({ round, phase, lit, count: answers.current[round] ? answers.current[round].length : 0 });
    });

    const rd = rounds[view.round];
    const failedNow = failed.current[view.round];
    const complete = answers.current[view.round] && answers.current[view.round].length === rd.len && !failedNow;
    let status = t('minigame.echo.wait');
    if (view.phase === 'listen') status = t('minigame.echo.listen');
    if (view.phase === 'answer') status = failedNow ? t('minigame.echo.miss') : complete ? t('minigame.echo.perfect') : t('minigame.echo.yourTurn', { n: view.count, total: rd.len });
    if (view.phase === 'between') status = failedNow ? t('minigame.echo.miss') : t('minigame.echo.perfect');

    return (
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
            <div className="hw-panel flex flex-col items-center gap-3 p-4">
                <p className="hw-label">{t('minigame.echo.round', { n: view.round + 1, total: rounds.length })}</p>
                <p className={`hw-title text-3xl ${view.phase === 'listen' ? 'text-[#5FE0C8]' : 'text-[color:var(--hw-amber)]'}`} aria-live="polite">{status}</p>
                <div className="flex gap-1.5" aria-hidden="true">
                    {Array.from({ length: rd.len }, (_, i) => {
                        const given = answers.current[view.round][i];
                        const color = given == null ? '#2a2a30' : given === sequence[i] ? SOUNDS[given].color : '#5b5b64';
                        return <span key={i} className="h-3 w-7 rounded-sm" style={{ background: color }} />;
                    })}
                </div>
            </div>
            <SoundPads onPad={press} lit={view.lit} disabled={done || view.phase !== 'answer'} />
        </div>
    );
}
