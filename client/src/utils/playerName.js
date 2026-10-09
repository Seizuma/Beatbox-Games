// client/src/utils/playerName.js
//
// Pseudo du joueur sans compte, partagé par le Blind Test et le Buzzer Battle :
// choisi une fois, retrouvé dans les deux jeux et lors des invitations par lien.
// La clé reprend celle qu'utilisait déjà le Buzzer Battle, pour que les pseudos
// enregistrés avant ce partage ne soient pas perdus.

import { getRandomPseudo } from './randomPseudo';

const STORAGE_KEY = 'buzzer_username';
const MAX_LENGTH = 20;

/** Pseudo enregistré dans ce navigateur, ou null. */
export function getSavedPlayerName() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved && saved.trim() ? saved.trim() : null;
    } catch (error) {
        return null;
    }
}

/** Retient le pseudo pour les prochaines parties, dans les deux jeux. */
export function savePlayerName(name) {
    const clean = (name || '').trim().slice(0, MAX_LENGTH);
    if (!clean) return;
    try {
        localStorage.setItem(STORAGE_KEY, clean);
    } catch (error) {
        // Navigation privée stricte : le pseudo vaut pour cette visite seulement
    }
}

/** Pseudo à proposer à l'arrivée : celui déjà choisi, sinon un pseudo au hasard. */
export function getInitialPlayerName() {
    return getSavedPlayerName() || getRandomPseudo();
}