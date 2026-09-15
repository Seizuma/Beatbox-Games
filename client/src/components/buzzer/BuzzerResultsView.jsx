import React from 'react';
import GameShell from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import Podium from '../show/Podium';
import { createShowT } from '../../utils/showI18n';

const discordAvatar = (player) => (player?.isDiscordUser && player?.discordId && player?.discordAvatar
    ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=64`
    : undefined);

// Fin de partie du Buzzer Battle : podium, classement avec buzz et erreurs, rejouer dans la même salle
function BuzzerResultsView({ scores, onPlayAgain, onBackToHome, myPlayerId, language, languageSwitch }) {
    const st = createShowT(language);
    const ranking = Array.isArray(scores) ? scores.filter(Boolean) : [];
    const winner = ranking[0];
    const others = ranking.slice(3);

    const statsLine = (player) => st('buzzerResults.stats', {
        buzzes: player.buzzes || 0,
        correct: player.correctGuesses || 0,
        wrong: player.wrongGuesses || 0,
    });

    return (
        <GameShell
            title={st('buzzer.name')}
            onQuit={onBackToHome}
            quitLabel={st('common.quit')}
            tools={languageSwitch}
            actionBar={
                <div className="flex flex-col gap-2">
                    {winner && <ShowButton size="lg" block onClick={onPlayAgain}>{st('buzzerResults.playAgain')}</ShowButton>}
                    <ShowButton variant={winner ? 'outline' : 'yellow'} size={winner ? 'md' : 'lg'} block onClick={onBackToHome}>
                        {st('results.back')}
                    </ShowButton>
                </div>
            }
        >
            <div className="mx-auto flex max-w-2xl flex-col gap-10">
                {winner ? (
                    <>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-show-muted">{st('results.title')}</p>
                            <h1 className="mt-2 break-words font-brand text-4xl leading-tight sm:text-5xl">
                                {st('results.winner', { name: winner.username })}
                            </h1>
                            <p className="mt-2 text-show-muted">{st('results.winnerScore', { score: winner.score ?? 0 })}</p>
                            <p className="mt-1 text-xs text-show-muted">{statsLine(winner)}</p>
                        </div>

                        <Podium
                            label={st('results.ranking')}
                            youLabel={st('results.you')}
                            entries={ranking.map((player) => ({
                                key: player.id || player.username,
                                name: player.username,
                                score: player.score ?? 0,
                                isMe: Boolean(myPlayerId) && player.id === myPlayerId,
                                avatarUrl: discordAvatar(player),
                            }))}
                        />

                        {others.length > 0 && (
                            <ol className="flex flex-col gap-2" start={4}>
                                {others.map((player, index) => {
                                    const isMe = Boolean(myPlayerId) && player.id === myPlayerId;
                                    return (
                                        <li
                                            key={player.id || player.username}
                                            className={`flex items-center gap-3 rounded-xl px-4 py-3 ${isMe ? 'bg-show-yellow text-show-night' : 'bg-show-night/45 ring-1 ring-white/5'}`}
                                        >
                                            <span className="w-6 font-brand">{index + 4}</span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-semibold">
                                                    {player.username}
                                                    {isMe && <span className="ml-1 text-xs font-bold">({st('results.you')})</span>}
                                                </span>
                                                <span className={`block text-xs ${isMe ? '' : 'text-show-muted'}`}>{statsLine(player)}</span>
                                            </span>
                                            <span className={`font-brand ${isMe ? '' : 'text-show-yellow'}`}>{player.score ?? 0}</span>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}

                        <p className="text-center text-xs text-show-muted">{st('results.discordNote')}</p>
                    </>
                ) : (
                    <p className="py-16 text-center text-show-muted">{st('results.empty')}</p>
                )}
            </div>
        </GameShell>
    );
}

export default BuzzerResultsView;