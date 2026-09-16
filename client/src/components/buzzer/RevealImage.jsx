import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

// Effets de révélation de la photo. L'effet d'une manche est tiré à partir du numéro de manche
// et de l'image : tous les joueurs voient donc le même effet, sans rien changer côté serveur.
export const REVEAL_EFFECTS = ['blur', 'pixels', 'zoom', 'tiles'];

const TILE_COLUMNS = 8;
const TILE_ROWS = 6;

const hashString = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

// Générateur pseudo-aléatoire déterministe (même suite pour tous les joueurs)
const seededRandom = (seed) => {
    let state = seed || 1;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
};

export function pickRevealEffect(round, image) {
    if (!image) return 'blur';
    return REVEAL_EFFECTS[hashString(`${round}:${image}`) % REVEAL_EFFECTS.length];
}

// Taille réelle de la zone d'affichage : les effets sont calculés en proportion,
// pour que la photo soit aussi lisible sur téléphone que sur PC
function useElementSize(ref) {
    const [size, setSize] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return undefined;

        const update = () => {
            const rect = element.getBoundingClientRect();
            setSize({ width: rect.width, height: rect.height });
        };
        update();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', update);
            return () => window.removeEventListener('resize', update);
        }

        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);

    return size;
}

// Position et taille de l'image en mode « contain » dans la zone
const containRect = (imageWidth, imageHeight, boxWidth, boxHeight) => {
    if (!imageWidth || !imageHeight || !boxWidth || !boxHeight) return null;
    const scale = Math.min(boxWidth / imageWidth, boxHeight / imageHeight);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height };
};

function PixelCanvas({ image, hidden, size }) {
    const canvasRef = useRef(null);
    const bufferRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image || !size.width || !size.height) return;

        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.round(size.width * ratio);
        canvas.height = Math.round(size.height * ratio);

        const rect = containRect(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height);
        if (!rect) return;

        // Nombre de blocs en largeur : identique quel que soit l'écran
        const columns = Math.max(4, Math.round(4 + Math.pow(1 - hidden, 2.3) * 116));
        const rows = Math.max(3, Math.round(columns * (image.naturalHeight / image.naturalWidth)));

        if (!bufferRef.current) bufferRef.current = document.createElement('canvas');
        const buffer = bufferRef.current;
        buffer.width = columns;
        buffer.height = rows;

        const bufferContext = buffer.getContext('2d');
        bufferContext.imageSmoothingEnabled = true;
        bufferContext.clearRect(0, 0, columns, rows);
        bufferContext.drawImage(image, 0, 0, columns, rows);

        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(buffer, 0, 0, columns, rows, rect.x, rect.y, rect.width, rect.height);
    }, [image, hidden, size.width, size.height]);

    return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

/**
 * Photo du Buzzer Battle.
 * - hidden : 1 = totalement masquée, 0 = nette (dérivé du pixelLevel du serveur)
 * - revealed : réponse donnée, la photo s'affiche nette
 * - effect : blur | pixels | zoom | tiles
 */
export default function RevealImage({ src, round, hidden, revealed, effect, alt, onError }) {
    const boxRef = useRef(null);
    const size = useElementSize(boxRef);
    const [loaded, setLoaded] = useState(null);

    // Chargement dans un objet Image : rien ne s'affiche avant que la bonne image soit prête
    useEffect(() => {
        setLoaded(null);
        if (!src) return undefined;

        let cancelled = false;
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => {
            if (!cancelled) setLoaded({ src, image });
        };
        image.onerror = () => {
            if (!cancelled && onError) onError();
        };
        image.src = src;

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src]);

    const ready = loaded && loaded.src === src;
    const amount = Math.max(0, Math.min(1, hidden));
    const random = useMemo(() => seededRandom(hashString(`${round}:${src}`)), [round, src]);

    const zoomOrigin = useMemo(() => {
        const next = random();
        const other = random();
        return `${Math.round(25 + next * 50)}% ${Math.round(20 + other * 45)}%`;
    }, [random]);

    const tileOrder = useMemo(() => {
        const order = Array.from({ length: TILE_COLUMNS * TILE_ROWS }, (_, index) => index);
        const shuffle = seededRandom(hashString(`tiles:${round}:${src}`));
        for (let index = order.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(shuffle() * (index + 1));
            [order[index], order[swap]] = [order[swap], order[index]];
        }
        return order;
    }, [round, src]);

    const width = size.width || 600;
    const baseStyle = { WebkitTouchCallout: 'none' };
    let imageStyle = { ...baseStyle };
    let showCanvas = false;
    let tilesHidden = 0;

    if (!revealed) {
        switch (effect) {
            case 'pixels':
                showCanvas = amount > 0.01;
                break;
            case 'zoom':
                imageStyle = {
                    ...baseStyle,
                    transform: `scale(${1 + amount * 5})`,
                    transformOrigin: zoomOrigin,
                    filter: `blur(${(amount * width * 0.008).toFixed(2)}px)`,
                };
                break;
            case 'tiles':
                tilesHidden = Math.ceil(amount * TILE_COLUMNS * TILE_ROWS);
                imageStyle = { ...baseStyle, filter: `blur(${(amount * width * 0.006).toFixed(2)}px)` };
                break;
            case 'blur':
            default:
                imageStyle = {
                    ...baseStyle,
                    filter: `blur(${(amount * width * 0.045).toFixed(2)}px) brightness(${(0.7 + (1 - amount) * 0.3).toFixed(2)})`,
                    transform: `scale(${1 + amount * 0.08})`,
                };
                break;
        }
    }

    const hiddenTiles = new Set(tileOrder.slice(0, tilesHidden));

    return (
        <div ref={boxRef} className="absolute inset-0 overflow-hidden">
            {ready && !showCanvas && (
                <img
                    src={src}
                    alt={alt}
                    draggable="false"
                    className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
                    style={imageStyle}
                />
            )}

            {ready && showCanvas && <PixelCanvas image={loaded.image} hidden={amount} size={size} />}

            {ready && !revealed && effect === 'tiles' && tilesHidden > 0 && (
                <div
                    className="absolute inset-0 grid"
                    style={{ gridTemplateColumns: `repeat(${TILE_COLUMNS}, 1fr)`, gridTemplateRows: `repeat(${TILE_ROWS}, 1fr)` }}
                    aria-hidden="true"
                >
                    {Array.from({ length: TILE_COLUMNS * TILE_ROWS }, (_, index) => (
                        <span
                            key={index}
                            className={`border border-show-night/60 transition-opacity duration-300 ${hiddenTiles.has(index) ? 'bg-show-desk opacity-100' : 'opacity-0'}`}
                        />
                    ))}
                </div>
            )}

            {!ready && <div className="absolute inset-0 bg-show-night" aria-hidden="true" />}
        </div>
    );
}