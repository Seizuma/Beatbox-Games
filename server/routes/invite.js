/**
 * Liens d'invitation : GET /invite/:code?lang=fr|en
 *
 * Les applications qui affichent un aperçu de lien (Discord, WhatsApp,
 * Messenger, iMessage, Slack, Telegram…) n'exécutent pas JavaScript : elles
 * lisent les balises Open Graph de la page. Le site étant une application
 * React, toutes ses pages montrent le même aperçu générique. Cette route
 * renvoie une petite page dont l'aperçu décrit la salle (hôte, joueurs,
 * réglages), puis redirige aussitôt le joueur vers la salle.
 *
 * Le client nginx transmet /invite/ à ce serveur (client/nginx/default.conf.template).
 */

const express = require('express');
const { roomManager } = require('../services/roomManager');
const buzzerGameManager = require('../services/buzzer-gameManager');
const { CONFIG, ROOM_STATES } = require('../constants');

const router = express.Router();

const CODE_PATTERN = /^[A-Z0-9]{4,8}$/;
const SITE_NAME = 'BeatBox Games';

const GAMES = {
    blindtest: { name: 'Blind Test', path: '/blindtest-online', image: '/og/blindtest.jpg' },
    buzzer: { name: 'Buzzer Battle', path: '/buzzer-battle', image: '/og/buzzer.jpg' },
};

const plural = (count, word, lang) => {
    if (lang === 'fr') return `${count} ${word}${count > 1 ? 's' : ''}`;
    return `${count} ${word}${count === 1 ? '' : 's'}`;
};

const TEXT = {
    fr: {
        locale: 'fr_FR',
        invites: (host, game) => `${host} t’invite au ${game}`,
        invitation: (game) => `Invitation au ${game}`,
        players: (count, max) => `${plural(count, 'joueur', 'fr')} sur ${max}`,
        rounds: (count) => plural(count, 'manche', 'fr'),
        answerTime: (seconds) => `${seconds} s pour répondre`,
        room: (code) => `Salle ${code}`,
        full: 'salle complète',
        filter: (mode, value) => (value
            ? `${mode === 'buzzer_country' ? 'pays' : 'événement'} : ${value}`
            : 'tous les beatboxers'),
        pitch: {
            blindtest: 'Écoute les extraits et trouve le beatboxer avant les autres. Gratuit, sans inscription.',
            buzzer: 'Une photo floue se précise : buzze le premier et donne le nom du beatboxer. Gratuit, sans inscription.',
        },
        playingTitle: (game) => `Partie de ${game} en cours`,
        playing: (round, rounds) => `manche ${round} sur ${rounds}`,
        playingPitch: 'La partie a déjà commencé : reviens par ce lien à la fin pour la revanche, ou crée ta propre salle.',
        finishedTitle: (game) => `Partie de ${game} terminée`,
        finishedOpen: 'La partie vient de se terminer : ouvre le lien pour jouer la revanche.',
        finishedWait: 'La partie vient de se terminer : reviens par ce lien quand l’hôte relance, ou crée ta propre salle.',
        closedTitle: (code) => `Salle ${code} fermée — ${SITE_NAME}`,
        closed: 'Cette partie est terminée ou la salle n’existe plus. Crée la tienne en quelques secondes : Blind Test, Buzzer Battle ou Beatboxdle, gratuit et sans inscription.',
        redirecting: 'Redirection vers la salle…',
        join: (code) => `Rejoindre la salle ${code}`,
        home: 'Aller sur BeatBox Games',
        imageAlt: (game) => `${game} — ${SITE_NAME}`,
    },
    en: {
        locale: 'en_US',
        invites: (host, game) => `${host} invites you to ${game}`,
        invitation: (game) => `Invitation to ${game}`,
        players: (count, max) => `${plural(count, 'player', 'en')} of ${max}`,
        rounds: (count) => plural(count, 'round', 'en'),
        answerTime: (seconds) => `${seconds} s to answer`,
        room: (code) => `Room ${code}`,
        full: 'room full',
        filter: (mode, value) => (value
            ? `${mode === 'buzzer_country' ? 'country' : 'event'}: ${value}`
            : 'all beatboxers'),
        pitch: {
            blindtest: 'Hear the clips and name the beatboxer before everyone else. Free, no sign-up.',
            buzzer: 'A blurry photo sharpens: buzz first and name the beatboxer. Free, no sign-up.',
        },
        playingTitle: (game) => `${game} game in progress`,
        playing: (round, rounds) => `round ${round} of ${rounds}`,
        playingPitch: 'The game has already started: come back through this link when it ends for the rematch, or start your own room.',
        finishedTitle: (game) => `${game} game over`,
        finishedOpen: 'The game just ended: open the link to play the rematch.',
        finishedWait: 'The game just ended: come back through this link when the host starts again, or start your own room.',
        closedTitle: (code) => `Room ${code} is closed — ${SITE_NAME}`,
        closed: 'This game is over or the room no longer exists. Start your own in seconds: Blind Test, Buzzer Battle or Beatboxdle, free and no sign-up.',
        redirecting: 'Taking you to the room…',
        join: (code) => `Join room ${code}`,
        home: 'Go to BeatBox Games',
        imageAlt: (game) => `${game} — ${SITE_NAME}`,
    },
};

const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Un pseudo reste un pseudo : sur une ligne, sans caractères de contrôle, pas trop long
const cleanName = (value) => {
    const name = String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    return name.length > 24 ? `${name.slice(0, 23)}…` : name;
};

const pickLanguage = (req) => {
    if (req.query.lang === 'en' || req.query.lang === 'fr') return req.query.lang;
    const header = String(req.headers['accept-language'] || '').toLowerCase();
    return header && !header.startsWith('fr') ? 'en' : 'fr';
};

