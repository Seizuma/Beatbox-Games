// server/services/reactions.js
//
// Réactions rapides en partie : six émojis prédéfinis, sans texte libre, donc
// rien à modérer. Le serveur ne relaie que les identifiants connus et limite
// le débit par joueur pour qu'un doigt nerveux ne noie pas l'écran des autres.

const REACTIONS = ['clap', 'fire', 'laugh', 'shock', 'mind', 'mic'];
const MIN_INTERVAL_MS = 900;

const isReaction = (id) => REACTIONS.includes(id);

/** Vrai si ce joueur peut réagir maintenant ; note l'instant sur la socket. */
function allowReaction(socket) {
    const now = Date.now();
    const last = (socket.data && socket.data.lastReactionAt) || 0;
    if (now - last < MIN_INTERVAL_MS) return false;
    socket.data.lastReactionAt = now;
    return true;
}

module.exports = { REACTIONS, isReaction, allowReaction };
