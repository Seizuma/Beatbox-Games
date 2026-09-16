import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BrandMark from '../brand/BrandMark';
import Icon from '../icons/Icon';
import ShowButton from './ShowButton';
import ShowModal from './ShowModal';
import { useWakeLock } from '../../hooks/useWakeLock';
import { useThemedSurface, useThemeToggle } from '../../utils/siteTheme';

// Bascule jour / nuit du plateau
function ShowThemeToggle({ language }) {
    const { isNight, label, toggle } = useThemeToggle(language);

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={label}
            className="flex h-10 w-10 items-center justify-center rounded-full text-show-muted transition-colors hover:bg-show-stage-2 hover:text-show-white"
        >
            <Icon name={isNight ? 'sun' : 'moon'} size={18} />
        </button>
    );
}

// Coquille du « plateau » : tous les écrans à l'intérieur d'une salle de jeu.
// Le logo reste visible et ramène au site ; le reste de la navigation du site est absent.
// Les informations de jeu (manche, netteté…) vivent dans la zone de jeu, pas dans cette barre.
// quitConfirm = { title, text, confirmLabel, cancelLabel, closeLabel } demande une confirmation avant de quitter.
export default function GameShell({
    title,
    onQuit,
    quitLabel,
    quitConfirm,
    tools,
    actionBar,
    actionBarClassName = '',
    keepAwake = true,
    language = 'fr',
    children,
    contentClassName = '',
}) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingHome, setPendingHome] = useState(false);
    const navigate = useNavigate();
    const theme = useThemedSurface('show');
    useWakeLock(keepAwake);

    const homeLabel = language === 'en' ? 'BeatBox Games, back to the site' : 'BeatBox Games, retour au site';

    const handleQuitClick = () => {
        setPendingHome(false);
        if (quitConfirm) setConfirmOpen(true);
        else if (onQuit) onQuit();
    };

    // Le logo quitte aussi la salle, mais jamais sans confirmation quand une partie est en cours
    const handleHomeClick = (event) => {
        if (!quitConfirm) return;
        event.preventDefault();
        setPendingHome(true);
        setConfirmOpen(true);
    };

    const confirmQuit = () => {
        setConfirmOpen(false);
        if (pendingHome) {
            onQuit?.();
            navigate('/');
        } else {
            onQuit?.();
        }
        setPendingHome(false);
    };

    return (
        <div
            data-show-theme={theme}
            className="show-surface stage-light flex min-h-[100dvh] flex-col overflow-x-clip font-show text-show-white"
        >
            <header className="sticky top-0 z-30 border-b border-show-muted/15 bg-show-night/95 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 sm:gap-3 sm:px-5">
                    <Link
                        to="/"
                        onClick={handleHomeClick}
                        aria-label={homeLabel}
                        className="flex shrink-0 items-center rounded-full p-1 transition-opacity hover:opacity-80"
                    >
                        <BrandMark size={24} />
                    </Link>

                    {onQuit && (
                        <button
                            type="button"
                            onClick={handleQuitClick}
                            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-semibold text-show-muted transition-colors hover:text-show-white"
                        >
                            <Icon name="arrow-left" size={18} />
                            <span className="hidden sm:inline">{quitLabel}</span>
                            <span className="sr-only sm:hidden">{quitLabel}</span>
                        </button>
                    )}

                    {title && <span className="truncate font-brand text-base leading-none sm:text-lg">{title}</span>}

                    <div className="ml-auto flex items-center gap-1 sm:gap-2">
                        {tools}
                        <ShowThemeToggle language={language} />
                    </div>
                </div>
            </header>

            <main className={`mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8 ${contentClassName}`}>
                {children}
            </main>

            {actionBar && (
                <div className={`sticky bottom-0 z-20 bg-show-night ${actionBarClassName}`}>
                    <div className="mx-auto w-full max-w-xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                        {actionBar}
                    </div>
                </div>
            )}

            {quitConfirm && (
                <ShowModal
                    open={confirmOpen}
                    onClose={() => setConfirmOpen(false)}
                    title={quitConfirm.title}
                    closeLabel={quitConfirm.closeLabel}
                    footer={
                        <div className="flex flex-col gap-2 sm:flex-row-reverse">
                            <ShowButton size="md" block onClick={() => setConfirmOpen(false)}>
                                {quitConfirm.cancelLabel}
                            </ShowButton>
                            <ShowButton variant="outline" size="md" block onClick={confirmQuit}>
                                {quitConfirm.confirmLabel}
                            </ShowButton>
                        </div>
                    }
                >
                    <p className="text-[0.95rem] text-show-muted">{quitConfirm.text}</p>
                </ShowModal>
            )}
        </div>
    );
}

// Pastille d'information de la barre de plateau (manche, niveau, mode)
export function StatusPill({ children, highlight = false }) {
    return (
        <span
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-extrabold ${highlight ? 'bg-show-yellow text-show-night' : 'bg-show-stage-2 text-show-white'}`}
        >
            {children}
        </span>
    );
}