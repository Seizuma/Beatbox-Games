// server/services/photo-review.js
//
// Revue humaine des photos du Buzzer Battle.
//
// scripts/photos/collect.js dépose, pour chaque beatboxer sans photo, un
// dossier review/photos/<clé>/ contenant les images candidates et un
// entry.json qui les décrit. Ce module est la seule porte de sortie vers le
// jeu : valider une candidate la copie dans beatbox_artists/, renseigne
// `local_image` dans beatboxers.json et recharge le Buzzer Battle.
//
// Un dossier par beatboxer plutôt qu'un gros fichier : la collecte peut
// tourner pendant qu'un administrateur valide, sans qu'aucun des deux
// n'écrase le travail de l'autre.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeName, titleToFilename } = require('../scripts/shared/names');
const { imageSize } = require('../scripts/shared/http');

const ARTISTS_DIR = path.join(__dirname, '..', 'beatbox_artists');
const DATA_FILE = path.join(ARTISTS_DIR, 'beatboxers.json');
const PHOTOS_DIR = path.join(ARTISTS_DIR, 'review', 'photos');
const REPLACED_DIR = path.join(ARTISTS_DIR, 'review', 'replaced');

const ENTRY_FILE = 'entry.json';
const KEY_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;
const FILE_RE = /^[a-z0-9][\w.-]{0,120}$/i;
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const STATUSES = ['pending', 'approved', 'rejected'];

// --- Écritures sûres --------------------------------------------------------

/** Écrit via un fichier temporaire puis renomme : jamais de JSON à moitié écrit. */
function writeJsonAtomic(file, data) {
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fs.renameSync(temp, file);
}

// Les validations touchent toutes beatboxers.json : on les sérialise pour
// que deux clics simultanés ne perdent pas l'une des deux écritures.
let chain = Promise.resolve();
function exclusive(task) {
    const run = chain.then(task);
    chain = run.catch(() => {});
    return run;
}

class HttpError extends Error {
    constructor(status, code) {
        super(code);
        this.status = status;
        this.code = code;
    }
}

// --- Accès aux entrées ------------------------------------------------------

