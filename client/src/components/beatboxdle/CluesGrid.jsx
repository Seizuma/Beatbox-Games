import React from 'react';

const STATE_CLASS = {
    correct: 'bg-dle-correct text-dle-correct-ink',
    present: 'bg-dle-present text-dle-present-ink',
    absent: 'bg-dle-absent text-dle-absent-ink',
};

// Ordre des colonnes, partagé avec compareClues côté serveur
const FIELDS = ['country', 'gender', 'firstYear', 'title'];

/** Flèche pointant vers la réponse. En SVG et non en caractère : même rendu partout. */
function Arrow({ direction, label }) {
    if (!direction) return null;
    const path = direction === 'up' ? 'M6 2 L10.5 9 L1.5 9 Z' : 'M6 10 L1.5 3 L10.5 3 Z';
    return (
        <svg width="10" height="10" viewBox="0 0 12 12" role="img" aria-label={label} className="mt-0.5 shrink-0">
            <path d={path} fill="currentColor" />
        </svg>
    );
}

/**
 * Grille du mode indices : une ligne par essai, le nom puis quatre cases.
 *
 * La colonne « Première apparition » a remplacé « Catégorie principale », qui
 * répondait « solo » pour 89 % de la base — vert presque à chaque coup, donc
 * muette. L'année sort à 5,9 % de collision sur 22 valeurs, et comme elle est
 * ordonnée, chaque essai coupe la recherche en deux.
 */
export default function CluesGrid({ guesses, headings, stateLabels, directionLabels, genderLabels }) {
    if (guesses.length === 0) return null;

    const format = (field, cell) => {
        if (field === 'gender') return genderLabels[cell.value] || '—';
        if (cell.value === null || cell.value === undefined || cell.value === '') return '—';
        return cell.value;
    };

    return (
        <div className="flex flex-col gap-2">
            <div
                className="grid items-end gap-1.5 border-b border-site-line pb-2"
                style={{ gridTemplateColumns: 'minmax(0, 1fr) repeat(4, minmax(0, 4.25rem))' }}
            >
                <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-site-muted">
                    {headings.guess}
                </span>
                {FIELDS.map((field) => (
                    <span
                        key={field}
                        className="text-center text-[0.625rem] font-semibold leading-tight text-site-muted"
                    >
                        {headings[field]}
                    </span>
                ))}
            </div>

            {/* Le plus récent en haut : c'est l'essai que le joueur vient de faire */}
            {[...guesses].reverse().map((guess, index) => (
                <div
                    key={`${guess.guess.slug}-${index}`}
                    className="grid items-stretch gap-1.5"
                    style={{ gridTemplateColumns: 'minmax(0, 1fr) repeat(4, minmax(0, 4.25rem))' }}
                >
                    <span className="flex items-center break-words pr-1 text-sm font-semibold leading-tight text-site-ink">
                        {guess.guess.name}
                    </span>
                    {FIELDS.map((field) => {
                        const cell = guess.result[field];
                        const directionLabel = cell.direction ? directionLabels[cell.direction] : '';
                        return (
                            <span
                                key={field}
                                aria-label={`${headings[field]} : ${format(field, cell)}, ${stateLabels[cell.state]}${directionLabel ? `, ${directionLabel}` : ''}`}
                                className={`flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 rounded px-1 py-1.5 text-center text-[0.625rem] font-semibold leading-tight ${STATE_CLASS[cell.state]}`}
                            >
                                <span aria-hidden="true">{format(field, cell)}</span>
                                <Arrow direction={cell.direction} label={directionLabel} />
                            </span>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}