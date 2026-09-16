import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Onglet synchronisé avec l'URL (?game=buzzer).
 * Sans ça, le bouton retour du navigateur et le partage d'un lien retombent
 * toujours sur l'onglet par défaut.
 *
 * key      : nom du paramètre d'URL
 * allowed  : valeurs acceptées
 * fallback : valeur par défaut, retirée de l'URL pour garder les liens courts
 */
export default function useUrlTab(key, allowed, fallback) {
    const [searchParams, setSearchParams] = useSearchParams();

    const raw = searchParams.get(key);
    const value = allowed.includes(raw) ? raw : fallback;

    const setValue = useCallback((next) => {
        if (!allowed.includes(next)) return;

        const updated = new URLSearchParams(searchParams);
        if (next === fallback) updated.delete(key);
        else updated.set(key, next);

        setSearchParams(updated, { replace: false });
    }, [allowed, fallback, key, searchParams, setSearchParams]);

    return [value, setValue];
}