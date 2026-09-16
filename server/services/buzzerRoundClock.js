// server/services/buzzerRoundClock.js
//
// Horloge de manche du Buzzer Battle.
//
// Pourquoi ce module : l'ancienne progression envoyait un `pixelUpdate` toutes les 20 ms
// (50 messages par seconde et par salle) et enchaînait les transitions par setTimeout.
// Deux conséquences : sur une connexion lente, Socket.IO mettait les messages en tampon puis
// les livrait d'un coup (photo dévoilée instantanément), et une annulation de timer au mauvais
// moment laissait la manche sans aucun timer actif (manche bloquée pour toujours).
//
// Ici :
// - la progression est calculée à partir du temps écoulé, jamais accumulée tick par tick ;
// - la synchro part 2 fois par seconde, le client interpole entre deux points ;
// - chaque manche porte un identifiant : un timer d'une manche passée ne peut rien déclencher ;
// - un chien de garde termine la manche quoi qu'il arrive.

const TIMINGS = {
    REVEAL_MS: 20000,      // durée du dévoilement complet de la photo
    FULL_REVEAL_MS: 3000,  // fenêtre pour buzzer une fois la photo nette
    ANSWER_MS: 10000,      // temps de réponse après un buzz
    SYNC_MS: 500,          // fréquence des messages de synchro
    WATCHDOG_MARGIN_MS: 5000,
};

// Durée maximale absolue d'une manche : au-delà, la manche est close de force.
// On prévoit une pause de réponse par joueur au maximum, plus une marge.
const maxRoundDuration = (playerCount = 1) =>
    TIMINGS.REVEAL_MS
    + TIMINGS.FULL_REVEAL_MS
    + TIMINGS.ANSWER_MS * Math.max(1, playerCount)
    + TIMINGS.WATCHDOG_MARGIN_MS;

class BuzzerRoundClock {
    /**
     * @param {object} io instance Socket.IO
     * @param {object} handlers
     *   onFullReveal(roomCode, roundId) : la photo vient d'atteindre 100 % de netteté
     *   onRoundEnd(roomCode, roundId, reason) : la manche est close ('full-reveal' | 'answered' | 'watchdog' | 'stopped')
     */
    constructor(io, handlers = {}) {
        this.io = io;
        this.handlers = handlers;
        this.rooms = new Map();
    }

