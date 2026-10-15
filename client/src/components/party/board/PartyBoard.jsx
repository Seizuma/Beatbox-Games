import React, { useEffect, useRef } from 'react';
import { getFrame, PLAYER_COLORS, SPRITE_W } from '../characters/pixelRig';
import { sfx } from '../partySfx';

// Plateau en pixel art, dessiné dans un canvas basse résolution agrandi sans lissage.
// Le décor fixe est dessiné une fois (fond), puis à chaque image : Micro d'or,
// pions animés (sauts de case en case), dé, textes flottants.
// Sur un écran étroit, le plateau est zoomé et la caméra suit le joueur actif.

const CELL = 24;
const MX = 10;
const MY = 36;
const OUT = '#1A1C2C';
const FONT = '8px Silkscreen, monospace';

const TILE = {
    blue: { top: '#4C8DFF', side: '#2F5FC4', light: '#8DB6FF', icon: 'plus' },
    start: { top: '#FFC72C', side: '#C99400', light: '#FFE08A', icon: 'go' },
    red: { top: '#F0533F', side: '#A82E1E', light: '#FF9384', icon: 'minus' },
    drop: { top: '#35C877', side: '#1F8A4E', light: '#7FE3AA', icon: 'bang' },
};

const ICONS = {
    plus: ['..#..', '..#..', '#####', '..#..', '..#..'],
    minus: ['.....', '.....', '#####', '.....', '.....'],
    bang: ['..#..', '..#..', '..#..', '.....', '..#..'],
    go: ['.###..###.', '#....#...#', '#.##.#...#', '#..#.#...#', '.##...###.'],
};

const GOLD_MIC = [
    '..yyyyy..',
    '.yYyYyyy.',
    'yYyYyYyyd',
    'yyYyYyydd',
    '.yyyyydd.',
    '..ddddd..',
    '...kgk...',
    '...kgk...',
    '...kgk...',
    '...kgk...',
    '....k....',
];

const center = (space) => [MX + space.x * CELL + 12, MY + space.y * CELL + 12];

function stamp(ctx, x, y, rows, pal) {
    rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i += 1) {
            const c = pal[row[i]];
            if (c) {
                ctx.fillStyle = c;
                ctx.fillRect(x + i, y + j, 1, 1);
            }
        }
    });
}

