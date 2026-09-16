import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

// Effets de révélation de la photo. L'effet d'une manche est tiré à partir du numéro de manche
// et de l'image : tous les joueurs voient donc le même effet, sans rien changer côté serveur.
export const REVEAL_EFFECTS = ['blur', 'pixels', 'zoom', 'tiles'];

// Grille des tuiles. Plus de cases = une chute plus progressive.
const TILE_COLUMNS = 10;
const TILE_ROWS = 7;
const TILE_COUNT = TILE_COLUMNS * TILE_ROWS;

// Courbe de chute des tuiles : convexe, donc lente au début.
// À mi-manche, environ 22 % des cases sont tombées (contre 50 % en linéaire).
const TILE_CURVE = 2.2;

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

// En dessous de ce seuil, la photo est considérée comme nette : on la dessine
// telle quelle. Sans cette sortie, l'effet plafonnait à 120 blocs de large et
// la photo restait visiblement pixelisée, même une fois la réponse donnée.
const PIXEL_SHARP_THRESHOLD = 0.04;

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

        const context2d = canvas.getContext('2d');

        if (hidden <= PIXEL_SHARP_THRESHOLD) {
            context2d.imageSmoothingEnabled = true;
            context2d.clearRect(0, 0, canvas.width, canvas.height);
            context2d.drawImage(image, rect.x, rect.y, rect.width, rect.height);
            return;
        }

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

        context2d.imageSmoothingEnabled = false;
        context2d.clearRect(0, 0, canvas.width, canvas.height);
        context2d.drawImage(buffer, 0, 0, columns, rows, rect.x, rect.y, rect.width, rect.height);
    }, [image, hidden, size.width, size.height]);

    return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

// Voile de tuiles : elles tombent une à une, dans un ordre tiré au sort mais identique
// pour tous les joueurs, et s'estompent au lieu de disparaître d'un coup.
// Chaque tuile porte un liseré intérieur : le quadrillage se lit dès la première
// seconde, donc on comprend le principe avant même la première case retirée.
function TileVeil({ order, hidden }) {
    const revealedCount = Math.round(TILE_COUNT * Math.pow(1 - hidden, TILE_CURVE));

    return (
        <div
            className="absolute inset-0 grid"
            style={{
                gridTemplateColumns: `repeat(${TILE_COLUMNS}, 1fr)`,
                gridTemplateRows: `repeat(${TILE_ROWS}, 1fr)`,
            }}
            aria-hidden="true"
        >
            {order.map((tileIndex, position) => {
                const gone = position < revealedCount;
                return (
                    <span
                        key={tileIndex}
                        style={{
                            gridColumn: (tileIndex % TILE_COLUMNS) + 1,
                            gridRow: Math.floor(tileIndex / TILE_COLUMNS) + 1,
                            opacity: gone ? 0 : 1,
                            // Liseré plus clair que le fond : sépare les tuiles sans
                            // laisser voir la photo qui est dessous
                            boxShadow: 'inset 0 0 0 1px rgb(var(--show-stage-2) / 0.75)',
                        }}
                        className="bg-show-night transition-opacity duration-[450ms] ease-out motion-reduce:duration-0"
                    />
                );
            })}
        </div>
    );
}

/**
 * Photo du Buzzer Battle.
 * - hidden : 1 = totalement masquée, 0 = nette (lissée par useRevealProgress)
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
    const amount = revealed ? 0 : Math.max(0, Math.min(1, hidden));
    const random = useMemo(() => seededRandom(hashString(`${round}:${src}`)), [round, src]);

    const zoomOrigin = useMemo(() => {
        const next = random();
        const other = random();
        return `${Math.round(25 + next * 50)}% ${Math.round(20 + other * 45)}%`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [random]);

    // Ordre de chute des tuiles : mélange de Fisher-Yates avec la même graine partout
    const tileOrder = useMemo(() => {
        const order = Array.from({ length: TILE_COUNT }, (_, index) => index);
        for (let index = order.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(random() * (index + 1));
            [order[index], order[swap]] = [order[swap], order[index]];
        }
        return order;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [random]);

    const imageStyle = {};
    if (effect === 'blur') {
        imageStyle.filter = `blur(${(amount * 26).toFixed(2)}px)`;
        imageStyle.transform = `scale(${1 + amount * 0.08})`;
    } else if (effect === 'zoom') {
        imageStyle.transform = `scale(${1 + amount * 7})`;
        imageStyle.transformOrigin = zoomOrigin;
    }

    return (
        <div ref={boxRef} className="absolute inset-0 overflow-hidden bg-show-night">
            {ready && effect === 'pixels' && !revealed ? (
                <PixelCanvas image={loaded.image} hidden={amount} size={size} />
            ) : ready ? (
                <img
                    src={src}
                    alt={alt}
                    style={imageStyle}
                    className="absolute inset-0 h-full w-full object-contain transition-[filter,transform] duration-300 ease-out motion-reduce:transition-none"
                />
            ) : null}

            {ready && effect === 'tiles' && !revealed && <TileVeil order={tileOrder} hidden={amount} />}
        </div>
    );
}
