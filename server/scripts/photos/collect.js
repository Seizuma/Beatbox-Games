#!/usr/bin/env node
// server/scripts/photos/collect.js
//
// Étape 1/2 — Collecte des photos candidates du Buzzer Battle.
//
// Pour chaque beatboxer sans photo (cases blanches du Google Sheet, à défaut
// entrées de beatboxers.json sans local_image), interroge :
//   1. beatbox.world  — photo de profil, vidéos liées, chaîne YouTube ;
//   2. Beatbox Wiki   — image principale de la page ;
//   3. YouTube        — photo de la chaîne, miniatures et images clés des
//                       vidéos (passées ensuite à la détection de visage).
//
// Les images atterrissent dans beatbox_artists/review/photos/<clé>/ : rien
// n'entre dans le jeu avant validation dans /admin → Données.
//
//   node scripts/photos/collect.js                      # liste du Sheet
//   node scripts/photos/collect.js --from json          # sans credentials.json
//   node scripts/photos/collect.js --limit 50
//   node scripts/photos/collect.js --names "Max0,D-Low" --force
//   node scripts/photos/collect.js --sources beatboxworld,wiki
//   node scripts/photos/collect.js --clean              # libère la place des entrées traitées
//
// Relançable à volonté : une entrée déjà collectée n'est pas retraitée
// (sauf --force), une entrée déjà validée ou rejetée n'est jamais touchée.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { createClient, imageSize } = require('../shared/http');
const { normalizeName, titleToFilename } = require('../shared/names');
const { readBattleSheet } = require('../shared/sheet');
const { codeFromEnglishName, codeFromPlaceWord } = require('../beatboxdle/countries');
const beatboxWorld = require('../sources/beatboxworld');
const wiki = require('../sources/wiki');
const youtube = require('../sources/youtube');
const review = require('../../services/photo-review');

// --- Arguments ------------------------------------------------------------------

const args = process.argv.slice(2);
const option = (name, fallback = null) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const flag = (name) => args.includes(name);

const ALL_SOURCES = ['beatboxworld', 'wiki', 'youtube'];
const options = {
    from: option('--from', fs.existsSync(config.CREDENTIALS_FILE) ? 'sheet' : 'json'),
    limit: Number(option('--limit', Infinity)),
    names: option('--names') ? option('--names').split(',').map((name) => name.trim()).filter(Boolean) : null,
    sources: (option('--sources') || ALL_SOURCES.join(',')).split(',').filter((source) => ALL_SOURCES.includes(source)),
    videos: Number(option('--videos', config.VIDEOS_PER_BEATBOXER)),
    force: flag('--force'),
    clean: flag('--clean'),
};

const client = createClient({
    cacheDir: config.CACHE_DIR,
    delayMs: config.DELAY_MS,
    hostDelays: config.HOST_DELAYS,
    userAgent: config.USER_AGENT,
});

const countryCodeOf = (nationality) => (nationality ? codeFromEnglishName(nationality) || codeFromPlaceWord(nationality) : null);

// « Andre & Ballistic », « Abdiel x Zerpa », « Black and White » : deux noms
// réunis, c'est un duo. Les noms de groupe sans séparateur (« 84 Funeral »)
// sont reconnus par beatbox.world ou le wiki, ou signalés dans l'administration.
const GROUP_NAME_RE = /\s(?:x|&|and|\+|feat\.?)\s/i;
const groupFromName = (name) => (GROUP_NAME_RE.test(name)
    ? { kind: 'tag-team', members: name.split(GROUP_NAME_RE).map((part) => part.trim()).filter(Boolean), source: 'name' }
    : null);

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const hasImageOnDisk = (name) =>
    IMAGE_EXTENSIONS.some((extension) => fs.existsSync(path.join(config.ARTISTS_DIR, `${titleToFilename(name)}${extension}`)));

// --- Liste de travail -------------------------------------------------------------

