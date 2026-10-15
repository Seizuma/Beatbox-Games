import React from 'react';
import PixelCharacter from './PixelCharacter';
import { CHARACTERS, PLAYER_COLORS } from './characters/pixelRig';

// Grille des huit personnages. `takenBy` : personnage -> nom du joueur qui l'a déjà.
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
                        className={`group relative flex flex-col items-center rounded-md border-[3px] px-1 pb-2 pt-1 transition-colors ${selected ? 'border-[color:var(--px-yellow)] bg-[#2A3166]' : 'border-[color:var(--px-line)] bg-[#1A1F45] hover:border-[color:var(--px-muted)]'} disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                        <PixelCharacter id={c.id} pose={selected ? 'beatbox' : 'idle'} color={selected ? color : '#3B4480'} scale={2} className="max-w-full" />
                        <span className="party-font mt-1 w-full truncate text-center text-[0.7rem] sm:text-xs">{c.name}</span>
                        <span className="w-full truncate text-center text-[0.68rem] text-[color:var(--px-muted)]">{owner || c.tagline[language] || c.tagline.fr}</span>
                    </button>
                );
            })}
        </div>
    );
}
