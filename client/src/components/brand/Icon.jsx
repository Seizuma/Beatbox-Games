import React from 'react';

// Jeu d'icônes du site et des jeux : trait de 2 px sur une grille de 24, couleur héritée (currentColor).
// Remplace progressivement les emojis de l'interface.
const STROKE_ICONS = {
    'arrow-left': <path d="M19 12H5M11 6l-6 6 6 6" />,
    'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
    'chevron-down': <path d="M6 9l6 6 6-6" />,
    buzzer: (
        <>
            <path d="M5 17a7 7 0 0 1 14 0" />
            <path d="M3 17h18v3H3z" />
            <path d="M12 6V3M6.3 8.3 4.5 6.5M17.7 8.3l1.8-1.8" />
        </>
    ),
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    copy: (
        <>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V6a2 2 0 0 1 2-2h9" />
        </>
    ),
    crown: <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />,
    headphones: (
        <>
            <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
            <rect x="3" y="14" width="4" height="6" rx="1.5" />
            <rect x="17" y="14" width="4" height="6" rx="1.5" />
        </>
    ),
    link: (
        <>
            <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
            <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    mic: (
        <>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
        </>
    ),
    settings: (
        <>
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="10" cy="17" r="2" />
        </>
    ),
    trophy: (
        <>
            <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
            <path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M10 17h4" />
        </>
    ),
    user: (
        <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
        </>
    ),
    volume: (
        <>
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7" />
        </>
    ),
};

const FILL_ICONS = {
    discord: (
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    ),
};

export default function Icon({ name, size = 20, className = '', title }) {
    const isFill = Boolean(FILL_ICONS[name]);
    const content = isFill ? FILL_ICONS[name] : STROKE_ICONS[name];

    if (!content) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn(`Icône inconnue : "${name}"`);
        }
        return null;
    }

    const accessibility = title
        ? { role: 'img', 'aria-label': title }
        : { 'aria-hidden': true, focusable: 'false' };

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width={size}
            height={size}
            className={`shrink-0 ${className}`}
            fill={isFill ? 'currentColor' : 'none'}
            stroke={isFill ? 'none' : 'currentColor'}
            strokeWidth={isFill ? undefined : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...accessibility}
        >
            {title && <title>{title}</title>}
            {content}
        </svg>
    );
}