import React from 'react';

/**
 * Badge indiquant le mode de jeu (Quick/Normal)
 * @param {string} gameMode - 'quick' ou 'normal'
 * @param {function} t - Fonction de traduction
 */
const GameModeBadge = ({ gameMode, t }) => {
    if (gameMode === 'quick') {
        return (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-full text-yellow-400 text-sm font-bold">
                {t('quickMode')}
            </div>
        );
    }
    return (
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/30 rounded-full text-cyan-400 text-sm font-bold">
            {t('normalMode')}
        </div>
    );
};

export default GameModeBadge;