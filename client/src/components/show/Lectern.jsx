import React from 'react';
import Icon from '../icons/Icon';

// Couleur du bandeau lumineux selon l'état du joueur
const LAMPS = {
    idle: { lamp: '#233F8A', glow: 'transparent' },
    ready: { lamp: '#2DBE6C', glow: 'rgb(45 190 108 / 0.55)' },
    answered: { lamp: '#FFC72C', glow: 'rgb(255 199 44 / 0.5)' },
    wrong: { lamp: '#E8402F', glow: 'rgb(232 64 47 / 0.55)' },
    buzz: { lamp: '#E8402F', glow: 'rgb(232 64 47 / 0.75)' },
};

const SIZES = {
    xs: { screen: 'text-xs min-h-[1.35rem]', plate: 'text-[9px] px-1.5 py-px', avatar: 14 },
    sm: { screen: 'text-lg min-h-[2.1rem]', plate: 'text-[11px] px-2 py-0.5', avatar: 22 },
    md: { screen: 'text-2xl min-h-[2.6rem]', plate: 'text-xs sm:text-sm px-2.5 py-1', avatar: 28 },
    lg: { screen: 'text-3xl sm:text-4xl min-h-[3.4rem]', plate: 'text-sm sm:text-base px-3 py-1', avatar: 34 },
};

/**
 * Pupitre de plateau télé.
 * - screen : contenu de l'écran (score, état) ; value est un raccourci pour un nombre
 * - lamp : idle | ready | answered | wrong | buzz
 * - empty : place libre (contour pointillé), label affiché dans l'écran
 */
export default function Lectern({
    name,
    value,
    screen,
    lamp = 'idle',
    highlight = false,
    host = false,
    hostLabel,
    tag,
    dimmed = false,
    avatarUrl,
    size = 'md',
    empty = false,
    emptyLabel,
    onEmptyClick,
    className = '',
}) {
    const sizing = SIZES[size] || SIZES.md;
    const colors = LAMPS[lamp] || LAMPS.idle;

    if (empty) {
        const Tag = onEmptyClick ? 'button' : 'div';
        return (
            <Tag
                type={onEmptyClick ? 'button' : undefined}
                onClick={onEmptyClick}
                data-empty="true"
                className={`lectern group w-full text-left ${onEmptyClick ? 'cursor-pointer' : ''} ${className}`}
            >
                <span className="lectern-desk opacity-25" aria-hidden="true" />
                <span className="lectern-front">
                    <span className={`flex w-full items-center justify-center gap-1.5 rounded-lg text-show-muted transition-colors group-hover:text-show-white ${sizing.screen} !text-xs font-extrabold`}>
                        <Icon name="user" size={16} />
                        {emptyLabel}
                    </span>
                </span>
            </Tag>
        );
    }

    return (
        <div
            data-size={size}
            className={`lectern ${dimmed ? 'opacity-50' : ''} ${className}`}
            style={{ '--lamp': colors.lamp, '--lamp-glow': colors.glow }}
        >
            {(host || tag) && (
                <span className="absolute -top-2.5 right-1 z-10 flex items-center gap-1">
                    {tag && (
                        <span className="rounded-full bg-show-white px-1.5 py-0.5 text-[10px] font-extrabold text-show-night shadow">{tag}</span>
                    )}
                    {host && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-show-yellow text-show-night shadow">
                            <Icon name="crown" size={12} title={hostLabel} />
                        </span>
                    )}
                </span>
            )}

            <span className="lectern-desk" aria-hidden="true" />
            <span className="lectern-strip" aria-hidden="true" />

            <span className="lectern-front">
                <span className={`lectern-screen font-brand leading-none tabular-nums ${sizing.screen}`}>
                    {screen !== undefined ? screen : value}
                </span>
                <span
                    className={`lectern-plate flex items-center gap-1.5 rounded-md font-extrabold ${sizing.plate} ${highlight ? 'bg-show-yellow text-show-night' : 'bg-show-night/70 text-show-white'}`}
                >
                    {avatarUrl && (
                        <img
                            src={avatarUrl}
                            alt=""
                            width={sizing.avatar}
                            height={sizing.avatar}
                            className="-my-1 -ml-1.5 shrink-0 rounded-full"
                            style={{ width: sizing.avatar * 0.75, height: sizing.avatar * 0.75 }}
                        />
                    )}
                    <span className="truncate">{name}</span>
                </span>
            </span>

            <span className="lectern-shadow" aria-hidden="true" />
        </div>
    );
}