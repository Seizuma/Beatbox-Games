import React, { useEffect, useRef } from 'react';
import { getFrame, PLAYER_COLORS, SPRITE_W } from '../characters/pixelRig';
import { beatIndex, beatPhase, sfx } from '../partySfx';

// Plateau en pixel art avec une caméra de jeu, comme dans Mario Party :
// - au tour d'un joueur, la caméra zoome sur lui et le suit pendant qu'il avance ;
// - les autres joueurs s'effacent (petit pion de couleur à leur place) ;
// - au carrefour, elle recule un peu et des flèches montrent les routes (cliquables) ;
// - elle montre le Micro d'or au début de la partie et quand il change de place ;
// - la vue « Carte » montre tout le plateau et tous les joueurs.
// Le décor fixe est dessiné une fois ; la foule, les lumières et les enceintes
// bougent en rythme avec la musique du plateau.

const CELL = 34;
const MX = 12;
const MY = 52;
const MB = 58;
export const BOARD_W = 13 * CELL + MX * 2;
export const BOARD_H = MY + 9 * CELL + MB;
const OUT = '#1A1C2C';
const FONT = '8px Silkscreen, monospace';

const TILE = {
    blue: { top: '#4C8DFF', side: '#2852B0', light: '#9CC0FF', icon: 'plus', ink: '#FFFFFF' },
    start: { top: '#FFC72C', side: '#B98500', light: '#FFE79A', icon: 'go', ink: '#5A3E00' },
    red: { top: '#F0533F', side: '#9E2818', light: '#FFA093', icon: 'minus', ink: '#FFFFFF' },
    drop: { top: '#35C877', side: '#1C7F47', light: '#8EE8B6', icon: 'bang', ink: '#FFFFFF' },
};

const ICONS = {
    plus: ['..##..', '..##..', '######', '######', '..##..', '..##..'],
    minus: ['......', '......', '######', '######', '......', '......'],
    bang: ['.##.', '.##.', '.##.', '.##.', '....', '.##.'],
    go: ['.####..###.', '##....##.##', '##.##.##.##', '##..#.##.##', '.####..###.'],
};

const COIN = ['.###.', '#YYy#', '#YhY#', '#YYy#', '.###.'];

const GOLD_MIC = [
    '...yyyyy...',
    '..yYyYyYy..',
    '.yYyYyYyYd.',
    '.yyYyYyYdd.',
    '..yyyyyydd.',
    '...dddddd..',
    '....kgk....',
    '....kgk....',
    '....kgk....',
    '....kgk....',
    '....kgk....',
    '.....k.....',
];

const ARROWS = {
    right: ['#....', '##...', '###..', '####.', '#####', '####.', '###..', '##...', '#....'],
    left: ['....#', '...##', '..###', '.####', '#####', '.####', '..###', '...##', '....#'],
    down: ['#########', '.#######.', '..#####..', '...###...', '....#....'],
    up: ['....#....', '...###...', '..#####..', '.#######.', '#########'],
};

const center = (space) => [MX + space.x * CELL + CELL / 2, MY + space.y * CELL + CELL / 2];

function stamp(ctx, x, y, rows, pal, k = 1) {
    rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i += 1) {
            const c = pal[row[i]];
            if (c) {
                ctx.fillStyle = c;
                ctx.fillRect(Math.round(x + i * k), Math.round(y + j * k), k, k);
            }
        }
    });
}

function rect(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

// Texte pixel agrandi sans flou : écrit à 8 px puis multiplié
const textCache = new Map();
function pixelText(ctx, text, x, y, color, k = 1, align = 'center') {
    const cacheKey = `${text}|${color}`;
    let cv = textCache.get(cacheKey);
    if (!cv) {
        const measure = document.createElement('canvas').getContext('2d');
        measure.font = FONT;
        const w = Math.ceil(measure.measureText(text).width) + 4;
        cv = document.createElement('canvas');
        cv.width = w;
        cv.height = 12;
        const c = cv.getContext('2d');
        c.font = FONT;
        c.textBaseline = 'top';
        c.fillStyle = OUT;
        [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]].forEach(([dx, dy]) => c.fillText(text, 2 + dx, 2 + dy));
        c.fillStyle = color;
        c.fillText(text, 2, 2);
        if (textCache.size > 300) textCache.delete(textCache.keys().next().value);
        textCache.set(cacheKey, cv);
    }
    const w = cv.width * k;
    const left = align === 'center' ? x - w / 2 : x;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, Math.round(left), Math.round(y), w, cv.height * k);
}

// ---------------------------------------------------------------------------
// Décor fixe
// ---------------------------------------------------------------------------

