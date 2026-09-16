import React, { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () => typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Score qui monte jusqu'à sa valeur : le moment fort de l'écran de fin
function useCountUp(target, duration = 1100) {
    const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
    const frameRef = useRef(null);

    useEffect(() => {
        if (prefersReducedMotion()) {
            setValue(target);
            return undefined;
        }

        const start = performance.now();
        const step = (now) => {
            const ratio = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - ratio, 3);
            setValue(Math.round(target * eased));
            if (ratio < 1) frameRef.current = requestAnimationFrame(step);
        };

        frameRef.current = requestAnimationFrame(step);
        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [target, duration]);

    return value;
}

function WinnerAvatar({ avatarUrl, name }) {
    const initial = (name || '?').trim().charAt(0).toUpperCase();

    return (
        <div className="relative h-32 w-32 sm:h-40 sm:w-40">
            <div className="bulb-ring absolute inset-0 [--progress:100%] motion-safe:animate-[spin_14s_linear_infinite]" aria-hidden="true" />
            <div className="absolute inset-[14%] overflow-hidden rounded-full bg-show-stage-2 ring-2 ring-show-yellow">
                {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                    <span className="flex h-full w-full items-center justify-center font-brand text-4xl text-show-white">
                        {initial}
                    </span>
                )}
            </div>
        </div>
    );
}

/**
 * Mise en valeur du gagnant en fin de partie.
 * kicker : ligne de contexte (salle, partie terminée)
 * championLabel : ruban au-dessus du nom
 * detail : ligne de statistiques facultative
 * badge : nœud facultatif (mode de jeu)
 */
export default function WinnerSpotlight({
    kicker,
    championLabel,
    name,
    score = 0,
    pointsLabel,
    detail,
    avatarUrl,
    badge,
}) {
    const displayed = useCountUp(Number(score) || 0);

    return (
        <section className="winner-spotlight relative overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-8 sm:py-10">
            {kicker && <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-show-muted">{kicker}</p>}

            <div className="mt-6 flex justify-center motion-safe:show-pop">
                <WinnerAvatar avatarUrl={avatarUrl} name={name} />
            </div>

            {championLabel && (
                <p className="mx-auto mt-5 w-max rounded-full bg-show-yellow px-4 py-1 font-brand text-sm leading-none text-show-night shadow-show-btn">
                    {championLabel}
                </p>
            )}

            <h1 className="mt-4 break-words font-brand text-4xl leading-tight sm:text-6xl">{name}</h1>

            <p className="mt-3 font-brand text-3xl tabular-nums text-show-yellow sm:text-4xl" aria-live="polite">
                {displayed}
                {pointsLabel && <span className="ml-2 align-middle text-sm font-bold text-show-muted">{pointsLabel}</span>}
            </p>

            {detail && <p className="mt-2 text-sm text-show-muted">{detail}</p>}
            {badge && <div className="mt-4 flex justify-center">{badge}</div>}
        </section>
    );
}