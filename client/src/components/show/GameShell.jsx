import React from 'react';
import BrandMark from '../brand/BrandMark';
import Icon from '../icons/Icon';

// Coquille du « plateau » : tous les écrans à l'intérieur d'une salle de jeu.
// Pas de navigation du site ici, seulement une barre de plateau et une barre d'action ancrée en bas.
export default function GameShell({
    title,
    onQuit,
    quitLabel,
    status,
    tools,
    actionBar,
    actionBarClassName = '',
    children,
    contentClassName = '',
}) {
    return (
        <div className="show-surface flex min-h-[100dvh] flex-col bg-show-stage font-show text-show-white">
            <header className="sticky top-0 z-30 bg-show-night">
                <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-3 sm:px-5">
                    {onQuit ? (
                        <button
                            type="button"
                            onClick={onQuit}
                            className="-ml-1 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-semibold text-show-muted transition-colors hover:text-show-white"
                        >
                            <Icon name="arrow-left" size={18} />
                            <span className="hidden sm:inline">{quitLabel}</span>
                            <span className="sr-only sm:hidden">{quitLabel}</span>
                        </button>
                    ) : (
                        <BrandMark size={24} />
                    )}

                    {title && <span className="font-brand text-base leading-none sm:text-lg">{title}</span>}

                    {status && <div className="hidden min-w-0 items-center gap-2 md:flex">{status}</div>}

                    <div className="ml-auto flex items-center gap-2">{tools}</div>
                </div>

                {status && <div className="flex gap-2 overflow-x-auto px-3 pb-2 md:hidden">{status}</div>}
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