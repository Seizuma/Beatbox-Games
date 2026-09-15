import React from 'react';
import Icon from '../icons/Icon';
import { stripEmoji } from '../../utils/showI18n';

// Bandeau affiché tant que le navigateur bloque le son (Safari, iOS)
export function AudioUnlockBanner({ message }) {
    return (
        <div
            role="status"
            className="show-surface fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-show-yellow px-4 py-2.5 text-center font-show text-sm font-extrabold text-show-night"
        >
            <Icon name="volume" size={18} />
            <span>{message}</span>
        </div>
    );
}

// Message temporaire du plateau. Les succès arrivent préfixés par « ✅ » depuis useGameLogic.
export function GameToast({ message, hint }) {
    if (!message) return null;

    const isSuccess = String(message).trim().startsWith('✅');
    const text = stripEmoji(String(message));

    return (
        <div className="show-surface pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4">
            <div
                role={isSuccess ? 'status' : 'alert'}
                className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-4 py-3 font-show text-sm font-bold shadow-lg ${isSuccess ? 'bg-show-ready text-show-night' : 'border-l-4 border-show-buzz bg-show-white text-show-night'}`}
            >
                <Icon name={isSuccess ? 'check' : 'close'} size={18} className={isSuccess ? '' : 'text-show-buzz'} />
                <div>
                    <p>{text}</p>
                    {hint && <p className="mt-1 text-xs font-semibold opacity-80">{hint}</p>}
                </div>
            </div>
        </div>
    );
}