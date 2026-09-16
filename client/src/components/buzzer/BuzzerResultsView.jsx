import React from 'react';
import GameShell from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import Podium from '../show/Podium';
import WinnerSpotlight from '../show/WinnerSpotlight';
import RankingRows from '../show/RankingRows';
import { createShowT } from '../../utils/showI18n';

const discordAvatar = (player) => (player?.isDiscordUser && player?.discordId && player?.discordAvatar
    ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=128`
    : undefined);

// Fin de partie du Buzzer Battle : projecteur sur le gagnant, podium, ton résultat, reste du classement
function BuzzerResultsView({ scores, onPlayAgain, onBackToHome, myPlayerId, language, languageSwitch }) {
    const st = createShowT(language);
    const ranking = Array.isArray(scores) ? scores.filter(Boolean) : [];
    const winner = ranking[0];

    const isMe = (player) => player.id === myPlayerId;
    const me = ranking.find(isMe);
    const myIndex = me ? ranking.indexOf(me) : -1;
    const iWon = Boolean(me) && myIndex === 0;
    const gap = me && winner ? (winner.score ?? 0) - (me.score ?? 0) : 0;

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
            language={language}
            actionBar={
                <div className="flex flex-col gap-2">
                    {winner && <ShowButton size="lg" block onClick={onPlayAgain}>{st('buzzerResults.playAgain')}</ShowButton>}
                    <ShowButton variant={winner ? 'outline' : 'yellow'} size={winner ? 'md' : 'lg'} block onClick={onBackToHome}>
                        {st('results.back')}
                    </ShowButton>
                </div>
            }
        >
            <div className="mx-auto flex max-w-2xl flex-col gap-8">
                {winner ? (
                    <>
                        <WinnerSpotlight
                            kicker={st('results.title')}
                            championLabel={st('results.champion')}
                            name={winner.username}
                            score={winner.score ?? 0}
                            pointsLabel={st('results.points')}
                            detail={statsLine(winner)}
                            avatarUrl={discordAvatar(winner)}
                        />

                        <Podium
                            label={st('results.ranking')}
                            youLabel={st('results.you')}
                            entries={ranking.map((player) => ({
                                key: player.id || player.username,
                                name: player.username,
                                score: player.score ?? 0,
                                isMe: isMe(player),
                                avatarUrl: discordAvatar(player),
                            }))}
                        />

                        {me && (
                            <section className="rounded-2xl bg-show-stage-2/70 px-5 py-4 ring-1 ring-show-muted/15">
                                <h2 className="text-xs font-extrabold text-show-muted">{st('results.yourResult')}</h2>
                                <dl className="mt-3 grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <dd className="font-brand text-2xl">{myIndex + 1}</dd>
                                        <dt className="mt-1 text-[11px] font-bold text-show-muted">
                                            {st('results.outOf', { total: ranking.length })}
                                        </dt>
                                    </div>
                                    <div>
                                        <dd className="font-brand text-2xl tabular-nums">{me.score ?? 0}</dd>
                                        <dt className="mt-1 text-[11px] font-bold text-show-muted">{st('results.points')}</dt>
                                    </div>
                                    <div>
                                        <dd className="font-brand text-2xl tabular-nums text-show-yellow">
                                            {iWon ? '—' : `+${gap}`}
                                        </dd>
                                        <dt className="mt-1 text-[11px] font-bold text-show-muted">
                                            {iWon ? st('results.champion') : st('results.gapToFirst')}
                                        </dt>
                                    </div>
                                </dl>
                                <p className="mt-3 text-center text-xs text-show-muted">{statsLine(me)}</p>
                            </section>
                        )}

                        {ranking.length > 3 && (
                            <section>
                                <h2 className="mb-2 text-xs font-extrabold text-show-muted">{st('results.rest')}</h2>
                                <RankingRows
                                    rows={ranking.slice(3).map((player, index) => ({
                                        key: player.id || player.username,
                                        rank: index + 4,
                                        name: player.username,
                                        score: player.score ?? 0,
                                        isMe: isMe(player),
                                        avatarUrl: discordAvatar(player),
                                        detail: statsLine(player),
                                    }))}
                                    youLabel={st('results.you')}
                                />
                            </section>
                        )}
                    </>
                ) : (
                    <p className="py-16 text-center text-show-muted">{st('results.empty')}</p>
                )}
            </div>
        </GameShell>
    );
}

export default BuzzerResultsView;