#!/usr/bin/env node
// server/scripts/beatboxdle/wiki.js
//
// Étape 2 bis — Palmarès du Beatbox Wiki.
// Pour chaque profil retenu par profiles.js, retrouve la page wiki du
// beatboxer et en extrait le palmarès rédigé à la main. Il complète
// beatbox.world, souvent lacunaire sur les championnats nationaux.
// Résultat : raw/wiki.json
//
//   node scripts/beatboxdle/wiki.js [--limit 20]
//
// Les réponses du wiki sont mises en cache avec celles de beatbox.world :
// vider beatbox_artists/beatboxdle/cache pour forcer une relecture.

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { createClient } = require('../shared/http');
const wiki = require('../sources/wiki');

const args = process.argv.slice(2);
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;

// Même cache que le reste du pipeline, mais un rythme adapté au wiki :
// l'API MediaWiki de Fandom répond vite et sans broncher à 2-3 requêtes/s.
const client = createClient({
    cacheDir: config.CACHE_DIR,
    cacheExtension: '.html',
    delayMs: 400,
    userAgent: config.USER_AGENT,
    retries: config.MAX_RETRIES,
    timeoutMs: config.TIMEOUT_MS,
});

async function main() {
    if (!fs.existsSync(config.PROFILES_FILE)) {
        console.error(`❌ ${config.PROFILES_FILE} introuvable. Lance d'abord npm run beatboxdle:profiles`);
        process.exit(1);
    }

    const { profiles } = JSON.parse(fs.readFileSync(config.PROFILES_FILE, 'utf8'));
    const todo = profiles.filter((profile) => profile.name).slice(0, limit);
    console.log(`📚 Beatboxdle — palmarès wiki de ${todo.length} beatboxers\n`);

    const pages = await wiki.lookupPages(client, todo.map((profile) => profile.name));
    const result = {};
    const counts = { found: 0, searched: 0, mismatch: 0, missing: 0 };

    for (const [index, profile] of todo.entries()) {
        let page = pages.get(profile.name);
        if (!page) {
            const title = await wiki.searchPage(client, profile.name);
            if (title) {
                page = (await wiki.lookupPages(client, [title])).get(title);
                if (page) counts.searched += 1;
            }
        }
        if (!page || !page.isBeatboxer) {
            counts.missing += 1;
            continue;
        }

        const wikiProfile = await wiki.fetchProfile(client, page.title);
        if (!wikiProfile) {
            counts.missing += 1;
            continue;
        }

        // Homonyme probable : même pseudo, autre pays. On ne mélange pas les palmarès.
        const wikiCountry = wikiProfile.countryCode || page.countryCode;
        if (profile.code && wikiCountry && wikiCountry !== profile.code) {
            counts.mismatch += 1;
            console.log(`   ⚠️  ${profile.name} : pays ${profile.code} sur beatbox.world, ${wikiCountry} au wiki — ignoré`);
            continue;
        }

        counts.found += 1;
        result[profile.slug] = {
            title: wikiProfile.title,
            url: wikiProfile.url,
            countryCode: wikiCountry || null,
            image: page.image,
            achievements: wikiProfile.achievements,
            pronouns: wikiProfile.pronouns,
        };

        if ((index + 1) % 25 === 0 || index === todo.length - 1) {
            console.log(`   ${index + 1}/${todo.length} lus — ${counts.found} pages exploitables`);
        }
    }

    fs.mkdirSync(path.dirname(config.WIKI_FILE), { recursive: true });
    fs.writeFileSync(config.WIKI_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), profiles: result }, null, 2));

    const stats = client.getStats();
    console.log(`\n✅ ${counts.found} palmarès écrits dans ${config.WIKI_FILE}`);
    console.log(`   ${counts.searched} retrouvés par recherche · ${counts.mismatch} homonymes écartés · ${counts.missing} sans page`);
    console.log(`   Requêtes réseau : ${stats.network} · cache : ${stats.cache} · échecs : ${stats.errors}`);
    console.log('\n👉 Étape suivante : npm run beatboxdle:enrich');
}

main().catch((error) => {
    console.error('❌', error);
    process.exit(1);
});
