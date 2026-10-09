import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from './components/SEO';
import SiteShell from './components/site/SiteShell';
import ModeCard from './components/beatboxdle/ModeCard';
import DayLeaderboard from './components/beatboxdle/DayLeaderboard';
import { useSiteI18n } from './utils/siteI18n';
import { fetchSummary, fetchYesterday } from './utils/beatboxdleApi';
import { loadGame, purgeOldGames } from './utils/beatboxdleStorage';
import { getLocalStats, liveStreak, recordLocalResult } from './utils/beatboxdleHistory';

const MODES = ['letters', 'clues'];

/**
 * Accueil du Beatboxdle : le choix du mode.
 *
 * L'ancien sélecteur à deux onglets posé au-dessus de la grille obligeait à
 * choisir avant d'avoir rien vu, et occupait la place du plateau. Une page de
 * choix règle les deux : chaque mode se présente, et l'état du jour se lit
 * d'un coup d'œil — c'est ce qu'on vient vérifier en ouvrant la page.
 */
/** Réponses d'hier : on se rappelle qui c'était, ou on découvre celui qu'on a raté. */
function Yesterday({ t }) {
    const [modes, setModes] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        fetchYesterday(controller.signal)
            .then((payload) => setModes(payload.modes || {}))
            .catch(() => setModes(null));
        return () => controller.abort();
    }, []);

    const entries = MODES.filter((mode) => modes && modes[mode]);
    if (entries.length === 0) return null;

    return (
        <section aria-labelledby="dle-yesterday" className="flex flex-col gap-2">
            <h2 id="dle-yesterday" className="text-xs font-semibold uppercase tracking-wide text-site-muted">
                {t('beatboxdle.yesterday.title')}
            </h2>
            <ul className="flex flex-col gap-2">
                {entries.map((mode) => {
                    const entry = modes[mode];
                    return (
                        <li key={mode} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg border border-site-line px-4 py-3">
                            <span className="text-sm text-site-muted">
                                {t(`beatboxdle.modes.${mode}`)}{' · '}
                                <Link
                                    to={`/beatboxer/${encodeURIComponent(entry.answer.slug)}`}
                                    className="font-bold text-site-ink underline decoration-brand-yellow decoration-2 underline-offset-4 hover:decoration-site-ink"
                                >
                                    {entry.answer.name}
                                </Link>
                            </span>
                            {entry.players > 0 && (
                                <span className="text-xs text-site-soft">
                                    {t('beatboxdle.yesterday.found', { count: entry.solvers, total: entry.players })}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

function BeatboxdleHome() {
    const { t, language } = useSiteI18n();
    const [status, setStatus] = useState('loading');
    const [modes, setModes] = useState({});
    const [played, setPlayed] = useState({});
    const [streaks, setStreaks] = useState({});

    useEffect(() => {
        const controller = new AbortController();

        fetchSummary(controller.signal)
            .then((payload) => {
                setModes(payload.modes || {});
                setStatus('ready');

                // L'état de chaque mode vient du navigateur : aucune requête
                // supplémentaire, et cela marche aussi sans compte Discord.
                const found = {};
                MODES.forEach((mode) => {
                    const puzzle = (payload.modes || {})[mode];
                    if (!puzzle) return;
                    const saved = loadGame(mode, puzzle.date, puzzle.puzzleNumber, puzzle.reroll);
                    if (!saved || !saved.guesses.length) return;
                    found[mode] = {
                        finished: saved.guesses.some((guess) => guess.finished),
                        solved: saved.guesses.some((guess) => guess.correct),
                        attempts: saved.guesses.length,
                    };
                    if (found[mode].finished) {
                        recordLocalResult(mode, puzzle.puzzleNumber, found[mode].solved, found[mode].attempts);
                    }
                });
                setPlayed(found);

                // Série en cours, lue dans l'historique du navigateur
                const live = {};
                MODES.forEach((mode) => {
                    const puzzle = (payload.modes || {})[mode];
                    if (puzzle) live[mode] = liveStreak(getLocalStats(mode), puzzle.puzzleNumber);
                });
                setStreaks(live);

                const anyDate = Object.values(payload.modes || {})[0];
                if (anyDate) purgeOldGames(anyDate.date);
            })
            .catch((error) => {
                if (error.name !== 'AbortError') setStatus('error');
            });

        return () => controller.abort();
    }, []);

    const badgeFor = (mode) => {
        const state = played[mode];
        const puzzle = modes[mode];
        if (!state || !puzzle) return { badge: t('beatboxdle.home.toPlay'), tone: 'idle' };
        if (!state.finished) {
            return { badge: t('beatboxdle.home.inProgress', { count: state.attempts }), tone: 'idle' };
        }
        return state.solved
            ? { badge: t('beatboxdle.home.solved', { count: state.attempts, total: puzzle.maxAttempts }), tone: 'done' }
            : { badge: t('beatboxdle.home.failed'), tone: 'failed' };
    };

    return (
        <>
            <SEO
                title={t('beatboxdle.seoTitle')}
                description={t('beatboxdle.seoDescription')}
                url="https://beatboxgames.com/beatboxdle"
            />

            <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
                <header className="flex flex-col gap-2 text-center">
                    <h1 className="text-3xl font-bold leading-none tracking-tight text-site-ink sm:text-4xl">
                        {t('beatboxdle.title')}
                    </h1>
                    <p className="text-sm leading-relaxed text-site-muted sm:text-base">
                        {t('beatboxdle.home.intro')}
                    </p>
                    {status === 'ready' && modes.letters && (
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-yellow">
                            {t('beatboxdle.number', { number: modes.letters.puzzleNumber })}
                        </p>
                    )}
                </header>

                {status === 'loading' && (
                    <p className="py-10 text-center text-sm text-site-muted">{t('common.loading')}</p>
                )}

                {status === 'error' && (
                    <p className="rounded-xl border border-site-line bg-site-surface p-5 text-sm text-site-muted">
                        {t('beatboxdle.unavailable')}
                    </p>
                )}

                {status === 'ready' && (
                    <div className="flex flex-col gap-3">
                        {MODES.filter((mode) => modes[mode]).map((mode) => {
                            const { badge, tone } = badgeFor(mode);
                            return (
                                <ModeCard
                                    key={mode}
                                    mode={mode}
                                    to={`/beatboxdle/${mode}`}
                                    name={t(`beatboxdle.modes.${mode}`)}
                                    description={t(`beatboxdle.home.${mode}`)}
                                    badge={badge}
                                    badgeTone={tone}
                                    streak={streaks[mode] ? t('beatboxdle.home.streak', { count: streaks[mode] }) : null}
                                />
                            );
                        })}
                    </div>
                )}

                {status === 'ready' && (
                    <p className="text-center text-xs text-site-soft">{t('beatboxdle.home.reset')}</p>
                )}

                {status === 'ready' && <Yesterday t={t} />}

                {status === 'ready' && (
                    <DayLeaderboard t={t} language={language} modes={MODES.filter((mode) => modes[mode])} />
                )}
            </div>
        </>
    );
}

export default function Beatboxdle() {
    return (
        <SiteShell>
            <BeatboxdleHome />
        </SiteShell>
    );
}
