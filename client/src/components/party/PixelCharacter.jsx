import React, { useEffect, useRef } from 'react';
import { CROPS, mountSprite, PLAYER_COLORS } from './characters/pixelRig';

// Un personnage pixel art animé.
// - scale : taille d'un pixel du sprite à l'écran (un entier garde les pixels nets) ;
// - crop : 'full' (sprite entier), 'body' (sans la marge du haut), 'bust' (portrait).
export default function PixelCharacter({ id, pose = 'idle', color = PLAYER_COLORS[0], base = false, scale = 2, crop = 'body', facing = 1, className = '', label }) {
    const canvasRef = useRef(null);
    const spriteRef = useRef(null);

    useEffect(() => {
        spriteRef.current = mountSprite(canvasRef.current, { id, pose, color, base, crop, facing });
        return () => spriteRef.current && spriteRef.current.destroy();
        // Création unique : les changements passent par update()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (spriteRef.current) spriteRef.current.update({ id, pose, color, base, crop, facing });
    }, [id, pose, color, base, crop, facing]);

    const [, , w, h] = CROPS[crop] || CROPS.full;
    return (
        <canvas
            ref={canvasRef}
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
            className={`party-pixel ${className}`}
            style={{ width: w * scale, height: h * scale }}
        />
    );
}
