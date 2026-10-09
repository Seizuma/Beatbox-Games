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
 * les noms vont de 3 à 12 lettres selon le jour, et une taille fixe casserait
 * la mise en page sur les noms longs comme sur les courts. La ligne en cours
 * affiche les lettres tapées au clavier (`draft`), comme sur Wordle.
 *
 * La ligne qui vient d'être jouée se retourne lettre par lettre (`dle-flip`,
 * décalage de 110 ms) ; les lignes déjà posées ne rejouent rien.
 */
export default function LettersGrid({ length, maxAttempts, guesses, stateLabels, revealIndex, draft = '' }) {
    const rows = Array.from({ length: maxAttempts }, (_, index) => guesses[index] || null);
    const draftRow = guesses.length < maxAttempts ? guesses.length : -1;

    return (
        <div
            // Cases plafonnées à 3,4 rem, et à la hauteur d'écran qui reste une fois
            // le clavier posé (environ 26,5 rem avec l'en-tête) : la grille entière
            // reste visible au-dessus des touches, même sur un petit téléphone.
            className="mx-auto grid w-full gap-1.5"
            style={{
                gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))`,
                maxWidth: `min(${length * 3.4 + (length - 1) * 0.375}rem, calc((100dvh - 26.5rem) * ${(length / maxAttempts).toFixed(3)}))`,
            }}
        >
            {rows.flatMap((guess, rowIndex) => (
                Array.from({ length }, (_, cellIndex) => {
                    const cell = guess ? guess.result[cellIndex] : null;

                    if (!cell) {
                        // Ligne en cours : les lettres tapées s'y posent au fur et à mesure
                        const typed = rowIndex === draftRow ? draft[cellIndex] : null;
                        return (
                            <div
                                key={`${rowIndex}-${cellIndex}`}
                                aria-hidden="true"
                                className={`flex aspect-square items-center justify-center rounded-md border text-[clamp(0.95rem,4.4vw,1.4rem)] font-semibold uppercase text-site-ink ${typed
                                    ? 'border-site-muted'
                                    : rowIndex === draftRow ? 'border-site-soft/60' : 'border-site-line'}`}
                            >
                                {typed || ''}
                            </div>
                        );
                    }

                    const animate = rowIndex === revealIndex;

                    return (
                        <div
                            key={`${rowIndex}-${cellIndex}`}
                            // Chaque case porte son verdict en texte : sans cela, une grille
                            // lue par un lecteur d'écran n'est qu'une suite de lettres.
                            aria-label={`${cell.letter} — ${stateLabels[cell.state]}`}
                            style={animate ? { '--dle-index': cellIndex } : undefined}
                            className={`flex aspect-square items-center justify-center rounded-md border text-[clamp(0.95rem,4.4vw,1.4rem)] font-semibold uppercase ${STATE_CLASS[cell.state]} ${animate ? 'dle-flip' : ''}`}
                        >
                            {cell.letter}
                        </div>
                    );
                })
            ))}
        </div>
    );
}