import React, { useEffect, useId, useRef } from 'react';
import GameShell, { StatusPill } from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import BulbRing from '../show/BulbRing';
import Lectern from '../show/Lectern';
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

// Partie de Blind Test : couronne d'ampoules pour le temps, pupitres des joueurs, réponse ancrée en bas
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

    // Durée totale de l'extrait : la plus grande valeur reçue depuis le début du niveau
    const maxTimeRef = useRef(null);
    const round = gameState?.round;
    const level = gameState?.level;

    useEffect(() => {
        maxTimeRef.current = null;
    }, [round, level]);

    if (typeof timeLeft === 'number' && (maxTimeRef.current === null || timeLeft > maxTimeRef.current)) {
        maxTimeRef.current = timeLeft;
    }

    const hasTimer = typeof timeLeft === 'number';
    const progress = hasTimer && maxTimeRef.current ? timeLeft / maxTimeRef.current : 1;

    const playerList = Array.isArray(players) ? players.filter(Boolean) : [];
    const me = playerList.find((player) => player.pseudo === pseudo);
    const sortedPlayers = playerList
        .slice()
        .sort((a, b) => (scores?.[b.pseudo] || 0) - (scores?.[a.pseudo] || 0));

    const phase = getPhase({ answerFeedback, me, hasAnswered, canAnswer, timerStarted });
    const phaseStyle = PHASE_STYLE[phase];
    const levelPoints = LEVEL_POINTS[level];

    const submit = (event) => {
        event.preventDefault();
        if (answer && answer.trim()) handleSubmitAnswer();
    };

    const status = gameState ? (
        <>
            <StatusPill>{st('game.round', { round: gameState.round, max: gameState.maxRounds })}</StatusPill>
            {levelPoints && <StatusPill highlight>{st('game.level', { level, points: levelPoints })}</StatusPill>}
        </>
    ) : null;

    return (
        <GameShell
            title={st('blindtest.name')}
            onQuit={onQuit}
            quitLabel={st('common.quit')}
            quitConfirm={getQuitGameConfirm(st)}
            status={status}
            contentClassName="flex flex-col justify-center"
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
            <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-12">
                <BulbRing
                    progress={progress}
                    className="h-44 w-44 sm:h-56 sm:w-56"
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

                <section aria-labelledby="game-scores-title" className="w-full">
                    <h2 id="game-scores-title" className="sr-only">{st('game.scores')}</h2>
                    <ol className="grid grid-cols-3 gap-x-2.5 gap-y-4 sm:grid-cols-4 lg:grid-cols-5">
                        {sortedPlayers.map((player) => (
                            <li key={player.pseudo}>
                                <Lectern
                                    name={player.pseudo}
                                    value={scores?.[player.pseudo] || 0}
                                    caption={player.connected ? undefined : st('common.offline')}
                                    lamp={getLamp(player, level)}
                                    highlight={player.pseudo === pseudo}
                                    dimmed={!player.connected}
                                />
                            </li>
                        ))}
                    </ol>
                    <p className="mt-4 text-center text-xs text-show-muted lg:text-left">{st('game.legend')}</p>
                </section>
            </div>
        </GameShell>
    );
};

export default GameView;