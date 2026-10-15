import React, { useEffect, useRef } from 'react';
import { FOOT_X, FOOT_Y, PLAYER_COLORS, getFrame } from '../characters/pixelRig';
import { beatIndex, beatPhase } from '../partySfx';
import { getWorld, SPACE_COLORS } from './world';
import { drawCrowd, drawGoldMic, drawShadow, drawWorldLive } from './live';
import { drawAmbient, drawGlows } from './fx';

// Une fenêtre sur le décor du plateau, avec des personnages posés dessus :
// la même scène sert de bannière à l'accueil, de scène au salon et de podium à la fin.
// view : { x, y, w, h } en pixels du décor ; actors : [{ id, pose, color, x, y, facing }]

/** Cadrages de la scène du micro géant (accueil, salon, fin), en large et en étroit */
export const VIEWS = {
    hero: { x: 590, y: 14, w: 420, h: 350 },
    lobby: { x: 560, y: 150, w: 520, h: 240 },
    lobbyNarrow: { x: 636, y: 166, w: 344, h: 224 },
    end: { x: 540, y: 60, w: 560, h: 320 },
    endNarrow: { x: 606, y: 96, w: 388, h: 284 },
};
export const STAGE_VIEW = VIEWS.hero;

export default function PartyScene({ board, view = STAGE_VIEW, actors = [], stageColor = null, goldMic = null, cheering = false, className = '', children }) {
    const pixelRef = useRef(null);
    const glowRef = useRef(null);
    const data = useRef({ actors, stageColor, goldMic, cheering });
    data.current = { actors, stageColor, goldMic, cheering };

    useEffect(() => {
        if (!board) return undefined;
        const pixel = pixelRef.current;
        const glowCv = glowRef.current;
        const px = pixel.getContext('2d');
        const gx = glowCv.getContext('2d');
        pixel.width = view.w;
        pixel.height = view.h;
        const world = getWorld(board);
        let raf = 0;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const draw = (nowMs) => {
            const t = nowMs / 1000;
            const beat = beatPhase(nowMs);
            const info = { beat, kick: Math.max(0, 1 - beat * 3), bi: beatIndex(nowMs), stageColor: data.current.stageColor, cheering: data.current.cheering };
            px.setTransform(1, 0, 0, 1, -view.x, -view.y);
            px.imageSmoothingEnabled = false;
            px.drawImage(world.canvas, 0, 0);
            const glows = [];
            drawWorldLive(px, t, info, glows);
            board.spaces.forEach((space) => {
                const c = SPACE_COLORS[space.type] || SPACE_COLORS.blue;
                glows.push({ x: space.x, y: space.y - 2, r: 26, color: c.glow, a: 0.3, squash: 0.7 });
            });
            const list = [{ y: 420, draw: () => drawCrowd(px, t, info) }];
            if (data.current.goldMic) {
                const g = data.current.goldMic;
                list.push({ y: g.y, draw: () => drawGoldMic(px, g.x, g.y - 2, t) });
                glows.push({ x: g.x, y: g.y - 30, r: 54, color: '#FFC72C', a: 0.6 });
            }
            data.current.actors.forEach((a, i) => {
                list.push({ y: a.y, draw: () => {
                    drawShadow(px, a.x, a.y + 1, 13, 4.5, 0.5);
                    const frame = getFrame(a.id, a.pose || 'idle', t + i * 0.41, a.color || PLAYER_COLORS[i % 4], { base: false, facing: a.facing || 1 });
                    px.globalAlpha = a.dim ? 0.35 : 1;
                    px.drawImage(frame, Math.round(a.x - FOOT_X), Math.round(a.y - FOOT_Y));
                    px.globalAlpha = 1;
                } });
            });
            list.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

            // Agrandi : pixels nets ; réduit (petit écran) : lissé pour ne pas perdre de pixels
            const shown = pixel.clientWidth / view.w;
            const rendering = shown >= 1 ? 'pixelated' : 'auto';
            if (pixel.style.imageRendering !== rendering) pixel.style.imageRendering = rendering;

            // Lumières, à la résolution de l'affichage
            const k = Math.min(1.5, window.devicePixelRatio || 1) * (pixel.clientWidth / view.w || 1);
            const W = Math.max(1, Math.round(view.w * k));
            const H = Math.max(1, Math.round(view.h * k));
            if (glowCv.width !== W) glowCv.width = W;
            if (glowCv.height !== H) glowCv.height = H;
            gx.setTransform(1, 0, 0, 1, 0, 0);
            gx.clearRect(0, 0, W, H);
            gx.setTransform(k, 0, 0, k, -view.x * k, -view.y * k);
            drawAmbient(gx, t, info);
            drawGlows(gx, glows);
            if (!reduce) raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, [board, view.x, view.y, view.w, view.h]);

    return (
        <div className={`party-scene ${className}`} style={{ aspectRatio: `${view.w} / ${view.h}` }}>
            {board ? (
                <>
                    <canvas ref={pixelRef} className="party-scene-pixel" aria-hidden="true" />
                    <canvas ref={glowRef} className="party-scene-glow" aria-hidden="true" />
                </>
            ) : null}
            {children}
        </div>
    );
}

/** Position (en %) d'un point du décor dans la scène, pour y poser du HTML */
export function scenePoint(view, x, y) {
    return { left: `${((x - view.x) / view.w) * 100}%`, top: `${((y - view.y) / view.h) * 100}%` };
}