/** Clé de dossier : stable, sûre dans un chemin, unique même entre « D-Low » et « D Low ». */
function entryKey(name) {
    const base = String(name || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    const hash = crypto.createHash('sha1').update(String(name)).digest('hex').slice(0, 6);
    return base ? `${base}-${hash}` : `x-${hash}`;
}

function entryDir(key) {
    if (!KEY_RE.test(String(key || ''))) throw new HttpError(400, 'invalid_key');
    return path.join(PHOTOS_DIR, key);
}

function readEntry(key) {
    const file = path.join(entryDir(key), ENTRY_FILE);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeEntry(entry) {
    const dir = entryDir(entry.key);
    fs.mkdirSync(dir, { recursive: true });
    writeJsonAtomic(path.join(dir, ENTRY_FILE), entry);
}

function listEntries() {
    if (!fs.existsSync(PHOTOS_DIR)) return [];
    return fs.readdirSync(PHOTOS_DIR, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory() && KEY_RE.test(dirent.name))
        .map((dirent) => {
            try {
                return readEntry(dirent.name);
            } catch (error) {
                console.warn(`⚠️  Entrée photo illisible : ${dirent.name} (${error.message})`);
                return null;
            }
        })
        .filter(Boolean);
}

/** Candidates encore affichables (fichier présent, pas écartées par faces.py). */
const visibleCandidates = (entry) =>
    (entry.candidates || []).filter((candidate) => !candidate.discarded && candidate.file);

/** Chemin d'un fichier candidat, en refusant tout ce qui sortirait du dossier. */
function candidatePath(key, file) {
    if (!FILE_RE.test(String(file || '')) || file === ENTRY_FILE) throw new HttpError(400, 'invalid_file');
    const dir = entryDir(key);
    const resolved = path.resolve(dir, file);
    if (path.dirname(resolved) !== path.resolve(dir)) throw new HttpError(400, 'invalid_file');
    return resolved;
}

// --- Lecture pour l'administration -----------------------------------------

function summary() {
    const entries = listEntries();
    const count = (status) => entries.filter((entry) => entry.status === status).length;
    const pending = entries.filter((entry) => entry.status === 'pending');
    return {
        total: entries.length,
        pending: count('pending'),
        approved: count('approved'),
        rejected: count('rejected'),
        pendingWithCandidates: pending.filter((entry) => visibleCandidates(entry).length > 0).length,
        pendingEmpty: pending.filter((entry) => visibleCandidates(entry).length === 0).length,
        facesChecked: pending.some((entry) => (entry.candidates || []).some((candidate) => candidate.faceChecked)),
    };
}

/**
 * Page d'entrées pour l'écran de revue.
 * Ordre : celles qui ont le plus de chances d'être validées d'un clic d'abord
 * (meilleure confiance), les entrées sans candidate en dernier.
 */
function list({ status = 'pending', offset = 0, limit = 20, query = '' } = {}) {
    const wanted = STATUSES.includes(status) ? status : 'pending';
    const needle = normalizeName(query);
    const best = (entry) => Math.max(0, ...visibleCandidates(entry).map((candidate) => candidate.confidence || 0));

    const entries = listEntries()
        .filter((entry) => entry.status === wanted)
        .filter((entry) => !needle || normalizeName(entry.name).includes(needle))
        .sort((a, b) => {
            if (wanted !== 'pending') return String(b.reviewedAt || '').localeCompare(String(a.reviewedAt || ''));
            return best(b) - best(a) || a.name.localeCompare(b.name);
        });

    return {
        total: entries.length,
        offset,
        items: entries.slice(offset, offset + limit).map((entry) => ({
            key: entry.key,
            name: entry.name,
            nationality: entry.nationality || null,
            countryCode: entry.countryCode || null,
            events: (entry.events || []).slice(0, 6),
            status: entry.status,
            sources: entry.sources || {},
            reviewedAt: entry.reviewedAt || null,
            reviewedBy: entry.reviewedBy || null,
            approvedCandidate: entry.approvedCandidate || null,
            approvedFile: entry.approvedFile || null,
            candidates: visibleCandidates(entry).map((candidate) => ({
                id: candidate.id,
                source: candidate.source,
                kind: candidate.kind,
                file: candidate.file,
                page: candidate.page || null,
                width: candidate.width || null,
                height: candidate.height || null,
                confidence: candidate.confidence || 0,
                faces: candidate.faces ?? null,
                note: candidate.note || null,
            })),
        })),
    };
}

// --- beatboxers.json ---------------------------------------------------------

function readBuzzerData() {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function findBuzzerEntry(list, name) {
    return list.find((item) => item.title === name)
        || list.find((item) => normalizeName(item.title) === normalizeName(name))
        || null;
}

/** Fichiers d'image déjà présents pour ce nom de base, toutes extensions confondues. */
function existingImages(baseName) {
    return IMAGE_EXTENSIONS
        .map((extension) => `${baseName}${extension}`)
        .filter((file) => fs.existsSync(path.join(ARTISTS_DIR, file)));
}

function reloadBuzzer() {
    try {
        require('./buzzer-beatboxerManager').loadData();
    } catch (error) {
        console.warn('⚠️  Rechargement du Buzzer Battle impossible :', error.message);
    }
}

// --- Actions -----------------------------------------------------------------

/**
 * Valide une candidate : copie dans beatbox_artists/ sous le nom attendu par
 * scan_images.py, puis renseigne local_image. Une image déjà présente sous ce
 * nom est mise de côté dans review/replaced/, jamais supprimée.
 */
function approve(key, candidateId, reviewer) {
    return exclusive(() => {
        const entry = readEntry(key);
        if (!entry) throw new HttpError(404, 'entry_not_found');
        if (entry.status !== 'pending') throw new HttpError(409, 'already_reviewed');

        const candidate = visibleCandidates(entry).find((item) => item.id === candidateId);
        if (!candidate) throw new HttpError(404, 'candidate_not_found');
        const source = candidatePath(key, candidate.file);
        if (!fs.existsSync(source)) throw new HttpError(410, 'candidate_file_missing');

        const extension = path.extname(candidate.file).toLowerCase() || '.jpg';
        const baseName = titleToFilename(entry.name);
        const fileName = `${baseName}${extension}`;

        const replaced = [];
        existingImages(baseName).forEach((file) => {
            fs.mkdirSync(REPLACED_DIR, { recursive: true });
            const backup = `${Date.now()}-${file}`;
            fs.renameSync(path.join(ARTISTS_DIR, file), path.join(REPLACED_DIR, backup));
            replaced.push({ file, backup });
        });
        fs.copyFileSync(source, path.join(ARTISTS_DIR, fileName));

        const data = readBuzzerData();
        let target = findBuzzerEntry(data, entry.name);
        const created = !target;
        if (!target) {
            // Nom présent dans le Sheet mais pas encore dans le JSON : même forme
            // que les entrées produites par SheetReader.py.
            target = {
                title: entry.name,
                nationality: entry.nationality || '',
                local_image: '',
                achievements: (entry.events || []).map((event) => ({ event })),
            };
            data.push(target);
            data.sort((a, b) => a.title.localeCompare(b.title));
        }
        const previousImage = target.local_image || '';
        target.local_image = fileName;
        writeJsonAtomic(DATA_FILE, data);

        Object.assign(entry, {
            status: 'approved',
            approvedCandidate: candidate.id,
            approvedFile: fileName,
            previousImage,
            createdInDataFile: created,
            replaced,
            reviewedAt: new Date().toISOString(),
            reviewedBy: reviewer,
        });
        writeEntry(entry);
        reloadBuzzer();

        return { key, name: entry.name, file: fileName, created };
    });
}

function reject(key, reviewer) {
    return exclusive(() => {
        const entry = readEntry(key);
        if (!entry) throw new HttpError(404, 'entry_not_found');
        if (entry.status !== 'pending') throw new HttpError(409, 'already_reviewed');
        Object.assign(entry, { status: 'rejected', reviewedAt: new Date().toISOString(), reviewedBy: reviewer });
        writeEntry(entry);
        return { key, name: entry.name };
    });
}

/**
 * Annule une décision. Pour une validation, retire l'image copiée et restaure
 * l'état précédent de beatboxers.json — mais seulement si personne n'a
 * changé l'image entre-temps.
 */
function reopen(key, reviewer) {
    return exclusive(() => {
        const entry = readEntry(key);
        if (!entry) throw new HttpError(404, 'entry_not_found');
        if (entry.status === 'pending') return { key, name: entry.name };

        if (entry.status === 'approved' && entry.approvedFile) {
            const data = readBuzzerData();
            const target = findBuzzerEntry(data, entry.name);
            if (target && target.local_image === entry.approvedFile) {
                if (entry.createdInDataFile) {
                    data.splice(data.indexOf(target), 1);
                } else {
                    target.local_image = entry.previousImage || '';
                }
                writeJsonAtomic(DATA_FILE, data);

                const copied = path.join(ARTISTS_DIR, entry.approvedFile);
                if (fs.existsSync(copied)) fs.unlinkSync(copied);
                (entry.replaced || []).forEach(({ file, backup }) => {
                    const from = path.join(REPLACED_DIR, backup);
                    if (fs.existsSync(from)) fs.renameSync(from, path.join(ARTISTS_DIR, file));
                });
                reloadBuzzer();
            }
        }

        ['approvedCandidate', 'approvedFile', 'previousImage', 'createdInDataFile', 'replaced'].forEach((field) => {
            delete entry[field];
        });
        Object.assign(entry, { status: 'pending', reviewedAt: new Date().toISOString(), reviewedBy: reviewer });
        writeEntry(entry);
        return { key, name: entry.name };
    });
}

/**
 * Ajoute une candidate à partir d'une URL d'image trouvée à la main.
 * Réservé aux administrateurs ; on vérifie tout de même que c'est bien une
 * image de taille raisonnable avant de l'écrire.
 */
async function addCandidateFromUrl(key, url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch (error) {
        throw new HttpError(400, 'invalid_url');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new HttpError(400, 'invalid_url');

    const response = await fetch(parsed, {
        headers: { 'User-Agent': 'BeatBoxGamesBot/1.0 (+https://beatboxgames.com)', Accept: 'image/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    if (!response || !response.ok) throw new HttpError(502, 'download_failed');

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 15 * 1024 * 1024) throw new HttpError(413, 'image_too_large');
    const size = imageSize(buffer);
    if (!size) throw new HttpError(415, 'not_an_image');

    return exclusive(() => {
        const entry = readEntry(key);
        if (!entry) throw new HttpError(404, 'entry_not_found');

        const id = `manual-${Date.now().toString(36)}`;
        const file = `${id}.${size.type === 'jpeg' ? 'jpg' : size.type}`;
        fs.writeFileSync(candidatePath(key, file), buffer);
        entry.candidates = [
            {
                id,
                source: 'manual',
                kind: 'url',
                file,
                url: parsed.toString(),
                page: parsed.toString(),
                width: size.width,
                height: size.height,
                bytes: buffer.length,
                confidence: 1,
            },
            ...(entry.candidates || []),
        ];
        writeEntry(entry);
        return { key, candidate: entry.candidates[0] };
    });
}

module.exports = {
    PHOTOS_DIR,
    HttpError,
    entryKey,
    readEntry,
    writeEntry,
    writeJsonAtomic,
    listEntries,
    candidatePath,
    summary,
    list,
    approve,
    reject,
    reopen,
    addCandidateFromUrl,
};
