/**
 * Revue des données collectées automatiquement : photos du Buzzer Battle et
 * titres du Beatboxdle. Monté sous /api/admin/review.
 *
 * C'est la dernière étape des pipelines : les scripts proposent, un
 * administrateur dispose. Rien de ce que les robots ramènent n'atteint les
 * jeux sans passer par ici.
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const { requireAdmin } = require('../middleware/adminAuth');
const { getDatabase } = require('../services/database');
const photoReview = require('../services/photo-review');
const titleReview = require('../services/title-review');

const router = express.Router();

// --- Images signées ------------------------------------------------------------
// Une balise <img> n'envoie pas l'en-tête Authorization. Plutôt que de passer
// le jeton Discord dans l'URL (il finirait dans les journaux), la liste
// renvoie des URL signées valables une heure. La clé change à chaque
// démarrage : une page restée ouverte pendant un redéploiement se recharge.
const SIGNING_KEY = crypto.randomBytes(32);
const URL_TTL_MS = 60 * 60 * 1000;

const signature = (key, file, expires) =>
    crypto.createHmac('sha256', SIGNING_KEY).update(`${key}/${file}/${expires}`).digest('base64url');

function signedFileUrl(key, file) {
    const expires = Date.now() + URL_TTL_MS;
    const query = new URLSearchParams({ exp: String(expires), sig: signature(key, file, expires) });
    return `/api/admin/review/photos/${encodeURIComponent(key)}/files/${encodeURIComponent(file)}?${query}`;
}

router.get('/photos/:key/files/:file', (req, res) => {
    const { key, file } = req.params;
    const expires = Number(req.query.exp);
    const expected = signature(key, file, expires);
    const given = String(req.query.sig || '');

    const valid = expires > Date.now()
        && given.length === expected.length
        && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
    if (!valid) return res.status(404).end();

    try {
        const filePath = photoReview.candidatePath(key, file);
        if (!fs.existsSync(filePath)) return res.status(404).end();
        res.setHeader('Cache-Control', 'private, max-age=3600');
        return res.sendFile(filePath);
    } catch (error) {
        return res.status(404).end();
    }
});

// Tout le reste exige un administrateur.
router.use(requireAdmin);

const reviewer = (req) => req.user?.username || req.user?.discordId || 'admin';

function logAdmin(req, message, context) {
    try {
        getDatabase().logEvent({ level: 'info', type: 'admin', message, discordId: req.user?.discordId, context });
    } catch (error) {
        // Le journal est un plus : une écriture ratée ne doit pas annuler l'action.
    }
}

/** Enveloppe commune : erreurs métier en 4xx, le reste en 500. */
const handle = (label, action) => async (req, res) => {
    try {
        res.json({ success: true, ...(await action(req)) });
    } catch (error) {
        if (error instanceof photoReview.HttpError) {
            return res.status(error.status).json({ success: false, error: error.code });
        }
        console.error(`❌ ${label}:`, error);
        return res.status(500).json({ success: false, error: 'server_error' });
    }
};

const pageParams = (req) => ({
    offset: Math.max(0, parseInt(req.query.offset, 10) || 0),
    limit: Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 50),
    query: String(req.query.q || '').slice(0, 60),
    nationality: String(req.query.nationality || '').slice(0, 120),
    event: String(req.query.event || '').slice(0, 200),
});

// --- Photos du Buzzer Battle -------------------------------------------------------

router.get('/photos/summary', handle('Résumé photos', () => ({ summary: photoReview.summary() })));

// Nations et événements disponibles comme filtres, pour un statut donné
router.get('/photos/facets', handle('Filtres photos', (req) => {
    const { nationality, event } = pageParams(req);
    return { facets: photoReview.facets({ status: String(req.query.status || 'pending'), nationality, event }) };
}));

const withSignedUrls = (item) => ({
    ...item,
    candidates: item.candidates.map((candidate) => ({ ...candidate, src: signedFileUrl(item.key, candidate.file) })),
});

router.get('/photos', handle('Liste photos', (req) => {
    const page = photoReview.list({ status: String(req.query.status || 'pending'), ...pageParams(req) });
    return { ...page, items: page.items.map(withSignedUrls) };
}));

// Après summary : sinon « summary » serait pris pour une clé de fiche.
router.get('/photos/:key', handle('Fiche photo', (req) => ({ item: withSignedUrls(photoReview.get(req.params.key)) })));

