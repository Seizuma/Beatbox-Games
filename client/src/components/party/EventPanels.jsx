import React, { useEffect, useRef, useState } from 'react';
import { PLAYER_COLORS } from './characters/pixelRig';
import { Key, LoopPad, PlayerRing } from './ui/Hardware';
import { CoinIcon, MicIcon } from './PartyIcons';

// Panneaux des évènements du plateau, au centre de l'écran : Sample ?, Coupure,
// Freestyle !, Battle et le voleur de flow. Les choix du joueur concerné sont dans le
// panneau, à côté de ce qui se passe (pas dans la console).

const SAMPLE_IDS = ['crowd', 'encore', 'screen', 'swap', 'feedback', 'tipjar'];
const CUT_IDS = ['lose', 'share', 'blackout', 'mic'];

const nameOf = (state, id) => (state.players.find((p) => p.id === id) || {}).name || '?';
const playerOf = (state, id) => state.players.find((p) => p.id === id) || null;

// Valeur qui défile pendant un tirage (purement visuel : le serveur tire au sort)
function useCycler(list, active, ms = 90) {
    const [i, setI] = useState(0);
    useEffect(() => {
        if (!active) return undefined;
        const timer = setInterval(() => setI((n) => (n + 1) % list.length), ms);
        return () => clearInterval(timer);
    }, [active, list.length, ms]);
    return list[i];
}

