import React, { useRef, useState } from 'react';
import { sfx } from '../partySfx';
import { OUT, px, setupPixelCanvas, useFrame, useOnce, usePressKeys } from './shared';

// La gorgée : maintenir pour remplir sa bouteille, relâcher au plus près du trait.
// La vitesse de remplissage est propre à chaque joueur (params.players[id]).
const CW = 64;
const CH = 104;
const BOTTOM = 94;
const LINE = 36; // niveau 1 (le trait)

export default function Gorgee({ minigame, myId, t, clock, onSubmit }) {
    const canvasRef = useRef(null);
    const [done, mark] = useOnce();
    const holdStart = useRef(null);
    const finalHold = useRef(null);
    const [result, setResult] = useState(null);
    const params = minigame.params.players[myId] || { fillMs: 3000, curve: 1.5 };
    const levelOf = (holdMs) => Math.pow(Math.max(0, holdMs) / params.fillMs, params.curve);

    const release = () => {
        if (holdStart.current == null || done) return;
        const holdMs = Math.round(performance.now() - holdStart.current);
        holdStart.current = null;
        finalHold.current = holdMs;
        mark();
        const level = levelOf(holdMs);
        setResult(level > 1 ? 'overflow' : Math.round(level * 100));
        sfx(level > 1 ? 'fail' : 'coin');
        onSubmit({ holdMs });
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
        const holdMs = holdStart.current != null ? performance.now() - holdStart.current : finalHold.current || 0;
        const level = levelOf(holdMs);
        ctx.clearRect(0, 0, CW, CH);
        // Bouteille
        px(ctx, 19, 22, 26, 76, OUT);
        px(ctx, 26, 6, 12, 18, OUT);
        px(ctx, 21, 24, 22, 72, '#2A3870');
        px(ctx, 28, 8, 8, 18, '#2A3870');
        // Eau
        const top = Math.max(8, Math.round(BOTTOM - level * (BOTTOM - LINE)));
        for (let y = top; y < BOTTOM; y += 1) {
            const inNeck = y < 26;
            px(ctx, inNeck ? 28 : 21, y, inNeck ? 8 : 22, 1, y === top ? '#B6E6FF' : '#4FB2FF');
        }
        px(ctx, 23, 28, 2, 60, 'rgba(255,255,255,0.25)');
        // Trait
        for (let x = 12; x < 52; x += 4) px(ctx, x, LINE, 2, 1, '#FFC72C');
        // Débordement
        if (level > 1.12) {
            const k = Math.floor(performance.now() / 90) % 4;
            px(ctx, 24 - k, 4 + k * 2, 2, 2, '#4FB2FF');
            px(ctx, 40 + k, 6 + k * 3, 2, 2, '#4FB2FF');
        }
        px(ctx, 25, 2, 14, 4, OUT);
        px(ctx, 26, 3, 12, 2, '#F0533F');
    });

    const label = result === 'overflow' ? t('minigame.display.overflow') : result != null ? t('minigame.display.percent', { n: result }) : null;
    return (
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
            <div className="party-panel flex flex-col items-center gap-2 p-4">
                <div className="relative">
                    <canvas ref={canvasRef} className="party-pixel" style={{ width: CW * 3, height: CH * 3 }} aria-hidden="true" />
                    <span className="party-font absolute right-[-4.5rem] text-xs text-[color:var(--px-yellow)]" style={{ top: LINE * 3 - 8 }}>{t('minigame.gorgee.line')}</span>
                </div>
                {label && <p className={`party-font text-2xl ${result === 'overflow' ? 'text-[color:var(--px-red)]' : ''}`}>{label}</p>}
            </div>
            <button
                type="button"
                className="party-btn party-btn-big w-full"
                disabled={done}
                onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); press(); }}
                onPointerUp={release}
                onPointerCancel={release}
                onContextMenu={(event) => event.preventDefault()}
            >
                {t('minigame.gorgee.hold')}
            </button>
        </div>
    );
}
