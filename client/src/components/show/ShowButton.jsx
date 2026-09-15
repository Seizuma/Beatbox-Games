import React from 'react';

const VARIANTS = {
    yellow: 'bg-show-yellow text-show-night shadow-show-btn hover:brightness-105',
    white: 'bg-show-white text-show-night shadow-show-btn-light hover:brightness-95',
    ready: 'bg-show-ready text-show-night shadow-[0_3px_0_#1B7F45] hover:brightness-105',
    buzz: 'bg-show-buzz text-show-white shadow-show-buzz hover:brightness-105',
    outline: 'border-2 border-show-desk text-show-white hover:border-show-muted',
};

const SIZES = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3.5 text-lg',
};

// Bouton pilule en relief du plateau : il s'enfonce quand on appuie
export default function ShowButton({
    variant = 'yellow',
    size = 'md',
    block = false,
    type = 'button',
    className = '',
    ...props
}) {
    return (
        <button
            type={type}
            className={`inline-flex items-center justify-center gap-2 rounded-full font-brand leading-none transition active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 ${VARIANTS[variant] || VARIANTS.yellow} ${SIZES[size] || SIZES.md} ${block ? 'w-full' : ''} ${className}`}
            {...props}
        />
    );
}