import React, { useEffect, useState } from 'react';
import SEO from './components/SEO';
import SiteShell from './components/site/SiteShell';
import ModeCard from './components/beatboxdle/ModeCard';
import { useSiteI18n } from './utils/siteI18n';
import { fetchSummary } from './utils/beatboxdleApi';
import { loadGame, purgeOldGames } from './utils/beatboxdleStorage';

const MODES = ['letters', 'clues'];

/**
 * Accueil du Beatboxdle : le choix du mode.
 *
 * L'ancien sélecteur à deux onglets posé au-dessus de la grille obligeait à
 * choisir avant d'avoir rien vu, et occupait la place du plateau. Une page de
 * choix règle les deux : chaque mode se présente, et l'état du jour se lit
 * d'un coup d'œil — c'est ce qu'on vient vérifier en ouvrant la page.
 */
function BeatboxdleHome() {
    const { t } = useSiteI18n();
    const [status, setStatus] = useState('loading');
    const [modes, setModes] = useState({});
    const [played, setPlayed] = useState({});

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
                });
                setPlayed(found);

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
                                />
                            );
                        })}
                    </div>
                )}

                {status === 'ready' && (
                    <p className="text-center text-xs text-site-soft">{t('beatboxdle.home.reset')}</p>
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
