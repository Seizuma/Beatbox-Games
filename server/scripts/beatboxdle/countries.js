// server/scripts/beatboxdle/countries.js
//
// Le pays est un indice à trois états : vert (même pays), orange (même
// continent), gris (rien en commun). Il faut donc un code ISO et un continent.
// Le nom affiché vient d'Intl : Node 20 embarque l'ICU complet, inutile de
// maintenir une table de traductions.

const GROUPS = {
    Europe: 'AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK',
    Asie: 'AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TM TR TW UZ VN YE',
    Afrique: 'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SL SN SO SS ST SZ TD TG TN TZ UG ZA ZM ZW',
    'Amérique du Nord': 'AG AI AW BB BL BM BS BZ CA CR CU CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS MX NI PA PR SV SX TC TT US VC VG VI',
    'Amérique du Sud': 'AR BO BR CL CO EC FK GF GY PE PY SR UY VE',
    Océanie: 'AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PW SB TO TV VU WF WS',
};

const CONTINENT_BY_CODE = {};
for (const [continent, codes] of Object.entries(GROUPS)) {
    for (const code of codes.split(' ')) CONTINENT_BY_CODE[code] = continent;
}

const displayFr = new Intl.DisplayNames(['fr'], { type: 'region' });
const displayEn = new Intl.DisplayNames(['en'], { type: 'region' });

// Index inverse « nom anglais -> code », pour retrouver le code quand seule la
// meta description du profil est disponible (« beatboxer from France »).
const CODE_BY_ENGLISH_NAME = {};
for (const code of Object.keys(CONTINENT_BY_CODE)) {
    try {
        CODE_BY_ENGLISH_NAME[displayEn.of(code).toLowerCase()] = code;
    } catch (error) {
        // Code non reconnu par l'ICU : sans importance, il ne sortira jamais du site.
    }
}
// Quelques formes rencontrées sur beatbox.world qui diffèrent de l'ICU.
Object.assign(CODE_BY_ENGLISH_NAME, {
    'south korea': 'KR',
    'north korea': 'KP',
    russia: 'RU',
    'united states of america': 'US',
    'czech republic': 'CZ',
    'hong kong': 'HK',
    macau: 'MO',
    vietnam: 'VN',
    taiwan: 'TW',
    'ivory coast': 'CI',
});

/** Convertit un drapeau emoji (🇫🇷) en code ISO alpha-2 (FR). */
function flagToCode(flag) {
    if (!flag) return null;
    const points = [...flag].map((char) => char.codePointAt(0));
    if (points.length < 2) return null;
    const letters = points
        .filter((point) => point >= 0x1f1e6 && point <= 0x1f1ff)
        .map((point) => String.fromCharCode(point - 0x1f1e6 + 65));
    return letters.length === 2 ? letters.join('') : null;
}

/** Retrouve un code ISO à partir du nom anglais du pays. */
function codeFromEnglishName(name) {
    if (!name) return null;
    return CODE_BY_ENGLISH_NAME[name.trim().toLowerCase()] || null;
}

/** Nom français du pays, pour l'affichage dans la grille d'indices. */
function frenchName(code) {
    if (!code) return null;
    try {
        return displayFr.of(code);
    } catch (error) {
        return code;
    }
}

const continentOf = (code) => (code ? CONTINENT_BY_CODE[code] || null : null);

module.exports = { flagToCode, codeFromEnglishName, frenchName, continentOf };