// client/src/utils/beatboxdleStorage.js
//
// Conservation locale de la partie du jour. Un daily se joue souvent en
// plusieurs fois (on ouvre, on bloque, on revient), donc la grille doit
// survivre à un rechargement — mais elle ne concerne que ce navigateur, d'où
// localStorage plutôt que la base.
//
// Une clé par mode et par jour : la partie d'hier n'est jamais rejouable, et
// les clés périmées sont balayées au chargement.

const PREFIX = 'beatboxdle:v1';

const keyFor = (mode, date) => `${PREFIX}:${mode}:${date}`;

/** Partie sauvegardée pour ce mode et ce jour, ou null. */
export function loadGame(mode, date, puzzleNumber) {
    try {
        const raw = localStorage.getItem(keyFor(mode, date));
        if (!raw) return null;
        const saved = JSON.parse(raw);
        // Garde-fou : si le numéro d'énigme a changé (graine modifiée, base
        // régénérée), la sauvegarde ne correspond plus à ce qu'on affiche.
        if (saved.puzzleNumber !== puzzleNumber) return null;
        return saved;
    } catch (error) {
        return null;
    }
}

export function saveGame(mode, date, game) {
    try {
        localStorage.setItem(keyFor(mode, date), JSON.stringify(game));
    } catch (error) {
        // Navigation privée stricte ou quota plein : la partie reste jouable,
        // elle ne survivra simplement pas au rechargement.
    }
}

/** Supprime les parties des jours précédents. Appelé une fois au montage. */
export function purgeOldGames(currentDate) {
    try {
        const stale = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`${PREFIX}:`) && !key.endsWith(`:${currentDate}`)) {
                stale.push(key);
            }
        }
        stale.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
        // Sans accès au stockage il n'y a rien à purger
    }
}