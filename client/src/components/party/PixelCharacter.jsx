import React, { useEffect, useRef } from 'react';
import { mountSprite, PLAYER_COLORS, SPRITE_W, SPRITE_H } from './characters/pixelRig';

// Un personnage pixel art animé. `scale` : taille d'un pixel du sprite à l'écran.
export default function PixelCharacter({ id, pose = 'idle', color = PLAYER_COLORS[0], base = true, scale = 3, className = '', label }) {
    const canvasRef = useRef(null);
    const spriteRef = useRef(null);

    useEffect(() => {
        spriteRef.current = mountSprite(canvasRef.current, { id, pose, color, base });
        return () => spriteRef.current && spriteRef.current.destroy();
        // Création unique : les changements passent par update()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (spriteRef.current) spriteRef.current.update({ id, pose, color, base });
    }, [id, pose, color, base]);

    return (
        <canvas
            ref={canvasRef}
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
            className={`party-pixel ${className}`}
            style={{ width: SPRITE_W * scale, height: SPRITE_H * scale }}
        />
    );
}
