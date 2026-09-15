import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook personnalisé pour gérer tous les audios du jeu
 * ✅ VERSION CORRIGÉE : URLs audio adaptées selon l'environnement
 */
export const useAudio = () => {
    const [audioVolume, setAudioVolume] = useState(0.7);
    const [showVolumeControl, setShowVolumeControl] = useState(false);
    const [userInteracted, setUserInteracted] = useState(false);

    const countdownReadyAudioRef = useRef(null);
    const countdownGoAudioRef = useRef(null);
    const tensionAudioRef = useRef(null);
    const audioRef = useRef(null);

    // Ref pour éviter les re-renders lors des changements de volume
    const volumeRef = useRef(audioVolume);
    volumeRef.current = audioVolume;

    // Détection Safari/iPad
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const needsAudioUnlock = isSafari || isIOS;

    console.log('🎵 useAudio - Initialisation');

    // ✅ NOUVEAU : Génération d'URL audio selon l'environnement
    const getAudioUrl = useCallback((filename) => {
        // Détection de l'environnement
        const hostname = window.location.hostname;
        const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
        const isStaging = hostname === 'dev.beatboxgames.com';
        const isProduction = hostname === 'beatboxgames.com' || hostname === 'www.beatboxgames.com';

        let baseUrl;

        if (isDev) {
            baseUrl = 'http://localhost:4000/audio';
        } else if (isStaging) {
            baseUrl = 'https://dev.beatboxgames.com/audio';
        } else {
            baseUrl = 'https://beatboxgames.com/audio';
        }

        const fullUrl = `${baseUrl}/${filename}`;
        console.log(`🎵 Audio URL générée: ${fullUrl}`);
        return fullUrl;
    }, []);

    // ✅ GESTION INTERACTION UTILISATEUR - VERSION FORCÉE POUR DEV
    useEffect(() => {
        let interactionSet = false;

        const handleFirstInteraction = (event) => {
            if (!interactionSet) {
                console.log('👆 INTERACTION DÉTECTÉE:', event.type);
                setUserInteracted(true);
                interactionSet = true;
            }
        };

        // ✅ FORCER L'INTERACTION IMMÉDIATEMENT EN MODE DEV
        const forceTimer = setTimeout(() => {
            if (!interactionSet) {
                console.log('🔧 FORCE userInteracted = true (développement)');
                setUserInteracted(true);
                interactionSet = true;
            }
        }, 1000);

        // Écouter les interactions
        const events = ['click', 'touchstart', 'keydown', 'mousedown'];
        events.forEach(eventType => {
            document.addEventListener(eventType, handleFirstInteraction, { passive: true, once: true });
        });

        return () => {
            clearTimeout(forceTimer);
            events.forEach(eventType => {
                document.removeEventListener(eventType, handleFirstInteraction);
            });
        };
    }, []);

    // Charger le volume sauvegardé
    useEffect(() => {
        try {
            const savedVolume = localStorage.getItem('beatbox_audio_volume');
            if (savedVolume) {
                const volume = parseFloat(savedVolume);
                if (!isNaN(volume) && volume >= 0 && volume <= 1) {
                    setAudioVolume(volume);
                    console.log('🔊 Volume restauré:', volume);
                }
            }
        } catch (error) {
            console.warn('⚠️ Impossible de récupérer le volume sauvegardé:', error);
        }
    }, []);

    // Gestion des clics en dehors du contrôle de volume
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showVolumeControl && !event.target.closest('.relative')) {
                setShowVolumeControl(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showVolumeControl]);

    // ✅ FONCTIONS AUDIO - AVEC URLs ENVIRONNEMENTALES
    const playCountdownReadySound = useCallback(() => {
        console.log('🔔 APPEL playCountdownReadySound');

        try {
            // Arrêter l'audio précédent
            if (countdownReadyAudioRef.current) {
                countdownReadyAudioRef.current.pause();
                countdownReadyAudioRef.current.currentTime = 0;
                countdownReadyAudioRef.current = null;
            }

            // ✅ CORRECTION : URL dynamique selon l'environnement
            const audioUrl = getAudioUrl('countdown-ready.wav');
            countdownReadyAudioRef.current = new Audio(audioUrl);
            countdownReadyAudioRef.current.volume = volumeRef.current * 0.5;

            countdownReadyAudioRef.current.play().catch(err => {
                console.log('Countdown ready audio autoplay blocked:', err);
            });

            console.log('✅ COUNTDOWN READY: Son joué');
        } catch (error) {
            console.warn('Erreur countdown ready audio:', error);
        }
    }, [getAudioUrl]);

    const playCountdownGoSound = useCallback(() => {
        console.log('🚀 APPEL playCountdownGoSound');

        try {
            // Arrêter l'audio précédent
            if (countdownGoAudioRef.current) {
                countdownGoAudioRef.current.pause();
                countdownGoAudioRef.current.currentTime = 0;
                countdownGoAudioRef.current = null;
            }

            // ✅ CORRECTION : URL dynamique selon l'environnement
            const audioUrl = getAudioUrl('countdown-go.wav');
            countdownGoAudioRef.current = new Audio(audioUrl);
            countdownGoAudioRef.current.volume = volumeRef.current * 0.6;

            countdownGoAudioRef.current.play().catch(err => {
                console.log('Countdown go audio autoplay blocked:', err);
            });

            console.log('✅ COUNTDOWN GO: Son joué');
        } catch (error) {
            console.warn('Erreur countdown go audio:', error);
        }
    }, [getAudioUrl]);

    const playTensionMusic = useCallback(() => {
        console.log('🎼 APPEL playTensionMusic');

        try {
            // Arrêter l'audio précédent
            if (tensionAudioRef.current) {
                tensionAudioRef.current.pause();
                tensionAudioRef.current = null;
            }

            // ✅ CORRECTION : URL dynamique selon l'environnement
            const audioUrl = getAudioUrl('Tension-music.wav');
            tensionAudioRef.current = new Audio(audioUrl);
            tensionAudioRef.current.volume = volumeRef.current * 0.25; // Volume très discret
            tensionAudioRef.current.loop = true; // Boucle continue

            tensionAudioRef.current.play().catch(err => {
                console.log('Tension audio autoplay blocked:', err);
            });

            console.log('✅ TENSION MUSIC: Son joué en boucle');
        } catch (error) {
            console.warn('Erreur tension audio:', error);
        }
    }, [getAudioUrl]);

    const stopTensionMusic = useCallback(() => {
        console.log('🔇 APPEL stopTensionMusic');
        try {
            if (tensionAudioRef.current) {
                tensionAudioRef.current.pause();
                tensionAudioRef.current = null;
                console.log('✅ Tension music arrêtée');
            }
        } catch (error) {
            console.warn('⚠️ Erreur arrêt tension audio:', error);
        }
    }, []);

    // Fonction de changement de volume
    const handleVolumeChange = useCallback((newVolume) => {
        console.log('🔊 CHANGEMENT VOLUME:', newVolume);

        // Mise à jour immédiate de tous les audios
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
        if (countdownReadyAudioRef.current) {
            countdownReadyAudioRef.current.volume = newVolume * 0.8;
        }
        if (countdownGoAudioRef.current) {
            countdownGoAudioRef.current.volume = newVolume * 0.9;
        }
        if (tensionAudioRef.current) {
            tensionAudioRef.current.volume = newVolume * 0.25;
        }

        // Sauvegarder le volume
        try {
            localStorage.setItem('beatbox_audio_volume', newVolume.toString());
        } catch (error) {
            console.warn('⚠️ Impossible de sauvegarder le volume:', error);
        }

        setAudioVolume(newVolume);
    }, []);

    const stopAllAudio = useCallback(() => {
        console.log('🔇 ARRÊT TOUS AUDIOS');

        try {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (countdownReadyAudioRef.current) {
                countdownReadyAudioRef.current.pause();
                countdownReadyAudioRef.current = null;
            }
            if (countdownGoAudioRef.current) {
                countdownGoAudioRef.current.pause();
                countdownGoAudioRef.current = null;
            }
            stopTensionMusic();
        } catch (error) {
            console.warn('⚠️ Erreur arrêt audios:', error);
        }
    }, [stopTensionMusic]);

    // Fonction pour forcer l'activation audio (iOS/Safari)
    const forceEnableAudio = useCallback(() => {
        console.log('🔊 FORCE ENABLE AUDIO (iOS/Safari unlock)');

        // ✅ CRITICAL pour iOS/Safari : Jouer un son silencieux pour débloquer l'API Audio
        try {
            // Créer un contexte audio et le débloquer
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const audioContext = new AudioContext();
                const buffer = audioContext.createBuffer(1, 1, 22050);
                const source = audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContext.destination);
                source.start(0);
                console.log('✅ AudioContext débloqué pour iOS/Safari');
            }
        } catch (error) {
            console.warn('⚠️ Erreur déblocage AudioContext:', error);
        }

        setUserInteracted(true);
    }, []);

    // ✅ EXPOSITION POUR DEBUG (uniquement en dev)
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            window.debugAudio = {
                playCountdownReadySound,
                playCountdownGoSound,
                playTensionMusic,
                stopTensionMusic,
                forceEnableAudio,
                userInteracted,
                audioVolume,
                getAudioUrl, // ✅ NOUVEAU : Exposer la fonction d'URL

                // Fonctions de test direct avec URLs dynamiques
                testCountdownReady: () => {
                    console.log('🧪 TEST DIRECT countdown-ready');
                    const audioUrl = getAudioUrl('countdown-ready.wav');
                    const testAudio = new Audio(audioUrl);
                    testAudio.volume = 0.5;
                    testAudio.play()
                        .then(() => console.log('✅ Test direct réussi'))
                        .catch(e => console.error('❌ Test direct échoué:', e));
                },

                testCountdownGo: () => {
                    console.log('🧪 TEST DIRECT countdown-go');
                    const audioUrl = getAudioUrl('countdown-go.wav');
                    const testAudio = new Audio(audioUrl);
                    testAudio.volume = 0.5;
                    testAudio.play()
                        .then(() => console.log('✅ Test direct réussi'))
                        .catch(e => console.error('❌ Test direct échoué:', e));
                },

                testTension: () => {
                    console.log('🧪 TEST DIRECT tension-music');
                    const audioUrl = getAudioUrl('Tension-music.wav');
                    const testAudio = new Audio(audioUrl);
                    testAudio.volume = 0.2;
                    testAudio.play()
                        .then(() => console.log('✅ Test direct réussi'))
                        .catch(e => console.error('❌ Test direct échoué:', e));
                },

                // ✅ NOUVEAU : Fonction de test pour vérifier les URLs
                testUrls: () => {
                    const files = ['countdown-ready.wav', 'countdown-go.wav', 'Tension-music.wav'];
                    files.forEach(file => {
                        const url = getAudioUrl(file);
                        console.log(`🔗 ${file} → ${url}`);
                    });
                },

                // Informations sur l'environnement actuel
                getEnvironmentInfo: () => ({
                    hostname: window.location.hostname,
                    environment: window.location.hostname === 'dev.beatboxgames.com' ? 'staging' :
                        window.location.hostname === 'localhost' ? 'development' : 'production',
                    baseAudioUrl: getAudioUrl('').replace('/', '')
                })
            };

            console.log('🔧 Debug audio disponible: window.debugAudio');
        }
    }, [playCountdownReadySound, playCountdownGoSound, playTensionMusic, stopTensionMusic, forceEnableAudio, userInteracted, audioVolume, getAudioUrl]);

    return {
        // États
        audioVolume,
        showVolumeControl,
        audioRef,
        userInteracted,
        isSafari,

        // Setters
        setShowVolumeControl,

        // Fonctions
        playCountdownReadySound,
        playCountdownGoSound,
        playTensionMusic,
        stopTensionMusic,
        handleVolumeChange,
        stopAllAudio,
        forceEnableAudio,
        needsAudioUnlock,
        // ✅ NOUVEAU : Exposer la fonction d'URL pour d'autres composants si nécessaire
        getAudioUrl
    };
};