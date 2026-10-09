import React from 'react';
import { useNavigate } from 'react-router-dom';
import GameShell from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import Podium from '../show/Podium';
import WinnerSpotlight from '../show/WinnerSpotlight';
import RankingRows from '../show/RankingRows';
import { createShowT, LEVEL_POINTS } from '../../utils/showI18n';
import { useArtistCard } from '../../utils/artistCard';

const discordAvatar = (player) => (player?.isDiscordUser && player?.discordId && player?.discordAvatar
    ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=128`
    : undefined);

// Une ligne du récapitulatif : photo, nom, qui l'a trouvé et à quel extrait
function RecapRow({ entry, round, pseudo, st }) {
    const card = useArtistCard(entry.artist);
    const finds = (entry.finds || []).slice().sort((a, b) => a.level - b.level);
    const mine = finds.find((find) => find.pseudo === pseudo);

    return (
        <li className="flex items-center gap-3 rounded-xl bg-show-stage-2/60 px-3 py-2.5 ring-1 ring-show-muted/10">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-show-night font-brand text-xl text-show-muted" aria-hidden="true">
                {card?.photoUrl
                    ? <img src={card.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
                    : (entry.artist || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-show-muted">{st('results.recapRound', { round })}</p>
                <p className="truncate font-brand text-lg leading-tight">{entry.artist}</p>
                <p className="truncate text-xs font-semibold text-show-muted">
                    {finds.length === 0
                        ? st('reveal.nobody')
                        : `${st('reveal.foundBy')} ${finds.map((find) => `${find.pseudo} (${st('reveal.extract', { level: find.level })})`).join(', ')}`}
                </p>
            </div>
            {mine && (
                <span className="shrink-0 rounded-full bg-show-yellow px-2.5 py-1 text-xs font-extrabold tabular-nums text-show-night">
                    +{LEVEL_POINTS[mine.level] ?? 0}
                </span>
            )}
        </li>
    );
}

// Fin de partie : projecteur sur le gagnant, podium, ton résultat, reste du classement,
// puis les beatboxers de la partie (on en découvre toujours un ou deux)
const ResultsView = ({
    finalRanking,
    revealHistory = [],
    pseudo,
    handleNewGame,
    onBackToSite,
    room,
    LanguageSwitch,
    language
}) => {
    const st = createShowT(language);
    const navigate = useNavigate();

    const ranking = (Array.isArray(finalRanking) ? finalRanking.filter(Boolean) : [])
        .slice()
        .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

    const winner = ranking[0];
    const me = ranking.find((player) => player.pseudo === pseudo);
    const myIndex = me ? ranking.indexOf(me) : -1;
    const iWon = Boolean(me) && myIndex === 0;
    const gap = me && winner ? (winner.score ?? 0) - (me.score ?? 0) : 0;

    // Quitter la salle pour de bon : les autres joueurs ne t'attendent pas pour la revanche
    const handleBackToSite = () => {
        if (onBackToSite) onBackToSite();
        else navigate('/');
    };

    return (
        <GameShell
            title={st('blindtest.name')}
            tools={LanguageSwitch ? <LanguageSwitch /> : null}
            language={language}
            actionBar={
                <div className="flex flex-col gap-2">
                    <ShowButton size="lg" block onClick={handleNewGame}>{st('results.newGame')}</ShowButton>
                    <ShowButton variant="outline" size="md" block onClick={handleBackToSite}>{st('results.back')}</ShowButton>
                </div>
            }
        >
            <div className="mx-auto flex max-w-2xl flex-col gap-8">
                {winner ? (
                    <>
                        <WinnerSpotlight
                            kicker={room ? st('results.titleRoom', { room }) : st('results.title')}
                            championLabel={st('results.champion')}
                            name={winner.pseudo}
                            score={winner.score ?? 0}
                            pointsLabel={st('results.points')}
                            avatarUrl={discordAvatar(winner)}
                        />

                        <Podium
                            label={st('results.ranking')}
                            youLabel={st('results.you')}
                            entries={ranking.map((player) => ({
                                key: player.pseudo,
                                name: player.pseudo,
                                score: player.score ?? 0,
                                isMe: player.pseudo === pseudo,
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
                            </section>
                        )}

                        {ranking.length > 3 && (
                            <section>
                                <h2 className="mb-2 text-xs font-extrabold text-show-muted">{st('results.rest')}</h2>
                                <RankingRows
                                    rows={ranking.slice(3).map((player, index) => ({
                                        key: player.pseudo,
                                        rank: index + 4,
                                        name: player.pseudo,
                                        score: player.score ?? 0,
                                        isMe: player.pseudo === pseudo,
                                        avatarUrl: discordAvatar(player),
                                    }))}
                                    youLabel={st('results.you')}
                                />
                            </section>
                        )}

                        {revealHistory.length > 0 && (
                            <section aria-labelledby="results-recap-title">
                                <div className="mb-2 flex items-baseline justify-between gap-3">
                                    <h2 id="results-recap-title" className="text-xs font-extrabold text-show-muted">{st('results.recapTitle')}</h2>
                                    <span className="text-xs font-bold text-show-muted">
                                        {st('results.recapFound', {
                                            count: revealHistory.filter((entry) => entry.finds?.some((find) => find.pseudo === pseudo)).length,
                                            total: revealHistory.length,
                                        })}
                                    </span>
                                </div>
                                <ul className="flex flex-col gap-2">
                                    {revealHistory.map((entry, index) => (
                                        <RecapRow key={`${index}-${entry.artist}`} entry={entry} round={index + 1} pseudo={pseudo} st={st} />
                                    ))}
                                </ul>
                            </section>
                        )}
                    </>
                ) : (
                    <p className="py-16 text-center text-show-muted">{st('results.empty')}</p>
                )}
            </div>
        </GameShell>
    );
};

export default ResultsView;