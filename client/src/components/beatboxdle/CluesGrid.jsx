import React from 'react';
import GuessAvatar from './GuessAvatar';
import { continentName, countryName, categoryName, genderName, titlePlace, titleShortName } from '../../utils/beatboxdleLabels';

const STATE_CLASS = {
    correct: 'bg-dle-correct text-dle-correct-ink',
    present: 'bg-dle-present text-dle-present-ink',
    absent: 'bg-dle-absent text-dle-absent-ink',
};

// Ordre des colonnes, partagé avec compareClues côté serveur
const FIELDS = ['country', 'gender', 'firstYear', 'title'];

/**
 * Quatre verts sans victoire : la proposition a exactement le profil de la
 * réponse. Sans signal, le joueur croit avoir gagné et ne comprend pas le refus.
 */
const isTwin = (guess) => !guess.correct && FIELDS.every((field) => guess.result[field].state === 'correct');

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
 * - le lieu et la discipline du titre : « champion national » ne dit rien sans
 *   le pays, et « champion du monde » en crew et en solo ne racontent pas la
 *   même carrière.
 *
 * Une ligne aux quatre verts qui n'est pas la réponse est un sosie : les cases
 * restent vertes (elles disent vrai), mais le nom est barré et un bandeau
 * explique qu'un autre beatboxer partage ce profil.
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
        const hint = [titlePlace(t, language, cell), categoryName(t, cell.discipline)].filter(Boolean).join(' · ');
        return { main: titleShortName(t, cell) || '—', hint: hint || null };
    };

    // Téléphone : le nom passe sur sa propre ligne au-dessus des quatre cases,
    // sinon la colonne du nom fait 20 px et les noms se cassent lettre par lettre.
    // À partir de 640 px, le nom reprend sa colonne à gauche.
    const columns = 'grid-cols-[repeat(4,minmax(0,1fr))] sm:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,4.25rem))]';

    return (
        <div className="flex flex-col gap-2">
            <div className={`grid items-end gap-1.5 border-b border-site-line pb-2 ${columns}`}>
                <span className="hidden text-[0.625rem] font-semibold uppercase tracking-wide text-site-muted sm:block">
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
                const twin = isTwin(guess);

                return (
                    <div
                        key={`${guess.guess.slug}-${index}`}
                        className={`grid items-stretch gap-1.5 ${columns} ${animate && guess.correct ? 'dle-win' : ''}`}
                    >
                        <span className="col-span-4 flex items-center gap-2 pr-1 sm:col-span-1">
                            <GuessAvatar name={guess.guess.name} photo={guess.guess.photo} />
                            <span
                                className={`min-w-0 break-words text-sm font-semibold leading-tight ${twin
                                    ? 'text-site-muted line-through decoration-2'
                                    : 'text-site-ink'}`}
                            >
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
                                    className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-center leading-tight sm:min-h-[4rem] ${STATE_CLASS[cell.state]} ${animate ? 'dle-reveal' : ''}`}
                                >
                                    <span aria-hidden="true" className="text-[0.6875rem] font-bold">{main}</span>
                                    {hint ? (
                                        <span aria-hidden="true" className="text-[0.5625rem] font-medium opacity-75">{hint}</span>
                                    ) : null}
                                    <Arrow direction={cell.direction} label={directionLabel} />
                                </span>
                            );
                        })}
                        {twin && (
                            <p
                                role="status"
                                style={{ gridColumn: '1 / -1', ...(animate ? { '--dle-index': FIELDS.length } : {}) }}
                                className={`flex items-center gap-2 rounded-lg border border-dashed border-brand-yellow px-3 py-2 text-xs font-semibold leading-snug text-site-ink ${animate ? 'dle-reveal' : ''}`}
                            >
                                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0 text-brand-yellow">
                                    <path d="M2 5 H12 M2 9 H12 M9.5 2 L4.5 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                </svg>
                                {guess.twins > 1
                                    ? t('beatboxdle.clues.twinCount', { count: guess.twins })
                                    : t('beatboxdle.clues.twin')}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}