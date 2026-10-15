import React from 'react';
import PixelCharacter from './PixelCharacter';
import { CHARACTERS, PLAYER_COLORS } from './characters/pixelRig';

// Grille des huit personnages. `takenBy` : personnage -> nom du joueur qui l'a déjà.
// Le personnage choisi beatboxe ; les autres attendent.
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
                        className={`group relative flex flex-col items-center overflow-hidden rounded-2xl px-1 pb-2 pt-1 transition ${selected
                            ? 'bg-[#1E2A62] shadow-[0_0_0_2px_var(--px-yellow),0_0_24px_rgba(255,199,44,0.25)]'
                            : 'bg-[#0D1433] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:bg-[#141D47]'} disabled:cursor-not-allowed disabled:opacity-40`}
                        style={{ '--pc': selected ? color : '#3B4480' }}
                    >
                        <span
                            className="pointer-events-none absolute inset-x-2 bottom-7 h-6 rounded-[50%] opacity-80"
                            style={{ background: `radial-gradient(ellipse at center, ${selected ? color : '#2A3470'} 0%, transparent 70%)` }}
                            aria-hidden="true"
                        />
                        <PixelCharacter id={c.id} pose={selected ? 'beatbox' : 'idle'} color={color} crop="body" scale={1} className="relative h-auto w-full max-w-[64px]" />
                        <span className="mt-1 w-full truncate text-center text-xs font-extrabold sm:text-sm">{c.name}</span>
                        <span className="w-full truncate text-center text-[0.68rem] text-[color:var(--px-muted)]">{owner || c.tagline[language] || c.tagline.fr}</span>
                    </button>
                );
            })}
        </div>
    );
}
