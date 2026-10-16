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
                className="hw-panel flex min-h-[16rem] cursor-pointer select-none flex-col items-center justify-center gap-3 overflow-hidden p-4 text-center transition-colors"
                style={go && phase !== 'tooSoon'
                    ? { background: 'radial-gradient(circle at 50% 40%, #f6c65a 0%, #F0AE22 50%, #a8740e 100%)', color: '#141210' }
                    : phase === 'tooSoon' ? { background: 'linear-gradient(180deg, #4a1712, #1f0a08)' } : undefined}
            >
                <p className={`hw-title ${go ? 'hw-pop text-6xl sm:text-8xl' : 'hw-blink text-2xl text-[color:var(--hw-silk-dim)] sm:text-3xl'}`}>
                    {phase === 'tooSoon' ? t('minigame.degaine.tooSoon') : go ? t('minigame.degaine.go') : t('minigame.degaine.wait')}
                </p>
                {reaction != null && <p className="hw-title text-3xl">{t('minigame.display.ms', { n: reaction })}</p>}
                <div className="flex items-end justify-center gap-1 sm:gap-3">
                    {players.map((p) => (
                        <PixelCharacter
                            key={p.id}
                            id={p.characterId}
                            color={PLAYER_COLORS[p.seat]}
                            pose={p.id === myId && phase === 'sent' ? 'cheer' : p.id === myId && phase === 'tooSoon' ? 'shock' : go ? 'diceHit' : 'think'}
                            crop="body"
                            scale={1}
                        />
                    ))}
                </div>
            </div>
            <button type="button" className="hw-key hw-key-lg w-full" onPointerDown={(event) => { event.preventDefault(); press(); }} disabled={done}>
                <span className="hw-led is-on" style={{ '--led': '#2EB75E' }} aria-hidden="true" />
                {t('minigame.degaine.press')}
            </button>
        </div>
    );
}
