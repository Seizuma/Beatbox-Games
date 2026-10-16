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
        // Ombre, puis la bouteille d'eau (le beatboxer boit beaucoup)
        ctx.globalAlpha = 0.45;
        px(ctx, 16, 98, 32, 3, '#000000');
        ctx.globalAlpha = 1;
        px(ctx, 19, 22, 26, 76, OUT);
        px(ctx, 26, 6, 12, 18, OUT);
        px(ctx, 21, 24, 22, 72, '#1B2A5E');
        px(ctx, 28, 8, 8, 18, '#1B2A5E');
        // Eau
        const top = Math.max(8, Math.round(BOTTOM - level * (BOTTOM - LINE)));
        for (let y = top; y < BOTTOM; y += 1) {
            const inNeck = y < 26;
            const deep = (y - top) / Math.max(1, BOTTOM - top);
            px(ctx, inNeck ? 28 : 21, y, inNeck ? 8 : 22, 1, y === top ? '#D6F2FF' : deep < 0.15 ? '#7FD0FF' : '#3E9BF0');
        }
        // Bulles
        const now = performance.now();
        if (holdStart.current != null) for (let b = 0; b < 4; b += 1) px(ctx, 25 + b * 4, BOTTOM - ((now / 8 + b * 17) % Math.max(1, BOTTOM - top)), 1, 1, '#D6F2FF');
        // Reflets du plastique, étiquette à l'onde sonore
        px(ctx, 23, 28, 2, 60, 'rgba(255,255,255,0.28)');
        px(ctx, 40, 30, 1, 50, 'rgba(255,255,255,0.12)');
        px(ctx, 21, 60, 22, 14, '#FFC72C');
        px(ctx, 21, 60, 22, 1, '#FFE07A');
        px(ctx, 21, 73, 22, 1, '#C98A00');
        [3, 6, 9, 5, 8, 4].forEach((h, i) => px(ctx, 25 + i * 3, 67 - Math.floor(h / 2), 1, h, '#0A1B45'));
        // Trait
        for (let x = 10; x < 54; x += 4) px(ctx, x, LINE, 2, 1, '#FFC72C');
        // Débordement
        if (level > 1.12) {
            const k = Math.floor(now / 90) % 4;
            px(ctx, 24 - k, 4 + k * 2, 2, 2, '#7FD0FF');
            px(ctx, 40 + k, 6 + k * 3, 2, 2, '#7FD0FF');
        }
        px(ctx, 25, 1, 14, 6, OUT);
        px(ctx, 26, 2, 12, 4, '#E8402F');
        px(ctx, 26, 2, 12, 1, '#FF8A7A');
    });

    const label = result === 'overflow' ? t('minigame.display.overflow') : result != null ? t('minigame.display.percent', { n: result }) : null;
    return (
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
            <div className="hw-panel flex flex-col items-center gap-2 p-4" style={{ background: 'radial-gradient(circle at 50% 30%, #2a2a30 0%, #141416 70%)' }}>
                <div className="relative">
                    <canvas ref={canvasRef} className="party-pixel" style={{ width: CW * 3, height: CH * 3 }} aria-hidden="true" />
                    <span className="absolute right-[-4.5rem] text-xs font-extrabold text-[color:var(--hw-amber)]" style={{ top: LINE * 3 - 8 }}>{t('minigame.gorgee.line')}</span>
                </div>
                {label && <p className={`hw-title text-3xl ${result === 'overflow' ? 'text-[color:var(--hw-red)]' : 'text-[color:var(--hw-amber)]'}`}>{label}</p>}
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