function drawBackground(board) {
    const W = BOARD_W;
    const H = BOARD_H;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');

    // Parquet
    rect(ctx, 0, 0, W, H, '#3A2A22');
    for (let y = MY; y < H; y += 7) {
        rect(ctx, 0, y, W, 1, '#2C1F19');
        const offset = ((y - MY) / 7) % 2 ? 0 : 23;
        for (let x = offset; x < W; x += 46) rect(ctx, x, y, 1, 7, '#2C1F19');
        for (let x = offset + 6; x < W; x += 46) rect(ctx, x, y + 2, 14, 1, '#47342B');
    }
    // Lumière douce au centre du parquet
    const glow = ctx.createRadialGradient(W * 0.45, MY + 150, 20, W * 0.45, MY + 150, 260);
    glow.addColorStop(0, 'rgba(255,200,120,0.10)');
    glow.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, MY, W, H - MY);

    // Mur du fond : briques, affiches
    rect(ctx, 0, 0, W, MY, '#1B1F3B');
    for (let y = 0; y < MY - 6; y += 6) {
        for (let x = (y / 6) % 2 ? 0 : 7; x < W; x += 14) rect(ctx, x, y, 13, 5, '#222852');
    }
    rect(ctx, 0, MY - 6, W, 6, '#0F1229');
    rect(ctx, 0, MY - 6, W, 1, '#3B4480');
    const posters = [[14, '#F0533F', '#FFC72C'], [42, '#4C8DFF', '#FFFFFF'], [W - 150, '#35C877', '#1A1C2C'], [W - 122, '#FF86B4', '#FFFFFF']];
    posters.forEach(([x, bg, ink], i) => {
        rect(ctx, x - 1, 13, 22, 28, OUT);
        rect(ctx, x, 14, 20, 26, bg);
        rect(ctx, x + 3, 18, 14, 2, ink);
        rect(ctx, x + 3, 22 + (i % 2) * 2, 9, 9, ink);
        rect(ctx, x + 3, 34, 12, 2, ink);
    });
    // Cadre de l'enseigne (le texte clignote, il est dessiné à chaque image)
    rect(ctx, W / 2 - 66, 12, 132, 26, '#0B0E22');
    rect(ctx, W / 2 - 65, 13, 130, 24, '#24183A');

    // Scène, à droite
    const sx = MX + 11.62 * CELL;
    const st = MY + 0.75 * CELL;
    const sh = 6.5 * CELL;
    rect(ctx, sx, st, W - sx - 3, sh, OUT);
    rect(ctx, sx + 2, st + 2, W - sx - 7, sh - 9, '#7A5236');
    for (let y = st + 7; y < st + sh - 9; y += 7) rect(ctx, sx + 2, y, W - sx - 7, 1, '#664430');
    rect(ctx, sx + 2, st + sh - 8, W - sx - 7, 6, '#4A3020');
    const mx = sx + (W - sx) / 2 + 2;
    const my = MY + 4 * CELL - 14;
    rect(ctx, mx, my, 1, 22, '#C9D2EE');
    rect(ctx, mx - 4, my + 21, 9, 1, '#C9D2EE');
    rect(ctx, mx - 1, my - 4, 3, 4, '#8C97BC');

    // Bar, au centre gauche
    const bx = MX + 2.25 * CELL;
    const by = MY + 2.35 * CELL;
    const bw = 3.5 * CELL;
    const bh = 3.3 * CELL;
    rect(ctx, bx - 1, by - 1, bw + 2, bh + 2, OUT);
    rect(ctx, bx, by, bw, bh, '#4A2E20');
    rect(ctx, bx + 3, by + 3, bw - 6, 34, '#2A1810');
    const bottles = ['#35C877', '#F0533F', '#FFC72C', '#4C8DFF', '#FF86B4', '#35C877', '#C9D2EE', '#F5A23A', '#4C8DFF'];
    bottles.forEach((c, i) => {
        const x = bx + 8 + i * 12;
        rect(ctx, x, by + 14, 5, 12, c);
        rect(ctx, x + 1, by + 9, 3, 5, c);
        rect(ctx, x + 1, by + 16, 1, 7, 'rgba(255,255,255,0.7)');
    });
    rect(ctx, bx + 3, by + 26, bw - 6, 3, '#6E4630');
    rect(ctx, bx - 4, by + bh - 30, bw + 8, 8, '#9A6A44');
    rect(ctx, bx - 4, by + bh - 30, bw + 8, 2, '#C08A5C');
    rect(ctx, bx - 4, by + bh - 22, bw + 8, 20, '#5A3826');
    for (let i = 0; i < 5; i += 1) {
        const x = bx + 6 + i * 22;
        rect(ctx, x, by + bh + 3, 10, 4, '#B0202A');
        rect(ctx, x + 4, by + bh + 7, 2, 7, OUT);
    }

    // Tables, à droite du couloir
    [[8.3, 2.6], [9.8, 4.1], [8.4, 5.6]].forEach(([cx, cy]) => {
        const x = MX + cx * CELL;
        const y = MY + cy * CELL;
        rect(ctx, x - 11, y - 5, 22, 11, OUT);
        rect(ctx, x - 10, y - 4, 20, 8, '#8A5C3C');
        rect(ctx, x - 10, y - 4, 20, 2, '#B07A52');
        rect(ctx, x - 1, y + 6, 3, 8, OUT);
        rect(ctx, x - 4, y - 9, 3, 5, '#F5A23A');
        rect(ctx, x + 3, y - 7, 3, 3, '#FFFFFF');
    });

    // Chemins entre les cases (tapis)
    board.spaces.forEach((space) => {
        const [x1, y1] = center(space);
        space.next.forEach((id) => {
            const target = board.spaces[id];
            const [x2, y2] = center(target);
            const backstage = space.corridor || target.corridor;
            const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
            for (let i = 0; i <= steps; i += 1) {
                const x = x1 + ((x2 - x1) * i) / steps;
                const y = y1 + ((y2 - y1) * i) / steps;
                rect(ctx, x - 5, y - 4, 10, 10, OUT);
            }
            for (let i = 0; i <= steps; i += 1) {
                const x = x1 + ((x2 - x1) * i) / steps;
                const y = y1 + ((y2 - y1) * i) / steps;
                rect(ctx, x - 4, y - 3, 8, 8, backstage ? '#3A2E52' : '#7A2F2F');
                if (i % 6 === 3) rect(ctx, x - 1, y, 2, 2, backstage ? '#6A5A8C' : '#B0504A');
            }
        });
    });

    board.spaces.forEach((space) => drawTile(ctx, space));
    return cv;
}

