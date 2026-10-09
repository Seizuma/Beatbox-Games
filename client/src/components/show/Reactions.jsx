import React, { useCallback, useEffect, useRef, useState } from 'react';

// Les six réactions, identiques côté serveur (services/reactions.js)
export const REACTIONS = [
    { id: 'clap', emoji: '\u{1F44F}' },
    { id: 'fire', emoji: '\u{1F525}' },
    { id: 'laugh', emoji: '\u{1F602}' },
    { id: 'shock', emoji: '\u{1F631}' },
    { id: 'mind', emoji: '\u{1F92F}' },
    { id: 'mic', emoji: '\u{1F3A4}' },
];

const EMOJI = Object.fromEntries(REACTIONS.map((reaction) => [reaction.id, reaction.emoji]));
const SHOW_MS = 2400;
const COOLDOWN_MS = 900;

/**
 * Réactions reçues, par joueur : la dernière de chacun, effacée au bout de
 * 2,4 s. `push(key, id)` est stable, on peut l'appeler depuis un écouteur.
 */
export function useReactionFeed() {
    const [feed, setFeed] = useState({});
    const timers = useRef({});

    const push = useCallback((key, id) => {
        if (!key || !EMOJI[id]) return;
        const nonce = Date.now();
        setFeed((previous) => ({ ...previous, [key]: { id, nonce } }));
        clearTimeout(timers.current[key]);
        timers.current[key] = setTimeout(() => {
            setFeed((previous) => {
                if (!previous[key] || previous[key].nonce !== nonce) return previous;
                const next = { ...previous };
                delete next[key];
                return next;
            });
        }, SHOW_MS);
    }, []);

    useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

    return { feed, push };
}

/** Bulle posée au-dessus d'un pupitre. La clé `nonce` relance l'animation. */
export function ReactionBubble({ reaction }) {
    if (!reaction || !EMOJI[reaction.id]) return null;
    return (
        <span
            key={reaction.nonce}
            aria-hidden="true"
            className="reaction-pop pointer-events-none absolute -top-7 left-1/2 z-20 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-show-white text-2xl shadow-lg"
        >
            {EMOJI[reaction.id]}
        </span>
    );
}

/**
 * Six boutons d'émojis. Le délai entre deux envois est appliqué ici aussi :
 * le serveur ignorerait le surplus, autant ne pas l'envoyer.
 */
export function ReactionBar({ onReact, label, nameOf = (id) => id, className = '' }) {
    const lastRef = useRef(0);

    const send = (id) => {
        const now = Date.now();
        if (now - lastRef.current < COOLDOWN_MS) return;
        lastRef.current = now;
        onReact(id);
    };

    return (
        <div role="group" aria-label={label} className={`flex items-center justify-center gap-1.5 ${className}`}>
            {REACTIONS.map((reaction) => (
                <button
                    key={reaction.id}
                    type="button"
                    onClick={() => send(reaction.id)}
                    aria-label={nameOf(reaction.id)}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-show-stage-2 text-xl transition-transform hover:scale-110 active:scale-95"
                >
                    <span aria-hidden="true">{reaction.emoji}</span>
                </button>
            ))}
        </div>
    );
}

// Relais entre l'écouteur Socket.IO du Blind Test (useSocket) et l'écran de jeu
const listeners = new Set();
export const emitReaction = (data) => listeners.forEach((listener) => listener(data));
export function onReaction(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
