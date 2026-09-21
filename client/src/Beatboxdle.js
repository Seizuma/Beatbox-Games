import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SEO from './components/SEO';
import SiteShell from './components/site/SiteShell';
import BeatboxdleInput from './components/beatboxdle/BeatboxdleInput';
import LettersGrid from './components/beatboxdle/LettersGrid';
import CluesGrid from './components/beatboxdle/CluesGrid';
import ResultPanel from './components/beatboxdle/ResultPanel';
import { useSiteI18n } from './utils/siteI18n';
import { fetchDaily, submitGuess, reportResult } from './utils/beatboxdleApi';
import { loadGame, saveGame, purgeOldGames } from './utils/beatboxdleStorage';

const MODES = ['letters', 'clues'];
const readMode = (value) => (MODES.includes(value) ? value : 'letters');

function BeatboxdleContent() {
    const { t } = useSiteI18n();
    const [searchParams, setSearchParams] = useSearchParams();
    const mode = readMode(searchParams.get('mode'));

    const [status, setStatus] = useState('loading');
    const [puzzle, setPuzzle] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [guesses, setGuesses] = useState([]);
    const [draft, setDraft] = useState('');
    const [notice, setNotice] = useState('');
    const [sending, setSending] = useState(false);

    // Le compte-rendu au serveur ne part qu'une fois par jour et par mode
    const reportedRef = useRef(false);

    // --- Chargement de l'énigme, et reprise de la partie en cours -----------
    useEffect(() => {
        const controller = new AbortController();
        setStatus('loading');
        setNotice('');
        setDraft('');
        reportedRef.current = false;

        fetchDaily(mode, controller.signal)
            .then((payload) => {
                const saved = loadGame(mode, payload.puzzle.date, payload.puzzle.puzzleNumber);
                setPuzzle(payload.puzzle);
                setCandidates(payload.candidates || []);
                setGuesses(saved ? saved.guesses : []);
                reportedRef.current = Boolean(saved && saved.reported);
                setStatus('ready');
                purgeOldGames(payload.puzzle.date);
            })
            .catch((error) => {
                if (error.name !== 'AbortError') setStatus('error');
            });

        return () => controller.abort();
    }, [mode]);

    const finished = useMemo(() => guesses.some((guess) => guess.finished), [guesses]);
    const solved = useMemo(() => guesses.some((guess) => guess.correct), [guesses]);
    const answer = useMemo(() => {
        const last = guesses[guesses.length - 1];
        return last && last.answer ? last.answer : null;
    }, [guesses]);

    // --- Sauvegarde locale à chaque coup ------------------------------------
    useEffect(() => {
        if (!puzzle || guesses.length === 0) return;
        saveGame(mode, puzzle.date, {
            puzzleNumber: puzzle.puzzleNumber,
            guesses,
            reported: reportedRef.current,
        });
    }, [mode, puzzle, guesses]);

    // --- Compte-rendu au serveur une fois la partie finie -------------------
    useEffect(() => {
        if (!finished || !puzzle || reportedRef.current) return;
        reportedRef.current = true;
        saveGame(mode, puzzle.date, { puzzleNumber: puzzle.puzzleNumber, guesses, reported: true });
        reportResult({ mode, solved, attempts: guesses.length });
    }, [finished, solved, guesses, mode, puzzle]);

    const play = useCallback(async () => {
        const value = draft.trim();
        if (!value || sending || finished || !puzzle) return;

        setSending(true);
        setNotice('');

        try {
            const payload = await submitGuess({ mode, guess: value, attempt: guesses.length + 1 });
            setGuesses((previous) => [...previous, payload]);
            setDraft('');
        } catch (error) {
            // Un nom hors liste ne consomme pas d'essai : on le dit et on laisse la saisie
            setNotice(error.unknown ? error.message : t('beatboxdle.play.serverError'));
        } finally {
            setSending(false);
        }
    }, [draft, sending, finished, puzzle, mode, guesses.length, t]);

    const switchMode = (next) => {
        if (next === mode) return;
        setSearchParams(next === 'letters' ? {} : { mode: next }, { replace: true });
    };

    const modeLabel = t(`beatboxdle.modes.${mode}`);

    const stateLabels = {
        correct: t('beatboxdle.states.correct'),
        present: t('beatboxdle.states.present'),
        absent: t('beatboxdle.states.absent'),
    };

    return (
        <>
            <SEO
                title={t('beatboxdle.seoTitle')}
                description={t('beatboxdle.seoDescription')}
                url="https://beatboxgames.com/beatboxdle"
            />

            <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
                <header className="flex flex-col gap-2">
                    <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-site-ink sm:text-4xl">
                        {t('beatboxdle.title')}
                    </h1>
                    <p className="text-base leading-relaxed text-site-muted">
                        {mode === 'letters' ? t('beatboxdle.introLetters') : t('beatboxdle.introClues')}
                    </p>
                </header>

                <div role="tablist" aria-label={t('beatboxdle.modeLabel')} className="flex gap-1 rounded-lg border border-site-line p-1">
                    {MODES.map((candidate) => (
                        <button
                            key={candidate}
                            type="button"
                            role="tab"
                            aria-selected={candidate === mode}
                            onClick={() => switchMode(candidate)}
                            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-site-ink ${
                                candidate === mode
                                    ? 'bg-site-button text-site-on-button'
                                    : 'text-site-muted hover:text-site-ink'
                            }`}
                        >
                            {t(`beatboxdle.modes.${candidate}`)}
                        </button>
                    ))}
                </div>

                {status === 'loading' && (
                    <p className="py-8 text-center text-sm text-site-muted">{t('common.loading')}</p>
                )}

                {status === 'error' && (
                    <p className="rounded-lg border border-site-line bg-site-surface p-5 text-sm text-site-muted">
                        {t('beatboxdle.unavailable')}
                    </p>
                )}

                {status === 'ready' && puzzle && (
                    <>
                        <p className="flex flex-wrap items-baseline justify-between gap-2 border-b border-site-line pb-3 text-sm text-site-muted">
                            <span>
                                {t('beatboxdle.meta', { number: puzzle.puzzleNumber, mode: modeLabel })}
                            </span>
                            <span>
                                {finished
                                    ? t('beatboxdle.play.done')
                                    : t('beatboxdle.play.left', { count: puzzle.maxAttempts - guesses.length })}
                            </span>
                        </p>

                        {mode === 'letters' ? (
                            <LettersGrid
                                length={puzzle.length}
                                maxAttempts={puzzle.maxAttempts}
                                guesses={guesses}
                                stateLabels={stateLabels}
                            />
                        ) : (
                            <CluesGrid
                                guesses={guesses}
                                stateLabels={stateLabels}
                                headings={{
                                    guess: t('beatboxdle.clues.guess'),
                                    country: t('beatboxdle.clues.country'),
                                    gender: t('beatboxdle.clues.gender'),
                                    firstYear: t('beatboxdle.clues.firstYear'),
                                    title: t('beatboxdle.clues.title'),
                                }}
                                directionLabels={{
                                    up: t('beatboxdle.clues.up'),
                                    down: t('beatboxdle.clues.down'),
                                }}
                                genderLabels={{ M: t('beatboxdle.clues.male'), F: t('beatboxdle.clues.female') }}
                            />
                        )}

                        {!finished && (
                            <div className="flex flex-col gap-2">
                                <BeatboxdleInput
                                    value={draft}
                                    onChange={setDraft}
                                    onSubmit={play}
                                    candidates={candidates}
                                    disabled={sending}
                                    invalid={Boolean(notice)}
                                    describedBy="beatboxdle-notice"
                                    placeholder={mode === 'letters'
                                        ? t('beatboxdle.play.placeholderLetters', { count: puzzle.length })
                                        : t('beatboxdle.play.placeholderClues')}
                                    listLabel={t('beatboxdle.play.listLabel')}
                                    submitLabel={t('beatboxdle.play.submit')}
                                />
                                <p id="beatboxdle-notice" role="status" className="min-h-[1.25rem] text-sm text-site-danger">
                                    {notice}
                                </p>
                                <p className="text-xs text-site-muted">
                                    {t('beatboxdle.play.pool', { count: candidates.length })}
                                </p>
                            </div>
                        )}

                        {finished && answer && (
                            <ResultPanel
                                t={t}
                                answer={answer}
                                solved={solved}
                                guesses={guesses}
                                puzzle={puzzle}
                                mode={mode}
                                modeLabel={modeLabel}
                            />
                        )}
                    </>
                )}
            </div>
        </>
    );
}

/** Beatboxdle : l'énigme quotidienne. Page de « la chaîne », pas du plateau. */
export default function Beatboxdle() {
    return (
        <SiteShell>
            <BeatboxdleContent />
        </SiteShell>
    );
}