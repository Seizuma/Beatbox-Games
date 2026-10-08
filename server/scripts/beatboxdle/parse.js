// server/scripts/beatboxdle/parse.js
//
// Tout le parsing HTML est ici, isolé du réseau : c'est la partie qui cassera
// le jour où beatbox.world changera son gabarit, autant qu'elle soit relisible
// d'un seul tenant et vérifiable avec `npm run beatboxdle:inspect`.
//
// Parti pris : on s'appuie sur les URL (href) et sur le texte, jamais sur les
// classes CSS. Les URL d'un site d'archive sont sa partie la plus stable.

const cheerio = require('cheerio');
const config = require('./config');
const { flagToCode } = require('./countries');

const clean = (text) => (text || '').replace(/\s+/g, ' ').trim();

const FLAG_RE = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
const FLAG_RE_ALL = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;

// --- Disciplines ---------------------------------------------------------
// Testées dans l'ordre : « Draft Tag Team » doit tomber sur tag-team, pas sur team.
const DISCIPLINES = [
    { id: 'loopstation', match: /loopstation/i },
    { id: 'tag-team', match: /tag ?team/i },
    { id: 'crew', match: /\bcrew\b|équipes|\bteam battle\b/i },
    { id: 'solo', match: /\bsolo\b|7 ?to ?smoke|shootout|\bbattles?\b|showcase/i },
];