function rect(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

// ---------------------------------------------------------------------------
// Décor fixe
// ---------------------------------------------------------------------------

function drawBackground(board, W, H) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');

    // Parquet du bar
    rect(ctx, 0, 0, W, H, '#3A2A22');
    for (let y = 0; y < H; y += 6) {
        rect(ctx, 0, y, W, 1, '#2E211B');
        const offset = (y / 6) % 2 ? 0 : 17;
        for (let x = offset; x < W; x += 34) rect(ctx, x, y, 1, 6, '#2E211B');
        for (let x = offset + 5; x < W; x += 34) rect(ctx, x, y + 2, 9, 1, '#44322A');
    }

    // Mur du fond, briques et guirlande
    rect(ctx, 0, 0, W, MY - 8, '#1B1F3B');
    for (let y = 2; y < MY - 10; y += 5) {
        for (let x = (y % 10 === 2 ? 0 : 6); x < W; x += 12) rect(ctx, x, y, 11, 4, '#232850');
    }
    rect(ctx, 0, MY - 9, W, 2, '#0F1229');
    const bulbs = ['#FFC72C', '#F0533F', '#4C8DFF', '#35C877', '#FF86B4'];
    for (let x = 6, i = 0; x < W; x += 14, i += 1) {
        const sag = Math.round(Math.sin((x / W) * Math.PI * 6) * 2);
        rect(ctx, x, 6 + sag, 8, 1, '#0B0E22');
        rect(ctx, x + 3, 7 + sag, 2, 3, bulbs[i % bulbs.length]);
    }
    // Enseigne
    ctx.font = FONT;
    ctx.textBaseline = 'top';
    rect(ctx, MX + 2.5 * CELL, 12, 94, 13, '#0B0E22');
    rect(ctx, MX + 2.5 * CELL + 1, 13, 92, 11, '#2A1A3A');
    ctx.fillStyle = '#FF86B4';
    ctx.fillText('OPEN MIC', MX + 2.5 * CELL + 13, 14);
    ctx.fillStyle = '#FFC72C';
    ctx.fillText('*', MX + 2.5 * CELL + 5, 14);
    ctx.fillText('*', MX + 2.5 * CELL + 84, 14);

    (board.decor || []).forEach((d) => {
        const x = MX + d.x * CELL;
        const y = MY + d.y * CELL;
        if (d.kind === 'stage') drawStage(ctx, x, y, W);
        if (d.kind === 'bar') drawBar(ctx, x, y);
        if (d.kind === 'tables') drawTables(ctx, x, y);
        if (d.kind === 'speaker') drawSpeaker(ctx, x, y);
        if (d.kind === 'bouncer') drawRope(ctx, x, y);
    });

    // Chemins entre les cases
    board.spaces.forEach((space) => {
        const [x1, y1] = center(space);
        space.next.forEach((id) => {
            const [x2, y2] = center(board.spaces[id]);
            const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
            for (let i = 0; i <= steps; i += 1) {
                const x = x1 + ((x2 - x1) * i) / steps;
                const y = y1 + ((y2 - y1) * i) / steps;
                rect(ctx, x - 3, y - 2, 6, 6, space.corridor || board.spaces[id].corridor ? '#2B2238' : '#5C4433');
                if (i % 4 === 0) rect(ctx, x - 1, y, 2, 2, space.corridor || board.spaces[id].corridor ? '#463A5C' : '#7A5C46');
            }
        });
    });

    // Cases
    board.spaces.forEach((space) => drawTile(ctx, space));
    return cv;
}

function drawTile(ctx, space) {
    const [cx, cy] = center(space);
    const s = TILE[space.type] || TILE.blue;
    const x0 = cx - 9;
    const y0 = cy - 8;
    rect(ctx, x0 - 1, y0, 20, 18, OUT);
    rect(ctx, x0, y0 - 1, 18, 20, OUT);
    rect(ctx, x0, y0 + 13, 18, 5, s.side);
    rect(ctx, x0, y0, 18, 13, s.top);
    rect(ctx, x0 + 1, y0 + 1, 16, 1, s.light);
    const icon = ICONS[s.icon];
    const iw = icon[0].length;
    stamp(ctx, cx - Math.floor(iw / 2), y0 + 4, icon, { '#': space.type === 'start' ? '#5A3E00' : '#FFFFFF' });
    if (space.stage) rect(ctx, x0 + 15, y0 + 2, 2, 2, '#FFC72C');
    if (space.gate) {
        // Corde du Videur
        rect(ctx, x0 - 3, y0 - 6, 2, 12, '#C9A227');
        rect(ctx, x0 + 19, y0 - 6, 2, 12, '#C9A227');
        rect(ctx, x0 - 1, y0 - 4, 20, 2, '#B0202A');
    }
}

function drawStage(ctx, x, y, W) {
    const top = y - 2.6 * CELL;
    const h = 5.2 * CELL;
    const left = x - 0.75 * CELL;
    rect(ctx, left, top, W - left - 2, h, '#0B0E22');
    rect(ctx, left + 2, top + 2, W - left - 6, h - 8, '#7A5236');
    for (let yy = top + 6; yy < top + h - 8; yy += 6) rect(ctx, left + 2, yy, W - left - 6, 1, '#664430');
    rect(ctx, left + 2, top + h - 7, W - left - 6, 5, '#4A3020');
    // Pied de micro
    const mx = x + 6;
    const my = y - 8;
    rect(ctx, mx, my, 1, 18, '#C9D2EE');
    rect(ctx, mx - 3, my + 17, 7, 1, '#C9D2EE');
    rect(ctx, mx - 1, my - 3, 3, 3, '#8C97BC');
}

