import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { findArtist, rankArtists, splitMatch } from '../../utils/artistSearch';

const MAX_SUGGESTIONS = 6;

/**
 * Champ de proposition du Beatboxdle : combobox accessible sur la liste fermée
 * des beatboxers jouables.
 *
 * Il n'y a délibérément pas de clavier AZERTY comme sur Wordle : la réponse est
 * un nom pris dans une liste de quelques centaines d'entrées, pas un mot
 * quelconque. Taper lettre à lettre n'aiderait personne et rendrait le mode
 * indices impossible.
 *
 * Reprend le comportement éprouvé du Blind Test (ArtistAnswerInput), habillé
 * avec les jetons de « la chaîne » plutôt que ceux du plateau.
 */
export default function BeatboxdleInput({
    value,
    onChange,
    onSubmit,
    candidates,
    placeholder,
    listLabel,
    submitLabel,
    disabled = false,
    invalid = false,
    describedBy,
}) {
    const inputId = useId();
    const listId = `${inputId}-list`;
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const closeTimeoutRef = useRef(null);
    const pointerStartRef = useRef(null);

    const exactMatch = useMemo(() => findArtist(value, candidates), [value, candidates]);
    const suggestions = useMemo(() => rankArtists(value, candidates, MAX_SUGGESTIONS), [value, candidates]);

    const onlyExact = exactMatch && suggestions.length === 1 && suggestions[0] === exactMatch;
    const listVisible = open && suggestions.length > 0 && !onlyExact && !disabled;

    useEffect(() => {
        setActiveIndex(-1);
    }, [value]);

    useEffect(() => () => {
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    }, []);

    const choose = (name) => {
        onChange(name);
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
                // Entrée choisit la suggestion surlignée ; sans surlignage, le formulaire part
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
        <form
            onSubmit={(event) => {
                event.preventDefault();
                setOpen(false);
                onSubmit();
            }}
            className="flex items-start gap-2"
        >
            <div className="relative min-w-0 flex-1">
                <label htmlFor={inputId} className="sr-only">{listLabel}</label>
                <input
                    id={inputId}
                    type="text"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={listVisible}
                    aria-controls={listId}
                    aria-activedescendant={listVisible && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    value={value}
                    disabled={disabled}
                    onChange={(event) => {
                        onChange(event.target.value);
                        setOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
                        setOpen(true);
                    }}
                    onBlur={() => {
                        // Laisse au toucher d'une suggestion le temps d'aboutir
                        closeTimeoutRef.current = setTimeout(() => setOpen(false), 300);
                    }}
                    placeholder={placeholder}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck="false"
                    enterKeyHint="send"
                    className={`w-full rounded-lg border bg-site-surface px-4 py-3 text-base font-medium text-site-ink placeholder:text-site-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-site-ink disabled:opacity-50 ${invalid ? 'border-site-danger' : 'border-site-line'}`}
                />

                <ul
                    id={listId}
                    role="listbox"
                    aria-label={listLabel}
                    hidden={!listVisible}
                    className="absolute inset-x-0 top-full z-40 mt-2 max-h-[min(18rem,45vh)] overflow-y-auto overscroll-contain rounded-lg border border-site-line bg-site-surface py-1 shadow-[0_18px_40px_rgb(0_0_0/0.35)]"
                >
                    {suggestions.map((name, index) => {
                        const active = index === activeIndex;
                        return (
                            <li
                                key={name}
                                id={`${listId}-${index}`}
                                role="option"
                                aria-selected={active}
                                // Souris : le champ garde le focus. Tactile : on choisit au
                                // relâché, sauf si le doigt a fait défiler la liste.
                                onMouseDown={(event) => event.preventDefault()}
                                onPointerDown={(event) => {
                                    pointerStartRef.current = { id: event.pointerId, y: event.clientY };
                                }}
                                onPointerUp={(event) => {
                                    const start = pointerStartRef.current;
                                    pointerStartRef.current = null;
                                    if (start && start.id === event.pointerId && Math.abs(event.clientY - start.y) < 10) {
                                        event.preventDefault();
                                        choose(name);
                                    }
                                }}
                                onMouseEnter={() => setActiveIndex(index)}
                                className={`flex min-h-[2.75rem] cursor-pointer items-center px-4 text-base text-site-ink ${active ? 'bg-site-tint' : ''}`}
                            >
                                <span className="truncate">
                                    {splitMatch(name, value).map((part, partIndex) => (
                                        part.match
                                            ? <strong key={partIndex} className="font-bold">{part.text}</strong>
                                            : <span key={partIndex} className="font-normal">{part.text}</span>
                                    ))}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <button
                type="submit"
                disabled={disabled || !value.trim()}
                className="shrink-0 rounded-lg bg-site-button px-5 py-3 text-base font-semibold text-site-on-button transition hover:bg-site-button-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-site-ink focus-visible:ring-offset-2 focus-visible:ring-offset-site-paper disabled:opacity-40"
            >
                {submitLabel}
            </button>
        </form>
    );
}