/** Ce que l'aperçu doit dire de la salle, quel que soit le jeu. Null si elle n'existe plus. */
function describeRoom(code) {
    const maxPlayers = CONFIG.LIMITS.MAX_PLAYERS_PER_ROOM || 10;

    const room = roomManager.getRoom(code);
    if (room) {
        return {
            game: 'blindtest',
            host: cleanName(room.creatorPseudo),
            players: typeof room.getConnectedPlayers === 'function' ? room.getConnectedPlayers().length : 0,
            maxPlayers,
            rounds: room.maxRounds || null,
            answerTime: room.answerTimeSettings ? room.answerTimeSettings.current : null,
            // Lancement (compte à rebours) ou partie : on ne peut plus entrer
            playing: room.state === ROOM_STATES.PLAYING || room.state === ROOM_STATES.STARTING,
            // Une salle de Blind Test terminée se rouvre quand quelqu'un la rejoint (revanche)
            finished: room.state === ROOM_STATES.FINISHED,
            joinableWhenFinished: true,
            round: room.game ? room.game.currentRound || null : null,
        };
    }

    const game = buzzerGameManager.getGame(code);
    if (game) {
        const players = Object.values(game.players || {});
        const host = (game.players || {})[game.creatorId];
        return {
            game: 'buzzer',
            host: cleanName(host && host.username),
            players: players.filter((player) => player.connected !== false).length,
            maxPlayers,
            rounds: game.totalRounds || null,
            mode: game.mode,
            filter: cleanName(game.filter),
            playing: game.status !== 'waiting' && game.status !== 'finished',
            finished: game.status === 'finished',
            joinableWhenFinished: false,
            round: game.currentRound || null,
        };
    }

    return null;
}

function buildPreview(code, info, lang) {
    const text = TEXT[lang];
    if (!info) {
        return {
            title: text.closedTitle(code),
            description: text.closed,
            image: '/og-beatbox-image.jpg',
            imageAlt: SITE_NAME,
            target: '/',
            action: text.home,
        };
    }

    const game = GAMES[info.game];
    const parts = [text.room(code)];
    let title;
    let pitch;

    if (info.finished) {
        title = text.finishedTitle(game.name);
        parts.push(text.players(info.players, info.maxPlayers));
        pitch = info.joinableWhenFinished ? text.finishedOpen : text.finishedWait;
    } else if (info.playing) {
        title = text.playingTitle(game.name);
        if (info.round && info.rounds) parts.push(text.playing(info.round, info.rounds));
        parts.push(text.players(info.players, info.maxPlayers));
        pitch = text.playingPitch;
    } else {
        title = info.host ? text.invites(info.host, game.name) : text.invitation(game.name);
        parts.push(info.players >= info.maxPlayers ? text.full : text.players(info.players, info.maxPlayers));
        if (info.rounds) parts.push(text.rounds(info.rounds));
        if (info.game === 'blindtest' && info.answerTime) parts.push(text.answerTime(info.answerTime));
        if (info.game === 'buzzer') parts.push(text.filter(info.mode, info.filter));
        pitch = text.pitch[info.game];
    }

    return {
        title,
        description: `${parts.join(' · ')}. ${pitch}`,
        image: game.image,
        imageAlt: text.imageAlt(game.name),
        target: `${game.path}?room=${encodeURIComponent(code)}`,
        action: text.join(code),
    };
}

function renderPage({ code, lang, preview }) {
    const text = TEXT[lang];
    const site = CONFIG.CLIENT_URL.replace(/\/$/, '');
    const pageUrl = `${site}/invite/${code}`;
    const e = escapeHtml;
    // La cible est un chemin du site : pas de redirection ouverte vers un autre domaine
    const targetJson = JSON.stringify(preview.target).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(preview.title)}</title>
<meta name="description" content="${e(preview.description)}">
<meta name="robots" content="noindex, follow">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:type" content="website">
<meta property="og:url" content="${e(pageUrl)}">
<meta property="og:title" content="${e(preview.title)}">
<meta property="og:description" content="${e(preview.description)}">
<meta property="og:image" content="${e(site + preview.image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${e(preview.imageAlt)}">
<meta property="og:locale" content="${text.locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(preview.title)}">
<meta name="twitter:description" content="${e(preview.description)}">
<meta name="twitter:image" content="${e(site + preview.image)}">
<meta name="theme-color" content="#FFC72C">
<link rel="icon" href="/favicon.ico">
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0A1B45;color:#fff;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{padding:24px;text-align:center}
a{display:inline-block;margin-top:12px;padding:12px 22px;border-radius:999px;background:#FFC72C;color:#0A1B45;font-weight:700;text-decoration:none}
</style>
</head>
<body>
<main>
<p>${e(text.redirecting)}</p>
<a href="${e(preview.target)}">${e(preview.action)}</a>
</main>
<script>location.replace(${targetJson});</script>
</body>
</html>`;
}

router.get('/:code', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const lang = pickLanguage(req);

    if (!CODE_PATTERN.test(code)) {
        return res.redirect(302, '/');
    }

    let info = null;
    try {
        info = describeRoom(code);
    } catch (error) {
        console.error('❌ Erreur aperçu d’invitation:', error);
    }

    res.set({
        'Content-Type': 'text/html; charset=utf-8',
        // L'aperçu suit l'état de la salle (joueurs, partie lancée) : pas de cache chez nous
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, follow',
    });
    return res.status(200).send(renderPage({ code, lang, preview: buildPreview(code, info, lang) }));
});

module.exports = router;
module.exports._private = { buildPreview, describeRoom, renderPage, escapeHtml };
