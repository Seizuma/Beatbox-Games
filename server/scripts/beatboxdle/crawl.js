#!/usr/bin/env node
// server/scripts/beatboxdle/crawl.js
//
// Étape 1/3 — Découverte.
// Balaie /events?year=YYYY, retient les éditions du GBB et du championnat du
// monde, ouvre leurs catégories et collecte tous les slugs de beatboxers cités.
// Résultat : raw/roster.json (liste de candidats, volontairement large).
//
//   node scripts/beatboxdle/crawl.js [--force] [--years 2019,2024]

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { fetchPage, getStats } = require('./http');
const { parseEventList, parseEventCategories, parseCategoryBeatboxers } = require('./parse');

const args = process.argv.slice(2);
const force = args.includes('--force');
const yearsArg = args[args.indexOf('--years') + 1];
const years = args.includes('--years')
    ? yearsArg.split(',').map(Number)
    : config.YEARS;

const seriesOf = (title) => {
    const series = config.MAJOR_SERIES.find(
        (candidate) => candidate.match.test(title) && !(candidate.exclude && candidate.exclude.test(title)),
    );
    return series ? series.id : null;
};

async function main() {
    console.log('🎤 Beatboxdle — étape 1/3 : découverte des majors\n');

    // --- 1. Les éditions ---------------------------------------------------
    const majors = new Map(); // slug -> { slug, title, series }
    for (const year of years) {
        const html = await fetchPage(`${config.BASE_URL}/events?year=${year}`, { force });
        if (!html) {
            console.warn(`   ⚠️  Année ${year} illisible, ignorée`);
            continue;
        }
        const events = parseEventList(html);
        const kept = events.filter((event) => seriesOf(event.title));
        kept.forEach((event) => majors.set(event.slug, { ...event, series: seriesOf(event.title) }));
        console.log(`   ${year} : ${events.length} événements, ${kept.length} major(s)`);
    }

    if (majors.size === 0) {
        console.error('\n❌ Aucune édition trouvée. Le gabarit du site a probablement changé.');
        console.error('   Vérifie avec : node scripts/beatboxdle/inspect.js events 2024');
        process.exit(1);
    }

    console.log(`\n📅 ${majors.size} éditions retenues :`);
    for (const event of majors.values()) console.log(`   [${event.series}] ${event.slug} — ${event.title}`);

    // --- 2. Les catégories -------------------------------------------------
    const categories = [];
    for (const event of majors.values()) {
        const html = await fetchPage(`${config.BASE_URL}/events/${event.slug}`, { force });
        if (!html) continue;
        const ids = parseEventCategories(html, event.slug);
        ids.forEach((id) => categories.push({ ...event, categoryId: id }));
        console.log(`   ${event.slug} : ${ids.length} catégorie(s)`);
    }

    // --- 3. Les beatboxers cités ------------------------------------------
    const candidates = new Map(); // slug -> { slug, code, majors: Set }
    for (const [index, category] of categories.entries()) {
        const url = `${config.BASE_URL}/events/${category.slug}/categories/${category.categoryId}`;
        const html = await fetchPage(url, { force });
        if (!html) continue;

        for (const person of parseCategoryBeatboxers(html)) {
            const existing = candidates.get(person.slug) || { slug: person.slug, code: null, majors: new Set() };
            if (!existing.code && person.code) existing.code = person.code;
            existing.majors.add(category.series);
            candidates.set(person.slug, existing);
        }

        if ((index + 1) % 10 === 0 || index === categories.length - 1) {
            console.log(`   ${index + 1}/${categories.length} catégories — ${candidates.size} candidats`);
        }
    }

    // --- 4. Écriture -------------------------------------------------------
    fs.mkdirSync(path.dirname(config.ROSTER_FILE), { recursive: true });
    const roster = {
        generatedAt: new Date().toISOString(),
        majors: [...majors.values()],
        categories,
        candidates: [...candidates.values()].map((candidate) => ({
            slug: candidate.slug,
            code: candidate.code,
            majors: [...candidate.majors],
        })),
    };
    fs.writeFileSync(config.ROSTER_FILE, JSON.stringify(roster, null, 2));

    const stats = getStats();
    console.log(`\n✅ ${roster.candidates.length} candidats écrits dans ${config.ROSTER_FILE}`);
    console.log(`   Requêtes réseau : ${stats.network} · cache : ${stats.cache} · échecs : ${stats.errors}`);
    console.log('\n👉 Étape suivante : npm run beatboxdle:profiles');
}

main().catch((error) => {
    console.error('❌', error);
    process.exit(1);
});