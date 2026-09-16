// server/routes/stats.js
const express = require('express');
const { getDatabase } = require('../services/database');
const { authenticateDiscord } = require('../middleware/auth');

const router = express.Router();
const db = getDatabase();

/**
 * GET /api/stats/me - Récupérer les stats de l'utilisateur connecté
 */
router.get('/me', authenticateDiscord, (req, res) => {
    try {
        const discordId = req.user.discordId;

        // Récupérer les statistiques globales
        const stats = db.getUserStats(discordId);

        // Récupérer les dernières parties
        const recentGames = db.getUserRecentGames(discordId, 10);

        res.json({
            success: true,
            stats: {
                totalGames: stats.total_games || 0,
                totalPoints: stats.total_points || 0,
                averageScore: Math.round(stats.avg_score || 0),
                wins: stats.wins || 0,
                totalRoundsWon: stats.total_rounds_won || 0
            },
            recentGames: recentGames.map(game => ({
                roomCode: game.room_code,
                gameMode: game.game_mode,
                finishedAt: game.finished_at,
                finalScore: game.final_score,
                finalRank: game.final_rank,
                date: new Date(game.finished_at).toLocaleDateString('fr-FR')
            }))
        });
    } catch (error) {
        console.error('❌ Erreur récupération stats:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération des statistiques'
        });
    }
});

/**
 * GET /api/stats/leaderboard - Récupérer le classement global
 */
router.get('/leaderboard', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        // Requête pour obtenir le top joueurs
        const stmt = db.db.prepare(`
            SELECT
                u.discord_id,
                u.username,
                u.avatar,
                COUNT(DISTINCT gp.game_id) as total_games,
                SUM(gp.final_score) as total_points,
                AVG(gp.final_score) as avg_score,
                SUM(CASE WHEN gp.final_rank = 1 THEN 1 ELSE 0 END) as wins
            FROM users u
            JOIN game_participations gp ON u.discord_id = gp.discord_id
            GROUP BY u.discord_id
            HAVING total_games >= 3
            ORDER BY total_points DESC
            LIMIT ?
        `);

        const leaderboard = stmt.all(limit).map((player, index) => ({
            rank: index + 1,
            username: player.username,
            avatar: player.avatar ?
                `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.avatar}.png?size=64` :
                null,
            totalGames: player.total_games,
            totalPoints: player.total_points,
            averageScore: Math.round(player.avg_score),
            wins: player.wins
        }));

        res.json({
            success: true,
            leaderboard,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erreur récupération leaderboard:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération du classement'
        });
    }
});

/**
 * GET /api/stats/me/:gameType - Récupérer les stats par type de jeu
 */
router.get('/me/:gameType', authenticateDiscord, (req, res) => {
    try {
        const discordId = req.user.discordId;
        const gameType = req.params.gameType; // 'blindtest' ou 'buzzer'

        console.log('📊 Requête stats pour:', { discordId: discordId.substring(0, 8) + '...', gameType });

        // Récupérer les statistiques par mode
        const stats = db.getUserStatsByGameMode(discordId, gameType);

        console.log('📊 Stats récupérées:', { gameType, totalGames: stats.total_games, wins: stats.wins });

        // Récupérer TOUTES les dernières parties (20 max)
        const allGames = db.getUserRecentGames(discordId, 20);
        console.log('📊 Toutes les parties:', allGames.map(g => ({ mode: g.gameMode, score: g.finalScore })));

        // Filtrer les parties selon le type de jeu
        const recentGames = allGames.filter(game => {
            if (!game.gameMode) return false;

            if (gameType === 'buzzer') {
                // Buzzer Battle : modes qui commencent par 'buzzer_'
                return game.gameMode.startsWith('buzzer_');
            } else {
                // Blind Test : modes 'normal' et 'quick'
                return game.gameMode === 'normal' || game.gameMode === 'quick';
            }
        });

        console.log('📊 Parties filtrées:', recentGames.map(g => ({ mode: g.gameMode, score: g.finalScore })));

        res.json({
            success: true,
            gameType,
            // Visibilité du profil public, pilotée depuis la page Profil
            publicProfile: db.isProfilePublic(discordId),
            stats: {
                totalGames: stats.total_games || 0,
                totalPoints: stats.total_points || 0,
                averageScore: Math.round(stats.avg_score || 0),
                wins: stats.wins || 0,
                totalRoundsWon: stats.total_rounds_won || 0
            },
            recentGames: recentGames.map(game => ({
                roomCode: game.roomCode,
                gameMode: game.gameMode,
                finishedAt: game.playedAt,
                finalScore: game.finalScore,
                finalRank: game.finalRank,
                date: new Date(game.playedAt).toLocaleDateString('fr-FR'),
                participants: game.participants
            })),
            // ✅ NOUVEAU : Ajouter TOUTES les parties pour l'affichage principal
            allRecentGames: allGames.map(game => ({
                roomCode: game.roomCode,
                gameMode: game.gameMode,
                finishedAt: game.playedAt,
                finalScore: game.finalScore,
                finalRank: game.finalRank,
                date: new Date(game.playedAt).toLocaleDateString('fr-FR'),
                participants: game.participants
            }))
        });
    } catch (error) {
        console.error('❌ Erreur récupération stats par type:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération des statistiques'
        });
    }
});

