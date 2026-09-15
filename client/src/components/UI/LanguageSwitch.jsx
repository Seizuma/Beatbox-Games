import React from 'react';

/**
 * Composant de switch de langue (FR/EN)
 * Positionné en haut à droite de l'écran
 * @param {function} switchLanguage - Fonction pour changer de langue
 * @param {boolean} isEnglish - True si la langue actuelle est l'anglais
 */
const LanguageSwitch = ({ switchLanguage, isEnglish }) => (
    <div className="absolute top-4 right-4 z-20">
        <div className="flex items-center gap-2 bg-zinc-800/90 backdrop-blur-sm border border-zinc-700/50 rounded-full p-1">
            <button
                onClick={() => switchLanguage('fr')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${!isEnglish
                    ? 'bg-cyan-500 text-white shadow-lg'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-700/50'
                    }`}
            >
                🇫🇷 FR
            </button>
            <button
                onClick={() => switchLanguage('en')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${isEnglish
                    ? 'bg-cyan-500 text-white shadow-lg'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-700/50'
                    }`}
            >
                🇺🇸 EN
            </button>
        </div>
    </div>
);

export default LanguageSwitch;