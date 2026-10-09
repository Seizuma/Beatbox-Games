import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import SEO from './components/SEO';
import SiteShell from './components/site/SiteShell';
import LettersGrid from './components/beatboxdle/LettersGrid';
import CluesGrid from './components/beatboxdle/CluesGrid';
import ResultModal from './components/beatboxdle/ResultModal';
import BeatboxdleKeyboard from './components/beatboxdle/BeatboxdleKeyboard';
import IntroModal, { markIntroSeen, shouldShowIntro } from './components/beatboxdle/IntroModal';
import { useSiteI18n } from './utils/siteI18n';
import { fetchDaily, submitGuess, reportResult } from './utils/beatboxdleApi';
import { loadGame, saveGame, purgeOldGames } from './utils/beatboxdleStorage';
import { buildKeyIndex, exactMatches, letterStates, suggest, toKeys } from './utils/beatboxdleMatch';
import { liveStreak, recordLocalResult, useBeatboxdleStats } from './utils/beatboxdleHistory';

const MODES = ['letters', 'clues'];

// La fiche de réponse attend la fin de la révélation : quatre cases à 160 ms
// d'écart plus 520 ms d'animation. L'ouvrir plus tôt masque le dernier essai.
const REVEAL_TOTAL_MS = 1260;

const MAX_SUGGESTIONS = 8;

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

// Une modale ouverte ou un champ de saisie actif garde ses propres touches
const isTypingElsewhere = (target) => {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
};

