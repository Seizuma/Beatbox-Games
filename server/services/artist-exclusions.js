// server/services/artist-exclusions.js
//
// Artistes désactivés dans tous les jeux, gérés depuis /admin → Artistes.
//
// Les trois jeux nomment leurs artistes chacun à sa façon : nom de fichier
// audio pour le Blind Test (« Level 1 - Max0.mp3 »), titre de beatboxers.json
// pour le Buzzer Battle, nom beatbox.world pour le Beatboxdle (« MaxO »).
// L'exclusion est donc indexée par nom normalisé, à 0/O et 1/l près :
// désactiver « Max0 » désactive aussi « MaxO » et « MAX0 ».
//
// Stockage : beatbox_artists/excluded-artists.json (monté par docker compose,
// donc conservé entre les déploiements, et lisible par les scripts).

const fs = require('fs');
const path = require('path');
const { looseName } = require('../scripts/shared/names');

const FILE = path.join(__dirname, '..', 'beatbox_artists', 'excluded-artists.json');

let cache = { mtimeMs: -1, entries: new Map() };
const listeners = new Set();

const keyOf = (name) => looseName(name);

function load() {
    let mtimeMs = 0;
    try {
        mtimeMs = fs.statSync(FILE).mtimeMs;
    } catch (error) {
        // Pas de fichier : personne n'est exclu.
    }
    if (mtimeMs === cache.mtimeMs) return cache.entries;

    let entries = [];
    if (mtimeMs) {
        try {
            entries = JSON.parse(fs.readFileSync(FILE, 'utf8')).artists || [];
        } catch (error) {
            console.error(`❌ ${FILE} illisible, aucune exclusion appliquée :`, error.message);
        }
    }
    cache = { mtimeMs, entries: new Map(entries.map((entry) => [entry.key, entry])) };
    return cache.entries;
}

function save(entries) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const artists = [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const temp = `${FILE}.${process.pid}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify({ updatedAt: new Date().toISOString(), artists }, null, 2)}\n`, 'utf8');
    fs.renameSync(temp, FILE);
    cache = { mtimeMs: -1, entries: new Map() };
}

/** L'artiste est-il désactivé ? Accepte n'importe quelle graphie du nom. */
function isExcluded(name) {
    const key = keyOf(name);
    return Boolean(key) && load().has(key);
}

function list() {
    return [...load().values()];
}

/** Abonnement des jeux : chacun se remet à jour quand la liste change. */
function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notify(change) {
    const reports = [];
    listeners.forEach((listener) => {
        try {
            const report = listener(change);
            if (report) reports.push(report);
        } catch (error) {
            console.error('❌ Mise à jour après exclusion :', error.message);
        }
    });
    return reports;
}

/**
 * Désactive un artiste partout.
 * @returns {{ entry: object, effects: object[] }} effects : ce que chaque jeu a dû faire
 */
function exclude(name, { reason = '', by = 'admin' } = {}) {
    const clean = String(name || '').trim().slice(0, 100);
    const key = keyOf(clean);
    if (!key) throw Object.assign(new Error('invalid_name'), { status: 400 });

    const entries = new Map(load());
    const entry = entries.get(key) || { key, name: clean, at: new Date().toISOString(), by };
    entry.reason = String(reason || '').trim().slice(0, 200);
    entries.set(key, entry);

    // Les jeux mesurent l'impact avant/après : ils ont besoin de l'état d'avant.
    const before = new Set(load().keys());
    save(entries);
    return { entry, effects: notify({ type: 'exclude', key, name: clean, before }) };
}

function include(key) {
    const entries = new Map(load());
    const entry = entries.get(key);
    if (!entry) return { entry: null, effects: [] };
    const before = new Set(entries.keys());
    entries.delete(key);
    save(entries);
    return { entry, effects: notify({ type: 'include', key, name: entry.name, before }) };
}

module.exports = { FILE, keyOf, isExcluded, list, exclude, include, onChange };
