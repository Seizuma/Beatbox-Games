import React, { useEffect, useMemo, useState } from 'react';
import CharacterPicker from './CharacterPicker';
import PartyScene, { VIEWS } from './board/PartyScene';
import { CHARACTER_IDS, PLAYER_COLORS } from './characters/pixelRig';
import { Key, Panel, Section } from './ui/Hardware';

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
            { id: others[2], pose: 'idle', color: PLAYER_COLORS[3], x: 755, y: 1008, facing: 1 },
            { id: others[0], pose: 'dance', color: PLAYER_COLORS[1], x: 877, y: 1008, h: 98, facing: 1 },
            { id: character, pose: 'beatbox', color: PLAYER_COLORS[0], x: 1000, y: 1008, facing: 1 },
            { id: others[1], pose: 'dance', color: PLAYER_COLORS[2], x: 1122, y: 1008, h: 98, facing: -1 },
        ];
    }, [character]);

    return (
        <div className="flex flex-col gap-6">
            <Panel as="header" className="grid gap-5 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center">
                <div className="order-2 flex flex-col gap-4 md:order-1 md:pl-2">
                    <p className="hw-label">{t('home.kicker')}</p>
                    <h1 className="hw-title text-6xl sm:text-7xl">{t('title')}</h1>
                    <div className="hw-rule" />
                    <p className="hw-text text-[1.02rem]">{t('home.intro')}</p>
                </div>
                <div className="party-scene-bezel order-1 md:order-2">
                    <PartyScene board={board} view={VIEWS.hero} actors={actors} />
                </div>
            </Panel>

            {initialCode && <Panel as="p" className="px-5 py-4 font-semibold">{t('home.invited', { code: initialCode })}</Panel>}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Panel className="flex flex-col gap-6 p-5 pt-7 sm:p-6 sm:pt-8">
                    {discordName ? (
                        <p className="hw-text text-sm">{t('home.discordName')} <strong className="text-[color:var(--hw-silk)]">{discordName}</strong></p>
                    ) : (
                        <Section title={t('home.name')}>
                            <input className="hw-input" maxLength={16} value={name} onChange={(event) => setName(event.target.value)} placeholder={t('home.namePlaceholder')} autoComplete="nickname" />
                        </Section>
                    )}
                    <Section title={t('home.pick')}>
                        <CharacterPicker value={character} onChange={setCharacter} t={t} language={language} />
                    </Section>
                    {!initialCode && (
                        <Key size="lg" disabled={!canPlay} className="hw-key-primary w-full sm:w-auto sm:self-start" onClick={() => { remember(); onCreate({ name: finalName, characterId: character }); }}>
                            {t('home.create')}
                        </Key>
                    )}
                </Panel>

                <Panel
                    as="form"
                    className="flex flex-col gap-5 p-5 pt-7 sm:p-6 sm:pt-8"
                    onSubmit={(event) => {
                        event.preventDefault();
                        remember();
                        onJoin({ code: code.trim().toUpperCase(), name: finalName, characterId: character });
                    }}
                >
                    <h2 className="hw-title text-3xl">{t('home.joinTitle')}</h2>
                    <Section title={t('home.code')}>
                        <input
                            className="hw-input text-center !text-3xl uppercase tracking-[0.3em]"
                            maxLength={5}
                            value={code}
                            onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
                            placeholder="ABCDE"
                            autoComplete="off"
                            inputMode="text"
                        />
                    </Section>
                    <Key type="submit" size={initialCode ? 'lg' : 'md'} led="green" disabled={!canPlay || code.trim().length < 5}>
                        {t('home.join')}
                    </Key>
                </Panel>
            </div>
        </div>
    );
}
