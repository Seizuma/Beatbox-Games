// server/routes/ranking.js
const express = require('express');
const { authenticateDiscord } = require('../middleware/auth');
const rankingService = require('../services/rankingService');

const router = express.Router();

/**
 * GET /api/ranking?game=all|blindtest|buzzer&limit=15
 * Classement compétitif (parties à plusieurs comptes Discord uniquement)
 */
router.get('/', (req, res) => {
    try {
        const game = rankingService.normalizeGame(req.query.game);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
        const { leaderboard, totalRanked } = rankingService.getLeaderboard(game, limit);

        res.json({
            success: true,
            game,
            config: rankingService.getPublicConfig(),
            totalRanked,
            leaderboard,
        });
    } catch (error) {
        console.error('❌ Erreur récupération classement:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur lors de la récupération du classement' });
    }
});

/**
 * GET /api/ranking/me?game=all|blindtest|buzzer
 * Cote et position du joueur connecté
 */
router.get('/me', authenticateDiscord, (req, res) => {
    try {
        const game = rankingService.normalizeGame(req.query.game);

        res.json({
            success: true,
            game,
            config: rankingService.getPublicConfig(),
            player: rankingService.getPlayerRanking(game, req.user.discordId),
        });
    } catch (error) {
        console.error('❌ Erreur récupération classement joueur:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur lors de la récupération du classement' });
    }
});

module.exports = router;