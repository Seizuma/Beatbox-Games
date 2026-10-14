import React from 'react';

// Pastille de marque partagée par la chaîne (site) et le plateau (jeux) :
// une onde sonore jaune sur fond bleu nuit (logo « Waveform »).
// En petit, cinq barres au lieu de sept : l'onde reste lisible à 24 px.
export default function BrandMark({ size = 24, className = '' }) {
    const compact = size < 48;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 120 120"
            width={size}
            height={size}
            className={`shrink-0 ${className}`}
            aria-hidden="true"
            focusable="false"
        >
            <rect width="120" height="120" rx="34" fill="#16295A" />
            {compact ? (
                <path
                    d="M28 48v24M44 32v56M60 18v84M76 30v60M92 46v28"
                    stroke="#FFC72C"
                    strokeWidth="11"
                    strokeLinecap="round"
                    fill="none"
                />
            ) : (
                <path
                    d="M24 48v24M36 32v56M48 43v34M60 18v84M72 37v46M84 27v66M96 46v28"
                    stroke="#FFC72C"
                    strokeWidth="8"
                    strokeLinecap="round"
                    fill="none"
                />
            )}
        </svg>
    );
}
