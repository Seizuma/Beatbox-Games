import React, { useEffect, useMemo, useRef, useState } from 'react';
import PartyScene, { VIEWS, scenePoint } from './board/PartyScene';
import { useNarrow } from './PartyHome';
import { SEATS } from './PartyLobby';
import { PLAYER_COLORS } from './characters/pixelRig';
import { sfx } from './partySfx';
import { Key, PlayerRing } from './ui/Hardware';
import { CoinIcon, MicIcon } from './PartyIcons';

// Places sur les gros pads selon le classement : le vainqueur sur le pad 3, avec le Micro d'or
const SPOTS = [[978, 1008], [755, 1008], [1245, 1008], [1490, 1008]];
const POSES = ['cheer', 'dance', 'fist', 'sad'];
// Podium : une place révélée toutes les REVEAL_MS, en partant de la dernière ; le vainqueur après un roulement
const REVEAL_MS = 1100;
const DRUMROLL_MS = 2200;

const byStanding = (a, b) => (b.stars - a.stars) || (b.hype - a.hype);

// Une carte de Micro bonus : cachée, puis révélée avec son ou ses gagnants
function BonusCard({ bonus, players, t, fresh }) {
    if (!bonus.revealed) {
        return (
            <div className="party-bonus is-hidden">
                <span className="hw-title text-5xl text-[color:var(--hw-amber)]" aria-hidden="true">?</span>
                <span className="hw-label">{t('end.bonusHidden')}</span>
            </div>
        );
    }
    const winners = bonus.winners.map((id) => players.find((p) => p.id === id)).filter(Boolean);
    return (
        <div className={`party-bonus ${fresh ? 'hw-pop' : ''}`}>
            <p className="hw-title text-2xl text-[color:var(--hw-amber)]">{t(`end.bonus.${bonus.id}.name`)}</p>
            <p className="hw-text text-sm">{t(`end.bonus.${bonus.id}.info`)}</p>
            {winners.length ? (
                <ul className="mt-1 flex flex-wrap gap-3">
                    {winners.map((p) => (
                        <li key={p.id} className="flex items-center gap-2">
                            <PlayerRing player={p} color={PLAYER_COLORS[p.seat]} size={44} active pose="cheer" />
                            <span className="flex flex-col">
                                <span className="hw-strip-name">{p.name}</span>
                                <span className="hw-label !text-[0.62rem]">{t(`end.bonus.${bonus.id}.value`, { n: bonus.value })}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="hw-label mt-1">{t('end.bonusNobody')}</p>
            )}
        </div>
    );
}

// Fin de partie : Micros bonus révélés un à un, puis podium (du dernier au premier), revanche
export default function PartyEnd({ board, state, myId, t, onRematch, onLeave }) {
    const narrow = useNarrow();
    const step = state.step;
    const podium = step === 'podium';
    const bonuses = state.bonuses || [];
    const revealed = bonuses.filter((b) => b.revealed).length;
    const latest = [...bonuses].reverse().find((b) => b.revealed) || null;
    const ranking = useMemo(() => (podium ? state.finalRanking || [] : []), [podium, state.finalRanking]);
    const byId = (id) => state.players.find((p) => p.id === id);
    const isHost = state.hostId === myId;

    // Podium : nombre de places révélées (en partant de la dernière)
    const [shown, setShown] = useState(0);
    useEffect(() => {
        if (!podium || !ranking.length) {
            setShown(0);
            return undefined;
        }
        const total = ranking.length;
        const timers = [];
        for (let k = 1; k < total; k += 1) timers.push(setTimeout(() => { setShown(k); sfx('coin'); }, k * REVEAL_MS));
        timers.push(setTimeout(() => { setShown(total); sfx('win'); }, (total - 1) * REVEAL_MS + DRUMROLL_MS));
        return () => timers.forEach(clearTimeout);
    }, [podium, ranking.length]);
    const done = podium && shown >= ranking.length && ranking.length > 0;

    // Un son à chaque Micro bonus révélé
    const lastRevealed = useRef(revealed);
    useEffect(() => {
        if (revealed > lastRevealed.current) sfx('star');
        lastRevealed.current = revealed;
    }, [revealed]);

    const winner = done ? byId(ranking[0].playerId) : null;
    const view = narrow ? VIEWS.endNarrow : VIEWS.end;

    // Sur scène : alignés par place pendant les révélations, sur le podium à la fin
    let placed;
    if (done) {
        placed = ranking.map((r, i) => ({ p: byId(r.playerId), spot: SPOTS[Math.min(i, 3)], pose: POSES[Math.min(r.rank - 1, 3)] })).filter((x) => x.p);
    } else {
        const latestWinners = latest ? latest.winners : [];
        placed = [...state.players].sort((a, b) => a.seat - b.seat).map((p) => ({
            p,
            spot: SEATS[p.seat],
            pose: latestWinners.includes(p.id) ? 'cheer' : podium ? 'think' : 'idle',
        }));
    }
    const actors = placed.map(({ p, spot, pose }) => ({
        id: p.characterId,
        pose,
        color: PLAYER_COLORS[p.seat],
        x: spot[0],
        y: spot[1],
        facing: spot[0] > 1000 ? -1 : 1,
    }));

    // Titre du moment
    let kicker = t('end.title');
    let title = '';
    let sub = '';
    let line = '';
    if (step === 'bonusIntro') {
        title = t('end.bonusIntro');
        sub = t('end.bonusIntroText', { n: bonuses.length });
    } else if (step === 'bonus' && latest) {
        kicker = t('end.bonusTitle');
        title = t(`end.bonus.${latest.id}.name`);
        sub = t(`end.bonus.${latest.id}.info`);
        const names = latest.winners.map((id) => (byId(id) || {}).name).filter(Boolean);
        line = names.length ? t('end.bonusWinners', { names: names.join(', '), value: t(`end.bonus.${latest.id}.value`, { n: latest.value }) }) : t('end.bonusNobody');
    } else if (podium && !done) {
        title = t('end.drumroll');
    } else if (winner) {
        title = t('end.winner', { name: winner.name });
        if (state.tiebreak && ranking[1]) {
            const second = byId(ranking[1].playerId);
            sub = t('end.tiebreak', { n: ranking[0].stars, a: winner.name, ha: ranking[0].hype, b: second ? second.name : '', hb: ranking[1].hype });
        }
    }

    // Classement : provisoire pendant les Micros bonus, révélé du dernier au premier au podium
    const standings = podium
        ? ranking.map((r, i) => ({ r, p: byId(r.playerId), hidden: i < ranking.length - shown })).filter((x) => x.p)
        : [...state.players].sort(byStanding).map((p, i) => ({ r: { playerId: p.id, rank: i + 1, stars: p.stars, hype: p.hype, minigameWins: p.minigameWins }, p, hidden: false }));

    return (
        <div className="flex flex-col gap-5">
            <section className="hw-panel flex flex-col gap-4 px-3 pb-4 pt-1 sm:px-5" aria-label={kicker}>
                <div className="flex min-h-[6.5rem] flex-col items-center justify-center gap-2 text-center">
                    <span className="hw-label">{kicker}</span>
                    <h1 key={title} className={`hw-title hw-pop text-4xl sm:text-6xl ${podium && !done ? 'hw-blink' : ''}`}>{title}</h1>
                    {sub && <p className="hw-text max-w-2xl text-base sm:text-lg">{sub}</p>}
                    {line && <p key={line} className="hw-title hw-pop text-2xl text-[color:var(--hw-amber)] sm:text-3xl">{line}</p>}
                </div>
                <div className="party-scene-bezel">
                    <PartyScene board={board} view={view} actors={actors} stageColor={winner ? PLAYER_COLORS[winner.seat] : null} goldMic={done ? { x: 1036, y: 1000 } : null} cheering={done || step === 'bonus'}>
                        {placed.map(({ p, spot }, i) => (
                            <span key={p.id} className="party-scene-label" style={{ ...scenePoint(view, spot[0], spot[1] + 70), '--tag': PLAYER_COLORS[p.seat] }}>
                                {done ? (narrow ? i + 1 : `${i + 1}. ${p.name}`) : p.name}
                            </span>
                        ))}
                    </PartyScene>
                </div>
            </section>

            {bonuses.length > 0 && (
                <section className="hw-panel flex flex-col gap-3 px-3 pb-4 pt-1 sm:px-5" aria-label={t('end.bonusTitle')}>
                    <h2 className="px-menu-title">{t('end.bonusTitle')}</h2>
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))' }}>
                        {bonuses.map((b, i) => <BonusCard key={i} bonus={b} players={state.players} t={t} fresh={b.revealed && latest === b} />)}
                    </div>
                </section>
            )}

            {/* Tableau des scores (14-B) : révélé du dernier au premier au podium */}
            <section className="hw-panel flex flex-col gap-3 px-3 pb-4 pt-1 sm:px-5" aria-label={podium ? t('end.rank') : t('end.standings')}>
                <h2 className="px-tag self-center text-3xl">{podium ? t('end.highScores') : t('end.standings')}</h2>
                <table className="px-scores">
                    <thead>
                        <tr>
                            <th scope="col">{t('minigame.colRank')}</th>
                            <th scope="col">{t('minigame.colPlayer')}</th>
                            <th scope="col" className="text-right">{t('end.stars')}</th>
                            <th scope="col" className="text-right">{t('end.hype')}</th>
                            <th scope="col" className="hidden text-right sm:table-cell">{t('end.wins')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {standings.map(({ r, p, hidden }) => {
                            const first = !hidden && podium && r.rank === 1;
                            return (
                                <tr key={r.playerId} className={`${r.playerId === myId ? 'is-me' : ''} ${first ? 'is-first' : ''} ${hidden ? 'opacity-40' : 'hw-pop'}`}>
                                    <td className="px-num" style={{ color: first ? 'var(--px-gold)' : undefined }}>{hidden ? '?' : t(`screen.rank.${r.rank}`)}</td>
                                    <td>
                                        <span className="flex items-center gap-2">
                                            <PlayerRing player={p} color={PLAYER_COLORS[p.seat]} size={40} active={first} pose={first ? 'cheer' : 'idle'} dim={hidden} />
                                            <span className={`min-w-0 truncate ${first ? 'hw-blink text-[color:var(--hw-amber)]' : ''}`}>{p.name}</span>
                                        </span>
                                    </td>
                                    <td className="px-num text-right text-[color:var(--hw-amber)]">
                                        <span className="inline-flex items-center gap-1"><MicIcon size={14} />{hidden ? '-' : r.stars}</span>
                                    </td>
                                    <td className="px-num text-right">
                                        <span className="inline-flex items-center gap-1"><CoinIcon size={13} />{hidden ? '-' : r.hype}</span>
                                    </td>
                                    <td className="px-num hidden text-right sm:table-cell">{hidden ? '-' : r.minigameWins}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </section>

            {done && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {isHost ? (
                        <Key size="lg" className="hw-key-primary" onClick={onRematch}>{t('end.rematch')}</Key>
                    ) : (
                        <p className="hw-label !text-sm">{t('end.waitingHost')}</p>
                    )}
                    <Key size="md" onClick={onLeave}>{t('end.back')}</Key>
                </div>
            )}
        </div>
    );
}
