import React from 'react';

// Couronne d'ampoules : progress de 0 à 1 règle la part allumée
export default function BulbRing({ progress = 1, size, className = '', ringClassName = '', smooth = false, label, children }) {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 1));
    const dimensions = size ? { width: size, height: size } : undefined;

    return (
        <div
            className={`relative shrink-0 ${className}`}
            style={dimensions}
            role={label ? 'img' : undefined}
            aria-label={label}
        >
            <div className={`bulb-ring absolute inset-0 ${smooth ? 'bulb-ring-smooth' : ''} ${ringClassName}`} style={{ '--progress': `${clamped * 100}%` }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
        </div>
    );
}