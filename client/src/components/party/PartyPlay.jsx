import React, { useCallback, useEffect, useRef, useState } from 'react';
import PartyBoard, { choiceDirections } from './board/PartyBoard';
import PixelCharacter from './PixelCharacter';
import MinigameStage from './minigames/MinigameStage';
import { PLAYER_COLORS } from './characters/pixelRig';
import { isMusicOn, jingle, setMusicFinale, setMusicOn, sfx, startMusic, stopMusic, unlockAudio } from './partySfx';

// L'écran de jeu, construit comme un Mario Party :
// - le plateau occupe tout l'écran, avec sa caméra ;
// - les quatre joueurs dans les coins (portrait, rang, Hype, Micros d'or) ;
// - des bandeaux annoncent chaque moment (tour d'un joueur, Micro d'or, Rappel, mini-jeu) ;
// - une boîte de dialogue en bas porte les choix du joueur actif.

// Texte de l'événement le plus récent, pour la boîte de dialogue des spectateurs
export function describeEvent(event, players, t) {
    if (!event) return '';
    const name = (id) => (players.find((p) => p.id === id) || {}).name || '?';
    switch (event.type) {
        case 'started': return t('events.started');
        case 'orderRoll': return t('events.orderRoll', { name: name(event.playerId), n: event.value });
        case 'order': return t('events.order', { name: name(event.order[0]) });
        case 'roll': return t('events.roll', { name: name(event.playerId), n: event.value });
        case 'land':
            if (event.kind === 'drop') return t('events.drop', { name: name(event.playerId) });
            if (event.kind === 'red') return t('events.red', { name: name(event.playerId), n: Math.abs(event.delta) });
            return t(`events.${event.kind}`, { name: name(event.playerId), n: event.delta });
        case 'chose': return event.paid ? t('events.gate', { name: name(event.playerId), n: event.paid }) : '';
        case 'star':
            return event.bought ? t('events.bought', { name: name(event.playerId) }) : t('events.declined', { name: name(event.playerId) });
        case 'starOffer': return event.affordable ? '' : t('events.noMoney', { name: name(event.playerId) });
        case 'disconnected': return t('events.disconnected', { name: name(event.playerId) });
        case 'reconnected': return t('events.reconnected', { name: name(event.playerId) });
        default: return '';
    }
}

// Rangs : Micros d'or puis Hype, ex aequo au même rang
export function computeRanks(players) {
    const sorted = [...players].sort((a, b) => (b.stars - a.stars) || (b.hype - a.hype));
    const ranks = {};
    sorted.forEach((p, i) => {
        const prev = sorted[i - 1];
        ranks[p.id] = i > 0 && prev.stars === p.stars && prev.hype === p.hype ? ranks[prev.id] : i + 1;
    });
    return ranks;
}

// Compteur qui défile jusqu'à sa nouvelle valeur (comme les pièces de Mario Party)
function useRollingNumber(value) {
    const [shown, setShown] = useState(value);
    const [flash, setFlash] = useState(null);
    const fromRef = useRef(value);
    useEffect(() => {
        const from = fromRef.current;
        if (from === value) return undefined;
        setFlash(value > from ? 'up' : 'down');
        const start = performance.now();
        const duration = Math.min(900, 120 + Math.abs(value - from) * 70);
        let raf = 0;
        const step = (now) => {
            const k = Math.min(1, (now - start) / duration);
            const v = Math.round(from + (value - from) * k);
            setShown(v);
            if (k < 1) raf = requestAnimationFrame(step);
            else {
                fromRef.current = value;
                setTimeout(() => setFlash(null), 250);
            }
        };
        raf = requestAnimationFrame(step);
        return () => {
            cancelAnimationFrame(raf);
            fromRef.current = value;
        };
    }, [value]);
    return [shown, flash];
}

function useSecondsLeft(deadline, clockOffset) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!deadline) return undefined;
        const timer = setInterval(() => setNow(Date.now()), 200);
        return () => clearInterval(timer);
    }, [deadline]);
    if (!deadline) return null;
    return Math.max(0, (deadline - (now + clockOffset)) / 1000);
}

