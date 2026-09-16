// server/services/rankingService.js
//
// Classement compétitif de BeatBox Games.
//
// Principe :
// - Seules les parties « classées » comptent : terminées, avec au moins 2 comptes Discord
//   différents et un nombre minimum de manches. Jouer seul ne rapporte rien au classement.
// - Chaque joueur a une cote (système Elo multijoueur) qui démarre à 1000.
//   Après une partie, chaque joueur est comparé à chaque adversaire : battre un joueur mieux coté
//   rapporte beaucoup, battre un joueur moins bien coté rapporte peu, perdre fait baisser la cote.
//   Enchaîner les parties ne suffit donc pas pour monter : il faut battre des adversaires.
// - Un joueur apparaît dans le classement après ses parties de placement.
//
// Les cotes sont recalculées à partir de l'historique (aucune migration de base nécessaire)
// et mises en cache jusqu'à la prochaine partie terminée.

const { getDatabase } = require('./database');

const RANKING_CONFIG = {
    START_RATING: 1000,
    K_FACTOR: 32,
    PROVISIONAL_K_FACTOR: 48,
    PROVISIONAL_GAMES: 10,
    MIN_DISCORD_PLAYERS: 2,
    MIN_ROUNDS: 5,
    PLACEMENT_GAMES: 5,
};

const GAME_CONDITIONS = {
    all: '1 = 1',
    blindtest: "g.game_mode IN ('normal', 'quick')",
    buzzer: "g.game_mode LIKE 'buzzer_%'",
};

const normalizeGame = (game) => (Object.prototype.hasOwnProperty.call(GAME_CONDITIONS, game) ? game : 'all');

const cache = new Map();

function getSignature(db) {
    const row = db.db.prepare(`
        SELECT COUNT(*) AS games, COALESCE(MAX(finished_at), 0) AS lastFinished
        FROM games
        WHERE finished_at IS NOT NULL
    `).get();
    return `${row.games}-${row.lastFinished}`;
}

function loadRankedParticipations(db, game) {
    return db.db.prepare(`
        SELECT g.id AS gameId, g.finished_at AS finishedAt, gp.discord_id AS discordId, gp.final_rank AS finalRank
        FROM games g
        JOIN game_participations gp ON gp.game_id = g.id
        WHERE g.finished_at IS NOT NULL
          AND g.total_rounds >= ?
          AND ${GAME_CONDITIONS[game]}
          AND g.id IN (
              SELECT game_id
              FROM game_participations
              GROUP BY game_id
              HAVING COUNT(DISTINCT discord_id) >= ?
          )
        ORDER BY g.finished_at ASC, g.id ASC, gp.final_rank ASC
    `).all(RANKING_CONFIG.MIN_ROUNDS, RANKING_CONFIG.MIN_DISCORD_PLAYERS);
}

function expectedScore(rating, opponentRating) {
    return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
}

function replayRatings(rows) {
    const players = new Map();

    const getPlayer = (discordId) => {
        if (!players.has(discordId)) {
            players.set(discordId, {
                discordId,
                rating: RANKING_CONFIG.START_RATING,
                peakRating: RANKING_CONFIG.START_RATING,
                rankedGames: 0,
                wins: 0,
                lastPlayedAt: null,
            });
        }
        return players.get(discordId);
    };

    // Regrouper les participations par partie (déjà triées chronologiquement)
    const games = [];
    rows.forEach((row) => {
        const last = games[games.length - 1];
        if (!last || last.gameId !== row.gameId) {
            games.push({ gameId: row.gameId, finishedAt: row.finishedAt, participants: [row] });
        } else {
            last.participants.push(row);
        }
    });

    games.forEach(({ finishedAt, participants }) => {
        if (participants.length < RANKING_CONFIG.MIN_DISCORD_PLAYERS) return;

        const entries = participants.map((participant) => ({
            player: getPlayer(participant.discordId),
            rank: participant.finalRank,
        }));
        const ratingsBefore = entries.map((entry) => entry.player.rating);
        const opponents = entries.length - 1;

        const deltas = entries.map((entry, index) => {
            let total = 0;
            entries.forEach((other, otherIndex) => {
                if (index === otherIndex) return;
                const actual = entry.rank < other.rank ? 1 : entry.rank === other.rank ? 0.5 : 0;
                total += actual - expectedScore(ratingsBefore[index], ratingsBefore[otherIndex]);
            });
            const k = entry.player.rankedGames < RANKING_CONFIG.PROVISIONAL_GAMES
                ? RANKING_CONFIG.PROVISIONAL_K_FACTOR
                : RANKING_CONFIG.K_FACTOR;
            return (k * total) / opponents;
        });

        entries.forEach((entry, index) => {
            const { player } = entry;
            player.rating += deltas[index];
            player.peakRating = Math.max(player.peakRating, player.rating);
            player.rankedGames += 1;
            if (entry.rank === 1) player.wins += 1;
            player.lastPlayedAt = finishedAt;
        });
    });

    return players;
}

