import React, { useEffect, useState } from 'react';
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
        <div className="flex flex-col">
            <dt className="text-xs text-site-muted">{label}</dt>
            <dd className="font-medium text-site-ink">
                {value || '—'}
                {hint ? <span className="ml-1.5 text-xs font-normal text-site-muted">{hint}</span> : null}
            </dd>
        </div>
    );
}

/** Écran de fin : la réponse, le partage, l'attente. */
export default function ResultPanel({ t, language, answer, solved, guesses, puzzle, mode, modeLabel }) {
    const [copied, setCopied] = useState(false);
    const countdown = useCountdown(puzzle.nextResetAt);

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

        // Partage natif sur mobile, presse-papiers ailleurs
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
        <section className="flex flex-col gap-4 rounded-xl border border-site-line bg-site-surface p-5">
            <div className="flex flex-col gap-1">
                <h2 className="text-lg font-bold text-site-ink">
                    {solved
                        ? t('beatboxdle.result.win', { count: guesses.length })
                        : t('beatboxdle.result.lose')}
                </h2>
                <p className="text-sm text-site-muted">{t('beatboxdle.result.answerIntro')}</p>
            </div>

            <div className="flex flex-col gap-3 border-t border-site-line pt-4">
                <span className="text-xl font-bold text-site-ink">{answer.name}</span>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
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
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-site-line pt-4">
                <button
                    type="button"
                    onClick={share}
                    className="rounded-lg bg-site-button px-5 py-3 text-base font-semibold text-site-on-button transition hover:bg-site-button-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-site-ink focus-visible:ring-offset-2 focus-visible:ring-offset-site-surface"
                >
                    {copied ? t('beatboxdle.result.copied') : t('beatboxdle.result.share')}
                </button>
                <p className="text-sm text-site-muted">
                    {t('beatboxdle.result.next')}{' '}
                    <span className="font-semibold tabular-nums text-site-ink">{countdown}</span>
                </p>
            </div>
        </section>
    );
}