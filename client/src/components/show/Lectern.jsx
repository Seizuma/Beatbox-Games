import React from 'react';
import Icon from '../icons/Icon';

const LAMP_CLASS = {
    idle: 'bg-show-dim',
    ready: 'bg-show-ready',
    answered: 'bg-show-yellow',
    wrong: 'bg-show-buzz',
    buzz: 'bg-show-buzz',
};

// Pupitre d'un joueur : lampe d'état, plaque avec le nom, socle avec le score ou le statut
export default function Lectern({
    name,
    value,
    caption,
    lamp = 'idle',
    highlight = false,
    host = false,
    hostLabel,
    dimmed = false,
    size = 'md',
    baseClassName = '',
}) {
    const small = size === 'sm';

    return (
        <div className={`flex min-w-0 flex-col items-center ${dimmed ? 'opacity-50' : ''}`}>
            <span aria-hidden="true" className={`${small ? 'h-1.5 w-3' : 'h-2 w-4'} rounded-t ${LAMP_CLASS[lamp] || LAMP_CLASS.idle}`} />
            <span
                className={`flex w-full min-w-0 items-center justify-center gap-1 rounded-t-md px-1.5 font-extrabold text-show-night ${small ? 'py-1 text-[11px]' : 'py-1.5 text-xs sm:text-sm'} ${highlight ? 'bg-show-yellow' : 'bg-show-white'}`}
            >
                {host && <Icon name="crown" size={small ? 11 : 13} title={hostLabel} />}
                <span className="truncate">{name}</span>
            </span>
            <span
                className={`lectern-base flex w-full flex-col items-center justify-center bg-show-desk ${small ? 'min-h-[2.25rem] pb-2 pt-1' : 'min-h-[3rem] pb-3 pt-1.5'} ${baseClassName}`}
            >
                {value !== undefined && value !== null && (
                    <span className={`font-brand leading-none text-show-yellow ${small ? 'text-sm' : 'text-lg sm:text-xl'}`}>{value}</span>
                )}
                {caption && <span className="px-1 text-center text-[10px] font-semibold leading-tight text-show-muted sm:text-[11px]">{caption}</span>}
            </span>
        </div>
    );
}