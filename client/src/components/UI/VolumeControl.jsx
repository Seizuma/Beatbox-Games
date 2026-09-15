import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Composant de contrôle du volume avec slider
 * ✅ FINAL : Complètement isolé des re-renders externes
 */
const VolumeControl = ({
    audioVolume,
    showVolumeControl,
    handleVolumeChange,
    setShowVolumeControl,
    t
}) => {
    // ✅ État local pour le slider (complètement indépendant)
    const [localVolume, setLocalVolume] = useState(audioVolume);
    const [isDragging, setIsDragging] = useState(false);

    // ✅ Ref pour éviter les re-synchronisations pendant le drag
    const isInitializedRef = useRef(false);
    const dragTimeoutRef = useRef(null);

    // ✅ Initialisation unique au premier render
    useEffect(() => {
        if (!isInitializedRef.current) {
            setLocalVolume(audioVolume);
            isInitializedRef.current = true;
        }
    }, [audioVolume]);

    // ✅ Synchronisation seulement si vraiment nécessaire
    useEffect(() => {
        if (!isDragging && isInitializedRef.current && Math.abs(localVolume - audioVolume) > 0.01) {
            setLocalVolume(audioVolume);
        }
    }, [audioVolume, isDragging, localVolume]);

    // ✅ Gestion du changement avec debounce pour éviter le spam
    const handleSliderChange = useCallback((e) => {
        const newVolume = parseFloat(e.target.value);
        setLocalVolume(newVolume);

        if (!isDragging) {
            setIsDragging(true);
        }

        // Débounce pour éviter trop d'appels
        if (dragTimeoutRef.current) {
            clearTimeout(dragTimeoutRef.current);
        }

        // Appliquer le changement immédiatement
        handleVolumeChange(newVolume);

        // Reset du dragging après un délai
        dragTimeoutRef.current = setTimeout(() => {
            setIsDragging(false);
        }, 100);
    }, [handleVolumeChange, isDragging]);

    // ✅ Gestion des événements de souris/touch
    const handleSliderMouseDown = useCallback(() => {
        setIsDragging(true);
        if (dragTimeoutRef.current) {
            clearTimeout(dragTimeoutRef.current);
        }
    }, []);

    const handleSliderMouseUp = useCallback(() => {
        // Délai pour permettre la fin du changement
        dragTimeoutRef.current = setTimeout(() => {
            setIsDragging(false);
        }, 50);
    }, []);

    // ✅ Nettoyage
    useEffect(() => {
        return () => {
            if (dragTimeoutRef.current) {
                clearTimeout(dragTimeoutRef.current);
            }
        };
    }, []);

    // ✅ Icône du volume mémorisée
    const volumeIcon = localVolume === 0 ? '🔇' :
        localVolume < 0.3 ? '🔈' :
            localVolume < 0.7 ? '🔉' : '🔊';

    return (
        <div className="relative">
            <button
                onClick={() => setShowVolumeControl(!showVolumeControl)}
                className="p-2 bg-zinc-700/50 hover:bg-zinc-600/50 rounded-xl transition-all duration-300 group"
                title={t('controlVolume')}
            >
                <span className="text-xl group-hover:scale-110 transition-transform duration-200">
                    {volumeIcon}
                </span>
            </button>

            {showVolumeControl && (
                <div
                    className="absolute top-full right-0 mt-2 p-3 bg-zinc-800/90 backdrop-blur-sm border border-zinc-600/50 rounded-xl shadow-xl z-50 volume-control-enter"
                    style={{ minWidth: '140px' }}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-sm flex-shrink-0">🔈</span>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={localVolume}
                            onChange={handleSliderChange}
                            onMouseDown={handleSliderMouseDown}
                            onMouseUp={handleSliderMouseUp}
                            onTouchStart={handleSliderMouseDown}
                            onTouchEnd={handleSliderMouseUp}
                            className="volume-slider flex-1"
                            style={{
                                background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${localVolume * 100}%, #4b5563 ${localVolume * 100}%, #4b5563 100%)`
                            }}
                        />
                        <span className="text-sm flex-shrink-0">🔊</span>
                    </div>
                    <div className="text-center mt-2">
                        <span className="text-xs text-zinc-400">
                            {Math.round(localVolume * 100)}%
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

// ✅ Comparaison personnalisée pour éviter les re-renders inutiles
const arePropsEqual = (prevProps, nextProps) => {
    return (
        Math.abs(prevProps.audioVolume - nextProps.audioVolume) < 0.01 &&
        prevProps.showVolumeControl === nextProps.showVolumeControl &&
        prevProps.handleVolumeChange === nextProps.handleVolumeChange &&
        prevProps.setShowVolumeControl === nextProps.setShowVolumeControl &&
        prevProps.t === nextProps.t
    );
};

export default React.memo(VolumeControl, arePropsEqual);