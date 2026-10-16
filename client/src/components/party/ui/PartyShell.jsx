import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BrandMark from '../../brand/BrandMark';
import Icon from '../../icons/Icon';
import { useWakeLock } from '../../../hooks/useWakeLock';
import { Key, Panel } from './Hardware';
import { installPixelFrames } from './pixelFrames';

// Cadres pixel de l'interface, posés une fois en variables CSS
installPixelFrames();

// Coquille de Beatbox Party : sa propre barre du haut (châssis, sérigraphie), sa page
// sombre, sa fenêtre de confirmation et ses messages. Le petit logo ramène au site.
export default function PartyShell({ t, language, onLanguage, onQuit, quitConfirm, full = false, notice, children }) {
    const [confirm, setConfirm] = useState(null); // 'quit' | 'home' | null
    const navigate = useNavigate();
    useWakeLock(true);

    // « Quitter la partie » depuis le menu pause du jeu
    useEffect(() => {
        const onQuitRequest = () => (quitConfirm ? setConfirm('quit') : onQuit());
        window.addEventListener('party:quit', onQuitRequest);
        return () => window.removeEventListener('party:quit', onQuitRequest);
    }, [quitConfirm, onQuit]);

    useEffect(() => {
        if (!confirm) return undefined;
        const onKey = (event) => { if (event.key === 'Escape') setConfirm(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [confirm]);

    const leave = () => {
        const target = confirm;
        setConfirm(null);
        onQuit();
        if (target === 'home') navigate('/');
    };

    return (
        <div className="party-page party">
            <header className="party-topbar">
                <div className="party-topbar-inner">
                    <Link
                        to="/"
                        onClick={(event) => { if (quitConfirm) { event.preventDefault(); setConfirm('home'); } }}
                        aria-label={language === 'en' ? 'BeatBox Games, back to the site' : 'BeatBox Games, retour au site'}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md opacity-80 hover:opacity-100"
                    >
                        <BrandMark size={22} />
                    </Link>
                    <Key size="sm" onClick={() => (quitConfirm ? setConfirm('quit') : onQuit())} aria-label={t('quit')}>
                        <Icon name="arrow-left" size={16} />
                        <span className="hidden sm:inline">{t('quit')}</span>
                    </Key>
                    <span className="party-logo ml-1 truncate">
                        <span className="party-logo-mark" aria-hidden="true" />
                        {t('title')}
                    </span>
                    <div className="ml-auto flex items-center gap-1.5" role="group" aria-label="Langue / Language">
                        {/* Sur téléphone, une seule touche bascule la langue (le titre garde sa place) */}
                        <span className="sm:hidden">
                            <Key size="sm" onClick={() => onLanguage(language === 'fr' ? 'en' : 'fr')} aria-label={language === 'fr' ? 'English' : 'Français'}>
                                {language === 'fr' ? 'EN' : 'FR'}
                            </Key>
                        </span>
                        <span className="hidden gap-1.5 sm:flex">
                            {['fr', 'en'].map((code) => (
                                <Key key={code} size="sm" led="amber" ledOn={language === code} aria-pressed={language === code} onClick={() => onLanguage(code)}>
                                    {code.toUpperCase()}
                                </Key>
                            ))}
                        </span>
                    </div>
                </div>
            </header>

            <main className={`party-main ${full ? 'is-full' : ''}`}>{children}</main>

            {notice && (
                <p className="hw-toast hw-pop" role="status">{notice}</p>
            )}

            {confirm && quitConfirm && (
                <div className="hw-modal-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setConfirm(null); }}>
                    <Panel as="div" className="hw-modal hw-pop px-frame-red" role="dialog" aria-modal="true" aria-label={quitConfirm.title}>
                        <h2 className="hw-title text-3xl">{quitConfirm.title}</h2>
                        <p className="hw-text mt-3 text-[0.95rem]">{quitConfirm.text}</p>
                        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
                            <Key size="md" led="green" className="flex-1" onClick={() => setConfirm(null)} autoFocus>{quitConfirm.cancelLabel}</Key>
                            <Key size="md" led="red" className="flex-1" onClick={leave}>{quitConfirm.confirmLabel}</Key>
                        </div>
                    </Panel>
                </div>
            )}
        </div>
    );
}
