import React, { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../icons/Icon';

// Composants de base des pages de la chaîne (site)

export function PageContainer({ children, className = '' }) {
    return <div className={`mx-auto max-w-site px-4 pb-16 pt-8 sm:px-6 sm:pt-12 ${className}`}>{children}</div>;
}

export function PageHeader({ title, intro, children }) {
    return (
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
                <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-4xl">{title}</h1>
                {intro && <p className="mt-3 text-base leading-relaxed text-site-muted sm:text-lg">{intro}</p>}
            </div>
            {children && <div className="shrink-0">{children}</div>}
        </div>
    );
}

export function SectionTitle({ id, children, aside }) {
    return (
        <div className="mb-3">
            <h2 id={id} className="text-base font-bold sm:text-lg">{children}</h2>
            {aside && <p className="mt-0.5 text-xs text-site-soft">{aside}</p>}
        </div>
    );
}

const BUTTON_VARIANTS = {
    primary: 'bg-site-button text-site-on-button hover:bg-site-button-hover',
    secondary: 'border border-site-line bg-site-surface text-site-ink hover:bg-site-tint',
    danger: 'bg-site-danger text-site-paper hover:opacity-90',
    ghost: 'text-site-muted hover:bg-site-tint hover:text-site-ink',
};

const buttonClass = (variant, size, block, className) =>
    `inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'} ${BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary} ${block ? 'w-full' : ''} ${className}`;

export function SiteButton({ variant = 'primary', size = 'md', block = false, type = 'button', to, className = '', ...props }) {
    if (to) {
        return <Link to={to} className={buttonClass(variant, size, block, className)} {...props} />;
    }
    return <button type={type} className={buttonClass(variant, size, block, className)} {...props} />;
}

// Choix exclusif (onglets de jeu, filtres) : groupe de boutons à état pressé
export function Segmented({ label, options, value, onChange, className = '' }) {
    return (
        <div role="group" aria-label={label} className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-site-tint p-1 text-sm font-bold ${className}`}>
            {options.map((option) => {
                const active = option.id === value;
                return (
                    <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange(option.id)}
                        className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] transition-colors sm:px-3 sm:text-sm ${active ? 'bg-site-surface text-site-ink shadow-[0_1px_0_rgb(var(--site-line))]' : 'text-site-muted hover:text-site-ink'}`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export function Avatar({ src, name, size = 28 }) {
    const dimension = { width: size, height: size };
    if (src) {
        return <img src={src} alt="" loading="lazy" style={dimension} className="shrink-0 rounded-full bg-site-tint object-cover" />;
    }
    return (
        <span
            aria-hidden="true"
            style={dimension}
            className="flex shrink-0 items-center justify-center rounded-full bg-site-tint text-xs font-bold text-site-muted"
        >
            {(name || '?').charAt(0).toUpperCase()}
        </span>
    );
}

// Affiche le chargement, l'erreur ou le vide ; sinon le contenu
export function DataState({ status, isEmpty, loadingText, errorText, emptyText, children }) {
    if (status === 'loading' || status === 'idle') {
        return <p className="py-6 text-sm text-site-soft" aria-live="polite">{loadingText}</p>;
    }
    if (status === 'error') {
        return <p className="py-6 text-sm text-site-muted">{errorText}</p>;
    }
    if (isEmpty) {
        return <p className="py-6 text-sm text-site-muted">{emptyText}</p>;
    }
    return children;
}

export function Notice({ tone = 'neutral', children }) {
    const tones = {
        neutral: 'bg-site-tint text-site-muted',
        success: 'bg-site-tint text-site-ink border-l-4 border-site-success',
        error: 'bg-site-tint text-site-ink border-l-4 border-site-danger',
    };
    return (
        <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg px-4 py-3 text-sm ${tones[tone] || tones.neutral}`}>
            {children}
        </div>
    );
}

export function SiteModal({ open, onClose, title, closeLabel, children, footer }) {
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
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
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
                className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl border border-site-line bg-site-surface text-site-ink outline-none sm:rounded-2xl"
            >
                <div className="flex items-center justify-between gap-4 px-5 pt-5">
                    <h2 id={titleId} className="text-lg font-bold">{title}</h2>
                    <button
                        type="button"
                        onClick={() => onCloseRef.current?.()}
                        className="rounded-lg p-1.5 text-site-muted transition-colors hover:bg-site-tint hover:text-site-ink"
                    >
                        <Icon name="close" title={closeLabel} />
                    </button>
                </div>
                <div className="overflow-y-auto px-5 py-4">{children}</div>
                {footer && <div className="border-t border-site-line px-5 py-4">{footer}</div>}
            </div>
        </div>
    );
}