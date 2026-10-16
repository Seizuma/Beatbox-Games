import { useCallback, useEffect, useRef, useState } from 'react';

// Horloge d'un mini-jeu : millisecondes écoulées depuis son début (négatif pendant le décompte).
// clockOffset = heure du serveur moins heure locale, mesuré à la réception de l'état.
export function useMinigameClock(minigame, clockOffset) {
    const startLocal = minigame && minigame.startsAt ? minigame.startsAt - clockOffset : null;
    return useCallback(() => (startLocal == null ? -Infinity : Date.now() - startLocal), [startLocal]);
}

// Boucle d'animation : appelle draw(elapsedMs) à chaque image tant que le composant est affiché
export function useFrame(callback) {
    const ref = useRef(callback);
    ref.current = callback;
    useEffect(() => {
        let raf = 0;
        const loop = () => {
            ref.current();
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, []);
}

// Commande unique du mini-jeu : barre d'espace + bouton (appui et relâchement)
export function usePressKeys({ onDown, onUp, enabled = true }) {
    const handlers = useRef({ onDown, onUp });
    handlers.current = { onDown, onUp };
    useEffect(() => {
        if (!enabled) return undefined;
        const down = (event) => {
            if (event.code !== 'Space' || event.repeat) return;
            event.preventDefault();
            if (handlers.current.onDown) handlers.current.onDown();
        };
        const up = (event) => {
            if (event.code !== 'Space') return;
            event.preventDefault();
            if (handlers.current.onUp) handlers.current.onUp();
        };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
        };
    }, [enabled]);
}

// Canvas basse résolution agrandi sans lissage
export function setupPixelCanvas(canvas, width, height) {
    if (!canvas) return null;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return ctx;
}

export const OUT = '#120E26';

export function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

export function useOnce() {
    const [done, setDone] = useState(false);
    const ref = useRef(false);
    const mark = useCallback(() => {
        if (ref.current) return false;
        ref.current = true;
        setDone(true);
        return true;
    }, []);
    return [done, mark];
}

// Les quatre sons des pads de beatbox (mini-jeux de mémoire et de choix)
export const SOUNDS = [
    { id: 'kick', key: 'D', color: '#F0AE22', label: 'B' },
    { id: 'snare', key: 'F', color: '#E2402F', label: 'Pf' },
    { id: 'hat', key: 'J', color: '#3F7EEA', label: 'Ts' },
    { id: 'bass', key: 'K', color: '#2EB75E', label: 'Boum' },
];

// Touches D F J K (et 1 2 3 4) pour les quatre pads
export function usePadKeys(onPad, enabled = true) {
    const ref = useRef(onPad);
    ref.current = onPad;
    useEffect(() => {
        if (!enabled) return undefined;
        const down = (event) => {
            if (event.repeat) return;
            const k = event.key.toUpperCase();
            const index = SOUNDS.findIndex((s) => s.key === k);
            const digit = ['1', '2', '3', '4'].indexOf(event.key);
            const i = index >= 0 ? index : digit;
            if (i < 0) return;
            event.preventDefault();
            ref.current(i);
        };
        window.addEventListener('keydown', down);
        return () => window.removeEventListener('keydown', down);
    }, [enabled]);
}

// Équipe et rôle du joueur dans un mini-jeu (un contre trois, deux contre deux)
export function roleOf(minigame, myId) {
    const teams = minigame.teams;
    if (!teams) return { side: null, solo: false, mate: null };
    const side = teams.a.includes(myId) ? 'a' : teams.b.includes(myId) ? 'b' : null;
    const mate = side && minigame.kind === '2v2' ? teams[side].find((id) => id !== myId) : null;
    return { side, solo: minigame.solo === myId, mate };
}
