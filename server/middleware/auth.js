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

/**
 * Variante facultative : un jeton valide renseigne req.user, sinon on continue
 * sans. Pour les pages publiques qui montrent en plus « ta place ».
 */
function optionalDiscord(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            req.user = discordAuth.verifyJWT(authHeader.replace('Bearer ', ''));
        } catch (error) {
            req.user = null;
        }
    }
    next();
}

module.exports = { authenticateDiscord, optionalDiscord };