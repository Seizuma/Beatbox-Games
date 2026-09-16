import { useEffect, useRef, useState } from 'react';

// Vitesse maximale de dévoilement : 1 = la durée nominale de la manche.
// 1.8 laisse rattraper un retard sans jamais produire de saut visible.
const CATCH_UP_FACTOR = 1.8;

const prefersReducedMotion = () => typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Transforme les échantillons du serveur en une progression continue et monotone.
 *
 * target    : part masquée visée, 0 (nette) à 1 (masquée)
 * roundKey  : change à chaque manche, remet la progression à 1
 * paused    : vrai pendant qu'un joueur répond (le serveur a gelé la manche)
 * durationMs: durée nominale du dévoilement, pour calculer la vitesse plafond
 *
 * Renvoie la part masquée lissée.
 */
export default function useRevealProgress({ target, roundKey, paused = false, durationMs = 20000 }) {
    const [hidden, setHidden] = useState(1);
    const stateRef = useRef({ current: 1, target: 1, roundKey: null, paused: false });
    const frameRef = useRef(null);

    // Nouvelle manche : tout repart masqué, sans transition
    useEffect(() => {
        stateRef.current.roundKey = roundKey;
        stateRef.current.current = 1;
        stateRef.current.target = 1;
        setHidden(1);
    }, [roundKey]);

    useEffect(() => {
        const clamped = Math.max(0, Math.min(1, Number(target)));
        // Le dévoilement ne revient jamais en arrière à l'intérieur d'une manche :
        // un paquet en retard ne doit pas re-flouter la photo.
        stateRef.current.target = Math.min(stateRef.current.target, clamped);
    }, [target]);

    useEffect(() => {
        stateRef.current.paused = paused;
    }, [paused]);

    useEffect(() => {
        if (prefersReducedMotion()) {
            setHidden(stateRef.current.target);
            return undefined;
        }

        let lastTime = performance.now();

        const step = (now) => {
            const state = stateRef.current;
            const delta = Math.min(120, now - lastTime);
            lastTime = now;

            if (!state.paused && state.current > state.target) {
                const maxSpeed = (CATCH_UP_FACTOR / Math.max(1000, durationMs)) * delta;
                state.current = Math.max(state.target, state.current - maxSpeed);
                setHidden(state.current);
            }

            frameRef.current = requestAnimationFrame(step);
        };

        frameRef.current = requestAnimationFrame(step);
        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [durationMs]);

    return hidden;
}