function computeRanking(game) {
    const db = getDatabase();
    const key = normalizeGame(game);
    const signature = getSignature(db);
    const cached = cache.get(key);

    if (cached && cached.signature === signature) {
        return cached.data;
    }

    const players = replayRatings(loadRankedParticipations(db, key));

    const users = new Map(
        db.db.prepare('SELECT discord_id, username, avatar FROM users').all()
            .map((user) => [user.discord_id, user])
    );

    const all = Array.from(players.values()).map((player) => {
        const user = users.get(player.discordId) || {};
        return {
            discordId: player.discordId,
            username: user.username || 'Joueur',
            avatar: user.avatar
                ? `https://cdn.discordapp.com/avatars/${player.discordId}/${user.avatar}.png?size=64`
                : null,
            rating: Math.round(player.rating),
            peakRating: Math.round(player.peakRating),
            rankedGames: player.rankedGames,
            wins: player.wins,
            winRate: player.rankedGames > 0 ? Math.round((player.wins / player.rankedGames) * 100) : 0,
            lastPlayedAt: player.lastPlayedAt,
        };
    });

    const ranked = all
        .filter((player) => player.rankedGames >= RANKING_CONFIG.PLACEMENT_GAMES)
        .sort((a, b) => b.rating - a.rating || b.rankedGames - a.rankedGames)
        .map((player, index) => ({ ...player, rank: index + 1 }));

    const data = {
        ranked,
        byDiscordId: new Map(all.map((player) => [player.discordId, player])),
        positions: new Map(ranked.map((player) => [player.discordId, player.rank])),
    };

    cache.set(key, { signature, data });
    return data;
}

function getLeaderboard(game, limit = 15) {
    const { ranked } = computeRanking(game);
    return {
        totalRanked: ranked.length,
        leaderboard: ranked.slice(0, limit).map(({ discordId, ...player }) => player),
    };
}

function getPlayerRanking(game, discordId) {
    const { ranked, byDiscordId, positions } = computeRanking(game);
    const player = byDiscordId.get(discordId);

    if (!player) {
        return {
            rating: RANKING_CONFIG.START_RATING,
            rankedGames: 0,
            wins: 0,
            position: null,
            placementRemaining: RANKING_CONFIG.PLACEMENT_GAMES,
            totalRanked: ranked.length,
        };
    }

    return {
        rating: player.rating,
        peakRating: player.peakRating,
        rankedGames: player.rankedGames,
        wins: player.wins,
        winRate: player.winRate,
        position: positions.get(discordId) || null,
        placementRemaining: Math.max(0, RANKING_CONFIG.PLACEMENT_GAMES - player.rankedGames),
        totalRanked: ranked.length,
    };
}

function getPublicConfig() {
    return {
        startRating: RANKING_CONFIG.START_RATING,
        minDiscordPlayers: RANKING_CONFIG.MIN_DISCORD_PLAYERS,
        minRounds: RANKING_CONFIG.MIN_ROUNDS,
        placementGames: RANKING_CONFIG.PLACEMENT_GAMES,
    };
}

module.exports = {
    RANKING_CONFIG,
    normalizeGame,
    getLeaderboard,
    getPlayerRanking,
    getPublicConfig,
    // Exposé pour les tests
    replayRatings,
};