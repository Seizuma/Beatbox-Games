// server/services/beatboxdle-dataset.js
//
// Chargement et indexation de la base Beatboxdle produite par
// scripts/beatboxdle/build.js. Le fichier vit dans beatbox_artists/, donc hors
// git et monté par docker compose : le jeu doit savoir se taire proprement
// quand il n'est pas là plutôt que de faire tomber le serveur au démarrage.

const fs = require('fs');
const path = require('path');
const { normalize } = require('../utils');

class BeatboxdleDataset {
    constructor() {
        this.filePath = path.join(process.cwd(), 'beatbox_artists', 'beatboxdle', 'beatboxdle.json');
        this.beatboxers = [];
        this.byName = new Map();
        this.bySlug = new Map();
        this.loadedAt = null;
        this.error = null;
        this.load();
    }

    load() {
        try {
            if (!fs.existsSync(this.filePath)) {
                this.error = `Base Beatboxdle absente (${this.filePath})`;
                console.warn(`⚠️  ${this.error} — le jeu répondra 503 tant qu'elle n'est pas déposée`);
                return;
            }

            const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            this.beatboxers = raw.beatboxers || [];
            this.byName.clear();
            this.bySlug.clear();

            this.beatboxers.forEach((beatboxer) => {
                this.bySlug.set(beatboxer.slug, beatboxer);
                // normalize() vient des utilitaires du serveur : même tolérance
                // aux accents et à la ponctuation que le Blind Test.
                this.byName.set(normalize(beatboxer.name), beatboxer);
            });

            this.loadedAt = Date.now();
            this.error = null;
            console.log(`🎯 Beatboxdle : ${this.beatboxers.length} beatboxers chargés (v${raw.version}, ${raw.generatedAt})`);
        } catch (error) {
            this.error = `Base Beatboxdle illisible : ${error.message}`;
            console.error(`❌ ${this.error}`);
        }
    }

    reload() {
        this.load();
        return this.getStatus();
    }

    isReady() {
        return this.beatboxers.length > 0;
    }

    getStatus() {
        return {
            ready: this.isReady(),
            count: this.beatboxers.length,
            loadedAt: this.loadedAt,
            error: this.error,
        };
    }

    /** Beatboxers jouables dans un mode donné ('letters' ou 'clues'). */
    forMode(mode) {
        return this.beatboxers.filter((beatboxer) => beatboxer.modes.includes(mode));
    }

    findBySlug(slug) {
        return this.bySlug.get(slug) || null;
    }

    /** Retrouve un beatboxer à partir de ce que le joueur a tapé. */
    findByName(input) {
        return this.byName.get(normalize(input)) || null;
    }

    /**
     * Liste des propositions acceptées pour un mode.
     * En mode lettres, seuls les noms de la bonne longueur sont proposables :
     * c'est ce qui rend la grille lisible, comme sur Wordle.
     */
    candidates(mode, { length = null } = {}) {
        return this.forMode(mode)
            .filter((beatboxer) => (length ? beatboxer.length === length : true))
            .map((beatboxer) => beatboxer.name)
            .sort((a, b) => a.localeCompare(b, 'fr'));
    }
}

module.exports = new BeatboxdleDataset();