    /** Démarre une nouvelle manche et renvoie son identifiant. */
    startRound(roomCode, { playerCount = 1 } = {}) {
        this.stop(roomCode);

        const roundId = `${roomCode}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
        const state = {
            roundId,
            startedAt: Date.now(),
            elapsedMs: 0,
            pausedAt: null,
            phase: 'reveal',
            syncInterval: null,
            answerTimeout: null,
            fullRevealTimeout: null,
            watchdog: null,
        };

        this.rooms.set(roomCode, state);

        state.syncInterval = setInterval(() => this.emitSync(roomCode), TIMINGS.SYNC_MS);
        state.fullRevealTimeout = setTimeout(
            () => this.reachFullReveal(roomCode, roundId),
            TIMINGS.REVEAL_MS
        );
        state.watchdog = setTimeout(
            () => this.endRound(roomCode, roundId, 'watchdog'),
            maxRoundDuration(playerCount)
        );

        this.emitSync(roomCode);
        return roundId;
    }

    /** Part masquée, 0 (nette) à 1 (masquée), calculée sur le temps écoulé. */
    hiddenRatio(state) {
        if (!state) return 1;
        const elapsed = state.pausedAt
            ? state.elapsedMs
            : state.elapsedMs + (Date.now() - state.startedAt);
        return Math.max(0, Math.min(1, 1 - elapsed / TIMINGS.REVEAL_MS));
    }

    /** Ancien format, conservé pour les clients qui n'ont pas encore la nouvelle synchro. */
    pixelLevel(roomCode) {
        return Math.round(this.hiddenRatio(this.rooms.get(roomCode)) * 100);
    }

    emitSync(roomCode) {
        const state = this.rooms.get(roomCode);
        if (!state || state.phase === 'ended') return;

        const hidden = this.hiddenRatio(state);

        this.io.to(roomCode).emit('buzzer:roundSync', {
            roundId: state.roundId,
            phase: state.phase,
            hidden,
            paused: Boolean(state.pausedAt),
            revealMs: TIMINGS.REVEAL_MS,
            serverTime: Date.now(),
        });

        // Compatibilité : les anciens clients écoutent encore pixelUpdate
        this.io.to(roomCode).emit('buzzer:pixelUpdate', {
            pixelLevel: hidden * 100,
            maxPixelLevel: 100,
            roundId: state.roundId,
        });
    }

    /** Un joueur a buzzé : la photo se fige et le compte à rebours de réponse démarre. */
    pauseForAnswer(roomCode, { onAnswerTimeout } = {}) {
        const state = this.rooms.get(roomCode);
        if (!state || state.phase === 'ended' || state.pausedAt) return null;

        state.elapsedMs += Date.now() - state.startedAt;
        state.pausedAt = Date.now();
        state.phase = 'buzzed';

        // Le dévoilement est suspendu : son timer n'a plus de sens tant que la pause dure
        clearTimeout(state.fullRevealTimeout);
        state.fullRevealTimeout = null;

        const roundId = state.roundId;
        state.answerTimeout = setTimeout(() => {
            const current = this.rooms.get(roomCode);
            if (!current || current.roundId !== roundId) return;
            onAnswerTimeout?.(roomCode, roundId);
        }, TIMINGS.ANSWER_MS);

        this.emitSync(roomCode);
        return roundId;
    }

    /** La réponse est traitée (juste, fausse ou temps écoulé) : le dévoilement repart. */
    resume(roomCode) {
        const state = this.rooms.get(roomCode);
        if (!state || state.phase === 'ended') return;

        clearTimeout(state.answerTimeout);
        state.answerTimeout = null;

        if (!state.pausedAt) return;

        state.pausedAt = null;
        state.startedAt = Date.now();

        const remaining = Math.max(0, TIMINGS.REVEAL_MS - state.elapsedMs);
        const roundId = state.roundId;

        if (remaining === 0) {
            // La photo était déjà nette avant le buzz : on repart directement sur la fenêtre finale
            state.phase = 'full-reveal';
            state.fullRevealTimeout = setTimeout(
                () => this.endRound(roomCode, roundId, 'full-reveal'),
                TIMINGS.FULL_REVEAL_MS
            );
        } else {
            state.phase = 'reveal';
            state.fullRevealTimeout = setTimeout(
                () => this.reachFullReveal(roomCode, roundId),
                remaining
            );
        }

        this.emitSync(roomCode);
    }

    /** La photo atteint 100 % de netteté : dernière fenêtre pour buzzer. */
    reachFullReveal(roomCode, roundId) {
        const state = this.rooms.get(roomCode);
        if (!state || state.roundId !== roundId || state.phase === 'ended') return;

        state.elapsedMs = TIMINGS.REVEAL_MS;
        state.startedAt = Date.now();
        state.phase = 'full-reveal';

        this.emitSync(roomCode);
        this.handlers.onFullReveal?.(roomCode, roundId);

        clearTimeout(state.fullRevealTimeout);
        state.fullRevealTimeout = setTimeout(
            () => this.endRound(roomCode, roundId, 'full-reveal'),
            TIMINGS.FULL_REVEAL_MS
        );
    }

    /**
     * Ferme la manche. Idempotent : appelée deux fois, elle n'agit qu'une fois.
     * C'est ce verrou qui empêche les doubles passages de manche.
     */
    endRound(roomCode, roundId, reason = 'ended') {
        const state = this.rooms.get(roomCode);
        if (!state || state.roundId !== roundId || state.phase === 'ended') return false;

        state.phase = 'ended';
        this.clearTimers(state);
        this.rooms.delete(roomCode);

        this.handlers.onRoundEnd?.(roomCode, roundId, reason);
        return true;
    }

    /** Fin de manche déclenchée par une bonne réponse. */
    endCurrentRound(roomCode, reason = 'answered') {
        const state = this.rooms.get(roomCode);
        if (!state) return false;
        return this.endRound(roomCode, state.roundId, reason);
    }

    /** Arrêt sans transition (fin de partie, salle supprimée). */
    stop(roomCode) {
        const state = this.rooms.get(roomCode);
        if (!state) return;
        state.phase = 'ended';
        this.clearTimers(state);
        this.rooms.delete(roomCode);
    }

    clearTimers(state) {
        clearInterval(state.syncInterval);
        clearTimeout(state.answerTimeout);
        clearTimeout(state.fullRevealTimeout);
        clearTimeout(state.watchdog);
        state.syncInterval = null;
        state.answerTimeout = null;
        state.fullRevealTimeout = null;
        state.watchdog = null;
    }

    /** État courant, pour renvoyer la manche à un joueur qui se reconnecte. */
    snapshot(roomCode) {
        const state = this.rooms.get(roomCode);
        if (!state) return null;
        return {
            roundId: state.roundId,
            phase: state.phase,
            hidden: this.hiddenRatio(state),
            paused: Boolean(state.pausedAt),
            revealMs: TIMINGS.REVEAL_MS,
            serverTime: Date.now(),
        };
    }
}

module.exports = { BuzzerRoundClock, BUZZER_TIMINGS: TIMINGS };