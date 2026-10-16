import React, { useRef, useState } from 'react';
import { sfx } from '../partySfx';
import SoundPads from './SoundPads';
import { SOUNDS, roleOf, useFrame, useOnce, usePadKeys } from './shared';

// Contre la foule (un contre trois) : le solo compose un motif de 4 sons, la loopstation le
// rejoue, puis les trois autres doivent le reproduire. Deux bonnes copies et la foule gagne.
export default function Crowd({ minigame, players, myId, t, clock, onSubmit, onInput }) {
    const { length, recordMs, stepMs, playAt, answerAt, duration } = minigame.params;
    const { solo } = roleOf(minigame, myId);
    const soloName = (players.find((p) => p.id === minigame.solo) || {}).name || '';
    const [done, mark] = useOnce();
    const pattern = useRef([]);
    const answer = useRef([]);
    const played = useRef({});
    const [view, setView] = useState({ phase: 'record', lit: null, n: 0 });
    const live = minigame.live || {};

    const phaseAt = (elapsed) => {
        if (elapsed < recordMs) return 'record';
        if (elapsed < playAt) return 'wait';
        if (elapsed < answerAt) return 'play';
        if (elapsed < duration) return 'answer';
        return 'over';
    };

    const press = (i) => {
        const elapsed = clock();
        const phase = phaseAt(elapsed);
        if (elapsed < 0) return;
        if (solo && phase === 'record' && pattern.current.length < length) {
            sfx(SOUNDS[i].id);
            pattern.current = [...pattern.current, i];
            if (pattern.current.length === length) onInput({ pattern: pattern.current });
            setView((v) => ({ ...v, n: pattern.current.length }));
        }
        if (!solo && phase === 'answer' && !done && answer.current.length < length) {
            sfx(SOUNDS[i].id);
            answer.current = [...answer.current, i];
            setView((v) => ({ ...v, n: answer.current.length }));
            if (answer.current.length === length) {
                mark();
                onSubmit({ answer: answer.current });
            }
        }
    };
    usePadKeys(press);

    useFrame(() => {
        const elapsed = clock();
        if (elapsed < 0) return;
        const phase = phaseAt(elapsed);
        let lit = null;
        const seq = live.pattern;
        if (phase === 'play' && seq) {
            const i = Math.floor((elapsed - playAt) / stepMs);
            if (i < seq.length && (elapsed - playAt) % stepMs < stepMs * 0.7) {
                lit = seq[i];
                if (!played.current[i]) {
                    played.current[i] = true;
                    sfx(SOUNDS[seq[i]].id);
                }
            }
        }
        if (!solo && !done && phase === 'over') {
            mark();
            onSubmit({ answer: answer.current });
        }
        if (view.phase !== phase || view.lit !== lit) setView((v) => ({ ...v, phase, lit }));
    });

    let status;
    if (solo) {
        status = {
            record: pattern.current.length < length ? t('minigame.crowd.compose', { n: pattern.current.length, total: length }) : t('minigame.crowd.recorded'),
            wait: t('minigame.crowd.recorded'),
            play: t('minigame.crowd.playing'),
            answer: t('minigame.crowd.theyTry'),
            over: t('minigame.crowd.theyTry'),
        }[view.phase];
    } else {
        status = {
            record: t('minigame.crowd.soloComposes', { name: soloName }),
            wait: t('minigame.crowd.listen'),
            play: t('minigame.crowd.listen'),
            answer: done ? t('minigame.sent') : t('minigame.crowd.repeat', { n: answer.current.length, total: length }),
            over: t('minigame.sent'),
        }[view.phase];
    }
    const slots = solo ? pattern.current : answer.current;
    const canPress = solo ? view.phase === 'record' && pattern.current.length < length : view.phase === 'answer' && !done;
    return (
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
            <div className="hw-panel flex flex-col items-center gap-3 p-4">
                <p className="hw-label">{solo ? t('minigame.roles.solo') : t('minigame.roles.crowd')}</p>
                <p className="hw-title text-center text-3xl text-[color:var(--hw-amber)]" aria-live="polite">{status}</p>
                <div className="flex gap-1.5" aria-hidden="true">
                    {Array.from({ length }, (_, i) => (
                        <span key={i} className="flex h-8 w-12 items-center justify-center rounded-md font-bold" style={{ background: slots[i] != null ? SOUNDS[slots[i]].color : '#2a2a30', color: '#141210' }}>
                            {slots[i] != null ? SOUNDS[slots[i]].label : ''}
                        </span>
                    ))}
                </div>
            </div>
            <SoundPads onPad={press} lit={view.lit} disabled={!canPress} />
        </div>
    );
}
