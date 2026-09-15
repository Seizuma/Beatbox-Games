import React from 'react';
import Lectern from './Lectern';

// Ordre d'affichage : 2e, 1er, 3e ; hauteur du socle selon la place
const PLACES = [
    { index: 1, height: 'h-14 sm:h-20' },
    { index: 0, height: 'h-24 sm:h-32' },
    { index: 2, height: 'h-9 sm:h-12' },
];

/**
 * Podium de fin de partie.
 * entries : [{ key, name, score, isMe, avatarUrl }] triés du 1er au dernier
 */
export default function Podium({ entries, label, youLabel }) {
    return (
        <ol className="stage-floor grid grid-cols-[1fr_1.2fr_1fr] items-end gap-2 sm:gap-4" aria-label={label}>
            {PLACES.map(({ index, height }) => {
                const entry = entries[index];
                if (!entry) return <li key={`empty-${index}`} aria-hidden="true" />;
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
                        <span className={`podium-block -mt-2 flex items-start justify-center pt-1.5 font-brand text-2xl sm:text-3xl ${height}`}>
                            {index + 1}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}