/**
 * Accès restreint pour la version de test (dev.beatboxgames.com).
 *
 * Activé uniquement par ACCESS_GATE=true (docker-compose.dev.yml). Sans cette
 * variable, rien ne change : la production reste ouverte à tous.
 *
 * Quand il est actif, seuls les comptes Discord de la liste d'accès (gérée
 * depuis /admin) et les administrateurs (ADMIN_DISCORD_IDS) passent :
 *   - API, fichiers du serveur (extraits audio, images) : contrôlés ici, requête par requête ;
 *   - Socket.IO : contrôlé à la connexion ;
 *   - application React : affiche l'écran de connexion (client/src/components/AccessGate.jsx).
 *
 * La preuve d'accès est le jeton Discord habituel (JWT), lu dans l'en-tête
 * Authorization ou, pour les requêtes sans en-tête (<audio>, <img>, Socket.IO),
 * dans un cookie HttpOnly posé par POST /api/access/session.
 */

const jwt = require('jsonwebtoken');
const { getDatabase } = require('./database');
const { discordAuth } = require('./discordAuth');
const { isAdmin } = require('../middleware/adminAuth');
const { CONFIG } = require('../constants');

const COOKIE_NAME = 'bbg_access';
const DISCORD_ID = /^\d{17,20}$/;

// Toujours ouverts : santé du serveur, connexion Discord, et les routes de l'écran de connexion
const OPEN_PATHS = [/^\/health$/, /^\/auth\//, /^\/api\/access\/(status|session|logout)$/];

let allowed = null;
let io = null;

const enabled = () => process.env.ACCESS_GATE === 'true';

function reload() {
    allowed = new Set(getDatabase().listAccessIds());
    return allowed;
}

function isAllowed(discordId) {
    if (!discordId) return false;
    if (isAdmin(discordId)) return true;
    return (allowed || reload()).has(String(discordId));
}

function readCookie(header, name) {
    const match = String(header || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function userFromToken(token) {
    if (!token) return null;
    try {
        return discordAuth.verifyJWT(token);
    } catch (error) {
        return null;
    }
}

function tokenFromRequest(req) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) return header.slice(7);
    return readCookie(req.headers.cookie, COOKIE_NAME);
}

// Le cookie porte un jeton d'accès court (identifiant Discord et nom), signé avec le même
// secret, et non le jeton de connexion complet : celui-ci contient la liste des serveurs
// Discord du joueur et peut dépasser 5 Ko. Un cookie de cette taille est refusé par les
// navigateurs (4 Ko maximum) et fait échouer Nginx Proxy Manager (« upstream sent too big
// header », erreur 502).
function setSessionCookie(res, token, user) {
    const maxAge = Math.max(0, (user.exp || 0) - Math.floor(Date.now() / 1000));
    const access = jwt.sign({ discordId: user.discordId, username: user.username, scope: 'access' }, discordAuth.jwtSecret, { expiresIn: maxAge });
    const secure = String(CONFIG.BASE_URL || '').startsWith('https://') ? '; Secure' : '';
    res.append('Set-Cookie', `${COOKIE_NAME}=${access}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

function clearSessionCookie(res) {
    const secure = String(CONFIG.BASE_URL || '').startsWith('https://') ? '; Secure' : '';
    res.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

/** Middleware Express : à monter avant les routes et les fichiers statiques. */
function httpGate(req, res, next) {
    if (!enabled() || req.method === 'OPTIONS') return next();
    if (OPEN_PATHS.some((pattern) => pattern.test(req.path))) return next();

    const user = userFromToken(tokenFromRequest(req));
    if (user && isAllowed(user.discordId)) return next();

    // Hors API (lien d'invitation, sitemap…) : retour à l'application, qui affiche
    // l'écran de connexion puis renvoie vers l'adresse demandée
    if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/audio/')) {
        return res.redirect(302, `/?next=${encodeURIComponent(req.originalUrl)}`);
    }
    return res.status(user ? 403 : 401).json({
        success: false,
        error: user ? 'access_denied' : 'access_required',
    });
}

/** Middleware Socket.IO : refuse la connexion des comptes non autorisés. */
function socketGate(socket, next) {
    if (!enabled()) return next();
    const auth = socket.handshake.auth || {};
    const token = auth.token || auth.discord_token || readCookie(socket.handshake.headers.cookie, COOKIE_NAME);
    const user = userFromToken(token);
    if (user && isAllowed(user.discordId)) return next();
    const error = new Error(user ? 'access_denied' : 'access_required');
    error.data = { code: error.message };
    return next(error);
}

function setIo(server) {
    io = server;
}

/** Coupe aussitôt les connexions temps réel d'un compte retiré de la liste. */
function disconnect(discordId) {
    if (!io || !discordId || isAllowed(discordId)) return 0;
    let count = 0;
    io.of('/').sockets.forEach((socket) => {
        if (socket.discordUser && String(socket.discordUser.discordId) === String(discordId)) {
            socket.disconnect(true);
            count += 1;
        }
    });
    return count;
}

module.exports = {
    COOKIE_NAME,
    DISCORD_ID,
    enabled,
    reload,
    isAllowed,
    userFromToken,
    setSessionCookie,
    clearSessionCookie,
    httpGate,
    socketGate,
    setIo,
    disconnect,
};
