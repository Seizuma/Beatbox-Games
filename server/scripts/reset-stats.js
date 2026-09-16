#!/usr/bin/env node
/**
 * Remise à zéro des statistiques de BeatBox Games.
 *
 * À lancer dans le conteneur serveur :
 *   docker compose -p beatbox-games-prod exec server-prod node scripts/reset-stats.js
 *
 * Options :
 *   --yes            ne pas demander de confirmation
 *   --drop-users     supprimer aussi les comptes (déconnecte tout le monde)
 *   --keep-log       conserver le journal d'activité
 *   --no-backup      ne pas copier la base avant (déconseillé)
 *
 * Une copie horodatée de la base est faite avant toute suppression, dans le même
 * dossier data/, donc dans le volume Docker.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);

const options = {
    skipConfirm: has('--yes') || has('-y'),
    keepUsers: !has('--drop-users'),
    keepLog: has('--keep-log'),
    backup: !has('--no-backup'),
};

const dbPath = path.join(process.cwd(), 'data', 'beatbox_stats.db');

function backupDatabase() {
    if (!fs.existsSync(dbPath)) {
        console.error(`❌ Base introuvable : ${dbPath}`);
        process.exit(1);
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(path.dirname(dbPath), `beatbox_stats.before-reset-${stamp}.db`);
    fs.copyFileSync(dbPath, target);
    console.log(`💾 Sauvegarde écrite : ${target}`);
    return target;
}

async function confirm(question) {
    if (options.skipConfirm) return true;

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => rl.question(question, resolve));
    rl.close();
    return answer.trim() === 'RESET';
}

(async () => {
    console.log('🧨 Remise à zéro des statistiques BeatBox Games');
    console.log(`   Base       : ${dbPath}`);
    console.log(`   Comptes    : ${options.keepUsers ? 'conservés' : 'SUPPRIMÉS'}`);
    console.log(`   Journal    : ${options.keepLog ? 'conservé' : 'effacé'}`);
    console.log(`   Sauvegarde : ${options.backup ? 'oui' : 'NON'}`);
    console.log('');

    const ok = await confirm('Tape RESET pour confirmer (toute autre saisie annule) : ');
    if (!ok) {
        console.log('Annulé, rien n\'a été touché.');
        process.exit(0);
    }

    if (options.backup) backupDatabase();

    const { getDatabase } = require('../services/database');
    const db = getDatabase();

    const result = db.resetStatistics({ keepUsers: options.keepUsers, keepLog: options.keepLog });

    console.log('');
    console.log('Avant :');
    result.before.forEach((row) => console.log(`   ${row.table.padEnd(22)} ${row.rows}`));
    console.log('Après :');
    result.after.forEach((row) => console.log(`   ${row.table.padEnd(22)} ${row.rows}`));

    db.logEvent({
        level: 'warn',
        type: 'admin',
        message: 'Remise à zéro des statistiques via scripts/reset-stats.js',
        context: { keepUsers: options.keepUsers },
    });

    db.close();
    console.log('');
    console.log('✅ Terminé. Redémarre le serveur pour vider le cache du classement :');
    console.log('   docker compose -p beatbox-games-prod restart server-prod');
})();
