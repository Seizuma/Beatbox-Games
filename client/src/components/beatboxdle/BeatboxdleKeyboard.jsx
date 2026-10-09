import React, { useState } from 'react';
import Icon from '../icons/Icon';

// Disposition du clavier selon la langue du site : un joueur français tape en AZERTY
const LAYOUTS = {
    fr: ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'],
    en: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
};
const DIGITS = '1234567890';

const KEY_STATE = {
    correct: 'bg-dle-correct text-dle-correct-ink',
    present: 'bg-dle-present text-dle-present-ink',
    absent: 'bg-dle-absent text-dle-absent-ink opacity-60',
};

/**
 * Clavier du Beatboxdle, posé sous la grille.
 *
 * Sur téléphone, le clavier natif recouvrait la grille : on jouait sans voir
 * ses essais. Celui-ci tient dans la page, garde en mémoire l'état de chaque
 * lettre (gris, orange, vert) et propose les noms possibles au-dessus des
 * touches. La réponse reste un nom de la liste : on tape le début, on choisit.
 */
export default function BeatboxdleKeyboard({
    language = 'fr',
    states = {},
    allowDigits = false,
    suggestions = [],
    picked = null,
    canEnter = false,
    disabled = false,
    labels,
    onKey,
    onBackspace,
    onEnter,
    onPick,
}) {
    const [showDigits, setShowDigits] = useState(false);
    const rows = LAYOUTS[language] || LAYOUTS.fr;
    const firstRow = showDigits ? DIGITS : rows[0];

    const keyClass = (letter) => `flex h-12 min-w-0 flex-1 items-center justify-center rounded-md text-[0.95rem] font-bold uppercase transition active:scale-95 disabled:opacity-40 ${KEY_STATE[states[letter]] || 'bg-site-tint text-site-ink hover:bg-site-line'}`;

    const renderKey = (letter) => (
        <button
            key={letter}
            type="button"
            disabled={disabled}
            onClick={() => onKey(letter)}
            aria-label={states[letter] ? `${letter}, ${labels.states[states[letter]]}` : letter}
            className={keyClass(letter)}
        >
            {letter}
        </button>
    );

    return (
        <div className="flex flex-col gap-2">
            {/* Noms possibles : une seule rangée qui défile, hauteur réservée pour que rien ne saute */}
            <div className="flex min-h-[2.75rem] items-center gap-2">
                {allowDigits && (
                    <button
                        type="button"
                        onClick={() => setShowDigits((value) => !value)}
                        aria-pressed={showDigits}
                        aria-label={showDigits ? labels.lettersLabel : labels.digitsLabel}
                        className="h-10 shrink-0 rounded-md border border-site-line px-2.5 text-xs font-bold text-site-muted transition hover:text-site-ink"
                    >
                        {showDigits ? labels.letters : labels.digits}
                    </button>
                )}
                <ul aria-label={labels.suggestions} className="flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain py-0.5 [scrollbar-width:none]">
                    {suggestions.map((name) => {
                        const active = name === picked;
                        return (
                            <li key={name} className="shrink-0">
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => onPick(name)}
                                    aria-pressed={active}
                                    className={`h-10 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition ${active
                                        ? 'border-brand-yellow bg-brand-yellow text-brand-ink'
                                        : 'border-site-line bg-site-surface text-site-ink hover:border-site-muted'}`}
                                >
                                    {name}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className="flex flex-col gap-1.5" role="group" aria-label={labels.keyboard}>
                <div className="flex gap-1">{firstRow.split('').map(renderKey)}</div>
                <div className={`flex gap-1 ${rows[1].length < 10 ? 'px-[5%]' : ''}`}>{rows[1].split('').map(renderKey)}</div>
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={onEnter}
                        disabled={disabled || !canEnter}
                        className="flex h-12 flex-[1.7] items-center justify-center rounded-md bg-brand-yellow px-1 text-xs font-extrabold uppercase text-brand-ink transition active:scale-95 disabled:bg-site-tint disabled:text-site-soft"
                    >
                        {labels.enter}
                    </button>
                    {rows[2].split('').map(renderKey)}
                    <button
                        type="button"
                        onClick={onBackspace}
                        disabled={disabled}
                        aria-label={labels.backspace}
                        className="flex h-12 flex-[1.4] items-center justify-center rounded-md bg-site-tint text-site-ink transition hover:bg-site-line active:scale-95 disabled:opacity-40"
                    >
                        <Icon name="backspace" size={22} />
                    </button>
                </div>
            </div>
        </div>
    );
}
