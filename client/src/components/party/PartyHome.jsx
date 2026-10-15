import React, { useState } from 'react';
import CharacterPicker from './CharacterPicker';
import PixelCharacter from './PixelCharacter';
import { PLAYER_COLORS } from './characters/pixelRig';

// Accueil : nom, personnage, créer une salle ou en rejoindre une
export default function PartyHome({ t, language, discordName, initialCode, busy, onCreate, onJoin }) {
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

    return (
        <div className="flex flex-col gap-6">
            <header className="party-panel relative overflow-hidden p-5 sm:p-7">
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div className="max-w-xl">
                        <p className="party-font text-sm text-[color:var(--px-muted)]">{t('home.kicker')}</p>
                        <h1 className="party-font mt-2 text-4xl leading-none text-[color:var(--px-yellow)] sm:text-6xl">{t('title')}</h1>
                        <p className="mt-4 text-[1.05rem] leading-relaxed text-[color:var(--px-ink)]">{t('home.intro')}</p>
                    </div>
                    <div className="flex items-end justify-center gap-1" aria-hidden="true">
                        {['grizz', 'nova', 'robox', 'mimi'].map((id, i) => (
                            <PixelCharacter key={id} id={id} color={PLAYER_COLORS[i]} pose={['beatbox', 'dance', 'idle', 'cheer'][i]} scale={2} />
                        ))}
                    </div>
                </div>
            </header>

            {initialCode && <p className="party-panel px-4 py-3 font-bold">{t('home.invited', { code: initialCode })}</p>}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <section className="party-panel flex flex-col gap-4 p-5">
                    {discordName ? (
                        <p className="text-sm text-[color:var(--px-muted)]">{t('home.discordName')} <strong className="text-[color:var(--px-ink)]">{discordName}</strong></p>
                    ) : (
                        <label className="flex flex-col gap-2">
                            <span className="party-font text-sm">{t('home.name')}</span>
                            <input className="party-input" maxLength={16} value={name} onChange={(event) => setName(event.target.value)} placeholder={t('home.namePlaceholder')} autoComplete="nickname" />
                        </label>
                    )}
                    <div className="flex flex-col gap-2">
                        <span className="party-font text-sm">{t('home.pick')}</span>
                        <CharacterPicker value={character} onChange={setCharacter} t={t} language={language} />
                    </div>
                    {!initialCode && (
                        <button
                            type="button"
                            className="party-btn party-btn-big mt-1"
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
                    <h2 className="party-font text-xl">{t('home.joinTitle')}</h2>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm text-[color:var(--px-muted)]">{t('home.code')}</span>
                        <input
                            className="party-input party-font text-2xl uppercase tracking-[0.2em]"
                            maxLength={5}
                            value={code}
                            onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
                            placeholder="ABCDE"
                            autoComplete="off"
                            inputMode="text"
                        />
                    </label>
                    <button type="submit" className={`party-btn ${initialCode ? 'party-btn-big' : 'party-btn-ghost'}`} disabled={!canPlay || code.trim().length < 5}>
                        {t('home.join')}
                    </button>
                </form>
            </div>
        </div>
    );
}
