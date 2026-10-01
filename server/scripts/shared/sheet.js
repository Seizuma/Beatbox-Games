// server/scripts/shared/sheet.js
//
// Lecture et coloration du Google Sheet des battles avec le compte de service
// déjà utilisé par les scripts Python (credentials.json). Pas de SDK Google : un jeton
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

// Un jeton vaut une heure : le serveur, qui colore le Sheet à chaque
// décision, le garde en mémoire au lieu d'en redemander un à chaque clic.
const tokenCache = new Map(); // `${fichier}|${portée}` -> { token, expiresAt }

async function getAccessToken(credentialsFile, scope) {
    const cacheKey = `${credentialsFile}|${scope}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 60000) return cached.token;

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
    const { access_token: token, expires_in: expiresIn = 3600 } = await response.json();
    tokenCache.set(cacheKey, { token, expiresAt: Date.now() + expiresIn * 1000 });
    return token;
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

// --- Écriture : couleur des cellules d'un nom ----------------------------------

// Mêmes valeurs que scan_images.py, qui relit ces couleurs.
const COLORS = {
    green: { red: 0, green: 0.8, blue: 0 },
    red: { red: 1, green: 0, blue: 0 },
    white: { red: 1, green: 1, blue: 1 },
};

// Même comparaison que normalize() de scan_images.py : casse et espaces.
const sheetName = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Les positions des noms bougent rarement (update_sheet.py ajoute en bas de
// colonne) : deux minutes de cache évitent une lecture complète par clic.
const gridCache = new Map(); // spreadsheetId -> { at, sheets: [{ sheetId, title, values }] }
const GRID_TTL_MS = 2 * 60 * 1000;

async function readGrid(token, spreadsheetId, sheetNames) {
    const cached = gridCache.get(spreadsheetId);
    if (cached && Date.now() - cached.at < GRID_TTL_MS) return cached.sheets;

    const headers = { Authorization: `Bearer ${token}` };
    const meta = await fetch(`${SHEETS_URL}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`, { headers });
    if (!meta.ok) throw new Error(`Lecture du Sheet impossible (HTTP ${meta.status})`);
    const ids = new Map((await meta.json()).sheets.map((sheet) => [sheet.properties.title, sheet.properties.sheetId]));

    const params = new URLSearchParams();
    sheetNames.forEach((name) => params.append('ranges', `'${name}'`));
    const values = await fetch(`${SHEETS_URL}/${spreadsheetId}/values:batchGet?${params}`, { headers });
    if (!values.ok) throw new Error(`Lecture du Sheet impossible (HTTP ${values.status})`);
    const ranges = (await values.json()).valueRanges || [];

    const sheets = sheetNames
        .map((title, index) => ({ title, sheetId: ids.get(title), values: ranges[index]?.values || [] }))
        .filter((sheet) => sheet.sheetId !== undefined);
    gridCache.set(spreadsheetId, { at: Date.now(), sheets });
    return sheets;
}

/**
 * Colore toutes les cellules qui portent ce nom, dans toutes les feuilles.
 * La ligne d'en-tête (noms d'événements) n'est jamais touchée.
 *
 * @param {'green'|'red'|'white'} color
 * @returns {Promise<number>} nombre de cellules colorées (0 si le nom est absent du Sheet)
 */
async function colorNameCells({ credentialsFile, spreadsheetId, sheetNames, name, color }) {
    const token = await getAccessToken(credentialsFile, 'https://www.googleapis.com/auth/spreadsheets');
    const sheets = await readGrid(token, spreadsheetId, sheetNames);
    const target = sheetName(name);

    const requests = [];
    sheets.forEach((sheet) => {
        sheet.values.forEach((row, rowIndex) => {
            if (rowIndex === 0) return;
            row.forEach((cell, columnIndex) => {
                if (sheetName(cell) !== target) return;
                requests.push({
                    repeatCell: {
                        range: {
                            sheetId: sheet.sheetId,
                            startRowIndex: rowIndex,
                            endRowIndex: rowIndex + 1,
                            startColumnIndex: columnIndex,
                            endColumnIndex: columnIndex + 1,
                        },
                        cell: { userEnteredFormat: { backgroundColor: COLORS[color] } },
                        fields: 'userEnteredFormat.backgroundColor',
                    },
                });
            });
        });
    });
    if (requests.length === 0) return 0;

    const response = await fetch(`${SHEETS_URL}/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
    });
    if (!response.ok) throw new Error(`Écriture dans le Sheet refusée (HTTP ${response.status})`);
    return requests.length;
}

module.exports = { readBattleSheet, colorNameCells };
