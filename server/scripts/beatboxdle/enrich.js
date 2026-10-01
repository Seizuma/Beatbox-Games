#!/usr/bin/env node
// server/scripts/beatboxdle/enrich.js
//
// Étape 4 — Propositions de titres.
// Croise le palmarès complet de beatbox.world (raw/profiles.json, tous
// événements confondus) et celui du wiki (raw/wiki.json), pondère chaque
// titre, et propose pour chaque beatboxer le plus marquant.
//
// Rien n'est appliqué ici : les propositions partent en revue dans
// /admin → Données → Titres. Seuls les titres validés y sont repris par
// build.js.
//
// Résultats :
//   beatbox_artists/review/titles.json               propositions à revoir
//   beatbox_artists/beatboxdle/reports/evenements-non-classes.csv
//
//   node scripts/beatboxdle/enrich.js

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { titlesFor, legacyMajorTitle } = require('./titles');

const ALTERNATIVES = 6;

const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback);

function main() {
    if (!fs.existsSync(config.PROFILES_FILE)) {
        console.error(`❌ ${config.PROFILES_FILE} introuvable. Lance d'abord npm run beatboxdle:profiles`);
        process.exit(1);
    }

    const { profiles } = readJson(config.PROFILES_FILE, { profiles: [] });
    const wiki = readJson(config.WIKI_FILE, { profiles: {} }).profiles || {};
    const dataset = readJson(config.DATASET_FILE, null);
    const reviewed = readJson(config.REVIEWED_TITLES_FILE, {});

    if (!fs.existsSync(config.WIKI_FILE)) {
        console.warn('⚠️  raw/wiki.json absent : propositions sur beatbox.world seul (npm run beatboxdle:wiki pour le compléter).\n');
    }
    if (profiles.length && !profiles.some((profile) => profile.entries.some((entry) => entry.eventName))) {
        console.warn('⚠️  profiles.json date d\'avant la lecture des noms d\'événements : relance npm run beatboxdle:profiles');
        console.warn('   (le cache rend l\'opération quasi instantanée).\n');
    }

    // Ce que voient les joueurs aujourd'hui, à défaut le calcul historique.
    const live = new Map((dataset?.beatboxers || []).map((beatboxer) => [beatboxer.slug, beatboxer]));
    const inDataset = (profile) => !dataset || live.has(profile.slug);

    const unclassifiedCount = new Map();
    const items = profiles
        .filter((profile) => profile.name && inDataset(profile))
        .map((profile) => {
            const wikiProfile = wiki[profile.slug] || null;
            const { titles, unclassified } = titlesFor(profile, wikiProfile);
            unclassified.forEach((event) => {
                const entry = unclassifiedCount.get(event) || { count: 0, names: [] };
                entry.count += 1;
                if (entry.names.length < 5) entry.names.push(profile.name);
                unclassifiedCount.set(event, entry);
            });

            const current = live.get(profile.slug)?.bestTitle || legacyMajorTitle(profile);
            const proposed = titles[0] || null;
            const decision = reviewed[profile.slug] || null;

            return {
                slug: profile.slug,
                name: profile.name,
                countryCode: live.get(profile.slug)?.countryCode || profile.code || null,
                photo: live.get(profile.slug)?.photo || null,
                fame: live.get(profile.slug)?.fame ?? null,
                sources: {
                    beatboxworld: `${config.BASE_URL}/beatboxers/${profile.slug}`,
                    wiki: wikiProfile ? wikiProfile.url : null,
                },
                current,
                proposed,
                alternatives: titles.slice(0, ALTERNATIVES),
                changed: Boolean(proposed && current && proposed.key !== (current.key || current.id)),
                unclassified,
                // Une décision prise sur une ancienne proposition reste valable,
                // mais l'écran la signale si la proposition a changé depuis.
                decision: decision ? { choice: decision.choice, key: decision.title?.key || null } : null,
            };
        })
        .sort((a, b) => (b.fame ?? 0) - (a.fame ?? 0) || a.name.localeCompare(b.name));

    fs.mkdirSync(path.dirname(config.TITLE_PROPOSALS_FILE), { recursive: true });
    fs.writeFileSync(
        config.TITLE_PROPOSALS_FILE,
        JSON.stringify({
            generatedAt: new Date().toISOString(),
            weights: {
                levels: config.TITLE_LEVEL_WEIGHTS,
                placements: config.TITLE_PLACEMENT_FACTORS,
                disciplines: config.TITLE_DISCIPLINE_FACTORS,
                repeatBonus: config.TITLE_REPEAT_BONUS,
                confirmedBonus: config.TITLE_CONFIRMED_BONUS,
            },
            count: items.length,
            changed: items.filter((item) => item.changed).length,
            items,
        }, null, 2),
    );

    // Les événements « autres » les plus fréquents sont ceux qu'il vaut le
    // plus la peine de classer dans config.TITLE_INTL_EVENTS.
    fs.mkdirSync(config.REPORT_DIR, { recursive: true });
    const reportFile = path.join(config.REPORT_DIR, 'evenements-non-classes.csv');
    const rows = [...unclassifiedCount.entries()].sort((a, b) => b[1].count - a[1].count);
    fs.writeFileSync(
        reportFile,
        `${['evenement;beatboxers;exemples', ...rows.map(([event, { count, names }]) => `${event};${count};${names.join(', ')}`)].join('\n')}\n`,
        'utf8',
    );

    const changed = items.filter((item) => item.changed);
    const levelOf = (title) => title?.level || title?.series || '?';
    const upgrades = {};
    changed.forEach((item) => {
        const label = `${levelOf(item.current)} → ${levelOf(item.proposed)}`;
        upgrades[label] = (upgrades[label] || 0) + 1;
    });

    console.log(`🏆 Beatboxdle — ${items.length} palmarès analysés (${Object.keys(wiki).length} complétés par le wiki)\n`);
    console.log(`   ${changed.length} titres différents de l'indice actuel :`);
    Object.entries(upgrades).sort((a, b) => b[1] - a[1]).forEach(([label, count]) => console.log(`     ${label.padEnd(26)} ${count}`));
    console.log('\n   Exemples :');
    changed.slice(0, 8).forEach((item) => {
        console.log(`     ${item.name.padEnd(18)} ${(item.current.key || item.current.id).padEnd(24)} → ${item.proposed.key} (${item.proposed.score})`);
    });
    console.log(`\n   📄 ${rows.length} événements non classés listés dans ${reportFile}`);
    console.log(`\n✅ Propositions écrites dans ${config.TITLE_PROPOSALS_FILE}`);
    console.log('👉 Revue : /admin → Données → Titres, puis « Reconstruire la base ».');
}

main();