/**
 * GET /api/stats/general - Statistiques générales du blind test
 */
router.get('/general', (req, res) => {
    try {
        // Statistiques générales avec comptage correct des tentatives par niveau
        const generalStatsQuery = db.db.prepare(`
            WITH round_details AS (
                SELECT
                    rp.game_id,
                    rp.round_number,
                    rp.discord_id,
                    rp.level_found,
                    rp.wrong_attempts,
                    -- Calculer le nombre total de tentatives pour ce joueur sur ce round
                    -- Si trouvé au niveau 1: 1 tentative (1 juste)
                    -- Si trouvé au niveau 2: 2 tentatives (1 fausse + 1 juste)
                    -- Si trouvé au niveau 3: 3 tentatives (2 fausses + 1 juste)
                    -- Si pas trouvé (level 0): 3 tentatives (3 fausses)
                    CASE
                        WHEN rp.level_found = 0 THEN 3
                        ELSE rp.level_found
                    END as total_attempts_for_round,
                    CASE
                        WHEN rp.level_found > 0 THEN 1
                        ELSE 0
                    END as correct_count,
                    CASE
                        WHEN rp.level_found = 0 THEN 3
                        ELSE (rp.level_found - 1)
                    END as incorrect_count
                FROM round_performances rp
                JOIN games g ON rp.game_id = g.id
                WHERE g.game_mode IN ('normal', 'quick')
                  AND g.finished_at IS NOT NULL
                  AND rp.round_number <= g.total_rounds
            )
            SELECT
                COUNT(DISTINCT discord_id) as unique_players,
                COUNT(DISTINCT game_id || '-' || round_number) as total_rounds_played,
                SUM(total_attempts_for_round) as total_attempts,
                SUM(correct_count) as correct_answers,
                SUM(incorrect_count) as incorrect_answers
            FROM round_details
        `);

        const generalStats = generalStatsQuery.get();
        const totalRoundsPlayed = generalStats.total_rounds_played || 0;
        const totalAttempts = generalStats.total_attempts || 0;
        const correctAnswers = generalStats.correct_answers || 0;
        const incorrectAnswers = generalStats.incorrect_answers || 0;

        const globalSuccessRate = totalAttempts > 0 ?
            Math.round((correctAnswers / totalAttempts) * 100 * 100) / 100 : 0;

        res.json({
            success: true,
            stats: {
                uniquePlayers: generalStats.unique_players || 0,
                totalAnswers: totalAttempts,
                correctAnswers: correctAnswers,
                incorrectAnswers: incorrectAnswers,
                totalRoundsPlayed: totalRoundsPlayed,
                globalSuccessRate: globalSuccessRate
            }
        });
    } catch (error) {
        console.error('❌ Erreur récupération stats générales:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération des statistiques générales'
        });
    }
});

/**
 * GET /api/stats/artists - Statistiques par artiste pour le blind test
 */
