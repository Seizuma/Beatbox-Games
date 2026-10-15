import React, { useEffect, useMemo, useState } from 'react';
import CharacterPicker from './CharacterPicker';
import PartyScene, { VIEWS } from './board/PartyScene';
import { CHARACTER_IDS, PLAYER_COLORS } from './characters/pixelRig';

export function useNarrow(limit = 640) {
    const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < limit);
    useEffect(() => {
        const onResize = () => setNarrow(window.innerWidth < limit);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [limit]);
    return narrow;
}

// Accueil : la scène du micro géant, le nom, le personnage, créer ou rejoindre une salle
export default function PartyHome({ board, t, language, discordName, initialCode, busy, onCreate, onJoin }) {
    const [name, setName] = useState(() => {
        try { return localStorage.getItem('party_name') || ''; } catch (error) { return ''; }
    });
    const [character, setCharacter] = useState(() => {
        try { return localStorage.getItem('party_character') || 'nova'; } catch (error) { return 'nova'; }
    });
    const [code, setCode] = useState(initialCode || '');

    const remember = () => {
        try {
            localStorage.setItem('party_name', name.trim());
            localStorage.setItem('party_character', character);
        } catch (error) {
            // navigation privée
        }
    };
    const finalName = discordName || name.trim();
    const canPlay = Boolean(finalName) && !busy;

    // Sur scène : ton personnage au micro, entouré de trois autres
    const actors = useMemo(() => {
        const others = CHARACTER_IDS.filter((id) => id !== character).slice(0, 3);
        return [
            { id: others[0], pose: 'dance', color: PLAYER_COLORS[1], x: 735, y: 322, facing: 1 },
            { id: character, pose: 'beatbox', color: PLAYER_COLORS[0], x: 800, y: 318, facing: 1 },
            { id: others[1], pose: 'dance', color: PLAYER_COLORS[2], x: 865, y: 322, facing: -1 },
            { id: others[2], pose: 'idle', color: PLAYER_COLORS[3], x: 930, y: 332, facing: -1 },
        ];
    }, [character]);

    return (
        <div className="flex flex-col gap-6">
            <header className="party-panel grid overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <div className="order-2 flex flex-col justify-center gap-4 p-5 sm:p-7 md:order-1">
                    <span className="party-chip self-start">{t('home.kicker')}</span>
                    <h1 className="party-display text-5xl text-[color:var(--px-yellow)] drop-shadow-[0_0_18px_rgba(255,199,44,0.35)] sm:text-6xl">{t('title')}</h1>
                    <p className="text-[1.05rem] leading-relaxed text-[color:var(--px-muted)]">{t('home.intro')}</p>
                </div>
                <PartyScene board={board} view={VIEWS.hero} actors={actors} className="order-1 md:order-2" />
            </header>

            {initialCode && <p className="party-panel px-4 py-3 font-extrabold">{t('home.invited', { code: initialCode })}</p>}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <section className="party-panel flex flex-col gap-4 p-5">
                    {discordName ? (
                        <p className="text-sm text-[color:var(--px-muted)]">{t('home.discordName')} <strong className="text-[color:var(--px-ink)]">{discordName}</strong></p>
                    ) : (
                        <label className="flex flex-col gap-2">
                            <span className="party-kicker">{t('home.name')}</span>
                            <input className="party-input" maxLength={16} value={name} onChange={(event) => setName(event.target.value)} placeholder={t('home.namePlaceholder')} autoComplete="nickname" />
                        </label>
                    )}
                    <div className="flex flex-col gap-2">
                        <span className="party-kicker">{t('home.pick')}</span>
                        <CharacterPicker value={character} onChange={setCharacter} t={t} language={language} />
                    </div>
                    {!initialCode && (
                        <button
                            type="button"
                            className="party-btn party-btn-big mt-1 w-full sm:w-auto sm:self-start"
                            disabled={!canPlay}
                            onClick={() => { remember(); onCreate({ name: finalName, characterId: character }); }}
                        >
                            {t('home.create')}
                        </button>
                    )}
                </section>

                <form
                    className="party-panel flex flex-col gap-4 p-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        remember();
                        onJoin({ code: code.trim().toUpperCase(), name: finalName, characterId: character });
                    }}
                >
                    <h2 className="party-display text-2xl">{t('home.joinTitle')}</h2>
                    <label className="flex flex-col gap-2">
                        <span className="party-kicker">{t('home.code')}</span>
                        <input
                            className="party-input party-lcd-digits text-center text-3xl uppercase tracking-[0.25em] text-[color:var(--px-yellow)]"
                            maxLength={5}
                            value={code}
                            onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
                            placeholder="ABCDE"
                            autoComplete="off"
                            inputMode="text"
                        />
                    </label>
                    <button type="submit" className={`party-btn ${initialCode ? 'party-btn-big' : 'party-btn-white'}`} disabled={!canPlay || code.trim().length < 5}>
                        {t('home.join')}
                    </button>
                </form>
            </div>
        </div>
    );
}