async function loadTargets() {
    const data = fs.existsSync(config.BUZZER_DATA_FILE)
        ? JSON.parse(fs.readFileSync(config.BUZZER_DATA_FILE, 'utf8'))
        : [];
    const byName = new Map(data.map((item) => [normalizeName(item.title), item]));
    const fromJson = (item) => ({
        name: item.title,
        nationality: item.nationality || null,
        events: (item.achievements || []).map((achievement) => achievement.event).filter(Boolean),
        inDataFile: true,
    });

    if (options.names) {
        return options.names.map((name) => {
            const item = byName.get(normalizeName(name));
            return item ? fromJson(item) : { name, nationality: null, events: [], inDataFile: false };
        });
    }

    if (options.from === 'sheet') {
        console.log('📄 Lecture du Google Sheet…');
        const people = await readBattleSheet({
            credentialsFile: config.CREDENTIALS_FILE,
            spreadsheetId: config.SPREADSHEET_ID,
            sheetNames: config.SHEET_NAMES,
        });
        const counts = { missing: 0, done: 0, excluded: 0 };
        people.forEach((person) => { counts[person.status] += 1; });
        console.log(`   ${people.length} noms : ${counts.missing} sans photo, ${counts.done} en vert, ${counts.excluded} en rouge (ignorés)\n`);

        return people
            .filter((person) => person.status === 'missing')
            .map((person) => {
                const item = byName.get(normalizeName(person.name));
                // Le Sheet peut être en retard sur le JSON : une photo déjà là clôt le sujet.
                if (item && item.local_image) return null;
                return item
                    ? { ...fromJson(item), events: [...new Set([...fromJson(item).events, ...person.events])] }
                    : { name: person.name, nationality: null, events: person.events, inDataFile: false };
            })
            .filter(Boolean);
    }

    return data.filter((item) => !item.local_image).map(fromJson);
}

// --- Candidates -------------------------------------------------------------------

/**
 * Télécharge une image candidate dans le dossier de l'entrée.
 * Écarte les doublons exacts (même photo sur deux sources) et les vignettes
 * trop petites pour le jeu.
 */
async function addCandidate(entry, seenHashes, { id, source, kind, urls, page, confidence, note, referer }) {
    for (const url of urls) {
        const dest = path.join(review.PHOTOS_DIR, entry.key, id);
        const result = await client.download(url, dest, { headers: referer ? { Referer: referer } : {} });
        if (!result) continue;

        const size = imageSize(result.buffer);
        const hash = crypto.createHash('sha1').update(result.buffer).digest('hex');
        const tooSmall = !size || Math.min(size.width, size.height) < config.MIN_IMAGE_SIZE;
        if (tooSmall || seenHashes.has(hash)) {
            fs.unlinkSync(result.file);
            if (tooSmall) continue; // la variante suivante (hq au lieu de maxres) peut convenir
            return null;
        }
        seenHashes.add(hash);

        const candidate = {
            id,
            source,
            kind,
            file: path.basename(result.file),
            url,
            page,
            width: size.width,
            height: size.height,
            bytes: result.bytes,
            confidence: Math.round(confidence * 100) / 100,
            note: note || null,
        };
        entry.candidates.push(candidate);
        return candidate;
    }
    return null;
}

async function collectBeatboxWorld(entry, seen) {
    // Duo, tag team ou crew d'abord : sa page d'équipe donne les membres, la
    // photo de groupe et des vidéos où ils jouent ensemble. Prendre la fiche
    // d'un des membres donnerait un portrait individuel, inutilisable ici.
    const team = await beatboxWorld.findTeam(client, entry.name);
    if (team) {
        entry.group = { kind: team.kind, members: team.members, source: 'beatboxworld' };
        entry.sources.beatboxworld = { slug: team.slug, url: team.url, match: 'team', countryMatch: null };
        if (!entry.countryCode && team.countryEn) entry.countryCode = codeFromEnglishName(team.countryEn);
        if (team.photo) {
            await addCandidate(entry, seen, {
                id: 'bbw-team-photo',
                source: 'beatboxworld',
                kind: 'team-photo',
                urls: [team.photo],
                page: team.url,
                confidence: config.CONFIDENCE.beatboxworld,
            });
        }
        return { videos: team.videos, youtubeChannel: null };
    }

    const found = await beatboxWorld.findBeatboxer(client, entry.name, entry.countryCode);
    if (!found) return null;
    const profile = await beatboxWorld.fetchProfile(client, found.slug);
    if (!profile) return null;

    entry.sources.beatboxworld = { slug: found.slug, url: profile.url, match: found.match, countryMatch: found.countryMatch };
    if (!entry.countryCode && profile.countryEn) entry.countryCode = codeFromEnglishName(profile.countryEn);

    if (profile.photo) {
        let confidence = config.CONFIDENCE.beatboxworld;
        const notes = [];
        if (found.match !== 'exact') { confidence -= 0.15; notes.push(`nom approché (${profile.name})`); }
        if (found.countryMatch === false) { confidence -= 0.35; notes.push('pays différent'); }
        await addCandidate(entry, seen, {
            id: 'bbw-photo',
            source: 'beatboxworld',
            kind: 'profile',
            urls: [profile.photo],
            page: profile.url,
            confidence,
            note: notes.join(', ') || null,
        });
    }
    return profile;
}

