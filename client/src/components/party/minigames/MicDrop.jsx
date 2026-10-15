import React, { useRef, useState } from 'react';
import { sfx } from '../partySfx';
import { getWorld } from '../board/world';
import { OUT, px, setupPixelCanvas, useFrame, useOnce, usePressKeys } from './shared';

// Mic drop : un micro se balance au-dessus de la loopstation (même mouvement que le
// calcul du serveur) ; on le lâche pour qu'il tombe pile sur le pad de la piste 3.
// Le décor est celui du plateau, vu de près.
const VIEW = { x: 430, y: 572, w: 320, h: 200 };
const CW = VIEW.w;
const CH = VIEW.h;
const TARGET = { x: 590 - VIEW.x, y: 742 - VIEW.y };
const RANGE = 128;
const HANG = 16;

// Micro dynamique vu de face, boule en haut
const MIC = [
    '...OOOOO...',
    '..OWWwwwO..',
    '.OWwWwWwdO.',
    '.OwWwWwWdO.',
    '.OWwWwWwdO.',
    '..OddddddO.',
    '..OYYYYYO..',
    '...OkkkO...',
    '...OkKkO...',
    '...OkKkO...',
    '...OkKkO...',
    '...OkkkO...',
    '....OkO....',
    '....OOO....',
];
const PAL = { O: OUT, W: '#F4F7FF', w: '#C3CBE6', d: '#7E89AE', Y: '#FFC72C', k: '#262A40', K: '#4A5070' };

const position = (params, t) => Math.sin((t / params.period) * Math.PI * 2 + params.phase);

// Dessiné en pixels doubles : bien visible même sur téléphone
function drawMic(ctx, x, y) {
    MIC.forEach((row, j) => {
        for (let i = 0; i < row.length; i += 1) {
            const c = PAL[row[i]];
            if (c) px(ctx, x - 11 + i * 2, y + j * 2, 2, 2, c);
        }
    });
}

export default function MicDrop({ board, minigame, t, clock, onSubmit }) {
    const canvasRef = useRef(null);
    const [done, mark] = useOnce();
    const dropped = useRef(null); // { atMs, x, perf, hit }
    const [score, setScore] = useState(null);
    const { params } = minigame;
    const world = board ? getWorld(board) : null;

    const press = () => {
        const elapsed = clock();
        if (done || elapsed < 0 || elapsed > params.duration) return;
        mark();
        const pos = position(params, elapsed);
        dropped.current = { atMs: Math.round(elapsed), x: TARGET.x + pos * RANGE, perf: performance.now(), good: Math.abs(pos) < 0.12 };
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
        if (world) ctx.drawImage(world.canvas, VIEW.x, VIEW.y, CW, CH, 0, 0, CW, CH);
        else px(ctx, 0, 0, CW, CH, '#0A0F27');
        // Le pad cible clignote, avec un anneau de visée
        const pulse = Math.floor(performance.now() / 250) % 2;
        for (let a = 0; a < Math.PI * 2; a += 0.05) {
            px(ctx, TARGET.x + Math.cos(a) * (30 + pulse), TARGET.y + 1 + Math.sin(a) * (19 + pulse), 1, 1, '#FFC72C');
        }
        // Câble et micro
        let mx;
        let my;
        const d = dropped.current;
        if (d) {
            const k = Math.min(1, (performance.now() - d.perf) / 380);
            mx = d.x;
            my = HANG + k * k * (TARGET.y - 28 - HANG);
            if (k >= 1) {
                // Impact : onde sur le pad
                const age = performance.now() - d.perf - 380;
                if (age < 500) {
                    const r = 6 + age / 12;
                    ctx.globalAlpha = 1 - age / 500;
                    for (let a = 0; a < Math.PI * 2; a += 0.08) px(ctx, mx + Math.cos(a) * r, TARGET.y + Math.sin(a) * r * 0.6, 2, 1, d.good ? '#FFE07A' : '#FFFFFF');
                    ctx.globalAlpha = 1;
                }
            }
        } else {
            mx = TARGET.x + position(params, elapsed) * RANGE;
            my = HANG;
            const top = [TARGET.x, -2];
            for (let s = 0; s <= 1; s += 0.02) px(ctx, top[0] + (mx - top[0]) * s, top[1] + (my - top[1]) * s, 2, 2, '#0c0e17');
        }
        // Ombre du micro sur la loopstation
        ctx.globalAlpha = 0.4;
        px(ctx, mx - 10, TARGET.y + 2, 20, 4, '#000000');
        ctx.globalAlpha = 1;
        drawMic(ctx, Math.round(mx), Math.round(my));
    });

    return (
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
            <div className="party-panel overflow-hidden p-0" role="presentation" onPointerDown={press}>
                <canvas ref={canvasRef} className="party-pixel block h-auto w-full" style={{ aspectRatio: `${CW} / ${CH}` }} aria-hidden="true" />
            </div>
            {score != null && <p className="party-display text-center text-3xl text-[color:var(--px-yellow)]">{t('minigame.display.percent', { n: score })}</p>}
            <button type="button" className="party-btn party-btn-big w-full" disabled={done} onPointerDown={(event) => { event.preventDefault(); press(); }}>
                {t('minigame.micdrop.drop')}
            </button>
        </div>
    );
}
