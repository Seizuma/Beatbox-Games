// server/scripts/beatboxdle/http.js
//
// Client HTTP du scraper : une requête à la fois, espacées, avec cache disque.
// Le cache est ce qui rend le pipeline utilisable : on peut relancer le parsing
// vingt fois pendant la mise au point sans renvoyer une seule requête au site.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let lastRequestAt = 0;
const stats = { network: 0, cache: 0, errors: 0 };

const cachePath = (url) => {
    const hash = crypto.createHash('sha1').update(url).digest('hex');
    return path.join(config.CACHE_DIR, `${hash}.html`);
};

/**
 * Récupère une page. Renvoie le HTML, ou null si la page n'existe pas (404).
 * @param {string} url
 * @param {{ force?: boolean }} options force: ignorer le cache
 */
async function fetchPage(url, options = {}) {
    fs.mkdirSync(config.CACHE_DIR, { recursive: true });
    const file = cachePath(url);

    if (!options.force && fs.existsSync(file)) {
        stats.cache += 1;
        const cached = fs.readFileSync(file, 'utf8');
        return cached === '__404__' ? null : cached;
    }

    for (let attempt = 1; attempt <= config.MAX_RETRIES; attempt += 1) {
        const wait = config.REQUEST_DELAY_MS - (Date.now() - lastRequestAt);
        if (wait > 0) await sleep(wait);
        lastRequestAt = Date.now();

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': config.USER_AGENT,
                    Accept: 'text/html,application/xhtml+xml',
                    'Accept-Language': 'en',
                },
                signal: AbortSignal.timeout(config.TIMEOUT_MS),
            });

            if (response.status === 404) {
                fs.writeFileSync(file, '__404__');
                return null;
            }

            if (response.status === 429 || response.status >= 500) {
                const backoff = config.REQUEST_DELAY_MS * 4 * attempt;
                console.warn(`   ⏳ ${response.status} sur ${url} — nouvelle tentative dans ${backoff} ms`);
                await sleep(backoff);
                continue;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            fs.writeFileSync(file, html);
            stats.network += 1;
            return html;
        } catch (error) {
            if (attempt === config.MAX_RETRIES) {
                stats.errors += 1;
                console.error(`   ❌ Échec définitif sur ${url}: ${error.message}`);
                return null;
            }
            await sleep(config.REQUEST_DELAY_MS * 4 * attempt);
        }
    }

    return null;
}

const getStats = () => ({ ...stats });

module.exports = { fetchPage, getStats, sleep };