function drawBar(ctx, x, y) {
    const left = x - 1.4 * CELL;
    const top = y - 1.3 * CELL;
    const w = 2.8 * CELL;
    const h = 2.6 * CELL;
    rect(ctx, left - 1, top - 1, w + 2, h + 2, OUT);
    rect(ctx, left, top, w, h, '#5A3A28');
    rect(ctx, left, top, w, 4, '#8A5C3C');
    rect(ctx, left + 2, top + 8, w - 4, h - 14, '#3A2418');
    const bottles = ['#35C877', '#F0533F', '#FFC72C', '#4C8DFF', '#FF86B4', '#35C877', '#C9D2EE'];
    bottles.forEach((c, i) => {
        const bx = left + 6 + i * 9;
        rect(ctx, bx, top + 13, 4, 8, c);
        rect(ctx, bx + 1, top + 10, 2, 3, c);
        rect(ctx, bx + 1, top + 14, 1, 4, '#FFFFFF');
    });
    rect(ctx, left + 2, top + h - 9, w - 4, 3, '#8A5C3C');
    for (let i = 0; i < 4; i += 1) {
        const sx = left + 8 + i * 15;
        rect(ctx, sx, top + h + 2, 7, 3, '#B0202A');
        rect(ctx, sx + 3, top + h + 5, 1, 5, '#0B0E22');
    }
}

function drawTables(ctx, x, y) {
    [[-14, -12], [12, 10]].forEach(([dx, dy]) => {
        const tx = x + dx;
        const ty = y + dy;
        rect(ctx, tx - 8, ty - 4, 16, 8, OUT);
        rect(ctx, tx - 7, ty - 3, 14, 6, '#8A5C3C');
        rect(ctx, tx - 7, ty - 3, 14, 1, '#A87450');
        rect(ctx, tx - 1, ty + 4, 2, 6, OUT);
        rect(ctx, tx - 2, ty - 6, 2, 3, '#FFC72C');
        rect(ctx, tx + 3, ty - 5, 2, 2, '#FFFFFF');
    });
}

function drawSpeaker(ctx, x, y) {
    rect(ctx, x - 8, y - 12, 16, 24, OUT);
    rect(ctx, x - 7, y - 11, 14, 22, '#2B3150');
    [[-4, 5], [4, 4]].forEach(([dy, r]) => {
        for (let yy = -r; yy <= r; yy += 1) {
            const w = Math.round(Math.sqrt(r * r - yy * yy));
            rect(ctx, x - w, y + dy + yy, w * 2, 1, '#0B0E22');
        }
        rect(ctx, x - 1, y + dy - 1, 2, 2, '#5A6178');
    });
}

