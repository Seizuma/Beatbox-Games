import React, { useEffect, useRef } from 'react';

// Exemple du mode lettres : un mot de cinq lettres, un état de chaque sorte.
// Aucun lien avec l'énigme du jour, pour ne rien souffler.
const EXAMPLE = [
    { letter: 'B', state: 'correct' },
    { letter: 'E', state: 'absent' },
    { letter: 'A', state: 'present' },
    { letter: 'T', state: 'absent' },
    { letter: 'S', state: 'absent' },
];

const TILE = {
    correct: 'bg-dle-correct text-dle-correct-ink',
    present: 'bg-dle-present text-dle-present-ink',
    absent: 'bg-dle-absent text-dle-absent-ink',
};

const INTRO_KEY = 'beatboxdle:v1:intro';

/** La fenêtre d'exemple s'ouvre seule la première fois, pour chaque mode. */
export function shouldShowIntro(mode) {
    try {
        return localStorage.getItem(`${INTRO_KEY}:${mode}`) !== '1';
    } catch (error) {
        return false;
    }
}

export function markIntroSeen(mode) {
    try {
        localStorage.setItem(`${INTRO_KEY}:${mode}`, '1');
    } catch (error) {
        // Navigation privée : la fenêtre reviendra, ce n'est pas grave
    }
}

/**
 * Comment jouer, avec un exemple plutôt qu'un paragraphe : au premier passage,
 * le sens du vert et de l'orange doit être clair avant le premier essai.
 */
export default function IntroModal({ mode, t, onClose }) {
    const startRef = useRef(null);

    useEffect(() => {
        startRef.current?.focus();
        const onKey = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <button
                type="button"
                aria-label={t('common.close')}
                onClick={onClose}
                className="dle-backdrop absolute inset-0 bg-black/70"
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="dle-intro-title"
                className="dle-modal relative flex max-h-[90vh] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-t-2xl border border-site-line bg-site-surface p-6 sm:rounded-2xl"
            >
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-brand-yellow">
                        {t(`beatboxdle.modes.${mode}`)}
                    </span>
                    <h2 id="dle-intro-title" className="text-2xl font-bold leading-tight text-site-ink">
                        {t('beatboxdle.intro.title')}
                    </h2>
                </div>

                <p className="text-sm leading-relaxed text-site-muted">
                    {mode === 'letters' ? t('beatboxdle.introLetters') : t('beatboxdle.introClues')}
                </p>

                {mode === 'letters' ? (
                    <div className="flex flex-col gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-site-muted">{t('beatboxdle.intro.example')}</span>
                        <div className="flex gap-1.5" aria-hidden="true">
                            {EXAMPLE.map(({ letter, state }) => (
                                <span key={letter} className={`flex h-11 w-11 items-center justify-center rounded-md text-lg font-bold ${TILE[state]}`}>
                                    {letter}
                                </span>
                            ))}
                        </div>
                        <ul className="flex flex-col gap-2 text-sm text-site-ink">
                            <li className="flex items-center gap-2">
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-sm font-bold ${TILE.correct}`}>B</span>
                                {t('beatboxdle.intro.lettersCorrect')}
                            </li>
                            <li className="flex items-center gap-2">
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-sm font-bold ${TILE.present}`}>A</span>
                                {t('beatboxdle.intro.lettersPresent')}
                            </li>
                            <li className="flex items-center gap-2">
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-sm font-bold ${TILE.absent}`}>E</span>
                                {t('beatboxdle.intro.lettersAbsent')}
                            </li>
                        </ul>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <ul className="flex flex-col gap-2 text-sm text-site-ink">
                            <li className="flex items-center gap-2">
                                <span className={`h-5 w-5 shrink-0 rounded ${TILE.correct}`} aria-hidden="true" />
                                {t('beatboxdle.intro.cluesCorrect')}
                            </li>
                            <li className="flex items-center gap-2">
                                <span className={`h-5 w-5 shrink-0 rounded ${TILE.present}`} aria-hidden="true" />
                                {t('beatboxdle.intro.cluesPresent')}
                            </li>
                            <li className="flex items-center gap-2">
                                <svg width="20" height="20" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0 text-site-muted">
                                    <path d="M6 2 L10.5 9 L1.5 9 Z" fill="currentColor" />
                                </svg>
                                {t('beatboxdle.intro.cluesArrow')}
                            </li>
                        </ul>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 border-t border-site-line pt-3 text-sm leading-relaxed text-site-muted">
                            {['country', 'gender', 'firstYear', 'title'].map((field) => (
                                <React.Fragment key={field}>
                                    <dt className="font-semibold text-site-ink">{t(`beatboxdle.clues.${field}`)}</dt>
                                    <dd>{t(`beatboxdle.rules.${field}`)}</dd>
                                </React.Fragment>
                            ))}
                        </dl>
                        <p className="text-sm leading-relaxed text-site-muted">{t('beatboxdle.rules.twin')}</p>
                    </div>
                )}

                <button
                    ref={startRef}
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-lg bg-brand-yellow px-5 py-3.5 text-base font-bold text-brand-ink transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-site-ink focus-visible:ring-offset-2 focus-visible:ring-offset-site-surface"
                >
                    {t('beatboxdle.intro.start')}
                </button>
            </div>
        </div>
    );
}
