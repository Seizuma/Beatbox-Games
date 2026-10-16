import React, { useEffect, useRef } from 'react';
import { DICE_HIT_Y, FOOT_X, FOOT_Y, MIC_MOUTH, PLAYER_COLORS, beatboxHit, getFrame } from '../characters/pixelRig';
import { beatIndex, beatPhase, sfx } from '../partySfx';
import { DEVICE, getWorld, spaceRadius } from './world';
import { focalFor, makeCam, project, renderStage, ringOutline, spaceTop, stageLights } from './stage3d';
import { drawArrow, drawBurst, drawCoin, drawDie, goldMicSprite } from './live';
import { drawGlows, drawShade, drawSoundWaves } from './fx';
import { drawText } from './pixelFont';
import { E } from './pix';

// Le plateau : la loopstation géante sur la scène d'une battle, filmée en Mode 7.
// La caméra se comporte comme celle de Mario Party :
// - au tour d'un joueur, elle se place derrière lui et le suit de pad en pad ;
// - sur un long trajet, elle prend de la hauteur puis replonge (mouvement de grue) ;
// - elle montre le Micro d'or au début de la partie et quand il change de place ;
// - la vue « Carte » montre toute la loopstation d'en haut.
//
// Trois canvas superposés : le pixel art (basse résolution, agrandi sans lissage),
// les lumières (résolution de l'écran, mode « screen ») et l'ombre (vignette, projecteur).

const HOP_T = 0.6;
// Plusieurs joueurs sur une même case : en ligne, côte à côte (écart en unités du monde)
const LINES = {
    1: [[0, 0]],
    2: [[-15, 0], [15, 0]],
    3: [[-24, 2], [0, -3], [24, 2]],
    4: [[-30, 3], [-10, -3], [10, 3], [30, -3]],
};
const ORDER_LINE = [[-6, 0], [38, -2], [82, 0], [126, -2]];
// Point visé quand personne ne joue, et centre de la vue carte
const CENTER = { x: DEVICE.x + DEVICE.w / 2, y: DEVICE.y + DEVICE.d * 0.48 };

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

// Ressort amorti critique (SmoothDamp) : départ et arrivée en douceur, à toute cadence
function smoothDamp(current, target, velocity, smoothTime, dt) {
    const omega = 2 / smoothTime;
    const x = omega * dt;
    const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = current - target;
    const temp = (velocity + omega * change) * dt;
    return [target + (change + temp) * decay, (velocity - omega * temp) * decay];
}

const ease = (k) => k * k * (3 - 2 * k);

// Vue carte : la plus grande échelle où toute la loopstation tient entre le HUD et la console
const fitCache = new Map();
function fitMap(AW, AH, top, bottom) {
    const key = `${AW}|${AH}|${Math.round(top)}|${Math.round(bottom)}`;
    if (fitCache.has(key)) return fitCache.get(key);
    const free = Math.max(AH * 0.4, AH - top - bottom);
    const fy = (top + free * 0.5) / AH;
    const { x: DX, y: DY, w: DW, d: DD, h: DH } = DEVICE;
    const pts = [[DX, DY, DH], [DX + DW, DY, DH], [DX, DY + DD, 0], [DX + DW, DY + DD, 0]];
    let k = 1.2;
    for (let i = 0; i < 60; i += 1) {
        const dist = focalFor(AW, AH) / k;
        const cam = makeCam({ tx: CENTER.x, ty: CENTER.y, th: DEVICE.h, dist, rise: dist * 0.95, fy, W: AW, H: AH });
        const ok = pts.every(([x, y, h]) => {
            const p = project(cam, x, y, h);
            return p && p.sx >= 2 && p.sx <= AW - 2 && p.sy >= top + 2 && p.sy <= AH - bottom - 2;
        });
        if (ok) break;
        k *= 0.95;
    }
    fitCache.set(key, k);
    return k;
}