function BeatboxdleContent() {
    const { t, language } = useSiteI18n();
    const { mode } = useParams();

    const [status, setStatus] = useState('loading');
    const [errorCode, setErrorCode] = useState(null);
    const [revealIndex, setRevealIndex] = useState(-1);
    const [puzzle, setPuzzle] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [guesses, setGuesses] = useState([]);
    // Saisie au clavier du jeu : les touches tapées, et le nom choisi dans les propositions
    const [typed, setTyped] = useState('');
    const [picked, setPicked] = useState(null);
    const [notice, setNotice] = useState('');
    const [sending, setSending] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [introOpen, setIntroOpen] = useState(false);

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
        setTyped('');
        setPicked(null);
        reportedRef.current = false;

        fetchDaily(mode, controller.signal)
            .then((payload) => {
                const saved = loadGame(mode, payload.puzzle.date, payload.puzzle.puzzleNumber, payload.puzzle.reroll);
                setPuzzle(payload.puzzle);
                setCandidates(payload.candidates || []);
                setGuesses(saved ? saved.guesses : []);
                reportedRef.current = Boolean(saved && saved.reported);
                // Partie finie avant l'arrivée de l'historique local : on la note quand même
                if (saved && saved.guesses.some((guess) => guess.finished)) {
                    recordLocalResult(mode, payload.puzzle.puzzleNumber, saved.guesses.some((guess) => guess.correct), saved.guesses.length);
                }
                setStatus('ready');
                purgeOldGames(payload.puzzle.date);
                // Première visite dans ce mode : l'exemple avant le premier essai
                if (!saved && shouldShowIntro(mode)) setIntroOpen(true);
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

    // --- Compte-rendu une fois la partie finie : navigateur, puis serveur ---
    const [statsKey, setStatsKey] = useState(0);
    useEffect(() => {
        if (!finished || !puzzle) return;
        recordLocalResult(mode, puzzle.puzzleNumber, solved, guesses.length);
        setStatsKey((key) => key + 1);
        if (reportedRef.current) return;
        reportedRef.current = true;
        saveGame(mode, puzzle.date, {
            puzzleNumber: puzzle.puzzleNumber,
            reroll: puzzle.reroll,
            guesses,
            reported: true,
        });
        // Le compte Discord reçoit la partie ; ses statistiques sont relues ensuite
        reportResult({ mode, solved, attempts: guesses.length }).then(() => setStatsKey((key) => key + 1));
    }, [finished, solved, guesses, mode, puzzle]);

    const stats = useBeatboxdleStats(mode, statsKey);

    // --- Ouverture de la fiche, une fois la dernière ligne posée ------------
    useEffect(() => {
        if (!finished) return undefined;
        // Reprise d'une partie déjà terminée : pas d'animation, donc pas d'attente
        const delay = revealIndex >= 0 ? REVEAL_TOTAL_MS : 0;
        const timer = setTimeout(() => setModalOpen(true), delay);
        return () => clearTimeout(timer);
    }, [finished, revealIndex]);

    // --- Saisie ---------------------------------------------------------------
    const isLetters = mode === 'letters';
    const maxLength = isLetters && puzzle ? puzzle.length : 40;
    const keyIndex = useMemo(() => buildKeyIndex(candidates, !isLetters), [candidates, isLetters]);
    const suggestions = useMemo(() => {
        const list = suggest(typed, keyIndex, MAX_SUGGESTIONS);
        // Le nom choisi reste en tête, même s'il ne sort plus dans les premiers
        return picked ? [picked, ...list.filter((name) => name !== picked)] : list;
    }, [typed, keyIndex, picked]);
    const states = useMemo(() => (isLetters ? letterStates(guesses) : {}), [isLetters, guesses]);

    const canEnter = isLetters ? typed.length === maxLength : Boolean(picked || typed);
    const locked = sending || finished || status !== 'ready';

    const typeKey = useCallback((key) => {
        if (locked) return;
        setNotice('');
        setPicked(null);
        setTyped((current) => (current.length >= maxLength ? current : current + key));
    }, [locked, maxLength]);

    const erase = useCallback(() => {
        if (locked) return;
        setNotice('');
        setPicked(null);
        setTyped((current) => current.slice(0, -1));
    }, [locked]);

    const pick = useCallback((name) => {
        if (locked) return;
        setNotice('');
        setPicked(name);
        setTyped(toKeys(name, !isLetters).slice(0, maxLength));
    }, [locked, isLetters, maxLength]);

    // Ce que la saisie désigne : le nom choisi, sinon le seul nom qui s'écrit ainsi
    const resolveGuess = useCallback(() => {
        if (picked) return picked;
        const exact = exactMatches(typed, keyIndex);
        if (isLetters) {
            // En mode lettres, deux graphies des mêmes lettres donnent le même résultat
            if (exact.length > 0) return exact[0];
            setNotice(t('beatboxdle.play.noMatch'));
            return null;
        }
        if (exact.length === 1) return exact[0];
        setNotice(exact.length > 1 || suggestions.length > 0 ? t('beatboxdle.play.pickOne') : t('beatboxdle.play.noMatch'));
        return null;
    }, [picked, typed, keyIndex, isLetters, suggestions.length, t]);

    const play = useCallback(async () => {
        if (locked || !puzzle || !canEnter) return;
        const value = resolveGuess();
        if (!value) return;

        setSending(true);
        setNotice('');

        try {
            const payload = await submitGuess({ mode, guess: value, attempt: guesses.length + 1 });
            // Seule la ligne qui arrive s'anime : au rechargement, les essais
            // déjà joués se reposent sans rejouer toute la séquence.
            setRevealIndex(guesses.length);
            setGuesses((previous) => [...previous, payload]);
            setTyped('');
            setPicked(null);
        } catch (error) {
            // Un nom hors liste ne consomme pas d'essai : on le dit et on laisse la saisie
            setNotice(error.unknown ? error.message : t('beatboxdle.play.serverError'));
        } finally {
            setSending(false);
        }
    }, [locked, puzzle, canEnter, resolveGuess, mode, guesses.length, t]);

    // Clavier physique : sur ordinateur, on tape directement, comme sur Wordle
    useEffect(() => {
        if (status !== 'ready' || finished || introOpen || modalOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.ctrlKey || event.metaKey || event.altKey || isTypingElsewhere(event.target)) return;
            if (event.key === 'Enter') {
                event.preventDefault();
                play();
            } else if (event.key === 'Backspace') {
                event.preventDefault();
                erase();
            } else if (event.key.length === 1) {
                const key = toKeys(event.key, !isLetters);
                if (key) {
                    event.preventDefault();
                    typeKey(key);
                }
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [status, finished, introOpen, modalOpen, play, erase, typeKey, isLetters]);

    const closeIntro = useCallback(() => {
        markIntroSeen(mode);
        setIntroOpen(false);
    }, [mode]);

    const modeLabel = t(`beatboxdle.modes.${mode}`);

    const stateLabels = {
        correct: t('beatboxdle.states.correct'),
        present: t('beatboxdle.states.present'),
        absent: t('beatboxdle.states.absent'),
    };

    const keyboardLabels = {
        keyboard: t('beatboxdle.play.keyboard'),
        enter: t('beatboxdle.play.enter'),
        backspace: t('beatboxdle.play.backspace'),
        digits: t('beatboxdle.play.digits'),
        letters: t('beatboxdle.play.letters'),
        digitsLabel: t('beatboxdle.play.digitsLabel'),
        lettersLabel: t('beatboxdle.play.lettersLabel'),
        suggestions: t('beatboxdle.play.suggestions'),
        states: stateLabels,
    };

    const hint = isLetters ? t('beatboxdle.play.hintLetters') : t('beatboxdle.play.hintClues');
    const attemptsLeft = puzzle ? Math.max(0, puzzle.maxAttempts - guesses.length) : 0;

    return (
        <>
            <SEO
                title={t('beatboxdle.seoTitle')}
                description={t('beatboxdle.seoDescription')}
                url="https://beatboxgames.com/beatboxdle"
            />

            {/* Page de jeu : pas d'onglets ni de pied de page, le clavier occupe le bas de l'écran */}
            <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-xl flex-col px-4 pt-3 sm:px-6 sm:pt-6">
                <header className="flex items-center gap-3">
                    <Link
                        to="/beatboxdle"
                        aria-label={t('beatboxdle.backToModes')}
                        className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-site-muted transition hover:text-site-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-site-ink"
                    >
                        <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true">
                            <path d="M8.5 2 L3.5 7 L8.5 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </Link>
                    <h1 className="min-w-0 flex-1 truncate text-2xl font-bold leading-none tracking-tight text-site-ink sm:text-3xl">
                        {modeLabel}
                    </h1>
                    {puzzle && (
                        <span className="shrink-0 rounded-full border border-brand-yellow px-3 py-1 text-xs font-bold text-brand-yellow">
                            {t('beatboxdle.number', { number: puzzle.puzzleNumber })}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => setIntroOpen(true)}
                        aria-label={t('beatboxdle.howTo')}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-site-line text-base font-bold text-site-muted transition hover:text-site-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-site-ink"
                    >
                        ?
                    </button>
                </header>

                {status === 'loading' && (
                    <p className="py-10 text-center text-sm text-site-muted">{t('common.loading')}</p>
                )}

                {status === 'error' && (
                    <div className="mt-4 flex flex-col gap-1 rounded-xl border border-site-line bg-site-surface p-5">
                        <p className="text-sm text-site-muted">{t('beatboxdle.unavailable')}</p>
                        {errorCode ? (
                            <p className="text-xs text-site-soft">{t('beatboxdle.errorCode', { code: errorCode })}</p>
                        ) : null}
                    </div>
                )}

                {status === 'ready' && puzzle && (
                    <>
                        <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold uppercase tracking-wide text-site-muted">
                                {t('beatboxdle.play.left', { count: attemptsLeft })}
                            </span>
                            <AttemptPips
                                used={guesses.length}
                                total={puzzle.maxAttempts}
                                label={t('beatboxdle.play.left', { count: attemptsLeft })}
                            />
                        </div>

                        {/* Le plateau : la grille reste à l'écran pendant toute la saisie */}
                        <section className="mt-3 flex-1">
                            {isLetters ? (
                                <LettersGrid
                                    length={puzzle.length}
                                    maxAttempts={puzzle.maxAttempts}
                                    guesses={guesses}
                                    stateLabels={stateLabels}
                                    revealIndex={revealIndex}
                                    draft={finished ? '' : typed}
                                />
                            ) : (
                                <CluesGrid
                                    language={language}
                                    t={t}
                                    guesses={guesses}
                                    revealIndex={revealIndex}
                                />
                            )}
                            {!isLetters && guesses.length === 0 && !finished && (
                                <p className="py-6 text-center text-sm text-site-muted">
                                    {t('beatboxdle.play.pool', { count: candidates.length })}
                                </p>
                            )}
                        </section>

                        {!finished ? (
                            <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-site-line bg-site-paper px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:-mx-6 sm:px-6">
                                {/* Une seule ligne d'état : l'erreur, sinon la saisie en cours (mode indices), sinon la consigne */}
                                <p
                                    id="beatboxdle-notice"
                                    role="status"
                                    aria-label={!notice && !isLetters && (picked || typed) ? `${t('beatboxdle.play.typed')} : ${picked || typed}` : undefined}
                                    className={`flex min-h-[1.5rem] items-center justify-center text-center ${notice
                                        ? 'text-xs font-semibold text-site-danger'
                                        : !isLetters && (picked || typed)
                                            ? 'text-base font-bold tracking-wide text-site-ink'
                                            : 'text-xs text-site-soft'}`}
                                >
                                    {notice || (!isLetters && (picked || typed)) || (typed ? '' : hint)}
                                </p>
                                <BeatboxdleKeyboard
                                    language={language}
                                    states={states}
                                    allowDigits={!isLetters}
                                    suggestions={suggestions}
                                    picked={picked}
                                    canEnter={canEnter}
                                    disabled={sending}
                                    labels={keyboardLabels}
                                    onKey={typeKey}
                                    onBackspace={erase}
                                    onEnter={play}
                                    onPick={pick}
                                />
                            </div>
                        ) : (
                            <div className="sticky bottom-0 z-20 -mx-4 mt-4 flex items-center justify-between gap-3 border-t border-site-line bg-site-paper px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:-mx-6 sm:px-6">
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
                    </>
                )}
            </div>

            {introOpen && <IntroModal mode={mode} t={t} onClose={closeIntro} />}

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
                    stats={stats}
                    streak={liveStreak(stats, puzzle.puzzleNumber)}
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
        <SiteShell variant="game">
            <BeatboxdleContent />
        </SiteShell>
    );
}
