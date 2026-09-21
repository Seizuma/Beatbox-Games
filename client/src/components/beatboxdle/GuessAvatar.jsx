import React, { useState } from 'react';
import { API_BASE_URL } from '../../utils/useApi';

/** Deux initiales au maximum : « Bookie Blanco » donne BB, « Zekka » donne Z. */
const initialsOf = (name) => String(name || '')
    .split(/[\s\-_'.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

/**
 * Visage du beatboxer proposé, repris de la banque de photos du Buzzer Battle
 * (servie par /api/beatboxer-images). Sans photo — ou si elle ne charge pas —
 * les initiales tiennent la place : la grille garde le même rythme, une ligne
 * ne devient pas plus courte que les autres.
 */
export default function GuessAvatar({ name, photo }) {
    const [failed, setFailed] = useState(false);
    const usable = photo && !failed;

    return (
        <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-site-tint text-[0.6875rem] font-bold text-site-muted ring-1 ring-site-line"
        >
            {usable ? (
                <img
                    src={`${API_BASE_URL}/api/beatboxer-images/${encodeURIComponent(photo)}`}
                    alt=""
                    loading="lazy"
                    onError={() => setFailed(true)}
                    className="h-full w-full object-cover"
                />
            ) : (
                initialsOf(name)
            )}
        </span>
    );
}