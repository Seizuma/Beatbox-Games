// server/middleware/auth.js
const { discordAuth } = require('../services/discordAuth');

/**
 * Middleware pour vérifier l'authentification Discord via JWT
 */
function authenticateDiscord(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Token manquant'
        });
    }

    const token = authHeader.replace('Bearer ', '');

    try {
        // Vérifier et décoder le JWT
        const decoded = discordAuth.verifyJWT(token);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('❌ Token invalide:', error.message);
        return res.status(401).json({
            success: false,
            error: 'Token invalide ou expiré'
        });
    }
}

module.exports = { authenticateDiscord };