/**
 * Écran de connexion de la version de test : /api/access/*
 * (voir services/accessGate.js). Ces trois routes restent ouvertes.
 */

const express = require('express');
const gate = require('../services/accessGate');
const { getDatabase } = require('../services/database');

const router = express.Router();

/** GET /api/access/status : le serveur est-il protégé ? */
router.get('/status', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, gate: gate.enabled() });
});

/**
 * POST /api/access/session (Authorization: Bearer <jeton Discord>)
 * Vérifie que le compte est autorisé et pose le cookie qui ouvre l'audio,
 * les images et le temps réel. Un refus renvoie l'identifiant Discord, que
 * la personne peut transmettre à l'administrateur.
 */
router.post('/session', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!gate.enabled()) return res.json({ success: true, gate: false, allowed: true });

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const user = gate.userFromToken(token);
    if (!user) {
        gate.clearSessionCookie(res);
        return res.status(401).json({ success: false, gate: true, allowed: false, error: 'access_required' });
    }

    const db = getDatabase();
    if (!gate.isAllowed(user.discordId)) {
        gate.clearSessionCookie(res);
        db.logEvent({
            level: 'warn',
            type: 'access_denied',
            message: `Accès à la version de test refusé : ${user.username} (${user.discordId})`,
            discordId: user.discordId,
            context: { username: user.username, avatar: user.avatar || null },
        });
        return res.status(403).json({
            success: false,
            gate: true,
            allowed: false,
            error: 'access_denied',
            discordId: user.discordId,
            username: user.username,
        });
    }

    gate.setSessionCookie(res, token, user);
    try {
        db.touchAccess(user.discordId, user.username, user.avatar);
    } catch (error) {
        // La dernière visite est une information, pas une condition d'accès
    }
    return res.json({ success: true, gate: true, allowed: true, discordId: user.discordId, username: user.username });
});

/** POST /api/access/logout : retire le cookie d'accès (changement de compte). */
router.post('/logout', (req, res) => {
    gate.clearSessionCookie(res);
    res.json({ success: true });
});

module.exports = router;
