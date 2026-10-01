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
        items: entries.slice(offset, offset + limit).map(toListItem),
    };
}

/** Une fiche, dans le même format que list() : sert au rafraîchissement pendant un nettoyage. */
function get(key) {
    const entry = readEntry(key);
    if (!entry) throw new HttpError(404, 'entry_not_found');
    return toListItem(entry);
}

/**
 * Duo, tag team ou crew : plusieurs visages attendus sur la photo.
 * Détecté par collect.js (beatbox.world, wiki, nom « A & B »), corrigeable
 * dans l'administration (groupOverride).
 */
function groupInfo(entry) {
    const override = typeof entry.groupOverride === 'boolean' ? entry.groupOverride : null;
    const active = override !== null ? override : Boolean(entry.group);
    const size = active ? Math.max(2, (entry.group?.members || []).length) : 0;
    // Les fiches analysées avant la prise en compte des groupes l'ont été en solo.
    const analysed = (entry.candidates || []).some((candidate) => candidate.faceChecked);
    const analysedSize = analysed ? entry.facesGroupSize ?? 0 : size;
    return {
        active,
        size,
        override,
        kind: entry.group?.kind || null,
        members: entry.group?.members || [],
        detectedBy: entry.group?.source || null,
        // faces.py a tourné avec un autre réglage : ses recadrages ne collent plus.
        needsRecheck: analysedSize !== size,
    };
}

/**
 * Candidates à montrer, dans l'ordre. Quand faces.py a analysé la fiche
 * comme un solo alors que c'est un groupe (ou l'inverse), on corrige ici en
 * attendant une réanalyse : recadrages du mauvais type masqués, photos à
 * plusieurs visages remontées.
 */
function rankedCandidates(entry, group) {
    const candidates = visibleCandidates(entry);
    if (!group.needsRecheck) return candidates;

    const hiddenKind = group.active ? 'face-crop' : 'group-crop';
    const adjust = (candidate) => {
        if (!group.active || candidate.faces == null) return 0;
        if (candidate.faces >= 2) return 0.2;
        return candidate.faces === 1 ? -0.25 : 0;
    };
    return candidates
        .filter((candidate) => candidate.kind !== hiddenKind)
        .map((candidate) => ({ ...candidate, confidence: Math.round(((candidate.confidence || 0) + adjust(candidate)) * 100) / 100 }))
        .sort((a, b) => b.confidence - a.confidence);
}

/** Marque une fiche comme groupe (true), solo (false), ou revient à la détection (null). */
function setGroup(key, value) {
    const entry = readEntry(key);
    if (!entry) throw new HttpError(404, 'entry_not_found');
    if (value === null) delete entry.groupOverride;
    else entry.groupOverride = Boolean(value);
    writeEntry(entry);
    return toListItem(entry);
}

function toListItem(entry) {
    const group = groupInfo(entry);
    return {
        group,
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
        candidates: rankedCandidates(entry, group).map((candidate) => ({
            id: candidate.id,
            source: candidate.source,
            kind: candidate.kind,
            parent: candidate.parent || null,
            file: candidate.file,
            page: candidate.page || null,
            width: candidate.width || null,
            height: candidate.height || null,
            confidence: candidate.confidence || 0,
            faces: candidate.faces ?? null,
            note: candidate.note || null,
            cleaning: cleaningState(entry.key, candidate.id),
        })),
    };
}

// --- Effacement du texte ---------------------------------------------------------
// Le serveur ne fait que déposer la demande : scripts/photos/clean_text.py,
// lancé sur l'hôte en mode veille, la traite et ajoute l'image nettoyée.

const CANDIDATE_ID_RE = /^[\w-]{1,100}$/;
const cleanRequestFile = (candidateId) => `clean-${candidateId}.request.json`;
const cleanErrorFile = (candidateId) => `clean-${candidateId}.error.json`;

/** null, { status: 'queued', requestedAt } ou { status: 'error', error }. */
function cleaningState(key, candidateId) {
    if (!CANDIDATE_ID_RE.test(String(candidateId || ''))) return null;
    const dir = entryDir(key);
    const request = path.join(dir, cleanRequestFile(candidateId));
    if (fs.existsSync(request)) {
        try {
            return { status: 'queued', requestedAt: JSON.parse(fs.readFileSync(request, 'utf8')).requestedAt || null };
        } catch (error) {
            return { status: 'queued', requestedAt: null };
        }
    }
    const failure = path.join(dir, cleanErrorFile(candidateId));
    if (fs.existsSync(failure)) {
        try {
            return { status: 'error', error: JSON.parse(fs.readFileSync(failure, 'utf8')).error || null };
        } catch (error) {
            return { status: 'error', error: null };
        }
    }
    return null;
}

/**
 * Demande l'effacement du texte d'une candidate.
 * @param {{ auto?: boolean, boxes?: Array<{x,y,w,h}> }} options zones en coordonnées relatives (0-1)
 */
function requestTextCleaning(key, candidateId, { auto = true, boxes = [] } = {}, reviewer) {
    if (!CANDIDATE_ID_RE.test(String(candidateId || ''))) throw new HttpError(400, 'invalid_candidate');
    const entry = readEntry(key);
    if (!entry) throw new HttpError(404, 'entry_not_found');
    if (entry.status !== 'pending') throw new HttpError(409, 'already_reviewed');
    if (!visibleCandidates(entry).some((candidate) => candidate.id === candidateId)) {
        throw new HttpError(404, 'candidate_not_found');
    }

    const inUnit = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
    const cleanBoxes = (Array.isArray(boxes) ? boxes : [])
        .slice(0, 30)
        .filter((box) => box && inUnit(box.x) && inUnit(box.y) && inUnit(box.w) && inUnit(box.h) && box.w > 0 && box.h > 0)
        .map(({ x, y, w, h }) => ({ x, y, w, h }));
    if (!auto && cleanBoxes.length === 0) throw new HttpError(400, 'nothing_to_clean');

    const dir = entryDir(key);
    const failure = path.join(dir, cleanErrorFile(candidateId));
    if (fs.existsSync(failure)) fs.unlinkSync(failure);
    const request = { candidateId, auto: Boolean(auto), boxes: cleanBoxes, requestedAt: new Date().toISOString(), requestedBy: reviewer };
    writeJsonAtomic(path.join(dir, cleanRequestFile(candidateId)), request);
    return { key, candidateId, cleaning: { status: 'queued', requestedAt: request.requestedAt } };
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
    get,
    setGroup,
    requestTextCleaning,
    approve,
    reject,
    reopen,
    addCandidateFromUrl,
};
