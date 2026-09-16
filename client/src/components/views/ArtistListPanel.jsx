import React, { useMemo, useState } from 'react';
import Icon from '../icons/Icon';
import { normalizeArtistName } from '../../utils/artistSearch.js';

/**
 * Liste de tous les artistes du jeu, avec filtre.
 * onPick (optionnel) : appelé au choix d'un nom quand on peut répondre.
 */
export default function ArtistListPanel({ artists, status, onPick, labels, className = '', listClassName = 'max-h-[26rem]' }) {
    const [filter, setFilter] = useState('');

    const visible = useMemo(() => {
        const needle = normalizeArtistName(filter);
        return needle ? artists.filter((artist) => normalizeArtistName(artist).includes(needle)) : artists;
    }, [artists, filter]);

    return (
        <div className={`flex flex-col gap-3 ${className}`}>
            <div className="flex items-center gap-2 rounded-full bg-show-night/70 px-4 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-show-yellow">
                <Icon name="search" size={16} className="text-show-muted" />
                <input
                    type="search"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    placeholder={labels.filter}
                    aria-label={labels.filter}
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-show-white placeholder:text-show-muted focus:outline-none sm:text-sm"
                />
            </div>

            <p className="text-xs font-semibold text-show-muted">{onPick ? labels.pickHint : labels.browseHint}</p>

            {status === 'loading' && <p className="py-4 text-sm text-show-muted">{labels.loading}</p>}
            {status === 'error' && <p className="py-4 text-sm text-show-muted">{labels.error}</p>}

            {status === 'ready' && (
                visible.length === 0 ? (
                    <p className="py-4 text-sm text-show-muted">{labels.empty}</p>
                ) : (
                    <ul className={`-mx-1 overflow-y-auto overscroll-contain pr-1 ${listClassName}`}>
                        {visible.map((artist) => (
                            <li key={artist}>
                                {onPick ? (
                                    <button
                                        type="button"
                                        onClick={() => onPick(artist)}
                                        className="flex min-h-[2.75rem] w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-[0.95rem] font-semibold transition-colors hover:bg-show-stage-2 focus-visible:bg-show-stage-2"
                                    >
                                        <span className="truncate">{artist}</span>
                                        <Icon name="arrow-right" size={15} className="shrink-0 text-show-muted" />
                                    </button>
                                ) : (
                                    <span className="flex min-h-[2.5rem] items-center px-3 text-[0.95rem] font-semibold text-show-white/85">
                                        {artist}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )
            )}
        </div>
    );
}