function drawRope(ctx, x, y) {
    // Le Videur, en sentinelle à l'entrée du couloir des loges
    stamp(ctx, Math.round(x + 8), Math.round(y - 22), [
        '..kkkk..',
        '.kssssk.',
        '.kKsKsk.',
        '.kssssk.',
        'kkkkkkkk',
        'kbbbbbbk',
        'kbbbwbbk',
        'kbbbbbbk',
        '.kbkkbk.',
        '.kbk.kbk',
        '.kk...kk',
    ], { k: OUT, s: '#8D5A3B', K: '#0B0E22', b: '#262B3F', w: '#FFC72C' });
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export default function PartyBoard({ state, queue, myId }) {
    const wrapRef = useRef(null);
    const canvasRef = useRef(null);
    const live = useRef({
        state,
        bg: null,
        boardId: null,
        anims: {},      // joueur -> { path, from, start, hopMs }
        poses: {},      // joueur -> { pose, until }
        floats: [],     // textes flottants
        dice: null,     // { playerId, value, until }
        lastSeq: 0,
        prevSpaces: null,
        view: { scale: 1, offsetX: 0, offsetY: 0 },
    });

    const board = state.board;
    const W = 13 * CELL + MX * 2;
    const H = 9 * CELL + MY + 6;

    // Dernier état pour le dessin
    useEffect(() => {
        live.current.state = state;
    }, [state]);

    // Événements à animer : chaque instantané reçu passe ici, même ceux arrivés
    // dans le même paquet réseau (React n'en afficherait que le dernier)
    const processSnapshot = (snap, now) => {
        const L = live.current;
        const event = snap.event;
        const previous = L.prevSpaces;
        L.prevSpaces = Object.fromEntries(snap.players.map((p) => [p.id, p.space]));
        if (!event || event.seq <= L.lastSeq) return;
        const first = L.lastSeq === 0;
        L.lastSeq = event.seq;
        if (first && Date.now() - (event.at || 0) > 3000) return;
        const player = snap.players.find((p) => p.id === event.playerId);
        const posOf = (spaceId) => center(snap.board.spaces[spaceId]);
        const float = (text, color, spaceId, delay = 0) => {
            if (spaceId == null) return;
            const [x, y] = posOf(spaceId);
            L.floats.push({ text, color, x, y: y - 44, start: now + delay });
        };
        switch (event.type) {
            case 'roll':
                L.dice = { playerId: event.playerId, value: event.value, until: now + 1300 };
                sfx('roll');
                break;
            case 'move': {
                const hopMs = event.hopMs || 300;
                const from = previous && previous[event.playerId] != null ? previous[event.playerId] : previousSpace(snap, player, event.path);
                L.anims[event.playerId] = { path: event.path, from, start: now, hopMs };
                event.path.forEach((_, i) => sfx('hop', (i * hopMs) / 1000));
                (event.effects || []).forEach((effect) => {
                    if (effect.type === 'tip') float(`-${effect.amount}`, '#FF9384', event.path[effect.step], effect.step * hopMs);
                });
                break;
            }
            case 'land':
                if (event.delta > 0) { float(`+${event.delta}`, '#FFE08A', event.spaceId); sfx('coin'); }
                if (event.delta < 0) { float(`${event.delta}`, '#FF9384', event.spaceId); sfx('loss'); }
                if (event.kind === 'drop') { float('DROP!', '#7FE3AA', event.spaceId); sfx('drop'); }
                L.poses[event.playerId] = { pose: event.delta < 0 ? 'sad' : 'cheer', until: now + 1100 };
                break;
            case 'chose':
                if (event.paid) float(`-${event.paid}`, '#FF9384', player && player.space);
                break;
            case 'star':
                if (event.bought) {
                    float('+1 MIC', '#FFC72C', player && player.space);
                    L.poses[event.playerId] = { pose: 'cheer', until: now + 2000 };
                    sfx('star');
                }
                break;
            case 'turn':
                sfx('turn');
                break;
            default:
        }
    };

    // Fond, boucle de dessin, taille
    useEffect(() => {
        const L = live.current;
        const canvas = canvasRef.current;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        let raf = 0;
        let alive = true;

        const build = () => {
            L.bg = drawBackground(L.state.board, W, H);
            L.boardId = L.state.board.id;
        };
        build();
        // La police pixel arrive après le premier dessin : on refait le fond
        if (document.fonts && document.fonts.load) document.fonts.load(FONT).then(() => { if (alive) build(); }).catch(() => {});

        const resize = () => {
            const wrap = wrapRef.current;
            if (!wrap) return;
            const cw = wrap.clientWidth;
            const fit = cw / W;
            // Écran étroit : plateau zoomé, la caméra suit le joueur. Écran large : tout le plateau, sans dépasser la hauteur visible
            const maxHeight = Math.max(300, window.innerHeight * 0.64);
            const scale = cw < 560 ? Math.max(fit, 1.75) : Math.min(fit, maxHeight / H);
            L.view.scale = scale;
            canvas.style.width = `${W * scale}px`;
            canvas.style.height = `${H * scale}px`;
            wrap.style.height = `${Math.min(H * scale, cw < 560 ? 420 : H * scale)}px`;
        };
        resize();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
        if (ro) ro.observe(wrapRef.current);

        const draw = (nowMs) => {
            if (!alive) return;
            if (queue && queue.current.length) {
                const pending = queue.current.splice(0, queue.current.length);
                pending.forEach((snap) => processSnapshot(snap, nowMs));
            }
            const s = L.state;
            const t = nowMs / 1000;
            ctx.drawImage(L.bg, 0, 0);

            // Projecteur sur la scène quand quelqu'un l'occupe
            if (s.stageOwner) {
                const owner = s.players.find((p) => p.id === s.stageOwner);
                ctx.globalAlpha = 0.18 + Math.sin(t * 4) * 0.04;
                ctx.fillStyle = PLAYER_COLORS[owner ? owner.seat : 0];
                ctx.beginPath();
                ctx.moveTo(W - 30, 0);
                ctx.lineTo(W - 70, MY + 7 * CELL);
                ctx.lineTo(W - 4, MY + 7 * CELL);
                ctx.lineTo(W - 10, 0);
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            // Micro d'or
            if (s.starSpace != null) {
                const [sx, sy] = center(s.board.spaces[s.starSpace]);
                const bob = Math.round(Math.sin(t * 3) * 2);
                ctx.globalAlpha = 0.35 + Math.sin(t * 5) * 0.15;
                rect(ctx, sx - 11, sy - 10, 22, 21, '#FFC72C');
                ctx.globalAlpha = 1;
                drawTile(ctx, s.board.spaces[s.starSpace]);
                stamp(ctx, sx - 4, sy - 28 + bob, GOLD_MIC, { y: '#FFC72C', Y: '#FFF1B0', d: '#C99400', k: OUT, g: '#F2C230' });
                const sp = Math.floor(t * 4) % 4;
                [[-9, -26], [8, -22], [-7, -16], [9, -30]].forEach(([dx, dy], i) => {
                    if (i === sp) rect(ctx, sx + dx, sy + dy + bob, 1, 1, '#FFFFFF');
                });
            }

            // Pions : positions (animées ou au repos), triés de haut en bas
            const actors = s.players.filter((p) => p.space != null).map((p) => {
                const a = L.anims[p.id];
                let pos = center(s.board.spaces[p.space]);
                let lift = 0;
                let moving = false;
                let left = null;
                if (a) {
                    const elapsed = nowMs - a.start;
                    const hop = Math.floor(elapsed / a.hopMs);
                    if (hop < a.path.length) {
                        const k = (elapsed % a.hopMs) / a.hopMs;
                        const fromId = hop === 0 ? a.from : a.path[hop - 1];
                        const p0 = center(s.board.spaces[fromId ?? a.path[0]]);
                        const p1 = center(s.board.spaces[a.path[hop]]);
                        pos = [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k];
                        lift = Math.sin(k * Math.PI) * 8;
                        moving = true;
                        left = a.path.length - hop;
                    }
                }
                return { p, pos, lift, moving, left };
            });
            // Plusieurs pions sur une case : on les écarte
            const bySpace = {};
            actors.forEach((a) => {
                if (a.moving) return;
                const k = a.p.space;
                bySpace[k] = (bySpace[k] || []).concat(a);
            });
            Object.values(bySpace).forEach((group) => {
                if (group.length < 2) return;
                group.forEach((a, i) => {
                    a.pos = [a.pos[0] + (i - (group.length - 1) / 2) * 9, a.pos[1] + (i % 2 ? 3 : -3)];
                });
            });
            actors.sort((a, b) => a.pos[1] - b.pos[1]);

            const currentId = s.currentPlayerId;
            actors.forEach(({ p, pos, lift, moving, left }) => {
                const override = L.poses[p.id];
                let pose = 'idle';
                if (moving) pose = 'walk';
                else if (override && override.until > nowMs) pose = override.pose;
                else if (p.id === currentId && (s.step === 'roll' || s.step === 'intro')) pose = 'beatbox';
                else if (s.phase === 'end') pose = 'dance';
                const frame = getFrame(p.characterId, pose, t + p.seat * 0.37, PLAYER_COLORS[p.seat]);
                const x = Math.round(pos[0] - SPRITE_W / 2);
                const y = Math.round(pos[1] - 46 - lift);
                ctx.drawImage(frame, x, y);

                // Joueur actif : flèche au-dessus de la tête
                if (p.id === currentId && !moving && s.step !== 'roll') {
                    const by = y + 2 + Math.round(Math.sin(t * 6) * 2);
                    stamp(ctx, Math.round(pos[0]) - 3, by, ['#######', '.#####.', '..###..', '...#...'], { '#': p.id === myId ? '#FFC72C' : '#FFFFFF' });
                }
                // Dé tempo au-dessus du joueur qui doit lancer, puis le nombre de pas restants
                let diceValue = null;
                if (p.id === currentId && s.step === 'roll') diceValue = 1 + (Math.floor(t * 14) % 10);
                if (L.dice && L.dice.playerId === p.id && L.dice.until > nowMs) diceValue = L.dice.value;
                if (moving && left != null) diceValue = left;
                if (diceValue != null) drawDice(ctx, Math.round(pos[0]), y - 6, diceValue, moving);
            });

            // Textes flottants
            ctx.font = FONT;
            ctx.textBaseline = 'top';
            ctx.textAlign = 'center';
            L.floats = L.floats.filter((f) => nowMs - f.start < 1400);
            L.floats.forEach((f) => {
                const k = (nowMs - f.start) / 1400;
                if (k < 0) return;
                const y = Math.round(f.y - k * 16);
                ctx.fillStyle = OUT;
                [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => ctx.fillText(f.text, Math.round(f.x) + dx, y + dy));
                ctx.fillStyle = f.color;
                ctx.fillText(f.text, Math.round(f.x), y);
            });
            ctx.textAlign = 'left';

            // Caméra : suit le joueur actif quand le plateau déborde
            const wrap = wrapRef.current;
            if (wrap) {
                const cw = wrap.clientWidth;
                const ch = wrap.clientHeight;
                const sc = L.view.scale;
                const focus = actors.find((a) => a.p.id === currentId) || actors.find((a) => a.p.id === myId);
                const fx = focus ? focus.pos[0] : W / 2;
                const fy = focus ? focus.pos[1] - 20 : H / 2;
                const targetX = W * sc <= cw ? (cw - W * sc) / 2 : Math.min(0, Math.max(cw - W * sc, cw / 2 - fx * sc));
                const targetY = H * sc <= ch ? (ch - H * sc) / 2 : Math.min(0, Math.max(ch - H * sc, ch / 2 - fy * sc));
                L.view.offsetX += (targetX - L.view.offsetX) * 0.12;
                L.view.offsetY += (targetY - L.view.offsetY) * 0.12;
                canvas.style.transform = `translate(${L.view.offsetX.toFixed(1)}px, ${L.view.offsetY.toFixed(1)}px)`;
            }
            raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => {
            alive = false;
            cancelAnimationFrame(raf);
            if (ro) ro.disconnect();
        };
        // Le plateau ne change pas en cours de partie
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [board.id]);

    return (
        <div ref={wrapRef} className="party-board" aria-hidden="true">
            <canvas ref={canvasRef} className="party-pixel" />
        </div>
    );
}

// Case de départ d'un déplacement : la case actuelle du joueur moins le chemin parcouru
function previousSpace(state, player, path) {
    const first = path[0];
    const spaces = state.board.spaces;
    const prev = spaces.find((space) => space.next.includes(first));
    return prev ? prev.id : player.space;
}

function drawDice(ctx, cx, bottom, value, small) {
    const size = small ? 11 : 15;
    const x = cx - Math.floor(size / 2);
    const y = bottom - size;
    rect(ctx, x - 1, y - 1, size + 2, size + 2, OUT);
    rect(ctx, x, y, size, size, small ? '#FFFFFF' : '#FFC72C');
    rect(ctx, x, y + size - 2, size, 2, small ? '#C9D2EE' : '#C99400');
    ctx.font = FONT;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillStyle = OUT;
    ctx.fillText(String(value), cx + (value === 10 ? 0 : 1), y + (small ? 1 : 3));
    ctx.textAlign = 'left';
}
