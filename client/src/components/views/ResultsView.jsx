import React from 'react';
import { useNavigate } from 'react-router-dom';
import GameShell from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import Podium from '../show/Podium';
import { createShowT } from '../../utils/showI18n';

// Fin de partie : podium, classement complet, nouvelle partie ou retour au site
const ResultsView = ({
    finalRanking,
    pseudo,
    handleNewGame,
    room,
    LanguageSwitch,
    GameModeBadge,
    language
}) => {
    const st = createShowT(language);
    const navigate = useNavigate();

    const ranking = (Array.isArray(finalRanking) ? finalRanking.filter(Boolean) : [])
        .slice()
        .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

    const winner = ranking[0];
    const others = ranking.slice(3);

    const handleBackToSite = () => {
        handleNewGame();
        navigate('/');
    };

    return (
        <GameShell
            title={st('blindtest.name')}
            tools={LanguageSwitch ? <LanguageSwitch /> : null}
            actionBar={
                <div className="flex flex-col gap-2">
                    <ShowButton size="lg" block onClick={handleNewGame}>{st('results.newGame')}</ShowButton>
                    <ShowButton variant="outline" size="md" block onClick={handleBackToSite}>{st('results.back')}</ShowButton>
                </div>
            }
        >
            <div className="mx-auto flex max-w-2xl flex-col gap-10">
                {winner ? (
                    <>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-show-muted">
                                {room ? st('results.titleRoom', { room }) : st('results.title')}
                            </p>
                            <h1 className="mt-2 break-words font-brand text-4xl leading-tight sm:text-5xl">
                                {st('results.winner', { name: winner.pseudo })}
                            </h1>
                            <p className="mt-2 text-show-muted">{st('results.winnerScore', { score: winner.score ?? 0 })}</p>
                            {GameModeBadge && <div className="mt-3 flex justify-center"><GameModeBadge /></div>}
                        </div>

                        <Podium
                            label={st('results.ranking')}
                            youLabel={st('results.you')}
                            entries={ranking.map((player) => ({
                                key: player.pseudo,
                                name: player.pseudo,
                                score: player.score ?? 0,
                                isMe: player.pseudo === pseudo,
                                avatarUrl: player.isDiscordUser ? player.avatarUrl : undefined,
                            }))}
                        />

                        {others.length > 0 && (
                            <ol className="flex flex-col gap-2" start={4}>
                                {others.map((player, index) => {
                                    const isMe = player.pseudo === pseudo;
                                    return (
                                        <li
                                            key={player.pseudo}
                                            className={`flex items-center gap-3 rounded-xl px-4 py-3 ${isMe ? 'bg-show-yellow text-show-night' : 'bg-show-night/45 ring-1 ring-white/5'}`}
                                        >
                                            <span className="w-6 font-brand">{player.rank ?? index + 4}</span>
                                            <span className="min-w-0 flex-1 truncate font-semibold">
                                                {player.pseudo}
                                                {isMe && <span className="ml-1 text-xs font-bold">({st('results.you')})</span>}
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
};

export default ResultsView;