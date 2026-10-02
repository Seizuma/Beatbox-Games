// server/scripts/beatboxdle/http.js
//
// Client HTTP du pipeline Beatboxdle : une requête à la fois, espacées, avec
// cache disque. Le cache est ce qui rend le pipeline utilisable : on peut
// relancer le parsing vingt fois pendant la mise au point sans renvoyer une
// seule requête au site.
//
// La mécanique est partagée avec le pipeline photos (scripts/shared/http.js) ;
// ce module garde l'interface historique et l'emplacement du cache.

const config = require('./config');
const { createClient, sleep } = require('../shared/http');

const client = createClient({
    cacheDir: config.CACHE_DIR,
    // Les fichiers déjà en cache sur le serveur portent l'extension .html :
    // la garder évite de re-crawler tout beatbox.world.
    cacheExtension: '.html',
    delayMs: config.REQUEST_DELAY_MS,
    userAgent: config.USER_AGENT,
    retries: config.MAX_RETRIES,
    timeoutMs: config.TIMEOUT_MS,
});

/**
 * Récupère une page. Renvoie le HTML, ou null si la page n'existe pas (404).
 * @param {string} url
 * @param {{ force?: boolean }} options force: ignorer le cache
 */
const fetchPage = (url, options = {}) => client.fetchText(url, options);

module.exports = { fetchPage, fetchJson: client.fetchJson, download: client.download, getStats: client.getStats, sleep };