// Position d'un rouleau qui tourne, calée sur l'horloge du serveur (comme le vinyle)
function useReelIndex(reel, clockOffset) {
    const [, tick] = useState(0);
    const spinning = reel && reel.slots && reel.spinAt && reel.index == null;
    useEffect(() => {
        if (!spinning) return undefined;
        let raf = 0;
        const loop = () => { tick((n) => n + 1); raf = requestAnimationFrame(loop); };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [spinning]);
    if (!reel || !reel.slots) return null;
    if (reel.index != null) return reel.index;
    if (!reel.spinAt) return 0;
    return Math.floor((Date.now() + clockOffset - reel.spinAt) / reel.period) % reel.slots.length;
}

function Panel({ kind, title, children, done }) {
    return (
        <div className="party-event-layer" aria-live="polite">
            <div className={`party-event is-${kind} ${done ? 'is-done' : ''}`}>
                <p className="hw-title party-event-title">{title}</p>
                {children}
            </div>
        </div>
    );
}

function Who({ player, size = 40, pose = 'idle' }) {
    if (!player) return null;
    return (
        <span className="flex items-center gap-2">
            <PlayerRing player={player} color={PLAYER_COLORS[player.seat]} size={size} active pose={pose} />
            <span className="hw-strip-name">{player.name}</span>
        </span>
    );
}

// ---------------------------------------------------------------------------
// Sample ? et Coupure : un tirage automatique, puis le résultat
// ---------------------------------------------------------------------------

function SamplePanel({ state, t }) {
    const sp = state.sample;
    const spinning = state.step === 'sample';
    const shown = useCycler(SAMPLE_IDS, spinning);
    if (!sp || !['sample', 'sampleResult'].includes(state.step)) return null;
    const result = spinning ? shown : sp.result;
    const vars = { name: nameOf(state, sp.playerId), other: nameOf(state, sp.with), n: sp.amount || sp.value || 0 };
    return (
        <Panel kind="sample" title={t('events2.sampleTitle')} done={!spinning}>
            <p className={`hw-title party-event-big ${spinning ? 'party-event-spin' : 'hw-pop'}`}>{t(`events2.sample.${result}.name`)}</p>
            {!spinning && <p className="hw-text party-event-text">{t(`events2.sample.${result}.text`, vars)}</p>}
        </Panel>
    );
}

function CutPanel({ state, t }) {
    const cut = state.cut;
    const spinning = state.step === 'cut';
    const shown = useCycler(CUT_IDS, spinning);
    if (!cut || !['cut', 'cutResult'].includes(state.step)) return null;
    const result = spinning ? shown : cut.result;
    const vars = { name: nameOf(state, cut.playerId), n: cut.amount || 0 };
    return (
        <Panel kind="cut" title={t('events2.cutTitle')} done={!spinning}>
            <p className="hw-label">{t('events2.cutKicker')}</p>
            <p className={`hw-title party-event-big ${spinning ? 'party-event-spin' : 'hw-pop'}`}>{t(`events2.cut.${result}.name`)}</p>
            {!spinning && <p className="hw-text party-event-text">{t(`events2.cut.${result}.text`, vars)}</p>}
        </Panel>
    );
}

// ---------------------------------------------------------------------------
// Freestyle ! : trois rouleaux arrêtés par le joueur
// ---------------------------------------------------------------------------

function ReelSlot({ state, t, kind, value }) {
    if (value == null) return <span className="party-reel-value">?</span>;
    if (kind === 'gift') {
        return (
            <span className="party-reel-value">
                {value === 'mic' ? <MicIcon size={20} /> : value[0] === 'h' ? <CoinIcon size={18} /> : null}
                {t(`events2.gift.${value}`)}
            </span>
        );
    }
    const p = playerOf(state, value);
    return (
        <span className="party-reel-value" style={{ color: p ? PLAYER_COLORS[p.seat] : undefined }}>
            {p ? p.name : '?'}
        </span>
    );
}

function Reel({ state, t, reel, kind, label, clockOffset, live }) {
    const index = useReelIndex(reel, clockOffset);
    const value = reel && reel.slots && index != null ? reel.slots[index] : null;
    return (
        <div className={`party-reel ${live ? 'is-live' : ''} ${reel && reel.index != null ? 'is-stopped' : ''}`}>
            <span className="hw-label !text-[0.62rem]">{label}</span>
            <ReelSlot state={state} t={t} kind={kind} value={reel && reel.spinAt ? value : null} />
        </div>
    );
}

function FreestylePanel({ state, myId, t, clockOffset, actions }) {
    const fs = state.freestyle;
    if (!fs || !['freestyle', 'freestyleResult'].includes(state.step)) return null;
    const mine = fs.playerId === myId && state.step === 'freestyle';
    const done = state.step === 'freestyleResult' && fs.result;
    const labels = [t('events2.reelGiver'), t('events2.reelGift'), t('events2.reelTaker')];
    return (
        <Panel kind="freestyle" title={t('events2.freestyleTitle')} done={done}>
            <div className="party-reels">
                {fs.reels.map((reel, i) => (
                    <Reel key={i} state={state} t={t} reel={reel} kind={i === 1 ? 'gift' : 'player'} label={labels[i]} clockOffset={clockOffset} live={state.step === 'freestyle' && fs.current === i} />
                ))}
            </div>
            {done ? (
                <p className="hw-title hw-pop party-event-result">
                    {t(`events2.giftDone.${fs.result.gift}`, { a: nameOf(state, fs.result.giver), b: nameOf(state, fs.result.taker), n: fs.result.amount })}
                </p>
            ) : mine ? (
                <LoopPad color="amber" size="md" spinning onClick={() => actions.reel()} hint={t('screen.rollHint')}>{t('board.wheelStop')}</LoopPad>
            ) : (
                <p className="hw-text party-event-text">{t('events2.freestyleWaiting', { name: nameOf(state, fs.playerId) })}</p>
            )}
        </Panel>
    );
}

// ---------------------------------------------------------------------------
// Battle : la mise et le pot, avant le mini-jeu
// ---------------------------------------------------------------------------

function BattlePanel({ state, t }) {
    const b = state.battle;
    if (!b || state.step !== 'battle') return null;
    return (
        <Panel kind="battle" title={t('events2.battleTitle')}>
            <p className="hw-text party-event-text">{t('events2.battleText', { n: b.stake })}</p>
            <p className="hw-title hw-pop party-event-big flex items-center gap-2"><CoinIcon size={26} />{t('events2.battlePot', { n: b.pot })}</p>
            <p className="hw-label">{t('events2.battleSplit')}</p>
        </Panel>
    );
}

// ---------------------------------------------------------------------------
// Le voleur de flow
// ---------------------------------------------------------------------------

function Masher({ t, onMash }) {
    const [count, setCount] = useState(0);
    const press = () => {
        setCount((n) => n + 1);
        onMash();
    };
    return (
        <div className="flex flex-col items-center gap-2">
            <LoopPad color="green" size="md" spinning onPointerDown={(event) => { event.preventDefault(); press(); }} hint={t('screen.rollHint')}>{t('events2.mash')}</LoopPad>
            <span className="hw-label">{t('events2.mashCount', { n: count })}</span>
        </div>
    );
}

function ThiefPanel({ state, myId, t, actions }) {
    const th = state.thief;
    if (!th || !['thief', 'thiefTarget', 'steal', 'stealResult'].includes(state.step)) return null;
    const mine = th.playerId === myId;
    const name = nameOf(state, th.playerId);
    let body;
    if (state.step === 'thief') {
        body = mine ? (
            <div className="flex w-full flex-col gap-2">
                <p className="hw-text party-event-text">{t('events2.thiefAsk')}</p>
                {th.options.map((o) => (
                    <Key key={o.id} size="md" led={o.id === 'mic' ? 'amber' : 'green'} ledOn={o.ok} disabled={!o.ok} className="!justify-between" onClick={() => actions.thief(o.id)}>
                        <span>{t(`events2.thiefOption.${o.id}`)}</span>
                        <span className="flex items-center gap-1"><CoinIcon size={14} />{o.cost}</span>
                    </Key>
                ))}
                <Key size="md" led="red" onClick={() => actions.thief('none')}>{t('board.skip')}</Key>
            </div>
        ) : <p className="hw-text party-event-text">{t('events2.thiefVisit', { name })}</p>;
    } else if (state.step === 'thiefTarget') {
        body = mine ? (
            <div className="flex w-full flex-col gap-2">
                <p className="hw-text party-event-text">{t(th.kind === 'mic' ? 'events2.thiefWhoMic' : 'events2.thiefWho')}</p>
                {(th.targets || []).map((id) => {
                    const p = playerOf(state, id);
                    return (
                        <Key key={id} size="md" className="!justify-between" onClick={() => actions.victim(id)}>
                            <Who player={p} size={32} />
                            <span className="flex items-center gap-1">{th.kind === 'mic' ? <><MicIcon size={14} />{p.stars}</> : <><CoinIcon size={14} />{p.hype}</>}</span>
                        </Key>
                    );
                })}
            </div>
        ) : <p className="hw-text party-event-text">{t('events2.thiefChoosing', { name })}</p>;
    } else if (state.step === 'steal') {
        const victim = playerOf(state, th.victimId);
        body = (
            <>
                <p className="hw-text party-event-text">{t(th.kind === 'mic' ? 'events2.stealMic' : 'events2.stealHype', { name, victim: victim ? victim.name : '' })}</p>
                {th.victimId === myId && th.kind === 'hype' && <Masher t={t} onMash={actions.mash} />}
            </>
        );
    } else {
        body = (
            <p className="hw-title hw-pop party-event-result">
                {th.kind === 'mic'
                    ? t('events2.stoleMic', { name, victim: nameOf(state, th.victimId) })
                    : t('events2.stoleHype', { name, victim: nameOf(state, th.victimId), n: th.result || 0 })}
            </p>
        );
    }
    return (
        <Panel kind="thief" title={t('events2.thiefTitle')} done={state.step === 'stealResult'}>
            {body}
        </Panel>
    );
}

export default function EventPanels(props) {
    return (
        <>
            <SamplePanel {...props} />
            <CutPanel {...props} />
            <FreestylePanel {...props} />
            <BattlePanel {...props} />
            <ThiefPanel {...props} />
        </>
    );
}

// Touche Espace : arrêter un rouleau, protéger sa Hype
export function useEventKeys(stateRef, myId, actions) {
    const ref = useRef(actions);
    ref.current = actions;
    useEffect(() => {
        const onKey = (event) => {
            if (event.code !== 'Space' || event.repeat) return;
            const tag = event.target && event.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
            const s = stateRef.current;
            if (s.step === 'freestyle' && s.freestyle && s.freestyle.playerId === myId) {
                event.preventDefault();
                ref.current.reel();
            } else if (s.step === 'steal' && s.thief && s.thief.victimId === myId) {
                event.preventDefault();
                ref.current.mash();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [stateRef, myId]);
}
