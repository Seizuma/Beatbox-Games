import React, { useEffect, useState } from 'react';
import PartyBoard from './board/PartyBoard';
import PixelCharacter from './PixelCharacter';
import MinigameStage from './minigames/MinigameStage';
import { PLAYER_COLORS } from './characters/pixelRig';
import { unlockAudio } from './partySfx';

// Texte de l'événement le plus récent (ligne d'information sous le plateau)
export function describeEvent(event, players, t) {
    if (!event) return '';
    const name = (id) => (players.find((p) => p.id === id) || {}).name || '?';
    switch (event.type) {
        case 'started': return t('events.started');
        case 'orderRoll': return t('events.orderRoll', { name: name(event.playerId), n: event.value });
        case 'order': return t('events.order', { name: name(event.order[0]) });
        case 'turn': return t('events.turn', { name: name(event.playerId) });
        case 'roll': return t('events.roll', { name: name(event.playerId), n: event.value });
        case 'land':
            if (event.kind === 'drop') return t('events.drop', { name: name(event.playerId) });
            if (event.kind === 'red') return t('events.red', { name: name(event.playerId), n: Math.abs(event.delta) });
            return t(`events.${event.kind}`, { name: name(event.playerId), n: event.delta });
        case 'chose': return event.paid ? t('events.gate', { name: name(event.playerId), n: event.paid }) : '';
        case 'star':
            return event.bought ? t('events.bought', { name: name(event.playerId) }) : t('events.declined', { name: name(event.playerId) });
        case 'starOffer': return event.affordable ? '' : t('events.noMoney', { name: name(event.playerId) });
        case 'finale': return t('events.finale');
        case 'minigame': return t('events.minigame', { name: t(`minigame.${event.id}.name`) });
        case 'disconnected': return t('events.disconnected', { name: name(event.playerId) });
        case 'reconnected': return t('events.reconnected', { name: name(event.playerId) });
        default: return '';
    }
}

function useSecondsLeft(deadline, clockOffset) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!deadline) return undefined;
        const timer = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(timer);
    }, [deadline]);
    if (!deadline) return null;
    return Math.max(0, Math.ceil((deadline - (now + clockOffset)) / 1000));
}

