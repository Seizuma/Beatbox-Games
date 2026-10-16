import React, { useEffect, useRef } from 'react';
import PixelCharacter from '../PixelCharacter';
import { plain, textSprite } from '../board/pixelFont';

// Kit d'interface de Beatbox Party, dessiné comme le matériel du plateau :
// châssis noir mat et sérigraphie, touches en caoutchouc avec leur LED, grands pads
// ronds entourés d'un anneau de LED (les actions principales), écrans LCD graphiques.

export const LED = { red: '#E2402F', green: '#2EB75E', amber: '#F0AE22', blue: '#3F7EEA' };
export const LCD_ON = '#cfe0de';

/** Texte d'écran LCD graphique : police bitmap du plateau, agrandie sans lissage */
export function LcdText({ text, font = 'tiny', scale = 2, color = LCD_ON, className = '', label }) {
    const ref = useRef(null);
    const value = font === 'tiny' ? plain(text) : String(text);
    useEffect(() => {
        const cv = ref.current;
        if (!cv) return;
        const sprite = textSprite(value, color, { font, outline: null, shadow: false });
        cv.width = sprite.width;
        cv.height = sprite.height;
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.drawImage(sprite, 0, 0);
    }, [value, color, font]);
    const h = font === 'tiny' ? 5 : 8;
    return (
        <canvas
            ref={ref}
            role="img"
            aria-label={label || String(text)}
            className={`party-pixel inline-block align-middle ${className}`}
            style={{ height: h * scale, width: 'auto' }}
        />
    );
}

/** Écran LCD (cadre, fond, contenu libre) */
export function Lcd({ children, className = '', ...rest }) {
    return <div className={`hw-lcd ${className}`} {...rest}>{children}</div>;
}

/** Châssis : panneau noir mat, vis aux coins ; label = sérigraphie en haut à gauche */
export function Panel({ as: Tag = 'section', label, className = '', children, ...rest }) {
    return (
        <Tag className={`hw-panel ${className}`} {...rest}>
            {label && <p className="hw-label hw-panel-label">{label}</p>}
            {children}
        </Tag>
    );
}

/** Section encadrée d'un filet sérigraphié, avec son titre dans le filet */
export function Section({ title, className = '', children }) {
    return (
        <div className={`hw-section ${className}`}>
            {title && <span className="hw-label hw-section-title">{title}</span>}
            {children}
        </div>
    );
}

/** Voyant */
export function Led({ color = 'amber', on = true, className = '' }) {
    return <span className={`hw-led ${on ? 'is-on' : ''} ${className}`} style={{ '--led': LED[color] || color }} aria-hidden="true" />;
}

/** Touche en caoutchouc avec sa LED */
export function Key({ led, ledOn = true, size = 'md', className = '', children, type = 'button', ...rest }) {
    return (
        <button type={type} className={`hw-key hw-key-${size} ${className}`} {...rest}>
            {led && <Led color={led} on={ledOn} />}
            <span className="hw-key-text">{children}</span>
        </button>
    );
}

/**
 * Grand pad rond entouré d'un anneau de LED, comme les pads de piste d'une loopstation.
 * L'anneau tourne quand le pad attend qu'on le frappe.
 */
export function LoopPad({ color = 'green', size = 'lg', spinning = true, hint, className = '', children, ...rest }) {
    return (
        <button type="button" className={`hw-pad hw-pad-${size} ${spinning ? 'is-spinning' : ''} ${className}`} style={{ '--ring': LED[color] || color }} {...rest}>
            <span className="hw-pad-ring" aria-hidden="true" />
            <span className="hw-pad-cap">
                <span className="hw-pad-text">{children}</span>
                {hint && <span className="hw-pad-hint">{hint}</span>}
            </span>
        </button>
    );
}

/** Portrait d'un joueur dans l'anneau de LED de sa couleur */
export function PlayerRing({ player, color, size = 56, active = false, pose = 'idle', dim = false, className = '' }) {
    const scale = size >= 72 ? 2 : 1;
    return (
        <span
            className={`hw-ring ${active ? 'is-active' : ''} ${dim ? 'is-dim' : ''} ${className}`}
            style={{ '--ring': color, width: size, height: size }}
            aria-hidden="true"
        >
            <span className="hw-ring-leds" />
            <span className="hw-ring-face">
                {player && <PixelCharacter id={player.characterId} color={color} pose={pose} crop="bust" scale={scale} />}
            </span>
        </span>
    );
}
