import React, { useEffect, useRef, useState } from 'react';
import { audioContext, sfx } from '../partySfx';
import { isSfxMuted } from '../../../utils/gameSfx';
import { OUT, px, setupPixelCanvas, useFrame, useOnce, usePressKeys } from './shared';

// Calé : quatre temps d'écoute (B, t, K, t), puis huit temps à frapper.
// Le temps k tombe à (k + 0,5) battements après le début du mini-jeu.
const CW = 180;
const CH = 64;
const HIT_X = 36;
const SPACING = 34;
const COUNT_SOUNDS = ['kick', 'hat', 'snare', 'hat'];

export default function Cale({ minigame, t, clock, onSubmit }) {
    const canvasRef = useRef(null);
    const [done, mark] = useOnce();
    const { beatMs, countIn, beats } = minigame.params;
    const total = countIn + beats;
    const beatTime = (k) => (k + 0.5) * beatMs;
    const offsets = useRef(Array(beats).fill(null));
    const [feedback, setFeedback] = useState(null);
    const scheduled = useRef(false);
    const feedbackTimer = useRef(null);
    const say = (text) => {
        setFeedback(text);
        clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => setFeedback(null), 500);
    };
    useEffect(() => () => clearTimeout(feedbackTimer.current), []);

    // Accompagnement : le décompte en sons de beatbox, puis une charley discrète pour garder le tempo
    useEffect(() => {
        if (scheduled.current || isSfxMuted()) return;
        const c = audioContext();
        if (!c) return;
        scheduled.current = true;
        const elapsedNow = clock();
        for (let k = 0; k < total; k += 1) {
            const delay = (beatTime(k) - elapsedNow) / 1000;
            if (delay < 0) continue;
            sfx(k < countIn ? COUNT_SOUNDS[k % 4] : (k % 2 ? 'hat' : 'kick'), delay);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const finish = () => {
        if (!mark()) return;
        onSubmit({ offsets: offsets.current.map((o) => (o == null ? null : Math.round(o))) });
    };

    const tap = () => {
        if (done) return;
        const elapsed = clock();
        if (elapsed < 0) return;
        let best = -1;
        let bestDist = Infinity;
        for (let j = 0; j < beats; j += 1) {
            if (offsets.current[j] != null) continue;
            const d = Math.abs(elapsed - beatTime(countIn + j));
            if (d < bestDist) { best = j; bestDist = d; }
        }
        sfx('snare');
        if (best < 0 || bestDist > beatMs * 0.45) {
            say(t('minigame.cale.miss'));
            return;
        }
        offsets.current[best] = elapsed - beatTime(countIn + best);
        const label = bestDist < 50 ? t('minigame.cale.perfect') : bestDist < 120 ? t('minigame.cale.good') : t('minigame.cale.miss');
        say(label);
        if (offsets.current.every((o) => o != null)) finish();
    };
    usePressKeys({ onDown: tap });

    useFrame(() => {
        const elapsed = clock();
        if (!done && elapsed > beatTime(total - 1) + beatMs * 0.6) finish();
        const ctx = setupPixelCanvas(canvasRef.current, CW, CH);
        if (!ctx) return;
        px(ctx, 0, 0, CW, CH, '#141833');
        px(ctx, 0, 28, CW, 12, '#1F2550');
        px(ctx, 0, 27, CW, 1, '#3B4480');
        px(ctx, 0, 40, CW, 1, '#3B4480');
        // Ligne de frappe
        const flash = Math.max(0, 1 - ((elapsed % beatMs) / beatMs) * 3);
        px(ctx, HIT_X - 1, 22, 3, 24, flash > 0.5 ? '#FFFFFF' : '#FFC72C');
        for (let k = 0; k < total; k += 1) {
            const x = HIT_X + ((beatTime(k) - elapsed) / beatMs) * SPACING;
            if (x < -6 || x > CW + 6) continue;
            const listening = k < countIn;
            const hit = !listening && offsets.current[k - countIn] != null;
            const color = listening ? '#5A6178' : hit ? '#35C877' : '#FF86B4';
            px(ctx, x - 5, 29, 11, 10, OUT);
            px(ctx, x - 4, 30, 9, 8, color);
            ctx.font = '8px Silkscreen, monospace';
            ctx.textBaseline = 'top';
            ctx.fillStyle = OUT;
            ctx.fillText(listening ? ['B', 't', 'K', 't'][k] : '', x - 2, 30);
        }
        ctx.font = '8px Silkscreen, monospace';
        ctx.fillStyle = '#A9B3DA';
        ctx.fillText(elapsed < beatTime(countIn) - beatMs / 2 ? t('minigame.cale.listen') : t('minigame.cale.go'), 6, 6);
    });

    return (
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
            <div className="party-panel overflow-hidden p-0" role="presentation" onPointerDown={tap}>
                <canvas ref={canvasRef} className="party-pixel block h-auto w-full" style={{ aspectRatio: `${CW} / ${CH}` }} aria-hidden="true" />
            </div>
            <p className="party-font h-8 text-center text-2xl text-[color:var(--px-yellow)]" aria-live="polite">{feedback || ''}</p>
            <button type="button" className="party-btn party-btn-big w-full" disabled={done} onPointerDown={(event) => { event.preventDefault(); tap(); }}>
                {t('minigame.cale.tap')}
            </button>
        </div>
    );
}
