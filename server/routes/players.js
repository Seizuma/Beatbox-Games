/**
 * Profils publics des joueurs et recherche.
 *
 * Un profil n'est visible que si son propriétaire ne l'a pas masqué
 * (users.public_profile). La recherche ignore les profils masqués.
 */

const express = require('express');
const { getDatabase } = require('../services/database');
const { authenticateDiscord } = require('../middleware/auth');
const rankingService = require('../services/rankingService');

const router = express.Router();

const avatarUrl = (discordId, avatar, size = 128) =>
    (avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=${size}` : null);

/**
 * GET /api/players/search?q=sei
 * Autocomplétion de la barre de recherche.
 */
router.get('/search', (req, res) => {
    try {
        const query = String(req.query.q || '').trim();
        if (query.length < 2) {
            return res.json({ success: true, query, results: [] });
        }

        const db = getDatabase();
        const results = db.searchUsers(query, { limit: 8 }).map((user) => ({
            discordId: user.discordId,
            username: user.username,
            avatar: avatarUrl(user.discordId, user.avatar, 64),
            totalGames: user.totalGames,
        }));

        res.json({ success: true, query, results });
    } catch (error) {
        console.error('❌ Erreur recherche de joueurs:', error);
        res.status(500).json({ success: false, error: 'server_error' });
    }
});

/**
 * PATCH /api/players/me/visibility  { public: true|false }
 * Le joueur choisit d'apparaître ou non dans les recherches et les profils publics.
 */
router.patch('/me/visibility', authenticateDiscord, (req, res) => {
    try {
        const db = getDatabase();
        const isPublic = req.body?.public !== false;

        db.setProfileVisibility(req.user.discordId, isPublic);
        db.logEvent({
            type: 'profile',
            message: `Profil rendu ${isPublic ? 'public' : 'privé'}`,
            discordId: req.user.discordId,
        });

        res.json({ success: true, public: isPublic });
    } catch (error) {
        console.error('❌ Erreur visibilité du profil:', error);
        res.status(500).json({ success: false, error: 'server_error' });
    }
});

/**
 * GET /api/players/:discordId
 * Fiche publique : identité, cote, statistiques par jeu, dernières parties,
 * adversaires fréquents. Aucune donnée de compte (e-mail, jetons) n'y figure.
 */
router.get('/:discordId', (req, res) => {
    try {
        const db = getDatabase();
        const { discordId } = req.params;
        const user = db.getUserByDiscordId(discordId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'player_not_found' });
        }
        if (user.publicProfile !== 1) {
            return res.status(403).json({ success: false, error: 'profile_private' });
        }

        const blindtest = db.getUserStatsByGameMode(discordId, 'blindtest');
        const buzzer = db.getUserStatsByGameMode(discordId, 'buzzer');
        const buzzerRecord = db.getUserBuzzerRecord(discordId);

        res.json({
            success: true,
            player: {
                discordId: user.discordId,
                username: user.username,
                avatar: avatarUrl(user.discordId, user.avatar),
                memberSince: user.createdAt,
                lastSeen: user.lastSeen,
            },
            ranking: {
                all: rankingService.getPlayerRanking('all', discordId),
                blindtest: rankingService.getPlayerRanking('blindtest', discordId),
                buzzer: rankingService.getPlayerRanking('buzzer', discordId),
                config: rankingService.getPublicConfig(),
            },
            stats: {
                blindtest: {
                    totalGames: blindtest?.total_games || 0,
                    totalPoints: blindtest?.total_points || 0,
                    averageScore: Math.round(blindtest?.avg_score || 0),
                    wins: blindtest?.wins || 0,
                    totalRoundsWon: blindtest?.total_rounds_won || 0,
                },
                buzzer: {
                    totalGames: buzzer?.total_games || 0,
                    totalPoints: buzzer?.total_points || 0,
                    averageScore: Math.round(buzzer?.avg_score || 0),
                    wins: buzzer?.wins || 0,
                    totalRoundsWon: buzzer?.total_rounds_won || 0,
                    totalBuzzes: buzzerRecord?.totalBuzzes || 0,
                    correct: buzzerRecord?.correct || 0,
                    wrong: buzzerRecord?.wrong || 0,
                    averageReaction: Math.round(buzzerRecord?.averageReaction || 0),
                },
            },
            artists: db.getUserArtistRecord(discordId, { limit: 5 }),
            opponents: db.getFrequentOpponents(discordId, 5)
                .filter((opponent) => opponent.publicProfile === 1)
                .map(({ publicProfile, ...opponent }) => ({
                    ...opponent,
                    avatar: avatarUrl(opponent.discordId, opponent.avatar, 64),
                })),
            recentGames: db.getRecentGames({ limit: 10, discordId }),
        });
    } catch (error) {
        console.error('❌ Erreur profil public:', error);
        res.status(500).json({ success: false, error: 'server_error' });
    }
});

module.exports = router;