router.get('/artists', (req, res) => {
    try {
        const type = req.query.type || 'all';
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        // Calculer les stats par artiste en comptant les rounds UNIQUES
        const artistStatsQuery = db.db.prepare(`
            WITH round_stats AS (
                SELECT
                    rp.artist_name,
                    rp.game_id,
                    rp.round_number,
                    MAX(CASE WHEN rp.level_found > 0 THEN 1 ELSE 0 END) as was_found,
                    MAX(CASE
                        WHEN rp.level_found = 1 THEN 3
                        WHEN rp.level_found = 2 THEN 2
                        WHEN rp.level_found = 3 THEN 1
                        ELSE 0
                    END) as best_score
                FROM round_performances rp
                JOIN games g ON rp.game_id = g.id
                WHERE g.game_mode IN ('normal', 'quick')
                  AND rp.round_number <= g.total_rounds
                GROUP BY rp.artist_name, rp.game_id, rp.round_number
            )
            SELECT
                artist_name,
                COUNT(*) as total_appearances,
                SUM(was_found) as times_found,
                ROUND((SUM(was_found) * 100.0 / COUNT(*)), 2) as success_rate,
                ROUND((SUM(best_score) * 100.0 / (COUNT(*) * 3)), 2) as difficulty_score,
                SUM(best_score) as total_score
            FROM round_stats
            GROUP BY artist_name
            HAVING total_appearances >= 1
            ORDER BY ${type === 'easiest' ? 'difficulty_score DESC' :
                type === 'hardest' ? 'difficulty_score ASC' : 'difficulty_score DESC'}
            ${type !== 'all' ? `LIMIT ${limit}` : ''}
        `);

        const artists = artistStatsQuery.all().map(artist => ({
            name: artist.artist_name,
            // Utiliser le difficulty_score comme taux de réussite principal
            // (reflète à quel niveau l'artiste a été trouvé)
            successRate: artist.difficulty_score,
            difficultyScore: artist.difficulty_score,
            rawSuccessRate: artist.success_rate,  // Taux brut (trouvé ou pas)
            totalAppearances: artist.total_appearances,
            timesFound: artist.times_found,
            rounds: artist.total_appearances
        }));

        res.json({
            success: true,
            artists: artists
        });
    } catch (error) {
        console.error('❌ Erreur récupération stats artistes:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération des statistiques artistes'
        });
    }
});

/**
 * GET /api/stats/rounds - Statistiques par round pour le blind test
 */
router.get('/rounds', (req, res) => {
    try {
        // Calculer les stats par niveau en comptant les rounds UNIQUES
        const levelStatsQuery = db.db.prepare(`
            WITH round_stats AS (
                SELECT
                    rp.game_id,
                    rp.round_number,
                    MAX(rp.level_found) as best_level_found
                FROM round_performances rp
                JOIN games g ON rp.game_id = g.id
                WHERE g.game_mode IN ('normal', 'quick')
                  AND rp.round_number <= g.total_rounds
                GROUP BY rp.game_id, rp.round_number
            )
            SELECT
                1 as level,
                SUM(CASE WHEN best_level_found = 1 THEN 1 ELSE 0 END) as times_found_at_level,
                COUNT(*) as total_rounds,
                ROUND((SUM(CASE WHEN best_level_found = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) as success_rate
            FROM round_stats

            UNION ALL

            SELECT
                2 as level,
                SUM(CASE WHEN best_level_found = 2 THEN 1 ELSE 0 END) as times_found_at_level,
                COUNT(*) as total_rounds,
                ROUND((SUM(CASE WHEN best_level_found = 2 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) as success_rate
            FROM round_stats

            UNION ALL

            SELECT
                3 as level,
                SUM(CASE WHEN best_level_found = 3 THEN 1 ELSE 0 END) as times_found_at_level,
                COUNT(*) as total_rounds,
                ROUND((SUM(CASE WHEN best_level_found = 3 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) as success_rate
            FROM round_stats

            ORDER BY level ASC
        `);

        const rounds = levelStatsQuery.all();

        res.json({
            success: true,
            rounds: rounds
        });
    } catch (error) {
        console.error('❌ Erreur récupération stats rounds:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération des statistiques par round'
        });
    }
});

