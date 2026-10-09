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

// Mêmes familles de parties que le classement compétitif
const WEEK_CONDITIONS = {
    all: '1 = 1',
    blindtest: "g.game_mode IN ('normal', 'quick')",
    buzzer: "g.game_mode LIKE 'buzzer_%'",
};

/**
 * GET /api/ranking/week?game=all|blindtest|buzzer&limit=10
 * Les sept derniers jours : victoires, puis points marqués. Contrairement à la
 * cote, ce tableau repart de zéro chaque semaine : un nouveau venu peut y monter.
 */
router.get('/week', (req, res) => {
    try {
        const game = rankingService.normalizeGame(req.query.game);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
        const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const { getDatabase } = require('../services/database');

        const rows = getDatabase().db.prepare(`
            SELECT gp.discord_id AS discordId, u.username AS username, u.avatar AS avatar,
                   COUNT(*) AS games,
                   SUM(CASE WHEN gp.final_rank = 1 THEN 1 ELSE 0 END) AS wins,
                   SUM(gp.final_score) AS points
            FROM game_participations gp
            JOIN games g ON g.id = gp.game_id
            JOIN users u ON u.discord_id = gp.discord_id
            WHERE g.finished_at IS NOT NULL AND g.finished_at >= ? AND ${WEEK_CONDITIONS[game]}
            GROUP BY gp.discord_id
            ORDER BY wins DESC, points DESC, games DESC
            LIMIT ?
        `).all(since, limit);

        res.json({
            success: true,
            game,
            leaderboard: rows.map((row, index) => ({
                rank: index + 1,
                username: row.username || 'Joueur',
                avatar: row.avatar ? `https://cdn.discordapp.com/avatars/${row.discordId}/${row.avatar}.png?size=64` : null,
                games: row.games,
                wins: row.wins || 0,
                points: row.points || 0,
            })),
        });
    } catch (error) {
        console.error('❌ Erreur classement de la semaine:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
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