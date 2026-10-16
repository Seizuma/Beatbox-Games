import React, { useEffect, useRef, useState } from 'react';
import { audioContext, sfx } from '../partySfx';
import { isSfxMuted } from '../../../utils/gameSfx';
import { drawText } from '../board/pixelFont';
import { OUT, px, setupPixelCanvas, useFrame, useOnce, usePressKeys } from './shared';

// Boucle à deux (deux contre deux) : dans chaque équipe, l'un tient le kick (temps pairs),
// l'autre la caisse claire (temps impairs). Après 4 temps d'écoute, 16 temps : chacun frappe
// ses 8 temps. Le temps k tombe à (k + 0,5) battements après le début.
const CW = 220;
const CH = 64;
const HIT_X = 40;
const SPACING = 30;

export default function Loop2({ minigame, myId, t, clock, onSubmit }) {
    const canvasRef = useRef(null);
    const [done, mark] = useOnce();
    const { beatMs, countIn, beats, hits, roles } = minigame.params;
    const role = roles[myId] || 'kick';
    const total = countIn + beats;
    const beatTime = (k) => (k + 0.5) * beatMs;
    // Mes temps : kick sur les temps pairs, caisse claire sur les impairs
    const myBeats = Array.from({ length: hits }, (_, j) => countIn + j * 2 + (role === 'kick' ? 0 : 1));
    const offsets = useRef(Array(hits).fill(null));
    const [feedback, setFeedback] = useState(null);
    const scheduled = useRef(false);
    const timer = useRef(null);
    const say = (text) => {
        setFeedback(text);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setFeedback(null), 450);
    };
    useEffect(() => () => clearTimeout(timer.current), []);

    // Décompte, puis une charley discrète ; la partie de l'équipier n'est pas jouée (chacun la sienne)
    useEffect(() => {
        if (scheduled.current || isSfxMuted() || !audioContext()) return;
        scheduled.current = true;
        const now = clock();
        for (let k = 0; k < total; k += 1) {
            const delay = (beatTime(k) - now) / 1000;
            if (delay >= 0) sfx(k < countIn ? ['kick', 'hat', 'snare', 'hat'][k % 4] : 'hat', delay);
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
        sfx(role === 'kick' ? 'kick' : 'snare');
        let best = -1;
        let bestDist = Infinity;
        myBeats.forEach((k, j) => {
            if (offsets.current[j] != null) return;
            const d = Math.abs(elapsed - beatTime(k));
            if (d < bestDist) { best = j; bestDist = d; }
        });
        if (best < 0 || bestDist > beatMs * 0.6) { say(t('minigame.cale.miss')); return; }
        offsets.current[best] = elapsed - beatTime(myBeats[best]);
        say(bestDist < 50 ? t('minigame.cale.perfect') : bestDist < 120 ? t('minigame.cale.good') : t('minigame.cale.miss'));
        if (offsets.current.every((o) => o != null)) finish();
    };
    usePressKeys({ onDown: tap });

    useFrame(() => {
        const elapsed = clock();
        if (!done && elapsed > beatTime(total - 1) + beatMs * 0.7) finish();
        const ctx = setupPixelCanvas(canvasRef.current, CW, CH);
        if (!ctx) return;
        px(ctx, 0, 0, CW, CH, '#04171a');
        for (let x = 0; x < CW; x += 6) px(ctx, x, 0, 1, CH, '#062224');
        px(ctx, 0, 26, CW, 16, '#0a2f2d');
        const flash = Math.max(0, 1 - ((elapsed % beatMs) / beatMs) * 3);
        px(ctx, HIT_X - 2, 18, 5, 32, flash > 0.5 ? '#FFFFFF' : '#FFC72C');
        for (let k = 0; k < total; k += 1) {
            const x = HIT_X + ((beatTime(k) - elapsed) / beatMs) * SPACING;
            if (x < -10 || x > CW + 10) continue;
            const listen = k < countIn;
            const kickBeat = (k - countIn) % 2 === 0;
            const mine = !listen && (role === 'kick' ? kickBeat : !kickBeat);
            const j = myBeats.indexOf(k);
            const hit = j >= 0 && offsets.current[j] != null;
            const color = listen ? '#3fbfae' : !mine ? '#33364a' : hit ? '#2CC873' : kickBeat ? '#F0AE22' : '#E2402F';
            const r = mine ? 7 : 4;
            for (let dy = -r; dy <= r; dy += 1) {
                const half = Math.round(Math.sqrt(Math.max(0, 1 - (dy / (r + 0.5)) ** 2)) * (r + 1));
                px(ctx, x - half - 1, 34 + dy, half * 2 + 2, 1, OUT);
                px(ctx, x - half, 34 + dy, half * 2, 1, color);
            }
            if (mine) drawText(ctx, kickBeat ? 'B' : 'P', x, 31, OUT, { font: 'tiny', outline: null, shadow: false });
        }
    });

    return (
        <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4">
            <p className="text-center text-sm font-extrabold uppercase tracking-[0.12em] text-[color:var(--hw-amber)]">{t(`minigame.loop2.${role}`)}</p>
            <div className="hw-panel overflow-hidden p-0" role="presentation" onPointerDown={(event) => { event.preventDefault(); tap(); }}>
                <canvas ref={canvasRef} className="party-pixel block h-auto w-full" style={{ aspectRatio: `${CW} / ${CH}` }} aria-hidden="true" />
            </div>
            <p className="hw-title h-9 text-center text-3xl text-[color:var(--hw-amber)]" aria-live="polite">{feedback || ''}</p>
            <button type="button" className="hw-key hw-key-lg w-full" disabled={done} onPointerDown={(event) => { event.preventDefault(); tap(); }}>
                <span className="hw-led is-on" style={{ '--led': role === 'kick' ? '#F0AE22' : '#E2402F' }} aria-hidden="true" />
                {t(`minigame.loop2.tap.${role}`)}
            </button>
        </div>
    );
}
