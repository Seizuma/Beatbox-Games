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


// Objets du sac, en pixel art (grille de 8 × 8)
const ITEM_ART = {
    block: [
        ['M2 0h5v1H2zM1 1h1v1H1zM7 1h1v5H7z', '#120E26'],
        ['M2 1h5v1H2zM1 2h5v1H1z', '#FFE07A'],
        ['M1 3h5v4H1z', '#FFC72C'],
        ['M6 2h1v4H6z', '#C98A00'],
        ['M0 2h1v6H0zM1 7h5v1H1zM6 6h1v1H6z', '#120E26'],
        ['M2 4h3v2H2z', '#120E26'],
    ],
    vinyl: [
        ['M2 0h4v1H2zM1 1h1v1H1zM6 1h1v1H6zM0 2h1v4H0zM7 2h1v4H7zM1 6h1v1H1zM6 6h1v1H6zM2 7h4v1H2z', '#120E26'],
        ['M2 1h4v1H2zM1 2h6v4H1zM2 6h4v1H2z', '#2a2a30'],
        ['M3 3h2v2H3z', '#E8402F'],
        ['M2 2h1v1H2z', '#6a6a74'],
    ],
    trap: [
        ['M3 0h2v1H3zM2 1h1v2H2zM5 1h1v2H5zM1 3h1v2H1zM6 3h1v2H6zM0 5h1v2H0zM7 5h1v2H7zM0 7h8v1H0z', '#120E26'],
        ['M3 1h2v2H3zM2 3h4v2H2zM1 5h6v2H1z', '#E8402F'],
        ['M3 2h2v3H3zM3 6h2v1H3z', '#FFFFFF'],
    ],
    pipe: [
        ['M0 1h6v3H0zM2 4h6v3H2z', '#120E26'],
        ['M1 2h4v1H1zM5 1h1v3H5zM3 5h4v1H3zM2 4h1v3H2z', '#35C877'],
        ['M6 2h1v1H6zM1 5h1v1H1z', '#35C877'],
    ],
    mic: [
        ['M2 0h4v1H2zM1 1h1v3H1zM6 1h1v3H6zM2 4h4v1H2zM3 5h2v3H3z', '#120E26'],
        ['M2 1h4v3H2z', '#C2C2C6'],
        ['M2 1h2v1H2z', '#F4F4F2'],
        ['M7 0h1v1H7zM7 2h1v1H7z', '#FFC72C'],
    ],
};

export function ItemIcon({ item, size = 18 }) {
    const art = ITEM_ART[item];
    if (!art) return null;
    return (
        <svg viewBox="0 0 8 8" width={size} height={size} className="party-pixel shrink-0" shapeRendering="crispEdges" aria-hidden="true">
            {art.map(([d, fill], i) => <path key={i} d={d} fill={fill} />)}
        </svg>
    );
}
