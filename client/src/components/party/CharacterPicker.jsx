import React from 'react';
import PixelCharacter from './PixelCharacter';
import { CHARACTERS, PLAYER_COLORS } from './characters/pixelRig';

// Grille des huit personnages, comme les pads carrés du pad controller.
// `takenBy` : personnage -> nom du joueur qui l'a déjà. Le personnage choisi beatboxe.
export default function CharacterPicker({ value, onChange, takenBy = {}, color = PLAYER_COLORS[0], language = 'fr', t }) {
    return (
        <div role="radiogroup" className="grid grid-cols-4 gap-2 sm:gap-3">
            {CHARACTERS.map((c) => {
                const selected = value === c.id;
                const owner = takenBy[c.id];
                return (
                    <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${c.name}${owner ? ` (${t('lobby.taken')} : ${owner})` : ''}`}
                        disabled={Boolean(owner)}
                        onClick={() => onChange(c.id)}
                        className="hw-padkey"
                    >
                        <span className="hw-padkey-stage">
                            <PixelCharacter id={c.id} pose={selected ? 'beatbox' : 'idle'} color={color} crop="body" scale={1} />
                        </span>
                        <span className="mt-1.5 flex w-full items-center justify-center gap-1.5">
                            <span className={`hw-led ${selected ? 'is-on' : ''}`} style={{ '--led': '#F0AE22' }} aria-hidden="true" />
                            <span className="hw-strip-name !text-[0.85rem] uppercase">{c.name}</span>
                        </span>
                        <span className="w-full truncate text-center text-[0.68rem] text-[color:var(--hw-silk-dim)]">{owner || c.tagline[language] || c.tagline.fr}</span>
                    </button>
                );
            })}
        </div>
    );
}
