import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import GameShell from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import BulbRing from '../show/BulbRing';
import Lectern from '../show/Lectern';
import { Equalizer, LecternRow, LevelSteps, RoundTrack } from '../show/GameHud';
import Icon from '../icons/Icon';
import { VolumeControl } from '../UI';
import { createShowT, getQuitGameConfirm, LEVEL_POINTS } from '../../utils/showI18n';
import ShowModal from '../show/ShowModal';
import ArtistAnswerInput from './ArtistAnswerInput';
import ArtistListPanel from './ArtistListPanel';
import { useBlindTestArtists } from '../../hooks/useBlindTestArtists';
import { findArtist, rankArtists } from '../../utils/artistSearch.js';

// Écran tactile : le clavier virtuel prend la moitié de l'écran quand on répond
const isTouchDevice = () => typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;

// État de la zone de réponse, dans le même ordre de priorité que l'ancienne vue
const getPhase = ({ answerFeedback, me, hasAnswered, canAnswer, timerStarted }) => {
    if (answerFeedback?.show) return answerFeedback.isCorrect ? 'correct' : 'wrong';
    if (me?.hasFoundThisRound) return 'found';
    if (!hasAnswered && canAnswer && timerStarted) return 'answer';
    if (!timerStarted && !hasAnswered && canAnswer) return 'listen';
    if (hasAnswered) return 'sent';
    if (!canAnswer) return 'locked';
    return 'syncing';
};

const getLamp = (player, level) => {
    if (!player.connected) return 'idle';
    if (player.hasFoundThisRound) return 'ready';
    const current = player.currentAnswer;
    if (current && level && current.level === level) {
        return current.isCorrect ? 'ready' : 'wrong';
    }
    return 'idle';
};

const PHASE_STYLE = {
    correct: { icon: 'check', className: 'bg-show-ready text-show-night', key: 'game.correct' },
    wrong: { icon: 'close', className: 'bg-show-buzz text-show-white', key: 'game.wrong' },
    found: { icon: 'check', className: 'bg-show-stage-2 text-show-white', key: 'game.found' },
    listen: { icon: 'headphones', className: 'text-show-muted', key: 'game.listenHint' },
    sent: { icon: 'check', className: 'text-show-muted', key: 'game.sent' },
    locked: { icon: 'headphones', className: 'text-show-muted', key: 'game.locked' },
    syncing: { icon: 'headphones', className: 'text-show-muted', key: 'game.syncing' },
};

