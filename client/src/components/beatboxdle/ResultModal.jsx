import React, { useEffect, useRef, useState } from 'react';
import GuessAvatar from './GuessAvatar';
import { continentName, countryName, categoryName, titleName } from '../../utils/beatboxdleLabels';

const SQUARE = { correct: '\u{1F7E9}', present: '\u{1F7E7}', absent: '\u{2B1B}' };
const CLUE_FIELDS = ['country', 'gender', 'firstYear', 'title'];

/**
 * Texte de partage, au format que tout le monde reconnaît depuis Wordle :
 * des carrés de couleur, aucune lettre, donc aucun spoil.
 */
export function buildShareText({ puzzleNumber, mode, guesses, solved, maxAttempts, modeLabel, url }) {
    const score = solved ? guesses.length : 'X';
    const lines = guesses.map((guess) => (
        mode === 'letters'
            ? guess.result.map((cell) => SQUARE[cell.state]).join('')
            : CLUE_FIELDS.map((field) => SQUARE[guess.result[field].state]).join('')
    ));

    return [`Beatboxdle #${puzzleNumber} · ${modeLabel} ${score}/${maxAttempts}`, '', ...lines, '', url].join('\n');
}

/** Compte à rebours jusqu'à la prochaine énigme, rafraîchi à la seconde. */
function useCountdown(isoTarget) {
    const [remaining, setRemaining] = useState(() => Math.max(0, new Date(isoTarget).getTime() - Date.now()));

    useEffect(() => {
        const target = new Date(isoTarget).getTime();
        const tick = () => setRemaining(Math.max(0, target - Date.now()));
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [isoTarget]);

    const total = Math.floor(remaining / 1000);
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Une ligne de la fiche de réponse. */
function Fact({ label, value, hint }) {
    return (
        <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-site-muted">{label}</dt>
            <dd className="text-sm font-semibold text-site-ink">
                {value || '—'}
                {hint ? <span className="ml-1.5 text-xs font-normal text-site-muted">{hint}</span> : null}
            </dd>
        </div>
    );
}

/**
 * Fiche de réponse, en fenêtre plutôt qu'en bas de page.
 *
 * Une partie qui se termine mérite un temps d'arrêt : posée sous la grille, la
 * réponse passait inaperçue sur mobile, où il fallait encore faire défiler.
 * La fenêtre se ferme (Échap, la croix, le fond) et la grille reste consultable
 * derrière — on peut la rouvrir depuis le bandeau de fin.
 */
export default function ResultModal({ t, language, answer, solved, guesses, puzzle, mode, modeLabel, onClose }) {
    const [copied, setCopied] = useState(false);
    const countdown = useCountdown(puzzle.nextResetAt);
    const closeRef = useRef(null);

    // Le focus entre dans la fenêtre, sinon la tabulation continue derrière
    useEffect(() => {
        if (closeRef.current) closeRef.current.focus();
    }, []);

    useEffect(() => {
        const onKey = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    useEffect(() => {
        if (!copied) return undefined;
        const timer = setTimeout(() => setCopied(false), 2500);
        return () => clearTimeout(timer);
    }, [copied]);

    const share = async () => {
        const text = buildShareText({
            puzzleNumber: puzzle.puzzleNumber,
            mode,
            guesses,
            solved,
            maxAttempts: puzzle.maxAttempts,
            modeLabel,
            url: 'https://beatboxgames.com/#/beatboxdle',
        });

        try {
            if (navigator.share) {
                await navigator.share({ text });
                return;
            }
            await navigator.clipboard.writeText(text);
            setCopied(true);
        } catch (error) {
            // Partage refusé ou presse-papiers indisponible : rien à signaler
        }
    };

    const title = answer.bestTitle ? titleName(t, answer.bestTitle.id) : null;
    const discipline = answer.bestTitle ? categoryName(t, answer.bestTitle.discipline) : null;

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
                aria-labelledby="dle-result-title"
                className="dle-modal relative flex max-h-[90vh] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-t-2xl border border-site-line bg-site-surface p-6 sm:rounded-2xl"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-brand-yellow">
                            {t('beatboxdle.meta', { number: puzzle.puzzleNumber, mode: modeLabel })}
                        </span>
                        <h2 id="dle-result-title" className="text-2xl font-bold leading-tight text-site-ink">
                            {solved
                                ? t('beatboxdle.result.win', { count: guesses.length })
                                : t('beatboxdle.result.lose')}
                        </h2>
                    </div>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        aria-label={t('common.close')}
                        className="shrink-0 rounded-lg p-2 text-site-muted transition hover:text-site-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-site-ink"
                    >
                        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                            <path d="M4 4 L14 14 M14 4 L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-site-line bg-site-tint p-4">
                    <span className={solved ? 'dle-pop' : undefined}>
                        <GuessAvatar name={answer.name} photo={answer.photo} />
                    </span>
                    <div className="flex min-w-0 flex-col">
                        <span className="text-xs text-site-muted">{t('beatboxdle.result.answerIntro')}</span>
                        <span className="truncate text-xl font-bold text-site-ink">{answer.name}</span>
                    </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Fact
                        label={t('beatboxdle.clues.country')}
                        value={countryName(language, answer.countryCode)}
                        hint={continentName(t, answer.continent)}
                    />
                    <Fact label={t('beatboxdle.clues.firstYear')} value={answer.firstYear} />
                    <div className="col-span-2">
                        <Fact label={t('beatboxdle.clues.title')} value={title} hint={discipline} />
                    </div>
                </dl>

                {answer.source && (
                    <a
                        href={answer.source}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-sm font-medium text-site-ink underline underline-offset-4"
                    >
                        {t('beatboxdle.result.profileLink')}
                    </a>
                )}

                <div className="flex flex-col gap-3 border-t border-site-line pt-5">
                    <button
                        type="button"
                        onClick={share}
                        className="w-full rounded-lg bg-brand-yellow px-5 py-3.5 text-base font-bold text-brand-ink transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-site-ink focus-visible:ring-offset-2 focus-visible:ring-offset-site-surface"
                    >
                        {copied ? t('beatboxdle.result.copied') : t('beatboxdle.result.share')}
                    </button>
                    <p className="text-center text-sm text-site-muted">
                        {t('beatboxdle.result.next')}{' '}
                        <span className="font-semibold tabular-nums text-site-ink">{countdown}</span>
                    </p>
                </div>
            </div>
        </div>
    );
}