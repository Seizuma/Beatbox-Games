import React, { useEffect, useId, useState } from 'react';
import GameShell from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import Lectern from '../show/Lectern';
import { LecternRow, RoundTrack, ScoreChips, SharpnessGauge } from '../show/GameHud';
import Icon from '../icons/Icon';
import { BUZZER_ANSWER_SECONDS, createShowT, getQuitGameConfirm } from '../../utils/showI18n';
import RevealImage, { pickRevealEffect } from './RevealImage';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://dev.beatboxgames.com';

const resolveImageUrl = (image) => (/^(https?:|data:|blob:)/.test(image) ? image : `${API_BASE_URL}${image}`);


const discordAvatar = (player) => (player?.isDiscordUser && player?.discordId && player?.discordAvatar
    ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=64`
    : undefined);

// Compte à rebours local du temps de réponse après un buzz (le serveur fait foi, ceci est indicatif)
function useAnswerCountdown(buzzedPlayer) {
    const [secondsLeft, setSecondsLeft] = useState(null);

    useEffect(() => {
        if (!buzzedPlayer) {
            setSecondsLeft(null);
            return undefined;
        }
        const startedAt = Date.now();
        const tick = () => {
            const remaining = BUZZER_ANSWER_SECONDS - Math.floor((Date.now() - startedAt) / 1000);
            setSecondsLeft(Math.max(0, remaining));
        };
        tick();
        const interval = setInterval(tick, 250);
        return () => clearInterval(interval);
    }, [buzzedPlayer]);

    return secondsLeft;
}

// Partie de Buzzer Battle : tableau de manche, photo et netteté, buzzer sous le pouce, pupitres
function BuzzerGameView({
    currentRound,
    totalRounds,
    pixelLevel,
    buzzedPlayer,
    canBuzz,
    currentBeatboxer,
    beatboxerImage,
    players,
    scores,
    onBuzz,
    onGuess,
    myPlayerId,
    wrongGuessFeedback,
    justReconnected,
    language,
    languageSwitch,
    onQuit
}) {
    const st = createShowT(language);
    const guessId = useId();

    const [guess, setGuess] = useState('');
    const [showGuessInput, setShowGuessInput] = useState(false);
    const [imageFailed, setImageFailed] = useState(false);
    const [revealedSrc, setRevealedSrc] = useState(null);

    const isBuzzedByMe = Boolean(buzzedPlayer) && buzzedPlayer === myPlayerId;
    const answerSeconds = useAnswerCountdown(buzzedPlayer);

    const imageSrc = beatboxerImage ? resolveImageUrl(beatboxerImage) : null;
    const effect = pickRevealEffect(currentRound, beatboxerImage);

    useEffect(() => {
        setGuess('');
        setShowGuessInput(false);
    }, [currentRound]);

    useEffect(() => {
        setImageFailed(false);
    }, [imageSrc]);

    // La photo n'est affichée nette que si la réponse concerne bien la photo à l'écran.
    // Sans ce verrou, la photo de la manche suivante pouvait apparaître nette un instant.
    useEffect(() => {
        setRevealedSrc((previous) => (currentBeatboxer ? previous || imageSrc : null));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentBeatboxer]);

    const revealed = Boolean(currentBeatboxer) && revealedSrc === imageSrc;

    useEffect(() => {
        if (isBuzzedByMe && !showGuessInput) {
            setShowGuessInput(true);
        }
    }, [isBuzzedByMe, showGuessInput]);

    const handleSubmitGuess = (event) => {
        event.preventDefault();
        if (guess.trim()) {
            onGuess(guess.trim());
            setGuess('');
            setShowGuessInput(false);
        }
    };

    const playerList = Array.isArray(players) ? players.filter(Boolean) : [];
    const scoreList = Array.isArray(scores) ? scores : [];
    const findScore = (player) => scoreList.find((entry) => entry.id === player.id)
        || scoreList.find((entry) => entry.username === player.username);

    const ranked = playerList
        .map((player) => ({ player, score: findScore(player)?.score ?? player.score ?? 0 }))
        .sort((a, b) => b.score - a.score);

    const buzzedName = playerList.find((player) => player.id === buzzedPlayer)?.username;
    const isMyWrongGuess = Boolean(wrongGuessFeedback) && wrongGuessFeedback.playerId === myPlayerId;
    const sharpness = Math.max(0, Math.min(100, Math.round(100 - (pixelLevel ?? 100))));
    const buzzerDisabled = !canBuzz || Boolean(buzzedPlayer) || Boolean(currentBeatboxer);
    const lockedAfterError = !canBuzz && !buzzedPlayer && !currentBeatboxer;
    const isGuessing = isBuzzedByMe && showGuessInput && !currentBeatboxer;

    const getLamp = (player) => {
        if (player.connected === false) return 'idle';
        if (player.id === buzzedPlayer) return 'buzz';
        if (wrongGuessFeedback && wrongGuessFeedback.playerId === player.id) return 'wrong';
        return 'idle';
    };

    let buzzerLabel = st('buzzerGame.buzz');
    if (buzzedPlayer && !isBuzzedByMe) buzzerLabel = st('buzzerGame.answering', { name: buzzedName || '…' });
    else if (buzzerDisabled) buzzerLabel = st('buzzerGame.blocked');

    const countdownPill = answerSeconds !== null && !currentBeatboxer && (
        <span className="inline-flex min-w-[2.75rem] items-center justify-center rounded-full bg-show-night px-2 py-1 font-brand text-sm text-show-yellow" aria-hidden="true">
            {st('buzzerGame.secondsLeft', { seconds: answerSeconds })}
        </span>
    );

    const actionBar = isGuessing ? (
        <form onSubmit={handleSubmitGuess} className="flex flex-col gap-2">
            <p className="flex items-center justify-center gap-2 text-center text-xs font-extrabold text-show-yellow" aria-live="assertive">
                {st('buzzerGame.youBuzzedShort')}
                {countdownPill}
            </p>
            <div className="flex gap-2">
                <label htmlFor={guessId} className="sr-only">{st('game.answerLabel')}</label>
                <input
                    id={guessId}
                    type="text"
                    value={guess}
                    onChange={(event) => setGuess(event.target.value)}
                    placeholder={st('game.answerPlaceholder')}
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck="false"
                    enterKeyHint="send"
                    className="min-w-0 flex-1 rounded-full bg-show-white px-5 py-3 text-base font-semibold text-show-night placeholder:text-slate-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-show-yellow"
                />
                <ShowButton type="submit" size="lg" disabled={!guess.trim()}>{st('game.submit')}</ShowButton>
            </div>
        </form>
    ) : (
        <div className="flex flex-col gap-2">
            <ShowButton variant="buzz" size="lg" block onClick={onBuzz} disabled={buzzerDisabled} className="min-h-[4rem] text-2xl">
                {buzzerLabel}
                {buzzedPlayer && !isBuzzedByMe && countdownPill}
            </ShowButton>
            {lockedAfterError && (
                <p className="text-center text-xs font-semibold text-show-muted" aria-live="polite">{st('buzzerGame.lockedAfterError')}</p>
            )}
        </div>
    );

    return (
        <GameShell
            title={st('buzzer.name')}
            onQuit={onQuit}
            quitLabel={st('common.quit')}
            quitConfirm={getQuitGameConfirm(st)}
            tools={languageSwitch}
            actionBar={actionBar}
            actionBarClassName={isGuessing ? '' : 'lg:hidden'}
        >
            <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-10">
                <div className="flex min-w-0 flex-col gap-4">
                    <div className="grid gap-3 rounded-2xl bg-show-night/45 p-4 ring-1 ring-white/5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-6">
                        <RoundTrack
                            round={currentRound}
                            total={totalRounds}
                            label={st('game.round', { round: currentRound, max: totalRounds })}
                        />
                        <ScoreChips
                            items={[
                                { label: st(`buzzerGame.effect.${effect}`), tone: 'neutral' },
                                { label: st('buzzerGame.scoreGood'), tone: 'good' },
                                { label: st('buzzerGame.scoreBad'), tone: 'bad' },
                            ]}
                        />
                    </div>

                    <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl bg-show-night shadow-[0_0_0_4px_#FFFFFF,0_18px_40px_rgb(0_0_0/0.35)] sm:aspect-video">
                        {imageSrc && !imageFailed ? (
                            <RevealImage
                                src={imageSrc}
                                round={currentRound}
                                hidden={(pixelLevel ?? 100) / 100}
                                revealed={revealed}
                                effect={effect}
                                alt={revealed ? currentBeatboxer : st('buzzerGame.imageAlt')}
                                onError={() => {
                                    console.error('Erreur chargement image:', beatboxerImage);
                                    setImageFailed(true);
                                }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-sm text-show-muted">
                                {st('buzzerGame.loadingImage')}
                            </div>
                        )}

                        {justReconnected && (
                            <p className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-show-yellow px-3 py-1 text-xs font-extrabold text-show-night">
                                {st('buzzerGame.reconnected', { round: currentRound, max: totalRounds })}
                            </p>
                        )}

                        {buzzedPlayer && !currentBeatboxer && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-show-night/60">
                                <p className="show-pop rounded-full bg-show-buzz px-5 py-2 text-center font-brand text-xl text-show-white sm:text-2xl" aria-live="assertive">
                                    {isBuzzedByMe ? st('buzzerGame.youBuzzedShort') : st('buzzerGame.playerBuzzed', { name: buzzedName || '…' })}
                                </p>
                                {answerSeconds !== null && (
                                    <span className="font-brand text-5xl leading-none text-show-yellow" aria-hidden="true">{answerSeconds}</span>
                                )}
                            </div>
                        )}

                        {revealed && (
                            <div className="absolute inset-x-0 bottom-0 flex justify-center p-4">
                                <div className="show-pop rounded-2xl bg-show-white px-5 py-3 text-center text-show-night shadow-xl" role="status">
                                    <p className="text-xs font-extrabold text-show-desk">{st('buzzerGame.revealed')}</p>
                                    <p className="break-words font-brand text-2xl leading-tight sm:text-3xl">{currentBeatboxer}</p>
                                </div>
                            </div>
                        )}

                        {isMyWrongGuess && (
                            <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2" role="alert">
                                <p className="show-pop flex items-center gap-2 rounded-full bg-show-buzz px-4 py-2 text-sm font-extrabold text-show-white">
                                    <Icon name="close" size={16} />
                                    {st('buzzerGame.wrong')}
                                </p>
                            </div>
                        )}
                    </div>

                    <SharpnessGauge
                        value={revealed ? 100 : sharpness}
                        label={st('buzzerGame.sharpnessLabel')}
                        valueLabel={`${revealed ? 100 : sharpness} %`}
                    />

                    {wrongGuessFeedback && !isMyWrongGuess && (
                        <p className="text-center text-sm font-semibold text-show-muted" role="status">
                            {st('buzzerGame.playerWrong', { name: wrongGuessFeedback.playerName })}
                        </p>
                    )}
                </div>

                <div className="hidden flex-col items-center justify-center gap-4 lg:flex">
                    <button
                        type="button"
                        onClick={onBuzz}
                        disabled={buzzerDisabled}
                        className="flex h-48 w-48 flex-col items-center justify-center rounded-full border-[6px] border-show-white bg-show-buzz text-show-white shadow-show-buzz transition active:translate-y-[5px] active:shadow-none disabled:cursor-not-allowed disabled:bg-show-dim disabled:shadow-none"
                    >
                        <span className="px-4 text-center font-brand text-2xl leading-tight">{buzzerLabel}</span>
                        {!buzzerDisabled && <span className="mt-1 text-xs font-extrabold opacity-90">{st('buzzerGame.spaceHint')}</span>}
                        {buzzedPlayer && !isBuzzedByMe && answerSeconds !== null && (
                            <span className="mt-2 font-brand text-xl text-show-yellow">{st('buzzerGame.secondsLeft', { seconds: answerSeconds })}</span>
                        )}
                    </button>
                    {lockedAfterError && (
                        <p className="text-center text-xs font-semibold text-show-muted" aria-live="polite">{st('buzzerGame.lockedAfterError')}</p>
                    )}
                </div>

                <section aria-labelledby="buzzer-scores-title" className="lg:col-span-2">
                    <h2 id="buzzer-scores-title" className="sr-only">{st('game.scores')}</h2>
                    <LecternRow className="grid-cols-3 sm:grid-cols-5 lg:grid-cols-6" label={st('game.scores')}>
                        {ranked.map(({ player, score }) => (
                            <li key={player.id || player.username}>
                                <Lectern
                                    size="sm"
                                    name={player.username}
                                    value={score}
                                    lamp={getLamp(player)}
                                    highlight={player.id === myPlayerId}
                                    avatarUrl={discordAvatar(player)}
                                    dimmed={player.connected === false}
                                />
                            </li>
                        ))}
                    </LecternRow>
                    <p className="mt-6 text-center text-xs text-show-muted">{st('buzzerGame.legend')}</p>
                </section>
            </div>
        </GameShell>
    );
}

export default BuzzerGameView;