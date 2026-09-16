const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../utils');

const logger = createLogger('DATABASE');

// Échappe une valeur insérée dans une chaîne SQL (les filtres Buzzer viennent de l'URL)
const sqlString = (value) => String(value ?? '').replace(/'/g, "''");

class DatabaseService {
    constructor() {
        // ✅ Chemin absolu depuis la racine de l'app (/app dans Docker)
        const dbPath = path.join(process.cwd(), 'data', 'beatbox_stats.db');

        console.log('📂 Tentative d\'ouverture de la base de données:', dbPath);
        console.log('📂 Working directory:', process.cwd());

        // ✅ Créer le dossier data s'il n'existe pas
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
            console.log('📂 Création du dossier data:', dataDir);
            fs.mkdirSync(dataDir, { recursive: true, mode: 0o755 });
        }

        // ✅ Vérifier que le dossier est accessible
        try {
            fs.accessSync(dataDir, fs.constants.W_OK);
            console.log('✅ Le dossier data est accessible en écriture');
        } catch (err) {
            console.error('❌ Le dossier data n\'est pas accessible:', err);
            throw err;
        }

        // Ouvrir la base de données
        this.db = new Database(dbPath, { verbose: logger.debug });
        this.initTables();
        logger.info('✅ Base de données initialisée:', dbPath);
    }

    initTables() {
        // Table des utilisateurs Discord
        this.db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            discord_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            avatar TEXT,
            created_at INTEGER NOT NULL,
            last_seen INTEGER NOT NULL
        )
    `);

        // Table des parties
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_code TEXT NOT NULL,
                game_mode TEXT NOT NULL,
                total_rounds INTEGER NOT NULL,
                started_at INTEGER NOT NULL,
                finished_at INTEGER,
                creator_discord_id TEXT,
                FOREIGN KEY (creator_discord_id) REFERENCES users(discord_id)
            )
        `);
        // ✅ Ajouter la colonne game_filter si elle n'existe pas
        try {
            this.db.exec(`ALTER TABLE games ADD COLUMN game_filter TEXT DEFAULT NULL`);
            console.log('✅ Colonne game_filter ajoutée à la table games');
        } catch (error) {
            // La colonne existe déjà ou autre erreur
            if (!error.message.includes('duplicate column name')) {
                console.log('ℹ️ Colonne game_filter déjà présente ou erreur:', error.message);
            }
        }
        // Table des participations aux parties - AVEC CONTRAINTE UNIQUE
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS game_participations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id INTEGER NOT NULL,
                discord_id TEXT NOT NULL,
                final_score INTEGER NOT NULL,
                final_rank INTEGER NOT NULL,
                rounds_won INTEGER DEFAULT 0,
                FOREIGN KEY (game_id) REFERENCES games(id),
                FOREIGN KEY (discord_id) REFERENCES users(discord_id),
                UNIQUE(game_id, discord_id)
            )
        `);

        // 🧹 MIGRATION : Nettoyer les doublons existants
        try {
            console.log('🔍 Vérification de la contrainte UNIQUE sur game_participations...');

            const indexes = this.db.pragma('index_list(game_participations)');
            const hasUniqueConstraint = indexes.some(idx => {
                if (idx.unique !== 1) return false;
                const indexInfo = this.db.pragma(`index_info(${idx.name})`);
                const columns = indexInfo.map(col => col.name);
                return columns.includes('game_id') && columns.includes('discord_id');
            });

            if (!hasUniqueConstraint) {
                console.log('🔧 MIGRATION : Ajout de la contrainte UNIQUE et nettoyage des doublons...');

                const duplicatesCount = this.db.prepare(`
                    SELECT COUNT(*) as count FROM (
                        SELECT game_id, discord_id, COUNT(*) as cnt
                        FROM game_participations
                        GROUP BY game_id, discord_id
                        HAVING cnt > 1
                    )
                `).get();

                console.log(`📊 Doublons détectés: ${duplicatesCount.count} joueurs avec entrées multiples`);

                this.db.exec(`
                    CREATE TABLE IF NOT EXISTS game_participations_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        game_id INTEGER NOT NULL,
                        discord_id TEXT NOT NULL,
                        final_score INTEGER NOT NULL,
                        final_rank INTEGER NOT NULL,
                        rounds_won INTEGER DEFAULT 0,
                        FOREIGN KEY (game_id) REFERENCES games(id),
                        FOREIGN KEY (discord_id) REFERENCES users(discord_id),
                        UNIQUE(game_id, discord_id)
                    )
                `);

                this.db.exec(`
                    INSERT INTO game_participations_new
                    SELECT
                        MIN(id) as id,
                        game_id,
                        discord_id,
                        MAX(final_score) as final_score,
                        MIN(final_rank) as final_rank,
                        MAX(rounds_won) as rounds_won
                    FROM game_participations
                    GROUP BY game_id, discord_id
                `);

                const oldCount = this.db.prepare('SELECT COUNT(*) as count FROM game_participations').get().count;
                const newCount = this.db.prepare('SELECT COUNT(*) as count FROM game_participations_new').get().count;

                console.log(`📊 Lignes avant: ${oldCount}, après: ${newCount}, doublons supprimés: ${oldCount - newCount}`);

                this.db.exec(`DROP TABLE game_participations`);
                this.db.exec(`ALTER TABLE game_participations_new RENAME TO game_participations`);

                this.db.exec(`
                    CREATE INDEX IF NOT EXISTS idx_participations_user ON game_participations(discord_id);
                    CREATE INDEX IF NOT EXISTS idx_participations_game ON game_participations(game_id);
                `);

                console.log('✅ MIGRATION RÉUSSIE : Contrainte UNIQUE ajoutée et doublons supprimés');
            } else {
                console.log('✅ Contrainte UNIQUE déjà présente');
            }
        } catch (error) {
            console.error('❌ Erreur lors de la migration game_participations:', error);
            console.error('Stack:', error.stack);
        }

        // Table des performances par manche (optionnel, pour stats détaillées)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS round_performances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id INTEGER NOT NULL,
                discord_id TEXT NOT NULL,
                round_number INTEGER NOT NULL,
                artist_name TEXT NOT NULL,
                level_found INTEGER,
                points_earned INTEGER NOT NULL,
                time_taken INTEGER,
                wrong_attempts INTEGER DEFAULT 0,
                FOREIGN KEY (game_id) REFERENCES games(id),
                FOREIGN KEY (discord_id) REFERENCES users(discord_id)
            )
        `);

        // ✅ Ajouter la colonne wrong_attempts si elle n'existe pas
        try {
            this.db.exec(`ALTER TABLE round_performances ADD COLUMN wrong_attempts INTEGER DEFAULT 0`);
            console.log('✅ Colonne wrong_attempts ajoutée à la table round_performances');
        } catch (error) {
            if (!error.message.includes('duplicate column name')) {
                console.log('ℹ️ Colonne wrong_attempts déjà présente ou erreur:', error.message);
            }
        }
        // ✅ NOUVEAU : Table des performances Buzzer Battle
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS buzzer_performances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id INTEGER NOT NULL,
                discord_id TEXT NOT NULL,
                round_number INTEGER NOT NULL,
                buzzed_first BOOLEAN DEFAULT 0,
                guessed_correctly BOOLEAN DEFAULT 0,
                reaction_time INTEGER,
                points_earned INTEGER NOT NULL,
                beatboxer_name TEXT,
                FOREIGN KEY (game_id) REFERENCES games(id),
                FOREIGN KEY (discord_id) REFERENCES users(discord_id)
            )
        `);


        // Visibilité du profil : chacun peut retirer le sien des recherches publiques
        try {
            this.db.exec(`ALTER TABLE users ADD COLUMN public_profile INTEGER NOT NULL DEFAULT 1`);
            console.log('✅ Colonne public_profile ajoutée à la table users');
        } catch (error) {
            if (!error.message.includes('duplicate column name')) {
                console.log('ℹ️ Colonne public_profile déjà présente ou erreur:', error.message);
            }
        }

        // Journal d'activité consulté par la page d'administration.
        // Volontairement en base plutôt qu'en mémoire : il survit aux redémarrages
        // et aux déploiements, qui sont justement les moments où on le consulte.
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at INTEGER NOT NULL,
                level TEXT NOT NULL,
                type TEXT NOT NULL,
                message TEXT NOT NULL,
                discord_id TEXT,
                context TEXT
            )
        `);

        // Index pour optimiser les requêtes
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_log_created ON activity_log(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_log_type ON activity_log(type);
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_games_finished ON games(finished_at);
            CREATE INDEX IF NOT EXISTS idx_games_creator ON games(creator_discord_id);
            CREATE INDEX IF NOT EXISTS idx_participations_user ON game_participations(discord_id);
            CREATE INDEX IF NOT EXISTS idx_participations_game ON game_participations(game_id);
            CREATE INDEX IF NOT EXISTS idx_rounds_user ON round_performances(discord_id);
            CREATE INDEX IF NOT EXISTS idx_buzzer_user ON buzzer_performances(discord_id);
            CREATE INDEX IF NOT EXISTS idx_buzzer_game ON buzzer_performances(game_id);
        `);

        logger.info('✅ Tables créées/vérifiées');
    }

    // Méthodes pour gérer les utilisateurs
    upsertUser(discordId, username, avatar) {
        const stmt = this.db.prepare(`
            INSERT INTO users (discord_id, username, avatar, created_at, last_seen)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(discord_id) DO UPDATE SET
                username = excluded.username,
                avatar = excluded.avatar,
                last_seen = excluded.last_seen
        `);
        const now = Date.now();
        stmt.run(discordId, username, avatar, now, now);
    }

    // Méthodes pour sauvegarder une partie
    createGame(roomCode, gameMode, totalRounds, creatorDiscordId, gameFilter = null) {
        const stmt = this.db.prepare(`
        INSERT INTO games (room_code, game_mode, total_rounds, started_at, creator_discord_id, game_filter)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(roomCode, gameMode, totalRounds, Date.now(), creatorDiscordId, gameFilter);
        return result.lastInsertRowid;
    }

    finishGame(gameId) {
        const stmt = this.db.prepare('UPDATE games SET finished_at = ? WHERE id = ?');
        const result = stmt.run(Date.now(), gameId);
        console.log(`✅ finishGame: gameId=${gameId}, rows affected=${result.changes}`);
        if (result.changes === 0) {
            console.warn(`⚠️ Aucune ligne mise à jour pour gameId=${gameId}`);
        }
    }

    // ✅ MODIFICATION CRITIQUE : UPSERT au lieu de INSERT
    addParticipation(gameId, discordId, finalScore, finalRank, roundsWon) {
        const stmt = this.db.prepare(`
            INSERT INTO game_participations (game_id, discord_id, final_score, final_rank, rounds_won)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(game_id, discord_id) DO UPDATE SET
                final_score = excluded.final_score,
                final_rank = excluded.final_rank,
                rounds_won = excluded.rounds_won
        `);

        try {
            stmt.run(gameId, discordId, finalScore, finalRank, roundsWon);
            console.log(`✅ Participation sauvegardée: game=${gameId}, rank=${finalRank}`);
        } catch (error) {
            console.error('❌ Erreur addParticipation:', error);
            throw error;
        }
    }

    addRoundPerformance(gameId, discordId, roundNumber, artistName, levelFound, pointsEarned, timeTaken, wrongAttempts = 0) {
        const stmt = this.db.prepare(`
            INSERT INTO round_performances (game_id, discord_id, round_number, artist_name, level_found, points_earned, time_taken, wrong_attempts)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(gameId, discordId, roundNumber, artistName, levelFound, pointsEarned, timeTaken, wrongAttempts);
    }

    // ✅ NOUVEAU : Méthodes pour Buzzer Battle
    addBuzzerPerformance(gameId, discordId, roundNumber, buzzedFirst, guessedCorrectly, reactionTime, pointsEarned, beatboxerName) {
        const stmt = this.db.prepare(`
            INSERT INTO buzzer_performances (game_id, discord_id, round_number, buzzed_first, guessed_correctly, reaction_time, points_earned, beatboxer_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(gameId, discordId, roundNumber, buzzedFirst ? 1 : 0, guessedCorrectly ? 1 : 0, reactionTime, pointsEarned, beatboxerName);
    }

    // Récupérer les statistiques générales du Buzzer Battle
    getBuzzerGeneralStats() {
        const stmt = this.db.prepare(`
            SELECT
                COUNT(DISTINCT bp.discord_id) as unique_players,
                COUNT(DISTINCT bp.game_id || '-' || bp.round_number) as total_rounds,
                COUNT(*) as total_attempts,
                SUM(CASE WHEN bp.guessed_correctly = 1 THEN 1 ELSE 0 END) as correct_answers,
                SUM(CASE WHEN bp.guessed_correctly = 0 THEN 1 ELSE 0 END) as incorrect_answers,
                AVG(CASE WHEN bp.reaction_time IS NOT NULL THEN bp.reaction_time END) as avg_reaction_time
            FROM buzzer_performances bp
            JOIN games g ON bp.game_id = g.id
            WHERE g.game_mode LIKE 'buzzer_%'
              AND g.finished_at IS NOT NULL
        `);
        return stmt.get();
    }

    // Récupérer les beatboxers les plus faciles/difficiles pour le Buzzer
    getBuzzerBeatboxerStats(type = 'all', limit = null, filter = null, filterValue = null) {
        let orderBy = 'success_rate DESC';
        if (type === 'easiest') orderBy = 'success_rate DESC';
        if (type === 'hardest') orderBy = 'success_rate ASC';

        // ✅ Add filtering condition
        let filterCondition = '';
        if (filter === 'country' && filterValue) {
            filterCondition = `AND g.game_mode = 'buzzer_country' AND g.game_filter = '${sqlString(filterValue)}'`;
        } else if (filter === 'event' && filterValue) {
            filterCondition = `AND g.game_mode = 'buzzer_event' AND g.game_filter = '${sqlString(filterValue)}'`;
        } else if (filter === 'country') {
            filterCondition = `AND g.game_mode = 'buzzer_country'`;
        } else if (filter === 'event') {
            filterCondition = `AND g.game_mode = 'buzzer_event'`;
        }

        const stmt = this.db.prepare(`
        SELECT
            bp.beatboxer_name,
            COUNT(DISTINCT bp.game_id || '-' || bp.round_number) as total_rounds,
            COUNT(*) as total_attempts,
            SUM(CASE WHEN bp.guessed_correctly = 1 THEN 1 ELSE 0 END) as correct_attempts,
            ROUND(
                (SUM(CASE WHEN bp.guessed_correctly = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)),
                2
            ) as success_rate
        FROM buzzer_performances bp
        JOIN games g ON bp.game_id = g.id
        WHERE g.game_mode LIKE 'buzzer_%'
          AND g.finished_at IS NOT NULL
          AND bp.beatboxer_name IS NOT NULL
        ${filterCondition}
        GROUP BY bp.beatboxer_name
        HAVING total_rounds >= 1
        ORDER BY ${orderBy}
        ${limit ? `LIMIT ${limit}` : ''}
    `);
        return stmt.all();
    }

    // Récupérer les statistiques d'un utilisateur
    getUserStats(discordId) {
        const stmt = this.db.prepare(`
        SELECT
            COUNT(DISTINCT gp.game_id) as total_games,
            SUM(gp.final_score) as total_points,
            AVG(gp.final_score) as avg_score,
            SUM(CASE WHEN gp.final_rank = 1 THEN 1 ELSE 0 END) as wins,
            SUM(gp.rounds_won) as total_rounds_won
        FROM game_participations gp
        WHERE gp.discord_id = ?
    `);
        return stmt.get(discordId);
    }

    // ✅ AJOUT : Statistiques par mode de jeu
    // ✅ AJOUT : Statistiques par mode de jeu
    getUserStatsByGameMode(discordId, gameType) {
        let query;

        if (gameType === 'buzzer') {
            // Pour Buzzer Battle : modes qui commencent par 'buzzer_'
            query = `
            SELECT
                COUNT(DISTINCT gp.game_id) as total_games,
                SUM(gp.final_score) as total_points,
                AVG(gp.final_score) as avg_score,
                SUM(CASE WHEN gp.final_rank = 1 THEN 1 ELSE 0 END) as wins,
                SUM(gp.rounds_won) as total_rounds_won
            FROM game_participations gp
            JOIN games g ON gp.game_id = g.id
            WHERE gp.discord_id = ?
              AND g.game_mode LIKE 'buzzer_%'
        `;
        } else {
            // Pour Blind Test : modes 'normal' et 'quick'
            query = `
            SELECT
                COUNT(DISTINCT gp.game_id) as total_games,
                SUM(gp.final_score) as total_points,
                AVG(gp.final_score) as avg_score,
                SUM(CASE WHEN gp.final_rank = 1 THEN 1 ELSE 0 END) as wins,
                SUM(gp.rounds_won) as total_rounds_won
            FROM game_participations gp
            JOIN games g ON gp.game_id = g.id
            WHERE gp.discord_id = ?
              AND g.game_mode IN ('normal', 'quick')
        `;
        }

        const stmt = this.db.prepare(query);
        return stmt.get(discordId);
    }

    /**
     * Récupère les X dernières parties d'un utilisateur
     */
    getUserRecentGames(discordId, limit = 20) {
        const stmt = this.db.prepare(`
        SELECT
            g.id as gameId,
            g.game_mode as gameMode,
            g.room_code as roomCode,
            g.finished_at as playedAt,
            gp.final_score as finalScore,
            gp.final_rank as finalRank,
            gp.rounds_won as roundsWon,
            (
                SELECT json_group_array(
                    json_object(
                        'discordId', gp2.discord_id,
                        'username', u2.username,
                        'score', gp2.final_score,
                        'rank', gp2.final_rank,
                        'roundsWon', gp2.rounds_won
                    )
                )
                FROM game_participations gp2
                JOIN users u2 ON gp2.discord_id = u2.discord_id
                WHERE gp2.game_id = g.id
                ORDER BY gp2.final_rank ASC
            ) as participants
        FROM game_participations gp
        JOIN games g ON gp.game_id = g.id
        WHERE gp.discord_id = ?
          AND g.finished_at IS NOT NULL
        ORDER BY g.finished_at DESC
        LIMIT ?
    `);

        const rows = stmt.all(discordId, limit);

        return rows.map(row => ({
            ...row,
            participants: JSON.parse(row.participants || '[]')
        }));
    }

    // ==================== JOURNAL D'ACTIVITÉ ====================

    /**
     * Enregistre un événement. Le journal est plafonné : au-delà de MAX_LOG_ROWS,
     * les plus anciens sont supprimés, pour que la base ne grossisse pas sans fin.
     */
    logEvent({ level = 'info', type, message, discordId = null, context = null }) {
        try {
            this.db.prepare(`
                INSERT INTO activity_log (created_at, level, type, message, discord_id, context)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                Date.now(),
                level,
                type,
                String(message).slice(0, 1000),
                discordId,
                context ? JSON.stringify(context).slice(0, 2000) : null
            );

            // Nettoyage amorti : une fois sur cinquante en moyenne
            if (Math.random() < 0.02) this.trimActivityLog();
        } catch (error) {
            // Le journal ne doit jamais faire échouer une action du jeu
            console.error('❌ Erreur écriture journal:', error.message);
        }
    }

    trimActivityLog(maxRows = 5000) {
        this.db.prepare(`
            DELETE FROM activity_log
            WHERE id NOT IN (SELECT id FROM activity_log ORDER BY created_at DESC LIMIT ?)
        `).run(maxRows);
    }

    getActivityLog({ limit = 100, type = null, level = null, since = null } = {}) {
        const conditions = [];
        const params = [];

        if (type) { conditions.push('type = ?'); params.push(type); }
        if (level) { conditions.push('level = ?'); params.push(level); }
        if (since) { conditions.push('created_at >= ?'); params.push(since); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        params.push(Math.min(Math.max(limit, 1), 500));

        const rows = this.db.prepare(`
            SELECT l.id, l.created_at, l.level, l.type, l.message, l.discord_id, l.context, u.username
            FROM activity_log l
            LEFT JOIN users u ON u.discord_id = l.discord_id
            ${where}
            ORDER BY l.created_at DESC
            LIMIT ?
        `).all(...params);

        return rows.map((row) => ({
            id: row.id,
            createdAt: row.created_at,
            level: row.level,
            type: row.type,
            message: row.message,
            discordId: row.discord_id,
            username: row.username,
            context: row.context ? JSON.parse(row.context) : null,
        }));
    }

    getLogTypes() {
        return this.db.prepare('SELECT DISTINCT type FROM activity_log ORDER BY type').all().map((row) => row.type);
    }

    // ==================== PROFILS PUBLICS ====================

    setProfileVisibility(discordId, isPublic) {
        this.db.prepare('UPDATE users SET public_profile = ? WHERE discord_id = ?').run(isPublic ? 1 : 0, discordId);
    }

    isProfilePublic(discordId) {
        const row = this.db.prepare('SELECT public_profile FROM users WHERE discord_id = ?').get(discordId);
        return row ? row.public_profile === 1 : false;
    }

    /**
     * Recherche de joueurs par pseudo, pour l'autocomplétion.
     * includeHidden n'est vrai que côté administration.
     */
    searchUsers(query, { limit = 8, includeHidden = false } = {}) {
        const needle = `%${String(query || '').trim()}%`;
        if (needle.length <= 2) return [];

        return this.db.prepare(`
            SELECT
                u.discord_id AS discordId,
                u.username,
                u.avatar,
                u.last_seen AS lastSeen,
                u.public_profile AS publicProfile,
                COUNT(DISTINCT gp.game_id) AS totalGames
            FROM users u
            LEFT JOIN game_participations gp ON gp.discord_id = u.discord_id
            WHERE u.username LIKE ? COLLATE NOCASE
              ${includeHidden ? '' : 'AND u.public_profile = 1'}
            GROUP BY u.discord_id
            ORDER BY totalGames DESC, u.last_seen DESC
            LIMIT ?
        `).all(needle, Math.min(Math.max(limit, 1), 25));
    }

    getUserByDiscordId(discordId) {
        return this.db.prepare(`
            SELECT discord_id AS discordId, username, avatar,
                   created_at AS createdAt, last_seen AS lastSeen,
                   public_profile AS publicProfile
            FROM users WHERE discord_id = ?
        `).get(discordId);
    }

    /**
     * Adversaires les plus souvent rencontrés, avec le bilan face à eux.
     * Deux joueurs se croisent quand ils apparaissent dans la même partie terminée.
     */
    getFrequentOpponents(discordId, limit = 5) {
        return this.db.prepare(`
            SELECT
                u.discord_id AS discordId,
                u.username,
                u.avatar,
                u.public_profile AS publicProfile,
                COUNT(*) AS gamesTogether,
                SUM(CASE WHEN me.final_rank < other.final_rank THEN 1 ELSE 0 END) AS aheadOfThem,
                SUM(CASE WHEN me.final_rank > other.final_rank THEN 1 ELSE 0 END) AS behindThem
            FROM game_participations me
            JOIN game_participations other
              ON other.game_id = me.game_id AND other.discord_id != me.discord_id
            JOIN games g ON g.id = me.game_id
            JOIN users u ON u.discord_id = other.discord_id
            WHERE me.discord_id = ? AND g.finished_at IS NOT NULL
            GROUP BY other.discord_id
            ORDER BY gamesTogether DESC
            LIMIT ?
        `).all(discordId, limit);
    }

    /** Artistes sur lesquels le joueur est le plus souvent tombé juste ou faux (Blind Test). */
    getUserArtistRecord(discordId, { limit = 5 } = {}) {
        return this.db.prepare(`
            SELECT
                artist_name AS name,
                COUNT(*) AS rounds,
                SUM(CASE WHEN level_found IS NOT NULL THEN 1 ELSE 0 END) AS found,
                ROUND(AVG(CASE WHEN level_found IS NOT NULL THEN level_found END), 2) AS averageLevel
            FROM round_performances
            WHERE discord_id = ?
            GROUP BY artist_name
            HAVING rounds >= 2
            ORDER BY rounds DESC
            LIMIT ?
        `).all(discordId, limit);
    }

    /** Bilan Buzzer d'un joueur : buzz, justesse, temps de réaction. */
    getUserBuzzerRecord(discordId) {
        return this.db.prepare(`
            SELECT
                COUNT(*) AS totalBuzzes,
                SUM(CASE WHEN guessed_correctly = 1 THEN 1 ELSE 0 END) AS correct,
                SUM(CASE WHEN guessed_correctly = 0 THEN 1 ELSE 0 END) AS wrong,
                AVG(CASE WHEN reaction_time IS NOT NULL THEN reaction_time END) AS averageReaction
            FROM buzzer_performances
            WHERE discord_id = ?
        `).get(discordId);
    }

    // ==================== ADMINISTRATION ====================

    getAdminOverview() {
        const one = (sql, ...params) => this.db.prepare(sql).get(...params);
        const dayAgo = Date.now() - 24 * 3600 * 1000;
        const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
        const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;

        return {
            users: one('SELECT COUNT(*) AS n FROM users').n,
            usersPublic: one('SELECT COUNT(*) AS n FROM users WHERE public_profile = 1').n,
            usersActiveWeek: one('SELECT COUNT(*) AS n FROM users WHERE last_seen >= ?', weekAgo).n,
            gamesTotal: one('SELECT COUNT(*) AS n FROM games WHERE finished_at IS NOT NULL').n,
            gamesUnfinished: one('SELECT COUNT(*) AS n FROM games WHERE finished_at IS NULL').n,
            gamesDay: one('SELECT COUNT(*) AS n FROM games WHERE finished_at >= ?', dayAgo).n,
            gamesWeek: one('SELECT COUNT(*) AS n FROM games WHERE finished_at >= ?', weekAgo).n,
            gamesMonth: one('SELECT COUNT(*) AS n FROM games WHERE finished_at >= ?', monthAgo).n,
            blindtestGames: one("SELECT COUNT(*) AS n FROM games WHERE game_mode IN ('normal','quick') AND finished_at IS NOT NULL").n,
            buzzerGames: one("SELECT COUNT(*) AS n FROM games WHERE game_mode LIKE 'buzzer_%' AND finished_at IS NOT NULL").n,
            participations: one('SELECT COUNT(*) AS n FROM game_participations').n,
            blindtestRounds: one('SELECT COUNT(*) AS n FROM round_performances').n,
            buzzerRounds: one('SELECT COUNT(*) AS n FROM buzzer_performances').n,
            averagePlayersPerGame: one(`
                SELECT ROUND(AVG(players), 2) AS n FROM (
                    SELECT COUNT(*) AS players FROM game_participations GROUP BY game_id
                )
            `).n || 0,
        };
    }

    /** Parties terminées par jour, pour la courbe d'activité. */
    getActivityByDay(days = 30) {
        const since = Date.now() - days * 24 * 3600 * 1000;
        return this.db.prepare(`
            SELECT
                date(finished_at / 1000, 'unixepoch') AS day,
                COUNT(*) AS games,
                COUNT(DISTINCT game_mode) AS modes
            FROM games
            WHERE finished_at IS NOT NULL AND finished_at >= ?
            GROUP BY day
            ORDER BY day
        `).all(since);
    }

    /** Dernières parties terminées, avec leurs participants. */
    getRecentGames({ limit = 25, discordId = null } = {}) {
        const rows = this.db.prepare(`
            SELECT
                g.id AS gameId,
                g.room_code AS roomCode,
                g.game_mode AS gameMode,
                g.game_filter AS gameFilter,
                g.total_rounds AS totalRounds,
                g.started_at AS startedAt,
                g.finished_at AS finishedAt,
                g.creator_discord_id AS creatorDiscordId,
                (SELECT username FROM users WHERE discord_id = g.creator_discord_id) AS creatorUsername,
                (
                    SELECT json_group_array(json_object(
                        'discordId', gp.discord_id,
                        'username', u.username,
                        'score', gp.final_score,
                        'rank', gp.final_rank
                    ))
                    FROM game_participations gp
                    JOIN users u ON u.discord_id = gp.discord_id
                    WHERE gp.game_id = g.id
                ) AS participants
            FROM games g
            WHERE g.finished_at IS NOT NULL
              ${discordId ? 'AND EXISTS (SELECT 1 FROM game_participations x WHERE x.game_id = g.id AND x.discord_id = ?)' : ''}
            ORDER BY g.finished_at DESC
            LIMIT ?
        `).all(...(discordId ? [discordId, limit] : [limit]));

        return rows.map((row) => ({
            ...row,
            participants: JSON.parse(row.participants || '[]').sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
        }));
    }

    getDatabaseFileSize() {
        try {
            const pageCount = this.db.pragma('page_count', { simple: true });
            const pageSize = this.db.pragma('page_size', { simple: true });
            return pageCount * pageSize;
        } catch (error) {
            return null;
        }
    }

    getTableCounts() {
        const tables = ['users', 'games', 'game_participations', 'round_performances', 'buzzer_performances', 'activity_log'];
        return tables.map((table) => ({
            table,
            rows: this.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,
        }));
    }

    /**
     * Supprime toutes les données d'un joueur (demande RGPD ou nettoyage).
     * Les parties auxquelles il a participé restent, mais sans lui.
     */
    deleteUserData(discordId) {
        const run = this.db.transaction((id) => {
            const counts = {
                rounds: this.db.prepare('DELETE FROM round_performances WHERE discord_id = ?').run(id).changes,
                buzzer: this.db.prepare('DELETE FROM buzzer_performances WHERE discord_id = ?').run(id).changes,
                participations: this.db.prepare('DELETE FROM game_participations WHERE discord_id = ?').run(id).changes,
                user: this.db.prepare('DELETE FROM users WHERE discord_id = ?').run(id).changes,
            };
            this.db.prepare('UPDATE games SET creator_discord_id = NULL WHERE creator_discord_id = ?').run(id);
            return counts;
        });
        return run(discordId);
    }

    /**
     * Remise à zéro des statistiques.
     * keepUsers conserve les comptes (et donc les connexions Discord) et n'efface
     * que l'historique de jeu.
     */
    resetStatistics({ keepUsers = true, keepLog = false } = {}) {
        const run = this.db.transaction(() => {
            const before = this.getTableCounts();

            this.db.exec('DELETE FROM buzzer_performances');
            this.db.exec('DELETE FROM round_performances');
            this.db.exec('DELETE FROM game_participations');
            this.db.exec('DELETE FROM games');
            if (!keepUsers) this.db.exec('DELETE FROM users');
            if (!keepLog) this.db.exec('DELETE FROM activity_log');

            this.db.exec(`
                DELETE FROM sqlite_sequence
                WHERE name IN ('games', 'game_participations', 'round_performances', 'buzzer_performances')
            `);

            return before;
        });

        const before = run();
        this.db.exec('VACUUM');
        return { before, after: this.getTableCounts() };
    }

    close() {
        this.db.close();
        logger.info('🔒 Base de données fermée');
    }
}

// Singleton
let instance = null;
function getDatabase() {
    if (!instance) {
        instance = new DatabaseService();
    }
    return instance;
}

module.exports = { getDatabase, DatabaseService };
