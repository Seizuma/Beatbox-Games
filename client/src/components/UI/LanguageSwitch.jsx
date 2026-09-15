import React from 'react';

/**
 * Sélecteur de langue du plateau (FR/EN), placé dans la barre de GameShell
 * @param {function} switchLanguage - Fonction pour changer de langue
 * @param {boolean} isEnglish - True si la langue actuelle est l'anglais
 */
const LANGUAGES = [
    { id: 'fr', label: 'FR' },
    { id: 'en', label: 'EN' },
];

const LanguageSwitch = ({ switchLanguage, isEnglish }) => (
    <div
        role="group"
        aria-label={isEnglish ? 'Language' : 'Langue'}
        className="flex rounded-full bg-show-stage-2 p-0.5 font-show text-xs font-extrabold"
    >
        {LANGUAGES.map(({ id, label }) => {
            const active = id === 'en' ? isEnglish : !isEnglish;
            return (
                <button
                    key={id}
                    type="button"
                    lang={id}
                    aria-pressed={active}
                    onClick={() => switchLanguage(id)}
                    className={`rounded-full px-2.5 py-1 transition-colors ${active ? 'bg-show-yellow text-show-night' : 'text-show-muted hover:text-show-white'}`}
                >
                    {label}
                </button>
            );
        })}
    </div>
);

export default LanguageSwitch;