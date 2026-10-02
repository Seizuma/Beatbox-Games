import React, { useMemo, useRef, useState } from 'react';
import Icon from '../icons/Icon';
import { normalizeArtistName } from '../../utils/artistSearch.js';

// Textes du sélecteur de noms à partir de la fonction de traduction du plateau
export const getPickerLabels = (st) => ({
    search: st('picker.search'),
    selected: (count, total) => st('picker.selected', { count, total }),
    checkAll: st('picker.checkAll'),
    uncheckAll: st('picker.uncheckAll'),
    checkVisible: st('picker.checkVisible'),
    uncheckVisible: st('picker.uncheckVisible'),
    empty: st('picker.empty'),
    loading: st('picker.loading'),
    error: st('picker.error'),
    tooFew: (min) => st('picker.tooFew', { min }),
});

// Identifiants partagés entre un onglet et son panneau
export const tabId = (idBase, id) => `${idBase}-tab-${id}`;
export const panelId = (idBase, id) => `${idBase}-panel-${id}`;

// Onglets des réglages (Partie, Artistes, Joueurs) : flèches gauche/droite pour passer de l'un à l'autre
export function SettingsTabs({ idBase, tabs, active, onChange, label }) {
    const refs = useRef({});

    const focusTab = (index) => {
        const tab = tabs[(index + tabs.length) % tabs.length];
        onChange(tab.id);
        refs.current[tab.id]?.focus();
    };

    const handleKeyDown = (event, index) => {
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            focusTab(index + 1);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            focusTab(index - 1);
        }
    };

    return (
        <div role="tablist" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-show-night p-1">
            {tabs.map((tab, index) => {
                const selected = tab.id === active;
                return (
                    <button
                        key={tab.id}
                        ref={(node) => { refs.current[tab.id] = node; }}
                        id={tabId(idBase, tab.id)}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls={panelId(idBase, tab.id)}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(tab.id)}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                        className={`flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-sm font-extrabold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-show-yellow ${selected ? 'bg-show-yellow text-show-night' : 'text-show-muted hover:text-show-white'}`}
                    >
                        <span className="truncate">{tab.label}</span>
                        {tab.badge && (
                            <span className={`hidden shrink-0 rounded-full px-1.5 py-0.5 text-[11px] leading-none sm:inline ${selected ? 'bg-show-night/15' : 'bg-show-stage-2'}`}>
                                {tab.badge}
                            </span>
                        )}
                        {tab.alert && <span className="h-2 w-2 shrink-0 rounded-full bg-show-buzz" aria-hidden="true" />}
                    </button>
                );
            })}
        </div>
    );
}

// Panneau associé à un onglet
export function SettingsTabPanel({ idBase, id, active, children }) {
    return (
        <div
            role="tabpanel"
            id={panelId(idBase, id)}
            aria-labelledby={tabId(idBase, id)}
            hidden={id !== active}
            className="flex flex-col gap-6"
        >
            {children}
        </div>
    );
}

// Curseur avec boutons moins / plus pour un réglage précis au doigt
export function RangeField({ id, label, value, display, min, max, step = 1, onChange, help, decreaseLabel, increaseLabel, disabled = false }) {
    const clamp = (next) => Math.max(min, Math.min(max, next));
    const stepButton = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-show-night/70 text-show-white ring-1 ring-white/10 transition-colors hover:bg-show-night focus-visible:outline focus-visible:outline-2 focus-visible:outline-show-yellow disabled:cursor-not-allowed disabled:opacity-40';

    return (
        <div>
            <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={id} className="text-sm font-extrabold">{label}</label>
                <output htmlFor={id} className="font-brand text-2xl leading-none text-show-yellow">{display ?? value}</output>
            </div>
            <div className="mt-2 flex items-center gap-3">
                <button
                    type="button"
                    className={stepButton}
                    onClick={() => onChange(clamp(value - step))}
                    disabled={disabled || value <= min}
                    aria-label={decreaseLabel}
                >
                    <Icon name="minus" size={16} />
                </button>
                <input
                    id={id}
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    disabled={disabled}
                    onChange={(event) => onChange(clamp(parseInt(event.target.value, 10)))}
                    className="min-w-0 flex-1 accent-show-yellow disabled:opacity-50"
                />
                <button
                    type="button"
                    className={stepButton}
                    onClick={() => onChange(clamp(value + step))}
                    disabled={disabled || value >= max}
                    aria-label={increaseLabel}
                >
                    <Icon name="plus" size={16} />
                </button>
            </div>
            {help && <p className="mt-1.5 text-xs text-show-muted">{help}</p>}
        </div>
    );
}

