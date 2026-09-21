import React from 'react';
import GuessAvatar from './GuessAvatar';
import { continentName, countryName, categoryName, genderName, titleShortName } from '../../utils/beatboxdleLabels';

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
        <svg width="9" height="9" viewBox="0 0 12 12" role="img" aria-label={label} className="shrink-0">
            <path d={path} fill="currentColor" />
        </svg>
    );
}

/**
 * Grille du mode indices : une ligne par essai, le visage et le nom, puis
 * quatre cases.
 *
 * Deux précisions se glissent sous la valeur principale, en plus petit :
 * - le continent quand le pays est orange, sinon le joueur voit « Royaume-Uni »
 *   en orange sans savoir ce qui est commun ;
 * - la discipline du titre, parce que « champion du monde » en crew et en solo
 *   ne racontent pas la même carrière.
 *
 * La ligne qui vient d'être jouée se pose case par case (`dle-reveal`) ; les
 * lignes déjà là ne rejouent rien au rechargement. La ligne gagnante garde une
 * respiration (`dle-win`) le temps que la fiche de réponse s'ouvre.
 */
export default function CluesGrid({ language, t, guesses, revealIndex }) {
    if (guesses.length === 0) return null;

    const headings = {
        guess: t('beatboxdle.clues.guess'),
        country: t('beatboxdle.clues.country'),
        gender: t('beatboxdle.clues.gender'),
        firstYear: t('beatboxdle.clues.firstYear'),
        title: t('beatboxdle.clues.title'),
    };

    const stateLabels = {
        correct: t('beatboxdle.states.correct'),
        present: t('beatboxdle.states.present'),
        absent: t('beatboxdle.states.absent'),
    };

    // Valeur principale et précision secondaire de chaque case
    const render = (field, cell) => {
        if (field === 'country') {
            return {
                main: countryName(language, cell.code) || '—',
                // Le continent n'a d'intérêt que sur l'orange : sur un vert il
                // est redondant, sur un gris il serait faux de le souligner.
                hint: cell.state === 'present' ? continentName(t, cell.continent) : null,
            };
        }
        if (field === 'gender') return { main: genderName(t, cell.value) || '—', hint: null };
        if (field === 'firstYear') return { main: cell.value != null ? String(cell.value) : '—', hint: null };
        return { main: titleShortName(t, cell.id) || '—', hint: categoryName(t, cell.discipline) };
    };

    const columns = 'minmax(0, 1fr) repeat(4, minmax(0, 4.25rem))';

    return (
        <div className="flex flex-col gap-2">
            <div
                className="grid items-end gap-1.5 border-b border-site-line pb-2"
                style={{ gridTemplateColumns: columns }}
            >
                <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-site-muted">
                    {headings.guess}
                </span>
                {FIELDS.map((field) => (
                    <span key={field} className="text-center text-[0.625rem] font-semibold leading-tight text-site-muted">
                        {headings[field]}
                    </span>
                ))}
            </div>

            {/* Le plus récent en haut : c'est l'essai que le joueur vient de faire */}
            {guesses.map((guess, index) => ({ guess, index })).reverse().map(({ guess, index }) => {
                const animate = index === revealIndex;

                return (
                    <div
                        key={`${guess.guess.slug}-${index}`}
                        className={`grid items-stretch gap-1.5 ${animate && guess.correct ? 'dle-win' : ''}`}
                        style={{ gridTemplateColumns: columns }}
                    >
                        <span className="flex items-center gap-2 pr-1">
                            <GuessAvatar name={guess.guess.name} photo={guess.guess.photo} />
                            <span className="min-w-0 break-words text-sm font-semibold leading-tight text-site-ink">
                                {guess.guess.name}
                            </span>
                        </span>
                        {FIELDS.map((field, cellIndex) => {
                            const cell = guess.result[field];
                            const { main, hint } = render(field, cell);
                            const directionLabel = cell.direction ? t(`beatboxdle.clues.${cell.direction}`) : '';

                            return (
                                <span
                                    key={field}
                                    aria-label={`${headings[field]} : ${main}${hint ? `, ${hint}` : ''}, ${stateLabels[cell.state]}${directionLabel ? `, ${directionLabel}` : ''}`}
                                    style={animate ? { '--dle-index': cellIndex } : undefined}
                                    className={`flex min-h-[4rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-center leading-tight ${STATE_CLASS[cell.state]} ${animate ? 'dle-reveal' : ''}`}
                                >
                                    <span aria-hidden="true" className="text-[0.6875rem] font-bold">{main}</span>
                                    {hint ? (
                                        <span aria-hidden="true" className="text-[0.5625rem] font-medium opacity-75">{hint}</span>
                                    ) : null}
                                    <Arrow direction={cell.direction} label={directionLabel} />
                                </span>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}