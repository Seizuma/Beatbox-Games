import React, { useEffect, useRef, useState } from 'react';
import { DialogBox } from './ui/Pixel';

// Premier tour guidé : l'ingé son explique chaque chose la première fois qu'elle arrive dans
// la partie (une case, un évènement, un moment du tour). Une astuce à la fois, en haut de
// l'écran, sans bloquer le jeu. Désactivable dans le menu pause (réglage gardé par le navigateur).

const STORE = 'beatboxParty.tips';
const SHOW_MS = 7000;
const STEP_TIPS = ['order', 'roll', 'bag', 'choice'];

export function tipsEnabled() {
    try {
        return window.localStorage.getItem(STORE) !== 'off';
    } catch (error) {
        return true;
    }
}

export function setTipsEnabled(on) {
    try {
        window.localStorage.setItem(STORE, on ? 'on' : 'off');
    } catch (error) {
        // Stockage indisponible : le réglage vaut pour cette page seulement
    }
}

// Astuce déclenchée par un évènement du plateau (n'importe quel joueur)
function tipForEvent(event, myId) {
    if (!event) return null;
    switch (event.type) {
        case 'land':
            if (event.trap) return 'trap';
            if (event.recorded) return 'track';
            if (event.kind === 'start') return 'blue';
            return ['blue', 'red', 'drop', 'sample', 'cut', 'freestyle', 'battle'].includes(event.kind) ? event.kind : null;
        case 'move':
            return (event.effects || []).some((f) => f.type === 'tip') ? 'tip' : null;
        case 'turn':
            return event.playerId !== myId ? 'react' : null;
        case 'duel':
            return 'duel';
        default:
            return null;
    }
}

// Astuce déclenchée par ce que le joueur doit faire maintenant
function tipForStep(state, myId) {
    if (state.phase === 'order' && state.step === 'roll' && state.orderRolls[myId] == null) return 'order';
    if (state.phase !== 'turn' || state.currentPlayerId !== myId) return null;
    const me = state.players.find((p) => p.id === myId);
    if (state.step === 'roll') return me && me.items && me.items.length ? 'bag' : 'roll';
    if (state.step === 'choice') return 'choice';
    return null;
}

export function useCoach(state, myId, enabled) {
    const seen = useRef(new Set());
    const lastSeq = useRef(state.event ? state.event.seq : 0);
    const [queue, setQueue] = useState([]);
    useEffect(() => {
        const found = [];
        const event = state.event;
        if (event && event.seq !== lastSeq.current) {
            lastSeq.current = event.seq;
            found.push(tipForEvent(event, myId));
        }
        found.push(tipForStep(state, myId));
        // « Ton tour » vient avant le sac : la première fois, on montre les deux
        if (found.includes('bag') && !seen.current.has('roll')) found.unshift('roll');
        // Une astuce liée à une étape (dé, carrefour…) n'a plus de sens une fois l'étape passée
        const now = tipForStep(state, myId);
        const stillValid = (id) => !STEP_TIPS.includes(id) || id === now || (id === 'roll' && now === 'bag');
        const fresh = found.filter((id) => id && !seen.current.has(id));
        fresh.forEach((id) => seen.current.add(id));
        setQueue((list) => {
            const kept = list.filter(stillValid);
            const next = enabled ? [...kept, ...fresh].slice(-3) : kept;
            return next.length === list.length && next.every((id, i) => id === list[i]) ? list : next;
        });
    }, [state, myId, enabled]);
    useEffect(() => { if (!enabled) setQueue([]); }, [enabled]);
    const current = queue[0] || null;
    useEffect(() => {
        if (!current) return undefined;
        const timer = setTimeout(() => setQueue((list) => list.slice(1)), SHOW_MS);
        return () => clearTimeout(timer);
    }, [current]);
    const dismiss = () => setQueue((list) => list.slice(1));
    return [current, dismiss];
}

export function CoachTip({ tip, t, top, onClose }) {
    if (!tip) return null;
    return (
        <div className="party-tip-layer" style={{ top }}>
            <div className="party-tip">
                <DialogBox key={tip} speaker="inge" name={t('npc.inge')} text={t(`coach.${tip}`)} layer={false} />
                <button type="button" className="party-tip-close" onClick={onClose} aria-label={t('close')}>×</button>
            </div>
        </div>
    );
}