/**
 * Sélection de noms à cocher (artistes du Blind Test, beatboxers du Buzzer Battle).
 * Uniquement des noms : aucune photo, pour ne rien dévoiler avant la partie.
 * excluded : Set des noms décochés. onChange reçoit le nouveau Set.
 */
export function NamePicker({ names, excluded, onChange, status = 'ready', minSelected = 1, help, labels }) {
    const [filter, setFilter] = useState('');

    const visible = useMemo(() => {
        const needle = normalizeArtistName(filter);
        return needle ? names.filter((name) => normalizeArtistName(name).includes(needle)) : names;
    }, [names, filter]);

    const selectedCount = names.filter((name) => !excluded.has(name)).length;
    const tooFew = status === 'ready' && names.length > 0 && selectedCount < minSelected;
    const filtering = visible.length !== names.length;

    const toggle = (name) => {
        const next = new Set(excluded);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        onChange(next);
    };

    // Avec une recherche en cours, seuls les noms affichés sont cochés ou décochés
    const setVisible = (checked) => {
        const next = new Set(excluded);
        visible.forEach((name) => {
            if (checked) next.delete(name);
            else next.add(name);
        });
        onChange(next);
    };

    const actionClass = 'rounded-full px-2.5 py-1 text-xs font-extrabold text-show-white ring-1 ring-show-desk transition-colors hover:ring-show-muted disabled:cursor-not-allowed disabled:opacity-40';

    return (
        <div className="flex flex-col gap-3">
            {help && <p className="text-sm text-show-muted">{help}</p>}

            <div className="sticky -top-4 z-10 -mx-5 flex flex-col gap-2.5 bg-show-stage-2 px-5 pb-2 pt-1">
                <div className="flex items-center gap-2 rounded-full bg-show-night/70 px-4 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-show-yellow">
                    <Icon name="search" size={16} className="text-show-muted" />
                    <input
                        type="search"
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                        placeholder={labels.search}
                        aria-label={labels.search}
                        autoComplete="off"
                        className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-show-white placeholder:text-show-muted focus:outline-none sm:text-sm"
                    />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-extrabold" aria-live="polite">
                        {labels.selected(selectedCount, names.length)}
                    </p>
                    <div className="flex gap-1.5">
                        <button type="button" className={actionClass} onClick={() => setVisible(true)} disabled={status !== 'ready' || visible.length === 0}>
                            {filtering ? labels.checkVisible : labels.checkAll}
                        </button>
                        <button type="button" className={actionClass} onClick={() => setVisible(false)} disabled={status !== 'ready' || visible.length === 0}>
                            {filtering ? labels.uncheckVisible : labels.uncheckAll}
                        </button>
                    </div>
                </div>
                {tooFew && (
                    <p role="alert" className="rounded-lg bg-show-buzz/15 px-3 py-2 text-xs font-semibold text-show-white">
                        {labels.tooFew(minSelected)}
                    </p>
                )}
            </div>

            {status === 'loading' && <p className="py-4 text-sm text-show-muted">{labels.loading}</p>}
            {status === 'error' && <p className="py-4 text-sm text-show-muted">{labels.error}</p>}

            {status === 'ready' && (
                visible.length === 0 ? (
                    <p className="py-4 text-sm text-show-muted">{labels.empty}</p>
                ) : (
                    <ul className="-mx-1 grid gap-x-2 sm:grid-cols-2">
                        {visible.map((name) => {
                            const checked = !excluded.has(name);
                            return (
                                <li key={name}>
                                    <label className={`flex min-h-[2.75rem] cursor-pointer items-center gap-3 rounded-lg px-2 transition-colors hover:bg-show-night/40 ${checked ? '' : 'text-show-muted'}`}>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggle(name)}
                                            className="peer sr-only"
                                        />
                                        <span
                                            aria-hidden="true"
                                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-show-yellow peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-show-stage-2 ${checked ? 'border-show-yellow bg-show-yellow text-show-night' : 'border-show-desk'}`}
                                        >
                                            {checked && <Icon name="check" size={14} />}
                                        </span>
                                        <span className={`min-w-0 truncate text-[0.95rem] font-semibold ${checked ? '' : 'line-through decoration-show-desk decoration-2'}`}>
                                            {name}
                                        </span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                )
            )}
        </div>
    );
}
