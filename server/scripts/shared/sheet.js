// server/scripts/shared/sheet.js
//
// Lecture du Google Sheet des battles avec le compte de service déjà utilisé
// par les scripts Python (credentials.json). Pas de SDK Google : un jeton
// JWT signé avec jsonwebtoken (déjà en dépendance) suffit pour l'API REST.
//
// Code couleur du Sheet, repris de scan_images.py :
//   vert  = photo présente
//   rouge = beatboxer écarté volontairement (pas de photo possible, doublon…)
//   blanc = photo manquante : c'est la liste de travail du pipeline photos.

const fs = require('fs');
const jwt = require('jsonwebtoken');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

async function getAccessToken(credentialsFile, scope) {
    const credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt.sign(
        { iss: credentials.client_email, scope, aud: TOKEN_URL, iat: now, exp: now + 3600 },
        credentials.private_key,
        { algorithm: 'RS256' },
    );

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    if (!response.ok) throw new Error(`Authentification Google refusée (HTTP ${response.status})`);
    return (await response.json()).access_token;
}

const isRed = (color) => {
    if (!color) return false;
    const { red = 0, green = 0, blue = 0 } = color;
    return red > 0.5 && green < 0.5 && blue < 0.5;
};

const isGreen = (color) => {
    if (!color) return false;
    const { red = 0, green = 0, blue = 0 } = color;
    return green > 0.5 && red < 0.5 && blue < 0.5;
};

/**
 * Lit les feuilles et renvoie une entrée par nom unique.
 * La première ligne de chaque feuille porte le nom de l'événement.
 *
 * @returns {Promise<Array<{ name: string, events: string[], status: 'missing'|'done'|'excluded' }>>}
 */
async function readBattleSheet({ credentialsFile, spreadsheetId, sheetNames }) {
    const token = await getAccessToken(credentialsFile, 'https://www.googleapis.com/auth/spreadsheets.readonly');
    const params = new URLSearchParams({
        includeGridData: 'true',
        fields: 'sheets(properties.title,data.rowData.values(formattedValue,effectiveFormat.backgroundColor))',
    });
    sheetNames.forEach((name) => params.append('ranges', `'${name}'`));

    const response = await fetch(`${SHEETS_URL}/${spreadsheetId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Lecture du Sheet impossible (HTTP ${response.status})`);
    const data = await response.json();

    const people = new Map(); // nom -> { name, events:Set, colors:Set }
    for (const sheet of data.sheets || []) {
        const rows = sheet.data?.[0]?.rowData || [];
        const header = (rows[0]?.values || []).map((cell) => (cell.formattedValue || '').trim());

        rows.slice(1).forEach((row) => {
            (row.values || []).forEach((cell, column) => {
                const name = (cell.formattedValue || '').trim();
                const event = header[column];
                if (!name || !event) return;

                const entry = people.get(name) || { name, events: new Set(), red: false, green: false };
                entry.events.add(event);
                const color = cell.effectiveFormat?.backgroundColor;
                if (isRed(color)) entry.red = true;
                if (isGreen(color)) entry.green = true;
                people.set(name, entry);
            });
        });
    }

    return [...people.values()].map((entry) => ({
        name: entry.name,
        events: [...entry.events].sort(),
        // Le rouge l'emporte : une seule cellule rouge suffit à écarter le nom,
        // comme la propagation de scan_images.py.
        status: entry.red ? 'excluded' : entry.green ? 'done' : 'missing',
    }));
}

module.exports = { readBattleSheet };