function CoinIcon({ size = 14 }) {
    return (
        <svg viewBox="0 0 5 5" width={size} height={size} className="party-pixel shrink-0" shapeRendering="crispEdges" aria-hidden="true">
            <path d="M1 0h3v1H1zM0 1h1v3H0zM4 1h1v3H4zM1 4h3v1H1z" fill="#1A1C2C" />
            <path d="M1 1h3v3H1z" fill="#FFC72C" />
            <path d="M2 2h1v1H2z" fill="#FFF1B0" />
            <path d="M3 1h1v3H3z" fill="#C99400" />
        </svg>
    );
}

function MicIcon({ size = 14 }) {
    return (
        <svg viewBox="0 0 5 7" width={size * 0.75} height={size} className="party-pixel shrink-0" shapeRendering="crispEdges" aria-hidden="true">
            <path d="M1 0h3v1H1zM0 1h1v2H0zM4 1h1v2H4zM1 3h3v1H1zM2 4h1v3H2z" fill="#1A1C2C" />
            <path d="M1 1h3v2H1z" fill="#FFC72C" />
            <path d="M1 1h1v1H1z" fill="#FFF1B0" />
        </svg>
    );
}

// ---------------------------------------------------------------------------
// Joueurs dans les coins
// ---------------------------------------------------------------------------

function PlayerCard({ player, rank, active, isMe, t, compact, orderRoll }) {
    const [hype, hypeFlash] = useRollingNumber(player.hype);
    const [stars, starFlash] = useRollingNumber(player.stars);
    const color = PLAYER_COLORS[player.seat];
    return (
        <div
            className={`party-hud-card ${active ? 'is-active' : ''} ${compact ? 'is-compact' : ''}`}
            style={{ '--pc': color }}
        >
            <div className="party-hud-portrait">
                <PixelCharacter id={player.characterId} color={color} pose={active ? 'beatbox' : 'idle'} base={false} scale={compact ? 1.25 : 1.75} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <span className="party-font party-hud-rank">{t(`screen.rank.${rank}`)}</span>
                    {!compact && <span className="truncate text-sm font-bold">{player.name}</span>}
                    {isMe && !compact && <span className="party-font text-[0.6rem] text-[color:var(--px-yellow)]">{t('lobby.you')}</span>}
                </div>
                {compact && <p className="truncate text-[0.7rem] font-bold leading-tight">{player.name}</p>}
                <div className="party-font flex items-center gap-3 leading-none">
                    <span className={`flex items-center gap-1 ${starFlash === 'up' ? 'party-flash-up' : ''}`}>
                        <MicIcon size={compact ? 12 : 15} />
                        <span className={compact ? 'text-sm' : 'text-lg'}>{stars}</span>
                    </span>
                    <span className={`flex items-center gap-1 ${hypeFlash === 'up' ? 'party-flash-up' : hypeFlash === 'down' ? 'party-flash-down' : ''}`}>
                        <CoinIcon size={compact ? 11 : 14} />
                        <span className={compact ? 'text-sm' : 'text-lg'}>{hype}</span>
                    </span>
                    {orderRoll != null && <span className="text-sm text-[color:var(--px-green)]">D{orderRoll}</span>}
                </div>
                {!player.isBot && !player.connected && <p className="party-font text-[0.6rem] text-[color:var(--px-red)]">{t('lobby.offline')}</p>}
            </div>
        </div>
    );
}

