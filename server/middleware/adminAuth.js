// server/middleware/adminAuth.js
const { authenticateDiscord } = require('./auth');

/**
 * Liste des administrateurs, par identifiant Discord.
 * Définie dans /etc/beatbox-games/.env.<environnement> :
 *   ADMIN_DISCORD_IDS=123456789012345678,987654321098765432
 *
 * Le contrôle est fait à chaque requête côté serveur. Le client sait seulement
 * s'il doit afficher le lien : il ne décide de rien.
 */
function getAdminIds() {
    return String(process.env.ADMIN_DISCORD_IDS || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
}

function isAdmin(discordId) {
    if (!discordId) return false;
    return getAdminIds().includes(String(discordId));
}

/** Exige une session Discord valide ET un identifiant présent dans la liste. */
function requireAdmin(req, res, next) {
    authenticateDiscord(req, res, () => {
        if (!isAdmin(req.user?.discordId)) {
            console.warn(`🚫 Accès admin refusé pour ${req.user?.username || 'inconnu'} (${req.user?.discordId})`);
            // 404 plutôt que 403 : l'existence même de l'espace d'administration
            // n'a pas à être confirmée à quelqu'un qui n'y a pas droit.
            return res.status(404).json({ success: false, error: 'not_found' });
        }
        next();
    });
}

module.exports = { requireAdmin, isAdmin, getAdminIds };