// --- Genre ---------------------------------------------------------------
// beatbox.world n'expose pas le genre : on le déduit du nom des catégories
// genrées (Men's Solo, Solo Femmes…). « Solo Mixte » ne dit rien, on l'ignore.
// Les femmes sont testées en premier : \b protège déjà « Women's » de /\bmen's\b/,
// mais l'ordre rend l'intention explicite.
// Le wiki écrit « Women Solo » / « Men Solo », beatbox.world « Women's Solo » :
// l'apostrophe et le s sont facultatifs.
const FEMALE_RE = /\bwom[ae]n(?:'?s)?\b|\bfemmes\b|\bfemales?\b|\bladies\b|\bgirls?\b/i;
const MALE_RE = /\bmen(?:'?s)?\b|\bhommes\b|\bmales?\b|\bboys?\b/i;

function detectDiscipline(text) {
    const found = DISCIPLINES.find((discipline) => discipline.match.test(text));
    return found ? found.id : null;
}

function detectGender(text) {
    if (FEMALE_RE.test(text)) return 'F';
    if (MALE_RE.test(text)) return 'M';
    return null;
}

function detectPlacement(text) {
    const tail = clean(text);
    return config.PLACEMENTS.find((placement) => placement.match.test(tail)) || null;
}

/**
 * Page /events?year=YYYY -> [{ slug, title }]
 * Les titres du site coupent l'édition en italique (« Grand Beatbox Battle » +
 * « 2026 ») : on reprend le texte complet du lien, la regex de série s'en sort.
 */
function parseEventList(html) {
    const $ = cheerio.load(html);
    const events = new Map();

    $('a[href]').each((_, element) => {
        const href = $(element).attr('href') || '';
        const match = href.match(/^(?:https:\/\/beatbox\.world)?\/events\/([a-z0-9][a-z0-9-]*)\/?$/i);
        if (!match) return;
        const slug = match[1];
        const title = clean($(element).text());
        if (!title) return;
        // Un même événement apparaît plusieurs fois (à venir + archive) :
        // on garde le libellé le plus long, qui contient l'édition.
        const previous = events.get(slug);
        if (!previous || title.length > previous.length) events.set(slug, title);
    });

    return [...events.entries()].map(([slug, title]) => ({ slug, title }));
}

/** Page /events/<slug> -> identifiants des catégories. */
function parseEventCategories(html, eventSlug) {
    const $ = cheerio.load(html);
    const ids = new Set();
    const pattern = new RegExp(`/events/${eventSlug}/categories/(\\d+)`, 'i');

    $('a[href]').each((_, element) => {
        const match = ($(element).attr('href') || '').match(pattern);
        if (match) ids.add(match[1]);
    });

    return [...ids];
}

/**
 * Page d'une catégorie -> tous les beatboxers cités (participants, juges,
 * battles confondus). On ne cherche pas à trier ici : c'est le profil de chacun
 * qui dira s'il a réellement battlé. Discovery large, filtrage strict ensuite.
 */
function parseCategoryBeatboxers(html) {
    const $ = cheerio.load(html);
    const found = new Map();

    $('a[href]').each((_, element) => {
        const href = $(element).attr('href') || '';
        const match = href.match(/^(?:https:\/\/beatbox\.world)?\/beatboxers\/([a-z0-9][a-z0-9-]*)\/?$/i);
        if (!match) return;
        const slug = match[1];
        const text = clean($(element).text());
        const flag = (text.match(FLAG_RE) || [])[0] || null;
        const previous = found.get(slug);
        if (!previous || (!previous.flag && flag)) {
            found.set(slug, { slug, flag, code: flagToCode(flag) });
        }
    });

    return [...found.values()];
}

/**
 * Page /beatboxers/<slug> -> tout ce dont Beatboxdle a besoin.
 *
 * Les entrées de carrière et les catégories jugées partagent le même motif
 * d'URL (#beatboxer:<slug>). Ce qui les distingue de façon fiable : une entrée
 * de carrière se termine par un classement (Champion, Top 16, Participant…),
 * une catégorie jugée se termine par une année. On ne garde donc que les liens
 * dont le texte se termine par un classement connu.
 */
function parseProfile(html, slug) {
    const $ = cheerio.load(html);

    // Les comptes revendiqués portent un badge dans le <h1> : « PACMax official
    // account ». Sans ce nettoyage il finit dans le nom affiché et, en mode
    // lettres, dans la longueur du mot à deviner.
    const name = clean($('h1').first().text()).replace(/(\s*official account\s*)+$/i, '').trim();
    const description = $('meta[name="description"]').attr('content') || '';

    const countryEn = (description.match(/beatboxer from ([^:]+):/i) || [])[1] || null;
    const eventCount = Number((description.match(/(\d+)\s+competition entr/i) || [])[1]) || null;
    const titleCount = Number((description.match(/(\d+)\s+titles?/i) || [])[1]) || null;
    const elo = Number((description.match(/Elo\s+(\d+)/i) || [])[1]) || null;

    const entries = [];
    $('a[href*="#beatboxer:"]').each((_, element) => {
        const href = $(element).attr('href') || '';
        const eventMatch = href.match(/\/events\/([a-z0-9-]+)\/categories\/(\d+)#beatboxer:([a-z0-9-]+)/i);
        if (!eventMatch) return;
        if (eventMatch[3].toLowerCase() !== slug.toLowerCase()) return;

        const text = clean($(element).text());
        const placement = detectPlacement(text);
        if (!placement) return; // catégorie jugée ou wildcard : ce n'est pas un résultat

        // Le dernier drapeau de la ligne est celui du pays hôte : ceux des
        // coéquipiers (« · with SkilleR🇧🇬 ») le précèdent toujours.
        const flags = text.match(FLAG_RE_ALL) || [];

        entries.push({
            eventSlug: eventMatch[1],
            categoryId: eventMatch[2],
            text,
            eventName: clean($(element).find('strong').first().text()) || null,
            placementId: placement.id,
            tier: placement.tier,
            discipline: detectDiscipline(text),
            gender: detectGender(text),
            hostCode: flagToCode(flags[flags.length - 1] || null),
            year: Number((text.match(/\b(19|20)\d{2}\b/) || [])[0]) || null,
        });
    });

    return {
        slug,
        name,
        countryEn,
        eventCount,
        titleCount,
        elo,
        image: $('meta[property="og:image"]').attr('content') || null,
        ...parseProfileMedia($),
        entries,
    };
}

/**
 * Photo de profil, vidéos et chaîne YouTube d'une fiche beatboxer.
 *
 * - photo : première image hébergée sous /beatboxers/ et affichée en grand.
 *   Les avatars de coéquipiers (16-40 px) partagent le même chemin, la taille
 *   d'affichage les distingue.
 * - videos : identifiants YouTube des vignettes listées sur la fiche. Ce sont
 *   des vidéos où le beatboxer apparaît — bien plus sûr qu'une recherche.
 * - youtubeChannel : lien de chaîne déclaré par le beatboxer.
 */
function parseProfileMedia($) {
    let photo = null;
    $('img[src]').each((_, element) => {
        if (photo) return;
        const src = $(element).attr('src') || '';
        const width = Number($(element).attr('width')) || 0;
        if (/\/beatboxers\/\d+\//.test(src) && width >= 100) photo = src;
    });

    const videos = [];
    $('img[src*="i.ytimg.com/vi/"]').each((_, element) => {
        const id = (($(element).attr('src') || '').match(/\/vi\/([\w-]{11})\//) || [])[1];
        if (id && !videos.includes(id)) videos.push(id);
    });

    const youtubeChannel = $('a[href*="youtube.com/"]')
        .map((_, element) => $(element).attr('href'))
        .get()
        .find((href) => /youtube\.com\/(@|channel\/|c\/|user\/)/i.test(href)) || null;

    return { photo, videos, youtubeChannel };
}

/**
 * Page /search?q=… -> [{ type, slug, name, code, hasPhoto }]
 * `type` vaut 'beatboxer' ou 'team' (duo, tag team, crew : /teams/<slug>).
 * Le nom est le texte du lien, débarrassé de l'initiale d'avatar (« M Max 🇷🇺 »
 * quand il n'y a pas de photo) et du drapeau.
 */
function parseSearchResults(html) {
    const $ = cheerio.load(html);
    const results = new Map();

    $('a[href]').each((_, element) => {
        const href = $(element).attr('href') || '';
        const match = href.match(/^(?:https:\/\/beatbox\.world)?\/(beatboxers|teams)\/([a-z0-9][a-z0-9-]*)\/?$/i);
        if (!match) return;
        const type = match[1].toLowerCase() === 'teams' ? 'team' : 'beatboxer';
        const id = `${type}:${match[2]}`;
        if (results.has(id)) return;

        const link = $(element).clone();
        link.find('[aria-hidden="true"]').remove(); // l'initiale de l'avatar
        const text = clean(link.text());
        const flag = (text.match(FLAG_RE) || [])[0] || null;

        results.set(id, {
            type,
            slug: match[2],
            name: clean(text.replace(FLAG_RE_ALL, '')).replace(/(\s*official account\s*)+$/i, '').trim(),
            code: flagToCode(flag),
            hasPhoto: $(element).find('img[src*="/beatboxers/"], img[src*="/teams/"]').length > 0,
        });
    });

    return [...results.values()];
}

/**
 * Page /teams/<slug> -> duo, tag team ou crew.
 * La meta description dit tout en une phrase : « 84 Funeral, France beatbox
 * tag team formed by Dol & Era: 3 competition entries. » Les membres sont les
 * liens /beatboxers/ ; la photo d'équipe, quand elle existe, est la seule
 * image /teams/ affichée en grand.
 */
function parseTeamPage(html, slug) {
    const $ = cheerio.load(html);
    const description = $('meta[name="description"]').attr('content') || '';

    const kindText = (description.match(/beatbox\s+(tag team|crew|duo|trio|team|group)\b/i) || [])[1] || 'team';
    const kind = /crew|group|trio/i.test(kindText) ? 'crew' : 'tag-team';

    const members = new Map();
    $('a[href^="/beatboxers/"]').each((_, element) => {
        const memberSlug = (($(element).attr('href') || '').match(/^\/beatboxers\/([a-z0-9-]+)\/?$/i) || [])[1];
        if (memberSlug && !members.has(memberSlug)) {
            members.set(memberSlug, { slug: memberSlug, name: clean($(element).text().replace(FLAG_RE_ALL, '')) || memberSlug });
        }
    });
    // Les noms de la description font foi : les liens peuvent inclure d'anciens membres.
    const formedBy = (description.match(/formed by ([^:]+):/i) || [])[1];
    const memberNames = formedBy ? formedBy.split(/\s*(?:,|&|\band\b)\s*/).map(clean).filter(Boolean) : [];

    let photo = null;
    $('img[src]').each((_, element) => {
        const src = $(element).attr('src') || '';
        if (!photo && /\/teams\/\d+\//.test(src) && (Number($(element).attr('width')) || 0) >= 100) photo = src;
    });

    const videos = [];
    $('img[src*="i.ytimg.com/vi/"]').each((_, element) => {
        const id = (($(element).attr('src') || '').match(/\/vi\/([\w-]{11})\//) || [])[1];
        if (id && !videos.includes(id)) videos.push(id);
    });

    return {
        slug,
        name: clean($('h1').first().text()) || slug,
        kind,
        countryEn: (description.match(/^[^,]+,\s*([^,]+?)\s+beatbox\b/i) || [])[1] || null,
        members: memberNames.length ? memberNames : [...members.values()].map((member) => member.name),
        photo,
        videos,
    };
}

module.exports = {
    clean,
    detectDiscipline,
    detectGender,
    detectPlacement,
    parseEventList,
    parseEventCategories,
    parseCategoryBeatboxers,
    parseProfile,
    parseProfileMedia,
    parseSearchResults,
    parseTeamPage,
};