import React from 'react';
import { useNavigate } from 'react-router-dom';
import GameShell from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import Lectern from '../show/Lectern';
import { createShowT } from '../../utils/showI18n';

// Hauteur des socles du podium : 2e, 1er, 3e
const PODIUM = [
    { position: 1, baseClassName: 'min-h-[4.5rem] sm:min-h-[5.5rem]' },
    { position: 0, baseClassName: 'min-h-[6.5rem] sm:min-h-[8rem]' },
    { position: 2, baseClassName: 'min-h-[3.5rem] sm:min-h-[4rem]' },
];

// Fin de partie : podium de pupitres, classement complet, nouvelle partie ou retour au site
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
            status={GameModeBadge ? <GameModeBadge /> : null}
            tools={LanguageSwitch ? <LanguageSwitch /> : null}
            actionBar={
                <div className="flex flex-col gap-2">
                    <ShowButton size="lg" block onClick={handleNewGame}>{st('results.newGame')}</ShowButton>
                    <ShowButton variant="outline" size="md" block onClick={handleBackToSite}>{st('results.back')}</ShowButton>
                </div>
            }
        >
            <div className="mx-auto flex max-w-xl flex-col gap-8">
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
                        </div>

                        <ol className="grid grid-cols-[1fr_1.15fr_1fr] items-end gap-2 sm:gap-3" aria-label={st('results.ranking')}>
                            {PODIUM.map(({ position, baseClassName }) => {
                                const player = ranking[position];
                                if (!player) return <li key={position} aria-hidden="true" />;
                                return (
                                    <li key={player.pseudo}>
                                        <Lectern
                                            name={`${player.rank ?? position + 1}. ${player.pseudo}`}
                                            value={player.score ?? 0}
                                            caption={player.pseudo === pseudo ? st('results.you') : undefined}
                                            lamp={position === 0 ? 'ready' : 'idle'}
                                            highlight={player.pseudo === pseudo}
                                            baseClassName={baseClassName}
                                        />
                                    </li>
                                );
                            })}
                        </ol>

                        {others.length > 0 && (
                            <ol className="flex flex-col gap-2">
                                {others.map((player, index) => (
                                    <li
                                        key={player.pseudo}
                                        className={`flex items-center gap-3 rounded-xl px-4 py-3 ${player.pseudo === pseudo ? 'bg-show-yellow text-show-night' : 'border border-show-desk'}`}
                                    >
                                        <span className="w-6 font-brand">{player.rank ?? index + 4}</span>
                                        <span className="min-w-0 flex-1 truncate font-semibold">
                                            {player.pseudo}
                                            {player.pseudo === pseudo && <span className="ml-1 text-xs font-bold">({st('results.you')})</span>}
                                        </span>
                                        <span className={`font-brand ${player.pseudo === pseudo ? '' : 'text-show-yellow'}`}>{player.score ?? 0}</span>
                                    </li>
                                ))}
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