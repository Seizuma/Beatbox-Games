import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import SEO from './components/SEO';
import SiteShell from './components/site/SiteShell';
import BeatboxdleInput from './components/beatboxdle/BeatboxdleInput';
import LettersGrid from './components/beatboxdle/LettersGrid';
import CluesGrid from './components/beatboxdle/CluesGrid';
import ResultModal from './components/beatboxdle/ResultModal';
import { useSiteI18n } from './utils/siteI18n';
import { fetchDaily, submitGuess, reportResult } from './utils/beatboxdleApi';
import { loadGame, saveGame, purgeOldGames } from './utils/beatboxdleStorage';

const MODES = ['letters', 'clues'];

// La fiche de réponse attend la fin de la révélation : quatre cases à 160 ms
// d'écart plus 520 ms d'animation. L'ouvrir plus tôt masque le dernier essai.
const REVEAL_TOTAL_MS = 1260;

/** Jauge d'essais : des pastilles valent mieux qu'un « 5 essais restants » en gris. */
function AttemptPips({ used, total, label }) {
    return (
        <span className="flex items-center gap-1.5" role="img" aria-label={label}>
            {Array.from({ length: total }, (_, index) => (
                <span
                    key={index}
                    className={`h-2 w-2 rounded-full ${index < used ? 'bg-site-line' : 'bg-brand-yellow'}`}
                />
            ))}
        </span>
    );
}

