import React, { useState, useEffect, useCallback, useRef, useId } from 'react';
import Icon from '../icons/Icon';
import { stripEmoji } from '../../utils/showI18n';

/**
 * Contrôle du volume du plateau
 * La logique (état local, anti-rebond, mémoïsation) est reprise telle quelle ; seul l'affichage change.
 * La classe "relative" du conteneur est utilisée par useAudio pour fermer le panneau au clic extérieur.
 */
const VolumeControl = ({
    audioVolume,
    showVolumeControl,
    handleVolumeChange,
    setShowVolumeControl,
    t
}) => {
    const panelId = useId();

    // État local du slider, indépendant des re-renders externes
    const [localVolume, setLocalVolume] = useState(audioVolume);
    const [isDragging, setIsDragging] = useState(false);

    const isInitializedRef = useRef(false);
    const dragTimeoutRef = useRef(null);

    // Initialisation unique
    useEffect(() => {
        if (!isInitializedRef.current) {
            setLocalVolume(audioVolume);
            isInitializedRef.current = true;
        }
    }, [audioVolume]);

    // Synchronisation seulement si nécessaire
    useEffect(() => {
        if (!isDragging && isInitializedRef.current && Math.abs(localVolume - audioVolume) > 0.01) {
            setLocalVolume(audioVolume);
        }
    }, [audioVolume, isDragging, localVolume]);

    const handleSliderChange = useCallback((e) => {
        const newVolume = parseFloat(e.target.value);
        setLocalVolume(newVolume);

        if (!isDragging) {
            setIsDragging(true);
        }

        if (dragTimeoutRef.current) {
            clearTimeout(dragTimeoutRef.current);
        }

        handleVolumeChange(newVolume);

        dragTimeoutRef.current = setTimeout(() => {
            setIsDragging(false);
        }, 100);
    }, [handleVolumeChange, isDragging]);

    const handleSliderMouseDown = useCallback(() => {
        setIsDragging(true);
        if (dragTimeoutRef.current) {
            clearTimeout(dragTimeoutRef.current);
        }
    }, []);

    const handleSliderMouseUp = useCallback(() => {
        dragTimeoutRef.current = setTimeout(() => {
            setIsDragging(false);
        }, 50);
    }, []);

    useEffect(() => {
        return () => {
            if (dragTimeoutRef.current) {
                clearTimeout(dragTimeoutRef.current);
            }
        };
    }, []);

    const label = stripEmoji(t('controlVolume'));
    const percent = Math.round(localVolume * 100);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setShowVolumeControl(!showVolumeControl)}
                aria-expanded={showVolumeControl}
                aria-controls={panelId}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${showVolumeControl ? 'bg-show-yellow text-show-night' : 'bg-show-stage-2 text-show-white hover:text-show-yellow'} ${localVolume === 0 ? 'opacity-60' : ''}`}
            >
                <Icon name="volume" size={18} title={label} />
            </button>

            {showVolumeControl && (
                <div
                    id={panelId}
                    className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl bg-show-night p-3 font-show text-show-white shadow-xl"
                >
                    <div className="flex items-center justify-between text-xs font-extrabold">
                        <span>{label}</span>
                        <span className="text-show-yellow">{percent} %</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={localVolume}
                        aria-label={label}
                        aria-valuetext={`${percent} %`}
                        onChange={handleSliderChange}
                        onMouseDown={handleSliderMouseDown}
                        onMouseUp={handleSliderMouseUp}
                        onTouchStart={handleSliderMouseDown}
                        onTouchEnd={handleSliderMouseUp}
                        className="mt-2 w-full accent-show-yellow"
                    />
                </div>
            )}
        </div>
    );
};

// Comparaison personnalisée pour éviter les re-renders inutiles
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