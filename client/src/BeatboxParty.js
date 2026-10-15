import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import SEO from './components/SEO';
import GameShell from './components/show/GameShell';
import { GameToast } from './components/show/GameNotices';
import { LanguageSwitch } from './components/UI';
import { useI18n } from './utils/i18n';
import partySocket from './party-socket';
import { PARTY_ENABLED } from './components/party/partyFlag';
import { createPartyT } from './components/party/partyI18n';
import { unlockAudio } from './components/party/partySfx';
import PartyHome from './components/party/PartyHome';
import PartyLobby from './components/party/PartyLobby';
import PartyPlay from './components/party/PartyPlay';
import PartyEnd from './components/party/PartyEnd';
import './components/party/party.css';

// Beatbox Party : jeu de plateau à quatre. Le serveur envoie l'état complet de la
// salle à chaque changement ; ce composant choisit l'écran selon la phase.

const SESSION_KEY = 'party_session';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Silkscreen&display=swap';

const readSession = () => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (error) { return null; }
};
const writeSession = (value) => {
    try {
        if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
        else localStorage.removeItem(SESSION_KEY);
    } catch (error) {
        // navigation privée
    }
};

function usePixelFont() {
    useEffect(() => {
        if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = FONT_HREF;
        document.head.appendChild(link);
    }, []);
}

