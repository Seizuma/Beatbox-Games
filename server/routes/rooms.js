/**
 * Recherche d'une salle par son code, tous jeux confondus.
 *
 * Le code suffit à identifier la salle : l'invité n'a donc plus à choisir le jeu
 * avant de saisir le code, une étape que l'hôte connaît déjà.
 */

const express = require('express');
const { roomManager } = require('../services/roomManager');
const buzzerGameManager = require('../services/buzzer-gameManager');
const publicRooms = require('../services/publicRooms');

const router = express.Router();

const CODE_PATTERN = /^[A-Z0-9]{4,8}$/;

/**
 * GET /api/rooms/public
 * Salles publiques en attente, pour l'accueil : « 3 salles ouvertes · 14 joueurs ».
 */
router.get('/public', (req, res) => {
    try {
        const rooms = publicRooms.list();
        res.set('Cache-Control', 'no-store');
        res.json({
            success: true,
            rooms,
            players: rooms.reduce((sum, room) => sum + room.players, 0),
        });
    } catch (error) {
        console.error('❌ Erreur liste des salles publiques:', error);
        res.status(500).json({ success: false, error: 'server_error' });
    }
});

/**
 * GET /api/rooms/quick?game=blindtest|buzzer
 * Partie rapide : la salle publique à rejoindre, ou null s'il faut en créer une.
 */
router.get('/quick', (req, res) => {
    const game = req.query.game === 'buzzer' ? 'buzzer' : 'blindtest';
    try {
        const room = publicRooms.pickQuick(game);
        res.set('Cache-Control', 'no-store');
        res.json({ success: true, game, code: room ? room.code : null });
    } catch (error) {
        console.error('❌ Erreur partie rapide:', error);
        res.status(500).json({ success: false, error: 'server_error' });
    }
});

router.get('/:code', (req, res) => {
    try {
        const code = String(req.params.code || '').trim().toUpperCase();

        if (!CODE_PATTERN.test(code)) {
            return res.status(400).json({ success: false, error: 'invalid_code' });
        }

        const blindtestRoom = roomManager.getRoom(code);
        if (blindtestRoom) {
            return res.json({
                success: true,
                code,
                game: 'blindtest',
                path: '/blindtest-online',
                state: blindtestRoom.state,
                players: typeof blindtestRoom.getConnectedPlayers === 'function'
                    ? blindtestRoom.getConnectedPlayers().length
                    : null,
            });
        }

        const buzzerGame = buzzerGameManager.getGame(code);
        if (buzzerGame) {
            return res.json({
                success: true,
                code,
                game: 'buzzer',
                path: '/buzzer-battle',
                state: buzzerGame.status,
                players: Object.keys(buzzerGame.players || {}).length,
            });
        }

        return res.status(404).json({ success: false, error: 'room_not_found' });
    } catch (error) {
        console.error('❌ Erreur recherche de salle:', error);
        return res.status(500).json({ success: false, error: 'server_error' });
    }
});

module.exports = router;