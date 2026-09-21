#!/usr/bin/env node
// server/scripts/beatboxdle/build.js
//
// Étape 3/3 — Construction.
// Transforme les profils bruts en la base que le jeu consomme : un pays, un
// genre, une catégorie principale, un meilleur titre, et de quoi jouer le mode
// lettres. Applique les corrections manuelles d'overrides.json, classe par
// notoriété, garde les TARGET_SIZE premiers.
// Résultat : beatbox_artists/beatboxdle/beatboxdle.json
//
//   node scripts/beatboxdle/build.js [--size 420] [--all]

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { frenchName, continentOf, codeFromEnglishName } = require('./countries');

const args = process.argv.slice(2);
const targetSize = args.includes('--size') ? Number(args[args.indexOf('--size') + 1]) : config.TARGET_SIZE;
const keepAll = args.includes('--all');

/** Nom réduit aux lettres A–Z, accents retirés : c'est ce que le joueur tape. */
const toLetters = (name) =>
    (name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '');

const normalizeName = (name) => toLetters(name).toLowerCase();

/** Catégorie principale : celle où il a le plus concouru, départage par priorité. */
function mainCategory(entries) {
    const counts = new Map();
    entries.forEach((entry) => {
        if (!entry.discipline) return;
        counts.set(entry.discipline, (counts.get(entry.discipline) || 0) + 1);
    });
    if (counts.size === 0) return null;

    const max = Math.max(...counts.values());
    const tied = [...counts.entries()].filter(([, count]) => count === max).map(([id]) => id);
    return config.CATEGORY_PRIORITY.find((id) => tied.includes(id)) || tied[0];
}

/** Meilleur titre, calculé uniquement sur les majors (GBB + championnat du monde). */
function bestTitle(entries) {
    const majors = entries.filter((entry) => entry.series);
    if (majors.length === 0) return null;

    const best = majors.reduce((winner, entry) => {
        if (!winner) return entry;
        if (entry.tier !== winner.tier) return entry.tier > winner.tier ? entry : winner;
        // À tier égal, le championnat du monde prime pour l'affichage.
        if (entry.series === 'wbc' && winner.series !== 'wbc') return entry;
        return (entry.year || 0) > (winner.year || 0) ? entry : winner;
    }, null);

    const id = `${best.series}-${best.placementId}`;
    return {
        id,
        tier: best.tier,
        label: config.TITLE_LABELS[id] || id,
        series: best.series,
        year: best.year,
    };
}

/** Première ou dernière année de compétition, null si aucune entrée datée. */
function yearBound(entries, pick) {
    const years = entries.map((entry) => entry.year).filter(Boolean);
    return years.length ? pick(...years) : null;
}

/** Genre déduit des catégories genrées ; conflit ou absence -> null. */
function inferGender(entries) {
    const votes = entries.map((entry) => entry.gender).filter(Boolean);
    if (votes.length === 0) return null;
    const male = votes.filter((vote) => vote === 'M').length;
    const female = votes.filter((vote) => vote === 'F').length;
    if (male > 0 && female > 0) return null; // ambigu : à trancher dans overrides.json
    return male > female ? 'M' : 'F';
}

/**
 * Score de notoriété : sert uniquement à ordonner le roster pour garder les
 * plus connus. Volontairement grossier — un titre mondial pèse plus qu'une
 * longue carrière sans résultat.
 */
function fameScore(profile, title) {
    const majorEntries = profile.entries.filter((entry) => entry.series).length;
    return (
        (title ? title.tier * 12 : 0) +
        majorEntries * 6 +
        (profile.titleCount || 0) * 3 +
        (profile.eventCount || 0) +
        (profile.elo ? Math.max(0, (profile.elo - 1400) / 20) : 0)
    );
}

/** Photos déjà rapatriées pour le Buzzer Battle : réutilisées pour la révélation. */
function loadBuzzerPhotos() {
    if (!fs.existsSync(config.BUZZER_DATA_FILE)) return new Map();
    const list = JSON.parse(fs.readFileSync(config.BUZZER_DATA_FILE, 'utf8'));
    const photos = new Map();
    list.forEach((item) => {
        if (item.local_image && item.title) photos.set(normalizeName(item.title), item.local_image);
    });
    return photos;
}

/**
 * Liste les entrées qui ne sont pas jouables dans les deux modes, avec la
 * raison. C'est la feuille de route du travail manuel : chaque genre renseigné
 * dans overrides.json fait basculer une ligne d'ici vers le mode indices.
 */