async function collectWiki(entry, seen, page) {
    if (!page) {
        const title = await wiki.searchPage(client, entry.name);
        if (!title) return;
        page = (await wiki.lookupPages(client, [title])).get(title);
        if (!page) return;
    }
    entry.sources.wiki = { title: page.title, url: page.url };
    if (page.isGroup && !entry.group) entry.group = { kind: 'group', members: [], source: 'wiki' };
    if (!page.image) return;

    let confidence = config.CONFIDENCE.wiki;
    const notes = [];
    if (!page.isBeatboxer && !page.isGroup) { confidence -= 0.3; notes.push('page hors catégorie beatboxers'); }
    if (entry.countryCode && page.countryCode && page.countryCode !== entry.countryCode) {
        confidence -= 0.35;
        notes.push(`pays du wiki : ${page.countryCode}`);
    }
    await addCandidate(entry, seen, {
        id: 'wiki-photo',
        source: 'wiki',
        kind: 'page-image',
        urls: [page.image.url],
        page: page.url,
        referer: `${wiki.WIKI_BASE}/`,
        confidence,
        note: notes.join(', ') || null,
    });
}

async function collectYoutube(entry, seen, profile) {
    // Photo de la chaîne déclarée sur beatbox.world : c'est le beatboxer qui l'a choisie.
    if (profile?.youtubeChannel) {
        const avatar = await youtube.channelAvatar(client, profile.youtubeChannel);
        if (avatar) {
            await addCandidate(entry, seen, {
                id: 'yt-avatar',
                source: 'youtube',
                kind: 'channel-avatar',
                urls: [avatar],
                page: profile.youtubeChannel,
                confidence: config.CONFIDENCE['youtube-avatar'],
            });
        }
    }

    // Vidéos : celles que beatbox.world associe au beatboxer d'abord, sinon une
    // recherche. Les vidéos de la fiche sont souvent des battles (deux
    // visages) : la recherche, qui favorise showcases et éliminatoires, les complète.
    const searched = await youtube.searchVideos(client, entry.name, { limit: options.videos });
    const fromProfile = (profile?.videos || []).map((id) => ({ id, title: null, channel: null }));
    const videos = [...searched, ...fromProfile]
        .filter((video, index, all) => all.findIndex((other) => other.id === video.id) === index)
        .slice(0, options.videos);

    entry.sources.youtube = { channel: profile?.youtubeChannel || null, videos };

    for (const video of videos) {
        for (const frame of youtube.videoFrames(video.id)) {
            const isThumbnail = frame.kind === 'thumbnail';
            await addCandidate(entry, seen, {
                id: `yt-${video.id}-${frame.kind}`,
                source: 'youtube',
                kind: isThumbnail ? 'thumbnail' : 'frame',
                urls: frame.urls,
                page: youtube.watchUrl(video.id),
                confidence: config.CONFIDENCE[isThumbnail ? 'youtube-thumbnail' : 'youtube-frame'],
                note: video.title || null,
            });
        }
    }
}

// --- Nettoyage ----------------------------------------------------------------------

/** Supprime les images des entrées déjà tranchées ; entry.json reste comme trace. */
function clean() {
    let freed = 0;
    let files = 0;
    review.listEntries()
        .filter((entry) => entry.status !== 'pending')
        .forEach((entry) => {
            const dir = path.join(review.PHOTOS_DIR, entry.key);
            fs.readdirSync(dir)
                .filter((file) => file !== 'entry.json')
                .forEach((file) => {
                    freed += fs.statSync(path.join(dir, file)).size;
                    fs.unlinkSync(path.join(dir, file));
                    files += 1;
                });
            entry.candidates = (entry.candidates || []).map((candidate) => ({ ...candidate, discarded: candidate.discarded || 'cleaned' }));
            review.writeEntry(entry);
        });
    console.log(`🧹 ${files} fichiers supprimés, ${(freed / 1024 / 1024).toFixed(1)} Mo libérés.`);
}

