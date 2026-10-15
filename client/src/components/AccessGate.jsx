import React, { useCallback, useEffect, useRef, useState } from 'react';
import discordAuthClient from '../utils/discordAuth';
import { API_BASE_URL, getStoredDiscordToken } from '../utils/useApi';
import { createSiteT } from '../utils/siteI18n';
import { readLanguage } from '../utils/language';
import { copyToClipboard } from '../utils/clipboard';
import BrandMark from './brand/BrandMark';
import Icon from './icons/Icon';

// Version de test réservée aux comptes autorisés (voir server/services/accessGate.js).
//
// Activé au build par REACT_APP_ACCESS_GATE=true (docker-compose.dev.yml) : dans
// la version publique, ce composant rend directement l'application, sans requête.
// Le serveur fait le vrai contrôle ; cet écran sert à se connecter et à expliquer
// un refus.
export const ACCESS_GATE_ENABLED = process.env.REACT_APP_ACCESS_GATE === 'true';

const RETURN_KEY = 'bbg_gate_return';   // adresse à retrouver après le passage par Discord
const AUTO_KEY = 'bbg_gate_auto';       // une seule redirection automatique par visite

const PUBLIC_SITE = 'https://beatboxgames.com';

const session = {
    get: (key) => { try { return sessionStorage.getItem(key); } catch (error) { return null; } },
    set: (key, value) => { try { sessionStorage.setItem(key, value); } catch (error) { /* navigation privée */ } },
    remove: (key) => { try { sessionStorage.removeItem(key); } catch (error) { /* navigation privée */ } },
};

const localPath = (value) => (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null);

// Retour de Discord : /#token=...&success=true. Le jeton est rangé et retiré de l'adresse.
function takeTokenFromHash() {
    const { hash, pathname, search } = window.location;
    if (!hash.startsWith('#token=')) return;
    const params = new URLSearchParams(hash.slice(1));
    window.history.replaceState(window.history.state, '', `${pathname}${search}`);
    if (params.get('token') && params.get('success')) {
        discordAuthClient.handleAuthCallback(params.get('token'));
    }
}

// Remet l'adresse demandée avant le détour par Discord. Renvoie true si l'on quitte la page.
function restoreDestination() {
    const saved = localPath(session.get(RETURN_KEY));
    session.remove(RETURN_KEY);
    const current = `${window.location.pathname}${window.location.search}`;
    if (saved && saved !== current) window.history.replaceState(window.history.state, '', saved);

    // Adresse servie par le serveur (lien d'invitation…) : il la redirige ici avec ?next=
    const params = new URLSearchParams(window.location.search);
    const next = localPath(params.get('next'));
    if (next) {
        window.location.replace(next);
        return true;
    }
    return false;
}

export default function AccessGate({ children }) {
    return ACCESS_GATE_ENABLED ? <Gate>{children}</Gate> : children;
}

