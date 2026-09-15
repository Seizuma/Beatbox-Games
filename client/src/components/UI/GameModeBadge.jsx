import React from 'react';
import { stripEmoji } from '../../utils/showI18n';

/**
 * Pastille indiquant le mode de jeu (rapide ou normal)
 * @param {string} gameMode - 'quick' ou 'normal'
 * @param {function} t - Fonction de traduction
 */
const GameModeBadge = ({ gameMode, t }) => {
    const isQuick = gameMode === 'quick';
    const label = stripEmoji(t(isQuick ? 'quickMode' : 'normalMode'));

    return (
        <span
            className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 font-show text-xs font-extrabold ${isQuick ? 'bg-show-yellow text-show-night' : 'bg-show-stage-2 text-show-white'}`}
        >
            {label}
        </span>
    );
};

export default GameModeBadge;