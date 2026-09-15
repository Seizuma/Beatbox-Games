import React, { useEffect, useId, useRef, useState } from 'react';
import GameShell from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import BulbRing from '../show/BulbRing';
import Lectern from '../show/Lectern';
import { Equalizer, LecternRow, LevelSteps, RoundTrack } from '../show/GameHud';
import Icon from '../icons/Icon';
import { VolumeControl } from '../UI';
import { createShowT, getQuitGameConfirm, LEVEL_POINTS } from '../../utils/showI18n';

// État de la barre d'action, dans le même ordre de priorité que l'ancienne vue
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

    const steps = [1, 2, 3].map((stepLevel) => ({
        level: stepLevel,
        points: LEVEL_POINTS[stepLevel] === 1 ? st('game.pointsShortOne') : st('game.pointsShort', { points: LEVEL_POINTS[stepLevel] }),
        caption: st('game.stepCaption', { level: stepLevel }),
    }));

    const submit = (event) => {
        event.preventDefault();
        if (answer && answer.trim()) handleSubmitAnswer();
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
            actionBar={
                phase === 'answer' ? (
                    <form onSubmit={submit} className="flex gap-2">
                        <label htmlFor={answerId} className="sr-only">{st('game.answerLabel')}</label>
                        <input
                            id={answerId}
                            type="text"
                            value={answer}
                            onChange={(event) => setAnswer(event.target.value)}
                            placeholder={st('game.answerPlaceholder')}
                            autoFocus
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="words"
                            spellCheck="false"
                            enterKeyHint="send"
                            className="min-w-0 flex-1 rounded-full bg-show-white px-5 py-3 text-base font-semibold text-show-night placeholder:text-slate-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-show-yellow"
                        />
                        <ShowButton type="submit" size="lg" disabled={!answer || !answer.trim()}>
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
                )
            }
        >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 sm:gap-10">
                {gameState && (
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
                            className={`h-44 w-44 sm:h-56 sm:w-56 ${phase === 'wrong' ? 'shake' : ''}`}
                            label={hasTimer ? `${timeLeft} ${st('game.seconds')}` : st('game.listen')}
                        >
                            {hasTimer ? (
                                <>
                                    <span className={`font-brand text-6xl leading-none sm:text-7xl ${timeLeft <= 10 ? 'text-show-yellow' : ''}`} aria-hidden="true">
                                        {timeLeft}
                                    </span>
                                    <span className="mt-1 text-xs text-show-muted" aria-hidden="true">{st('game.seconds')}</span>
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

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-extrabold text-show-muted">
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

                <section aria-labelledby="game-scores-title">
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
        </GameShell>
    );
};

export default GameView;