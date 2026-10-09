import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from './SEO';
import SiteShell from './site/SiteShell';
import { PageContainer, PageHeader, SectionTitle } from './site/SiteUI';
import Icon from './icons/Icon';
import { useSiteI18n } from '../utils/siteI18n';

// Liste des beatboxers entendus dans le Blind Test
const ARTISTS = [
    "ABH", "ABX", "Aelmight", "Akinde", "Alem", "Alexinho", "Amit", "Antilt", "Azel", "BizKit", "BlackRoll", "Bookie Blanco",
    "Bronix", "Chris Celiz", "Colaps", "Den", "Derrick", "Dr koopa", "Dropical", "Dudz", "Dynamatt", "Efaybee", "Epock", "Epos", "Exallos", "Fabley", "Faya Braz", "FootboxG",
    "Fredy Beats", "Frosty", "Gene", "GTS", "G-Wizz", "Heartgrey", "Heartzel", "Helium", "Hobbit", "Jayton", "Julard",
    "Kaji", "Kenny Urban", "Kenozen", "Madox", "Max", "MixFX", "momimaru", "Mr Androide", "Osis", "Osy",
    "PACMax", "Pash", "Patbox", "Pono", "Reeps One", "Remix", "Rich", "River'", "Samy Try", "Stan",
    "Supernova", "Synopsys", "Tunecinoo", "Vocodah", "Waali", "Wawad", "Xiphire", "Zede", "Zekka", "Zer0", "ZVD"
];

const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Adresse de la fiche : le serveur retrouve aussi le beatboxer à partir de cette forme du nom
const slugify = (value) => normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Défilement vers une lettre de l'index. Un lien « #letter-X » ne marche pas ici :
// le site est routé par le hash, l'adresse deviendrait « /#letter-X » et mènerait à la page 404.
const jumpToLetter = (initial) => {
    const section = document.getElementById(`letter-${initial}`);
    if (!section) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    // Le focus suit le défilement pour les lecteurs d'écran et la navigation au clavier
    section.focus({ preventScroll: true });
};

const groupByInitial = (names) => {
    const sorted = names.slice().sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    return sorted.reduce((groups, name) => {
        const initial = normalize(name.charAt(0)).toUpperCase();
        const key = /[A-Z]/.test(initial) ? initial : '#';
        const group = groups.find((item) => item.initial === key);
        if (group) group.names.push(name);
        else groups.push({ initial: key, names: [name] });
        return groups;
    }, []);
};

function CreditsContent() {
    const { t } = useSiteI18n();
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const needle = normalize(query.trim());
        return needle ? ARTISTS.filter((name) => normalize(name).includes(needle)) : ARTISTS;
    }, [query]);

    const groups = useMemo(() => groupByInitial(filtered), [filtered]);

    return (
        <>
            <SEO title={t('credits.seoTitle')} description={t('credits.seoDescription')} url="https://beatboxgames.com/#/credits" />
            <PageContainer>
                <PageHeader title={t('credits.title', { count: ARTISTS.length })} intro={t('credits.intro')}>
                    <div className="flex w-full items-center gap-2 rounded-lg border border-site-line bg-site-surface px-3 focus-within:outline focus-within:outline-2 focus-within:outline-site-ink md:w-72">
                        <Icon name="search" size={16} className="text-site-soft" />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={t('credits.search')}
                            aria-label={t('credits.search')}
                            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-site-ink placeholder:text-site-soft focus:outline-none"
                        />
                    </div>
                </PageHeader>

                <p className="mt-6 text-xs text-site-soft" aria-live="polite">
                    {t('credits.count', { count: filtered.length, total: ARTISTS.length })}
                </p>

                {/* Index A–Z collant : la liste dépasse largement un écran */}
                {groups.length > 1 && (
                    <nav
                        aria-label={t('credits.jumpTo')}
                        className="sticky top-14 z-10 -mx-4 mt-3 flex gap-1 overflow-x-auto bg-site-paper px-4 py-2 sm:-mx-6 sm:px-6"
                    >
                        {groups.map((group) => (
                            <button
                                key={group.initial}
                                type="button"
                                onClick={() => jumpToLetter(group.initial)}
                                aria-controls={`letter-${group.initial}`}
                                className="flex h-11 min-w-[2.75rem] shrink-0 items-center justify-center rounded-md px-1 text-sm font-bold text-site-muted transition-colors hover:bg-site-tint hover:text-site-ink"
                            >
                                {group.initial}
                            </button>
                        ))}
                    </nav>
                )}

                {groups.length === 0 ? (
                    <p className="py-10 text-site-muted">{t('credits.empty', { query: query.trim() })}</p>
                ) : (
                    <div className="mt-4 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
                        {groups.map((group) => (
                            <section key={group.initial} id={`letter-${group.initial}`} tabIndex={-1} aria-label={group.initial} className="scroll-mt-32 break-inside-avoid focus:outline-none">
                                <h2 className="mb-2 font-brand text-2xl leading-none text-site-soft">{group.initial}</h2>
                                <ul className="flex flex-col">
                                    {group.names.map((name) => (
                                        <li key={name} className="border-b border-site-line last:border-b-0">
                                            <Link
                                                to={`/beatboxer/${encodeURIComponent(slugify(name))}`}
                                                className="flex min-h-[2.75rem] items-center justify-between gap-2 py-2 text-[0.95rem] font-semibold transition-colors hover:text-brand-yellow"
                                            >
                                                {name}
                                                <Icon name="chevron-right" size={15} className="shrink-0 text-site-soft" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}

                <section className="mt-16 max-w-2xl border-t border-site-line pt-8" aria-labelledby="audio-credits">
                    <SectionTitle id="audio-credits">{t('credits.audioTitle')}</SectionTitle>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                        <dt className="text-site-muted">{t('credits.music')}</dt>
                        <dd>
                            <a
                                href="https://freesound.org/people/gis_sweden/sounds/696385/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold underline decoration-brand-yellow decoration-2 underline-offset-4 hover:decoration-site-ink"
                            >
                                Minimal Tech Background Music - MTBM01
                                <Icon name="external" size={13} />
                            </a>
                            {' '}{t('credits.by')}{' '}
                            <a
                                href="https://freesound.org/people/gis_sweden/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline decoration-site-line decoration-2 underline-offset-4 hover:decoration-site-ink"
                            >
                                gis_sweden
                            </a>
                        </dd>
                        <dt className="text-site-muted">{t('credits.license')}</dt>
                        <dd>
                            <a
                                href="https://creativecommons.org/licenses/by/4.0/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 underline decoration-site-line decoration-2 underline-offset-4 hover:decoration-site-ink"
                            >
                                Creative Commons Attribution 4.0
                                <Icon name="external" size={13} />
                            </a>
                        </dd>
                    </dl>
                    <p className="mt-6 text-sm text-site-muted">
                        {t('credits.removal')}{' '}
                        <Link to="/contact" className="font-semibold text-site-ink underline decoration-brand-yellow decoration-2 underline-offset-4">
                            {t('credits.removalLink')}
                        </Link>
                    </p>
                </section>
            </PageContainer>
        </>
    );
}

function CreditsPage() {
    return (
        <SiteShell>
            <CreditsContent />
        </SiteShell>
    );
}

export default CreditsPage;