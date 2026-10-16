import React, { useRef, useState } from 'react';
import { PLAYER_COLORS } from '../characters/pixelRig';
import { sfx } from '../partySfx';
import { OUT, px, roleOf, setupPixelCanvas, useFrame, useOnce, usePressKeys } from './shared';

// Bouteille à deux (deux contre deux) : chaque équipe remplit une seule bouteille, chacun sa
// part. Le total doit approcher le trait sans déborder. Dès qu'un joueur a versé, son
// équipier voit le niveau et ajuste.
const CW = 64;
const CH = 104;
const BOTTOM = 94;
const LINE = 36;

export default function Bottle2({ minigame, players, myId, t, clock, onInput }) {
    const canvasRef = useRef(null);
    const [done, mark] = useOnce();
    const holdStart = useRef(null);
    const myHold = useRef(null);
    const [, setTick] = useState(0);
    const { mate } = roleOf(minigame, myId);
    const params = minigame.params.players[myId] || { fillMs: 3000, curve: 1.4 };
    const levelOf = (holdMs) => Math.pow(Math.max(0, holdMs) / params.fillMs, params.curve) * 0.5;
    const pours = (minigame.live && minigame.live.pours) || {};
    const mateLevel = mate != null ? pours[mate] : null;
    const mateName = mate != null ? (players.find((p) => p.id === mate) || {}).name : '';
    const me = players.find((p) => p.id === myId);
    const matePlayer = players.find((p) => p.id === mate);

    const release = () => {
        if (holdStart.current == null || done) return;
        const holdMs = Math.round(performance.now() - holdStart.current);
        holdStart.current = null;
        myHold.current = holdMs;
        mark();
        sfx('coin');
        onInput({ holdMs });
        setTick((n) => n + 1);
    };
    const press = () => {
        if (done || holdStart.current != null || clock() < 0) return;
        holdStart.current = performance.now();
    };
    usePressKeys({ onDown: press, onUp: release });

    useFrame(() => {
        const elapsed = clock();
        if (holdStart.current != null && elapsed > minigame.params.duration) release();
        const ctx = setupPixelCanvas(canvasRef.current, CW, CH);
        if (!ctx) return;
        const mine = holdStart.current != null ? levelOf(performance.now() - holdStart.current) : myHold.current != null ? levelOf(myHold.current) : 0;
        const other = mateLevel || 0;
        ctx.clearRect(0, 0, CW, CH);
        px(ctx, 19, 22, 26, 76, OUT);
        px(ctx, 26, 6, 12, 18, OUT);
        px(ctx, 21, 24, 22, 72, '#1B2A5E');
        px(ctx, 28, 8, 8, 18, '#1B2A5E');
        // Deux couches : la part de l'équipier (en bas), puis la mienne
        const toY = (level) => Math.max(8, Math.round(BOTTOM - level * (BOTTOM - LINE)));
        const yMate = toY(other);
        const yTotal = toY(other + mine);
        const mateColor = matePlayer ? PLAYER_COLORS[matePlayer.seat] : '#3E9BF0';
        const myColor = me ? PLAYER_COLORS[me.seat] : '#7FD0FF';
        for (let y = yTotal; y < BOTTOM; y += 1) {
            const neck = y < 26;
            px(ctx, neck ? 28 : 21, y, neck ? 8 : 22, 1, y >= yMate ? mateColor : myColor);
        }
        px(ctx, 23, 28, 2, 60, 'rgba(255,255,255,0.28)');
        for (let x = 10; x < 54; x += 4) px(ctx, x, LINE, 2, 1, '#FFC72C');
        if (other + mine > 1.08) {
            const k = Math.floor(performance.now() / 90) % 4;
            px(ctx, 24 - k, 4 + k * 2, 2, 2, '#7FD0FF');
            px(ctx, 40 + k, 6 + k * 3, 2, 2, '#7FD0FF');
        }
        px(ctx, 25, 1, 14, 6, OUT);
        px(ctx, 26, 2, 12, 4, '#E8402F');
    });

    const total = (mateLevel || 0) + (myHold.current != null ? levelOf(myHold.current) : 0);
    return (
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
            <div className="hw-panel flex flex-col items-center gap-2 p-4" style={{ background: 'radial-gradient(circle at 50% 30%, #2a2a30 0%, #141416 70%)' }}>
                <p className="hw-label">{mateLevel != null ? t('minigame.bottle2.mateDone', { name: mateName, n: Math.round(mateLevel * 100) }) : t('minigame.bottle2.mateWaiting', { name: mateName })}</p>
                <canvas ref={canvasRef} className="party-pixel" style={{ width: CW * 3, height: CH * 3 }} aria-hidden="true" />
                {myHold.current != null && <p className={`hw-title text-3xl ${total > 1 ? 'text-[color:var(--hw-red)]' : 'text-[color:var(--hw-amber)]'}`}>{total > 1 ? t('minigame.display.overflow') : t('minigame.display.percent', { n: Math.round(total * 100) })}</p>}
            </div>
            <button
                type="button"
                className="hw-key hw-key-lg w-full"
                disabled={done}
                onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); press(); }}
                onPointerUp={release}
                onPointerCancel={release}
                onContextMenu={(event) => event.preventDefault()}
            >
                <span className="hw-led is-on" style={{ '--led': '#2EB75E' }} aria-hidden="true" />
                {t('minigame.gorgee.hold')}
            </button>
        </div>
    );
}
