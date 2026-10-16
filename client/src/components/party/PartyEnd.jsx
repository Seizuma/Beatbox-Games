import React, { useEffect } from 'react';
import PartyScene, { VIEWS, scenePoint } from './board/PartyScene';
import { useNarrow } from './PartyHome';
import { PLAYER_COLORS } from './characters/pixelRig';
import { sfx } from './partySfx';
import { Key, Lcd, LcdText, Panel, PlayerRing } from './ui/Hardware';

// Places sur la scène selon le classement : le vainqueur au micro, au centre
const SPOTS = [[1040, 413], [946, 421], [1134, 421], [1222, 434]];
const POSES = ['cheer', 'dance', 'fist', 'sad'];

// Fin de partie : le vainqueur au micro géant, classement complet, revanche
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
        facing: SPOTS[Math.min(i, 3)][0] > 1040 ? -1 : 1,
    }));

    return (
        <div className="flex flex-col gap-6">
            <Panel className="flex flex-col gap-4 p-4 pt-6 sm:p-6">
                <div className="flex flex-col items-center gap-2 text-center">
                    <span className="hw-label">{t('end.title')}</span>
                    {winner && <h1 className="hw-title hw-pop text-4xl sm:text-6xl">{t('end.winner', { name: winner.name })}</h1>}
                </div>
                <div className="party-scene-bezel">
                    <PartyScene board={board} view={view} actors={actors} stageColor={winner ? PLAYER_COLORS[winner.seat] : null} goldMic={{ x: 863, y: 434 }} cheering>
                        {placed.map(({ p, i }) => (
                            <span key={p.id} className="party-scene-label" style={{ ...scenePoint(view, SPOTS[Math.min(i, 3)][0], SPOTS[Math.min(i, 3)][1] + 10), '--tag': PLAYER_COLORS[p.seat] }}>
                                {narrow ? i + 1 : `${i + 1}. ${p.name}`}
                            </span>
                        ))}
                    </PartyScene>
                </div>
            </Panel>

            <Panel className="p-5 pt-8 sm:p-6 sm:pt-9" label={t('end.rank')}>
                <ol className="flex flex-col gap-2">
                    {placed.map(({ r, p }) => (
                        <li key={r.playerId} className={`hw-strip ${r.playerId === myId ? 'is-active' : ''}`}>
                            <Lcd className="flex h-10 w-10 shrink-0 items-center justify-center"><LcdText text={r.rank} font="bold" scale={2} color={r.rank === 1 ? '#F0AE22' : undefined} /></Lcd>
                            <PlayerRing player={p} color={PLAYER_COLORS[p.seat]} size={46} active={r.rank === 1} pose={r.rank === 1 ? 'cheer' : 'idle'} />
                            <span className="hw-strip-name min-w-0 flex-1 !text-lg">{p.name}</span>
                            <Lcd className="flex items-center gap-4 px-3 py-1.5">
                                <span className="flex flex-col items-center gap-1">
                                    <LcdText text={r.stars} font="bold" scale={2} color="#F0AE22" />
                                    <span className="hw-label !text-[0.58rem]">{t('end.stars')}</span>
                                </span>
                                <span className="flex flex-col items-center gap-1">
                                    <LcdText text={r.hype} font="bold" scale={2} />
                                    <span className="hw-label !text-[0.58rem]">{t('end.hype')}</span>
                                </span>
                                <span className="hidden flex-col items-center gap-1 sm:flex">
                                    <LcdText text={r.minigameWins} font="bold" scale={2} />
                                    <span className="hw-label !text-[0.58rem]">{t('end.wins')}</span>
                                </span>
                            </Lcd>
                        </li>
                    ))}
                </ol>
            </Panel>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {isHost ? (
                    <Key size="lg" led="red" onClick={onRematch}>{t('end.rematch')}</Key>
                ) : (
                    <p className="hw-label !text-sm">{t('end.waitingHost')}</p>
                )}
                <Key size="md" onClick={onLeave}>{t('end.back')}</Key>
            </div>
        </div>
    );
}
