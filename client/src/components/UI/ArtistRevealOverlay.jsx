import React from 'react';
import { createShowT, LEVEL_POINTS } from '../../utils/showI18n';
import { createSiteT } from '../../utils/siteI18n';
import { countryName, titleName } from '../../utils/beatboxdleLabels';
import { useArtistCard } from '../../utils/artistCard';

/**
 * Révélation de l'artiste à la fin d'une manche.
 *
 * Plus qu'un nom : sa photo, son pays et son meilleur titre quand on les
 * connaît, puis qui l'a trouvé et à quel extrait. C'est le moment où l'on
 * découvre un beatboxer qu'on ne connaissait pas, autant qu'il se voie.
 *
 * @param {object} artistRevealState - { show, artist, finds: [{ pseudo, level }], isExiting }
 */
const ArtistRevealOverlay = ({ artistRevealState, language = 'fr', pseudo }) => {
    const artist = artistRevealState?.show ? artistRevealState.artist : null;
    const card = useArtistCard(artist);

    if (!artistRevealState?.show) return null;

    const st = createShowT(language);
    const siteT = createSiteT(language);
    const finds = (artistRevealState.finds || []).slice().sort((a, b) => a.level - b.level);
    const country = card?.countryCode ? countryName(language, card.countryCode) : null;
    const title = card?.bestTitle ? titleName(siteT, card.bestTitle, language) : null;

    return (
        <div
            role="status"
            aria-live="polite"
            className={`show-surface fixed inset-0 z-40 flex items-center justify-center bg-show-night/80 px-5 font-show transition-opacity duration-500 ${artistRevealState.isExiting ? 'opacity-0' : 'opacity-100'}`}
        >
            <div className="show-pop w-full max-w-sm overflow-hidden rounded-2xl bg-show-white text-center text-show-night shadow-2xl">
                {card?.photoUrl && (
                    <img
                        src={card.photoUrl}
                        alt={st('reveal.photoAlt', { name: card.name || artist })}
                        className="h-44 w-full object-cover object-top sm:h-52"
                    />
                )}

                <div className="px-6 pb-6 pt-5">
                    <p className="text-sm font-extrabold text-show-desk">{st('reveal.itWas')}</p>
                    <p className="mt-1 break-words font-brand text-4xl leading-tight">{artistRevealState.artist}</p>

                    {(country || title) && (
                        <p className="mt-2 text-sm font-semibold leading-snug text-show-desk">
                            {[country, title].filter(Boolean).join(' · ')}
                        </p>
                    )}

                    <div className="mt-4 border-t border-show-night/10 pt-3">
                        {finds.length === 0 ? (
                            <p className="text-sm font-bold text-show-desk">{st('reveal.nobody')}</p>
                        ) : (
                            <>
                                <p className="text-xs font-extrabold text-show-desk">{st('reveal.foundBy')}</p>
                                <ul className="mt-2 flex flex-wrap justify-center gap-1.5">
                                    {finds.map((find) => {
                                        const isMe = find.pseudo === pseudo;
                                        return (
                                            <li
                                                key={find.pseudo}
                                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${isMe ? 'bg-show-yellow text-show-night' : 'bg-show-night/10'}`}
                                            >
                                                <span className="max-w-[9rem] truncate">
                                                    {find.pseudo}{isMe ? ` (${st('reveal.you')})` : ''}
                                                </span>
                                                <span className="text-xs font-extrabold opacity-70">
                                                    {st('reveal.extract', { level: find.level })}
                                                    {LEVEL_POINTS[find.level] ? ` · +${LEVEL_POINTS[find.level]}` : ''}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ArtistRevealOverlay;