// --- Main ---------------------------------------------------------------------------

async function main() {
    if (options.clean) {
        clean();
        return;
    }

    console.log(`📸 Photos Buzzer Battle — collecte (${options.sources.join(', ')})\n`);
    const allTargets = await loadTargets();

    // Une image déjà déposée sous le bon nom mais pas encore référencée dans
    // beatboxers.json : c'est le travail de scan_images.py, pas une photo à chercher.
    const onDisk = allTargets.filter((target) => hasImageOnDisk(target.name));
    const targets = allTargets.filter((target) => !hasImageOnDisk(target.name));
    if (onDisk.length) {
        console.log(`🗂️  ${onDisk.length} noms ont déjà une image dans beatbox_artists/ sans être référencés :`);
        console.log(`   ${onDisk.slice(0, 8).map((target) => target.name).join(', ')}${onDisk.length > 8 ? '…' : ''}`);
        console.log('   → lance python scan_images.py (racine du dépôt) pour les rattacher.\n');
    }

    const todo = targets.filter((target) => {
        const existing = review.readEntry(review.entryKey(target.name));
        if (!existing) return true;
        if (existing.status !== 'pending') return false;
        return options.force;
    }).slice(0, options.limit);

    console.log(`🎯 ${targets.length} beatboxers sans photo, ${todo.length} à collecter maintenant\n`);
    if (todo.length === 0) return;

    // Le wiki accepte 50 titres par requête : on résout toutes les pages d'un coup.
    const wikiPages = options.sources.includes('wiki')
        ? await wiki.lookupPages(client, todo.map((target) => target.name))
        : new Map();

    const totals = { withCandidates: 0, candidates: 0, empty: 0 };

    for (const [index, target] of todo.entries()) {
        const key = review.entryKey(target.name);
        fs.rmSync(path.join(review.PHOTOS_DIR, key), { recursive: true, force: true });

        const entry = {
            version: 1,
            key,
            name: target.name,
            nationality: target.nationality,
            countryCode: countryCodeOf(target.nationality),
            events: target.events,
            inDataFile: target.inDataFile,
            // Duo ou crew : plusieurs visages attendus sur la photo (voir faces.py).
            group: groupFromName(target.name),
            status: 'pending',
            collectedAt: new Date().toISOString(),
            sources: {},
            candidates: [],
            errors: [],
        };
        const seen = new Set();
        let profile = null;

        const step = async (source, task) => {
            if (!options.sources.includes(source)) return;
            try {
                await task();
            } catch (error) {
                entry.errors.push(`${source}: ${error.message}`);
            }
        };

        await step('beatboxworld', async () => { profile = await collectBeatboxWorld(entry, seen); });
        await step('wiki', () => collectWiki(entry, seen, wikiPages.get(target.name)));
        await step('youtube', () => collectYoutube(entry, seen, profile));

        entry.candidates.sort((a, b) => b.confidence - a.confidence);
        review.writeEntry(entry);

        totals.candidates += entry.candidates.length;
        if (entry.candidates.length) totals.withCandidates += 1; else totals.empty += 1;

        const bySource = ALL_SOURCES.map((source) => entry.candidates.filter((candidate) => candidate.source === source).length);
        console.log(
            `   [${index + 1}/${todo.length}] ${target.name.padEnd(28)} `
            + `bbw ${bySource[0]} · wiki ${bySource[1]} · yt ${bySource[2]}`
            + (entry.group ? `  [${entry.group.kind}${entry.group.members.length ? ` : ${entry.group.members.join(', ')}` : ''}]` : '')
            + (entry.errors.length ? `  ⚠️  ${entry.errors.join(' | ')}` : ''),
        );
    }

    const stats = client.getStats();
    console.log(`\n✅ ${totals.withCandidates} beatboxers avec au moins une photo (${totals.candidates} candidates), ${totals.empty} sans rien`);
    console.log(`   Requêtes : ${stats.network} réseau · ${stats.cache} cache · ${stats.downloads} images · ${stats.errors} échecs`);
    console.log('\n👉 Étape suivante : python scripts/photos/faces.py   (détection de visage, recadrage)');
    console.log('   puis /admin → Données → Photos pour valider.');
}

main().catch((error) => {
    console.error('❌', error);
    process.exit(1);
});
