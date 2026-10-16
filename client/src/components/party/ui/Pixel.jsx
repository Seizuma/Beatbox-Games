import React, { useEffect, useRef, useState } from 'react';
import PixelCharacter from '../PixelCharacter';
import { sfx } from '../partySfx';

// Éléments d'interface de la famille « Pixel arcade » : menus à curseur (07-B) et boîte de
// dialogue RPG (08-B), dont l'ingé son est le présentateur.

/**
 * Menu à curseur ▶. items : [{ id, label, info, price, disabled, onSelect }].
 * keyboard : flèches haut/bas et Entrée/Espace (un seul menu actif à la fois).
 */
export function MenuList({ items, title = null, keyboard = true, className = '', label }) {
    const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
    const [current, setCurrent] = useState(enabled.length ? enabled[0] : 0);
    const ref = useRef({ items, current });
    ref.current = { items, current };
    const ids = items.map((it) => `${it.id}:${it.disabled ? 0 : 1}`).join('|');
    useEffect(() => {
        if (items[current] && !items[current].disabled) return;
        const first = items.findIndex((it) => !it.disabled);
        if (first >= 0) setCurrent(first);
        // Le curseur revient sur la première entrée possible quand la liste change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ids]);
    useEffect(() => {
        if (!keyboard) return undefined;
        const onKey = (event) => {
            const tag = event.target && event.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            const { items: list, current: cur } = ref.current;
            const move = (dir) => {
                for (let k = 1; k <= list.length; k += 1) {
                    const i = (cur + dir * k + list.length * 4) % list.length;
                    if (!list[i].disabled) { setCurrent(i); sfx('tick'); return; }
                }
            };
            if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
            else if ((event.key === 'Enter' || event.code === 'Space') && !event.repeat && tag !== 'BUTTON') {
                const it = list[cur];
                if (it && !it.disabled) { event.preventDefault(); sfx('hit'); it.onSelect(); }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [keyboard]);
    return (
        <div className={`px-menu ${className}`} role="menu" aria-label={label || title || undefined}>
            {title && <p className="px-menu-title">{title}</p>}
            {items.map((it, i) => (
                <button
                    key={it.id}
                    type="button"
                    role="menuitem"
                    className={`px-menu-item ${i === current ? 'is-current' : ''}`}
                    disabled={it.disabled}
                    onMouseEnter={() => !it.disabled && setCurrent(i)}
                    onFocus={() => !it.disabled && setCurrent(i)}
                    onClick={() => { sfx('hit'); it.onSelect(); }}
                >
                    {it.icon}
                    <span className="min-w-0">
                        <span className="block">{it.label}</span>
                        {it.info && <span className="px-menu-info">{it.info}</span>}
                    </span>
                    {it.price != null && <span className="px-menu-price">{it.price}</span>}
                </button>
            ))}
        </div>
    );
}

// Texte qui s'écrit lettre par lettre ; un clic l'affiche en entier
export function useTypewriter(text, speed = 34) {
    const [n, setN] = useState(0);
    useEffect(() => {
        setN(0);
        if (!text) return undefined;
        const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) { setN(text.length); return undefined; }
        const timer = setInterval(() => setN((k) => {
            if (k >= text.length) { clearInterval(timer); return k; }
            if (k % 3 === 0) sfx('tick');
            return k + 1;
        }), 1000 / speed);
        return () => clearInterval(timer);
    }, [text, speed]);
    return [text ? text.slice(0, n) : '', n >= (text || '').length, () => setN((text || '').length)];
}

const NPC_COLORS = { inge: '#1E2234', thief: '#2E2742', merch: '#35C877' };

/**
 * Boîte de dialogue RPG : portrait du personnage (inge, thief, merch), son nom, le texte qui
 * s'écrit, et au besoin un menu de réponses au-dessus.
 */
export function DialogBox({ speaker = 'inge', name, text, choices = null, layer = true }) {
    const [shown, done, finish] = useTypewriter(text);
    const box = (
        <div className="party-dialog" aria-live="polite">
            <span className="party-dialog-portrait" style={{ background: NPC_COLORS[speaker] || '#241c48' }} aria-hidden="true">
                <PixelCharacter id={speaker} pose={done ? 'idle' : 'present'} crop="bust" scale={2} />
            </span>
            <div className="party-dialog-box" role="presentation" onPointerDown={finish}>
                <p className="party-dialog-name">{name}</p>
                <p className="party-dialog-text">
                    <span className="sr-only">{text}</span>
                    <span aria-hidden="true">{shown}</span>
                    {!done && <span className="party-dialog-caret" aria-hidden="true" />}
                </p>
                {done && !choices && <span className="party-dialog-more" aria-hidden="true">▼</span>}
            </div>
            {choices && done && (
                <div className="party-dialog-choices">
                    <MenuList items={choices} />
                </div>
            )}
        </div>
    );
    return layer ? <div className="party-dialog-layer">{box}</div> : box;
}
