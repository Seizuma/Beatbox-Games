#!/usr/bin/env node
// server/scripts/beatboxdle/validate.js
//
// Contrôle qualité. Sort en code 1 si la base n'est pas jouable : à brancher
// dans le déploiement pour ne jamais mettre en ligne un Beatboxdle troué.
// Produit aussi reports/a-completer.csv, la liste de ce qu'il reste à trancher
// à la main dans overrides.json.
//
//   node scripts/beatboxdle/validate.js

const fs = require('fs');
const path = require('path');
const config = require('./config');

const errors = [];
const warnings = [];

function main() {
    if (!fs.existsSync(config.DATASET_FILE)) {
        console.error(`❌ ${config.DATASET_FILE} introuvable. Lance d'abord npm run beatboxdle:build`);
        process.exit(1);
    }

    const dataset = JSON.parse(fs.readFileSync(config.DATASET_FILE, 'utf8'));
    const list = dataset.beatboxers || [];
    console.log(`🎤 Beatboxdle — contrôle de ${list.length} entrées\n`);

    // --- Volume ------------------------------------------------------------
    if (list.length < config.MIN_SIZE) {
        errors.push(`${list.length} beatboxers seulement, il en faut au moins ${config.MIN_SIZE} (un par jour).`);
    }

    // --- Champs obligatoires ----------------------------------------------
    const incomplete = [];
    const seenSlugs = new Set();
    const seenLetters = new Map();

    list.forEach((beatboxer) => {
        const missing = ['name', 'country', 'gender', 'category', 'bestTitle'].filter((field) => !beatboxer[field]);
        if (missing.length) incomplete.push({ ...beatboxer, missing });

        if (seenSlugs.has(beatboxer.slug)) errors.push(`Slug en double : ${beatboxer.slug}`);
        seenSlugs.add(beatboxer.slug);

        // Deux noms identiques une fois normalisés rendent le mode lettres injouable.
        const previous = seenLetters.get(beatboxer.letters);
        if (previous) warnings.push(`Noms confondus en mode lettres : ${previous} / ${beatboxer.name}`);
        else seenLetters.set(beatboxer.letters, beatboxer.name);

        if (beatboxer.length < config.LETTERS_MIN || beatboxer.length > config.LETTERS_MAX) {
            warnings.push(`Nom hors gabarit lettres (${beatboxer.length}) : ${beatboxer.name}`);
        }
    });

    if (incomplete.length) {
        errors.push(`${incomplete.length} entrées incomplètes (voir reports/a-completer.csv).`);
    }

    // --- Répartition des indices ------------------------------------------
    // Un indice n'est utile que s'il discrimine : si 95 % sont des hommes solo,
    // le mode indices n'apprend rien au joueur.
    const distribution = (field) => {
        const counts = new Map();
        list.forEach((beatboxer) => {
            const key = field === 'bestTitle' ? beatboxer.bestTitle?.id : beatboxer[field];
            counts.set(key || '—', (counts.get(key || '—') || 0) + 1);
        });
        return [...counts.entries()].sort((a, b) => b[1] - a[1]);
    };

    for (const field of ['country', 'continent', 'gender', 'category', 'bestTitle']) {
        const values = distribution(field);
        const top = values[0];
        const share = Math.round((top[1] / list.length) * 100);
        console.log(`   ${field.padEnd(10)} ${values.length} valeurs · plus fréquente : ${top[0]} (${share} %)`);
        if (values.length < 2) errors.push(`L'indice « ${field} » n'a qu'une seule valeur : inutilisable.`);
        else if (share > 90) warnings.push(`L'indice « ${field} » est à ${share} % sur « ${top[0]} » : peu discriminant.`);
    }

    // --- Longueurs de noms, pour la grille du mode lettres ------------------
    const lengths = new Map();
    list.forEach((beatboxer) => lengths.set(beatboxer.length, (lengths.get(beatboxer.length) || 0) + 1));
    const sortedLengths = [...lengths.entries()].sort((a, b) => a[0] - b[0]);
    console.log(`\n   Longueurs : ${sortedLengths.map(([len, count]) => `${len}:${count}`).join(' ')}`);

    // --- Rapport des entrées à compléter -----------------------------------
    fs.mkdirSync(config.REPORT_DIR, { recursive: true });
    const reportFile = path.join(config.REPORT_DIR, 'a-completer.csv');
    const rows = [
        'slug;nom;pays;genre;categorie;meilleur_titre;manquants;source',
        ...incomplete.map((beatboxer) =>
            [
                beatboxer.slug,
                beatboxer.name,
                beatboxer.country || '',
                beatboxer.gender || '',
                beatboxer.category || '',
                beatboxer.bestTitle?.id || '',
                beatboxer.missing.join('+'),
                beatboxer.source,
            ].join(';'),
        ),
    ];
    fs.writeFileSync(reportFile, `${rows.join('\n')}\n`, 'utf8');

    // --- Verdict -----------------------------------------------------------
    console.log('');
    warnings.slice(0, 15).forEach((warning) => console.log(`   ⚠️  ${warning}`));
    if (warnings.length > 15) console.log(`   ⚠️  … et ${warnings.length - 15} autres avertissements`);
    errors.forEach((error) => console.log(`   ❌ ${error}`));

    if (incomplete.length) {
        console.log(`\n   📄 ${incomplete.length} lignes à compléter : ${reportFile}`);
        console.log('      Reporte les corrections dans scripts/beatboxdle/overrides.json, puis relance build.');
    }

    if (errors.length) {
        console.log('\n❌ Base non jouable.');
        process.exit(1);
    }

    console.log(`\n✅ Base valide — ${list.length} beatboxers, de quoi tenir ${Math.floor(list.length / 365)} an(s).`);
}

main();