function Hud({ state, myId, t, compact, inline }) {
    const ranks = computeRanks(state.players);
    const ordered = state.order && state.order.length
        ? state.order.map((id) => state.players.find((p) => p.id === id)).filter(Boolean)
        : [...state.players].sort((a, b) => a.seat - b.seat);
    const corners = ['party-hud-tl', 'party-hud-tr', 'party-hud-bl', 'party-hud-br'];
    return (
        <div className={compact ? `party-hud-row${inline ? ' is-inline' : ''}` : ''}>
            {ordered.map((p, i) => (
                <div key={p.id} className={compact ? '' : `party-hud-corner ${corners[i]}`}>
                    <PlayerCard
                        player={p}
                        rank={ranks[p.id]}
                        active={state.currentPlayerId === p.id}
                        isMe={p.id === myId}
                        t={t}
                        compact={compact}
                        orderRoll={state.phase === 'order' ? state.orderRolls[p.id] : null}
                    />
                </div>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Bandeaux d'annonce
// ---------------------------------------------------------------------------

function Banner({ banner }) {
    if (!banner) return null;
    const color = banner.color || 'var(--px-yellow)';
    return (
        <div className={`party-banner-layer ${banner.low ? 'is-low' : ''}`} aria-live="assertive">
            <div key={banner.id} className="party-banner" style={{ '--bc': color }}>
                {banner.character && (
                    <div className="party-banner-portrait">
                        <PixelCharacter id={banner.character} color={color} pose="cheer" scale={3} />
                    </div>
                )}
                <div className="min-w-0">
                    {banner.kicker && <p className="party-font text-sm text-[color:var(--px-muted)] sm:text-base">{banner.kicker}</p>}
                    <p className="party-font party-banner-title" style={{ color }}>{banner.title}</p>
                    {banner.text && <p className="mt-1 text-base font-bold sm:text-lg">{banner.text}</p>}
                    {banner.list && (
                        <ol className="party-font mt-2 flex flex-wrap gap-x-4 gap-y-1 text-base">
                            {banner.list.map((item, i) => <li key={item.id} style={{ color: item.color }}>{i + 1}. {item.name}</li>)}
                        </ol>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Boîte de dialogue (en bas)
// ---------------------------------------------------------------------------

const DIR_GLYPH = { left: '←', right: '→', up: '↑', down: '↓' };

function Dock({ state, myId, t, secondsLeft, actions, message, mapMode, onToggleMap, musicOn, onToggleMusic }) {
    const current = state.players.find((p) => p.id === state.currentPlayerId);
    const mine = current && current.id === myId;
    const name = current ? current.name : '';

    let body = null;
    if (state.phase === 'order') {
        const rolled = state.orderRolls[myId] != null;
        if (state.step === 'roll' && !rolled) {
            body = (
                <div className="flex flex-wrap items-center gap-3">
                    <p className="party-font text-base sm:text-lg">{t('board.orderRoll')}</p>
                    <button type="button" className="party-btn party-btn-big" onClick={actions.roll}>{t('board.roll')}</button>
                </div>
            );
        } else body = <p className="party-font party-blink">{state.step === 'roll' ? t('board.orderWaiting') : message}</p>;
    } else if (mine && state.step === 'roll') {
        body = (
            <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="party-btn party-btn-big" onClick={actions.roll}>
                    {t('board.roll')} <span className="hidden text-xs opacity-70 sm:inline">[{t('screen.rollHint')}]</span>
                </button>
                <p className="party-font text-base text-[color:var(--px-yellow)]">{t('board.yourTurn')}</p>
            </div>
        );
    } else if (mine && state.step === 'choice' && state.choice) {
        body = (
            <div className="flex flex-col gap-2">
                <p className="party-font text-lg text-[color:var(--px-yellow)]">{t('board.choiceTitle')}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                    {choiceDirections(state).map((o) => (
                        <button key={o.spaceId} type="button" className={`party-btn ${o.gate ? '' : 'party-btn-ghost'} !justify-start text-left`} disabled={!o.affordable} onClick={() => actions.choose(o.spaceId)}>
                            <span className="text-2xl leading-none">{DIR_GLYPH[o.dir]}</span>
                            <span className="flex flex-col">
                                <span className="text-sm">{o.gate ? t('board.choiceGate') : t('board.choiceMain')}</span>
                                <span className="font-show text-[0.7rem] font-bold normal-case opacity-80">
                                    {o.gate ? t('board.choiceGateInfo', { n: o.gate }) : t('board.choiceMainInfo')}
                                    {!o.affordable && ` · ${t('board.notEnough')}`}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
                <p className="text-xs text-[color:var(--px-muted)]">{t('screen.choiceHint')}</p>
            </div>
        );
    } else if (mine && state.step === 'star' && state.starOffer && state.starOffer.affordable) {
        body = (
            <div className="flex flex-col gap-3">
                <p className="party-font flex items-center gap-2 text-lg text-[color:var(--px-yellow)]"><MicIcon size={20} /> {t('board.starAsk', { price: state.starOffer.price })}</p>
                <div className="flex flex-wrap gap-3">
                    <button type="button" className="party-btn party-btn-big" onClick={() => actions.star(true)}>{t('board.buy')}</button>
                    <button type="button" className="party-btn party-btn-ghost" onClick={() => actions.star(false)}>{t('board.skip')}</button>
                </div>
            </div>
        );
    } else {
        let text = message;
        if (state.step === 'roll' && current) text = t('board.rolling', { name });
        if (state.step === 'choice' && current) text = t('board.waitingChoice', { name });
        if (state.step === 'star' && state.starOffer) {
            text = state.starOffer.affordable ? t('board.waitingStar', { name }) : (mine ? t('board.starNoMoney', { price: state.starOffer.price }) : t('events.noMoney', { name }));
        }
        if ((state.step === 'rolled' || state.step === 'moving') && state.roll && current) text = t('board.moving', { name, n: state.roll.value });
        body = <p className={`party-font text-base sm:text-lg ${state.step === 'roll' && !mine ? 'party-blink' : ''}`}>{text || ' '}</p>;
    }

    const myDecision = mine && ['roll', 'choice', 'star'].includes(state.step);
    const duration = { roll: 30, choice: 15, star: 15 }[state.step] || 30;
    return (
        <div className="party-dock">
            {myDecision && secondsLeft != null && (
                <div className="party-dock-timer" aria-hidden="true">
                    <div style={{ width: `${Math.min(100, (secondsLeft / duration) * 100)}%`, background: secondsLeft < 5 ? 'var(--px-red)' : 'var(--px-yellow)' }} />
                </div>
            )}
            <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">{body}</div>
                <div className="flex shrink-0 flex-col gap-1.5">
                    <button type="button" className="party-btn party-btn-ghost !min-h-[2.4rem] !px-3 text-xs" onClick={onToggleMap} aria-pressed={mapMode}>
                        {mapMode ? t('screen.mapBack') : t('screen.map')}
                    </button>
                    <button type="button" className="party-btn party-btn-ghost !min-h-[2.4rem] !px-3 text-xs" onClick={onToggleMusic} aria-label={musicOn ? t('screen.musicOn') : t('screen.musicOff')} title={musicOn ? t('screen.musicOn') : t('screen.musicOff')}>
                        {musicOn ? '♪' : '♪̸'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

function useCompact() {
    const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth < 760);
    useEffect(() => {
        const onResize = () => setCompact(window.innerWidth < 760);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return compact;
}

export default function PartyPlay({ state, myId, t, queue, clockOffset, actions }) {
    const secondsLeft = useSecondsLeft(state.deadline, clockOffset);
    const compact = useCompact();
    const [mapMode, setMapMode] = useState(false);
    const [banner, setBanner] = useState(null);
    const [musicOn, setMusicOnState] = useState(isMusicOn());
    const bannerTimer = useRef(null);
    const stateRef = useRef(state);
    stateRef.current = state;

    const current = state.players.find((p) => p.id === state.currentPlayerId);
    const myTurn = state.phase === 'turn' && current && current.id === myId;
    const message = describeEvent(state.event, state.players, t);

    const show = useCallback((next, ms = 2200) => {
        setBanner({ ...next, id: `${Date.now()}-${Math.random()}` });
        clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBanner(null), ms);
        sfx('banner');
    }, []);
    useEffect(() => () => clearTimeout(bannerTimer.current), []);

    // Les événements du plateau déclenchent les annonces
    const onEvent = useCallback((event, snap) => {
        const player = snap.players.find((p) => p.id === event.playerId);
        const total = snap.settings.turns;
        switch (event.type) {
            case 'order': {
                const list = event.order.map((id) => snap.players.find((p) => p.id === id)).filter(Boolean)
                    .map((p) => ({ id: p.id, name: p.name, color: PLAYER_COLORS[p.seat] }));
                show({ title: t('banner.order'), list }, 3200);
                break;
            }
            case 'starIntro':
                show({ title: t('banner.starHere'), text: t('banner.starHereText', { price: snap.starPrice }), low: true }, 3000);
                break;
            case 'turn': {
                if (!player) break;
                const first = snap.order[0] === player.id;
                const kicker = first ? (event.turn === total ? t('banner.lastRound') : t('banner.round', { turn: event.turn, total })) : t('banner.turnOf');
                show({
                    kicker,
                    title: player.id === myId ? t('banner.yourTurn') : player.name,
                    color: PLAYER_COLORS[player.seat],
                    character: player.characterId,
                }, 2100);
                jingle(player.characterId);
                if (player.id === myId && navigator.vibrate) navigator.vibrate([30, 40, 30]);
                setMapMode(false);
                break;
            }
            case 'finale':
                show({ title: t('banner.finale'), text: t('banner.finaleText'), color: 'var(--px-red)' }, 2800);
                setMusicFinale(true);
                break;
            case 'land':
                if (event.kind === 'drop' && player) show({ title: t('banner.drop'), text: t('banner.dropText', { name: player.name }), color: 'var(--px-green)' }, 1700);
                break;
            case 'star':
                if (event.bought && player) show({ title: t('banner.bought', { name: player.name }), kicker: t('banner.starMoved'), color: 'var(--px-yellow)', low: true }, 2600);
                break;
            case 'minigame':
                show({ title: t('banner.minigame'), text: t(`minigame.${event.id}.name`), color: 'var(--px-pink)' }, 1600);
                break;
            default:
        }
    }, [show, t, myId]);

    // Musique du plateau : pendant les tours, coupée pendant les mini-jeux
    useEffect(() => {
        if (state.phase === 'minigame' || !musicOn) stopMusic();
        else startMusic();
    }, [state.phase, musicOn]);
    useEffect(() => {
        setMusicFinale(Boolean(state.finale));
    }, [state.finale]);
    useEffect(() => () => stopMusic(), []);

    const toggleMusic = () => {
        unlockAudio();
        const next = !musicOn;
        setMusicOn(next);
        setMusicOnState(next);
    };

    // Clavier : Espace pour lancer le dé, flèches au carrefour, M pour la carte
    useEffect(() => {
        const onKey = (event) => {
            const tag = event.target && event.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            const s = stateRef.current;
            const cur = s.players.find((p) => p.id === s.currentPlayerId);
            const mine = cur && cur.id === myId;
            if (event.code === 'Space' && !event.repeat && tag !== 'BUTTON') {
                const orderRoll = s.phase === 'order' && s.step === 'roll' && s.orderRolls[myId] == null;
                if ((mine && s.step === 'roll') || orderRoll) {
                    event.preventDefault();
                    unlockAudio();
                    actions.roll();
                }
            }
            if (event.key === 'm' || event.key === 'M') setMapMode((m) => !m);
            if (mine && s.step === 'choice' && event.key.startsWith('Arrow')) {
                const dir = event.key.replace('Arrow', '').toLowerCase();
                const option = choiceDirections(s).find((o) => o.dir === dir && o.affordable);
                if (option) {
                    event.preventDefault();
                    actions.choose(option.spaceId);
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [actions, myId]);

    if (state.phase === 'minigame') {
        return (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
                <Hud state={state} myId={myId} t={t} compact inline />
                <MinigameStage state={state} myId={myId} t={t} clockOffset={clockOffset} onReady={actions.ready} onSubmit={actions.submit} />
            </div>
        );
    }

    return (
        <div className={`party-screen ${myTurn ? 'is-my-turn' : ''}`} onPointerDown={unlockAudio}>
            <PartyBoard state={state} queue={queue} myId={myId} mapMode={mapMode} onEvent={onEvent} onChoose={actions.choose} />
            <div className="party-screen-top">
                <span className="party-font party-chip">
                    {state.turn > 0 ? t('board.turn', { turn: state.turn, total: state.settings.turns }) : t('board.orderTitle')}
                </span>
                {state.finale && <span className="party-font party-chip party-blink !bg-[color:var(--px-red)] !text-white">{t('board.finale')} ×2</span>}
                {mapMode && <span className="party-font party-chip !bg-[color:var(--px-blue)] !text-white">{t('screen.mapBadge')}</span>}
            </div>
            <Hud state={state} myId={myId} t={t} compact={compact} />
            <Banner banner={banner} />
            <Dock
                state={state}
                myId={myId}
                t={t}
                secondsLeft={secondsLeft}
                actions={actions}
                message={message}
                mapMode={mapMode}
                onToggleMap={() => setMapMode((m) => !m)}
                musicOn={musicOn}
                onToggleMusic={toggleMusic}
            />
        </div>
    );
}
