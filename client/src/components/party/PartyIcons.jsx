import React from 'react';

// Pièce de Hype et Micro d'or : les mêmes objets que sur le plateau, en pixel art
export function CoinIcon({ size = 14 }) {
    return (
        <svg viewBox="0 0 6 6" width={size} height={size} className="party-pixel shrink-0" shapeRendering="crispEdges" aria-hidden="true">
            <path d="M1 0h4v1H1zM0 1h1v4H0zM5 1h1v4H5zM1 5h4v1H1z" fill="#120E26" />
            <path d="M1 1h4v4H1z" fill="#FFC72C" />
            <path d="M1 1h3v1H1zM1 2h1v2H1z" fill="#FFE07A" />
            <path d="M2 2h1v1H2z" fill="#FFFFFF" />
            <path d="M4 3h1v2H4zM2 4h2v1H2z" fill="#C98A00" />
        </svg>
    );
}

export function MicIcon({ size = 14 }) {
    return (
        <svg viewBox="0 0 6 9" width={size * 0.67} height={size} className="party-pixel shrink-0" shapeRendering="crispEdges" aria-hidden="true">
            <path d="M1 0h4v1H1zM0 1h1v3H0zM5 1h1v3H5zM1 4h4v1H1zM2 5h2v4H2z" fill="#120E26" />
            <path d="M1 1h4v3H1z" fill="#FFC72C" />
            <path d="M1 1h2v1H1zM1 2h1v1H1z" fill="#FFF4C7" />
            <path d="M4 2h1v2H4z" fill="#C98A00" />
        </svg>
    );
}