function BeatboxPartyGame() {
    const { language, isEnglish, switchLanguage } = useI18n();
    const t = useMemo(() => createPartyT(language), [language]);
    const navigate = useNavigate();
    const location = useLocation();
    const initialCode = useMemo(() => (new URLSearchParams(location.search).get('room') || '').toUpperCase().slice(0, 5), [location.search]);
    usePixelFont();

    const [state, setState] = useState(null);
    const [myId, setMyId] = useState(null);
    const [connected, setConnected] = useState(false);
    const [busy, setBusy] = useState(false);
    const [restoring, setRestoring] = useState(() => Boolean(readSession()));
    const [discordName, setDiscordName] = useState(null);
    const [notice, setNotice] = useState('');
    const [clockOffset, setClockOffset] = useState(0);
    const queue = useRef([]);
    const noticeTimer = useRef(null);

    const showError = useCallback((code) => {
        setNotice(t(`errors.${code}`) === `errors.${code}` ? t('errors.default') : t(`errors.${code}`));
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(''), 4000);
    }, [t]);

    const receive = useCallback((snapshot) => {
        queue.current.push(snapshot);
        if (queue.current.length > 200) queue.current.splice(0, queue.current.length - 200);
        setClockOffset(snapshot.serverNow - Date.now());
        setState(snapshot);
    }, []);

    const enterRoom = useCallback((response) => {
        writeSession({ code: response.code, key: response.key });
        setMyId(response.playerId);
        receive(response.state);
        if (initialCode) navigate('/beatbox-party', { replace: true });
    }, [receive, initialCode, navigate]);

    // Reprise de la partie en cours (rechargement, coupure réseau)
    const rejoin = useCallback(async () => {
        const session = readSession();
        if (!session) {
            setRestoring(false);
            return;
        }
        const response = await partySocket.request('party:join', { code: session.code, key: session.key });
        if (response.ok) enterRoom(response);
        else {
            writeSession(null);
            setState(null);
            setMyId(null);
        }
        setRestoring(false);
    }, [enterRoom]);

    useEffect(() => {
        const onConnect = () => {
            setConnected(true);
            partySocket.emit('discord:getInfo', (response) => {
                if (response && response.success && response.user) setDiscordName(response.user.username);
            });
            rejoin();
        };
        const onDisconnect = () => setConnected(false);
        partySocket.on('connect', onConnect);
        partySocket.on('disconnect', onDisconnect);
        partySocket.on('party:state', receive);
        partySocket.connectWithAuth();
        if (partySocket.connected) onConnect();
        return () => {
            partySocket.off('connect', onConnect);
            partySocket.off('disconnect', onDisconnect);
            partySocket.off('party:state', receive);
            partySocket.disconnect();
        };
        // Connexion unique pour toute la durée de la page
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Toutes les actions : un aller-retour avec le serveur, une erreur affichée si besoin
    const act = useCallback(async (event, payload) => {
        unlockAudio();
        const response = await partySocket.request(event, payload);
        if (!response.ok && response.error && response.error !== 'not_now') showError(response.error);
        return response;
    }, [showError]);

    const actions = useMemo(() => ({
        roll: () => act('party:roll'),
        choose: (spaceId) => act('party:choose', { spaceId }),
        star: (buy) => act('party:star', { buy }),
        ready: () => act('party:ready'),
        submit: (raw) => act('party:mgResult', { raw }),
    }), [act]);

    const create = async (payload) => {
        unlockAudio();
        setBusy(true);
        const response = await partySocket.request('party:create', payload);
        setBusy(false);
        if (response.ok) enterRoom(response);
        else showError(response.error);
    };

    const join = async (payload) => {
        unlockAudio();
        setBusy(true);
        const session = readSession();
        const response = await partySocket.request('party:join', { ...payload, key: session && session.code === payload.code ? session.key : undefined });
        setBusy(false);
        if (response.ok) enterRoom(response);
        else showError(response.error);
    };

    const leaveRoom = async () => {
        await partySocket.request('party:leave');
        writeSession(null);
        queue.current = [];
        setState(null);
        setMyId(null);
    };

    const inRoom = Boolean(state && myId);
    const inGame = inRoom && state.phase !== 'lobby' && state.phase !== 'end';

    const handleQuit = () => {
        if (inRoom) leaveRoom();
        else navigate('/');
    };

    let content;
    if (!inRoom) {
        content = restoring || !connected ? (
            <p className="party-font party-blink py-16 text-center text-[color:var(--px-muted)]">{restoring ? t('home.rejoining') : t('home.connecting')}</p>
        ) : (
            <PartyHome t={t} language={language} discordName={discordName} initialCode={initialCode} busy={busy} onCreate={create} onJoin={join} />
        );
    } else if (state.phase === 'lobby') {
        content = (
            <PartyLobby
                state={state}
                myId={myId}
                t={t}
                language={language}
                onCharacter={(characterId) => act('party:character', { characterId })}
                onAddBot={() => act('party:addBot')}
                onRemoveBot={(playerId) => act('party:removeBot', { playerId })}
                onSettings={(settings) => act('party:settings', settings)}
                onStart={() => act('party:start')}
            />
        );
    } else if (state.phase === 'end') {
        content = <PartyEnd state={state} myId={myId} t={t} onRematch={() => act('party:rematch')} onLeave={() => { leaveRoom(); navigate('/'); }} />;
    } else {
        content = <PartyPlay state={state} myId={myId} t={t} queue={queue} clockOffset={clockOffset} actions={actions} />;
    }

    return (
        <GameShell
            title={t('title')}
            language={language}
            onQuit={handleQuit}
            quitLabel={t('quit')}
            showSettings={false}
            quitConfirm={inGame ? { title: t('quitTitle'), text: t('quitText'), confirmLabel: t('quitConfirm'), cancelLabel: t('keepPlaying'), closeLabel: t('close') } : null}
            tools={<LanguageSwitch switchLanguage={switchLanguage} isEnglish={isEnglish} />}
            contentClassName="party !max-w-6xl"
        >
            <SEO
                title={inRoom ? `${state.code} · Beatbox Party | BeatBox Games` : 'Beatbox Party | BeatBox Games'}
                description={t('home.intro')}
                path="/beatbox-party"
                language={language}
                noindex
            />
            <GameToast message={notice} />
            <span className="party-font mb-4 inline-block rounded-md bg-[color:var(--px-yellow)] px-2 py-0.5 text-xs text-[#1A1C2C]">{t('testBadge')}</span>
            {content}
        </GameShell>
    );
}

export default function BeatboxParty() {
    if (!PARTY_ENABLED) return <Navigate to="/" replace />;
    return <BeatboxPartyGame />;
}
