import React, { useRef, useState } from 'react';
import PixelCharacter from '../PixelCharacter';
import { PLAYER_COLORS } from '../characters/pixelRig';
import { sfx } from '../partySfx';
import { useFrame, useOnce, usePressKeys } from './shared';

// Dégaine : attendre le drop, appuyer le premier. Le temps de réaction est mesuré
// sur l'horloge du joueur, à partir du moment où le signal s'affiche chez lui.
export default function Degaine({ minigame, players, myId, t, clock, onSubmit }) {
    const [done, mark] = useOnce();
    const [phase, setPhase] = useState('wait'); // wait, go, sent, tooSoon
    const [reaction, setReaction] = useState(null);
    const signalShown = useRef(null);
    const { signalAt } = minigame.params;

    useFrame(() => {
        const elapsed = clock();
        if (signalShown.current == null && elapsed >= signalAt) {
            signalShown.current = performance.now() - (elapsed - signalAt);
            setPhase((current) => (current === 'wait' ? 'go' : current));
            sfx('drop');
        }
    });

    const press = () => {
        if (done || clock() < 0) return;
        mark();
        if (signalShown.current == null) {
            setPhase('tooSoon');
            sfx('fail');
            onSubmit({ falseStart: true });
            return;
        }
        const ms = Math.round(performance.now() - signalShown.current);
        setReaction(ms);
        setPhase('sent');
        sfx('snare');
        onSubmit({ reaction: ms });
    };
    usePressKeys({ onDown: press });

    const go = signalShown.current != null;
    return (
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
            <div
                role="presentation"
                onPointerDown={press}
                className="party-panel flex min-h-[15rem] cursor-pointer select-none flex-col items-center justify-center gap-3 p-4 text-center"
                style={go && phase !== 'tooSoon' ? { background: '#FFC72C', color: '#1A1C2C' } : undefined}
            >
                <p className={`party-font ${go ? 'party-pop text-5xl sm:text-7xl' : 'text-xl text-[color:var(--px-muted)] sm:text-2xl'}`}>
                    {phase === 'tooSoon' ? t('minigame.degaine.tooSoon') : go ? t('minigame.degaine.go') : t('minigame.degaine.wait')}
                </p>
                {reaction != null && <p className="party-font text-2xl">{t('minigame.display.ms', { n: reaction })}</p>}
                <div className="flex items-end justify-center gap-1 sm:gap-3">
                    {players.map((p) => (
                        <PixelCharacter
                            key={p.id}
                            id={p.characterId}
                            color={PLAYER_COLORS[p.seat]}
                            pose={p.id === myId && phase === 'sent' ? 'beatbox' : p.id === myId && phase === 'tooSoon' ? 'sad' : go ? 'hop' : 'idle'}
                            scale={2}
                        />
                    ))}
                </div>
            </div>
            <button type="button" className="party-btn party-btn-big w-full" onPointerDown={(event) => { event.preventDefault(); press(); }} disabled={done}>
                {t('minigame.degaine.press')}
            </button>
        </div>
    );
}
