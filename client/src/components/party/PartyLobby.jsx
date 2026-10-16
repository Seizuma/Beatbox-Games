import React, { useState } from 'react';
import CharacterPicker from './CharacterPicker';
import PartyScene, { VIEWS, scenePoint } from './board/PartyScene';
import { useNarrow } from './PartyHome';
import { PLAYER_COLORS } from './characters/pixelRig';
import { Key, PlayerRing, Section } from './ui/Hardware';
import { copyToClipboard } from '../../utils/clipboard';
import { getPalette, setPalette } from './board/world';

const MAX = 4;
// Places sur les gros pads de piste 2 à 5, de gauche à droite
export const SEATS = [[755, 1008], [1000, 1008], [1245, 1008], [1490, 1008]];

// Salon : les joueurs montent sur scène, choix du personnage, réglages de l'hôte
export default function PartyLobby({ board, state, myId, t, language, onCharacter, onAddBot, onRemoveBot, onSettings, onStart }) {
    const [copied, setCopied] = useState(false);
    const [palette, setPaletteState] = useState(getPalette);
    const togglePalette = () => {
        const next = palette === 'adapted' ? 'standard' : 'adapted';
        setPalette(next);
        setPaletteState(next);
    };
    const narrow = useNarrow();
    const view = narrow ? VIEWS.lobbyNarrow : VIEWS.lobby;
    const me = state.players.find((p) => p.id === myId);
    const isHost = state.hostId === myId;
    const link = `${window.location.origin}/beatbox-party?room=${state.code}`;
    const takenBy = {};
    state.players.forEach((p) => {
        if (p.id !== myId && !p.isBot) takenBy[p.characterId] = p.name;
    });

    const copy = async () => {
        if (await copyToClipboard(link)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const seats = Array.from({ length: MAX }, (_, seat) => state.players.find((p) => p.seat === seat) || null);
    const actors = seats.map((p, seat) => p && {
        id: p.characterId,
        pose: p.id === myId ? 'beatbox' : p.isBot ? 'idle' : 'dance',
        color: PLAYER_COLORS[seat],
        x: SEATS[seat][0],
        y: SEATS[seat][1],
        facing: seat < 2 ? 1 : -1,
        dim: !p.isBot && !p.connected,
    }).filter(Boolean);

    // Texte sous le nom de chaque place : toi, hôte, bot, hors ligne
    const seatState = (p) => {
        if (!p) return t('lobby.empty');
        const parts = [];
        if (p.id === myId) parts.push(t('lobby.you'));
        if (p.id === state.hostId) parts.push(t('lobby.host'));
        if (p.isBot) parts.push(t('lobby.bot'));
        if (!p.isBot && !p.connected) parts.push(t('lobby.offline'));
        return parts.join(' · ');
    };

    return (
        <div className="flex flex-col gap-5">
            <section className="hw-panel flex flex-col gap-4 px-3 pb-4 pt-1 sm:px-5" aria-label={t('lobby.players')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="hw-label">{t('lobby.room')}</span>
                        <p className="px-tag text-3xl tracking-[0.18em]">{state.code}</p>
                    </div>
                    <Key size="md" onClick={copy} aria-pressed={copied}>
                        {copied ? t('lobby.copied') : t('lobby.copy')}
                    </Key>
                </div>
                <div className="party-scene-bezel">
                    <PartyScene board={board} view={view} actors={actors}>
                        {seats.map((p, seat) => (
                            <span key={seat} className="party-scene-label" style={{ ...scenePoint(view, SEATS[seat][0], SEATS[seat][1] + 70), '--tag': p ? PLAYER_COLORS[seat] : undefined }}>
                                {p ? p.name : t('lobby.empty')}
                            </span>
                        ))}
                    </PartyScene>
                </div>
                {/* Sélection arcade (12-B) : une colonne par joueur, 1P à 4P */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {seats.map((p, seat) => (
                        <div key={seat} className={`party-seat ${p && p.id === myId ? 'is-me' : ''}`} style={{ '--seat': PLAYER_COLORS[seat] }}>
                            <span className="party-seat-tag">{seat + 1}P</span>
                            {p ? (
                                <PlayerRing player={p} color={PLAYER_COLORS[seat]} size={72} active={p.id === myId} pose={p.id === myId ? 'beatbox' : 'idle'} dim={!p.isBot && !p.connected} />
                            ) : (
                                <span className="party-seat-empty" aria-hidden="true">?</span>
                            )}
                            <p className="party-seat-name">{p ? p.name : t('lobby.empty')}</p>
                            <p className={`party-seat-state ${p && (p.isBot || p.connected) ? 'is-ready' : ''}`}>{p ? seatState(p) : '\u00a0'}</p>
                            {isHost && !p && <Key size="sm" onClick={onAddBot}>{t('lobby.addBot')}</Key>}
                            {isHost && p && p.isBot && <Key size="sm" onClick={() => onRemoveBot(p.id)}>{t('lobby.removeBot')}</Key>}
                        </div>
                    ))}
                </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <section className="hw-panel px-3 pb-4 pt-1 sm:px-5" aria-label={t('lobby.character')}>
                    <h2 className="px-menu-title">{t('lobby.character')}</h2>
                    <CharacterPicker
                        value={me && me.characterId}
                        onChange={onCharacter}
                        takenBy={takenBy}
                        color={me ? PLAYER_COLORS[me.seat] : PLAYER_COLORS[0]}
                        t={t}
                        language={language}
                    />
                </section>

                <div className="flex flex-col gap-5">
                    <section className="hw-panel flex flex-col gap-5 px-3 pb-4 pt-1 sm:px-5" aria-label={t('lobby.settings')}>
                        <h2 className="px-menu-title">{t('lobby.settings')}</h2>
                        <Section title={t('lobby.board')}>
                            <p className="hw-strip-name !text-xl">{t('lobby.boardName')}</p>
                            <p className="hw-text mt-1 text-sm">{t('lobby.boardInfo')}</p>
                        </Section>
                        <Section title={t('lobby.turns')}>
                            <div role="radiogroup" aria-label={t('lobby.turns')} className="grid grid-cols-4 gap-2">
                                {(state.settings.turnOptions || [5, 10, 15, 20]).map((n) => (
                                    <Key
                                        key={n}
                                        size="md"
                                        role="radio"
                                        aria-label={t('lobby.turnsValue', { n })}
                                        aria-checked={state.settings.turns === n}
                                        disabled={!isHost}
                                        className="!px-1 disabled:!opacity-80"
                                        onClick={() => onSettings({ turns: n })}
                                    >
                                        {n}
                                    </Key>
                                ))}
                            </div>
                        </Section>
                        <Section title={t('lobby.botSpeed')}>
                            <div role="radiogroup" aria-label={t('lobby.botSpeed')} className="grid grid-cols-2 gap-2">
                                {(state.settings.botSpeeds || ['normal', 'fast']).map((speed) => (
                                    <Key
                                        key={speed}
                                        size="md"
                                        role="radio"
                                        aria-checked={(state.settings.botSpeed || 'fast') === speed}
                                        disabled={!isHost}
                                        className="disabled:!opacity-80"
                                        onClick={() => onSettings({ botSpeed: speed })}
                                    >
                                        {t(`lobby.botSpeedValue.${speed}`)}
                                    </Key>
                                ))}
                            </div>
                            <p className="hw-text mt-2 text-sm">{t('lobby.botSpeedInfo')}</p>
                        </Section>
                        <Section title={t('screen.palette')}>
                            <Key size="md" aria-pressed={palette === 'adapted'} className="w-full" onClick={togglePalette}>
                                {`${t('screen.palette')} : ${palette === 'adapted' ? t('screen.on') : t('screen.off')}`}
                            </Key>
                            <p className="hw-text mt-2 text-sm">{t('screen.paletteInfo')}</p>
                        </Section>
                        {isHost ? (
                            <>
                                <Key size="lg" className="hw-key-primary w-full" onClick={onStart}>{t('lobby.start')}</Key>
                                {state.players.length < MAX && <p className="hw-text text-sm">{t('lobby.fillBots')}</p>}
                            </>
                        ) : (
                            <p className="hw-label hw-blink !text-sm">{t('lobby.waitingHost')}</p>
                        )}
                    </section>

                    <section className="hw-panel px-3 pb-4 pt-1 sm:px-5" aria-label={t('lobby.rules')}>
                        <h2 className="px-menu-title">{t('lobby.rules')}</h2>
                        <ol className="flex flex-col gap-2.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <li key={n} className="flex gap-3">
                                    <span className="px-step" aria-hidden="true">{n}</span>
                                    <span className="hw-text text-[0.95rem]">{t(`lobby.rule${n}`)}</span>
                                </li>
                            ))}
                        </ol>
                    </section>
                </div>
            </div>
        </div>
    );
}
