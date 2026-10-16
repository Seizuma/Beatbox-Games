import React from 'react';
import { SOUNDS } from './shared';

// Les quatre pads de son (kick, caisse claire, charley, basse), comme ceux d'une loopstation.
// lit : pad allumé par la machine (lecture d'un motif) ; picked : choix du joueur.
export default function SoundPads({ onPad, lit = null, picked = null, disabled = false, marks = null, compact = false }) {
    return (
        <div className={`party-sound-pads ${compact ? 'is-compact' : ''}`}>
            {SOUNDS.map((s, i) => (
                <button
                    key={s.id}
                    type="button"
                    className={`party-sound-pad ${lit === i ? 'is-lit' : ''} ${picked === i ? 'is-picked' : ''}`}
                    style={{ '--c': s.color }}
                    disabled={disabled}
                    onPointerDown={(event) => { event.preventDefault(); if (!disabled) onPad(i); }}
                    aria-label={`${s.label} (${s.key})`}
                >
                    <span className="party-sound-pad-ring" aria-hidden="true" />
                    <span className="party-sound-pad-label">{s.label}</span>
                    <span className="party-sound-pad-key">{s.key}</span>
                    {marks && marks[i] ? <span className="party-sound-pad-marks">{marks[i]}</span> : null}
                </button>
            ))}
        </div>
    );
}
