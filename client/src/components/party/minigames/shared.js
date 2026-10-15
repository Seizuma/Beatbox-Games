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
