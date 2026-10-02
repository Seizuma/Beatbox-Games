// server/scripts/shared/http.js
//
// Client HTTP commun aux scrapers : une requête à la fois PAR HÔTE, espacées,
// avec cache disque pour le texte. Le cache est ce qui rend les pipelines
// utilisables : on relance le parsing vingt fois pendant la mise au point
// sans renvoyer une seule requête aux sites.
//
// Les images, elles, ne passent pas par le cache : elles sont écrites
// directement à leur destination finale.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_USER_AGENT = 'BeatBoxGamesBot/1.0 (+https://beatboxgames.com; contact@beatboxgames.com)';

/**
 * @param {object} options
 * @param {string} options.cacheDir     dossier du cache texte
 * @param {number} [options.delayMs]    délai minimal entre deux requêtes au même hôte
 * @param {object} [options.hostDelays] délais spécifiques, ex. { 'www.youtube.com': 3000 }
 * @param {string} [options.userAgent]
 * @param {number} [options.retries]
 * @param {number} [options.timeoutMs]
 * @param {string} [options.cacheExtension] extension des fichiers de cache
 */
function createClient(options) {
    const {
        cacheDir,
        delayMs = 1200,
        hostDelays = {},
        userAgent = DEFAULT_USER_AGENT,
        retries = 3,
        timeoutMs = 20000,
        cacheExtension = '.cache',
    } = options;

    const lastRequestAt = new Map(); // hôte -> horodatage
    const stats = { network: 0, cache: 0, errors: 0, downloads: 0 };

    const cachePath = (url) => {
        const hash = crypto.createHash('sha1').update(url).digest('hex');
        return path.join(cacheDir, `${hash}${cacheExtension}`);
    };

    async function throttle(url) {
        const host = new URL(url).host;
        const delay = hostDelays[host] ?? delayMs;
        const wait = delay - (Date.now() - (lastRequestAt.get(host) || 0));
        if (wait > 0) await sleep(wait);
        lastRequestAt.set(host, Date.now());
        return delay;
    }

    /**
     * Requête avec relances. Renvoie { response }, { notFound: true } ou
     * { failed: true }. Les 429 et 5xx déclenchent une attente croissante.
     */
    async function request(url, headers = {}) {
        for (let attempt = 1; attempt <= retries; attempt += 1) {
            const delay = await throttle(url);
            try {
                const response = await fetch(url, {
                    headers: { 'User-Agent': userAgent, 'Accept-Language': 'en', ...headers },
                    redirect: 'follow',
                    signal: AbortSignal.timeout(timeoutMs),
                });

                if (response.status === 404 || response.status === 410) return { notFound: true };

                if (response.status === 429 || response.status >= 500) {
                    const backoff = delay * 4 * attempt;
                    console.warn(`   ⏳ ${response.status} sur ${url} — nouvelle tentative dans ${backoff} ms`);
                    await sleep(backoff);
                    continue;
                }

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return { response };
            } catch (error) {
                if (attempt === retries) {
                    stats.errors += 1;
                    console.error(`   ❌ Échec définitif sur ${url}: ${error.message}`);
                    return { failed: true };
                }
                await sleep(delay * 4 * attempt);
            }
        }
        stats.errors += 1;
        return { failed: true };
    }

    /**
     * Récupère une page texte (HTML ou JSON brut). null si elle n'existe pas.
     * @param {string} url
     * @param {{ force?: boolean, headers?: object }} fetchOptions force: ignorer le cache
     */
    async function fetchText(url, fetchOptions = {}) {
        fs.mkdirSync(cacheDir, { recursive: true });
        const file = cachePath(url);

        if (!fetchOptions.force && fs.existsSync(file)) {
            stats.cache += 1;
            const cached = fs.readFileSync(file, 'utf8');
            return cached === '__404__' ? null : cached;
        }

        const { response, notFound } = await request(url, {
            Accept: 'text/html,application/xhtml+xml,application/json',
            ...fetchOptions.headers,
        });
        if (!response) {
            // Seul un vrai 404 est mis en cache : une panne réseau doit pouvoir être retentée.
            if (notFound) fs.writeFileSync(file, '__404__');
            return null;
        }

        const text = await response.text();
        fs.writeFileSync(file, text);
        stats.network += 1;
        return text;
    }

    async function fetchJson(url, fetchOptions = {}) {
        const text = await fetchText(url, fetchOptions);
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch (error) {
            console.warn(`   ⚠️  JSON illisible sur ${url}`);
            return null;
        }
    }

    /**
     * Télécharge un fichier binaire. Renvoie { file, bytes, contentType } ou null.
     * L'extension est déduite du type MIME quand `dest` n'en a pas.
     * `headers` sert surtout au Referer : le CDN du wiki refuse les images
     * demandées hors de ses pages.
     */
    async function download(url, dest, { maxBytes = 15 * 1024 * 1024, headers = {} } = {}) {
        const { response } = await request(url, { Accept: 'image/avif,image/webp,image/jpeg,image/png,*/*', ...headers });
        if (!response) return null;

        const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
        if (contentType && !contentType.startsWith('image/')) return null;

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length === 0 || buffer.length > maxBytes) return null;

        const extension = path.extname(dest) ? '' : extensionFor(contentType, buffer);
        const file = `${dest}${extension}`;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, buffer);
        stats.downloads += 1;
        return { file, bytes: buffer.length, contentType, buffer };
    }

    return { fetchText, fetchJson, download, getStats: () => ({ ...stats }) };
}

/** Extension d'après le type MIME, à défaut d'après la signature du fichier. */
function extensionFor(contentType, buffer) {
    const byType = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
    if (byType[contentType]) return byType[contentType];
    const size = imageSize(buffer);
    return size ? `.${size.type === 'jpeg' ? 'jpg' : size.type}` : '.jpg';
}

/**
 * Dimensions d'une image JPEG, PNG, WebP ou GIF, lues dans l'en-tête.
 * Sert à écarter les vignettes trop petites sans dépendance native.
 * @returns {{ type: string, width: number, height: number } | null}
 */
function imageSize(buffer) {
    if (!buffer || buffer.length < 24) return null;

    // PNG : IHDR juste après la signature
    if (buffer.readUInt32BE(0) === 0x89504e47) {
        return { type: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }

    // GIF
    if (buffer.toString('ascii', 0, 3) === 'GIF') {
        return { type: 'gif', width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }

    // WebP : trois variantes de chunk
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
        const chunk = buffer.toString('ascii', 12, 16);
        if (chunk === 'VP8 ') {
            return { type: 'webp', width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
        }
        if (chunk === 'VP8L') {
            const bits = buffer.readUInt32LE(21);
            return { type: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
        }
        if (chunk === 'VP8X') {
            return { type: 'webp', width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
        }
        return null;
    }

    // JPEG : on saute de segment en segment jusqu'à un SOFn
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        let offset = 2;
        while (offset + 9 < buffer.length) {
            if (buffer[offset] !== 0xff) return null;
            const marker = buffer[offset + 1];
            const length = buffer.readUInt16BE(offset + 2);
            const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
            if (isSof) {
                return { type: 'jpeg', width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
            }
            offset += 2 + length;
        }
    }

    return null;
}

module.exports = { createClient, imageSize, sleep, DEFAULT_USER_AGENT };
