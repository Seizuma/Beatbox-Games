import React, { useRef, useState } from 'react';
import { sfx } from '../partySfx';
import { OUT, px, setupPixelCanvas, useFrame, useOnce, usePressKeys } from './shared';

// Mic drop : le micro se balance (même mouvement que le calcul du serveur),
// on le lâche pour qu'il tombe sur la cible au centre.
const CW = 160;
const CH = 100;
const FLOOR = 84;
const MIC = ['.yyy.', 'yYyYy', 'yyYyy', '.ddd.', '..k..', '..k..', '..k..', '..k..'];

const position = (params, t) => Math.sin((t / params.period) * Math.PI * 2 + params.phase);

export default function MicDrop({ minigame, t, clock, onSubmit }) {
    const canvasRef = useRef(null);
    const [done, mark] = useOnce();
    const dropped = useRef(null); // { atMs, x, perf }
    const [score, setScore] = useState(null);
    const { params } = minigame;

    const press = () => {
        const elapsed = clock();
        if (done || elapsed < 0 || elapsed > params.duration) return;
        mark();
        const pos = position(params, elapsed);
        dropped.current = { atMs: Math.round(elapsed), x: 80 + pos * 62, perf: performance.now() };
        setTimeout(() => {
            setScore(Math.round((1 - Math.abs(pos)) * 100));
            sfx(Math.abs(pos) < 0.12 ? 'star' : 'kick');
        }, 380);
        onSubmit({ atMs: Math.round(elapsed) });
    };
    usePressKeys({ onDown: press });

    useFrame(() => {
        const ctx = setupPixelCanvas(canvasRef.current, CW, CH);
        if (!ctx) return;
        const elapsed = Math.max(0, clock());
        ctx.clearRect(0, 0, CW, CH);
        px(ctx, 0, 0, CW, CH, '#141833');
        // Projecteurs
        ctx.fillStyle = 'rgba(255,230,160,0.08)';
        ctx.beginPath();
        ctx.moveTo(60, 0); ctx.lineTo(30, FLOOR); ctx.lineTo(130, FLOOR); ctx.lineTo(100, 0); ctx.fill();
        // Scène et cible
        px(ctx, 0, FLOOR, CW, CH - FLOOR, '#7A5236');
        for (let x = 0; x < CW; x += 12) px(ctx, x, FLOOR + 6, 10, 1, '#664430');
        px(ctx, 0, FLOOR, CW, 1, OUT);
        [[28, '#F0533F'], [18, '#FFFFFF'], [10, '#F0533F'], [3, '#FFC72C']].forEach(([w, c]) => px(ctx, 80 - w, FLOOR + 2, w * 2, 3, c));
        // Câble et micro
        let mx;
        let my;
        if (dropped.current) {
            const k = Math.min(1, (performance.now() - dropped.current.perf) / 380);
            mx = dropped.current.x;
            my = 18 + k * k * (FLOOR - 26);
        } else {
            mx = 80 + position(params, elapsed) * 62;
            my = 18;
            for (let y = 0; y < my; y += 2) px(ctx, 80 + (mx - 80) * (y / my), y, 1, 1, '#5A6178');
        }
        MIC.forEach((row, j) => {
            for (let i = 0; i < row.length; i += 1) {
                const c = { y: '#C9D2EE', Y: '#EEF1FA', d: '#8C97BC', k: '#2B3150' }[row[i]];
                if (c) px(ctx, mx - 2 + i, my + j, 1, 1, c);
            }
        });
    });

    return (
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
            <div className="party-panel flex flex-col items-center gap-2 overflow-hidden p-0" role="presentation" onPointerDown={press}>
                <canvas ref={canvasRef} className="party-pixel block h-auto w-full" style={{ aspectRatio: `${CW} / ${CH}` }} aria-hidden="true" />
            </div>
            {score != null && <p className="party-font text-center text-2xl">{t('minigame.display.percent', { n: score })}</p>}
            <button type="button" className="party-btn party-btn-big w-full" disabled={done} onPointerDown={(event) => { event.preventDefault(); press(); }}>
                {t('minigame.micdrop.drop')}
            </button>
        </div>
    );
}
