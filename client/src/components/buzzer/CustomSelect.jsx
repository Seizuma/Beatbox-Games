import React, { useState, useRef, useEffect } from 'react';

function CustomSelect({ value, onChange, options, placeholder, icon = '🔽', disabled = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    // Fermer le dropdown si on clique en dehors
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filtrer les options selon la recherche
    const filteredOptions = options.filter(option =>
        option.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (option) => {
        onChange(option);
        setIsOpen(false);
        setSearchTerm('');
    };

    const selectedLabel = value || placeholder;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bouton principal */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full px-4 py-3 bg-zinc-900/80 border-2 rounded-lg text-left flex items-center justify-between transition-all ${disabled
                        ? 'border-zinc-700 text-zinc-600 cursor-not-allowed'
                        : isOpen
                            ? 'border-cyan-500 ring-2 ring-cyan-500/20'
                            : 'border-zinc-600 hover:border-cyan-500 text-white'
                    }`}
            >
                <span className="font-medium">{selectedLabel}</span>
                <span className={`text-xl transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    {icon}
                </span>
            </button>

            {/* Dropdown */}
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-2 bg-zinc-900 border-2 border-cyan-500 rounded-lg shadow-2xl overflow-hidden">
                    {/* Barre de recherche */}
                    {options.length > 5 && (
                        <div className="p-3 border-b border-zinc-700">
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-all"
                                autoFocus
                            />
                        </div>
                    )}

                    {/* Liste des options */}
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-3 text-zinc-500 text-center">
                                Aucun résultat
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => handleSelect(option)}
                                    className={`w-full px-4 py-3 text-left transition-all ${option === value
                                            ? 'bg-cyan-500/20 text-cyan-400 font-bold'
                                            : 'text-white hover:bg-zinc-800'
                                        }`}
                                >
                                    {option}
                                    {option === value && (
                                        <span className="float-right text-cyan-400">✓</span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {/* Footer avec compteur */}
                    <div className="px-4 py-2 bg-zinc-800/50 border-t border-zinc-700 text-xs text-zinc-500 text-center">
                        {filteredOptions.length} option{filteredOptions.length > 1 ? 's' : ''} disponible{filteredOptions.length > 1 ? 's' : ''}
                    </div>
                </div>
            )}
        </div>
    );
}

export default CustomSelect;