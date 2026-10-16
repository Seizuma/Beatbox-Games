import React, { useEffect, useRef } from 'react';
import { DICE_HIT_Y, FOOT_X, FOOT_Y, MIC_MOUTH, PLAYER_COLORS, beatboxHit, getFrame } from '../characters/pixelRig';
import { beatIndex, beatPhase, sfx } from '../partySfx';
import { getWorld, SPACE_COLORS, WORLD_H, WORLD_W } from './world';
import { drawArrow, drawBadge, drawBurst, drawCoin, drawCrowd, drawGoldMic, drawLoopDie, drawRing, drawShadow, drawWorldLive, lightRing } from './live';
import { drawAmbient, drawBeam, drawGlows, drawShade, drawSoundWaves } from './fx';
import { drawText } from './pixelFont';

// Le plateau « Le Setup », avec une caméra de jeu à la Mario Party :
// - au tour d'un joueur, la caméra zoome sur lui (zoom entier : les pixels restent nets)
//   et le suit pendant qu'il saute de pad en pad ; un projecteur l'isole du reste ;
// - les autres joueurs s'effacent (pastille à leur couleur, avec leur numéro de passage) ;
// - au carrefour, des flèches montrent les routes (cliquables) ;
// - elle montre le Micro d'or au début de la partie et quand il change de place ;
// - la vue « Carte » montre tout le plateau et tous les joueurs.
//
// Trois canvas superposés : le pixel art (résolution du décor, agrandi sans lissage),
// les lumières (résolution de l'écran, mode « screen ») et l'ombre (vignette, projecteur).

const HOP_T = 0.6;
const ORDINAL_OFFSETS = [[-15, -4], [15, -4], [-15, 8], [15, 8]];
// Plusieurs joueurs sur un même pad : en formation, à l'intérieur de l'anneau
const ORDER_LINE = {
    2: [[-17, 0], [17, 0]],
    3: [[-32, 2], [0, -2], [32, 2]],
    4: [[-46, 2], [-15, -2], [15, 2], [46, -2]],
};
const FORMATIONS = {
    2: [[-13, 0], [13, 0]],
    3: [[-14, -5], [14, -5], [0, 6]],
    4: [[-15, -6], [15, -6], [-15, 6], [15, 6]],
};

// Directions des routes proposées au carrefour (pour les boutons et le clavier)
export function choiceDirections(state) {
    if (!state.choice) return [];
    const here = state.board.spaces[state.choice.at];
    return state.choice.options.map((o) => {
        const next = state.board.spaces[o.spaceId];
        const dx = next.x - here.x;
        const dy = next.y - here.y;
        const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        return { ...o, dir };
    });
}

const DIR_VEC = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };

