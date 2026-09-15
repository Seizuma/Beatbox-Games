import { useEffect, useState } from 'react';

/**
 * Hook personnalisé pour gérer les paramètres d'URL (mode et room)
 * ✅ CORRIGÉ : Meilleure gestion des liens partagés avec timeout de sécurité
 */
export const useUrlParams = (getUserSession, clearUserSession) => {
    const [detectedMode, setDetectedMode] = useState('normal');
    const [roomFromUrl, setRoomFromUrl] = useState(null);
    const [hasProcessedUrl, setHasProcessedUrl] = useState(false);
    const [isSharedLink, setIsSharedLink] = useState(false); // ✅ AJOUTÉ : État manquant

    useEffect(() => {
        if (hasProcessedUrl) return;

        console.log('🔍 useUrlParams - Début traitement URL');

        // ✅ TIMEOUT DE SÉCURITÉ : Éviter les blocages infinis
        const safetyTimeout = setTimeout(() => {
            if (!hasProcessedUrl) {
                console.warn('⚠️ TIMEOUT - Forcer hasProcessedUrl = true');
                setHasProcessedUrl(true);
            }
        }, 2000); // 2 secondes max

        const detectAndProcessParams = () => {
            let mode = 'normal';
            let urlRoom = null;
            let isFromSharedLink = false;

            console.log('🔍 Détection des paramètres URL...');
            console.log('📍 URL actuelle:', window.location.href);

            try {
                // ✅ Vérifier les paramètres d'URL standard (?room=XXX&mode=quick)
                const urlParams = new URLSearchParams(window.location.search);
                const urlMode = urlParams.get('mode');
                const urlRoomParam = urlParams.get('room');

                // ✅ Vérifier dans le hash (#/route?room=XXX&mode=quick)
                const hash = window.location.hash;
                let hashMode = null;
                let hashRoomParam = null;

                if (hash.includes('?')) {
                    const hashQuery = hash.split('?')[1];
                    const hashParams = new URLSearchParams(hashQuery);
                    hashMode = hashParams.get('mode');
                    hashRoomParam = hashParams.get('room');
                }

                console.log('🔍 Paramètres détectés:', {
                    urlMode, urlRoomParam,
                    hashMode, hashRoomParam
                });

                // Priorité au mode trouvé
                if (urlMode === 'quick' || hashMode === 'quick') {
                    mode = 'quick';
                    console.log('🎯 Mode quick détecté');
                }

                // Priorité à la room trouvée
                const roomParam = urlRoomParam || hashRoomParam;
                if (roomParam) {
                    const cleanRoom = roomParam.trim().toUpperCase();
                    console.log('🔍 Room param trouvé:', roomParam, '→', cleanRoom);

                    // Validation du format de room (5 caractères alphanumériques)
                    if (/^[A-Z0-9]{5}$/.test(cleanRoom)) {
                        urlRoom = cleanRoom;
                        isFromSharedLink = true;
                        console.log('✅ Room valide détectée depuis lien partagé:', urlRoom);

                        // ✅ Nettoyer immédiatement la session si lien partagé
                        console.log('🧹 Nettoyage session pour lien partagé');
                        clearUserSession();

                        // Nettoyer l'URL immédiatement après détection
                        cleanUrl();
                    } else {
                        console.warn('❌ Format de room invalide:', roomParam);
                    }
                }

                // ✅ Si pas de room dans l'URL ET pas de lien partagé, vérifier la session
                if (!urlRoom && !isFromSharedLink) {
                    const session = getUserSession();
                    console.log('🔍 Vérification session:', session);

                    if (session?.room) {
                        const sessionAge = Date.now() - session.timestamp;
                        const maxRecentAge = 2 * 60 * 1000; // 2 minutes maximum

                        if (sessionAge < maxRecentAge) {
                            urlRoom = session.room;
                            console.log('🎯 Room récupérée depuis la session:', urlRoom, `(${Math.round(sessionAge / 1000)}s ago)`);
                        } else {
                            console.log('🧹 Session expirée, nettoyage...', `(${Math.round(sessionAge / 1000)}s ago)`);
                            clearUserSession();
                        }
                    }
                }

                console.log('📋 Résultat détection final:', { mode, urlRoom, isFromSharedLink });

                // ✅ MISE À JOUR ATOMIQUE de tous les états
                setDetectedMode(mode);
                setRoomFromUrl(urlRoom);
                setIsSharedLink(isFromSharedLink);

                // ✅ CRITIQUE : Toujours marquer comme traité
                console.log('✅ URL traitée avec succès');
                setHasProcessedUrl(true);

                // Nettoyer le timeout de sécurité
                clearTimeout(safetyTimeout);

            } catch (error) {
                console.error('❌ Erreur lors de la détection des paramètres URL:', error);

                // ✅ FALLBACK sécurisé en cas d'erreur
                setDetectedMode('normal');
                setRoomFromUrl(null);
                setIsSharedLink(false);
                setHasProcessedUrl(true);

                // Nettoyer le timeout de sécurité
                clearTimeout(safetyTimeout);
            }
        };

        // ✅ Fonction pour nettoyer l'URL des paramètres
        const cleanUrl = () => {
            try {
                const url = new URL(window.location);
                let needsCleaning = false;

                // Vérifier s'il y a des paramètres à nettoyer
                if (url.searchParams.has('room') || url.searchParams.has('mode')) {
                    needsCleaning = true;
                }

                if (url.hash.includes('?')) {
                    const hashQuery = url.hash.split('?')[1];
                    const hashParams = new URLSearchParams(hashQuery);
                    if (hashParams.has('room') || hashParams.has('mode')) {
                        needsCleaning = true;
                    }
                }

                if (needsCleaning) {
                    // Créer une URL propre
                    let cleanedUrl;

                    if (url.hash.includes('?')) {
                        // Nettoyer le hash en gardant seulement la partie avant le ?
                        const hashBase = url.hash.split('?')[0];
                        cleanedUrl = `${url.protocol}//${url.host}${url.pathname}${hashBase}`;
                    } else {
                        // Nettoyer les paramètres d'URL normaux
                        cleanedUrl = `${url.protocol}//${url.host}${url.pathname}${url.hash}`;
                    }

                    console.log('🧹 Nettoyage URL:', window.location.href, '→', cleanedUrl);
                    window.history.replaceState({}, '', cleanedUrl);
                }
            } catch (error) {
                console.error('❌ Erreur lors du nettoyage URL:', error);
            }
        };

        // ✅ EXÉCUTION avec délai minimal pour éviter les problèmes de timing
        setTimeout(() => {
            detectAndProcessParams();
        }, 100);

        // ✅ CLEANUP du timeout en cas de démontage
        return () => {
            clearTimeout(safetyTimeout);
        };

    }, [getUserSession, clearUserSession, hasProcessedUrl]);

    // ✅ LOG de débogage pour vérifier les états
    useEffect(() => {
        console.log('🔍 useUrlParams états mis à jour:', {
            detectedMode,
            roomFromUrl,
            hasProcessedUrl,
            isSharedLink
        });
    }, [detectedMode, roomFromUrl, hasProcessedUrl, isSharedLink]);

    return {
        detectedMode,
        roomFromUrl,
        hasProcessedUrl,
        isSharedLink // ✅ CRITIQUE : Maintenant retourné
    };
};