import React from 'react';

// Pastille de marque partagée par la chaîne (site) et le plateau (jeux)
export default function BrandMark({ size = 24, className = '' }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width={size}
            height={size}
            className={`shrink-0 ${className}`}
            aria-hidden="true"
            focusable="false"
        >
            <rect width="24" height="24" rx="7" fill="#FFC72C" />
            <rect x="8.5" y="4.5" width="7" height="10" rx="3.5" fill="#0F1B3D" />
            <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v2.5" fill="none" stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}