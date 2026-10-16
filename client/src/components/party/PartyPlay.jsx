import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import PartyBoard, { choiceDirections } from './board/PartyBoard';
import MinigameStage from './minigames/MinigameStage';
import PixelCharacter from './PixelCharacter';
import { PLAYER_COLORS } from './characters/pixelRig';
import { Key, LcdText, LoopPad, PlayerRing } from './ui/Hardware';
import { DialogBox, MenuList } from './ui/Pixel';
import { getPalette, setPalette } from './board/world';
import { isMusicOn, jingle, setMusicFinale, setMusicOn, sfx, startMusic, stopMusic, unlockAudio } from './partySfx';
import { CoinIcon, ItemIcon, MicIcon } from './PartyIcons';
import EventPanels, { dialogOpen, useEventKeys } from './EventPanels';

// L'écran de jeu, dans la famille « Pixel arcade » (planches 06-B à 14-B) :
// - le plateau occupe tout l'écran, avec sa caméra ;
// - en haut, le HUD en bandeau : une carte par joueur (le premier dans un cadre doré) ;
// - des rubans annoncent chaque moment (tour d'un joueur, Rappel, mini-jeu…) ;
// - les personnages du plateau (ingé son, voleur de flow, stand de merch) parlent dans une
//   boîte de dialogue RPG, avec un menu à curseur pour répondre ;
// - en bas, seulement l'action du moment (TAPE !, le sac, la carte) : plus de console.

