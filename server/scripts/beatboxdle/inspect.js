#!/usr/bin/env node
// server/scripts/beatboxdle/inspect.js
//
// Vérificateur de parseurs. Avant de lancer un crawl d'une heure, on regarde ce
// que les sélecteurs trouvent sur une seule page. C'est aussi le premier
// réflexe le jour où beatbox.world change son gabarit.
//
//   node scripts/beatboxdle/inspect.js events 2024
//   node scripts/beatboxdle/inspect.js event gbb-2019
//   node scripts/beatboxdle/inspect.js category gbb-2019 158
//   node scripts/beatboxdle/inspect.js profile alexinho

const config = require('./config');
const { fetchPage } = require('./http');
const { parseEventList, parseEventCategories, parseCategoryBeatboxers, parseProfile } = require('./parse');

const [kind, first, second] = process.argv.slice(2);

async function main() {
    if (kind === 'events') {
        const year = first || '2024';
        const html = await fetchPage(`${config.BASE_URL}/events?year=${year}`, { force: true });
        const events = parseEventList(html);
        console.log(`${events.length} événements en ${year}\n`);
        events.slice(0, 40).forEach((event) => console.log(`  ${event.slug.padEnd(42)} ${event.title}`));
        return;
    }

    if (kind === 'event') {
        const html = await fetchPage(`${config.BASE_URL}/events/${first}`, { force: true });
        console.log(`Catégories de ${first} :`, parseEventCategories(html, first));
        return;
    }

    if (kind === 'category') {
        const html = await fetchPage(`${config.BASE_URL}/events/${first}/categories/${second}`, { force: true });
        const people = parseCategoryBeatboxers(html);
        console.log(`${people.length} beatboxers cités\n`);
        people.forEach((person) => console.log(`  ${person.slug.padEnd(28)} ${person.flag || '  '} ${person.code || ''}`));
        return;
    }

    if (kind === 'profile') {
        const html = await fetchPage(`${config.BASE_URL}/beatboxers/${first}`, { force: true });
        const profile = parseProfile(html, first);
        console.log(JSON.stringify({ ...profile, entries: profile.entries.slice(0, 12) }, null, 2));
        console.log(`\n… ${profile.entries.length} entrées de carrière au total`);
        return;
    }

    console.log('Usage : inspect.js events <année> | event <slug> | category <slug> <id> | profile <slug>');
    process.exit(1);
}

main().catch((error) => {
    console.error('❌', error);
    process.exit(1);
});