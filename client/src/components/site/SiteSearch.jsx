import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSiteI18n } from '../../utils/siteI18n';
import { API_BASE_URL } from '../../utils/useApi';
import Icon from '../icons/Icon';
import { Avatar } from './SiteUI';

const HISTORY_KEY = 'beatbox_player_search_history';
const HISTORY_SIZE = 5;
const MIN_QUERY = 2;

const readHistory = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        return Array.isArray(saved) ? saved.slice(0, HISTORY_SIZE) : [];
    } catch (error) {
        return [];
    }
};

const writeHistory = (entries) => {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_SIZE)));
    } catch (error) {
        // Navigation privée ou stockage plein : l'historique est un confort, pas une fonction
    }
};

/**
 * Recherche de joueurs.
 * Icône dans la barre du haut, panneau avec autocomplétion et rappel des cinq
 * dernières recherches. L'historique est local au navigateur, jamais envoyé au serveur.
 */
export default function SiteSearch() {
    const { t } = useSiteI18n();
    const navigate = useNavigate();
    const inputId = useId();

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [status, setStatus] = useState('idle');
    const [history, setHistory] = useState(readHistory);
    const [highlight, setHighlight] = useState(-1);

    const inputRef = useRef(null);
    const panelRef = useRef(null);

    // Ouverture : focus sur le champ, et on repart d'une recherche vide
    useEffect(() => {
        if (!open) return undefined;
        setQuery('');
        setResults([]);
        setStatus('idle');
        setHighlight(-1);
        setHistory(readHistory());

        const timer = setTimeout(() => inputRef.current?.focus(), 30);
        return () => clearTimeout(timer);
    }, [open]);

    // Fermeture au clic extérieur et à Échap
    useEffect(() => {
        if (!open) return undefined;

        const onKeyDown = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        const onPointerDown = (event) => {
            if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false);
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('mousedown', onPointerDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('mousedown', onPointerDown);
        };
    }, [open]);

    // Autocomplétion : une requête après 250 ms sans frappe, annulée si on retape
    useEffect(() => {
        const needle = query.trim();
        if (needle.length < MIN_QUERY) {
            setResults([]);
            setStatus('idle');
            return undefined;
        }

        const controller = new AbortController();
        setStatus('loading');

        const timer = setTimeout(() => {
            fetch(`${API_BASE_URL}/api/players/search?q=${encodeURIComponent(needle)}`, { signal: controller.signal })
                .then((response) => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .then((data) => {
                    setResults(data.results || []);
                    setStatus('ready');
                    setHighlight(-1);
                })
                .catch((error) => {
                    if (error.name !== 'AbortError') setStatus('error');
                });
        }, 250);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query]);

    const rememberAndGo = (player) => {
        const entry = { discordId: player.discordId, username: player.username, avatar: player.avatar || null };
        const next = [entry, ...history.filter((item) => item.discordId !== entry.discordId)].slice(0, HISTORY_SIZE);

        setHistory(next);
        writeHistory(next);
        setOpen(false);
        navigate(`/player/${encodeURIComponent(player.discordId)}`);
    };

    const clearHistory = () => {
        setHistory([]);
        writeHistory([]);
    };

    // Liste affichée : les résultats si on tape, sinon l'historique
    const showingHistory = query.trim().length < MIN_QUERY;
    const list = useMemo(() => (showingHistory ? history : results), [showingHistory, history, results]);

    const onKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlight((index) => Math.min(index + 1, list.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((index) => Math.max(index - 1, -1));
        } else if (event.key === 'Enter' && highlight >= 0 && list[highlight]) {
            event.preventDefault();
            rememberAndGo(list[highlight]);
        }
    };

    return (
        <div className="relative" ref={panelRef}>
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-label={t('search.open')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-site-line bg-site-surface text-site-muted transition-colors hover:text-site-ink"
            >
                <Icon name="search" size={18} />
            </button>

            {open && (
                <div className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-site-line bg-site-surface shadow-[0_24px_48px_-24px_rgb(0_0_0/0.5)]">
                    <div className="flex items-center gap-2 border-b border-site-line px-3">
                        <Icon name="search" size={16} className="shrink-0 text-site-soft" />
                        <label htmlFor={inputId} className="sr-only">{t('search.label')}</label>
                        <input
                            id={inputId}
                            ref={inputRef}
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder={t('search.placeholder')}
                            autoComplete="off"
                            className="min-w-0 flex-1 bg-transparent py-3 text-sm text-site-ink placeholder:text-site-soft focus:outline-none"
                        />
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto">
                        {showingHistory && history.length > 0 && (
                            <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
                                <p className="text-[11px] font-bold text-site-soft">{t('search.recent')}</p>
                                <button
                                    type="button"
                                    onClick={clearHistory}
                                    className="text-[11px] font-semibold text-site-soft underline underline-offset-2 hover:text-site-ink"
                                >
                                    {t('search.clearHistory')}
                                </button>
                            </div>
                        )}

                        {showingHistory && history.length === 0 && (
                            <p className="px-3 py-6 text-center text-xs text-site-soft">{t('search.hint')}</p>
                        )}

                        {!showingHistory && status === 'loading' && (
                            <p className="px-3 py-6 text-center text-xs text-site-soft" aria-live="polite">{t('search.searching')}</p>
                        )}

                        {!showingHistory && status === 'error' && (
                            <p className="px-3 py-6 text-center text-xs text-site-muted">{t('search.error')}</p>
                        )}

                        {!showingHistory && status === 'ready' && results.length === 0 && (
                            <p className="px-3 py-6 text-center text-xs text-site-muted">{t('search.empty', { query: query.trim() })}</p>
                        )}

                        {list.length > 0 && (
                            <ul className="pb-1.5">
                                {list.map((player, index) => (
                                    <li key={player.discordId}>
                                        <button
                                            type="button"
                                            onClick={() => rememberAndGo(player)}
                                            onMouseEnter={() => setHighlight(index)}
                                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${index === highlight ? 'bg-site-tint' : ''}`}
                                        >
                                            <Avatar src={player.avatar} name={player.username} size={28} />
                                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.username}</span>
                                            {typeof player.totalGames === 'number' && (
                                                <span className="shrink-0 text-xs text-site-soft">
                                                    {t('search.games', { count: player.totalGames })}
                                                </span>
                                            )}
                                            {showingHistory && <Icon name="chevron-right" size={15} className="shrink-0 text-site-soft" />}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
