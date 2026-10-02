// server/scripts/sources/youtube.js
//
// YouTube sans clé d'API : la page de résultats embarque ses données dans
// `ytInitialData`, un JSON stable depuis des années. Si un jour il disparaît,
// la recherche renvoie simplement une liste vide et le pipeline continue avec
// les deux autres sources.
//
// Pour chaque vidéo, YouTube expose sans rien télécharger :
//   - maxresdefault.jpg : la miniature choisie par l'auteur (1280×720) ;
//   - maxres1/2/3.jpg (ou hq1/2/3) : trois images extraites automatiquement à
//     25, 50 et 75 % de la vidéo — de vrais arrêts sur image, que
//     photos/faces.py passe ensuite à la détection de visage.

const { looseName } = require('../shared/names');

const BROWSER_HEADERS = {
    // Une page de recherche servie à un robot déclaré reste exploitable, mais
    // sans ce cookie l'Europe reçoit le mur de consentement à la place.
    Cookie: 'SOCS=CAI; CONSENT=YES+1',
    'Accept-Language': 'en-US,en;q=0.8',
};

function extractInitialData(html) {
    const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch (error) {
        return null;
    }
}

function collectVideoRenderers(node, out = []) {
    if (!node || typeof node !== 'object') return out;
    if (node.videoRenderer) {
        const video = node.videoRenderer;
        out.push({
            id: video.videoId,
            title: (video.title?.runs || []).map((run) => run.text).join(''),
            channel: video.ownerText?.runs?.[0]?.text || '',
            duration: video.lengthText?.simpleText || '',
        });
    }
    for (const key of Object.keys(node)) collectVideoRenderers(node[key], out);
    return out;
}

/**
 * Note de pertinence d'une vidéo pour trouver le VISAGE d'un beatboxer :
 * son nom dans le titre est indispensable ; un « vs » signale un battle à
 * deux visages, une compilation ou un showcase n'en montre qu'un.
 */
function scoreVideo(video, name) {
    const title = video.title || '';
    const words = title.split(/[\s|:·•\-–—/()[\]]+/).map(looseName).filter(Boolean);
    const target = looseName(name);
    // Le nom doit apparaître comme mot entier : « Max » ne doit pas valider « Maxime ».
    const hasName = words.includes(target) || (target.length >= 6 && looseName(title).includes(target));
    if (!hasName) return 0;

    let score = 2;
    if (!/\bvs\.?\b|\bversus\b/i.test(title)) score += 2;
    if (/showcase|elimination|wildcard|solo|compilation|interview|routine|live/i.test(title)) score += 1;
    if (/reaction|tutorial|how to|cover by|meme|shorts?\b/i.test(title)) score -= 2;
    return score;
}

/**
 * Cherche des vidéos où le beatboxer apparaît seul, les plus pertinentes d'abord.
 * @returns {Promise<Array<{ id, title, channel, score }>>}
 */
async function searchVideos(client, name, { limit = 3 } = {}) {
    const query = `${name} beatbox`;
    const html = await client.fetchText(
        `https://www.youtube.com/results?${new URLSearchParams({ search_query: query, hl: 'en' })}`,
        { headers: BROWSER_HEADERS },
    );
    if (!html) return [];
    const data = extractInitialData(html);
    if (!data) return [];

    const seen = new Set();
    return collectVideoRenderers(data)
        .filter((video) => video.id && !seen.has(video.id) && seen.add(video.id))
        .map((video) => ({ ...video, score: scoreVideo(video, name) }))
        .filter((video) => video.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

/** Photo de profil d'une chaîne, agrandie à 800 px. */
async function channelAvatar(client, channelUrl) {
    if (!channelUrl) return null;
    const url = channelUrl.replace(/^http:/, 'https:').replace('//youtube.com', '//www.youtube.com');
    const html = await client.fetchText(url, { headers: BROWSER_HEADERS });
    if (!html) return null;
    const image = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
    if (!image || !/yt3\.(googleusercontent|ggpht)\.com/.test(image)) return null;
    return image.replace(/=s\d+-/, '=s800-');
}

/**
 * Images d'une vidéo à essayer, dans l'ordre. Chaque groupe est une liste de
 * repli : la haute définition n'existe pas pour toutes les vidéos.
 */
const videoFrames = (id) => [
    { kind: 'thumbnail', urls: [`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`] },
    { kind: 'frame-25', urls: [`https://i.ytimg.com/vi/${id}/maxres1.jpg`, `https://i.ytimg.com/vi/${id}/hq1.jpg`] },
    { kind: 'frame-50', urls: [`https://i.ytimg.com/vi/${id}/maxres2.jpg`, `https://i.ytimg.com/vi/${id}/hq2.jpg`] },
    { kind: 'frame-75', urls: [`https://i.ytimg.com/vi/${id}/maxres3.jpg`, `https://i.ytimg.com/vi/${id}/hq3.jpg`] },
];

const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

module.exports = { searchVideos, channelAvatar, videoFrames, watchUrl, scoreVideo };