// Partie de Blind Test : tableau de manche en haut, chronomètre au centre, pupitres en bas, réponse ancrée
const GameView = ({
    gameState,
    timeLeft,
    answer,
    hasAnswered,
    canAnswer,
    timerStarted,
    players,
    scores,
    pseudo,
    answerFeedback,
    setAnswer,
    handleSubmitAnswer,
    volumeControlProps,
    LanguageSwitch,
    language,
    onQuit
}) => {
    const st = createShowT(language);
    const answerId = useId();
    const [touch] = useState(isTouchDevice);
    const [answerFocused, setAnswerFocused] = useState(false);
    const [showArtistSheet, setShowArtistSheet] = useState(false);
    const answerInputRef = useRef(null);
    const answerHelpId = useId();
    const { artists, status: artistsStatus } = useBlindTestArtists();

    // Clavier ouvert sur mobile : on replie le tableau et les pupitres pour garder chronomètre et réponse visibles
    const compact = touch && answerFocused;

    const handleAnswerFocus = useCallback(() => {
        setAnswerFocused(true);
        if (touch) {
            // Laisse le clavier s'ouvrir puis remonte en haut de l'écran
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 250);
        }
    }, [touch]);

    // Léger délai : un toucher sur « Valider » ferme le clavier avant l'envoi, la mise en page ne doit pas bouger entre-temps
    const blurTimeoutRef = useRef(null);
    const handleAnswerBlur = useCallback(() => {
        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = setTimeout(() => {
            const active = document.activeElement;
            setAnswerFocused(Boolean(active && active.id === answerId));
        }, 200);
    }, [answerId]);

    useEffect(() => () => {
        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    }, []);

    const round = gameState?.round;
    const level = gameState?.level;

    // Durée totale de l'extrait : la plus grande valeur reçue depuis le début du niveau
    const maxTimeRef = useRef(null);
    useEffect(() => {
        maxTimeRef.current = null;
    }, [round, level]);

    if (typeof timeLeft === 'number' && (maxTimeRef.current === null || timeLeft > maxTimeRef.current)) {
        maxTimeRef.current = timeLeft;
    }

    const hasTimer = typeof timeLeft === 'number';
    const progress = hasTimer && maxTimeRef.current ? timeLeft / maxTimeRef.current : 1;

    // Animation +points ou secousse à chaque retour du serveur
    const [feedbackKey, setFeedbackKey] = useState(0);
    const [earnedPoints, setEarnedPoints] = useState(null);
    useEffect(() => {
        if (answerFeedback?.show) {
            setFeedbackKey((key) => key + 1);
            setEarnedPoints(answerFeedback.isCorrect ? LEVEL_POINTS[level] || null : null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [answerFeedback?.show, answerFeedback?.isCorrect]);

    const playerList = Array.isArray(players) ? players.filter(Boolean) : [];
    const me = playerList.find((player) => player.pseudo === pseudo);
    const sortedPlayers = playerList
        .slice()
        .sort((a, b) => (scores?.[b.pseudo] || 0) - (scores?.[a.pseudo] || 0));
    const connectedCount = playerList.filter((player) => player.connected).length;
    const foundCount = playerList.filter((player) => player.connected && player.hasFoundThisRound).length;

    const phase = getPhase({ answerFeedback, me, hasAnswered, canAnswer, timerStarted });
    const phaseStyle = PHASE_STYLE[phase];

    useEffect(() => {
        if (phase !== 'answer') setAnswerFocused(false);
    }, [phase]);

    const steps = [1, 2, 3].map((stepLevel) => ({
        level: stepLevel,
        points: LEVEL_POINTS[stepLevel] === 1 ? st('game.pointsShortOne') : st('game.pointsShort', { points: LEVEL_POINTS[stepLevel] }),
        caption: st('game.stepCaption', { level: stepLevel }),
    }));

    // Si la liste est chargée, seule une réponse présente dans la liste peut être envoyée
    const listReady = artistsStatus === 'ready' && artists.length > 0;
    const matchedArtist = listReady ? findArtist(answer, artists) : null;
    const typed = Boolean(answer && answer.trim());
    const canSubmit = typed && (!listReady || Boolean(matchedArtist));
    const hasSuggestions = listReady && typed && rankArtists(answer, artists, 1).length > 0;
    // Message d'erreur seulement quand plus aucun artiste ne correspond à la saisie
    const showNotInList = listReady && typed && answer.trim().length >= 2 && !matchedArtist && !hasSuggestions;

    const submit = (event) => {
        event.preventDefault();
        if (canSubmit) handleSubmitAnswer();
    };

    // Choix d'un nom dans la liste complète
    const pickArtist = useCallback((artist) => {
        setAnswer(artist);
        setShowArtistSheet(false);
        // Sur PC, on remet le curseur dans le champ ; sur mobile, on évite de rouvrir le clavier
        if (!touch && answerInputRef.current) answerInputRef.current.focus();
    }, [setAnswer, touch]);

    const artistPanelLabels = {
        filter: st('game.artistsFilter'),
        pickHint: touch ? st('game.artistsPickHintTouch') : st('game.artistsPickHint'),
        browseHint: st('game.artistsBrowseHint'),
        loading: st('game.artistsLoading'),
        error: st('game.artistsError'),
        empty: st('game.artistsEmpty'),
    };

    return (
        <GameShell
            title={st('blindtest.name')}
            onQuit={onQuit}
            quitLabel={st('common.quit')}
            quitConfirm={getQuitGameConfirm(st)}
            tools={
                <>
                    {volumeControlProps && <VolumeControl {...volumeControlProps} />}
                    {LanguageSwitch && <LanguageSwitch />}
                </>
            }
        >
            <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-10">
            <div className={`flex min-w-0 flex-col ${compact ? 'gap-4' : 'gap-8 sm:gap-10'}`}>
                {gameState && !compact && (
                    <div className="grid gap-4 rounded-2xl bg-show-night/45 p-4 ring-1 ring-white/5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-8">
                        <RoundTrack
                            round={gameState.round}
                            total={gameState.maxRounds}
                            label={st('game.round', { round: gameState.round, max: gameState.maxRounds })}
                        />
                        <LevelSteps level={level} steps={steps} label={st('game.stepsLabel')} />
                    </div>
                )}

                <div className="flex flex-col items-center">
                    <div className="relative">
                        <BulbRing
                            key={phase === 'wrong' ? `wrong-${feedbackKey}` : 'ring'}
                            progress={progress}
                            smooth
                            className={`${compact ? 'h-24 w-24' : 'h-44 w-44 sm:h-56 sm:w-56'} transition-[width,height] duration-200 ${phase === 'wrong' ? 'shake' : ''}`}
                            label={hasTimer ? `${timeLeft} ${st('game.seconds')}` : st('game.listen')}
                        >
                            {hasTimer ? (
                                <>
                                    <span className={`font-brand leading-none ${compact ? 'text-4xl' : 'text-6xl sm:text-7xl'} ${timeLeft <= 10 ? 'text-show-yellow' : ''}`} aria-hidden="true">
                                        {timeLeft}
                                    </span>
                                    {!compact && <span className="mt-1 text-xs text-show-muted" aria-hidden="true">{st('game.seconds')}</span>}
                                </>
                            ) : (
                                <>
                                    <Icon name="headphones" size={44} className="text-show-yellow" />
                                    <span className="mt-2 text-xs font-semibold text-show-muted" aria-hidden="true">{st('game.listen')}</span>
                                </>
                            )}
                        </BulbRing>

                        {phase === 'correct' && earnedPoints && (
                            <span
                                key={`pop-${feedbackKey}`}
                                className="points-pop pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 font-brand text-4xl text-show-ready drop-shadow"
                                aria-hidden="true"
                            >
                                {st('game.pointsWon', { points: earnedPoints })}
                            </span>
                        )}
                    </div>

                    <div className={`${compact ? 'mt-2' : 'mt-4'} flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-extrabold text-show-muted`}>
                        {compact && gameState && LEVEL_POINTS[level] && (
                            <span className="rounded-full bg-show-yellow px-2.5 py-0.5 text-show-night">
                                {st('game.level', { level, points: LEVEL_POINTS[level] })}
                            </span>
                        )}
                        {timerStarted && (
                            <span className="inline-flex items-center gap-2 text-show-yellow">
                                <Equalizer />
                                {st('game.onAir')}
                            </span>
                        )}
                        {connectedCount > 0 && (
                            <span>{st('game.foundCount', { count: foundCount, total: connectedCount })}</span>
                        )}
                    </div>
                </div>


                <div className="mx-auto w-full max-w-xl">
                    {phase === 'answer' ? (
                        <form onSubmit={submit} className="flex items-start gap-2">
                            <label htmlFor={answerId} className="sr-only">{st('game.answerLabel')}</label>
                            <ArtistAnswerInput
                                ref={answerInputRef}
                                id={answerId}
                                value={answer}
                                onChange={setAnswer}
                                artists={listReady ? artists : []}
                                placeholder={st('game.answerPlaceholder')}
                                listLabel={st('game.suggestions')}
                                autoFocus={!touch}
                                onFocus={handleAnswerFocus}
                                onBlur={handleAnswerBlur}
                                invalid={showNotInList}
                                describedBy={answerHelpId}
                            />
                            <ShowButton type="submit" size="lg" disabled={!canSubmit}>
                                {st('game.submit')}
                            </ShowButton>
                        </form>
                    ) : (
                        <p
                            role="status"
                            aria-live="polite"
                            className={`flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-4 text-center text-sm font-extrabold ${phaseStyle.className}`}
                        >
                            <Icon name={phaseStyle.icon} size={18} />
                            {st(phaseStyle.key)}
                        </p>
                    )}

                    <div className="mt-2 flex min-h-[1.5rem] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2">
                        <p id={answerHelpId} aria-live="polite" className={`text-xs font-semibold ${showNotInList ? 'text-[#FF8A7A]' : 'text-show-muted'}`}>
                            {phase === 'answer'
                                ? (showNotInList ? st('game.notInList') : listReady ? st('game.answerHint') : '')
                                : ''}
                        </p>
                        {listReady && !compact && (
                            <button
                                type="button"
                                onClick={() => setShowArtistSheet(true)}
                                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-show-white underline decoration-show-yellow decoration-2 underline-offset-4 lg:hidden"
                            >
                                <Icon name="menu" size={14} />
                                {st('game.artistsButton', { count: artists.length })}
                            </button>
                        )}
                    </div>
                </div>

                <section aria-labelledby="game-scores-title" className={compact ? 'hidden' : ''}>
                    <h2 id="game-scores-title" className="sr-only">{st('game.scores')}</h2>
                    <LecternRow className="grid-cols-3 sm:grid-cols-4 lg:grid-cols-5" label={st('game.scores')}>
                        {sortedPlayers.map((player) => (
                            <li key={player.pseudo}>
                                <Lectern
                                    size="sm"
                                    name={player.pseudo}
                                    value={scores?.[player.pseudo] || 0}
                                    lamp={getLamp(player, level)}
                                    highlight={player.pseudo === pseudo}
                                    avatarUrl={player.isDiscordUser ? player.avatarUrl : undefined}
                                    dimmed={!player.connected}
                                />
                            </li>
                        ))}
                    </LecternRow>
                    <p className="mt-6 text-center text-xs text-show-muted">{st('game.legend')}</p>
                </section>
            </div>

            {listReady && (
                <aside className="hidden lg:block" aria-labelledby="game-artists-title">
                    <div className="sticky top-20 rounded-2xl bg-show-night/45 p-4 ring-1 ring-white/5">
                        <h2 id="game-artists-title" className="mb-3 text-sm font-extrabold">
                            {st('game.artistsTitle', { count: artists.length })}
                        </h2>
                        <ArtistListPanel
                            artists={artists}
                            status={artistsStatus}
                            onPick={phase === 'answer' ? pickArtist : undefined}
                            labels={artistPanelLabels}
                            listClassName="max-h-[calc(100dvh-16rem)]"
                        />
                    </div>
                </aside>
            )}
            </div>

            <ShowModal
                open={showArtistSheet}
                onClose={() => setShowArtistSheet(false)}
                title={st('game.artistsTitle', { count: artists.length })}
                closeLabel={st('common.close')}
            >
                <ArtistListPanel
                    artists={artists}
                    status={artistsStatus}
                    onPick={phase === 'answer' ? pickArtist : undefined}
                    labels={artistPanelLabels}
                    listClassName="max-h-[55dvh]"
                />
            </ShowModal>
        </GameShell>
    );
};

export default GameView;