// Texte de l'événement le plus récent, en une ligne pour ceux qui regardent
export function describeEvent(event, players, t) {
    if (!event) return '';
    const name = (id) => (players.find((p) => p.id === id) || {}).name || '?';
    switch (event.type) {
        case 'started': return t('events.started');
        case 'orderRoll': return t('events.orderRoll', { name: name(event.playerId), n: event.value });
        case 'order': return t('events.order', { name: name(event.order[0]) });
        case 'roll': return t('events.roll', { name: name(event.playerId), n: event.value });
        case 'land':
            if (event.trap) return t('events2.trapped', { name: name(event.playerId), owner: name(event.trap.owner), n: event.trap.amount });
            if (event.kind === 'drop') return t('events.drop', { name: name(event.playerId) });
            if (event.kind === 'red') return t('events.red', { name: name(event.playerId), n: Math.abs(event.delta) });
            return t(`events.${event.kind}`, { name: name(event.playerId), n: event.delta });
        case 'chose': return event.paid ? t('events.gate', { name: name(event.playerId), n: event.paid }) : '';
        case 'wheel': return t('events.wheel', { name: name(event.playerId), effect: t(`board.finaleEffect.${event.result}`) });
        case 'duel': return t('events2.duelLine', { name: name(event.playerId), other: name(event.targetId), n: event.stake });
        case 'useItem': return t('events2.useItem', { name: name(event.playerId), item: t(`items.${event.item}.name`) });
        case 'buy': return t('events2.bought', { name: name(event.playerId), item: t(`items.${event.item}.name`) });
        case 'freestyleResult': return t(`events2.giftDone.${event.gift}`, { a: name(event.giver), b: name(event.taker), n: event.amount });
        case 'steal': return event.kind === 'mic' ? t('events2.stoleMic', { name: name(event.playerId), victim: name(event.victimId) }) : t('events2.stoleHype', { name: name(event.playerId), victim: name(event.victimId), n: event.amount });
        case 'star':
            return event.bought ? t('events.bought', { name: name(event.playerId) }) : t('events.declined', { name: name(event.playerId) });
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

// Ce qui se passe en ce moment, en une ligne (les rubans et le plateau montrent le reste)
function statusText(state, myId, t) {
    const current = state.players.find((p) => p.id === state.currentPlayerId);
    const name = current ? current.name : '';
    const mine = current && current.id === myId;
    const nameOf = (id) => (state.players.find((p) => p.id === id) || {}).name || '';
    switch (state.step) {
        case 'roll':
            if (state.phase === 'order') return state.orderRolls[myId] != null ? t('board.orderWaiting') : '';
            return mine ? '' : t('board.rolling', { name });
        case 'scratch': return mine ? '' : t('board.scratching', { name });
        case 'rolled':
        case 'moving':
            return state.roll && current ? t(state.roll.value === 1 ? 'board.movingOne' : 'board.moving', { name, n: state.roll.value }) : '';
        case 'choice': return mine ? t('board.choiceTitle') : t('board.waitingChoice', { name });
        case 'star':
            if (!state.starOffer || state.starOffer.playerId === myId) return '';
            return state.starOffer.affordable ? t('board.waitingStar', { name }) : t('events.noMoney', { name });
        case 'wheel': return state.wheel && state.wheel.playerId !== myId ? t('board.wheelWaiting', { name: nameOf(state.wheel.playerId) }) : '';
        default: return '';
    }
}

// Compteur qui défile jusqu'à sa nouvelle valeur (comme les pièces de Mario Party)
function useRollingNumber(value, sound = false) {
    const [shown, setShown] = useState(value);
    const [flash, setFlash] = useState(null);
    const fromRef = useRef(value);
    useEffect(() => {
        const from = fromRef.current;
        if (from === value) return undefined;
        const start = performance.now() + 450;
        const duration = Math.min(900, 120 + Math.abs(value - from) * 70);
        let raf = 0;
        let last = from;
        // Les pièces arrivent d'abord sur le panneau, puis le compteur défile
        const step = (now) => {
            const k = Math.max(0, Math.min(1, (now - start) / duration));
            const v = Math.round(from + (value - from) * k);
            if (v !== last) {
                if (last === from) setFlash(value > from ? 'up' : 'down');
                if (sound && value > from) sfx('tick');
                last = v;
                setShown(v);
            }
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
            setShown(value);
        };
    }, [value, sound]);
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

// ---------------------------------------------------------------------------
// HUD en bandeau (09-B)
// ---------------------------------------------------------------------------

// Couleur de la dernière case (comme les panneaux de Mario Party) : elle annonce les équipes du mini-jeu
const LAST_COLORS = { blue: '#3F7EEA', red: '#E2402F', green: '#2EB75E' };

function PlayerCard({ player, rank, leader, active, isMe, t, compact, orderRoll }) {
    const [hype, hypeFlash] = useRollingNumber(player.hype, isMe);
    const [stars, starFlash] = useRollingNumber(player.stars);
    const color = PLAYER_COLORS[player.seat];
    const offline = !player.isBot && !player.connected;
    const label = `${t(`screen.rank.${rank}`)} · ${player.name} · ${player.stars} ${t('board.stars')} · ${player.hype} ${t('board.hype')}`;
    return (
        <div data-card={player.id} className={`party-card ${leader ? 'is-first' : ''} ${active ? 'is-active' : ''} ${compact ? 'is-compact' : ''}`} role="group" aria-label={label}>
            <PlayerRing player={player} color={color} size={compact ? 38 : 48} active={active} pose={active ? 'beatbox' : 'idle'} dim={offline} />
            <div className="min-w-0 flex-1" aria-hidden="true">
                <p className="party-card-name">
                    <span className="party-card-rank">{t(`screen.rank.${rank}`)}</span>
                    {player.name}
                    {isMe && !compact && <span className="party-card-me">{t('lobby.you')}</span>}
                </p>
                <p className="party-card-stats">
                    <span className={`party-card-stat ${starFlash === 'up' ? 'hw-bump' : ''}`}><MicIcon size={compact ? 10 : 13} />{stars}</span>
                    <span className={`party-card-stat ${hypeFlash ? 'hw-bump' : ''} ${hypeFlash === 'down' ? 'is-down' : ''}`}><CoinIcon size={compact ? 9 : 12} />{hype}</span>
                    {orderRoll != null && <span className="party-card-stat is-gold">D{orderRoll}</span>}
                </p>
                {!compact && (player.lastColor || (player.items && player.items.length > 0) || offline) && (
                    <p className="party-card-tags">
                        {player.lastColor && <span className="party-lastcolor" style={{ '--lc': LAST_COLORS[player.lastColor] }} title={t(`screen.lastColor.${player.lastColor}`)} />}
                        {(player.items || []).map((it, i) => <ItemIcon key={i} item={it} size={14} />)}
                        {offline && <span className="party-card-offline">{t('lobby.offline')}</span>}
                    </p>
                )}
            </div>
        </div>
    );
}

function Hud({ state, myId, t, compact, inline }) {
    const ranks = computeRanks(state.players);
    // Le cadre doré du premier n'a de sens que s'il est seul en tête
    const leaders = Object.values(ranks).filter((r) => r === 1).length;
    const ordered = state.order && state.order.length
        ? state.order.map((id) => state.players.find((p) => p.id === id)).filter(Boolean)
        : [...state.players].sort((a, b) => a.seat - b.seat);
    return (
        <div className={`party-hud ${inline ? 'is-inline' : ''}`}>
            {ordered.map((p) => (
                <PlayerCard
                    key={p.id}
                    player={p}
                    rank={ranks[p.id]}
                    leader={ranks[p.id] === 1 && leaders < state.players.length}
                    active={state.currentPlayerId === p.id && state.phase === 'turn'}
                    isMe={p.id === myId}
                    t={t}
                    compact={compact}
                    orderRoll={state.phase === 'order' ? state.orderRolls[p.id] : null}
                />
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Rubans d'annonce (10-B)
// ---------------------------------------------------------------------------

function Ribbon({ banner, compact }) {
    if (!banner) return null;
    return (
        <div className={`party-banner-layer ${banner.low ? 'is-low' : ''}`} aria-live="assertive">
            <div key={banner.id} className="party-ribbon" style={{ '--bc': banner.color || '#ffd23a' }}>
                {banner.player && (
                    <span className="party-ribbon-portrait" style={{ background: PLAYER_COLORS[banner.player.seat] }} aria-hidden="true">
                        <PixelCharacter id={banner.player.characterId} pose="present" color={PLAYER_COLORS[banner.player.seat]} crop="body" scale={compact ? 1 : 2} />
                    </span>
                )}
                <div className="min-w-0">
                    {banner.kicker && <p className="party-ribbon-kicker">{banner.kicker}</p>}
                    <p className="party-ribbon-title">{banner.title}</p>
                    {banner.text && <p className="party-ribbon-text">{banner.text}</p>}
                    {banner.list && (
                        <ol className="party-ribbon-list">
                            {banner.list.map((item, i) => (
                                <li key={item.id} className="party-ribbon-text flex items-center gap-2">
                                    <span className="party-ribbon-dot" style={{ background: item.color }} aria-hidden="true" />
                                    {i + 1}. {item.name}
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
                {banner.side && (
                    <div className="party-ribbon-side">
                        <p className="party-ribbon-kicker">{banner.side.kicker}</p>
                        <p className="party-ribbon-count">{banner.side.value}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Roue du Rappel : tournée par le dernier, à 3 tours de la fin
// ---------------------------------------------------------------------------

const WHEEL_COLORS = { double: '#ffd23a', halfStar: '#ff6a55', extraBonus: '#6fb0ff', redCut: '#c9c9d4', freestyle: '#3fe08a' };

function FinaleWheel({ state, t, clockOffset }) {
    const wheel = state.wheel;
    const rotorRef = useRef(null);
    const spinAt = wheel && wheel.spinAt;
    const index = wheel && wheel.index;
    const period = wheel && wheel.period;
    useEffect(() => {
        if (!wheel) return undefined;
        const n = wheel.slots.length;
        const step = 360 / n;
        let raf = 0;
        const loop = () => {
            let pos = 0.5;
            if (index != null) pos = index + 0.5;
            else if (spinAt) pos = (Date.now() + clockOffset - spinAt) / period;
            if (rotorRef.current) rotorRef.current.setAttribute('transform', `rotate(${(-pos * step).toFixed(2)})`);
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
        // La roue est décrite par ses valeurs
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spinAt, index, period, clockOffset]);
    if (!wheel || !['wheel', 'wheelResult'].includes(state.step)) return null;
    const n = wheel.slots.length;
    const step = (Math.PI * 2) / n;
    const spinner = state.players.find((p) => p.id === wheel.playerId);
    const arc = (i) => {
        const a0 = i * step - Math.PI / 2;
        const a1 = (i + 1) * step - Math.PI / 2;
        return `M0 0 L${Math.cos(a0) * 100} ${Math.sin(a0) * 100} A100 100 0 0 1 ${Math.cos(a1) * 100} ${Math.sin(a1) * 100} Z`;
    };
    const done = state.step === 'wheelResult' && wheel.result;
    return (
        <div className="party-wheel-layer" aria-live="polite">
            <div className={`party-wheel ${done ? 'is-done' : ''}`}>
                <p className="hw-title party-wheel-title">{t('banner.finale')}</p>
                {spinner && <p className="hw-label">{spinner.name}</p>}
                <svg viewBox="-112 -118 224 232" className="party-wheel-svg" role="img" aria-label={wheel.result ? t(`board.finaleEffect.${wheel.result}`) : t('banner.finale')}>
                    <circle r="108" fill="#0b0a14" />
                    <g ref={rotorRef}>
                        {wheel.slots.map((slot, i) => {
                            const mid = (i + 0.5) * step - Math.PI / 2;
                            const win = done && i === wheel.index;
                            return (
                                <g key={i}>
                                    <path d={arc(i)} fill={win ? '#ffffff' : WHEEL_COLORS[slot] || '#555'} stroke="#0b0a14" strokeWidth="3" />
                                    <text
                                        x={Math.cos(mid) * 62}
                                        y={Math.sin(mid) * 62}
                                        transform={`rotate(${(mid * 180) / Math.PI} ${Math.cos(mid) * 62} ${Math.sin(mid) * 62})`}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        className="party-wheel-label"
                                        fill="#0b0a14"
                                    >
                                        {t(`board.wheelSlot.${slot}`)}
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                    <circle r="20" fill="#241c48" stroke="#f4f0e6" strokeWidth="4" />
                    <path d="M-11 -118 L11 -118 L0 -96 Z" fill="#ffd23a" stroke="#0b0a14" strokeWidth="3" />
                </svg>
                {done && (
                    <>
                        <p className="hw-title hw-pop party-wheel-result">{t(`banner.wheel.${wheel.result}`)}</p>
                        <p className="hw-text text-center">{t(`banner.wheelText.${wheel.result}`, { price: state.starPrice })}</p>
                    </>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Au moment du dé (07-B) : TAPE !, le sac, la carte
// ---------------------------------------------------------------------------

function RollMenu({ state, myId, t, actions, bagOpen, setBagOpen, onMap }) {
    const me = state.players.find((p) => p.id === myId);
    const bag = (me && me.items) || [];
    const size = state.bagSize || 3;
    const canUse = (item) => !state.itemUsed && (item !== 'mic' || (me && me.hype >= state.starPrice));
    return (
        <div className="party-actions-row">
            <LoopPad color="amber" onClick={() => { setBagOpen(false); actions.roll(); }} hint={t('screen.rollHint')}>{t('screen.tap')}</LoopPad>
            {bagOpen && bag.length > 0 ? (
                <MenuList
                    className="party-bag-menu"
                    title={t('board.bag')}
                    items={[
                        ...bag.map((item, i) => ({
                            id: `${item}${i}`,
                            icon: <ItemIcon item={item} size={22} />,
                            label: t(`items.${item}.name`),
                            info: t(`items.${item}.info`),
                            disabled: !canUse(item),
                            onSelect: () => { setBagOpen(false); actions.item(item); },
                        })),
                        { id: 'back', label: t('screen.back'), onSelect: () => setBagOpen(false) },
                    ]}
                />
            ) : (
                <MenuList
                    keyboard={false}
                    label={t('board.bag')}
                    items={[
                        {
                            id: 'bag',
                            label: t('board.bag'),
                            icon: (
                                <span className="flex gap-0.5" aria-hidden="true">
                                    {Array.from({ length: size }, (_, i) => (bag[i] ? <ItemIcon key={i} item={bag[i]} size={16} /> : <span key={i} className="party-bag-empty" />))}
                                </span>
                            ),
                            disabled: !bag.length || state.itemUsed,
                            onSelect: () => setBagOpen(true),
                        },
                        { id: 'map', label: t('screen.map'), onSelect: onMap },
                    ]}
                />
            )}
        </div>
    );
}

// Invites de touches (ordinateur ; cachées sur écran tactile)
function Prompts({ items }) {
    return (
        <p className="px-prompts" aria-hidden="true">
            {items.map(([key, label]) => <span key={key}><span className="px-kbd">{key}</span>{label}</span>)}
        </p>
    );
}

function ActionBar({ state, myId, t, secondsLeft, actions, bagOpen, setBagOpen, onMap }) {
    const current = state.players.find((p) => p.id === state.currentPlayerId);
    const mine = current && current.id === myId;
    let main = null;
    let prompts = null;
    if (state.phase === 'order' && state.step === 'roll' && state.orderRolls[myId] == null) {
        main = <LoopPad color="amber" onClick={() => actions.roll()} hint={t('screen.rollHint')}>{t('screen.tap')}</LoopPad>;
        prompts = [[t('screen.keySpace'), t('board.orderRoll')]];
    } else if (state.step === 'wheel' && state.wheel && state.wheel.playerId === myId) {
        main = <LoopPad color="red" onClick={() => actions.wheel()} hint={t('screen.rollHint')}>{t('board.wheelStop')}</LoopPad>;
        prompts = [[t('screen.keySpace'), t('board.wheelTitle')]];
    } else if (mine && state.step === 'roll') {
        main = <RollMenu state={state} myId={myId} t={t} actions={actions} bagOpen={bagOpen} setBagOpen={setBagOpen} onMap={onMap} />;
        prompts = bagOpen
            ? [['▲ ▼', t('screen.choose')], [t('screen.keyEnter'), t('screen.use')]]
            : [[t('screen.keySpace'), t('board.roll')], ['S', t('board.bag')], ['M', t('screen.map')], [t('screen.keyEsc'), t('screen.pause')]];
    } else if (mine && state.step === 'scratch') {
        main = <LoopPad color="red" onClick={() => actions.roll()} hint={t('screen.rollHint')}>{t('board.scratch')}</LoopPad>;
        prompts = [[t('screen.keySpace'), t('board.scratchTitle')]];
    } else if (mine && state.step === 'choice') {
        prompts = [['◀ ▶ ▲ ▼', t('screen.chooseRoute')], ['M', t('screen.map')]];
    }
    const decision = (mine && ['roll', 'scratch', 'choice'].includes(state.step)) || (state.step === 'wheel' && state.wheel && state.wheel.playerId === myId);
    const late = decision && secondsLeft != null && secondsLeft <= 10;
    const status = main ? '' : statusText(state, myId, t) || describeEvent(state.event, state.players, t);
    return (
        <div className="party-actions">
            {status && <p className="party-status" aria-live="polite">{status}</p>}
            {(main || late) && (
                <div className="party-actions-row">
                    {late && <span className={`party-timer ${secondsLeft < 5 ? 'is-late' : ''}`} role="timer" aria-label={t('board.secondsLeft', { n: Math.ceil(secondsLeft) })}>{Math.ceil(secondsLeft)}</span>}
                    {main}
                </div>
            )}
            {prompts && <Prompts items={prompts} />}
        </div>
    );
}

// ---------------------------------------------------------------------------
// L'ingé son au Micro d'or (08-B)
// ---------------------------------------------------------------------------

function StarDialog({ state, myId, t, actions }) {
    if (state.step === 'starIntro') {
        return <DialogBox key="intro" speaker="inge" name={t('npc.inge')} text={t('npc.starIntro', { price: state.starPrice })} />;
    }
    const offer = state.starOffer;
    if (state.step !== 'star' || !offer || offer.playerId !== myId) return null;
    if (!offer.affordable) return <DialogBox key="poor" speaker="inge" name={t('npc.inge')} text={t('npc.starNoMoney', { price: offer.price })} />;
    return (
        <DialogBox
            key="offer"
            speaker="inge"
            name={t('npc.inge')}
            text={t('npc.starAsk', { price: offer.price })}
            choices={[
                { id: 'yes', label: t('board.buy'), price: <><CoinIcon size={14} />{offer.price}</>, onSelect: () => actions.star(true) },
                { id: 'no', label: t('board.skip'), onSelect: () => actions.star(false) },
            ]}
        />
    );
}

// ---------------------------------------------------------------------------
// Menu pause (07-B)
// ---------------------------------------------------------------------------

function PauseMenu({ t, onClose, mapMode, onMap, musicOn, onMusic }) {
    const [palette, setPaletteState] = useState(getPalette);
    const onOff = (on) => (on ? t('screen.on') : t('screen.off'));
    return (
        <div className="hw-modal-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <div role="dialog" aria-modal="true" aria-label={t('screen.pause')} className="hw-pop w-[min(24rem,100%)]">
                <MenuList
                    title={t('screen.pause')}
                    items={[
                        { id: 'resume', label: t('screen.resume'), onSelect: onClose },
                        { id: 'map', label: mapMode ? t('screen.mapBack') : t('screen.map'), onSelect: () => { onMap(); onClose(); } },
                        { id: 'music', label: t('screen.music'), price: onOff(musicOn), onSelect: onMusic },
                        {
                            id: 'palette',
                            label: t('screen.palette'),
                            info: t('screen.paletteInfo'),
                            price: onOff(palette === 'adapted'),
                            onSelect: () => {
                                const next = palette === 'adapted' ? 'standard' : 'adapted';
                                setPalette(next);
                                setPaletteState(next);
                            },
                        },
                        { id: 'quit', label: t('quit'), onSelect: () => { onClose(); window.dispatchEvent(new Event('party:quit')); } },
                    ]}
                />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Passage plateau ↔ mini-jeu (11-B) : l'iris s'ouvre dans un anneau de LED
// ---------------------------------------------------------------------------

function useIris(phase) {
    const [on, setOn] = useState(0);
    const prev = useRef(phase);
    useEffect(() => {
        const from = prev.current;
        prev.current = phase;
        const swap = (from === 'turn' && phase === 'minigame') || (from === 'minigame' && phase === 'turn');
        if (!swap) return undefined;
        setOn((n) => n + 1);
        if (phase === 'minigame') sfx('reveal');
        const timer = setTimeout(() => setOn(0), 950);
        return () => clearTimeout(timer);
    }, [phase]);
    return on;
}

function Iris({ id }) {
    return (
        <div key={id} className="party-iris" aria-hidden="true">
            <div className="party-iris-hole"><span className="party-iris-ring" /></div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Les gains se voient : les pièces filent du joueur, sur le plateau, vers son panneau
// ---------------------------------------------------------------------------

function useCoinFlights(state, rootRef, positionsRef, enabled) {
    const [coins, setCoins] = useState([]);
    const prev = useRef(null);
    const hypes = state.players.map((p) => `${p.id}:${p.hype}`).join(',');
    useEffect(() => {
        const before = prev.current;
        prev.current = Object.fromEntries(state.players.map((p) => [p.id, p.hype]));
        if (!before || !enabled || !rootRef.current) return undefined;
        const root = rootRef.current.getBoundingClientRect();
        const born = [];
        state.players.forEach((p) => {
            const delta = before[p.id] != null ? p.hype - before[p.id] : 0;
            const at = positionsRef.current[p.id];
            const ring = rootRef.current.querySelector(`[data-card="${p.id}"] .hw-ring`);
            if (!delta || !at || !ring) return;
            const box = ring.getBoundingClientRect();
            const card = { x: box.left - root.left + box.width / 2, y: box.top - root.top + box.height / 2 };
            const n = Math.min(8, Math.max(1, Math.round(Math.abs(delta) / 2)));
            for (let i = 0; i < n; i += 1) {
                const spread = { x: at.x + (i - n / 2) * 6, y: at.y };
                born.push({
                    id: `${p.id}-${Date.now()}-${i}`,
                    from: delta > 0 ? spread : card,
                    to: delta > 0 ? card : { x: at.x + (i - n / 2) * 10, y: at.y + 40 },
                    delay: i * 55,
                    loss: delta < 0,
                });
            }
        });
        if (!born.length) return undefined;
        setCoins((list) => [...list, ...born]);
        const ids = new Set(born.map((c) => c.id));
        const timer = setTimeout(() => setCoins((list) => list.filter((c) => !ids.has(c.id))), 1300);
        return () => clearTimeout(timer);
        // Une volée de pièces à chaque changement de Hype
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hypes]);
    return coins;
}

function Coin({ coin }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        el.style.transform = `translate(${coin.from.x}px, ${coin.from.y}px)`;
        const timer = setTimeout(() => {
            el.style.transform = `translate(${coin.to.x}px, ${coin.to.y}px)`;
            el.style.opacity = '0';
        }, 30 + coin.delay);
        return () => clearTimeout(timer);
    }, [coin]);
    return <span ref={ref} className={`party-coin ${coin.loss ? 'is-loss' : ''}`}><CoinIcon size={18} /></span>;
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
    const [bagOpen, setBagOpen] = useState(false);
    const [paused, setPaused] = useState(false);
    const [musicOn, setMusicOnState] = useState(isMusicOn());
    const bannerTimer = useRef(null);
    const screenRef = useRef(null);
    const positionsRef = useRef({});
    const [insets, setInsets] = useState(null);
    const stateRef = useRef(state);
    stateRef.current = state;
    const uiRef = useRef({ paused, bagOpen });
    uiRef.current = { paused, bagOpen };
    const iris = useIris(state.phase);
    const coins = useCoinFlights(state, screenRef, positionsRef, state.phase === 'turn' && !mapMode);

    const current = state.players.find((p) => p.id === state.currentPlayerId);
    const myTurn = state.phase === 'turn' && current && current.id === myId;
    const dialog = dialogOpen(state, myId);
    useEventKeys(stateRef, myId, actions);
    useEffect(() => { if (state.step !== 'roll') setBagOpen(false); }, [state.step]);

    const show = useCallback((next, ms = 2200) => {
        setBanner({ ...next, id: `${Date.now()}-${Math.random()}` });
        clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBanner(null), ms);
        sfx('banner');
    }, []);
    useEffect(() => () => clearTimeout(bannerTimer.current), []);

    // Les événements du plateau déclenchent les rubans
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
            case 'turn': {
                if (!player) break;
                const me = player.id === myId;
                show({
                    kicker: me ? '' : t('banner.turnOf'),
                    title: me ? t('banner.yourTurn') : player.name,
                    color: me ? '#ffd23a' : PLAYER_COLORS[player.seat],
                    player,
                    side: { kicker: event.turn === total ? t('banner.lastRound') : t('screen.turnLabel'), value: `${event.turn}/${total}` },
                }, 1500);
                jingle(player.characterId);
                if (me && navigator.vibrate) navigator.vibrate([30, 40, 30]);
                setMapMode(false);
                break;
            }
            case 'finale':
                show({
                    title: t('banner.finale'),
                    text: event.playerId === myId ? t('banner.finaleTextMe') : t('banner.finaleText', { name: player ? player.name : '' }),
                    color: '#ff6a55',
                    player,
                }, 2800);
                setMusicFinale(true);
                break;
            case 'wheel':
                sfx('star');
                break;
            case 'land':
                if (event.kind === 'drop' && player) show({ title: t('banner.drop'), text: t('banner.dropText', { name: player.name }), color: '#3fe08a', low: true }, 1700);
                break;
            case 'star':
                if (event.bought && player) show({ kicker: t('banner.starMoved'), title: t('banner.bought', { name: player.name }), color: '#ffd23a', low: true }, 2600);
                break;
            case 'minigame':
                show({ kicker: t('banner.minigame'), title: t(`minigame.${event.id}.name`), color: '#6fb0ff' }, 1600);
                break;
            default:
        }
    }, [show, t, myId]);

    // Place prise par le HUD (en haut) et l'action ou la boîte de dialogue (en bas), pour cadrer la caméra
    useEffect(() => {
        const root = screenRef.current;
        if (!root || typeof ResizeObserver === 'undefined') return undefined;
        const measure = () => {
            const box = root.getBoundingClientRect();
            const hud = root.querySelector('.party-hud');
            const top = hud ? hud.getBoundingClientRect().bottom - box.top : 0;
            let bottom = 24;
            root.querySelectorAll('.party-actions, .party-dialog').forEach((el) => {
                const r = el.getBoundingClientRect();
                if (r.height > 8) bottom = Math.max(bottom, box.bottom - r.top);
            });
            setInsets((prev) => (prev && Math.abs(prev.top - top) < 4 && Math.abs(prev.bottom - bottom) < 4 ? prev : { top, bottom }));
        };
        const observer = new ResizeObserver(measure);
        observer.observe(root);
        root.querySelectorAll('.party-hud, .party-actions, .party-dialog').forEach((el) => observer.observe(el));
        measure();
        return () => observer.disconnect();
    }, [state.phase, compact, state.step, dialog]);

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

    // Clavier : Espace (dé, vinyle, roue), S (sac), M (carte), flèches au carrefour, Échap (pause)
    useEffect(() => {
        const onKey = (event) => {
            const tag = event.target && event.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (event.key === 'Escape') {
                setPaused((p) => !p);
                return;
            }
            const ui = uiRef.current;
            if (ui.paused) return;
            const s = stateRef.current;
            const cur = s.players.find((p) => p.id === s.currentPlayerId);
            const mine = cur && cur.id === myId;
            const space = event.code === 'Space' && !event.repeat && tag !== 'BUTTON';
            if (space && s.step === 'wheel' && s.wheel && s.wheel.playerId === myId) {
                event.preventDefault();
                unlockAudio();
                actions.wheel();
                return;
            }
            if (space && !ui.bagOpen) {
                const orderRoll = s.phase === 'order' && s.step === 'roll' && s.orderRolls[myId] == null;
                if ((mine && (s.step === 'roll' || s.step === 'scratch')) || orderRoll) {
                    event.preventDefault();
                    unlockAudio();
                    actions.roll();
                }
            }
            if (event.key === 'm' || event.key === 'M') setMapMode((m) => !m);
            if ((event.key === 's' || event.key === 'S') && mine && s.step === 'roll') {
                const me = s.players.find((p) => p.id === myId);
                if (me && me.items && me.items.length && !s.itemUsed) setBagOpen((o) => !o);
            }
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

    const pause = paused && <PauseMenu t={t} onClose={() => setPaused(false)} mapMode={mapMode} onMap={() => setMapMode((m) => !m)} musicOn={musicOn} onMusic={toggleMusic} />;

    if (state.phase === 'minigame') {
        return (
            <div className="party-mg">
                <Hud state={state} myId={myId} t={t} compact inline />
                <MinigameStage state={state} myId={myId} t={t} clockOffset={clockOffset} onReady={actions.ready} onSubmit={actions.submit} onInput={actions.mgInput} />
                {iris > 0 && <Iris id={iris} />}
                {pause}
            </div>
        );
    }

    const chipTop = insets ? insets.top + 6 : 90;
    return (
        <div ref={screenRef} className={`party-screen ${myTurn ? 'is-my-turn' : ''}`} onPointerDown={unlockAudio}>
            <PartyBoard state={state} queue={queue} myId={myId} t={t} mapMode={mapMode} onEvent={onEvent} onChoose={actions.choose} insets={insets} clockOffset={clockOffset} positionsRef={positionsRef} />
            <Hud state={state} myId={myId} t={t} compact={compact} />
            <div className="party-turnchip" style={{ top: chipTop }}>
                <span className="hw-chip">
                    <LcdText text={state.turn > 0 ? t('board.turn', { turn: state.turn, total: state.settings.turns }) : t('board.orderTitle')} scale={2} />
                </span>
                {state.finale && state.finaleEffect && (
                    <span className="hw-chip">
                        <span className="hw-led is-on hw-blink" style={{ '--led': '#ff6a55' }} />
                        <LcdText text={t(`board.finaleChip.${state.finaleEffect}`, { price: state.starPrice })} scale={2} color="#ff6a55" />
                    </span>
                )}
                {mapMode && <span className="hw-chip"><LcdText text={t('screen.mapBadge')} scale={2} color="#ffd23a" /></span>}
                <Key size="sm" className="hw-key-icon party-pause-button" onClick={() => setPaused(true)} aria-label={t('screen.pause')} title={t('screen.pause')}>
                    <span aria-hidden="true" className="party-pause-glyph" />
                </Key>
            </div>
            {coins.map((c) => <Coin key={c.id} coin={c} />)}
            <Ribbon banner={banner} compact={compact} />
            <FinaleWheel state={state} t={t} clockOffset={clockOffset} />
            <EventPanels state={state} myId={myId} t={t} clockOffset={clockOffset} actions={actions} />
            <StarDialog state={state} myId={myId} t={t} actions={actions} />
            {!dialog && <ActionBar state={state} myId={myId} t={t} secondsLeft={secondsLeft} actions={actions} bagOpen={bagOpen} setBagOpen={setBagOpen} onMap={() => setMapMode((m) => !m)} />}
            {iris > 0 && <Iris id={iris} />}
            {pause}
        </div>
    );
}
