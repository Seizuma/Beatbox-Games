#!/usr/bin/env node
// server/scripts/beatboxdle/profiles.js
//
// Étape 2/3 — Profils.
// Ouvre la fiche de chaque candidat et en extrait le palmarès complet.
// C'est ici que le filtre réel s'applique : un juge du GBB qui n'y a jamais
// battlé n'a aucune entrée de carrière sur un major, il sort du roster.
// Résultat : raw/profiles.json
//
//   node scripts/beatboxdle/profiles.js [--force] [--limit 20]

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { fetchPage, getStats } = require('./http');
const { parseProfile } = require('./parse');

const args = process.argv.slice(2);
const force = args.includes('--force');
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;

async function main() {
    if (!fs.existsSync(config.ROSTER_FILE)) {
        console.error(`❌ ${config.ROSTER_FILE} introuvable. Lance d'abord npm run beatboxdle:crawl`);
        process.exit(1);
    }

    const roster = JSON.parse(fs.readFileSync(config.ROSTER_FILE, 'utf8'));
    const majorSlugs = new Set(roster.majors.map((event) => event.slug));
    const seriesByEvent = new Map(roster.majors.map((event) => [event.slug, event.series]));
    const candidates = roster.candidates.slice(0, limit);

    console.log(`🎤 Beatboxdle — étape 2/3 : ${candidates.length} profils à lire\n`);

    const profiles = [];
    let competitors = 0;

    for (const [index, candidate] of candidates.entries()) {
        const html = await fetchPage(`${config.BASE_URL}/beatboxers/${candidate.slug}`, { force });
        if (!html) continue;

        const profile = parseProfile(html, candidate.slug);
        // Un résultat sur un major : c'est le critère d'entrée demandé.
        const majorEntries = profile.entries.filter((entry) => majorSlugs.has(entry.eventSlug));
        if (majorEntries.length === 0) continue;

        competitors += 1;
        profiles.push({
            ...profile,
            code: candidate.code,
            majorSeries: [...new Set(majorEntries.map((entry) => seriesByEvent.get(entry.eventSlug)))],
            entries: profile.entries.map((entry) => ({
                ...entry,
                series: seriesByEvent.get(entry.eventSlug) || null,
            })),
        });

        if ((index + 1) % 25 === 0 || index === candidates.length - 1) {
            console.log(`   ${index + 1}/${candidates.length} lus — ${competitors} compétiteurs retenus`);
        }
    }

    fs.mkdirSync(path.dirname(config.PROFILES_FILE), { recursive: true });
    fs.writeFileSync(
        config.PROFILES_FILE,
        JSON.stringify({ generatedAt: new Date().toISOString(), profiles }, null, 2),
    );

    const stats = getStats();
    console.log(`\n✅ ${profiles.length} profils écrits dans ${config.PROFILES_FILE}`);
    console.log(`   Requêtes réseau : ${stats.network} · cache : ${stats.cache} · échecs : ${stats.errors}`);
    console.log('\n👉 Étape suivante : npm run beatboxdle:build');
}

main().catch((error) => {
    console.error('❌', error);
    process.exit(1);
});