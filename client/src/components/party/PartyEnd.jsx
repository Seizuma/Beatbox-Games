import React, { useEffect } from 'react';
import PixelCharacter from './PixelCharacter';
import { PLAYER_COLORS } from './characters/pixelRig';
import { sfx } from './partySfx';

const PODIUM = [
    { place: 2, height: 'h-16', order: 'order-1' },
    { place: 1, height: 'h-24', order: 'order-2' },
    { place: 3, height: 'h-10', order: 'order-3' },
];

// Fin de partie : podium, classement complet, revanche
export default function PartyEnd({ state, myId, t, onRematch, onLeave }) {
    const ranking = state.finalRanking || [];
    const byId = (id) => state.players.find((p) => p.id === id);
    const winner = ranking[0] && byId(ranking[0].playerId);
    const isHost = state.hostId === myId;

    useEffect(() => {
        sfx('win');
    }, []);

    return (
        <div className="flex flex-col gap-6">
            <section className="party-panel flex flex-col items-center gap-4 p-5 sm:p-7">
                <p className="party-font text-sm text-[color:var(--px-muted)]">{t('end.title')}</p>
                {winner && <h1 className="party-font party-pop text-center text-3xl text-[color:var(--px-yellow)] sm:text-4xl">{t('end.winner', { name: winner.name })}</h1>}
                <div className="flex items-end justify-center gap-2 sm:gap-4">
                    {PODIUM.map(({ place, height, order }) => {
                        const entry = ranking.find((r, i) => i === place - 1);
                        const p = entry && byId(entry.playerId);
                        if (!p) return <div key={place} className={order} />;
                        return (
                            <div key={place} className={`flex flex-col items-center ${order}`}>
                                <PixelCharacter id={p.characterId} color={PLAYER_COLORS[p.seat]} pose={place === 1 ? 'cheer' : 'dance'} scale={place === 1 ? 3 : 2.5} label={p.name} />
                                <div className={`party-font flex w-24 items-start justify-center border-[3px] border-[#0B0E22] pt-1 text-2xl text-[#1A1C2C] sm:w-28 ${height}`} style={{ background: PLAYER_COLORS[p.seat] }}>
                                    {place}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="party-panel p-5">
                <h2 className="party-font text-lg">{t('end.rank')}</h2>
                <table className="mt-3 w-full text-left text-sm sm:text-base">
                    <thead className="party-font text-[0.7rem] text-[color:var(--px-muted)]">
                        <tr>
                            <th className="py-1 pr-2 font-normal">#</th>
                            <th className="py-1 pr-2 font-normal" aria-label="Joueur" />
                            <th className="py-1 pr-2 text-right font-normal">{t('end.stars')}</th>
                            <th className="py-1 pr-2 text-right font-normal">{t('end.hype')}</th>
                            <th className="py-1 text-right font-normal">{t('end.wins')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ranking.map((r) => {
                            const p = byId(r.playerId);
                            if (!p) return null;
                            return (
                                <tr key={r.playerId} className={`border-t-2 border-[color:var(--px-line)] ${r.playerId === myId ? 'text-[color:var(--px-yellow)]' : ''}`}>
                                    <td className="party-font py-2 pr-2">{r.rank}</td>
                                    <td className="py-2 pr-2 font-bold">{p.name}</td>
                                    <td className="party-font py-2 pr-2 text-right">★{r.stars}</td>
                                    <td className="party-font py-2 pr-2 text-right">{r.hype}</td>
                                    <td className="party-font py-2 text-right">{r.minigameWins}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row">
                {isHost ? (
                    <button type="button" className="party-btn party-btn-big" onClick={onRematch}>{t('end.rematch')}</button>
                ) : (
                    <p className="party-font self-center text-sm text-[color:var(--px-muted)]">{t('end.waitingHost')}</p>
                )}
                <button type="button" className="party-btn party-btn-ghost" onClick={onLeave}>{t('end.back')}</button>
            </div>
        </div>
    );
}
