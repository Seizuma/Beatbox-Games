import React, { useCallback, useEffect, useRef, useState } from 'react';
import PartyBoard, { choiceDirections } from './board/PartyBoard';
import MinigameStage from './minigames/MinigameStage';
import { PLAYER_COLORS } from './characters/pixelRig';
import Icon from '../icons/Icon';
import { Key, Lcd, LcdText, LoopPad, Panel, PlayerRing } from './ui/Hardware';
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

// Pièce de Hype et Micro d'or : les mêmes objets que sur le plateau, en pixel art
export function CoinIcon({ size = 14 }) {
    return (
        <svg viewBox="0 0 6 6" width={size} height={size} className="party-pixel shrink-0" shapeRendering="crispEdges" aria-hidden="true">
            <path d="M1 0h4v1H1zM0 1h1v4H0zM5 1h1v4H5zM1 5h4v1H1z" fill="#120E26" />
            <path d="M1 1h4v4H1z" fill="#FFC72C" />
            <path d="M1 1h3v1H1zM1 2h1v2H1z" fill="#FFE07A" />
            <path d="M2 2h1v1H2z" fill="#FFFFFF" />
            <path d="M4 3h1v2H4zM2 4h2v1H2z" fill="#C98A00" />
        </svg>
    );
}

export function MicIcon({ size = 14 }) {
    return (
        <svg viewBox="0 0 6 9" width={size * 0.67} height={size} className="party-pixel shrink-0" shapeRendering="crispEdges" aria-hidden="true">
            <path d="M1 0h4v1H1zM0 1h1v3H0zM5 1h1v3H5zM1 4h4v1H1zM2 5h2v4H2z" fill="#120E26" />
            <path d="M1 1h4v3H1z" fill="#FFC72C" />
            <path d="M1 1h2v1H1zM1 2h1v1H1z" fill="#FFF4C7" />
            <path d="M4 2h1v2H4z" fill="#C98A00" />
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
    const offline = !player.isBot && !player.connected;
    return (
        <div className={`hw-strip ${active ? 'is-active' : ''} ${compact ? 'is-compact' : ''}`}>
            <PlayerRing player={player} color={color} size={compact ? 46 : 54} active={active} pose={active ? 'beatbox' : 'idle'} dim={offline} className={compact ? 'self-center' : ''} />
            <div className="min-w-0 flex-1">
                <div className={`flex items-center gap-1.5 ${compact ? 'justify-center' : ''}`}>
                    <span className="hw-strip-rank">{t(`screen.rank.${rank}`)}</span>
                    {!compact && <span className="hw-strip-name">{player.name}</span>}
                    {isMe && !compact && <span className="hw-label !text-[0.62rem] !text-[color:var(--hw-amber)]">{t('lobby.you')}</span>}
                </div>
                {compact && <p className="hw-strip-name !text-[0.78rem]">{player.name}</p>}
                <Lcd className="hw-strip-lcd">
                    <span className={`flex items-center gap-1 ${starFlash === 'up' ? 'hw-bump' : ''}`}>
                        <MicIcon size={compact ? 11 : 13} />
                        <LcdText text={stars} font="bold" scale={compact ? 1 : 2} label={`${stars} ${t('board.stars')}`} />
                    </span>
                    <span className={`flex items-center gap-1 ${hypeFlash ? 'hw-bump' : ''}`}>
                        <CoinIcon size={compact ? 10 : 12} />
                        <LcdText text={hype} font="bold" scale={compact ? 1 : 2} label={`${hype} ${t('board.hype')}`} color={hypeFlash === 'down' ? '#e2402f' : undefined} />
                    </span>
                    {orderRoll != null && <LcdText text={`D${orderRoll}`} scale={compact ? 2 : 2} color="#F0AE22" />}
                </Lcd>
                {offline && <p className="hw-label mt-0.5 !text-[0.62rem] !text-[color:var(--hw-red)]">{t('lobby.offline')}</p>}
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

function Banner({ banner, compact }) {
    if (!banner) return null;
    const color = banner.color || '#F0AE22';
    return (
        <div className={`party-banner-layer ${banner.low ? 'is-low' : ''}`} aria-live="assertive">
            <Panel key={banner.id} as="div" className="hw-banner" style={{ '--bc': color }}>
                {banner.player ? (
                    <PlayerRing player={banner.player} color={color} size={compact ? 64 : 96} active pose="present" />
                ) : <span className="hw-banner-accent" aria-hidden="true" />}
                <div className="min-w-0">
                    {banner.kicker && <Lcd className="mb-2 inline-flex px-2 py-1"><LcdText text={banner.kicker} scale={2} /></Lcd>}
                    <p className="hw-banner-title">{banner.title}</p>
                    {banner.text && <p className="hw-text mt-1.5 text-base font-semibold sm:text-lg">{banner.text}</p>}
                    {banner.list && (
                        <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                            {banner.list.map((item, i) => (
                                <li key={item.id} className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} aria-hidden="true" />
                                    <span className="hw-strip-name !text-lg">{i + 1}. {item.name}</span>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </Panel>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Boîte de dialogue (en bas)
// ---------------------------------------------------------------------------

const DIR_ICON = { left: 'arrow-left', right: 'arrow-right', up: 'arrow-up', down: 'arrow-down' };

function Dock({ state, myId, t, secondsLeft, actions, message, mapMode, onToggleMap, musicOn, onToggleMusic }) {
    const current = state.players.find((p) => p.id === state.currentPlayerId);
    const mine = current && current.id === myId;
    const name = current ? current.name : '';

    let text = message;
    let controls = null;
    if (state.phase === 'order') {
        const rolled = state.orderRolls[myId] != null;
        if (state.step === 'roll' && !rolled) {
            text = t('board.orderRoll');
            controls = <LoopPad color="amber" onClick={() => actions.roll()} hint={t('screen.rollHint')}>{t('board.roll')}</LoopPad>;
        } else if (state.step === 'roll') text = t('board.orderWaiting');
    } else if (mine && state.step === 'roll') {
        // Le pad REC/PLAY est le dé de base ; bloc-boucle et vinyle sont des dés spéciaux payants
        const me = state.players.find((p) => p.id === myId);
        const cost = state.dice || { block: 8, vinyl: 5 };
        text = t('board.yourTurn');
        controls = (
            <div className="flex flex-wrap items-center justify-center gap-3">
                <LoopPad color="amber" onClick={() => actions.roll('pad')} hint={t('screen.rollHint')}>{t('board.dicePad')}</LoopPad>
                <div className="flex flex-col gap-2">
                    {[['block', 'diceBlock', 'diceBlockInfo', 'green'], ['vinyl', 'diceVinyl', 'diceVinylInfo', 'red']].map(([die, label, info, led]) => (
                        <Key key={die} size="md" led={led} ledOn={me && me.hype >= cost[die]} disabled={!me || me.hype < cost[die]} className="!justify-start !py-1.5 text-left" onClick={() => actions.roll(die)}>
                            <span className="flex flex-col gap-0.5">
                                <span>{t(`board.${label}`)}</span>
                                <span className="font-sans text-[0.7rem] font-medium normal-case tracking-normal text-[color:var(--hw-silk-dim)]">{t(`board.${info}`, { n: cost[die] })}</span>
                            </span>
                        </Key>
                    ))}
                </div>
            </div>
        );
    } else if (mine && state.step === 'scratch') {
        text = t('board.scratchTitle');
        controls = <LoopPad color="red" spinning onClick={() => actions.roll()} hint={t('screen.rollHint')}>{t('board.scratch')}</LoopPad>;
    } else if (mine && state.step === 'choice' && state.choice) {
        text = t('board.choiceTitle');
        controls = (
            <div className="grid w-full gap-2 sm:grid-cols-2">
                {choiceDirections(state).map((o) => (
                    <Key key={o.spaceId} size="md" led={o.gate ? 'red' : 'green'} ledOn={o.affordable} className="!justify-start !py-2 text-left" disabled={!o.affordable} onClick={() => actions.choose(o.spaceId)}>
                        <span className="flex items-center gap-2">
                            <Icon name={DIR_ICON[o.dir]} size={20} />
                            <span className="flex flex-col gap-0.5">
                                <span>{o.gate ? t('board.choiceGate') : t('board.choiceMain')}</span>
                                <span className="font-sans text-[0.72rem] font-medium normal-case tracking-normal text-[color:var(--hw-silk-dim)]">
                                    {o.gate ? t('board.choiceGateInfo', { n: o.gate }) : t('board.choiceMainInfo')}
                                    {!o.affordable && ` · ${t('board.notEnough')}`}
                                </span>
                            </span>
                        </span>
                    </Key>
                ))}
            </div>
        );
    } else if (mine && state.step === 'star' && state.starOffer && state.starOffer.affordable) {
        text = t('board.starAsk', { price: state.starOffer.price });
        controls = (
            <div className="flex items-center gap-3">
                <LoopPad color="green" size="md" onClick={() => actions.star(true)}>{t('board.buy')}</LoopPad>
                <Key size="md" led="red" onClick={() => actions.star(false)}>{t('board.skip')}</Key>
            </div>
        );
    } else {
        if (state.step === 'roll' && current) text = t('board.rolling', { name });
        if (state.step === 'scratch' && current) text = t('board.scratching', { name });
        if (state.step === 'choice' && current) text = t('board.waitingChoice', { name });
        if (state.step === 'star' && state.starOffer) {
            text = state.starOffer.affordable ? t('board.waitingStar', { name }) : (mine ? t('board.starNoMoney', { price: state.starOffer.price }) : t('events.noMoney', { name }));
        }
        if ((state.step === 'rolled' || state.step === 'moving') && state.roll && current) text = t(state.roll.value === 1 ? 'board.movingOne' : 'board.moving', { name, n: state.roll.value });
        if (!text && current) text = mine ? t('board.yourTurn') : t('board.turnOf', { name });
    }

    const myDecision = mine && ['roll', 'scratch', 'choice', 'star'].includes(state.step);
    const duration = { roll: 30, scratch: 8, choice: 15, star: 15 }[state.step] || 30;
    const cells = 20;
    const lit = secondsLeft != null ? Math.ceil((Math.min(duration, secondsLeft) / duration) * cells) : 0;
    const choice = mine && state.step === 'choice';
    return (
        <Panel as="div" className="party-dock">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                {controls && (
                    <div className={`order-3 col-span-2 flex justify-center ${choice ? 'sm:col-span-3' : 'sm:order-none sm:col-span-1'}`}>{controls}</div>
                )}
                <div className={`min-w-0 ${controls && !choice ? '' : 'sm:col-span-2'}`}>
                    <Lcd className="party-dock-lcd">
                        <p className={`hw-lcd-text text-base sm:text-lg ${state.step === 'roll' && !mine ? 'hw-blink' : ''}`}>{text || ' '}</p>
                    </Lcd>
                    {myDecision && secondsLeft != null && (
                        <div className={`party-dock-timer ${secondsLeft < 5 ? 'is-late' : ''}`} aria-hidden="true">
                            {Array.from({ length: cells }, (_, i) => <span key={i} className={i < lit ? 'is-on' : ''} />)}
                        </div>
                    )}
                    {choice && <p className="hw-label mt-2 !text-[0.66rem]">{t('screen.choiceHint')}</p>}
                </div>
                <div className="flex shrink-0 gap-1.5 sm:flex-col">
                    <Key size="sm" className="hw-key-icon" onClick={onToggleMap} aria-pressed={mapMode} aria-label={mapMode ? t('screen.mapBack') : t('screen.map')} title={mapMode ? t('screen.mapBack') : t('screen.map')}>
                        <Icon name={mapMode ? 'close' : 'map'} size={18} />
                    </Key>
                    <Key size="sm" className="hw-key-icon" onClick={onToggleMusic} aria-label={musicOn ? t('screen.musicOn') : t('screen.musicOff')} title={musicOn ? t('screen.musicOn') : t('screen.musicOff')}>
                        <Icon name={musicOn ? 'volume' : 'volume-off'} size={18} />
                    </Key>
                </div>
            </div>
        </Panel>
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
    const screenRef = useRef(null);
    const [insets, setInsets] = useState(null);
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
                    player,
                }, 2100);
                jingle(player.characterId);
                if (player.id === myId && navigator.vibrate) navigator.vibrate([30, 40, 30]);
                setMapMode(false);
                break;
            }
            case 'finale':
                show({ title: t('banner.finale'), text: t('banner.finaleText'), color: '#E2402F' }, 2800);
                setMusicFinale(true);
                break;
            case 'land':
                if (event.kind === 'drop' && player) show({ title: t('banner.drop'), text: t('banner.dropText', { name: player.name }), color: '#2EB75E' }, 1700);
                break;
            case 'star':
                if (event.bought && player) show({ title: t('banner.bought', { name: player.name }), kicker: t('banner.starMoved'), color: '#F0AE22', low: true }, 2600);
                break;
            case 'minigame':
                show({ title: t('banner.minigame'), text: t(`minigame.${event.id}.name`), color: '#3F7EEA' }, 1600);
                break;
            default:
        }
    }, [show, t, myId]);

    // Place prise par la console (en bas) et la rangée de joueurs (en haut, sur téléphone)
    useEffect(() => {
        const root = screenRef.current;
        if (!root || typeof ResizeObserver === 'undefined') return undefined;
        const measure = () => {
            const box = root.getBoundingClientRect();
            const dock = root.querySelector('.party-dock');
            const row = root.querySelector('.party-hud-row');
            const bottom = dock ? box.bottom - dock.getBoundingClientRect().top : 0;
            const top = row ? row.getBoundingClientRect().bottom - box.top : 0;
            setInsets((prev) => (prev && Math.abs(prev.top - top) < 4 && Math.abs(prev.bottom - bottom) < 4 ? prev : { top, bottom }));
        };
        const observer = new ResizeObserver(measure);
        observer.observe(root);
        root.querySelectorAll('.party-dock, .party-hud-row').forEach((el) => observer.observe(el));
        measure();
        return () => observer.disconnect();
    }, [state.phase, compact, state.step]);

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
                if ((mine && (s.step === 'roll' || s.step === 'scratch')) || orderRoll) {
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
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-4 sm:px-6">
                <Hud state={state} myId={myId} t={t} compact inline />
                <MinigameStage state={state} myId={myId} t={t} clockOffset={clockOffset} onReady={actions.ready} onSubmit={actions.submit} />
            </div>
        );
    }

    return (
        <div ref={screenRef} className={`party-screen ${myTurn ? 'is-my-turn' : ''}`} onPointerDown={unlockAudio}>
            <PartyBoard state={state} queue={queue} myId={myId} mapMode={mapMode} onEvent={onEvent} onChoose={actions.choose} insets={insets} clockOffset={clockOffset} />
            <div className="party-screen-top">
                <span className="hw-chip">
                    <LcdText text={state.turn > 0 ? t('board.turn', { turn: state.turn, total: state.settings.turns }) : t('board.orderTitle')} scale={2} />
                </span>
                {state.finale && <span className="hw-chip"><span className="hw-led is-on hw-blink" style={{ '--led': '#E2402F' }} /><LcdText text={`${t('board.finale')} x2`} scale={2} color="#E2402F" /></span>}
                {mapMode && <span className="hw-chip"><LcdText text={t('screen.mapBadge')} scale={2} color="#F0AE22" /></span>}
            </div>
            <Hud state={state} myId={myId} t={t} compact={compact} />
            <Banner banner={banner} compact={compact} />
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
