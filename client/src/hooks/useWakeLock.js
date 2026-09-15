import { useEffect } from 'react';

// Empêche l'écran du téléphone de se mettre en veille pendant qu'on est sur le plateau.
// Sans effet sur les navigateurs qui ne gèrent pas l'API Screen Wake Lock.
export function useWakeLock(active = true) {
    useEffect(() => {
        if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
            return undefined;
        }

        let sentinel = null;
        let cancelled = false;

        const request = async () => {
            try {
                sentinel = await navigator.wakeLock.request('screen');
                if (cancelled) {
                    sentinel.release().catch(() => { });
                }
            } catch (error) {
                // Refus possible (économie d'énergie, onglet en arrière-plan) : on ignore
            }
        };

        // Le verrou est relâché automatiquement quand l'onglet passe en arrière-plan
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) {
                request();
            }
        };

        request();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (sentinel && !sentinel.released) {
                sentinel.release().catch(() => { });
            }
        };
    }, [active]);
}