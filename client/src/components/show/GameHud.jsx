import React from 'react';

// Éléments d'information du plateau, affichés dans la zone de jeu (et non dans la barre du haut)

// Progression des manches : libellé + segments (ou barre continue au-delà de 24 manches)
export function RoundTrack({ round, total, label }) {
    const safeTotal = Math.max(1, Number(total) || 1);
    const safeRound = Math.min(safeTotal, Math.max(0, Number(round) || 0));
    const segmented = safeTotal <= 24;

    return (
        <div className="min-w-0">
            <p className="text-xs font-extrabold text-show-muted">{label}</p>
            <div
                className="mt-1.5 flex h-2 gap-1"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={safeTotal}
                aria-valuenow={safeRound}
                aria-label={label}
            >
                {segmented ? (
                    Array.from({ length: safeTotal }, (_, index) => (
                        <span
                            key={index}
                            className={`h-full flex-1 rounded-full ${index < safeRound - 1 ? 'bg-show-muted/60' : index === safeRound - 1 ? 'bg-show-yellow' : 'bg-show-dim'}`}
                        />
                    ))
                ) : (
                    <span className="relative h-full flex-1 overflow-hidden rounded-full bg-show-dim">
                        <span className="absolute inset-y-0 left-0 rounded-full bg-show-yellow" style={{ width: `${(safeRound / safeTotal) * 100}%` }} />
                    </span>
                )}
            </div>
        </div>
    );
}

// Trois extraits par manche : points en jeu, extrait courant mis en avant
export function LevelSteps({ level, steps, label }) {
    return (
        <div>
            <p className="text-xs font-extrabold text-show-muted">{label}</p>
            <ol className="mt-1.5 flex gap-1.5">
                {steps.map((step) => {
                    const state = step.level < level ? 'past' : step.level === level ? 'current' : 'next';
                    return (
                        <li
                            key={step.level}
                            aria-current={state === 'current' ? 'step' : undefined}
                            className={`flex min-w-[3.6rem] flex-col items-center rounded-lg px-2 py-1 leading-none ${state === 'current'
                                ? 'bg-show-yellow text-show-night'
                                : state === 'past'
                                    ? 'bg-show-night/40 text-show-muted'
                                    : 'bg-show-stage-2 text-show-white'
                                }`}
                        >
                            <span className={`font-brand text-base ${state === 'past' ? 'line-through decoration-2' : ''}`}>{step.points}</span>
                            <span className="mt-0.5 text-[10px] font-bold">{step.caption}</span>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

// Jauge de netteté de la photo (Buzzer Battle)
export function SharpnessGauge({ value, label, valueLabel }) {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    return (
        <div>
            <div className="flex items-baseline justify-between text-xs font-extrabold">
                <span className="text-show-muted">{label}</span>
                <span className="font-brand text-sm text-show-yellow">{valueLabel}</span>
            </div>
            <div className="relative mt-1.5 h-3 overflow-hidden rounded-full bg-show-night/70" aria-hidden="true">
                <div className="absolute inset-y-0 left-0 rounded-full bg-show-yellow transition-[width] duration-100" style={{ width: `${clamped}%` }} />
                {[25, 50, 75].map((tick) => (
                    <span key={tick} className="absolute inset-y-0 w-px bg-show-stage/60" style={{ left: `${tick}%` }} />
                ))}
            </div>
        </div>
    );
}

// Petites étiquettes de barème
export function ScoreChips({ items }) {
    return (
        <ul className="flex flex-wrap gap-1.5">
            {items.map((item) => (
                <li
                    key={item.label}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${item.tone === 'good' ? 'bg-show-ready/20 text-show-ready' : item.tone === 'bad' ? 'bg-show-buzz/20 text-[#FF8A7A]' : 'bg-show-stage-2 text-show-white'}`}
                >
                    {item.label}
                </li>
            ))}
        </ul>
    );
}

// Égaliseur animé : l'extrait est en cours de lecture
export function Equalizer({ active = true, className = '' }) {
    return (
        <span className={`equalizer ${className}`} data-active={active === 'hover' ? 'hover' : active ? 'true' : 'false'} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
        </span>
    );
}

// Rangée de pupitres posée sur le sol du plateau
export function LecternRow({ children, className = '', label }) {
    return (
        <ol aria-label={label} className={`stage-floor grid gap-x-3 gap-y-6 ${className}`}>
            {children}
        </ol>
    );
}