import React, { useEffect } from 'react';
import PartyScene, { VIEWS, scenePoint } from './board/PartyScene';
import { useNarrow } from './PartyHome';
import { PLAYER_COLORS } from './characters/pixelRig';
import { sfx } from './partySfx';

// Places sur la scène selon le classement : le vainqueur au micro, au centre
const SPOTS = [[800, 318], [728, 324], [872, 324], [940, 334]];
const POSES = ['cheer', 'dance', 'fist', 'sad'];

// Fin de partie : le vainqueur sous le projecteur, classement complet, revanche
export default function PartyEnd({ board, state, myId, t, onRematch, onLeave }) {
    const ranking = state.finalRanking || [];
    const byId = (id) => state.players.find((p) => p.id === id);
    const winner = ranking[0] && byId(ranking[0].playerId);
    const isHost = state.hostId === myId;
    const narrow = useNarrow();
    const view = narrow ? VIEWS.endNarrow : VIEWS.end;

    useEffect(() => {
        sfx('win');
    }, []);

    const placed = ranking.map((r, i) => ({ r, p: byId(r.playerId), i })).filter((x) => x.p);
    const actors = placed.map(({ p, i }) => ({
        id: p.characterId,
        pose: POSES[Math.min(i, 3)],
        color: PLAYER_COLORS[p.seat],
        x: SPOTS[Math.min(i, 3)][0],
        y: SPOTS[Math.min(i, 3)][1],
        facing: SPOTS[Math.min(i, 3)][0] > 800 ? -1 : 1,
    }));

    return (
        <div className="flex flex-col gap-6">
            <section className="party-panel overflow-hidden">
                <div className="px-5 pb-4 pt-5 text-center sm:pt-6">
                    <p className="party-kicker">{t('end.title')}</p>
                    {winner && <h1 className="party-display party-pop mt-1 text-3xl sm:text-5xl" style={{ color: PLAYER_COLORS[winner.seat], textShadow: `0 0 24px ${PLAYER_COLORS[winner.seat]}88` }}>{t('end.winner', { name: winner.name })}</h1>}
                </div>
                <PartyScene board={board} view={view} actors={actors} stageColor={winner ? PLAYER_COLORS[winner.seat] : null} goldMic={{ x: 664, y: 334 }} cheering>
                    {placed.map(({ p, i }) => (
                        <span key={p.id} className="party-scene-label" style={{ ...scenePoint(view, SPOTS[Math.min(i, 3)][0], SPOTS[Math.min(i, 3)][1] + 8), borderColor: PLAYER_COLORS[p.seat] }}>
                            {narrow ? i + 1 : `${i + 1}. ${p.name}`}
                        </span>
                    ))}
                </PartyScene>
            </section>

            <section className="party-panel p-5">
                <h2 className="party-display text-2xl">{t('end.rank')}</h2>
                <ol className="mt-4 flex flex-col gap-2">
                    {placed.map(({ r, p }) => (
                        <li
                            key={r.playerId}
                            className="flex items-center gap-3 rounded-xl bg-[#0A0F27]/70 px-3 py-2"
                            style={{ boxShadow: r.playerId === myId ? `inset 0 0 0 2px ${PLAYER_COLORS[p.seat]}` : 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
                        >
                            <span className="party-display w-8 text-center text-2xl" style={{ color: PLAYER_COLORS[p.seat] }}>{r.rank}</span>
                            <span className="min-w-0 flex-1 truncate text-lg font-extrabold">{p.name}</span>
                            <span className="party-lcd flex items-center gap-4 px-3 py-1">
                                <span className="flex flex-col items-center leading-none">
                                    <span className="party-lcd-digits text-xl">{r.stars}</span>
                                    <span className="mt-0.5 text-[0.62rem] font-bold text-[color:var(--px-muted)]">{t('end.stars')}</span>
                                </span>
                                <span className="flex flex-col items-center leading-none">
                                    <span className="party-lcd-digits text-xl">{r.hype}</span>
                                    <span className="mt-0.5 text-[0.62rem] font-bold text-[color:var(--px-muted)]">{t('end.hype')}</span>
                                </span>
                                <span className="hidden flex-col items-center leading-none sm:flex">
                                    <span className="party-lcd-digits text-xl">{r.minigameWins}</span>
                                    <span className="mt-0.5 text-[0.62rem] font-bold text-[color:var(--px-muted)]">{t('end.wins')}</span>
                                </span>
                            </span>
                        </li>
                    ))}
                </ol>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {isHost ? (
                    <button type="button" className="party-btn party-btn-big" onClick={onRematch}>{t('end.rematch')}</button>
                ) : (
                    <p className="font-bold text-[color:var(--px-muted)]">{t('end.waitingHost')}</p>
                )}
                <button type="button" className="party-btn party-btn-ghost" onClick={onLeave}>{t('end.back')}</button>
            </div>
        </div>
    );
}
