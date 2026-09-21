import React from 'react';

// Classes par état, alignées sur les jetons --dle-* d'index.css (thèmes nuit et jour)
const STATE_CLASS = {
    correct: 'bg-dle-correct text-dle-correct-ink border-transparent',
    present: 'bg-dle-present text-dle-present-ink border-transparent',
    absent: 'bg-dle-absent text-dle-absent-ink border-transparent',
};

/**
 * Grille du mode lettres.
 *
 * La largeur des cases est fluide (`minmax(0,1fr)` sur `length` colonnes) :
 * les noms vont de 3 à 9 lettres selon le jour, et une taille fixe casserait
 * la mise en page sur les noms longs comme sur les courts.
 */
export default function LettersGrid({ length, maxAttempts, guesses, stateLabels }) {
    const rows = Array.from({ length: maxAttempts }, (_, index) => guesses[index] || null);

    return (
        <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
        >
            {rows.flatMap((guess, rowIndex) => (
                Array.from({ length }, (_, cellIndex) => {
                    const cell = guess ? guess.result[cellIndex] : null;

                    if (!cell) {
                        return (
                            <div
                                key={`${rowIndex}-${cellIndex}`}
                                aria-hidden="true"
                                className="flex aspect-square items-center justify-center rounded border border-site-line"
                            />
                        );
                    }

                    return (
                        <div
                            key={`${rowIndex}-${cellIndex}`}
                            // Chaque case porte son verdict en texte : sans cela, une grille
                            // lue par un lecteur d'écran n'est qu'une suite de lettres.
                            aria-label={`${cell.letter} — ${stateLabels[cell.state]}`}
                            className={`flex aspect-square items-center justify-center rounded border text-[clamp(0.95rem,4.4vw,1.4rem)] font-semibold uppercase ${STATE_CLASS[cell.state]}`}
                        >
                            {cell.letter}
                        </div>
                    );
                })
            ))}
        </div>
    );
}