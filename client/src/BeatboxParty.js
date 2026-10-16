import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import SEO from './components/SEO';
import PartyShell from './components/party/ui/PartyShell';
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

function BeatboxPartyGame() {
    const { language, switchLanguage } = useI18n();
    const t = useMemo(() => createPartyT(language), [language]);
    const navigate = useNavigate();
    const location = useLocation();
    const initialCode = useMemo(() => (new URLSearchParams(location.search).get('room') || '').toUpperCase().slice(0, 5), [location.search]);

    const [state, setState] = useState(null);
    const [myId, setMyId] = useState(null);
    const [connected, setConnected] = useState(false);
    const [busy, setBusy] = useState(false);
    const [restoring, setRestoring] = useState(() => Boolean(readSession()));
    const [discordName, setDiscordName] = useState(null);
    const [notice, setNotice] = useState('');
    const [clockOffset, setClockOffset] = useState(0);
    // Plan du plateau pour les scènes de l'accueil (en partie, il arrive avec l'état)
    const [lobbyBoard, setLobbyBoard] = useState(null);
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
            partySocket.request('party:board', { id: 'setup' }).then((response) => {
                if (response && response.ok) setLobbyBoard(response.board);
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
        roll: (die) => act('party:roll', die ? { die } : {}),
        wheel: () => act('party:wheel'),
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
    const board = (state && state.board) || lobbyBoard;
    const inGame = inRoom && state.phase !== 'lobby' && state.phase !== 'end';
    // Plateau en plein cadre ; les mini-jeux gardent leur propre mise en page
    const fullScreen = inRoom && (state.phase === 'order' || state.phase === 'turn' || state.phase === 'minigame');

    const handleQuit = () => {
        if (inRoom) leaveRoom();
        else navigate('/');
    };

    let content;
    if (!inRoom) {
        content = restoring || !connected ? (
            <p className="hw-label hw-blink py-16 text-center !text-base">{restoring ? t('home.rejoining') : t('home.connecting')}</p>
        ) : (
            <PartyHome board={board} t={t} language={language} discordName={discordName} initialCode={initialCode} busy={busy} onCreate={create} onJoin={join} />
        );
    } else if (state.phase === 'lobby') {
        content = (
            <PartyLobby
                board={board}
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
        content = <PartyEnd board={board} state={state} myId={myId} t={t} onRematch={() => act('party:rematch')} onLeave={() => { leaveRoom(); navigate('/'); }} />;
    } else {
        content = <PartyPlay state={state} myId={myId} t={t} queue={queue} clockOffset={clockOffset} actions={actions} />;
    }

    return (
        <PartyShell
            t={t}
            language={language}
            onLanguage={switchLanguage}
            onQuit={handleQuit}
            quitConfirm={inGame ? { title: t('quitTitle'), text: t('quitText'), confirmLabel: t('quitConfirm'), cancelLabel: t('keepPlaying') } : null}
            full={fullScreen}
            notice={notice}
        >
            <SEO
                title={inRoom ? `${state.code} · Beatbox Party | BeatBox Games` : 'Beatbox Party | BeatBox Games'}
                description={t('home.intro')}
                path="/beatbox-party"
                language={language}
                noindex
            />
            {!fullScreen && <p className="hw-label mb-3 flex items-center gap-2"><span className="hw-led is-on" style={{ '--led': '#F0AE22' }} />{t('testBadge')}</p>}
            {content}
        </PartyShell>
    );
}

export default function BeatboxParty() {
    if (!PARTY_ENABLED) return <Navigate to="/" replace />;
    return <BeatboxPartyGame />;
}
