import { useEffect, useState } from 'react';

const STORAGE_KEY = 'beatbox_user_session';

/**
 * Hook personnalisé pour gérer la session utilisateur
 * Gère la sauvegarde/récupération du pseudo et de la room
 */
export const useSession = () => {
    const saveUserSession = (pseudo, room) => {
        try {
            if (!pseudo || !room) {
                console.warn('⚠️ Impossible de sauvegarder: pseudo ou room manquant', { pseudo, room });
                return;
            }

            const sessionData = {
                pseudo: pseudo.trim(),
                room: room.trim().toUpperCase(),
                timestamp: Date.now()
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
        } catch (error) {
            console.warn('❌ Impossible de sauvegarder la session:', error);
        }
    };

    const getUserSession = () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) {
                return null;
            }

            const sessionData = JSON.parse(stored);
            const now = Date.now();
            const maxAge = 5 * 60 * 1000; // 5 minutes

            if (now - sessionData.timestamp > maxAge) {
                localStorage.removeItem(STORAGE_KEY);
                return null;
            }

            return sessionData;
        } catch (error) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
    };

    const clearUserSession = () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.warn('Impossible de nettoyer la session:', error);
        }
    };

    return {
        saveUserSession,
        getUserSession,
        clearUserSession
    };
};