function drawTile(ctx, space, glow) {
    const [cx, cy] = center(space);
    const s = TILE[space.type] || TILE.blue;
    const x0 = cx - 13;
    const y0 = cy - 11;
    rect(ctx, x0 - 1, y0, 28, 23, OUT);
    rect(ctx, x0, y0 - 1, 26, 25, OUT);
    rect(ctx, x0, y0 + 17, 26, 6, s.side);
    rect(ctx, x0, y0, 26, 17, glow || s.top);
    rect(ctx, x0 + 1, y0 + 1, 24, 2, s.light);
    rect(ctx, x0 + 1, y0 + 15, 24, 1, 'rgba(0,0,0,0.18)');
    const icon = ICONS[s.icon];
    stamp(ctx, cx - Math.floor(icon[0].length / 2), y0 + 5 + (icon.length < 6 ? 1 : 0), icon, { '#': s.ink });
    if (space.stage) rect(ctx, x0 + 22, y0 + 3, 2, 2, '#FFC72C');
    if (space.gate) {
        rect(ctx, x0 - 5, y0 - 8, 3, 16, '#C9A227');
        rect(ctx, x0 + 28, y0 - 8, 3, 16, '#C9A227');
        rect(ctx, x0 - 3, y0 - 6, 32, 2, '#B0202A');
        rect(ctx, x0 - 5, y0 - 10, 3, 3, '#FFE08A');
        rect(ctx, x0 + 28, y0 - 10, 3, 3, '#FFE08A');
    }
}

// ---------------------------------------------------------------------------
// Décor animé
// ---------------------------------------------------------------------------

const CROWD = Array.from({ length: 30 }, (_, i) => ({
    x: 6 + i * 15.3 + ((i * 37) % 7),
    row: i % 2,
    shirt: ['#5A3E8C', '#2F5FA0', '#8C2F3E', '#2F7A5A', '#8C6A2F', '#3E3E5A'][(i * 7) % 6],
    skin: ['#8D5A3B', '#E9B892', '#C68863', '#6B4028', '#F3D2B8'][(i * 3) % 5],
    phase: (i * 0.37) % 1,
    arms: i % 4 === 0,
}));

