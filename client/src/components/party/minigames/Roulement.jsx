import React, { useRef, useState } from 'react';
import { sfx } from '../partySfx';
import { OUT, px, setupPixelCanvas, useFrame, useOnce, usePressKeys } from './shared';

// Roulement : taper le plus vite possible pendant 5 secondes, comme un roulement de caisse claire.
// Aussi utilisé pour le Bras de fer (mode tug), où les frappes sont envoyées en direct.
const CW = 120;
const CH = 64;

export default function Roulement({ minigame, t, clock, onSubmit }) {
    const canvasRef = useRef(null);
    const [done, mark] = useOnce();
    const taps = useRef(0);
    const hitAt = useRef(0);
    const [count, setCount] = useState(0);
    const { duration } = minigame.params;

    const tap = () => {
        const elapsed = clock();
        if (done || elapsed < 0 || elapsed > duration) return;
        taps.current += 1;
        hitAt.current = performance.now();
        setCount(taps.current);
        sfx(taps.current % 2 ? 'snare' : 'hat');
    };
    usePressKeys({ onDown: tap });

    useFrame(() => {
        const elapsed = clock();
        if (!done && elapsed > duration) {
            mark();
            onSubmit({ taps: taps.current });
        }
        const ctx = setupPixelCanvas(canvasRef.current, CW, CH);
        if (!ctx) return;
        ctx.clearRect(0, 0, CW, CH);
        // Caisse claire vue de face : elle tremble à chaque frappe
        const shake = performance.now() - hitAt.current < 70 ? 1 : 0;
        const x = 30 + shake;
        px(ctx, x - 1, 22, 62, 30, OUT);
        px(ctx, x, 23, 60, 28, '#c9c9d4');
        for (let i = 0; i < 6; i += 1) px(ctx, x + 4 + i * 10, 23, 2, 28, '#8a8a96');
        px(ctx, x, 23, 60, 3, '#ffffff');
        px(ctx, x, 48, 60, 3, '#6a6a74');
        px(ctx, x - 2, 18, 64, 6, OUT);
        px(ctx, x - 1, 19, 62, 4, '#f4f4f2');
        // Baguettes
        const up = shake ? 0 : 4;
        px(ctx, x + 6, 4 + up, 3, 16, '#c98a00');
        px(ctx, x + 50, 4 + (4 - up), 3, 16, '#c98a00');
        // Jauge du temps
        const k = Math.max(0, Math.min(1, elapsed / duration));
        px(ctx, 8, 58, CW - 16, 3, '#2a2a30');
        px(ctx, 8, 58, Math.round((CW - 16) * (1 - k)), 3, k > 0.8 ? '#E2402F' : '#F0AE22');
    });

    return (
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
            <div className="hw-panel flex flex-col items-center gap-2 overflow-hidden p-4" role="presentation" onPointerDown={(event) => { event.preventDefault(); tap(); }}>
                <canvas ref={canvasRef} className="party-pixel block h-auto w-full max-w-[420px]" style={{ aspectRatio: `${CW} / ${CH}` }} aria-hidden="true" />
                <p className="hw-title text-5xl text-[color:var(--hw-amber)]" aria-live="polite">{count}</p>
            </div>
            <button type="button" className="hw-key hw-key-lg w-full" disabled={done} onPointerDown={(event) => { event.preventDefault(); tap(); }}>
                <span className="hw-led is-on" style={{ '--led': '#2EB75E' }} aria-hidden="true" />
                {t('minigame.roulement.tap')}
            </button>
        </div>
    );
}
