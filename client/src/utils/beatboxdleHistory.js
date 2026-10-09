// client/src/utils/beatboxdleHistory.js
//
// Historique du Beatboxdle gardé dans le navigateur : une ligne par énigme
// terminée (réussie ou non, en combien d'essais). C'est ce qui donne une série
// et une répartition des essais aux joueurs sans compte, comme sur Wordle.
//
// Les comptes Discord ont aussi leur historique côté serveur ; les deux se
// complètent (voir useBeatboxdleStats) : on garde le plus fourni.

import { useEffect, useState } from 'react';
import { fetchMyStats } from './beatboxdleApi';
import { getStoredDiscordToken } from './useApi';

// Hors du préfixe « beatboxdle:v1: » balayé chaque jour par purgeOldGames
const KEY = 'beatboxdle:history:v1';
const MODES = ['letters', 'clues'];

const empty = () => ({ letters: {}, clues: {} });

function readAll() {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (!saved || typeof saved !== 'object') return empty();
        return { ...empty(), ...saved };
    } catch (error) {
        return empty();
    }
}

/**
 * Note une énigme terminée. La première écriture fait foi, comme côté
 * serveur : rouvrir la page d'une partie finie ne change rien.
 */
export function recordLocalResult(mode, puzzleNumber, solved, attempts) {
    if (!MODES.includes(mode) || !puzzleNumber) return;
    try {
        const all = readAll();
        if (all[mode][puzzleNumber]) return;
        all[mode][puzzleNumber] = { s: solved ? 1 : 0, a: attempts };
        localStorage.setItem(KEY, JSON.stringify(all));
    } catch (error) {
        // Stockage indisponible : la partie reste jouable, sans statistiques
    }
}

/**
 * Séries et répartition, avec le même calcul que le serveur
 * (database.getBeatboxdleStats) pour que les deux sources se comparent.
 */
export function computeStats(entries) {
    const numbers = Object.keys(entries || {}).map(Number).filter(Boolean).sort((a, b) => a - b);
    const distribution = {};
    let won = 0;
    let currentStreak = 0;
    let bestStreak = 0;
    let previousNumber = null;

    numbers.forEach((number) => {
        const entry = entries[number];
        if (entry.s) {
            won += 1;
            distribution[entry.a] = (distribution[entry.a] || 0) + 1;
            currentStreak = previousNumber !== null && number === previousNumber + 1 ? currentStreak + 1 : 1;
        } else {
            currentStreak = 0;
        }
        bestStreak = Math.max(bestStreak, currentStreak);
        previousNumber = number;
    });

    return {
        played: numbers.length,
        won,
        winRate: numbers.length ? Math.round((won / numbers.length) * 100) : 0,
        currentStreak,
        bestStreak,
        distribution,
        lastPuzzleNumber: previousNumber,
    };
}

export const getLocalStats = (mode) => computeStats(readAll()[mode]);

/**
 * Série encore vivante aujourd'hui : elle tient si la dernière énigme jouée
 * est celle d'aujourd'hui ou d'hier. Un jour sauté la remet à zéro, même si
 * personne n'a rien écrit depuis.
 */
export function liveStreak(stats, todayNumber) {
    if (!stats || !stats.currentStreak || !todayNumber) return 0;
    return stats.lastPuzzleNumber >= todayNumber - 1 ? stats.currentStreak : 0;
}

/**
 * Statistiques d'un mode : celles du navigateur, remplacées par celles du
 * compte Discord quand il en connaît davantage (autre appareil, navigateur
 * vidé). `refreshKey` relit tout, par exemple à la fin d'une partie.
 */
export function useBeatboxdleStats(mode, refreshKey = 0) {
    const [stats, setStats] = useState(() => ({ ...getLocalStats(mode), source: 'local' }));

    useEffect(() => {
        let active = true;
        const local = { ...getLocalStats(mode), source: 'local' };
        setStats(local);

        if (getStoredDiscordToken()) {
            fetchMyStats(mode).then((remote) => {
                if (!active || !remote) return;
                if (remote.played >= local.played) setStats({ ...remote, source: 'account' });
            });
        }

        return () => {
            active = false;
        };
    }, [mode, refreshKey]);

    return stats;
}