function drawLive(ctx, t, nowMs, s, cheerUntil) {
    const W = BOARD_W;
    const beat = beatPhase(nowMs);
    const kick = Math.max(0, 1 - beat * 3);
    const bi = beatIndex(nowMs);

    // Guirlande qui clignote en rythme
    const bulbs = ['#FFC72C', '#F0533F', '#4C8DFF', '#35C877', '#FF86B4'];
    for (let x = 4, i = 0; x < W; x += 16, i += 1) {
        const sag = Math.round(Math.sin((x / W) * Math.PI * 7) * 2);
        rect(ctx, x, 4 + sag, 10, 1, '#0B0E22');
        const on = (i + bi) % 3 !== 0;
        rect(ctx, x + 4, 5 + sag, 3, 4, on ? bulbs[i % bulbs.length] : '#2A2F4A');
    }
    // Enseigne néon
    const flicker = Math.sin(t * 23) > 0.96 ? 0.4 : 1;
    ctx.globalAlpha = flicker;
    pixelText(ctx, 'OPEN MIC', W / 2, 15, '#FF86B4', 2);
    ctx.globalAlpha = 1;

    // Projecteurs de la scène
    const sx = MX + 11.62 * CELL;
    const owner = s.stageOwner && s.players.find((p) => p.id === s.stageOwner);
    [[0, '#FFE6A0'], [1, owner ? PLAYER_COLORS[owner.seat] : '#9CC0FF']].forEach(([k, color]) => {
        const sway = Math.sin(t * 0.9 + k * 2.2) * 14;
        const top = sx + 10 + k * 20;
        ctx.globalAlpha = owner ? 0.2 + kick * 0.08 : 0.1;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(top, MY - 4);
        ctx.lineTo(top + sway - 16, MY + 6.8 * CELL);
        ctx.lineTo(top + sway + 16, MY + 6.8 * CELL);
        ctx.lineTo(top + 6, MY - 4);
        ctx.fill();
        ctx.globalAlpha = 1;
    });

    // Enceintes : la membrane bat la mesure
    [[MY + 0.6 * CELL], [MY + 6.6 * CELL]].forEach(([y]) => {
        const x = BOARD_W - 22;
        rect(ctx, x - 10, y - 15, 20, 30, OUT);
        rect(ctx, x - 9, y - 14, 18, 28, '#2B3150');
        const r = 6 + Math.round(kick * 1.5);
        for (let yy = -r; yy <= r; yy += 1) {
            const w = Math.round(Math.sqrt(r * r - yy * yy));
            rect(ctx, x - w, y + 4 + yy, w * 2, 1, '#0B0E22');
        }
        rect(ctx, x - 2, y + 2, 4, 4, '#5A6178');
        rect(ctx, x - 3, y - 11, 6, 5, '#0B0E22');
    });

    // Barman derrière le comptoir
    const bx = MX + 3.7 * CELL;
    const by = MY + 2.35 * CELL + 30 + (Math.floor(t * 2) % 2);
    stamp(ctx, bx, by, [
        '..kkkk..',
        '.kssssk.',
        '.ksKsKk.',
        '.kssssk.',
        'kwwwwwwk',
        'kwwbbwwk',
    ], { k: OUT, s: '#C68863', K: '#1A1C2C', w: '#F4F4F4', b: '#B0202A' });

    // Le Videur, devant l'entrée du couloir des loges
    stamp(ctx, MX + 6.85 * CELL, MY + 1.15 * CELL, [
        '..kkkkk..',
        '.kssssssk',
        '.kKKsKKsk',
        '.kssssssk',
        'kkkkkkkkk',
        'kbbbbbbbk',
        'kbbbbwbbk',
        'kbbbbbbbk',
        'kbbbbbbbk',
        '.kbbkbbk.',
        '.kbk.kbk.',
        '.kk...kk.',
    ], { k: OUT, s: '#8D5A3B', K: '#0B0E22', b: '#262B3F', w: '#FFC72C' });

    // Foule en bas, qui saute en rythme (et s'emballe sur les beaux coups)
    const cheering = cheerUntil > nowMs;
    const baseY = MY + 9 * CELL + 10;
    CROWD.forEach((p) => {
        const ph = (beat + p.phase) % 1;
        const jump = cheering ? Math.round(Math.abs(Math.sin((t * 8 + p.phase * 6))) * 5) : (ph < 0.25 ? 1 : 0);
        const x = p.x;
        const y = baseY + p.row * 16 - jump;
        const shade = p.row ? 0.75 : 1;
        ctx.globalAlpha = shade;
        rect(ctx, x - 1, y - 1, 10, 22, OUT);
        rect(ctx, x, y + 7, 8, 14, p.shirt);
        rect(ctx, x + 1, y, 6, 7, p.skin);
        rect(ctx, x + 1, y, 6, 2, '#1A1C2C');
        if (p.arms || cheering) {
            const up = cheering || ph < 0.5;
            rect(ctx, x - 2, up ? y - 4 : y + 8, 2, up ? 10 : 6, p.skin);
            rect(ctx, x + 8, up ? y - 4 : y + 8, 2, up ? 10 : 6, p.skin);
        }
        ctx.globalAlpha = 1;
    });
    // Bord de scène devant la foule
    rect(ctx, 0, baseY - 6, BOARD_W, 2, 'rgba(0,0,0,0.35)');
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

const ORDINAL_OFFSETS = [[-9, -7], [9, -7], [-9, 6], [9, 6]];

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

export default function PartyBoard({ state, queue, myId, mapMode = false, onEvent, onChoose }) {
    const wrapRef = useRef(null);
    const canvasRef = useRef(null);
    const props = useRef({ mapMode, onEvent, onChoose, myId });
    props.current = { mapMode, onEvent, onChoose, myId };
    const live = useRef({
        state,
        bg: null,
        anims: {},
        poses: {},
        floats: [],
        flashes: {},
        dice: null,
        counters: {},   // joueur -> pas restants
        lastSeq: 0,
        prevSpaces: null,
        cam: { x: BOARD_W / 2, y: BOARD_H / 2, s: 1, ready: false },
        focusStarUntil: 0,
        cheerUntil: 0,
        arrows: [],
        last: 0,
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
        const posOf = (spaceId) => center(snap.board.spaces[spaceId]);
        const float = (text, color, spaceId, delay = 0, coin = false) => {
            if (spaceId == null) return;
            const [x, y] = posOf(spaceId);
            L.floats.push({ text, color, x, y: y - 54, start: now + delay, coin });
        };
        switch (event.type) {
            case 'roll':
                L.dice = { playerId: event.playerId, value: event.value, at: now };
                L.counters[event.playerId] = event.value;
                L.poses[event.playerId] = { pose: 'hop', until: now + 420 };
                sfx('hit');
                break;
            case 'move': {
                const hopMs = event.hopMs || 340;
                const from = previous && previous[event.playerId] != null ? previous[event.playerId] : null;
                const startLeft = L.counters[event.playerId] != null ? L.counters[event.playerId] : event.path.length;
                L.anims[event.playerId] = { path: event.path, from, start: now, hopMs, startLeft };
                L.counters[event.playerId] = Math.max(0, startLeft - event.path.length);
                event.path.forEach((id, i) => {
                    sfx('step', (i * hopMs + hopMs * 0.8) / 1000);
                    L.flashes[`${id}-${now}`] = { spaceId: id, at: now + i * hopMs + hopMs * 0.8 };
                });
                (event.effects || []).forEach((effect) => {
                    if (effect.type === 'tip') float(`-${effect.amount}`, '#FF9384', event.path[effect.step], effect.step * hopMs, true);
                });
                break;
            }
            case 'land':
                if (event.delta > 0) { float(`+${event.delta}`, '#FFE08A', event.spaceId, 0, true); sfx('coin'); }
                if (event.delta < 0) { float(`${event.delta}`, '#FF9384', event.spaceId, 0, true); sfx('loss'); }
                if (event.kind === 'drop') { float('DROP !', '#8EE8B6', event.spaceId); sfx('drop'); L.cheerUntil = now + 1800; }
                L.poses[event.playerId] = { pose: event.delta < 0 ? 'sad' : 'cheer', until: now + 1400 };
                L.counters[event.playerId] = null;
                L.dice = null;
                break;
            case 'chose':
                if (event.paid) float(`-${event.paid}`, '#FF9384', player && player.space, 0, true);
                break;
            case 'star':
                if (event.bought) {
                    float('+1', '#FFC72C', player && player.space);
                    L.poses[event.playerId] = { pose: 'cheer', until: now + 2400 };
                    L.cheerUntil = now + 2600;
                    L.focusStarUntil = now + 2600;
                    L.focusStarDelay = now + 900;
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
        const canvas = canvasRef.current;
        canvas.width = BOARD_W;
        canvas.height = BOARD_H;
        const ctx = canvas.getContext('2d');
        let raf = 0;
        let alive = true;

        const build = () => { L.bg = drawBackground(L.state.board); };
        build();
        if (document.fonts && document.fonts.load) document.fonts.load(FONT).then(() => { if (alive) { build(); textCache.clear(); } }).catch(() => {});

        // Position affichée d'un joueur (animée pendant ses sauts de case en case)
        const actorOf = (s, p, nowMs) => {
            const a = L.anims[p.id];
            let pos = center(s.board.spaces[p.space]);
            let lift = 0;
            let moving = false;
            let left = null;
            if (a) {
                const elapsed = nowMs - a.start;
                const hop = Math.floor(elapsed / a.hopMs);
                if (hop < a.path.length && a.from != null) {
                    const k = (elapsed % a.hopMs) / a.hopMs;
                    const fromId = hop === 0 ? a.from : a.path[hop - 1];
                    const p0 = center(s.board.spaces[fromId]);
                    const p1 = center(s.board.spaces[a.path[hop]]);
                    pos = [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k];
                    lift = Math.sin(k * Math.PI) * 10;
                    moving = true;
                    left = Math.max(0, a.startLeft - hop - (k > 0.8 ? 1 : 0));
                }
            }
            // Arrêt en route (carrefour, Micro d'or) : le compteur reste affiché
            if (!moving && L.counters[p.id] > 0) left = L.counters[p.id];
            return { p, pos, lift, moving, left };
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
            const { mapMode: map, myId: me } = props.current;

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(L.bg, 0, 0);
            drawLive(ctx, t, nowMs, s, L.cheerUntil);

            // Cases qui s'allument au passage
            Object.entries(L.flashes).forEach(([key, f]) => {
                const age = nowMs - f.at;
                if (age > 450) { delete L.flashes[key]; return; }
                if (age < 0) return;
                drawTile(ctx, s.board.spaces[f.spaceId], '#FFFFFF');
            });

            const currentId = s.phase === 'turn' ? s.currentPlayerId : null;
            const current = currentId && s.players.find((p) => p.id === currentId);
            const showAll = map || !current || s.phase !== 'turn';

            // Case du joueur actif : contour à sa couleur
            if (current && !map && current.space != null) {
                const [cx, cy] = center(s.board.spaces[current.space]);
                const pulse = 0.5 + Math.sin(t * 6) * 0.5;
                ctx.globalAlpha = 0.5 + pulse * 0.4;
                rect(ctx, cx - 16, cy - 14, 32, 2, PLAYER_COLORS[current.seat]);
                rect(ctx, cx - 16, cy + 13, 32, 2, PLAYER_COLORS[current.seat]);
                rect(ctx, cx - 16, cy - 14, 2, 29, PLAYER_COLORS[current.seat]);
                rect(ctx, cx + 14, cy - 14, 2, 29, PLAYER_COLORS[current.seat]);
                ctx.globalAlpha = 1;
            }

            // Micro d'or
            if (s.starSpace != null) {
                const space = s.board.spaces[s.starSpace];
                const [sx, sy] = center(space);
                const bob = Math.round(Math.sin(t * 3) * 2);
                ctx.globalAlpha = 0.35 + Math.sin(t * 5) * 0.15;
                rect(ctx, sx - 16, sy - 14, 32, 29, '#FFC72C');
                ctx.globalAlpha = 1;
                drawTile(ctx, space, '#FFD75A');
                stamp(ctx, sx - 11, sy - 46 + bob, GOLD_MIC, { y: '#FFC72C', Y: '#FFF1B0', d: '#C99400', k: OUT, g: '#F2C230' }, 2);
                const sp = Math.floor(t * 5) % 4;
                [[-15, -40], [13, -34], [-12, -24], [14, -48]].forEach(([dx, dy], i) => {
                    if (i === sp) { rect(ctx, sx + dx, sy + dy + bob, 2, 2, '#FFFFFF'); rect(ctx, sx + dx - 2, sy + dy + bob, 6, 1, 'rgba(255,255,255,0.6)'); }
                });
            }

            // Pions
            const actors = s.players.filter((p) => p.space != null).map((p) => actorOf(s, p, nowMs));
            const visible = actors.filter((a) => showAll || a.p.id === currentId);
            const hidden = actors.filter((a) => !showAll && a.p.id !== currentId);

            // Joueurs effacés : une pastille à leur couleur, avec leur numéro de passage
            hidden.forEach(({ p, pos }) => {
                const [ox, oy] = ORDINAL_OFFSETS[p.seat % 4];
                const x = Math.round(pos[0] + ox);
                const y = Math.round(pos[1] + oy);
                rect(ctx, x - 6, y - 6, 12, 12, OUT);
                rect(ctx, x - 5, y - 5, 10, 10, PLAYER_COLORS[p.seat]);
                rect(ctx, x - 5, y - 5, 10, 2, 'rgba(255,255,255,0.45)');
                const n = s.order.indexOf(p.id) + 1;
                if (n > 0) pixelText(ctx, String(n), x + 1, y - 6, '#1A1C2C', 1);
            });

            // Plusieurs pions visibles sur une case : on les écarte
            const bySpace = {};
            visible.forEach((a) => { if (!a.moving) bySpace[a.p.space] = (bySpace[a.p.space] || []).concat(a); });
            Object.values(bySpace).forEach((group) => {
                if (group.length < 2) return;
                const gap = s.phase === 'order' ? 22 : 12;
                group.forEach((a, i) => { a.pos = [a.pos[0] + (i - (group.length - 1) / 2) * gap, a.pos[1] + (i % 2 ? 4 : -4)]; });
            });
            visible.sort((a, b) => a.pos[1] - b.pos[1]);

            visible.forEach(({ p, pos, lift, moving, left }) => {
                const override = L.poses[p.id];
                let pose = 'idle';
                if (override && override.until > nowMs) pose = override.pose;
                else if (moving) pose = 'walk';
                else if (p.id === currentId && (s.step === 'roll' || s.step === 'intro')) pose = 'beatbox';
                else if (s.phase === 'order' && s.step === 'reveal') pose = 'dance';
                const frame = getFrame(p.characterId, pose, t + p.seat * 0.37, PLAYER_COLORS[p.seat]);
                const x = Math.round(pos[0] - SPRITE_W / 2);
                const y = Math.round(pos[1] - 48 - lift);
                ctx.drawImage(frame, x, y);
                const headY = y + 4;

                // Ordre de passage : chacun frappe son dé, le résultat reste affiché
                if (s.phase === 'order') {
                    const value = s.orderRolls[p.id];
                    const text = value != null ? String(value) : String(1 + (Math.floor(t * 16 + p.seat * 3) % 10));
                    const bx = Math.round(pos[0] - 9);
                    const by = headY - 32 + (value == null ? Math.round(Math.sin(t * 5 + p.seat) * 2) : 0);
                    rect(ctx, bx - 1, by - 1, 20, 20, OUT);
                    rect(ctx, bx, by, 18, 18, value != null ? '#FFFFFF' : '#FFC72C');
                    rect(ctx, bx, by + 15, 18, 3, value != null ? '#C9D2EE' : '#C99400');
                    pixelText(ctx, text, pos[0] + 1, by + 2, '#1A1C2C', 1.5);
                }
                // Dé au-dessus de la tête : il tourne, on le frappe, il affiche le résultat
                if (p.id === currentId) {
                    let blockText = null;
                    let gold = true;
                    if (s.step === 'roll') blockText = String(1 + (Math.floor(t * 16) % 10));
                    if (L.dice && L.dice.playerId === p.id && !moving && (s.step === 'rolled' || s.step === 'roll')) {
                        const age = nowMs - L.dice.at;
                        blockText = age < 260 ? String(1 + (Math.floor(t * 30) % 10)) : String(L.dice.value);
                        if (age >= 260 && age < 700) {
                            // Éclats autour du nombre
                            const r = 10 + (age - 260) / 25;
                            for (let k = 0; k < 8; k += 1) {
                                const a = (k / 8) * Math.PI * 2;
                                rect(ctx, pos[0] + Math.cos(a) * r, headY - 22 + Math.sin(a) * r, 2, 2, '#FFE08A');
                            }
                        }
                    }
                    if (left != null && left > 0 && (moving || s.step !== 'rolled')) { blockText = String(left); gold = false; }
                    if (blockText) {
                        const bobY = s.step === 'roll' ? Math.round(Math.sin(t * 5) * 2) : 0;
                        const size = gold ? 22 : 18;
                        const bx = Math.round(pos[0] - size / 2);
                        const by = headY - size - 12 + bobY;
                        rect(ctx, bx - 1, by - 1, size + 2, size + 2, OUT);
                        rect(ctx, bx, by, size, size, gold ? '#FFC72C' : '#FFFFFF');
                        rect(ctx, bx, by + size - 3, size, 3, gold ? '#C99400' : '#C9D2EE');
                        rect(ctx, bx + 2, by + 2, 4, 2, gold ? '#FFF1B0' : '#FFFFFF');
                        pixelText(ctx, blockText, pos[0] + 1, by + (gold ? 3 : 2), '#1A1C2C', 1.75);
                    }
                    if (!moving && s.step !== 'roll' && s.step !== 'rolled' && !blockText) {
                        const by = headY - 12 + Math.round(Math.sin(t * 6) * 2);
                        stamp(ctx, Math.round(pos[0]) - 4, by, ['#########', '.#######.', '..#####..', '...###...', '....#....'], { '#': p.id === me ? '#FFC72C' : '#FFFFFF' });
                    }
                }
            });

            // Flèches du carrefour
            L.arrows = [];
            if (s.step === 'choice' && s.choice && !map) {
                const here = s.board.spaces[s.choice.at];
                const [hx, hy] = center(here);
                choiceDirections(s).forEach((o) => {
                    const v = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] }[o.dir];
                    const pulse = Math.round(Math.sin(t * 7) * 2);
                    const ax = hx + v[0] * (26 + pulse);
                    const ay = hy + v[1] * (26 + pulse) - (v[1] === 0 ? 8 : 0);
                    const pattern = ARROWS[o.dir];
                    const color = o.affordable ? (s.choice.playerId === me ? '#FFC72C' : '#FFFFFF') : '#6C7AA6';
                    stamp(ctx, ax - pattern[0].length, ay - pattern.length, pattern.map((r) => r.replace(/#/g, 'k')), { k: OUT }, 2);
                    stamp(ctx, ax - pattern[0].length + 1, ay - pattern.length + 1, pattern, { '#': color }, 2);
                    if (o.gate) {
                        pixelText(ctx, `${o.gate}`, ax + 1, ay + pattern.length + 2, o.affordable ? '#FFE08A' : '#A9B3DA', 1);
                        stamp(ctx, ax - 10, ay + pattern.length + 3, COIN, { '#': OUT, Y: '#FFC72C', y: '#C99400', h: '#FFF1B0' });
                    }
                    L.arrows.push({ spaceId: o.spaceId, x: ax, y: ay, affordable: o.affordable });
                });
            }

            // Textes flottants (gains, pertes) avec une pièce de Hype
            L.floats = L.floats.filter((f) => nowMs - f.start < 1600);
            L.floats.forEach((f) => {
                const k = (nowMs - f.start) / 1600;
                if (k < 0) return;
                const y = f.y - Math.min(1, k * 3) * 14;
                ctx.globalAlpha = k > 0.8 ? (1 - k) * 5 : 1;
                pixelText(ctx, f.text, f.x + (f.coin ? 6 : 0), y, f.color, 2);
                if (f.coin) stamp(ctx, f.x - 22, y + 5, COIN, { '#': OUT, Y: '#FFC72C', y: '#C99400', h: '#FFF1B0' }, 2);
                ctx.globalAlpha = 1;
            });

            // ---------------- Caméra ----------------
            const wrap = wrapRef.current;
            if (wrap) {
                const cw = wrap.clientWidth;
                const ch = wrap.clientHeight;
                const fit = Math.max(Math.min(cw / BOARD_W, ch / BOARD_H), cw < 640 ? 1 : 0.5);
                const follow = Math.max(fit * 1.45, Math.min(cw < 640 ? 3.1 : 4.6, (ch * 0.3) / 54));
                let target = { x: BOARD_W / 2, y: BOARD_H / 2 - 6, s: fit };
                const starPos = s.starSpace != null ? center(s.board.spaces[s.starSpace]) : null;
                const activeActor = actors.find((a) => a.p.id === currentId);
                if (map) target = { x: BOARD_W / 2, y: BOARD_H / 2, s: fit };
                else if (s.step === 'starIntro' && starPos) target = { x: starPos[0], y: starPos[1] - 20, s: Math.max(fit * 1.8, follow * 0.85) };
                else if (L.focusStarUntil > nowMs && nowMs > (L.focusStarDelay || 0) && starPos) target = { x: starPos[0], y: starPos[1] - 20, s: follow * 0.8 };
                else if (s.step === 'choice' && s.choice) {
                    const [jx, jy] = center(s.board.spaces[s.choice.at]);
                    target = { x: jx, y: jy, s: follow * 0.8 };
                } else if (activeActor) target = { x: activeActor.pos[0], y: activeActor.pos[1] - 26 - activeActor.lift * 0.3, s: follow };

                const cam = L.cam;
                if (!cam.ready) { Object.assign(cam, target, { ready: true }); }
                const k = 1 - Math.exp(-dt * 3.2);
                cam.s += (target.s - cam.s) * k;
                cam.x += (target.x - cam.x) * k;
                cam.y += (target.y - cam.y) * k;
                // La vue reste sur le plateau
                const halfW = cw / 2 / cam.s;
                const halfH = ch / 2 / cam.s;
                const cx = BOARD_W > halfW * 2 ? Math.min(BOARD_W - halfW, Math.max(halfW, cam.x)) : BOARD_W / 2;
                const cy = BOARD_H > halfH * 2 ? Math.min(BOARD_H - halfH, Math.max(halfH, cam.y)) : BOARD_H / 2;
                const tx = cw / 2 - cx * cam.s;
                const ty = ch / 2 - cy * cam.s;
                L.view = { tx, ty, s: cam.s };
                canvas.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${cam.s.toFixed(3)})`;
            }
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
        const bx = (event.clientX - box.left - L.view.tx) / L.view.s;
        const by = (event.clientY - box.top - L.view.ty) / L.view.s;
        const hit = L.arrows.find((a) => Math.abs(a.x - bx) < 16 && Math.abs(a.y - by) < 16);
        if (hit && hit.affordable) props.current.onChoose(hit.spaceId);
    };

    return (
        <div ref={wrapRef} className="party-board-view" onPointerDown={handlePointer}>
            <canvas ref={canvasRef} className="party-pixel" aria-hidden="true" />
        </div>
    );
}