/**
 * GET /api/stats/leaderboard/blindtest - Leaderboard spécifique au blind test
 */
router.get('/leaderboard/blindtest', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        const blindTestLeaderboardQuery = db.db.prepare(`
            SELECT
                u.discord_id,
                u.username,
                u.avatar,
                COUNT(DISTINCT gp.game_id) as total_games,
                SUM(gp.final_score) as total_points,
                AVG(gp.final_score) as avg_score,
                SUM(CASE WHEN gp.final_rank = 1 THEN 1 ELSE 0 END) as wins,
                SUM(gp.rounds_won) as total_rounds_won
            FROM users u
            JOIN game_participations gp ON u.discord_id = gp.discord_id
            JOIN games g ON gp.game_id = g.id
            WHERE g.game_mode IN ('normal', 'quick')
              AND g.finished_at IS NOT NULL
            GROUP BY u.discord_id
            HAVING total_games >= 1
            ORDER BY total_points DESC
            LIMIT ?
        `);

        const leaderboard = blindTestLeaderboardQuery.all(limit).map((player, index) => ({
            rank: index + 1,
            username: player.username,
            avatar: player.avatar ? `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.avatar}.png` : null,
            totalGames: player.total_games,
            totalPoints: player.total_points,
            averageScore: Math.round(player.avg_score),
            wins: player.wins,
            totalRoundsWon: player.total_rounds_won
        }));

        res.json({
            success: true,
            leaderboard: leaderboard
        });
    } catch (error) {
        console.error('❌ Erreur récupération leaderboard blind test:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération du leaderboard blind test'
        });
    }
});

/**
 * GET /api/stats/leaderboard/categories - Leaderboard avec catégories (tous artistes vs sélection)
 */
router.get('/leaderboard/categories', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const gameMode = req.query.gameMode || 'all'; // 'all', 'blindtest', 'buzzer'
        const category = req.query.category || 'all'; // 'all', 'full_roster', 'selection'

        // Construire la condition de mode de jeu
        let gameModeCondition = '';
        if (gameMode === 'blindtest') {
            gameModeCondition = "AND g.game_mode IN ('normal', 'quick')";
        } else if (gameMode === 'buzzer') {
            gameModeCondition = "AND g.game_mode LIKE 'buzzer_%'";
        }

        // Construire la condition de catégorie
        let categoryCondition = '';
        if (category === 'full_roster') {
            // Parties où tous les artistes disponibles ont été sélectionnés
            // On considère qu'une partie "full roster" a >= 65 artistes (à ajuster selon vos données)
            categoryCondition = "AND g.total_rounds >= 65";
        } else if (category === 'selection') {
            // Parties avec sélection d'artistes (< 65 artistes)
            categoryCondition = "AND g.total_rounds < 65";
        }

        const leaderboardQuery = db.db.prepare(`
            SELECT
                u.discord_id,
                u.username,
                u.avatar,
                COUNT(DISTINCT gp.game_id) as total_games,
                SUM(gp.final_score) as total_points,
                AVG(gp.final_score) as avg_score,
                SUM(CASE WHEN gp.final_rank = 1 THEN 1 ELSE 0 END) as wins,
                SUM(gp.rounds_won) as total_rounds_won,
                -- Calculer le pourcentage de victoires
                ROUND(
                    (SUM(CASE WHEN gp.final_rank = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT gp.game_id)),
                    1
                ) as win_rate
            FROM users u
            JOIN game_participations gp ON u.discord_id = gp.discord_id
            JOIN games g ON gp.game_id = g.id
            WHERE g.finished_at IS NOT NULL
            ${gameModeCondition}
            ${categoryCondition}
            GROUP BY u.discord_id
            HAVING total_games >= 1
            ORDER BY wins DESC, total_points DESC
            LIMIT ?
        `);

        const leaderboard = leaderboardQuery.all(limit).map((player, index) => ({
            rank: index + 1,
            username: player.username,
            avatar: player.avatar ? `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.avatar}.png` : null,
            totalGames: player.total_games,
            totalPoints: player.total_points,
            averageScore: Math.round(player.avg_score),
            wins: player.wins,
            winRate: player.win_rate,
            totalRoundsWon: player.total_rounds_won
        }));

        res.json({
            success: true,
            leaderboard: leaderboard,
            category: category,
            gameMode: gameMode
        });
    } catch (error) {
        console.error('❌ Erreur récupération leaderboard par catégories:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération du leaderboard par catégories'
        });
    }
});

