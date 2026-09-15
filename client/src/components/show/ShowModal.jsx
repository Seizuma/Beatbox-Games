import React, { useEffect, useId, useRef } from 'react';
import Icon from '../icons/Icon';

// Fenêtre du plateau : panneau qui monte du bas sur mobile, centré sur PC
export default function ShowModal({ open, onClose, title, closeLabel, children, footer }) {
    const titleId = useId();
    const panelRef = useRef(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return undefined;

        const previousFocus = document.activeElement;
        panelRef.current?.focus();

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onCloseRef.current?.();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
        };
    }, [open]);

    if (!open) return null;

    return (
        <div
            className="show-surface fixed inset-0 z-50 flex items-end justify-center bg-show-night/80 sm:items-center sm:p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onCloseRef.current?.();
            }}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl bg-show-stage-2 font-show text-show-white outline-none sm:rounded-2xl"
            >
                <div className="flex items-center justify-between gap-4 px-5 pt-5">
                    <h2 id={titleId} className="font-brand text-xl leading-none">{title}</h2>
                    <button
                        type="button"
                        onClick={() => onCloseRef.current?.()}
                        className="rounded-full p-1.5 text-show-muted transition-colors hover:text-show-white"
                    >
                        <Icon name="close" title={closeLabel} />
                    </button>
                </div>
                <div className="overflow-y-auto px-5 py-4">{children}</div>
                {footer && <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{footer}</div>}
            </div>
        </div>
    );
}