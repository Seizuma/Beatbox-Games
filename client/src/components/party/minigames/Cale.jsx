import React, { useEffect, useRef, useState } from 'react';
import { audioContext, sfx } from '../partySfx';
import { isSfxMuted } from '../../../utils/gameSfx';
import { drawText } from '../board/pixelFont';
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
    const [listening, setListening] = useState(true);
    const listeningRef = useRef(true);
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
        // Écran LCD de la loopstation : piste, ligne de frappe, temps qui défilent
        px(ctx, 0, 0, CW, CH, '#04171a');
        for (let x = 0; x < CW; x += 6) px(ctx, x, 0, 1, CH, '#062224');
        px(ctx, 0, 26, CW, 16, '#0a2f2d');
        px(ctx, 0, 25, CW, 1, '#1b5a55');
        px(ctx, 0, 42, CW, 1, '#1b5a55');
        const flash = Math.max(0, 1 - ((elapsed % beatMs) / beatMs) * 3);
        px(ctx, HIT_X - 2, 18, 5, 32, flash > 0.5 ? '#FFFFFF' : '#FFC72C');
        px(ctx, HIT_X - 4, 16, 9, 2, '#FFC72C');
        px(ctx, HIT_X - 4, 50, 9, 2, '#FFC72C');
        for (let k = 0; k < total; k += 1) {
            const x = HIT_X + ((beatTime(k) - elapsed) / beatMs) * SPACING;
            if (x < -8 || x > CW + 8) continue;
            const listen = k < countIn;
            const hit = !listen && offsets.current[k - countIn] != null;
            const color = listen ? '#3fbfae' : hit ? '#2CC873' : '#3E7BFF';
            const light = listen ? '#9ff2e2' : hit ? '#97F2BF' : '#9CC0FF';
            // Petit pad rond, comme les cases du plateau
            for (let j = -6; j <= 6; j += 1) {
                const half = Math.round(Math.sqrt(Math.max(0, 1 - (j / 6.5) ** 2)) * 8);
                px(ctx, x - half - 1, 34 + j, half * 2 + 2, 1, OUT);
            }
            for (let j = -5; j <= 5; j += 1) {
                const half = Math.round(Math.sqrt(Math.max(0, 1 - (j / 5.5) ** 2)) * 7);
                px(ctx, x - half, 34 + j, half * 2, 1, j < -2 ? light : color);
            }
            if (listen) drawText(ctx, ['B', 'T', 'K', 'T'][k], x, 31, OUT, { font: 'tiny', outline: null, shadow: false });
        }
        const nowListening = elapsed < beatTime(countIn) - beatMs / 2;
        if (nowListening !== listeningRef.current) {
            listeningRef.current = nowListening;
            setListening(nowListening);
        }
    });

    return (
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
            <p className={`text-center text-sm font-extrabold uppercase tracking-[0.12em] ${listening ? 'text-[#5FE0C8]' : 'text-[color:var(--px-yellow)]'}`}>
                {listening ? t('minigame.cale.listen') : t('minigame.cale.go')}
            </p>
            <div className="party-panel overflow-hidden p-0" role="presentation" onPointerDown={tap}>
                <canvas ref={canvasRef} className="party-pixel block h-auto w-full" style={{ aspectRatio: `${CW} / ${CH}` }} aria-hidden="true" />
            </div>
            <p className="party-display h-9 text-center text-3xl text-[color:var(--px-yellow)]" aria-live="polite">{feedback || ''}</p>
            <button type="button" className="party-btn party-btn-big w-full" disabled={done} onPointerDown={(event) => { event.preventDefault(); tap(); }}>
                {t('minigame.cale.tap')}
            </button>
        </div>
    );
}