function BeatboxdleContent() {
    const { t, language } = useSiteI18n();
    const { mode } = useParams();

    const [status, setStatus] = useState('loading');
    const [errorCode, setErrorCode] = useState(null);
    const [revealIndex, setRevealIndex] = useState(-1);
    const [puzzle, setPuzzle] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [guesses, setGuesses] = useState([]);
    const [draft, setDraft] = useState('');
    const [notice, setNotice] = useState('');
    const [sending, setSending] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    // Le compte-rendu au serveur ne part qu'une fois par jour et par mode
    const reportedRef = useRef(false);

    // --- Chargement de l'énigme, et reprise de la partie en cours -----------
    useEffect(() => {
        const controller = new AbortController();
        setStatus('loading');
        setNotice('');
        setErrorCode(null);
        setRevealIndex(-1);
        setModalOpen(false);
        setDraft('');
        reportedRef.current = false;

        fetchDaily(mode, controller.signal)
            .then((payload) => {
                const saved = loadGame(mode, payload.puzzle.date, payload.puzzle.puzzleNumber, payload.puzzle.reroll);
                setPuzzle(payload.puzzle);
                setCandidates(payload.candidates || []);
                setGuesses(saved ? saved.guesses : []);
                reportedRef.current = Boolean(saved && saved.reported);
                setStatus('ready');
                purgeOldGames(payload.puzzle.date);
            })
            .catch((error) => {
                if (error.name === 'AbortError') return;
                // Le code HTTP reste affiché : 503 = base absente du conteneur,
                // 404 = route non montée (serveur pas redéployé). Sans lui, les
                // deux pannes se ressemblent et on cherche au mauvais endroit.
                setErrorCode(error.status || 0);
                setStatus('error');
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
            reroll: puzzle.reroll,
            guesses,
            reported: reportedRef.current,
        });
    }, [mode, puzzle, guesses]);

    // --- Compte-rendu au serveur une fois la partie finie -------------------
    useEffect(() => {
        if (!finished || !puzzle || reportedRef.current) return;
        reportedRef.current = true;
        saveGame(mode, puzzle.date, {
            puzzleNumber: puzzle.puzzleNumber,
            reroll: puzzle.reroll,
            guesses,
            reported: true,
        });
        reportResult({ mode, solved, attempts: guesses.length });
    }, [finished, solved, guesses, mode, puzzle]);

    // --- Ouverture de la fiche, une fois la dernière ligne posée ------------
    useEffect(() => {
        if (!finished) return undefined;
        // Reprise d'une partie déjà terminée : pas d'animation, donc pas d'attente
        const delay = revealIndex >= 0 ? REVEAL_TOTAL_MS : 0;
        const timer = setTimeout(() => setModalOpen(true), delay);
        return () => clearTimeout(timer);
    }, [finished, revealIndex]);

    const play = useCallback(async () => {
        const value = draft.trim();
        if (!value || sending || finished || !puzzle) return;

        setSending(true);
        setNotice('');

        try {
            const payload = await submitGuess({ mode, guess: value, attempt: guesses.length + 1 });
            // Seule la ligne qui arrive s'anime : au rechargement, les essais
            // déjà joués se reposent sans rejouer toute la séquence.
            setRevealIndex(guesses.length);
            setGuesses((previous) => [...previous, payload]);
            setDraft('');
        } catch (error) {
            // Un nom hors liste ne consomme pas d'essai : on le dit et on laisse la saisie
            setNotice(error.unknown ? error.message : t('beatboxdle.play.serverError'));
        } finally {
            setSending(false);
        }
    }, [draft, sending, finished, puzzle, mode, guesses.length, t]);

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

            <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
                <div>
                    <Link
                        to="/beatboxdle"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-site-muted transition hover:text-site-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-site-ink"
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                            <path d="M8.5 2 L3.5 7 L8.5 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {t('beatboxdle.backToModes')}
                    </Link>
                </div>

                <header className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-2xl font-bold leading-none tracking-tight text-site-ink sm:text-3xl">
                        {t(`beatboxdle.modes.${mode}`)}
                    </h1>
                    {puzzle && (
                        <span className="rounded-full border border-brand-yellow px-3 py-1 text-xs font-bold text-brand-yellow">
                            {t('beatboxdle.number', { number: puzzle.puzzleNumber })}
                        </span>
                    )}
                </header>

                {/* Les règles se replient : la grille doit être la première chose
                    qu'on voit, pas un paragraphe explicatif. */}
                <details className="group">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-site-muted transition hover:text-site-ink">
                        {t('beatboxdle.howTo')}
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-site-muted">
                        {mode === 'letters' ? t('beatboxdle.introLetters') : t('beatboxdle.introClues')}
                    </p>
                </details>

                {status === 'loading' && (
                    <p className="py-10 text-center text-sm text-site-muted">{t('common.loading')}</p>
                )}

                {status === 'error' && (
                    <div className="flex flex-col gap-1 rounded-xl border border-site-line bg-site-surface p-5">
                        <p className="text-sm text-site-muted">{t('beatboxdle.unavailable')}</p>
                        {errorCode ? (
                            <p className="text-xs text-site-soft">{t('beatboxdle.errorCode', { code: errorCode })}</p>
                        ) : null}
                    </div>
                )}

                {status === 'ready' && puzzle && (
                    <>
                        {/* Le plateau : un objet à part, pas du texte de page */}
                        <section className="flex flex-col gap-4 rounded-2xl border border-site-line bg-site-surface p-4 sm:p-5">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold uppercase tracking-wide text-site-muted">
                                    {t('beatboxdle.play.left', { count: Math.max(0, puzzle.maxAttempts - guesses.length) })}
                                </span>
                                <AttemptPips
                                    used={guesses.length}
                                    total={puzzle.maxAttempts}
                                    label={t('beatboxdle.play.left', { count: Math.max(0, puzzle.maxAttempts - guesses.length) })}
                                />
                            </div>

                            {mode === 'letters' ? (
                                <LettersGrid
                                    length={puzzle.length}
                                    maxAttempts={puzzle.maxAttempts}
                                    guesses={guesses}
                                    stateLabels={stateLabels}
                                    revealIndex={revealIndex}
                                />
                            ) : (
                                <CluesGrid
                                    language={language}
                                    t={t}
                                    guesses={guesses}
                                    revealIndex={revealIndex}
                                />
                            )}

                            {!finished ? (
                                <div className="flex flex-col gap-2 border-t border-site-line pt-4">
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
                                </div>
                            ) : (
                                <div className="flex items-center justify-between gap-3 border-t border-site-line pt-4">
                                    <span className="text-sm font-semibold text-site-ink">
                                        {solved ? t('beatboxdle.play.solved') : t('beatboxdle.play.done')}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setModalOpen(true)}
                                        className="rounded-lg bg-brand-yellow px-4 py-2.5 text-sm font-bold text-brand-ink transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-site-ink"
                                    >
                                        {t('beatboxdle.play.seeAnswer')}
                                    </button>
                                </div>
                            )}
                        </section>

                        {!finished && (
                            <p className="text-center text-xs text-site-soft">
                                {t('beatboxdle.play.pool', { count: candidates.length })}
                            </p>
                        )}
                    </>
                )}
            </div>

            {modalOpen && finished && answer && puzzle && (
                <ResultModal
                    t={t}
                    language={language}
                    answer={answer}
                    solved={solved}
                    guesses={guesses}
                    puzzle={puzzle}
                    mode={mode}
                    modeLabel={modeLabel}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </>
    );
}

/** Une partie de Beatboxdle. Un mode inconnu dans l'URL renvoie au menu. */
export default function BeatboxdleGame() {
    const { mode } = useParams();
    if (!MODES.includes(mode)) return <Navigate to="/beatboxdle" replace />;

    return (
        <SiteShell>
            <BeatboxdleContent />
        </SiteShell>
    );
}