/**
 * GET /api/stats/categories/info - Informations sur les catégories disponibles
 */
router.get('/categories/info', (req, res) => {
    try {
        const gameMode = req.query.gameMode || 'all';

        // Construire la condition de mode de jeu
        let gameModeCondition = '';
        if (gameMode === 'blindtest') {
            gameModeCondition = "AND g.game_mode IN ('normal', 'quick')";
        } else if (gameMode === 'buzzer') {
            gameModeCondition = "AND g.game_mode LIKE 'buzzer_%'";
        }

        const categoriesInfoQuery = db.db.prepare(`
            SELECT
                COUNT(CASE WHEN g.total_rounds >= 65 THEN 1 END) as full_roster_games,
                COUNT(CASE WHEN g.total_rounds < 65 THEN 1 END) as selection_games,
                COUNT(DISTINCT CASE WHEN g.total_rounds >= 65 THEN gp.discord_id END) as full_roster_players,
                COUNT(DISTINCT CASE WHEN g.total_rounds < 65 THEN gp.discord_id END) as selection_players,
                MAX(g.total_rounds) as max_artists,
                MIN(g.total_rounds) as min_artists
            FROM games g
            JOIN game_participations gp ON g.id = gp.game_id
            WHERE g.finished_at IS NOT NULL
            ${gameModeCondition}
        `);

        const info = categoriesInfoQuery.get();

        res.json({
            success: true,
            categories: {
                full_roster: {
                    games: info.full_roster_games || 0,
                    players: info.full_roster_players || 0,
                    description: "Parties avec tous les artistes disponibles"
                },
                selection: {
                    games: info.selection_games || 0,
                    players: info.selection_players || 0,
                    description: "Parties avec sélection d'artistes"
                }
            },
            artistRange: {
                min: info.min_artists || 0,
                max: info.max_artists || 0
            }
        });
    } catch (error) {
        console.error('❌ Erreur récupération infos catégories:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération des infos catégories'
        });
    }
});

/**
 * GET /api/stats/buzzer/general - Statistiques générales du Buzzer Battle
 */
router.get('/buzzer/general', (req, res) => {
    try {
        const buzzerStats = db.getBuzzerGeneralStats();

        // ✅ Debug pour vérifier les données
        console.log('📊 Statistiques Buzzer récupérées:', buzzerStats);

        res.json({
            success: true,
            stats: {
                uniquePlayers: buzzerStats?.unique_players || 0,
                totalRounds: buzzerStats?.total_rounds || 0,
                totalAnswers: buzzerStats?.total_attempts || 0,
                correctAnswers: buzzerStats?.correct_answers || 0,
                incorrectAnswers: buzzerStats?.incorrect_answers || 0,
                averageReactionTime: Math.round(buzzerStats?.avg_reaction_time || 0)
            }
        });
    } catch (error) {
        console.error('❌ Erreur récupération stats buzzer générales:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération des statistiques buzzer'
        });
    }
});
/**
 * GET /api/stats/buzzer/beatboxers - Statistiques par beatboxer pour le Buzzer Battle
 */
router.get('/buzzer/beatboxers', (req, res) => {
    try {
        const type = req.query.type || 'all'; // 'easiest', 'hardest', 'all'
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const filter = req.query.filter || null;
        const filterValue = req.query.filterValue || null;

        const beatboxers = db.getBuzzerBeatboxerStats(type, type !== 'all' ? limit : null, filter, filterValue);

        res.json({
            success: true,
            beatboxers: beatboxers.map(beatboxer => ({
                name: beatboxer.beatboxer_name,
                successRate: beatboxer.success_rate,
                totalRounds: beatboxer.total_rounds,
                totalAttempts: beatboxer.total_attempts,
                correctAttempts: beatboxer.correct_attempts,
                attempts: beatboxer.total_attempts  // Pour compatibilité affichage
            }))
        });
    } catch (error) {
        console.error('❌ Erreur récupération stats beatboxers buzzer:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération des statistiques beatboxers buzzer'
        });
    }
});