function writeIncompleteReport(incomplete) {
    fs.mkdirSync(config.REPORT_DIR, { recursive: true });

    const rows = [
        'slug;nom;longueur;pays;genre;categorie;meilleur_titre;manque;source',
        ...incomplete.map((beatboxer) => {
            const missing = [];
            if (!beatboxer.gender) missing.push('genre');
            if (!beatboxer.country) missing.push('pays');
            if (!beatboxer.firstYear) missing.push('annee');
            if (!beatboxer.bestTitle) missing.push('titre');
            if (!beatboxer.modes.includes('letters')) missing.push(`longueur:${beatboxer.length}`);

            return [
                beatboxer.slug,
                beatboxer.name,
                beatboxer.length,
                beatboxer.country || '',
                beatboxer.gender || '',
                beatboxer.category || '',
                beatboxer.bestTitle ? beatboxer.bestTitle.id : '',
                missing.join('+'),
                beatboxer.source,
            ].join(';');
        }),
    ];

    const file = path.join(config.REPORT_DIR, 'a-completer.csv');
    fs.writeFileSync(file, `${rows.join('\n')}\n`, 'utf8');
    if (incomplete.length) console.log(`   📄 ${incomplete.length} entrées incomplètes listées dans ${file}`);
}

function main() {
    if (!fs.existsSync(config.PROFILES_FILE)) {
        console.error(`❌ ${config.PROFILES_FILE} introuvable. Lance d'abord npm run beatboxdle:profiles`);
        process.exit(1);
    }

    const { profiles } = JSON.parse(fs.readFileSync(config.PROFILES_FILE, 'utf8'));
    const overrides = fs.existsSync(config.OVERRIDES_FILE)
        ? JSON.parse(fs.readFileSync(config.OVERRIDES_FILE, 'utf8'))
        : { exclude: [], patch: {} };
    const excluded = new Set(overrides.exclude || []);
    const photos = loadBuzzerPhotos();

    console.log(`🎤 Beatboxdle — étape 3/3 : ${profiles.length} profils à normaliser\n`);

    const built = profiles
        .filter((profile) => profile.name && !excluded.has(profile.slug))
        .map((profile) => {
            const patch = (overrides.patch || {})[profile.slug] || {};
            const code = patch.countryCode || profile.code || codeFromEnglishName(profile.countryEn);
            const title = bestTitle(profile.entries);
            const letters = toLetters(patch.name || profile.name);

            return {
                slug: profile.slug,
                name: patch.name || profile.name,
                letters,
                length: letters.length,
                countryCode: code || null,
                country: frenchName(code),
                continent: continentOf(code),
                gender: patch.gender || inferGender(profile.entries),
                category: patch.category || mainCategory(profile.entries),
                categoryLabel: null, // rempli juste après, une fois la catégorie arrêtée
                bestTitle: patch.bestTitleId
                    ? { ...title, id: patch.bestTitleId, label: config.TITLE_LABELS[patch.bestTitleId] }
                    : title,
                majorSeries: profile.majorSeries,
                events: profile.eventCount,
                titles: profile.titleCount,
                elo: profile.elo,
                firstYear: yearBound(profile.entries, Math.min),
                lastYear: yearBound(profile.entries, Math.max),
                photo: photos.get(normalizeName(profile.name)) || null,
                source: `${config.BASE_URL}/beatboxers/${profile.slug}`,
                fame: fameScore(profile, title),
            };
        })
        .map((beatboxer) => ({
            ...beatboxer,
            categoryLabel: config.CATEGORY_LABELS[beatboxer.category] || null,
            // Le mode lettres a besoin d'un nom d'une longueur raisonnable ;
            // le mode indices n'a besoin que des quatre champs d'indices.
            modes: [
                beatboxer.length >= config.LETTERS_MIN && beatboxer.length <= config.LETTERS_MAX ? 'letters' : null,
                beatboxer.country && beatboxer.gender && beatboxer.firstYear && beatboxer.bestTitle ? 'clues' : null,
            ].filter(Boolean),
        }))
        .sort((a, b) => b.fame - a.fame);

    // Une entrée entre dans la base dès qu'elle est jouable dans UN mode : un nom
    // au genre inconnu sert quand même au mode lettres, un nom de quinze lettres
    // sert quand même au mode indices. Le tirage du jour filtre ensuite par mode,
    // donc les deux jeux ne se mélangent jamais.
    const playable = built.filter((beatboxer) => beatboxer.modes.length > 0);
    const selection = keepAll ? built : playable.slice(0, targetSize);
    const countMode = (mode) => selection.filter((beatboxer) => beatboxer.modes.includes(mode)).length;

    writeIncompleteReport(built.filter((beatboxer) => beatboxer.modes.length < 2));

    fs.mkdirSync(path.dirname(config.DATASET_FILE), { recursive: true });
    fs.writeFileSync(
        config.DATASET_FILE,
        JSON.stringify(
            {
                version: 1,
                generatedAt: new Date().toISOString(),
                source: config.BASE_URL,
                criteria: 'Au moins un résultat au Grand Beatbox Battle ou au championnat du monde',
                count: selection.length,
                beatboxers: selection,
            },
            null,
            2,
        ),
    );

    console.log(`   ${built.length} beatboxers normalisés`);
    console.log(`   mode lettres : ${countMode('letters')} · mode indices : ${countMode('clues')}`);
    console.log(`\n✅ ${selection.length} retenus dans ${config.DATASET_FILE}`);
    console.log('\n👉 Étape suivante : npm run beatboxdle:validate');
}

main();
