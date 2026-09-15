import React, { useEffect, useId, useState } from 'react';
import GameShell, { StatusPill } from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import Lectern from '../show/Lectern';
import Icon from '../icons/Icon';
import { createShowT, getQuitGameConfirm } from '../../utils/showI18n';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://dev.beatboxgames.com';

const resolveImageUrl = (image) => (image.startsWith('http') ? image : `${API_BASE_URL}${image}`);

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23163A8F" width="200" height="200"/%3E%3C/svg%3E';

// Partie de Buzzer Battle : la photo sur l'écran du plateau, le buzzer sous le pouce, les pupitres des joueurs
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
    const [imageLoaded, setImageLoaded] = useState(false);

    const isBuzzedByMe = Boolean(buzzedPlayer) && buzzedPlayer === myPlayerId;

    useEffect(() => {
        setGuess('');
        setShowGuessInput(false);
        setImageLoaded(false);
    }, [currentRound]);

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

    const getLamp = (player) => {
        if (player.connected === false) return 'idle';
        if (player.id === buzzedPlayer) return 'buzz';
        if (wrongGuessFeedback && wrongGuessFeedback.playerId === player.id) return 'wrong';
        return 'idle';
    };

    const status = (
        <>
            <StatusPill>{st('game.round', { round: currentRound, max: totalRounds })}</StatusPill>
            <StatusPill highlight>{st('buzzerGame.sharpness', { value: sharpness })}</StatusPill>
        </>
    );

    let buzzerLabel = st('buzzerGame.buzz');
    if (buzzedPlayer && !isBuzzedByMe) buzzerLabel = st('buzzerGame.playerBuzzed', { name: buzzedName || '…' });
    else if (buzzerDisabled) buzzerLabel = st('buzzerGame.blocked');

    const isGuessing = isBuzzedByMe && showGuessInput && !currentBeatboxer;

    const actionBar = isGuessing ? (
        <form onSubmit={handleSubmitGuess} className="flex flex-col gap-2">
            <p className="text-center text-xs font-extrabold text-show-yellow" aria-live="assertive">{st('buzzerGame.youBuzzed')}</p>
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
        <div>
            <ShowButton variant="buzz" size="lg" block onClick={onBuzz} disabled={buzzerDisabled} className="min-h-[4rem] text-2xl">
                {buzzerLabel}
            </ShowButton>
        </div>
    );

    return (
        <GameShell
            title={st('buzzer.name')}
            onQuit={onQuit}
            quitLabel={st('common.quit')}
            quitConfirm={getQuitGameConfirm(st)}
            status={status}
            tools={languageSwitch}
            actionBar={actionBar}
            actionBarClassName={isGuessing ? '' : 'lg:hidden'}
            contentClassName="flex flex-col justify-center"
        >
            <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-center">
                <div className="flex flex-col gap-3">
                    <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl border-4 border-show-white bg-show-night sm:aspect-video">
                        {beatboxerImage ? (
                            <img
                                key={currentRound}
                                src={resolveImageUrl(beatboxerImage)}
                                alt={currentBeatboxer ? currentBeatboxer : st('buzzerGame.imageAlt')}
                                draggable="false"
                                className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
                                style={{
                                    filter: currentBeatboxer
                                        ? 'none'
                                        : `blur(${pixelLevel * 0.3}px) brightness(${0.5 + (100 - pixelLevel) / 200})`,
                                    transform: currentBeatboxer ? 'scale(1)' : `scale(${1 + (pixelLevel / 300)})`,
                                    transition: 'filter 0.05s linear, transform 0.05s linear',
                                    imageRendering: pixelLevel > 30 ? 'pixelated' : 'auto',
                                    opacity: imageLoaded
                                        ? (currentBeatboxer ? 1 : 0.3 + ((100 - pixelLevel) / 100) * 0.7)
                                        : 0,
                                    WebkitTouchCallout: 'none'
                                }}
                                onLoad={() => setImageLoaded(true)}
                                onError={(event) => {
                                    console.error('Erreur chargement image:', beatboxerImage);
                                    event.target.src = PLACEHOLDER_IMAGE;
                                    setImageLoaded(true);
                                }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-sm text-show-muted">
                                {st('buzzerGame.loadingImage')}
                            </div>
                        )}

                        {justReconnected && (
                            <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
                                <StatusPill highlight>{st('buzzerGame.reconnected', { round: currentRound, max: totalRounds })}</StatusPill>
                            </div>
                        )}

                        {buzzedPlayer && !currentBeatboxer && (
                            <div className="absolute inset-0 flex items-center justify-center bg-show-night/60">
                                <p className="show-pop rounded-full bg-show-buzz px-5 py-2 text-center font-brand text-xl text-show-white sm:text-2xl" aria-live="assertive">
                                    {isBuzzedByMe ? st('buzzerGame.youBuzzedShort') : st('buzzerGame.playerBuzzed', { name: buzzedName || '…' })}
                                </p>
                            </div>
                        )}

                        {currentBeatboxer && (
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

                        {!currentBeatboxer && (
                            <div className="absolute inset-x-3 bottom-3 h-2 overflow-hidden rounded-full bg-show-night/70" aria-hidden="true">
                                <div className="h-full rounded-full bg-show-yellow" style={{ width: `${sharpness}%` }} />
                            </div>
                        )}
                    </div>

                    {wrongGuessFeedback && !isMyWrongGuess && (
                        <p className="text-center text-sm font-semibold text-show-muted" role="status">
                            {st('buzzerGame.playerWrong', { name: wrongGuessFeedback.playerName })}
                        </p>
                    )}
                </div>

                <div className="hidden flex-col items-center gap-3 lg:flex">
                    <button
                        type="button"
                        onClick={onBuzz}
                        disabled={buzzerDisabled}
                        className="flex h-44 w-44 flex-col items-center justify-center rounded-full border-[6px] border-show-white bg-show-buzz text-show-white shadow-show-buzz transition active:translate-y-[5px] active:shadow-none disabled:cursor-not-allowed disabled:bg-show-dim disabled:shadow-none"
                    >
                        <span className="px-3 text-center font-brand text-2xl leading-tight">{buzzerLabel}</span>
                        {!buzzerDisabled && <span className="mt-1 text-xs font-extrabold opacity-90">{st('buzzerGame.spaceHint')}</span>}
                    </button>
                </div>

                <section aria-labelledby="buzzer-scores-title" className="lg:col-span-2">
                    <h2 id="buzzer-scores-title" className="sr-only">{st('game.scores')}</h2>
                    <ol className="grid grid-cols-3 gap-x-2.5 gap-y-4 sm:grid-cols-5 lg:grid-cols-6">
                        {ranked.map(({ player, score }) => (
                            <li key={player.id || player.username}>
                                <Lectern
                                    name={player.username}
                                    value={score}
                                    caption={player.connected === false ? st('common.offline') : undefined}
                                    lamp={getLamp(player)}
                                    highlight={player.id === myPlayerId}
                                    dimmed={player.connected === false}
                                />
                            </li>
                        ))}
                    </ol>
                    <p className="mt-4 text-center text-xs text-show-muted">{st('buzzerGame.legend')}</p>
                </section>
            </div>
        </GameShell>
    );
}

export default BuzzerGameView;