#!/usr/bin/env node
// server/scripts/photos/check.js
//
// Contrôle des photos déjà tranchées en administration, et rattrapage du
// Google Sheet pour les décisions prises avant sa synchronisation.
//
// Vérifie :
//   - fiche validée : l'image copiée existe et beatboxers.json la référence ;
//   - fiche rejetée : aucune photo n'a été ajoutée depuis par un autre moyen ;
//   - tout beatboxers.json : chaque local_image pointe vers un fichier présent
//     (une image manquante, c'est une manche cassée en jeu).
//
//   node scripts/photos/check.js            # rapport seul, ne modifie rien
//   node scripts/photos/check.js --sheet    # + recolore le Sheet (vert / rouge)
//
// Sort en code 1 s'il reste un problème : utilisable avant un déploiement.

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { normalizeName } = require('../shared/names');
const { colorNames } = require('../shared/sheet');
const review = require('../../services/photo-review');

const withSheet = process.argv.includes('--sheet');

function findInData(data, name) {
    return data.find((item) => item.title === name)
        || data.find((item) => normalizeName(item.title) === normalizeName(name))
        || null;
}

const exists = (file) => Boolean(file) && fs.existsSync(path.join(config.ARTISTS_DIR, file));

async function main() {
    const data = JSON.parse(fs.readFileSync(config.BUZZER_DATA_FILE, 'utf8'));
    const entries = review.listEntries();
    const approved = entries.filter((entry) => entry.status === 'approved');
    const rejected = entries.filter((entry) => entry.status === 'rejected');

    console.log(`🔎 Photos Buzzer — ${approved.length} validées, ${rejected.length} rejetées en administration\n`);

    const problems = [];
    const notes = [];
    const colors = new Map(); // nom -> couleur à appliquer dans le Sheet

    for (const entry of approved) {
        const item = findInData(data, entry.name);
        if (!exists(entry.approvedFile)) {
            problems.push(`${entry.name} : image validée introuvable (${entry.approvedFile})`);
        } else if (!item) {
            problems.push(`${entry.name} : absent de beatboxers.json`);
        } else if (item.local_image !== entry.approvedFile) {
            problems.push(`${entry.name} : beatboxers.json pointe vers « ${item.local_image || '(rien)'} » au lieu de « ${entry.approvedFile} »`);
        } else {
            colors.set(entry.name, 'green');
        }
    }

    for (const entry of rejected) {
        const item = findInData(data, entry.name);
        if (item?.local_image && exists(item.local_image)) {
            // Une photo est arrivée par un autre chemin (dépôt manuel + scan_images.py) : elle prime.
            notes.push(`${entry.name} : rejeté en administration, mais une photo est en place (${item.local_image})`);
            colors.set(entry.name, 'green');
        } else {
            colors.set(entry.name, 'red');
        }
    }

    const broken = data.filter((item) => item.local_image && !exists(item.local_image));
    broken.forEach((item) => problems.push(`${item.title} : local_image « ${item.local_image} » absent du dossier (manche cassée en jeu)`));

    notes.forEach((line) => console.log(`   ℹ️  ${line}`));
    problems.forEach((line) => console.log(`   ❌ ${line}`));
    if (!problems.length) console.log('   ✅ Aucune incohérence entre les décisions, les fichiers et beatboxers.json');

    if (withSheet) {
        if (!fs.existsSync(config.CREDENTIALS_FILE)) {
            console.error(`\n❌ ${config.CREDENTIALS_FILE} introuvable : impossible de mettre le Sheet à jour.`);
            process.exit(1);
        }
        const green = [...colors.values()].filter((color) => color === 'green').length;
        console.log(`\n📄 Google Sheet : ${green} noms en vert, ${colors.size - green} en rouge…`);
        const { cells, missing } = await colorNames({
            credentialsFile: config.CREDENTIALS_FILE,
            spreadsheetId: config.SPREADSHEET_ID,
            sheetNames: config.SHEET_NAMES,
            colors,
        });
        console.log(`   ✅ ${cells} cellules colorées`);
        if (missing.length) {
            console.log(`   ℹ️  ${missing.length} noms absents du Sheet (venus de beatboxers.json) : ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`);
        }
    } else if (colors.size) {
        console.log('\n👉 Ajoute --sheet pour recolorer le Google Sheet d\'après ces décisions.');
    }

    if (problems.length) {
        console.log(`\n❌ ${problems.length} problème(s). Une fiche validée se corrige en la rouvrant puis en la revalidant dans /admin.`);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('❌', error.message);
    process.exit(1);
});