export default function PartyBoard({ state, queue, myId, mapMode = false, onEvent, onChoose, insets = null }) {
    const wrapRef = useRef(null);
    const pixelRef = useRef(null);
    const glowRef = useRef(null);
    const shadeRef = useRef(null);
    const props = useRef({ mapMode, onEvent, onChoose, myId, insets });
    props.current = { mapMode, onEvent, onChoose, myId, insets };
    const live = useRef({
        state,
        anims: {},
        poses: {},
        facing: {},
        floats: [],
        flashes: [],
        dice: null,
        counters: {},
        rollTotals: {},
        lastSeq: 0,
        prevSpaces: null,
        cam: { x: WORLD_W / 2, y: WORLD_H / 2, s: 1, ready: false },
        focusStarUntil: 0,
        focusStarDelay: 0,
        cheerUntil: 0,
        shakeUntil: 0,
        particles: [],
        rings: [],
        arrows: [],
        last: 0,
        view: null,
    });

    useEffect(() => {
        live.current.state = state;
    }, [state]);

    // Chaque instantané reçu passe ici, même ceux arrivés dans le même paquet réseau
    const processSnapshot = (snap, now) => {
        const L = live.current;
        const event = snap.event;
        const previous = L.prevSpaces;
        L.prevSpaces = Object.fromEntries(snap.players.map((p) => [p.id, p.space]));
        if (!event || event.seq <= L.lastSeq) return;
        L.lastSeq = event.seq;
        // Événement trop ancien (plateau affiché après coup, retour d'un mini-jeu) : rien à animer
        if (Date.now() - (event.at || 0) > 2500) return;
        const player = snap.players.find((p) => p.id === event.playerId);
        const spaceOf = (id) => snap.board.spaces[id];
        const float = (text, color, spaceId, delay = 0, coin = false) => {
            if (spaceId == null) return;
            const sp = spaceOf(spaceId);
            L.floats.push({ text, color, x: sp.x, y: sp.y - 104, start: now + delay, coin });
        };
        // Confettis (achat du Micro d'or, Drop) et ondes de choc
        const confetti = (spaceId, colors, n = 36, delay = 0) => {
            const sp = spaceOf(spaceId);
            if (!sp) return;
            for (let i = 0; i < n; i += 1) {
                const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
                const v = 90 + Math.random() * 140;
                L.particles.push({ x: sp.x, y: sp.y - 50, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color: colors[i % colors.length], born: now + delay, life: 1400 + Math.random() * 700 });
            }
        };
        // Poses imposées, éventuellement à la suite (Larsen : sursaut puis déception)
        const pose = (id, name, ms, delay = 0) => {
            const keep = delay > 0 ? (L.poses[id] || []).filter((o) => o.until > now) : [];
            L.poses[id] = keep.concat({ pose: name, start: now + delay, until: now + delay + ms });
        };
        switch (event.type) {
            case 'turn':
                pose(event.playerId, 'present', 1700);
                break;
            case 'roll':
                L.dice = { playerId: event.playerId, value: event.value, at: now };
                L.counters[event.playerId] = event.value;
                L.rollTotals[event.playerId] = event.value;
                pose(event.playerId, 'diceHit', 1000);
                sfx('hit', 0.3);
                break;
            case 'move': {
                const hopMs = event.hopMs || 340;
                const from = previous && previous[event.playerId] != null ? previous[event.playerId] : null;
                const startLeft = L.counters[event.playerId] != null ? L.counters[event.playerId] : event.path.length;
                L.anims[event.playerId] = { path: event.path, from, start: now, hopMs, startLeft };
                L.counters[event.playerId] = Math.max(0, startLeft - event.path.length);
                event.path.forEach((id, i) => {
                    sfx('step', (i * hopMs + hopMs * 0.8) / 1000);
                    L.flashes.push({ spaceId: id, at: now + i * hopMs + hopMs * 0.85 });
                });
                (event.effects || []).forEach((effect) => {
                    if (effect.type === 'tip') float(`-${effect.amount}`, ['#FFB4A8', '#E8402F'], event.path[effect.step], effect.step * hopMs, true);
                });
                break;
            }
            case 'land':
                if (event.delta > 0) { float(`+${event.delta}`, ['#FFF2B0', '#FFC72C'], event.spaceId, 0, true); sfx('coin'); }
                if (event.delta < 0) { float(`${event.delta}`, ['#FFB4A8', '#E8402F'], event.spaceId, 0, true); sfx('loss'); }
                if (event.kind === 'drop') {
                    sfx('drop');
                    L.cheerUntil = now + 2000;
                    L.rings.push({ spaceId: event.spaceId, at: now, color: '#2EB75E' });
                    confetti(event.spaceId, ['#2EB75E', '#93E8B2', '#F2F0EA'], 28);
                }
                if (event.kind === 'red') {
                    L.shakeUntil = now + 420;
                    L.rings.push({ spaceId: event.spaceId, at: now, color: '#E2402F' });
                }
                if (event.delta < 0) {
                    pose(event.playerId, 'shock', 700);
                    pose(event.playerId, 'sad', 1100, 700);
                } else pose(event.playerId, event.kind === 'drop' ? 'cheer' : 'fist', 1500);
                L.counters[event.playerId] = null;
                L.dice = null;
                break;
            case 'chose':
                if (event.paid) float(`-${event.paid}`, ['#FFB4A8', '#E8402F'], player && player.space, 0, true);
                break;
            case 'star':
                if (event.bought) {
                    float('+1', ['#FFF2B0', '#FFC72C'], player && player.space);
                    if (player) confetti(player.space, ['#F0AE22', '#E2402F', '#3F7EEA', '#2EB75E', '#F2F0EA'], 60);
                    pose(event.playerId, 'cheer', 2400);
                    L.cheerUntil = now + 2600;
                    L.focusStarUntil = now + 2800;
                    L.focusStarDelay = now + 1000;
                    sfx('star');
                }
                break;
            case 'starIntro':
                sfx('reveal');
                break;
            default:
        }
        if (props.current.onEvent) props.current.onEvent(event, snap);
    };

    useEffect(() => {
        const L = live.current;
        const pixel = pixelRef.current;
        const glowCv = glowRef.current;
        const shadeCv = shadeRef.current;
        const px = pixel.getContext('2d');
        const gx = glowCv.getContext('2d');
        const sx = shadeCv.getContext('2d');
        let raf = 0;
        let alive = true;
        const world = getWorld(L.state.board);

        // Position affichée d'un joueur (animée pendant ses sauts de pad en pad)
        const actorOf = (s, p, nowMs) => {
            const a = L.anims[p.id];
            const here = s.board.spaces[p.space];
            let pos = [here.x, here.y];
            let lift = 0;
            let moving = false;
            let left = null;
            let hopK = 0;
            if (a) {
                const elapsed = nowMs - a.start;
                const hop = Math.floor(elapsed / a.hopMs);
                if (hop < a.path.length && a.from != null) {
                    const k = (elapsed % a.hopMs) / a.hopMs;
                    const fromId = hop === 0 ? a.from : a.path[hop - 1];
                    const p0 = s.board.spaces[fromId];
                    const p1 = s.board.spaces[a.path[hop]];
                    pos = [p0.x + (p1.x - p0.x) * k, p0.y + (p1.y - p0.y) * k];
                    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
                    lift = Math.sin(k * Math.PI) * (12 + dist * 0.14);
                    if (Math.abs(p1.x - p0.x) > 6) L.facing[p.id] = p1.x > p0.x ? 1 : -1;
                    moving = true;
                    hopK = k;
                    left = Math.max(0, a.startLeft - hop - (k > 0.8 ? 1 : 0));
                }
            }
            // Arrêt en route (carrefour, Micro d'or) : le compteur reste affiché
            if (!moving && L.counters[p.id] > 0) left = L.counters[p.id];
            return { p, pos, lift, moving, left, hopK };
        };

        const sizeCanvas = (cv, w, h) => {
            if (cv.width !== w) cv.width = w;
            if (cv.height !== h) cv.height = h;
        };

        const draw = (nowMs) => {
            if (!alive) return;
            const dt = Math.min(0.5, (nowMs - (L.last || nowMs)) / 1000);
            L.last = nowMs;
            if (queue && queue.current.length) {
                const pending = queue.current.splice(0, queue.current.length);
                pending.forEach((snap) => processSnapshot(snap, nowMs));
            }
            const s = L.state;
            const t = nowMs / 1000;
            const { mapMode: map, myId: me } = props.current;
            const wrap = wrapRef.current;
            if (!wrap) { raf = requestAnimationFrame(draw); return; }
            const cw = wrap.clientWidth;
            const ch = wrap.clientHeight;
            const beat = beatPhase(nowMs);
            const kick = Math.max(0, 1 - beat * 3);
            const bi = beatIndex(nowMs);
            const stageOwner = s.stageOwner && s.players.find((p) => p.id === s.stageOwner);
            const info = { beat, kick, bi, stageColor: stageOwner ? PLAYER_COLORS[stageOwner.seat] : null, bpm: s.finale ? 112 : 96, cheering: L.cheerUntil > nowMs };

            const currentId = s.phase === 'turn' ? s.currentPlayerId : null;
            const actors = s.players.filter((p) => p.space != null).map((p) => actorOf(s, p, nowMs));
            const activeActor = actors.find((a) => a.p.id === currentId);
            const showAll = map || !activeActor;

            // ---------------- Caméra ----------------
            const ins0 = props.current.insets || { top: 0, bottom: 0 };
            const fit = Math.min(cw / WORLD_W, Math.max(ch * 0.5, ch - (ins0.top || 0) - (ins0.bottom || 0)) / WORLD_H);
            // Zoom entier : 2 sur téléphone et petit écran, 3 sur un écran d'ordinateur, 4 sur un grand écran
            const follow = cw < 640 ? 2 : Math.max(2, Math.min(4, Math.floor(Math.min(ch / 280, cw / 520))));
            const starSpace = s.starSpace != null ? s.board.spaces[s.starSpace] : null;
            let target = { x: WORLD_W / 2, y: WORLD_H / 2, s: fit };
            if (map) target = { x: WORLD_W / 2, y: WORLD_H / 2, s: fit };
            else if (s.step === 'starIntro' && starSpace) target = { x: starSpace.x, y: starSpace.y - 40, s: follow };
            else if (L.focusStarUntil > nowMs && nowMs > L.focusStarDelay && starSpace) target = { x: starSpace.x, y: starSpace.y - 40, s: follow };
            else if (s.step === 'choice' && s.choice) {
                const j = s.board.spaces[s.choice.at];
                target = { x: j.x, y: j.y - 24, s: follow };
            } else if (activeActor) target = { x: activeActor.pos[0], y: activeActor.pos[1] - 44 - activeActor.lift * 0.3, s: follow };
            else if (s.phase === 'order') {
                const start = s.board.spaces[s.board.start];
                target = { x: start.x, y: start.y - 50, s: Math.max(fit, follow - (cw < 640 ? 0 : 1)) };
            }
            // Le point suivi s'affiche au milieu de la zone libre, entre les joueurs en haut et la console en bas
            const ins = props.current.insets;
            if (ins) target.y += ((ins.bottom || 0) - (ins.top || 0)) / 2 / target.s;
            const cam = L.cam;
            if (!cam.ready) Object.assign(cam, target, { ready: true });
            const k = 1 - Math.exp(-dt * 3.4);
            cam.s = Math.exp(Math.log(cam.s) + (Math.log(target.s) - Math.log(cam.s)) * k);
            if (Math.abs(cam.s - target.s) < 0.004) cam.s = target.s;
            cam.x += (target.x - cam.x) * k;
            cam.y += (target.y - cam.y) * k;
            const sc = cam.s;
            const halfW = cw / 2 / sc;
            const halfH = ch / 2 / sc;
            // La vue reste sur le décor ; s'il est plus petit qu'elle (carte), on suit la cible telle quelle
            const cx = WORLD_W > halfW * 2 ? Math.min(WORLD_W - halfW, Math.max(halfW, cam.x)) : cam.x;
            const cy = WORLD_H > halfH * 2 ? Math.min(WORLD_H - halfH, Math.max(halfH, cam.y)) : cam.y;
            const shake = L.shakeUntil > nowMs ? ((L.shakeUntil - nowMs) / 420) * 5 : 0;
            const viewLeft = cx - halfW + (shake ? Math.sin(nowMs * 0.09) * shake : 0);
            const viewTop = cy - halfH + (shake ? Math.cos(nowMs * 0.11) * shake * 0.6 : 0);
            const ox = Math.floor(viewLeft);
            const oy = Math.floor(viewTop);
            const vw = Math.ceil((cw / sc + 2) / 16) * 16;
            const vh = Math.ceil((ch / sc + 2) / 16) * 16;
            sizeCanvas(pixel, vw, vh);
            pixel.style.transform = `translate(${((ox - viewLeft) * sc).toFixed(2)}px, ${((oy - viewTop) * sc).toFixed(2)}px) scale(${sc.toFixed(4)})`;
            pixel.style.imageRendering = sc < 1.6 ? 'auto' : 'pixelated';
            L.view = { viewLeft, viewTop, s: sc };

            // ---------------- Canvas pixel ----------------
            px.setTransform(1, 0, 0, 1, -ox, -oy);
            px.imageSmoothingEnabled = false;
            px.fillStyle = '#030409';
            px.fillRect(ox, oy, vw, vh);
            px.drawImage(world.canvas, 0, 0);
            const glows = [];
            drawWorldLive(px, t, info, glows, s.board);

            // Cases : halo de leur LED, éclat quand un joueur passe dessus
            s.board.spaces.forEach((space) => {
                const c = SPACE_COLORS[space.type] || SPACE_COLORS.blue;
                glows.push({ x: space.x, y: space.y + 1, r: 34, color: c.ring, a: 0.1, squash: 0.65 });
            });
            L.flashes = L.flashes.filter((f) => nowMs - f.at < 500);
            L.flashes.forEach((f) => {
                const age = nowMs - f.at;
                if (age < 0) return;
                const fl = world.flashes[f.spaceId];
                const space = s.board.spaces[f.spaceId];
                px.globalAlpha = 1 - age / 500;
                px.drawImage(fl.canvas, fl.ox, fl.oy);
                px.globalAlpha = 1;
                glows.push({ x: space.x, y: space.y, r: 40, color: '#fff3dc', a: 0.35 * (1 - age / 500), squash: 0.7 });
            });

            // Case du joueur actif : anneau à sa couleur
            if (activeActor && !map && !activeActor.moving) {
                const space = s.board.spaces[activeActor.p.space];
                // Son pad prend sa couleur : l'anneau tourne comme une boucle qui joue
                const head = Math.floor(t * 10) % 16;
                lightRing(px, space, Array.from({ length: 6 }, (_, k) => head - k), PLAYER_COLORS[activeActor.p.seat], 1);
            }

            // Acteurs triés de l'arrière vers l'avant : joueurs, ingé son, foule, Micro d'or
            const drawList = [];
            const gate = s.board.spaces.find((sp) => sp.gate);
            if (gate) drawList.push({ y: gate.y + 2, draw: () => {
                drawShadow(px, gate.x + 62, gate.y + 3, 12, 4);
                px.drawImage(getFrame('inge', 'guard', t, '#000000', { base: false, facing: -1 }), gate.x + 62 - FOOT_X, gate.y + 2 - FOOT_Y);
            } });
            drawList.push({ y: 545, draw: () => drawCrowd(px, t, info) });
            if (starSpace) {
                drawList.push({ y: starSpace.y - 0.5, draw: () => drawGoldMic(px, starSpace.x, starSpace.y - 2, t) });
                glows.push({ x: starSpace.x, y: starSpace.y - 28, r: 40, color: '#f2c26a', a: 0.22 });
            }

            const visible = actors.filter((a) => showAll || a.p.id === currentId);
            const hidden = actors.filter((a) => !showAll && a.p.id !== currentId);

            // Plusieurs joueurs visibles sur une même case : on les écarte
            const bySpace = {};
            visible.forEach((a) => { if (!a.moving) bySpace[a.p.space] = (bySpace[a.p.space] || []).concat(a); });
            Object.values(bySpace).forEach((group) => {
                if (group.length < 2) return;
                // Ordre de passage : tout le monde en ligne sur le départ, chacun sous son dé
                const spots = s.phase === 'order' ? ORDER_LINE[Math.min(4, group.length)] : FORMATIONS[Math.min(4, group.length)];
                group.sort((a, b) => a.p.seat - b.p.seat).forEach((a, i) => {
                    const [dx, dy] = spots[i % spots.length];
                    a.pos = [a.pos[0] + dx, a.pos[1] + dy];
                    a.grouped = true;
                });
            });

            // Joueurs effacés : une pastille à leur couleur, avec leur numéro de passage
            hidden.forEach(({ p, pos }) => {
                const [dx, dy] = ORDINAL_OFFSETS[p.seat % 4];
                const n = s.order.indexOf(p.id) + 1;
                drawList.push({ y: pos[1] + dy, draw: () => drawBadge(px, Math.round(pos[0] + dx), Math.round(pos[1] + dy - 6), PLAYER_COLORS[p.seat], n > 0 ? n : null) });
            });

            visible.forEach((a) => {
                const { p, pos, lift, moving, left, hopK } = a;
                const override = (L.poses[p.id] || []).filter((o) => o.start <= nowMs && o.until > nowMs).pop();
                const facing = L.facing[p.id] || (pos[0] > WORLD_W * 0.62 ? -1 : 1);
                let pose = 'idle';
                let pt = t + p.seat * 0.37;
                if (moving) { pose = 'hop'; pt = hopK * HOP_T; }
                else if (override) { pose = override.pose; pt = (nowMs - override.start) / 1000; }
                else if (p.id === currentId && s.step === 'roll') pose = 'beatbox';
                else if (p.id === currentId && s.step === 'choice') pose = 'think';
                else if (s.phase === 'order') pose = s.orderRolls[p.id] != null ? 'dance' : 'idle';
                if (pose === 'beatbox' || pose === 'dance') pt = t;
                drawList.push({ y: pos[1], draw: () => {
                    const frame = getFrame(p.characterId, pose, pt, PLAYER_COLORS[p.seat], { base: false, facing });
                    const fx = Math.round(pos[0] - FOOT_X);
                    const fy = Math.round(pos[1] - FOOT_Y - lift);
                    drawShadow(px, pos[0], pos[1] + 1, Math.max(6, 13 - lift * 0.2), Math.max(2, 4.5 - lift * 0.08), 0.5);
                    px.drawImage(frame, fx, fy);
                    if (pose === 'beatbox') {
                        const hit = beatboxHit(t);
                        a.waves = { x: fx + (facing > 0 ? MIC_MOUTH[0] + 4 : 63 - MIC_MOUTH[0] - 4), y: fy + MIC_MOUTH[1], facing, hit };
                    }
                    const headY = pos[1] - FOOT_Y + DICE_HIT_Y - lift;

                    // Ordre de passage : chacun frappe son dé, le résultat reste affiché
                    if (s.phase === 'order') {
                        const value = s.orderRolls[p.id];
                        const text = value != null ? value : 1 + (Math.floor(t * 14 + p.seat * 3) % 10);
                        drawLoopDie(px, pos[0], headY + (a.grouped ? 2 : -2), text, { mode: value != null ? 'result' : 'roll', t: t + p.seat * 0.3, size: 0.68 });
                    }
                    // Dé au-dessus de la tête : il tourne, on le frappe, il affiche le résultat
                    if (p.id === currentId) {
                        let text = null;
                        let mode = 'roll';
                        let bob = 0;
                        if (s.step === 'roll') { text = 1 + (Math.floor(t * 14) % 10); bob = Math.round(Math.sin(t * 5) * 2); }
                        if (L.dice && L.dice.playerId === p.id && !moving && (s.step === 'rolled' || s.step === 'roll')) {
                            const age = nowMs - L.dice.at;
                            text = age < 340 ? 1 + (Math.floor(t * 30) % 10) : L.dice.value;
                            if (age >= 340) mode = 'result';
                            if (age >= 340 && age < 900) drawBurst(px, pos[0], headY - 22, age - 340);
                        }
                        if (left != null && left > 0 && (moving || s.step !== 'rolled')) { text = left; mode = 'steps'; }
                        if (text != null) {
                            drawLoopDie(px, pos[0], headY - 2 + bob, text, { mode, total: L.rollTotals[p.id] || 10, t, size: mode === 'steps' ? 0.8 : 1 });
                        }
                    }
                } });
            });
            drawList.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

            // Flèches du carrefour
            L.arrows = [];
            if (s.step === 'choice' && s.choice && !map) {
                const here = s.board.spaces[s.choice.at];
                choiceDirections(s).forEach((o) => {
                    const v = DIR_VEC[o.dir];
                    const pulse = Math.round(Math.sin(t * 7) * 3);
                    const dist = 66 + pulse;
                    const ax = here.x + v[0] * dist;
                    const ay = here.y - 24 + v[1] * (dist - 6);
                    const color = o.affordable ? (s.choice.playerId === me ? '#F0AE22' : '#F2F0EA') : '#5b5b64';
                    drawArrow(px, ax, ay, o.dir, color);
                    
                    if (o.gate) {
                        const label = `${o.gate}`;
                        drawCoin(px, ax + 6, ay + 16);
                        drawText(px, label, ax - 2, ay + 17, o.affordable ? '#F2F0EA' : '#8a8a92');
                    }
                    L.arrows.push({ spaceId: o.spaceId, x: ax, y: ay, affordable: o.affordable });
                });
            }

            // Textes flottants (gains, pertes) avec une pièce de Hype
            L.floats = L.floats.filter((f) => nowMs - f.start < 1700);
            L.floats.forEach((f) => {
                const kf = (nowMs - f.start) / 1700;
                if (kf < 0) return;
                const y = f.y - Math.min(1, kf * 3) * 16;
                px.globalAlpha = kf > 0.8 ? (1 - kf) * 5 : 1;
                const w = drawText(px, f.text, f.x + (f.coin ? 8 : 0), y, f.color);
                if (f.coin) drawCoin(px, f.x - w / 2 - 6, y - 1);
                px.globalAlpha = 1;
            });

            // Confettis : petits carrés qui retombent en tournoyant
            L.particles = L.particles.filter((q) => nowMs - q.born < q.life);
            L.particles.forEach((q) => {
                const age = (nowMs - q.born) / 1000;
                if (age < 0) return;
                const x = q.x + q.vx * age;
                const y = q.y + q.vy * age + 160 * age * age;
                const flip = Math.floor(age * 10 + q.vx) % 2;
                px.globalAlpha = Math.min(1, (q.life / 1000 - age) * 3);
                px.fillStyle = q.color;
                px.fillRect(Math.round(x), Math.round(y), flip ? 3 : 1, flip ? 1 : 3);
                px.globalAlpha = 1;
            });
            // Ondes de choc au sol (Drop, Larsen)
            L.rings = L.rings.filter((r) => nowMs - r.at < 700);
            L.rings.forEach((r) => {
                const sp = s.board.spaces[r.spaceId];
                const k = (nowMs - r.at) / 700;
                drawRing(px, sp.x, sp.y + 1, 34 + k * 70, 21 + k * 44, r.color, 1 - k);
                glows.push({ x: sp.x, y: sp.y, r: 40 + k * 80, color: r.color, a: 0.25 * (1 - k), squash: 0.6 });
            });

            // ---------------- Lumières ----------------
            const dpr = Math.min(1.5, window.devicePixelRatio || 1);
            const GW = Math.round(cw * dpr);
            const GH = Math.round(ch * dpr);
            sizeCanvas(glowCv, GW, GH);
            sizeCanvas(shadeCv, GW, GH);
            gx.setTransform(1, 0, 0, 1, 0, 0);
            gx.clearRect(0, 0, GW, GH);
            gx.setTransform(sc * dpr, 0, 0, sc * dpr, -viewLeft * sc * dpr, -viewTop * sc * dpr);
            drawAmbient(gx, t, info);
            if (activeActor && !map) drawBeam(gx, activeActor.pos[0], activeActor.pos[1] - activeActor.lift, 46, '#fff4dc', 0.09);
            drawGlows(gx, glows);
            visible.forEach((a) => { if (a.waves) drawSoundWaves(gx, a.waves.x, a.waves.y, a.waves.facing, a.waves.hit, t); });

            // Ombre : vignette, et projecteur sur le joueur actif
            let spot = null;
            if (activeActor && !map) {
                const amount = s.step === 'roll' || s.step === 'intro' ? 0.8 : 0.4;
                spot = {
                    x: (activeActor.pos[0] - viewLeft) * sc * dpr,
                    y: (activeActor.pos[1] - 40 - viewTop) * sc * dpr,
                    r: 150 * sc * dpr,
                    amount,
                };
            }
            drawShade(sx, GW, GH, spot);

            raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => {
            alive = false;
            cancelAnimationFrame(raf);
        };
        // Le plateau ne change pas en cours de partie
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.board.id]);

    // Un clic sur une flèche du carrefour choisit la route
    const handlePointer = (event) => {
        const L = live.current;
        if (!L.view || !L.arrows.length || !props.current.onChoose) return;
        const box = wrapRef.current.getBoundingClientRect();
        const bx = L.view.viewLeft + (event.clientX - box.left) / L.view.s;
        const by = L.view.viewTop + (event.clientY - box.top) / L.view.s;
        const hit = L.arrows.find((a) => Math.abs(a.x - bx) < 22 && Math.abs(a.y - by) < 22);
        if (hit && hit.affordable) props.current.onChoose(hit.spaceId);
    };

    return (
        <div ref={wrapRef} className="party-board-view" onPointerDown={handlePointer}>
            <canvas ref={pixelRef} className="party-board-pixel" aria-hidden="true" />
            <canvas ref={glowRef} className="party-board-glow" aria-hidden="true" />
            <canvas ref={shadeRef} className="party-board-shade" aria-hidden="true" />
        </div>
    );
}
