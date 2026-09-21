#!/usr/bin/env node
// server/scripts/beatboxdle/analyse-indices.js
//
// Mesure le pouvoir discriminant des indices candidats sur TES données, avant
// d'en coder un. À lancer sur raw/profiles.json, donc sans toucher au réseau.
//
// Deux chiffres par indice :
//   « collision » = probabilité que deux beatboxers tirés au hasard aient la
//                   même valeur. C'est la mesure qui compte : plus elle est
//                   basse, plus un essai coupe l'espace de recherche.
//                   Repère : la colonne « catégorie » actuelle est à ~96 %.
//   « orange »    = part des paires qui tomberaient en correspondance partielle
//                   (même continent, ±2 ans, ensembles qui se recoupent…).
//
//   node scripts/beatboxdle/analyse-indices.js

const fs = require('fs');
const config = require('./config');

/** Probabilité que deux tirages au hasard donnent la même valeur (indice de Simpson). */
function collision(values) {
    const counts = new Map();
    values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    const n = values.length;
    let sum = 0;
    counts.forEach((c) => { sum += (c / n) ** 2; });
    return { rate: sum, distinct: counts.size, top: [...counts.entries()].sort((a, b) => b[1] - a[1])[0] };
}

/** Part des paires en correspondance partielle, selon une fonction de proximité. */
function partial(values, near) {
    let hits = 0;
    let pairs = 0;
    for (let i = 0; i < values.length; i += 1) {
        for (let j = i + 1; j < values.length; j += 1) {
            pairs += 1;
            if (values[i] !== values[j] && near(values[i], values[j])) hits += 1;
        }
    }
    return pairs ? hits / pairs : 0;
}

const pct = (x) => `${(x * 100).toFixed(1)} %`;

function report(label, values, nearFn) {
    const usable = values.filter((v) => v !== null && v !== undefined && v !== '');
    if (usable.length === 0) {
        console.log(`   ${label.padEnd(34)} aucune donnée`);
        return;
    }
    const { rate, distinct, top } = collision(usable);
    const coverage = usable.length / values.length;
    const orange = nearFn ? partial(usable, nearFn) : null;

    console.log(
        `   ${label.padEnd(34)} ${String(distinct).padStart(3)} valeurs · ` +
        `collision ${pct(rate).padStart(7)}` +
        (orange !== null ? ` · orange ${pct(orange).padStart(7)}` : '          ') +
        ` · couverture ${pct(coverage).padStart(7)}` +
        ` · top « ${top[0]} » ${pct(top[1] / usable.length)}`,
    );
}

function main() {
    if (!fs.existsSync(config.PROFILES_FILE)) {
        console.error(`❌ ${config.PROFILES_FILE} introuvable. Lance d'abord npm run beatboxdle:profiles`);
        process.exit(1);
    }

    const { profiles } = JSON.parse(fs.readFileSync(config.PROFILES_FILE, 'utf8'));
    console.log(`🎤 Pouvoir discriminant des indices — ${profiles.length} profils\n`);

    const years = (p) => p.entries.map((e) => e.year).filter(Boolean);
    const disciplines = (p) => [...new Set(p.entries.map((e) => e.discipline).filter(Boolean))].sort();
    const mainCat = (p) => {
        const counts = new Map();
        p.entries.forEach((e) => { if (e.discipline) counts.set(e.discipline, (counts.get(e.discipline) || 0) + 1); });
        if (!counts.size) return null;
        const max = Math.max(...counts.values());
        return [...counts.entries()].find(([, c]) => c === max)[0];
    };

    console.log('   — Les quatre colonnes actuelles —');
    report('Catégorie principale (actuel)', profiles.map(mainCat));
    report('Genre', profiles.map((p) => p.entries.map((e) => e.gender).filter(Boolean)[0] || null));
    report('Pays', profiles.map((p) => p.code || p.countryEn));
    report('Meilleur titre', profiles.map((p) => {
        const majors = p.entries.filter((e) => e.series);
        if (!majors.length) return null;
        const best = majors.reduce((w, e) => (!w || e.tier > w.tier ? e : w), null);
        return `${best.series}-${best.placementId}`;
    }));

    console.log('\n   — Les cinq candidats —');
    report('1 · Première apparition (année)',
        profiles.map((p) => (years(p).length ? Math.min(...years(p)) : null)),
        (a, b) => Math.abs(a - b) <= 2);
    report('2 · Événements en carrière',
        profiles.map((p) => p.eventCount || null),
        (a, b) => Math.abs(a - b) <= 3);
    report('3 · Disciplines (ensemble)',
        profiles.map((p) => (disciplines(p).length ? disciplines(p).join('+') : null)),
        (a, b) => a.split('+').some((d) => b.split('+').includes(d)));
    report('4 · Niveau beatbox.world',
        profiles.map((p) => p.tier || null));
    report('5 · Participations aux majors',
        profiles.map((p) => p.entries.filter((e) => e.series).length || null),
        (a, b) => Math.abs(a - b) <= 1);

    console.log('\n   Rappel : « collision » = deux beatboxers au hasard ont la même valeur.');
    console.log('   Plus c\'est bas, plus l\'indice apprend quelque chose au joueur.');
    console.log('   Le candidat 4 reste vide tant que parse.js ne lit pas le niveau sur la fiche.\n');
}

main();