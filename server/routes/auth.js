// routes/auth.js
const express = require('express');
const { discordAuth } = require('../services/discordAuth');
const { CONFIG } = require('../constants');

const router = express.Router();

/**
 * GET /auth/discord - Redirection vers Discord pour l'autorisation
 */
router.get('/discord', (req, res) => {
    try {
        const state = req.query.redirect || 'profile'; // Page de retour après auth
        const authUrl = discordAuth.getAuthUrl(state);

        console.log(`🔐 Redirection Discord pour l'utilisateur: ${authUrl}`);
        res.redirect(authUrl);
    } catch (error) {
        console.error('Erreur lors de la génération de l\'URL Discord:', error);
        res.redirect(`${CONFIG.CLIENT_URL}/?error=discord_error`);
    }
});

/**
 * GET /auth/discord/callback - Callback après autorisation Discord
 */
router.get('/discord/callback', async (req, res) => {
    console.log('=== DISCORD CALLBACK DEBUG ===');
    console.log('URL complète:', req.url);
    console.log('Query params:', req.query);
    console.log('Variables env présentes:', {
        clientId: !!process.env.DISCORD_CLIENT_ID,
        clientSecret: !!process.env.DISCORD_CLIENT_SECRET,
        jwtSecret: !!process.env.JWT_SECRET
    });
    console.log('Config BASE_URL:', CONFIG.BASE_URL);
    console.log('Redirect URI calculé:', discordAuth.redirectUri);

    const { code, state, error } = req.query;

    // Vérifier s'il y a une erreur d'autorisation
    if (error) {
        console.log(`❌ Autorisation Discord refusée: ${error}`);
        return res.redirect(`${CONFIG.CLIENT_URL}/?error=discord_cancelled`);
    }

    if (!code) {
        console.log('❌ Code d\'autorisation manquant');
        return res.redirect(`${CONFIG.CLIENT_URL}/?error=no_code`);
    }

    try {
        // 1. Échanger le code contre un token
        const tokenData = await discordAuth.exchangeCodeForToken(code);

        // 2. Récupérer les informations utilisateur
        const userInfo = await discordAuth.getUserInfo(tokenData.access_token);

        // 3. Récupérer les serveurs Discord (optionnel)
        const guilds = await discordAuth.getUserGuilds(tokenData.access_token);

        // 4. Mettre à jour le cache
        discordAuth.updateUserCache(userInfo.id, userInfo);

        // 5. Générer un JWT pour l'application
        const jwt = discordAuth.generateJWT(userInfo, guilds);

        console.log(`✅ Utilisateur Discord connecté: ${userInfo.username}#${userInfo.discriminator}`);

        // 6. Rediriger avec le token
        const redirectPage = state || 'profile';
        const redirectUrl = `${CONFIG.CLIENT_URL}/#/${redirectPage}?token=${jwt}&success=true`;

        res.status(200).send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="utf-8">
            <title>Authentification Discord - Redirection</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    text-align: center; 
                    padding: 50px; 
                    background: #2c2f36; 
                    color: white; 
                }
                .spinner { 
                    border: 4px solid #f3f3f3; 
                    border-top: 4px solid #5865f2; 
                    border-radius: 50%; 
                    width: 40px; 
                    height: 40px; 
                    animation: spin 1s linear infinite; 
                    margin: 20px auto; 
                }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <h2>🎮 Authentification Discord réussie !</h2>
            <div class="spinner"></div>
            <p>Redirection vers votre profil...</p>
            <script>
                console.log('Redirection vers:', '${redirectUrl}');
                setTimeout(() => {
                    window.location.href = '${redirectUrl}';
                }, 1500);
            </script>
        </body>
        </html>
        `);

    } catch (error) {
        console.error('Erreur lors du callback Discord:', error.message);
        res.redirect(`${CONFIG.CLIENT_URL}/?error=auth_failed`);
    }
});

/**
 * GET /auth/me - Récupérer les informations de l'utilisateur authentifié
 */
router.get('/me', discordAuth.authenticateMiddleware(), (req, res) => {
    try {
        const user = discordAuth.getUserFromCache(req.user.discordId);
        const stats = discordAuth.getUserStats(req.user.discordId);

        res.json({
            user: {
                discordId: req.user.discordId,
                username: req.user.username,
                discriminator: req.user.discriminator,
                avatar: req.user.avatar,
                guilds: req.user.guilds
            },
            stats: stats || {
                totalGames: 0,
                totalCorrect: 0,
                totalAnswers: 0,
                bestStreak: 0,
                favoriteArtists: {},
                lastPlayed: null
            }
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du profil:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /auth/update-stats - Mettre à jour les stats d'un utilisateur après une partie
 */
router.post('/update-stats', discordAuth.authenticateMiddleware(), (req, res) => {
    try {
        const { correct, total, streak, artistsPlayed } = req.body;

        if (typeof correct !== 'number' || typeof total !== 'number') {
            return res.status(400).json({ error: 'Données invalides' });
        }

        const updatedStats = discordAuth.updateUserStats(req.user.discordId, {
            correct,
            total,
            streak: streak || 0,
            artistsPlayed: artistsPlayed || []
        });

        res.json({
            message: 'Statistiques mises à jour',
            stats: updatedStats
        });

    } catch (error) {
        console.error('Erreur lors de la mise à jour des stats:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /auth/leaderboard - Récupérer le classement
 */
router.get('/leaderboard', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const leaderboard = discordAuth.getLeaderboard(limit);

        res.json({
            leaderboard,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du classement:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /auth/logout - Déconnexion (côté client principalement)
 */
router.post('/logout', discordAuth.authenticateMiddleware(), (req, res) => {
    // En JWT, la déconnexion se fait côté client en supprimant le token
    // On peut marquer l'utilisateur comme déconnecté dans le cache

    console.log(`🔓 Déconnexion de l'utilisateur: ${req.user.username}`);

    res.json({
        message: 'Déconnecté avec succès'
    });
});

/**
 * DELETE /auth/account - Supprimer le compte (RGPD)
 */
router.delete('/account', discordAuth.authenticateMiddleware(), (req, res) => {
    try {
        const discordId = req.user.discordId;

        // Supprimer les données du cache et des stats
        discordAuth.userCache.delete(discordId);
        discordAuth.userStats.delete(discordId);

        console.log(`🗑️ Compte supprimé: ${req.user.username} (${discordId})`);

        res.json({
            message: 'Compte supprimé avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la suppression du compte:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;