function PlayerStrip({ state, myId, t }) {
    const ordered = state.order && state.order.length
        ? state.order.map((id) => state.players.find((p) => p.id === id)).filter(Boolean)
        : state.players;
    return (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ordered.map((p, index) => {
                const active = state.currentPlayerId === p.id;
                const roll = state.phase === 'order' ? state.orderRolls[p.id] : null;
                return (
                    <li
                        key={p.id}
                        className={`party-panel flex items-center gap-2 px-2 py-1.5 ${active ? 'ring-2 ring-[color:var(--px-yellow)]' : ''}`}
                        style={{ borderColor: PLAYER_COLORS[p.seat] }}
                    >
                        <div className="relative h-[54px] w-8 shrink-0 overflow-hidden">
                            <PixelCharacter id={p.characterId} color={PLAYER_COLORS[p.seat]} pose={active ? 'beatbox' : 'idle'} base={false} scale={1} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1 truncate text-sm font-bold">
                                {state.order && state.order.length > 0 && <span className="party-font text-[0.65rem] text-[color:var(--px-muted)]">{index + 1}.</span>}
                                <span className="truncate">{p.name}</span>
                                {p.id === myId && <span className="party-font text-[0.6rem] text-[color:var(--px-yellow)]">{t('lobby.you')}</span>}
                            </p>
                            <p className="party-font flex gap-3 text-sm">
                                <span title={t('board.stars')} className="text-[color:var(--px-yellow)]">★{p.stars}</span>
                                <span title={t('board.hype')}>{p.hype}<span className="ml-0.5 text-[0.6rem] text-[color:var(--px-muted)]">H</span></span>
                                {roll != null && <span className="text-[color:var(--px-green)]">D{roll}</span>}
                            </p>
                            {state.stageOwner === p.id && <p className="party-font text-[0.6rem] text-[color:var(--px-green)]">{t('board.onStage')}</p>}
                            {!p.isBot && !p.connected && <p className="party-font text-[0.6rem] text-[color:var(--px-red)]">{t('lobby.offline')}</p>}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

function ActionPanel({ state, myId, t, secondsLeft, actions }) {
    const current = state.players.find((p) => p.id === state.currentPlayerId);
    const mine = current && current.id === myId;
    const name = current ? current.name : '';
    const timer = secondsLeft != null && mine ? <span className="party-font text-sm text-[color:var(--px-muted)]">{t('board.secondsLeft', { n: secondsLeft })}</span> : null;

    if (state.phase === 'order') {
        const rolled = state.orderRolls[myId] != null;
        if (state.step === 'reveal') {
            return (
                <div className="flex flex-col gap-2">
                    <p className="party-font text-lg text-[color:var(--px-yellow)]">{t('board.orderTitle')}</p>
                    <ol className="party-font flex flex-wrap gap-x-5 gap-y-1">
                        {state.order.map((id, i) => <li key={id}>{i + 1}. {(state.players.find((p) => p.id === id) || {}).name}</li>)}
                    </ol>
                </div>
            );
        }
        return rolled ? (
            <p className="party-blink party-font text-[color:var(--px-muted)]">{t('board.orderWaiting')}</p>
        ) : (
            <div className="flex flex-wrap items-center gap-4">
                <p className="font-bold">{t('board.orderRoll')}</p>
                <button type="button" className="party-btn party-btn-big" onClick={actions.roll}>{t('board.roll')}</button>
            </div>
        );
    }

    switch (state.step) {
        case 'finale':
            return <p className="party-font party-pop text-2xl text-[color:var(--px-red)]">{t('events.finale')}</p>;
        case 'intro':
            return <p className="party-font party-pop text-2xl text-[color:var(--px-yellow)]">{mine ? t('board.yourTurn') : t('board.turnOf', { name })}</p>;
        case 'roll':
            return mine ? (
                <div className="flex flex-wrap items-center gap-4">
                    <button type="button" className="party-btn party-btn-big" onClick={actions.roll}>
                        {t('board.roll')} <span className="hidden text-xs opacity-70 sm:inline">[{t('board.rollHint')}]</span>
                    </button>
                    {timer}
                </div>
            ) : <p className="party-blink party-font">{t('board.rolling', { name })}</p>;
        case 'choice':
            if (!mine || !state.choice) return <p className="party-blink party-font">{t('board.waitingChoice', { name })}</p>;
            return (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3"><p className="party-font text-lg text-[color:var(--px-yellow)]">{t('board.choiceTitle')}</p>{timer}</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {state.choice.options.map((option) => (
                            <button
                                key={option.spaceId}
                                type="button"
                                className={`party-btn ${option.gate ? '' : 'party-btn-ghost'} flex-col !items-start text-left`}
                                disabled={!option.affordable}
                                onClick={() => actions.choose(option.spaceId)}
                            >
                                <span className="text-base">{option.gate ? t('board.choiceGate') : t('board.choiceMain')}</span>
                                <span className="font-show text-xs font-bold normal-case opacity-80">
                                    {option.gate ? t('board.choiceGateInfo', { n: option.gate }) : t('board.choiceMainInfo')}
                                    {!option.affordable && ` · ${t('board.notEnough')}`}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            );
        case 'star':
            if (!state.starOffer) return null;
            if (!mine) return <p className="party-blink party-font">{t('board.waitingStar', { name })}</p>;
            if (!state.starOffer.affordable) return <p className="party-font text-[color:var(--px-muted)]">{t('board.starNoMoney', { price: state.starOffer.price })}</p>;
            return (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <p className="party-font text-xl text-[color:var(--px-yellow)]">★ {t('board.starTitle')}</p>
                        {timer}
                    </div>
                    <p className="font-bold">{t('board.starAsk', { price: state.starOffer.price })}</p>
                    <div className="flex flex-wrap gap-3">
                        <button type="button" className="party-btn party-btn-big" onClick={() => actions.star(true)}>{t('board.buy')}</button>
                        <button type="button" className="party-btn party-btn-ghost" onClick={() => actions.star(false)}>{t('board.skip')}</button>
                    </div>
                </div>
            );
        case 'rolled':
        case 'moving':
            return <p className="party-font">{state.roll ? t('board.moving', { name, n: state.roll.value }) : ''}</p>;
        default:
            return null;
    }
}

export default function PartyPlay({ state, myId, t, queue, clockOffset, actions }) {
    const secondsLeft = useSecondsLeft(state.deadline, clockOffset);
    const current = state.players.find((p) => p.id === state.currentPlayerId);
    const myRollTurn = state.phase === 'turn' && state.step === 'roll' && current && current.id === myId;
    const myOrderRoll = state.phase === 'order' && state.step === 'roll' && state.orderRolls[myId] == null;
    const message = describeEvent(state.event, state.players, t);

    // Barre d'espace : lancer le dé
    useEffect(() => {
        if (!myRollTurn && !myOrderRoll) return undefined;
        const onKey = (event) => {
            if (event.code !== 'Space' || event.repeat) return;
            const tag = event.target && event.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
            event.preventDefault();
            unlockAudio();
            actions.roll();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [myRollTurn, myOrderRoll, actions]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="party-font text-lg">
                    {state.turn > 0 ? t('board.turn', { turn: state.turn, total: state.settings.turns }) : t('board.orderTitle')}
                </p>
                {state.finale && <span className="party-font party-blink rounded-md bg-[color:var(--px-red)] px-3 py-1 text-sm text-white">{t('board.finale')} ×2</span>}
            </div>

            <PlayerStrip state={state} myId={myId} t={t} />

            {state.phase === 'minigame' ? (
                <MinigameStage state={state} myId={myId} t={t} clockOffset={clockOffset} onReady={actions.ready} onSubmit={actions.submit} />
            ) : (
                <>
                    <PartyBoard state={state} queue={queue} myId={myId} />
                    <section className="party-panel min-h-[5.5rem] p-4" aria-live="polite">
                        <ActionPanel state={state} myId={myId} t={t} secondsLeft={secondsLeft} actions={actions} />
                        {message && <p className="mt-2 text-sm text-[color:var(--px-muted)]">{message}</p>}
                    </section>
                </>
            )}
        </div>
    );
}

export function PlayerAvatar({ player, pose = 'idle', scale = 2 }) {
    return <PixelCharacter id={player.characterId} color={PLAYER_COLORS[player.seat]} pose={pose} scale={scale} label={player.name} />;
}
