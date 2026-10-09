import React, { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../icons/Icon';
import { API_BASE_URL } from '../../utils/useApi';

const REFRESH_MS = 15000;
const PATHS = { blindtest: '/blindtest-online', buzzer: '/buzzer-battle' };

/**
 * Salles publiques en attente, relues toutes les 15 s tant que l'onglet est
 * visible. Une panne garde la dernière liste : l'accueil ne doit pas clignoter.
 */
export function usePublicRooms() {
    const [state, setState] = useState({ rooms: [], players: 0 });

    useEffect(() => {
        let active = true;
        let controller = null;

        const load = () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            controller?.abort();
            controller = new AbortController();
            fetch(`${API_BASE_URL}/api/rooms/public`, { signal: controller.signal })
                .then((response) => (response.ok ? response.json() : null))
                .then((payload) => {
                    if (active && payload && Array.isArray(payload.rooms)) {
                        setState({ rooms: payload.rooms, players: payload.players || 0 });
                    }
                })
                .catch(() => { });
        };

        load();
        const timer = setInterval(load, REFRESH_MS);
        document.addEventListener('visibilitychange', load);
        return () => {
            active = false;
            controller?.abort();
            clearInterval(timer);
            document.removeEventListener('visibilitychange', load);
        };
    }, []);

    return state;
}

/** Lien de partie rapide d'un jeu, sous le bouton de la carte. */
export const quickPath = (game) => `${PATHS[game]}?quick=1`;

/**
 * « Salles ouvertes » sur l'accueil : de quoi jouer tout de suite avec
 * d'autres, même sans ami connecté. Rien ne s'affiche quand tout est vide :
 * la partie rapide de chaque carte suffit alors à en ouvrir une.
 */
export default function PublicRooms({ rooms, players, t }) {
    const titleId = useId();
    if (!rooms.length) return null;

    return (
        <section aria-labelledby={titleId} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
                <h2 id={titleId} className="text-base font-bold">{t('hub.public.title')}</h2>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-site-muted">
                    <span className="h-2 w-2 rounded-full bg-[#2DBE6C]" aria-hidden="true" />
                    {t('hub.public.summary', { rooms: rooms.length, players })}
                </span>
            </div>
            <ul className="flex flex-col gap-2">
                {rooms.slice(0, 4).map((room) => (
                    <li key={`${room.game}-${room.code}`}>
                        <Link
                            to={`${PATHS[room.game]}?room=${encodeURIComponent(room.code)}`}
                            className="flex min-h-[3rem] items-center gap-3 rounded-lg border border-site-line bg-site-surface px-3 py-2 transition-colors hover:border-site-muted"
                        >
                            <Icon name="users" size={18} className="shrink-0 text-site-muted" />
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-bold">{t(`games.${room.game}.name`)}</span>
                                <span className="text-xs text-site-muted">
                                    {t('hub.public.players', { count: room.players, max: room.maxPlayers })}
                                    {' · '}
                                    {room.autoStartAt ? t('hub.public.starting') : t('hub.public.waiting')}
                                </span>
                            </span>
                            <span className="shrink-0 text-sm font-bold text-site-ink underline decoration-brand-yellow decoration-2 underline-offset-4">
                                {t('hub.public.join')}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