// Image envoyée depuis le disque : corps binaire brut (Content-Type image/*),
// le nom d'origine en en-tête. Pas de multipart, donc pas de dépendance.
router.post(
    '/photos/:key/upload',
    express.raw({ type: 'image/*', limit: '15mb' }),
    handle('Envoi de photo', async (req) => {
        let filename = String(req.headers['x-filename'] || '');
        try { filename = decodeURIComponent(filename); } catch (error) { /* nom illisible : gardé tel quel */ }
        const { candidate } = await photoReview.addCandidateFromUpload(req.params.key, req.body, filename);
        return { candidate: { ...candidate, src: signedFileUrl(req.params.key, candidate.file) } };
    }),
);

router.post('/photos/:key/group', handle('Groupe', (req) => {
    const value = req.body?.group;
    if (![true, false, null].includes(value)) throw new photoReview.HttpError(400, 'invalid_choice');
    return { item: withSignedUrls(photoReview.setGroup(req.params.key, value)) };
}));

router.post('/photos/:key/candidates/:candidateId/clean', handle('Effacement du texte', (req) => {
    const result = photoReview.requestTextCleaning(req.params.key, req.params.candidateId, {
        auto: req.body?.auto !== false,
        boxes: req.body?.boxes,
    }, reviewer(req));
    return { result };
}));

router.post('/photos/:key/approve', handle('Validation photo', async (req) => {
    const result = await photoReview.approve(req.params.key, String(req.body?.candidateId || ''), reviewer(req));
    logAdmin(req, `Photo Buzzer validée pour ${result.name} par ${reviewer(req)}`, result);
    return { result };
}));

router.post('/photos/:key/reject', handle('Rejet photo', async (req) => {
    const result = await photoReview.reject(req.params.key, reviewer(req));
    logAdmin(req, `Photos Buzzer rejetées pour ${result.name} par ${reviewer(req)}`, result);
    return { result };
}));

router.post('/photos/:key/reopen', handle('Réouverture photo', async (req) => {
    const result = await photoReview.reopen(req.params.key, reviewer(req));
    logAdmin(req, `Revue photo de ${result.name} rouverte par ${reviewer(req)}`, result);
    return { result };
}));

router.post('/photos/:key/candidates', handle('Ajout photo', async (req) => {
    const { candidate } = await photoReview.addCandidateFromUrl(req.params.key, String(req.body?.url || ''));
    return { candidate: { ...candidate, src: signedFileUrl(req.params.key, candidate.file) } };
}));

// --- Titres du Beatboxdle --------------------------------------------------------

router.get('/titles/summary', handle('Résumé titres', () => ({ summary: titleReview.summary() })));

router.get('/titles', handle('Liste titres', (req) => titleReview.list({
    filter: String(req.query.filter || 'todo'),
    ...pageParams(req),
})));

router.post('/titles/bulk', handle('Validation groupée', (req) => {
    const results = titleReview.decideMany(req.body?.slugs, reviewer(req));
    logAdmin(req, `${results.length} titres Beatboxdle validés par ${reviewer(req)}`, { slugs: results.map((r) => r.slug) });
    return { results };
}));

router.post('/titles/rebuild', handle('Reconstruction Beatboxdle', (req) => {
    const result = titleReview.rebuild({ force: req.body?.force === true });
    if (result.ok) {
        logAdmin(req, `Base Beatboxdle reconstruite par ${reviewer(req)} (${result.changedTitles} titres modifiés)`, {
            count: result.count,
            reviewedCount: result.reviewedCount,
            drawChanged: result.drawChanged,
        });
    }
    return { result };
}));

// Quand le tirage doit changer : reconstruction au prochain minuit.
router.post('/titles/rebuild/schedule', handle('Programmation Beatboxdle', (req) => {
    const result = titleReview.scheduleRebuild(reviewer(req));
    logAdmin(req, `Reconstruction Beatboxdle programmée pour ${result.at} par ${reviewer(req)}`, result);
    return { result };
}));

router.delete('/titles/rebuild/schedule', handle('Annulation programmation', (req) => {
    logAdmin(req, `Reconstruction Beatboxdle programmée annulée par ${reviewer(req)}`, null);
    return { result: titleReview.cancelSchedule() };
}));

router.post('/titles/:slug/decision', handle('Décision titre', (req) => {
    // fixes : champs complétés acceptés (genre, première apparition, pays) ; absent = tous.
    const fixes = Array.isArray(req.body?.fixes) ? req.body.fixes.map(String) : null;
    const result = titleReview.decide(req.params.slug, String(req.body?.choice || ''), reviewer(req), fixes);
    return { result };
}));

router.delete('/titles/:slug/decision', handle('Annulation décision', (req) => ({ result: titleReview.undo(req.params.slug) })));

module.exports = router;