/**
 * GET /api/stats/buzzer/leaderboard - Leaderboard spécifique au Buzzer Battle avec filtres
 */
router.get('/buzzer/leaderboard', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const filter = req.query.filter || 'all'; // 'all', 'country', 'event'
        const filterValue = req.query.filterValue || null; // nom du pays ou événement

        // ✅ Filtrage corrigé avec game_filter
        let filterCondition = '';

        if (filter === 'country' && filterValue) {
            console.log('🌍 Filtrage par pays:', filterValue);
            filterCondition = `AND g.game_mode = 'buzzer_country' AND g.game_filter = '${filterValue}'`;
        } else if (filter === 'event' && filterValue) {
            console.log('🏆 Filtrage par événement:', filterValue);
            filterCondition = `AND g.game_mode = 'buzzer_event' AND g.game_filter = '${filterValue}'`;
        } else if (filter === 'country') {
            filterCondition = `AND g.game_mode = 'buzzer_country'`;
        } else if (filter === 'event') {
            filterCondition = `AND g.game_mode = 'buzzer_event'`;
        }

        console.log('🔍 Condition de filtre finale:', filterCondition);

        const buzzerLeaderboardQuery = db.db.prepare(`
            SELECT
                u.discord_id,
                u.username,
                u.avatar,
                COUNT(DISTINCT gp.game_id) as total_games,
                SUM(gp.final_score) as total_points,
                AVG(gp.final_score) as avg_score,
                SUM(CASE WHEN gp.final_rank = 1 THEN 1 ELSE 0 END) as wins,
                SUM(gp.rounds_won) as total_rounds_won,
                ROUND(
                    (SUM(CASE WHEN gp.final_rank = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT gp.game_id)),
                    1
                ) as win_rate
            FROM users u
            JOIN game_participations gp ON u.discord_id = gp.discord_id
            JOIN games g ON gp.game_id = g.id
            WHERE g.game_mode LIKE 'buzzer_%'
            AND g.finished_at IS NOT NULL
            ${filterCondition}
            GROUP BY u.discord_id
            HAVING total_games >= 1
            ORDER BY wins DESC, total_points DESC
            LIMIT ?
        `);

        const leaderboard = buzzerLeaderboardQuery.all(limit).map((player, index) => ({
            rank: index + 1,
            username: player.username,
            avatar: player.avatar ? `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.avatar}.png` : null,
            totalGames: player.total_games,
            totalPoints: player.total_points,
            averageScore: Math.round(player.avg_score),
            wins: player.wins,
            winRate: player.win_rate,
            totalRoundsWon: player.total_rounds_won,
        }));

        res.json({
            success: true,
            leaderboard: leaderboard,
            filter: filter,
            filterValue: filterValue
        });
    } catch (error) {
        console.error('❌ Erreur récupération leaderboard buzzer:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération du leaderboard buzzer'
        });
    }
});

/**
 * GET /api/stats/buzzer/filters - Récupérer les filtres disponibles pour le Buzzer Battle
 */
router.get('/buzzer/filters', (req, res) => {
    try {
        // ✅ Utiliser le buzzer-beatboxerManager pour obtenir les vrais filtres
        const buzzerBeatboxerManager = require('../services/buzzer-beatboxerManager');

        const countries = buzzerBeatboxerManager.getAllCountries();
        const events = buzzerBeatboxerManager.getAllEvents();

        console.log(`🌍 ${countries.length} pays disponibles pour Buzzer Battle`);
        console.log(`🏆 ${events.length} événements disponibles pour Buzzer Battle`);

        res.json({
            success: true,
            countries: countries,
            events: events
        });
    } catch (error) {
        console.error('❌ Erreur récupération filtres buzzer:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération des filtres buzzer'
        });
    }
});

module.exports = router;
