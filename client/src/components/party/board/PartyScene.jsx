import React, { useEffect, useRef } from 'react';
import { FOOT_X, FOOT_Y, PLAYER_COLORS, getFrame } from '../characters/pixelRig';
import { beatIndex, beatPhase } from '../partySfx';
import { DEVICE, getWorld } from './world';
import { BIG_H, focalFor, makeCam, project, renderStage, stageLights } from './stage3d';
import { goldMicSprite } from './live';
import { drawGlows } from './fx';
import { E } from './pix';

// Une vue fixe sur la loopstation, avec des personnages posés sur les gros pads de piste :
// la même scène sert de bannière à l'accueil, de scène au salon et de podium à la fin.
// view : { w, h } taille du pixel art, (x, y) point visé dans le monde, k échelle à ce point,
// pitch inclinaison de la caméra, fy place du point visé à l'écran.
// actors : [{ id, pose, color, x, y, facing, dim }]

/** Gros pads de piste (centres dans le monde) */
export const PADS = [[510, 1008], [755, 1008], [1000, 1008], [1245, 1008], [1490, 1008]];

/** Cadrages, en large et en étroit */
export const VIEWS = {
    hero: { w: 480, h: 380, x: 940, y: 1008, k: 0.85, pitch: 0.45, fy: 0.74 },
    lobby: { w: 880, h: 360, x: 1122, y: 1008, k: 1, pitch: 0.42, fy: 0.76 },
    lobbyNarrow: { w: 560, h: 340, x: 1122, y: 1008, k: 0.6, pitch: 0.5, fy: 0.74 },
    end: { w: 860, h: 420, x: 1122, y: 1008, k: 1, pitch: 0.45, fy: 0.74 },
    endNarrow: { w: 560, h: 420, x: 1122, y: 1008, k: 0.62, pitch: 0.5, fy: 0.72 },
};
export const STAGE_VIEW = VIEWS.hero;

const FEET_H = DEVICE.h + BIG_H;

export function sceneCam(view) {
    const dist = focalFor(view.w, view.h) / view.k;
    return makeCam({ tx: view.x, ty: view.y, th: FEET_H, dist, rise: dist * view.pitch, fy: view.fy, W: view.w, H: view.h });
}

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
        const cam = sceneCam(view);
        let raf = 0;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const draw = (nowMs) => {
            const t = nowMs / 1000;
            const beat = beatPhase(nowMs);
            const info = { beat, kick: Math.max(0, 1 - beat * 3), bi: beatIndex(nowMs), lcd: { big: '01', small: 'BEATBOX PARTY' } };
            const list = renderStage(px, world, cam, { t, info, board, cheering: data.current.cheering });
            const glows = [];
            stageLights(cam, t, info, glows);
            if (data.current.goldMic) {
                const g = data.current.goldMic;
                list.push({ y: g.y, draw: () => {
                    const pr = project(cam, g.x, g.y, FEET_H);
                    if (!pr) return;
                    px.drawImage(goldMicSprite(t), Math.round(pr.sx - 20 * pr.k), Math.round(pr.sy - 58 * pr.k), Math.round(40 * pr.k), Math.round(64 * pr.k));
                    glows.push({ x: pr.sx, y: pr.sy - 30 * pr.k, r: 40 * pr.k, color: '#f2c26a', a: 0.25 });
                } });
            }
            data.current.actors.forEach((a, i) => {
                list.push({ y: a.y, draw: () => {
                    const pr = project(cam, a.x, a.y, a.h != null ? a.h : FEET_H);
                    if (!pr) return;
                    const k = pr.k;
                    px.globalAlpha = 0.5;
                    E(px, pr.sx, pr.sy + 1, 14 * k, Math.max(1.5, (14 * k * (cam.H - FEET_H)) / pr.z), '#050407');
                    const frame = getFrame(a.id, a.pose || 'idle', t + i * 0.41, a.color || PLAYER_COLORS[i % 4], { base: false, facing: a.facing || 1 });
                    px.globalAlpha = a.dim ? 0.35 : 1;
                    px.drawImage(frame, Math.round(pr.sx - FOOT_X * k), Math.round(pr.sy - FOOT_Y * k), Math.round(64 * k), Math.round(96 * k));
                    px.globalAlpha = 1;
                } });
            });
            list.sort((a, b) => a.y - b.y).forEach((d) => d.draw());
            if (data.current.stageColor) {
                const pr = project(cam, view.x, view.y, FEET_H);
                if (pr) glows.push({ beam: true, x: pr.sx, y: pr.sy - 200 * pr.k, w: 60 * pr.k, len: 220 * pr.k, color: '#fff0d8', a: 0.12 });
            }

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
            gx.setTransform(k, 0, 0, k, 0, 0);
            drawGlows(gx, glows);
            if (!reduce) raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
        // La vue est décrite par ses valeurs
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [board, view.w, view.h, view.x, view.y, view.k]);

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

/**
 * Position (en %) d'un point du monde dans la scène (pieds sur un gros pad), pour y poser du HTML.
 * Près des bords, l'étiquette s'ancre sur son bord gauche ou droit pour ne pas être coupée.
 */
export function scenePoint(view, x, y) {
    const pr = project(sceneCam(view), x, y, FEET_H);
    if (!pr) return { left: '50%', top: '50%' };
    const left = Math.max(1, Math.min(99, (pr.sx / view.w) * 100));
    const anchor = left < 14 ? 0 : left > 86 ? 100 : 50;
    return { left: `${left}%`, top: `${(pr.sy / view.h) * 100}%`, transform: `translate(-${anchor}%, 0.35rem)` };
}
