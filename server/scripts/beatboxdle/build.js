#!/usr/bin/env node
// server/scripts/beatboxdle/build.js
//
// Étape 3/3 — Construction.
// Transforme les profils bruts en la base que le jeu consomme. La logique vit
// dans builder.js, partagée avec le bouton « Reconstruire » de l'administration.
// Résultat : beatbox_artists/beatboxdle/beatboxdle.json
//
//   node scripts/beatboxdle/build.js [--size 420] [--all]

const config = require('./config');
const { buildDataset, writeDataset, writeIncompleteReport } = require('./builder');

const args = process.argv.slice(2);
const targetSize = args.includes('--size') ? Number(args[args.indexOf('--size') + 1]) : config.TARGET_SIZE;
const keepAll = args.includes('--all');

function main() {
    let result;
    try {
        result = buildDataset({ targetSize, keepAll });
    } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
    }

    const { dataset, built, incomplete, reviewedCount } = result;
    console.log(`🎤 Beatboxdle — étape 3/3 : ${built.length} profils normalisés\n`);

    const reportFile = writeIncompleteReport(incomplete);
    if (incomplete.length) console.log(`   📄 ${incomplete.length} entrées incomplètes listées dans ${reportFile}`);

    writeDataset(dataset);

    const countMode = (mode) => dataset.beatboxers.filter((beatboxer) => beatboxer.modes.includes(mode)).length;
    console.log(`   mode lettres : ${countMode('letters')} · mode indices : ${countMode('clues')}`);
    console.log(`   titres validés en administration : ${reviewedCount}`);
    console.log(`\n✅ ${dataset.count} retenus dans ${config.DATASET_FILE}`);
    console.log('\n👉 Étape suivante : npm run beatboxdle:validate');
}

main();
