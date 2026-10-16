import React, { useRef, useState } from 'react';
import { PLAYER_COLORS } from '../characters/pixelRig';
import { sfx } from '../partySfx';
import { PlayerRing } from '../ui/Hardware';
import { roleOf, useFrame, usePressKeys } from './shared';

// Bras de fer (un contre trois) : tout le monde tape le plus vite possible. Les frappes du
// solo comptent presque triple. Les totaux partent au serveur 5 fois par seconde ; la corde
// suit les totaux publiés.
const SEND_MS = 200;

export default function Tug({ minigame, players, myId, t, clock, onInput }) {
    const { duration, soloFactor } = minigame.params;
    const { solo } = roleOf(minigame, myId);
    const taps = useRef(0);
    const sentAt = useRef(0);
    const sentTaps = useRef(0);
    const [count, setCount] = useState(0);
    const live = minigame.live || {};
    const liveTaps = live.taps || {};
    const crowdIds = minigame.teams ? minigame.teams.a : [];
    const soloPlayer = players.find((p) => p.id === minigame.solo);

    const tap = () => {
        const elapsed = clock();
        if (elapsed < 0 || elapsed > duration) return;
        taps.current += 1;
        setCount(taps.current);
        if (taps.current % 3 === 0) sfx('kick');
    };
    usePressKeys({ onDown: tap });

    useFrame(() => {
        const elapsed = clock();
        const now = performance.now();
        if (elapsed >= 0 && elapsed <= duration + 150 && taps.current !== sentTaps.current && now - sentAt.current > SEND_MS) {
            sentAt.current = now;
            sentTaps.current = taps.current;
            onInput({ taps: taps.current });
        }
    });

    // Force de chaque camp (mes frappes comptent tout de suite, sans attendre le serveur)
    const tapsOf = (id) => (id === myId ? Math.max(taps.current, liveTaps[id] || 0) : liveTaps[id] || 0);
    const soloForce = tapsOf(minigame.solo) * soloFactor;
    const crowdForce = crowdIds.reduce((s, id) => s + tapsOf(id), 0);
    const total = soloForce + crowdForce;
    const lean = total ? (crowdForce - soloForce) / total : 0; // -1 : solo gagne, +1 : foule gagne
    return (
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
            <div className="hw-panel flex flex-col gap-3 p-4" role="presentation" onPointerDown={(event) => { event.preventDefault(); tap(); }}>
                <p className="hw-label text-center">{solo ? t('minigame.tug.solo', { n: soloFactor }) : t('minigame.tug.crowd')}</p>
                <div className="flex items-center justify-between gap-2">
                    <span className="flex flex-col items-center gap-1">
                        {soloPlayer && <PlayerRing player={soloPlayer} color={PLAYER_COLORS[soloPlayer.seat]} size={48} active pose={lean < 0 ? 'cheer' : 'fist'} />}
                        <span className="hw-title text-2xl">{Math.round(soloForce)}</span>
                    </span>
                    <div className="party-rope" aria-hidden="true">
                        <span className="party-rope-line" />
                        <span className="party-rope-mark" style={{ left: `${50 + lean * 45}%` }} />
                        <span className="party-rope-center" />
                    </div>
                    <span className="flex flex-col items-center gap-1">
                        <span className="flex -space-x-2">
                            {crowdIds.map((id) => {
                                const p = players.find((q) => q.id === id);
                                return p ? <PlayerRing key={id} player={p} color={PLAYER_COLORS[p.seat]} size={36} active pose={lean > 0 ? 'cheer' : 'fist'} /> : null;
                            })}
                        </span>
                        <span className="hw-title text-2xl">{Math.round(crowdForce)}</span>
                    </span>
                </div>
                <p className="hw-title text-center text-4xl text-[color:var(--hw-amber)]">{count}</p>
            </div>
            <button type="button" className="hw-key hw-key-lg w-full" onPointerDown={(event) => { event.preventDefault(); tap(); }}>
                <span className="hw-led is-on" style={{ '--led': '#2EB75E' }} aria-hidden="true" />
                {t('minigame.tug.pull')}
            </button>
        </div>
    );
}
