import React from 'react';
import Lectern from './Lectern';

// Ordre d'affichage : 2e, 1er, 3e ; hauteur du socle selon la place
const PLACES = [
    { index: 1, height: 'h-16 sm:h-24' },
    { index: 0, height: 'h-28 sm:h-40' },
    { index: 2, height: 'h-10 sm:h-16' },
];

/**
 * Podium de fin de partie.
 * entries : [{ key, name, score, isMe, avatarUrl }] triés du 1er au dernier
 * Avec moins de trois joueurs, les marches vides disparaissent au lieu de laisser des trous.
 */
export default function Podium({ entries = [], label, youLabel }) {
    const filled = PLACES.filter(({ index }) => entries[index]);
    if (filled.length < 2) return null;

    const columns = filled.length === 3
        ? 'grid-cols-[1fr_1.25fr_1fr]'
        : 'grid-cols-[1fr_1.25fr]';

    return (
        <ol className={`stage-floor grid ${columns} items-end gap-2 sm:gap-4`} aria-label={label}>
            {filled.map(({ index, height }) => {
                const entry = entries[index];
                return (
                    <li key={entry.key} className="flex flex-col">
                        <Lectern
                            size={index === 0 ? 'lg' : 'md'}
                            name={entry.name}
                            value={entry.score}
                            lamp={index === 0 ? 'answered' : 'idle'}
                            highlight={entry.isMe}
                            tag={entry.isMe ? youLabel : undefined}
                            avatarUrl={entry.avatarUrl}
                        />
                        <span
                            data-place={index + 1}
                            className={`podium-block -mt-2 flex items-start justify-center pt-2 font-brand text-2xl sm:text-3xl ${height}`}
                        >
                            {index + 1}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}