function Gate({ children }) {
    const [state, setState] = useState({ phase: 'checking' });
    const [copied, setCopied] = useState(false);
    const t = createSiteT(readLanguage());
    const running = useRef(false);

    const goToDiscord = useCallback(() => {
        session.set(RETURN_KEY, `${window.location.pathname}${window.location.search}`);
        session.set(AUTO_KEY, '1');
        setState({ phase: 'redirecting' });
        discordAuthClient.login('home');
    }, []);

    const check = useCallback(async ({ auto = true } = {}) => {
        if (running.current) return;
        running.current = true;
        try {
            takeTokenFromHash();
            const loginError = new URLSearchParams(window.location.search).get('error');
            const token = getStoredDiscordToken();

            // Pas de compte : direction Discord, une seule fois d'office (sinon un bouton)
            const needLogin = () => {
                if (auto && !loginError && !session.get(AUTO_KEY)) goToDiscord();
                else setState({ phase: 'login', loginError: Boolean(loginError) });
            };
            if (!token) return needLogin();

            const response = await fetch(`${API_BASE_URL}/api/access/session`, {
                method: 'POST',
                credentials: 'include',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json().catch(() => ({}));

            if (response.ok && data.allowed) {
                session.remove(AUTO_KEY);
                if (restoreDestination()) return undefined;
                setState({ phase: 'open' });
                return undefined;
            }
            if (response.status === 403) {
                setState({ phase: 'denied', discordId: data.discordId, username: data.username });
                return undefined;
            }
            // Jeton expiré ou invalide : on l'oublie et on repasse par Discord
            await discordAuthClient.logout();
            return needLogin();
        } catch (error) {
            setState({ phase: 'error' });
            return undefined;
        } finally {
            running.current = false;
        }
    }, [goToDiscord]);

    useEffect(() => {
        check();
    }, [check]);

    // Accès retiré ou session expirée en cours de route : l'API répond « access_* », on revérifie
    useEffect(() => {
        const original = window.fetch;
        window.fetch = async (...args) => {
            const response = await original(...args);
            const url = String(args[0] && args[0].url ? args[0].url : args[0]);
            if ((response.status === 401 || response.status === 403) && !url.includes('/api/access/')) {
                response.clone().json()
                    .then((body) => {
                        if (body && (body.error === 'access_required' || body.error === 'access_denied')) check();
                    })
                    .catch(() => {});
            }
            return response;
        };
        return () => {
            window.fetch = original;
        };
    }, [check]);

    const relogin = async () => {
        await discordAuthClient.logout();
        try {
            await fetch(`${API_BASE_URL}/api/access/logout`, { method: 'POST', credentials: 'include' });
        } catch (error) {
            // Le cookie expirera de lui-même
        }
        goToDiscord();
    };

    const copyId = async () => {
        if (await copyToClipboard(state.discordId || '')) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (state.phase === 'open') return children;

    const busy = state.phase === 'checking' || state.phase === 'redirecting';

    return (
        <main className="flex min-h-[100dvh] items-center justify-center bg-site-paper px-4 py-10 text-site-ink">
            <div className="w-full max-w-md">
                <div className="flex items-center gap-3">
                    <BrandMark size={40} />
                    <span className="font-brand text-xl tracking-wide">BEATBOX GAMES</span>
                    <span className="ml-auto rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold text-brand-ink">{t('accessGate.badge')}</span>
                </div>

                <div className="mt-8 rounded-2xl border border-site-line bg-site-surface p-6 sm:p-8" aria-live="polite">
                    {busy && (
                        <p className="flex items-center gap-3 text-site-muted">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-site-line border-t-brand-yellow" aria-hidden="true" />
                            {state.phase === 'redirecting' ? t('accessGate.redirecting') : t('accessGate.checking')}
                        </p>
                    )}

                    {state.phase === 'login' && (
                        <>
                            <h1 className="text-2xl font-bold">{t('accessGate.loginTitle')}</h1>
                            <p className="mt-3 text-site-muted">{t('accessGate.loginText')}</p>
                            {state.loginError && <p className="mt-4 rounded-lg bg-site-tint px-4 py-3 text-sm">{t('accessGate.loginError')}</p>}
                            <button type="button" onClick={goToDiscord} className="mt-6 inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg bg-site-button px-5 font-bold text-site-on-button hover:bg-site-button-hover">
                                <Icon name="discord" size={18} />
                                {t('accessGate.loginButton')}
                            </button>
                        </>
                    )}

                    {state.phase === 'denied' && (
                        <>
                            <h1 className="text-2xl font-bold">{t('accessGate.deniedTitle')}</h1>
                            <p className="mt-3 text-site-muted">{t('accessGate.deniedText', { name: state.username || '?' })}</p>
                            {state.discordId && (
                                <div className="mt-5">
                                    <p className="text-xs font-bold uppercase tracking-wide text-site-soft">{t('accessGate.idLabel')}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <code className="flex-1 rounded-lg bg-site-tint px-3 py-2.5 font-mono text-base tabular-nums">{state.discordId}</code>
                                        <button type="button" onClick={copyId} className="min-h-[2.75rem] rounded-lg border border-site-line px-4 text-sm font-bold hover:bg-site-tint">
                                            {copied ? t('accessGate.copied') : t('accessGate.copy')}
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="mt-6 flex flex-wrap gap-3">
                                <button type="button" onClick={() => check({ auto: false })} className="min-h-[2.75rem] rounded-lg bg-site-button px-5 font-bold text-site-on-button hover:bg-site-button-hover">
                                    {t('accessGate.retry')}
                                </button>
                                <button type="button" onClick={relogin} className="min-h-[2.75rem] rounded-lg border border-site-line px-5 font-bold hover:bg-site-tint">
                                    {t('accessGate.switchAccount')}
                                </button>
                            </div>
                        </>
                    )}

                    {state.phase === 'error' && (
                        <>
                            <h1 className="text-2xl font-bold">{t('accessGate.errorTitle')}</h1>
                            <p className="mt-3 text-site-muted">{t('accessGate.errorText')}</p>
                            <button type="button" onClick={() => check({ auto: false })} className="mt-6 min-h-[2.75rem] rounded-lg bg-site-button px-5 font-bold text-site-on-button hover:bg-site-button-hover">
                                {t('accessGate.retry')}
                            </button>
                        </>
                    )}
                </div>

                <p className="mt-6 text-center text-sm">
                    <a href={PUBLIC_SITE} className="text-site-muted underline underline-offset-4 hover:text-site-ink">{t('accessGate.publicSite')}</a>
                </p>
            </div>
        </main>
    );
}
