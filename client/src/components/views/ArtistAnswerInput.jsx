import React, { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import { findArtist, rankArtists, splitMatch } from '../../utils/artistSearch.js';

const MAX_SUGGESTIONS = 6;

/**
 * Champ de réponse avec autocomplétion sur la liste des artistes (combobox accessible).
 * - Clavier : flèches pour parcourir, Entrée ou Tab pour choisir, Échap pour fermer
 * - Tactile : toucher une suggestion la place dans le champ ; le bouton Valider reste à côté
 */
const ArtistAnswerInput = forwardRef(function ArtistAnswerInput({
    id,
    value,
    onChange,
    artists,
    placeholder,
    listLabel,
    autoFocus,
    onFocus,
    onBlur,
    invalid = false,
    describedBy,
}, ref) {
    const listId = useId();
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const closeTimeoutRef = useRef(null);
    const pointerStartRef = useRef(null);

    const exactMatch = useMemo(() => findArtist(value, artists), [value, artists]);
    const suggestions = useMemo(() => rankArtists(value, artists, MAX_SUGGESTIONS), [value, artists]);

    // Inutile d'afficher une liste qui ne contient que ce qui est déjà tapé
    const onlyExact = exactMatch && suggestions.length === 1 && suggestions[0] === exactMatch;
    const listVisible = open && suggestions.length > 0 && !onlyExact;

    useEffect(() => {
        setActiveIndex(-1);
    }, [value]);

    useEffect(() => () => {
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    }, []);

    const choose = (artist) => {
        onChange(artist);
        setOpen(false);
        setActiveIndex(-1);
    };

    const handleKeyDown = (event) => {
        if (!suggestions.length) return;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                setOpen(true);
                setActiveIndex((index) => (index + 1) % suggestions.length);
                break;
            case 'ArrowUp':
                event.preventDefault();
                setOpen(true);
                setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
                break;
            case 'Enter':
                // Entrée choisit la suggestion surlignée ; sans surlignage, le formulaire est envoyé
                if (listVisible && activeIndex >= 0) {
                    event.preventDefault();
                    choose(suggestions[activeIndex]);
                }
                break;
            case 'Tab':
                if (listVisible && !exactMatch) {
                    event.preventDefault();
                    choose(suggestions[activeIndex >= 0 ? activeIndex : 0]);
                }
                break;
            case 'Escape':
                if (listVisible) {
                    event.preventDefault();
                    setOpen(false);
                }
                break;
            default:
                break;
        }
    };

    return (
        <div className="relative min-w-0 flex-1">
            <input
                ref={ref}
                id={id}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={listVisible}
                aria-controls={listId}
                aria-activedescendant={listVisible && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                value={value}
                onChange={(event) => {
                    onChange(event.target.value);
                    setOpen(true);
                }}
                onKeyDown={handleKeyDown}
                onFocus={(event) => {
                    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
                    setOpen(true);
                    if (onFocus) onFocus(event);
                }}
                onBlur={(event) => {
                    // Laisse le temps au toucher sur une suggestion d'être pris en compte
                    closeTimeoutRef.current = setTimeout(() => setOpen(false), 300);
                    if (onBlur) onBlur(event);
                }}
                placeholder={placeholder}
                autoFocus={autoFocus}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck="false"
                enterKeyHint="send"
                className={`w-full rounded-full bg-show-white px-5 py-3 text-base font-semibold text-show-night placeholder:text-slate-400 focus:outline-none focus-visible:ring-4 ${invalid ? 'ring-4 ring-show-buzz/70 focus-visible:ring-show-buzz/70' : 'focus-visible:ring-show-yellow'}`}
            />

            <ul
                id={listId}
                role="listbox"
                aria-label={listLabel}
                hidden={!listVisible}
                className="absolute inset-x-0 top-full z-40 mt-2 max-h-[min(19rem,45vh)] overflow-y-auto overscroll-contain rounded-2xl bg-show-white py-1.5 text-show-night shadow-[0_18px_40px_rgb(0_0_0/0.45)]"
            >
                {suggestions.map((artist, index) => {
                    const active = index === activeIndex;
                    return (
                        <li
                            key={artist}
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={active}
                            // Souris : le champ garde le focus. Tactile : on choisit au relâché, sauf si le doigt a fait défiler la liste
                            onMouseDown={(event) => event.preventDefault()}
                            onPointerDown={(event) => {
                                pointerStartRef.current = { id: event.pointerId, y: event.clientY };
                            }}
                            onPointerUp={(event) => {
                                const start = pointerStartRef.current;
                                pointerStartRef.current = null;
                                if (start && start.id === event.pointerId && Math.abs(event.clientY - start.y) < 10) {
                                    event.preventDefault();
                                    choose(artist);
                                }
                            }}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={`flex min-h-[2.75rem] cursor-pointer items-center px-5 text-base ${active ? 'bg-show-yellow' : 'hover:bg-slate-100'}`}
                        >
                            <span className="truncate">
                                {splitMatch(artist, value).map((part, partIndex) => (
                                    part.match
                                        ? <strong key={partIndex} className="font-extrabold">{part.text}</strong>
                                        : <span key={partIndex} className="font-medium">{part.text}</span>
                                ))}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
});

export default ArtistAnswerInput;