export default function PartyBoard({ state, queue, myId, mapMode = false, onEvent, onChoose, insets = null, clockOffset = 0 }) {
    const wrapRef = useRef(null);
    const pixelRef = useRef(null);
    const glowRef = useRef(null);
    const shadeRef = useRef(null);
    const props = useRef({ mapMode, onEvent, onChoose, myId, insets, clockOffset });
    props.current = { mapMode, onEvent, onChoose, myId, insets, clockOffset };
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
        cam: null,
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
            L.floats.push({ text, color, x: sp.x, y: sp.y, start: now + delay, coin });
        };
        // Confettis (achat du Micro d'or, Drop), dans le monde : ils retombent sur l'appareil
        const confetti = (spaceId, colors, n = 36, delay = 0) => {
            const sp = spaceOf(spaceId);
            if (!sp) return;
            for (let i = 0; i < n; i += 1) {
                const a = Math.random() * Math.PI * 2;
                const v = 40 + Math.random() * 90;
                L.particles.push({ x: sp.x, y: sp.y, h: spaceTop(sp) + 70, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vh: 160 + Math.random() * 160, color: colors[i % colors.length], born: now + delay, life: 1500 + Math.random() * 700 });
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
            case 'spin':
                sfx('reveal', 0.1);
                break;
            case 'roll':
                L.dice = { playerId: event.playerId, value: event.value, die: event.die || 'pad', at: now };
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
                    L.rings.push({ spaceId: event.spaceId, at: now, color: '#33e07a' });
                    confetti(event.spaceId, ['#33e07a', '#9dffc4', '#F2F0EA'], 28);
                }
                if (event.kind === 'red') {
                    L.shakeUntil = now + 420;
                    L.rings.push({ spaceId: event.spaceId, at: now, color: '#ff3b30' });
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
                    if (player) confetti(player.space, ['#ffb21e', '#ff3b30', '#3f8cff', '#33e07a', '#F2F0EA'], 60);
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
            let h = spaceTop(here);
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
                    const ek = ease(k);
                    pos = [p0.x + (p1.x - p0.x) * ek, p0.y + (p1.y - p0.y) * ek];
                    h = spaceTop(p0) + (spaceTop(p1) - spaceTop(p0)) * ek;
                    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
                    lift = Math.sin(k * Math.PI) * (16 + dist * 0.16);
                    if (Math.abs(p1.x - p0.x) > 6) L.facing[p.id] = p1.x > p0.x ? 1 : -1;
                    moving = true;
                    hopK = k;
                    left = Math.max(0, a.startLeft - hop - (k > 0.8 ? 1 : 0));
                }
            }
            // Arrêt en route (carrefour, Micro d'or) : le compteur reste affiché
            if (!moving && L.counters[p.id] > 0) left = L.counters[p.id];
            return { p, pos, h, lift, moving, left, hopK };
        };

        const sizeCanvas = (cv, w, h) => {
            if (cv.width !== w) cv.width = w;
            if (cv.height !== h) cv.height = h;
        };

        const draw = (nowMs) => {
            if (!alive) return;
            const dt = Math.min(0.1, (nowMs - (L.last || nowMs)) / 1000);
            L.last = nowMs;
            if (queue && queue.current.length) {
                const pending = queue.current.splice(0, queue.current.length);
                pending.forEach((snap) => processSnapshot(snap, nowMs));
            }
            const s = L.state;
            const t = nowMs / 1000;
            const { mapMode: map, myId: me, clockOffset: offset } = props.current;
            const wrap = wrapRef.current;
            if (!wrap) { raf = requestAnimationFrame(draw); return; }
            const cw = wrap.clientWidth;
            const ch = wrap.clientHeight;
            const beat = beatPhase(nowMs);
            const kick = Math.max(0, 1 - beat * 3);
            const bi = beatIndex(nowMs);
            const turns = (s.settings && s.settings.turns) || 10;
            const info = {
                beat, kick, bi, bpm: s.finale ? 112 : 96,
                lcd: s.turn > 0 ? { big: String(s.turn).padStart(2, '0'), small: `TURN ${s.turn}/${turns}`, corner: s.finale ? 'FINAL X2' : 'TRK 1-5' } : { big: '00', small: 'READY', corner: 'TRK 1-5' },
            };
            const cheering = L.cheerUntil > nowMs;

            // ---------------- Résolution du pixel art ----------------
            const scale = cw < 640 ? 2 : Math.max(2, Math.min(4, Math.round(ch / 340)));
            const AW = Math.max(1, Math.ceil(cw / scale));
            const AH = Math.max(1, Math.ceil(ch / scale));
            sizeCanvas(pixel, AW, AH);
            const cssW = `${AW * scale}px`;
            if (pixel.style.width !== cssW) {
                pixel.style.width = cssW;
                pixel.style.height = `${AH * scale}px`;
            }

            const currentId = s.phase === 'turn' ? s.currentPlayerId : null;
            const actors = s.players.filter((p) => p.space != null).map((p) => actorOf(s, p, nowMs));
            const activeActor = actors.find((a) => a.p.id === currentId);

            // ---------------- Caméra ----------------
            const ins = props.current.insets || { top: 0, bottom: 0 };
            const top = (ins.top || 0) / scale;
            const bottom = (ins.bottom || 0) / scale;
            const free = Math.max(AH * 0.4, AH - top - bottom);
            const followFy = (top + free * 0.7) / AH;
            const f = focalFor(AW, AH);
            const mapK = fitMap(AW, AH, top, bottom);
            // En portrait, on recule un peu pour garder les cases voisines dans le champ
            const kFollow = Math.min(1, AW / 330);
            const starSpace = s.starSpace != null ? s.board.spaces[s.starSpace] : null;
            let target = { x: CENTER.x, y: CENTER.y, k: mapK * 1.25, pitch: 0.75, fy: (top + free * 0.55) / AH };
            const follow = (x, y, k = 1) => ({ x, y, k: k * kFollow, pitch: 0.62, fy: followFy });
            if (map) target = { x: CENTER.x, y: CENTER.y, k: mapK, pitch: 0.95, fy: (top + free * 0.5) / AH };
            else if (s.step === 'starIntro' && starSpace) target = follow(starSpace.x, starSpace.y, 0.95);
            else if (L.focusStarUntil > nowMs && nowMs > L.focusStarDelay && starSpace) target = follow(starSpace.x, starSpace.y, 0.95);
            else if (s.step === 'choice' && s.choice) {
                const j = s.board.spaces[s.choice.at];
                target = follow(j.x, j.y, 0.8);
            } else if (activeActor) target = follow(activeActor.pos[0], activeActor.pos[1], 1);
            else if (s.phase === 'order') {
                const start = s.board.spaces[s.board.start];
                target = follow(start.x + 60, start.y, 0.8);
            }
            if (!L.cam) L.cam = { x: target.x, y: target.y, d: Math.log(f / target.k), p: target.pitch, fy: target.fy, vx: 0, vy: 0, vd: 0, vp: 0, vf: 0 };
            const cam = L.cam;
            // Long trajet : la caméra recule et monte pendant le déplacement (grue)
            const travel = Math.hypot(target.x - cam.x, target.y - cam.y);
            const crane = 1 + Math.min(0.9, Math.max(0, travel - 160) / 600);
            [cam.x, cam.vx] = smoothDamp(cam.x, target.x, cam.vx, 0.45, dt);
            [cam.y, cam.vy] = smoothDamp(cam.y, target.y, cam.vy, 0.45, dt);
            [cam.d, cam.vd] = smoothDamp(cam.d, Math.log((f / target.k) * crane), cam.vd, 0.6, dt);
            [cam.p, cam.vp] = smoothDamp(cam.p, target.pitch + (crane - 1) * 0.35, cam.vp, 0.6, dt);
            [cam.fy, cam.vf] = smoothDamp(cam.fy, target.fy, cam.vf, 0.5, dt);
            const dist = Math.exp(cam.d);
            const shake = L.shakeUntil > nowMs ? ((L.shakeUntil - nowMs) / 420) * 4 : 0;
            const C3 = makeCam({
                tx: cam.x, ty: cam.y, th: DEVICE.h, dist, rise: dist * cam.p, fy: cam.fy, W: AW, H: AH,
                dx: shake ? Math.sin(nowMs * 0.09) * shake * 2 : 0, dy: shake ? Math.cos(nowMs * 0.11) * shake : 0,
            });
            L.view = { cam: C3, scale };

            // ---------------- Plateau ----------------
            const flashes = {};
            L.flashes = L.flashes.filter((fl) => nowMs - fl.at < 500);
            L.flashes.forEach((fl) => {
                const age = nowMs - fl.at;
                if (age >= 0) flashes[fl.spaceId] = Math.max(flashes[fl.spaceId] || 0, 1 - age / 500);
            });
            const active = activeActor && !map && !activeActor.moving ? { spaceId: activeActor.p.space, color: PLAYER_COLORS[activeActor.p.seat] } : null;
            const list = renderStage(px, world, C3, { t, info, board: s.board, active, flashes, cheering });
            const glows = [];
            stageLights(C3, t, info, glows);

            // Ingé son qui garde le raccourci
            const gate = s.board.spaces.find((sp) => sp.gate);
            if (gate) list.push({ y: gate.y, draw: () => drawFigure(getFrame('inge', 'guard', t, '#000000', { base: false, facing: 1 }), gate.x - 74, gate.y, DEVICE.h, 0) });
            // Micro d'or
            if (starSpace) {
                list.push({ y: starSpace.y + 1, draw: () => {
                    const pr = project(C3, starSpace.x, starSpace.y, spaceTop(starSpace));
                    if (!pr) return;
                    const img = goldMicSprite(t);
                    const k = pr.k;
                    px.drawImage(img, Math.round(pr.sx - 20 * k), Math.round(pr.sy - 58 * k), Math.round(40 * k), Math.round(64 * k));
                    glows.push({ x: pr.sx, y: pr.sy - 30 * k, r: 40 * k, color: '#f2c26a', a: 0.25 });
                } });
            }

            // Personnage debout en (x, y) à la hauteur h, soulevé de lift (unités du monde)
            function drawFigure(frame, x, y, h, lift, alpha = 1) {
                const ground = project(C3, x, y, h);
                if (!ground || ground.z < 70) return null;
                const k = ground.k;
                ctx3Shadow(ground, lift);
                const top = project(C3, x, y, h + lift);
                px.globalAlpha = alpha;
                px.drawImage(frame, Math.round(top.sx - FOOT_X * k), Math.round(top.sy - FOOT_Y * k), Math.round(64 * k), Math.round(96 * k));
                px.globalAlpha = 1;
                return { sx: top.sx, sy: top.sy, k };
            }
            function ctx3Shadow(g, lift) {
                const rx = Math.max(4, (14 - lift * 0.15) * g.k);
                const ry = (rx * (C3.H - DEVICE.h)) / g.z;
                px.globalAlpha = 0.5;
                E(px, g.sx, g.sy + 1, rx, Math.max(1.5, ry), '#050407');
                px.globalAlpha = 1;
            }

            // Plusieurs joueurs sur une même case : côte à côte
            const bySpace = {};
            actors.forEach((a) => { if (!a.moving) bySpace[a.p.space] = (bySpace[a.p.space] || []).concat(a); });
            Object.values(bySpace).forEach((group) => {
                if (group.length < 2 && s.phase !== 'order') return;
                const sp = s.board.spaces[group[0].p.space];
                const wide = sp.big ? 1.6 : 1;
                const spots = s.phase === 'order' ? ORDER_LINE : LINES[Math.min(4, group.length)];
                group.sort((a, b) => a.p.seat - b.p.seat).forEach((a, i) => {
                    const [dx, dy] = spots[i % spots.length];
                    a.pos = [a.pos[0] + dx * (s.phase === 'order' ? 1 : wide), a.pos[1] + dy];
                    if (s.phase === 'order' && i > 0) a.h = DEVICE.h;
                    a.grouped = true;
                });
            });

            const overlays = [];
            actors.forEach((a) => {
                const { p, pos, h, lift, moving, left, hopK } = a;
                const override = (L.poses[p.id] || []).filter((o) => o.start <= nowMs && o.until > nowMs).pop();
                const facing = L.facing[p.id] || (pos[0] > C3.x + 40 ? -1 : 1);
                let pose = 'idle';
                let pt = t + p.seat * 0.37;
                if (moving) { pose = 'hop'; pt = hopK * HOP_T; }
                else if (override) { pose = override.pose; pt = (nowMs - override.start) / 1000; }
                else if (p.id === currentId && (s.step === 'roll' || s.step === 'scratch')) pose = 'beatbox';
                else if (p.id === currentId && s.step === 'choice') pose = 'think';
                else if (s.phase === 'order') pose = s.orderRolls[p.id] != null ? 'dance' : 'idle';
                if (pose === 'beatbox' || pose === 'dance') pt = t;
                // Les autres joueurs s'estompent un peu pendant le tour de quelqu'un
                const dim = 1;
                list.push({ y: pos[1], draw: () => {
                    const frame = getFrame(p.characterId, pose, pt, PLAYER_COLORS[p.seat], { base: false, facing });
                    const at = drawFigure(frame, pos[0], pos[1], h, lift, dim);
                    if (!at) return;
                    if (pose === 'beatbox') {
                        const hit = beatboxHit(t);
                        const mx = facing > 0 ? MIC_MOUTH[0] + 4 : 63 - MIC_MOUTH[0] - 4;
                        a.waves = { x: at.sx + (mx - FOOT_X) * at.k, y: at.sy + (MIC_MOUTH[1] - FOOT_Y) * at.k, facing, hit };
                    }
                    a.head = { x: at.sx, y: at.sy + (DICE_HIT_Y - FOOT_Y) * at.k - 6, k: at.k };
                } });
                overlays.push(() => {
                    if (!a.head) return;
                    const { x: hx, y: hy } = a.head;
                    // Ordre de passage : chacun frappe son pad, le résultat reste affiché
                    if (s.phase === 'order') {
                        const value = s.orderRolls[p.id];
                        const text = value != null ? value : 1 + (Math.floor(t * 14 + p.seat * 3) % 10);
                        drawDie(px, 'pad', hx, hy, text, { mode: value != null ? 'result' : 'roll', t: t + p.seat * 0.3, size: 0.72 });
                        return;
                    }
                    if (p.id !== currentId) return;
                    const color = PLAYER_COLORS[p.seat];
                    const bob = Math.round(Math.sin(t * 5) * 2);
                    // Vinyle qui tourne : le chiffre suit l'horloge du serveur
                    if (s.step === 'scratch' && s.roll && s.roll.die === 'vinyl') {
                        const serverNow = Date.now() + (offset || 0);
                        const value = 1 + (Math.floor((serverNow - s.roll.spinAt) / s.roll.period) % s.roll.faces);
                        drawDie(px, 'vinyl', hx, hy + bob, value, { mode: 'roll', t, color });
                        return;
                    }
                    if (s.step === 'roll') {
                        drawDie(px, 'pad', hx, hy + bob, 1 + (Math.floor(t * 14) % 10), { mode: 'roll', t });
                        return;
                    }
                    const d = L.dice && L.dice.playerId === p.id ? L.dice : null;
                    if (d && !moving && s.step === 'rolled') {
                        const age = nowMs - d.at;
                        drawDie(px, d.die, hx, hy, d.value, { mode: age < 420 ? 'hit' : 'result', t, color });
                        if (age < 700) drawBurst(px, hx, hy - 26, age);
                        return;
                    }
                    if (left != null && left > 0) {
                        const die = (d && d.die) || (s.roll && s.roll.die) || 'pad';
                        drawDie(px, die, hx, hy, left, { mode: 'steps', t, color, total: L.rollTotals[p.id] || 10, size: 0.8 });
                    }
                });
            });
            list.sort((a, b) => a.y - b.y).forEach((d) => d.draw());
            overlays.forEach((o) => o());

            // Flèches du carrefour
            L.arrows = [];
            if (s.step === 'choice' && s.choice && !map) {
                const here = s.board.spaces[s.choice.at];
                choiceDirections(s).forEach((o) => {
                    const v = DIR_VEC[o.dir];
                    const pulse = Math.sin(t * 7) * 6;
                    const reach = 92 + pulse;
                    const pr = project(C3, here.x + v[0] * reach, here.y + v[1] * reach, spaceTop(here) + 24);
                    if (!pr) return;
                    const color = o.affordable ? (s.choice.playerId === me ? '#ffb21e' : '#F2F0EA') : '#5b5b64';
                    drawArrow(px, pr.sx, pr.sy, o.dir, color);
                    if (o.gate) {
                        drawCoin(px, pr.sx + 6, pr.sy + 16);
                        drawText(px, `${o.gate}`, pr.sx - 2, pr.sy + 17, o.affordable ? '#F2F0EA' : '#8a8a92');
                    }
                    L.arrows.push({ spaceId: o.spaceId, x: pr.sx, y: pr.sy, affordable: o.affordable });
                });
            }

            // Textes flottants (gains, pertes) avec une pièce de Hype
            L.floats = L.floats.filter((fl) => nowMs - fl.start < 1700);
            L.floats.forEach((fl) => {
                const kf = (nowMs - fl.start) / 1700;
                if (kf < 0) return;
                const pr = project(C3, fl.x, fl.y, DEVICE.h + 130);
                if (!pr) return;
                const y = pr.sy - Math.min(1, kf * 3) * 16;
                px.globalAlpha = kf > 0.8 ? (1 - kf) * 5 : 1;
                const w = drawText(px, fl.text, pr.sx + (fl.coin ? 8 : 0), y, fl.color);
                if (fl.coin) drawCoin(px, pr.sx - w / 2 - 6, y - 1);
                px.globalAlpha = 1;
            });

            // Confettis : ils volent et retombent sur la loopstation
            L.particles = L.particles.filter((q) => nowMs - q.born < q.life);
            L.particles.forEach((q) => {
                const age = (nowMs - q.born) / 1000;
                if (age < 0) return;
                const h = Math.max(DEVICE.h + 1, q.h + q.vh * age - 260 * age * age);
                const pr = project(C3, q.x + q.vx * age, q.y + q.vy * age, h);
                if (!pr) return;
                const flip = Math.floor(age * 10 + q.vx) % 2;
                const sz = Math.max(1, Math.round(2 * pr.k));
                px.globalAlpha = Math.min(1, (q.life / 1000 - age) * 3);
                px.fillStyle = q.color;
                px.fillRect(Math.round(pr.sx), Math.round(pr.sy), flip ? sz * 2 : sz, flip ? sz : sz * 2);
                px.globalAlpha = 1;
            });
            // Ondes de choc sur le pad (Drop, Larsen)
            L.rings = L.rings.filter((r) => nowMs - r.at < 700);
            L.rings.forEach((r) => {
                const sp = s.board.spaces[r.spaceId];
                const pr = project(C3, sp.x, sp.y, spaceTop(sp));
                if (!pr) return;
                const k = (nowMs - r.at) / 700;
                const rad = (spaceRadius(sp) + k * 90) * pr.k;
                ringOutline(px, pr.sx, pr.sy, rad, (rad * (C3.H - spaceTop(sp))) / pr.z, r.color, 1 - k);
                glows.push({ x: pr.sx, y: pr.sy, r: rad * 1.2, color: r.color, a: 0.25 * (1 - k), squash: 0.5 });
            });

            // ---------------- Lumières ----------------
            const dpr = Math.min(1.5, window.devicePixelRatio || 1);
            const GW = Math.round(cw * dpr);
            const GH = Math.round(ch * dpr);
            sizeCanvas(glowCv, GW, GH);
            sizeCanvas(shadeCv, GW, GH);
            gx.setTransform(1, 0, 0, 1, 0, 0);
            gx.clearRect(0, 0, GW, GH);
            gx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
            if (activeActor && activeActor.head && !map) {
                const hd = activeActor.head;
                glows.push({ beam: true, x: hd.x, y: hd.y - 160 * hd.k, w: 34 * hd.k, len: 230 * hd.k, color: '#fff4dc', a: 0.1 });
            }
            drawGlows(gx, glows);
            actors.forEach((a) => { if (a.waves) drawSoundWaves(gx, a.waves.x, a.waves.y, a.waves.facing, a.waves.hit, t); });

            // Ombre : vignette, et projecteur sur le joueur actif
            let spot = null;
            if (activeActor && activeActor.head && !map) {
                const amount = s.step === 'roll' || s.step === 'intro' || s.step === 'scratch' ? 0.8 : 0.4;
                spot = { x: activeActor.head.x * scale * dpr, y: (activeActor.head.y + 40 * activeActor.head.k) * scale * dpr, r: 150 * activeActor.head.k * scale * dpr, amount };
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
        const bx = (event.clientX - box.left) / L.view.scale;
        const by = (event.clientY - box.top) / L.view.scale;
        const hit = L.arrows.find((a) => Math.abs(a.x - bx) < 20 && Math.abs(a.y - by) < 20);
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

