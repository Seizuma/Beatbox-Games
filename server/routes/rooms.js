/**
 * Recherche d'une salle par son code, tous jeux confondus.
 *
 * Le code suffit à identifier la salle : l'invité n'a donc plus à choisir le jeu
 * avant de saisir le code, une étape que l'hôte connaît déjà.
 */

const express = require('express');
const { roomManager } = require('../services/roomManager');
const buzzerGameManager = require('../services/buzzer-gameManager');

const router = express.Router();

const CODE_PATTERN = /^[A-Z0-9]{4,8}$/;

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