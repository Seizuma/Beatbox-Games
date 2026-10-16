import React, { useRef } from 'react';
import PixelCharacter from './PixelCharacter';
import { CHARACTERS, PLAYER_COLORS } from './characters/pixelRig';
import { sfx } from './partySfx';

// Sélection arcade (12-B) : le personnage choisi en grand, avec sa phrase, et la rangée des
// huit portraits en dessous (curseur doré, flèches du clavier). `takenBy` : personnage -> nom
// du joueur qui l'a déjà.
export default function CharacterPicker({ value, onChange, takenBy = {}, color = PLAYER_COLORS[0], language = 'fr', t }) {
    const current = CHARACTERS.find((c) => c.id === value) || CHARACTERS[0];
    const stripRef = useRef(null);
    const pick = (id) => {
        if (id === value) return;
        sfx('tick');
        onChange(id);
    };
    const onKeyDown = (event) => {
        const dirs = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        const dir = dirs[event.key];
        if (!dir) return;
        event.preventDefault();
        const from = CHARACTERS.findIndex((c) => c.id === current.id);
        for (let k = 1; k < CHARACTERS.length; k += 1) {
            const next = CHARACTERS[(from + dir * k + CHARACTERS.length) % CHARACTERS.length];
            if (!takenBy[next.id]) {
                pick(next.id);
                const button = stripRef.current && stripRef.current.querySelector(`[data-id="${next.id}"]`);
                if (button) button.focus();
                return;
            }
        }
    };
    return (
        <div className="party-picker">
            <div className="party-picker-preview" style={{ '--seat': color }}>
                <span className="party-picker-stage" aria-hidden="true">
                    <PixelCharacter id={current.id} pose="beatbox" color={color} crop="full" scale={2} />
                </span>
                <div className="min-w-0">
                    <p className="party-picker-name">{current.name}</p>
                    <p className="hw-text">{current.tagline[language] || current.tagline.fr}</p>
                </div>
            </div>
            <div ref={stripRef} role="radiogroup" aria-label={t('lobby.character')} className="party-select-strip" onKeyDown={onKeyDown}>
                {CHARACTERS.map((c) => {
                    const selected = current.id === c.id;
                    const owner = takenBy[c.id];
                    return (
                        <button
                            key={c.id}
                            data-id={c.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            tabIndex={selected ? 0 : -1}
                            aria-label={`${c.name}${owner ? ` (${t('lobby.taken')} : ${owner})` : ''}`}
                            disabled={Boolean(owner)}
                            onClick={() => pick(c.id)}
                            className="party-select-cell"
                        >
                            <PixelCharacter id={c.id} pose={selected ? 'present' : 'idle'} color={color} crop="bust" scale={1} />
                            {owner && <span className="party-select-owner">{owner}</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
