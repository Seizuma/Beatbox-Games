#!/usr/bin/env node
// server/scripts/beatboxdle/validate.js
//
// Contrôle qualité. Sort en code 1 si la base n'est pas jouable : à brancher
// dans le déploiement pour ne jamais mettre en ligne un Beatboxdle troué.
//
// Le contrôle se fait mode par mode. Une entrée sans genre reste parfaitement
// jouable en mode lettres — la refuser globalement amputerait la base pour
// rien. Chaque vivier est donc mesuré et validé séparément.
//
//   node scripts/beatboxdle/validate.js

const fs = require('fs');
const config = require('./config');

const errors = [];
const warnings = [];

/**
 * Vivier réel du mode lettres : les longueurs qui n'ont pas assez de noms à
 * proposer sont écartées du tirage, exactement comme le fait le serveur.
 */
function lettersPool(list) {
    const playable = list.filter((beatboxer) => beatboxer.modes.includes('letters'));
    const byLength = new Map();
    playable.forEach((beatboxer) => byLength.set(beatboxer.length, (byLength.get(beatboxer.length) || 0) + 1));

    return {
        playable,
        byLength,
        drawable: playable.filter((beatboxer) => byLength.get(beatboxer.length) >= config.LETTERS_MIN_CANDIDATES),
    };
}

/** Répartition d'un champ : un indice n'est utile que s'il discrimine. */
function distribution(list, field) {
    const counts = new Map();
    list.forEach((beatboxer) => {
        const key = field === 'bestTitle' ? (beatboxer.bestTitle && beatboxer.bestTitle.id) : beatboxer[field];
        counts.set(key || '—', (counts.get(key || '—') || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function main() {
    if (!fs.existsSync(config.DATASET_FILE)) {
        console.error(`❌ ${config.DATASET_FILE} introuvable. Lance d'abord npm run beatboxdle:build`);
        process.exit(1);
    }

    const dataset = JSON.parse(fs.readFileSync(config.DATASET_FILE, 'utf8'));
    const list = dataset.beatboxers || [];
    const clues = list.filter((beatboxer) => beatboxer.modes.includes('clues'));
    const letters = lettersPool(list);

    console.log(`🎤 Beatboxdle — contrôle de ${list.length} entrées\n`);

    // --- Unicité -----------------------------------------------------------
    const seenSlugs = new Set();
    const seenLetters = new Map();
    let collisions = 0;

    list.forEach((beatboxer) => {
        if (seenSlugs.has(beatboxer.slug)) errors.push(`Slug en double : ${beatboxer.slug}`);
        seenSlugs.add(beatboxer.slug);
    });

    // Deux noms qui se confondent une fois réduits aux lettres rendent la grille
    // insoluble : le joueur tape le bon mot et on lui répond que c'est faux.
    letters.playable.forEach((beatboxer) => {
        const previous = seenLetters.get(beatboxer.letters);
        if (previous) {
            collisions += 1;
            if (collisions <= 10) warnings.push(`Noms confondus en mode lettres : ${previous} / ${beatboxer.name}`);
        } else {
            seenLetters.set(beatboxer.letters, beatboxer.name);
        }
    });
    if (collisions > 10) warnings.push(`… et ${collisions - 10} autres collisions de noms`);

    // --- Mode lettres ------------------------------------------------------
    console.log('   MODE LETTRES');
    console.log(`   ${letters.playable.length} noms proposables · ${letters.drawable.length} tirables comme réponse`);
    const lengths = [...letters.byLength.entries()].sort((a, b) => a[0] - b[0]);
    const summary = lengths
        .map(([length, count]) => `${length}:${count}${count >= config.LETTERS_MIN_CANDIDATES ? '' : '✗'}`)
        .join(' ');
    console.log(`   longueurs : ${summary}`);
    console.log(`   (✗ = moins de ${config.LETTERS_MIN_CANDIDATES} noms, longueur écartée du tirage)\n`);

    if (letters.drawable.length < config.MIN_SIZE) {
        errors.push(`Mode lettres : ${letters.drawable.length} réponses tirables, il en faut au moins ${config.MIN_SIZE}.`);
    }

    // --- Mode indices ------------------------------------------------------
    console.log('   MODE INDICES');
    console.log(`   ${clues.length} beatboxers jouables`);

    for (const field of ['country', 'continent', 'gender', 'category', 'bestTitle']) {
        const values = distribution(clues, field);
        if (values.length === 0) continue;
        const [topValue, topCount] = values[0];
        const share = Math.round((topCount / clues.length) * 100);
        console.log(`   ${field.padEnd(10)} ${values.length} valeurs · plus fréquente : ${topValue} (${share} %)`);

        if (values.length < 2) errors.push(`L'indice « ${field} » n'a qu'une seule valeur : inutilisable.`);
        else if (share > 90) warnings.push(`L'indice « ${field} » est à ${share} % sur « ${topValue} » : peu discriminant.`);
    }

    if (clues.length < config.MIN_SIZE) {
        errors.push(`Mode indices : ${clues.length} beatboxers, il en faut au moins ${config.MIN_SIZE}.`);
    }

    // Une entrée du vivier indices doit avoir ses quatre indices : une case vide
    // dans la grille, c'est un indice qu'on ne peut pas colorer.
    const broken = clues.filter(
        (beatboxer) => !beatboxer.country || !beatboxer.gender || !beatboxer.category || !beatboxer.bestTitle,
    );
    if (broken.length) {
        const sample = broken.slice(0, 5).map((beatboxer) => beatboxer.slug).join(', ');
        errors.push(`${broken.length} entrées du mode indices ont un indice manquant (${sample}…).`);
    }

    // --- Verdict -----------------------------------------------------------
    console.log('');
    warnings.slice(0, 15).forEach((warning) => console.log(`   ⚠️  ${warning}`));
    if (warnings.length > 15) console.log(`   ⚠️  … et ${warnings.length - 15} autres avertissements`);
    errors.forEach((error) => console.log(`   ❌ ${error}`));

    if (errors.length) {
        console.log('\n❌ Base non jouable.');
        process.exit(1);
    }

    const cycle = Math.min(letters.drawable.length, clues.length);
    console.log(`\n✅ Base valide — cycle le plus court : ${cycle} jours (~${Math.round(cycle / 30)} mois avant répétition).`);
}

main();
