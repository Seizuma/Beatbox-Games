import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SEO from './SEO';
import SiteShell from './site/SiteShell';
import { PageContainer, SectionTitle, SiteButton } from './site/SiteUI';
import { Figures } from './stats/StatsBlocks';
import Icon from './icons/Icon';
import { useSiteI18n, formatNumber } from '../utils/siteI18n';
import { API_BASE_URL } from '../utils/useApi';
import { categoryName, countryName, titleName } from '../utils/beatboxdleLabels';

const absolute = (url) => (url && !/^(https?:|data:|blob:)/.test(url) ? `${API_BASE_URL}${url}` : url);

/** Drapeau à partir du code pays : deux lettres régionales Unicode. */
const flagOf = (code) => (code && /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((letter) => 0x1f1a5 + letter.charCodeAt(0)))
    : '');

/** Lecture du troisième extrait du Blind Test, celui qu'on reconnaît le mieux. */
function useClip(url) {
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);

    useEffect(() => () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
    }, [url]);

    const toggle = () => {
        if (playing && audioRef.current) {
            audioRef.current.pause();
            setPlaying(false);
            return;
        }
        if (!audioRef.current) {
            audioRef.current = new Audio(absolute(url));
            audioRef.current.volume = 0.8;
            audioRef.current.addEventListener('ended', () => setPlaying(false));
        }
        audioRef.current.currentTime = 0;
        audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    };

    return { playing, toggle };
}

function Portrait({ beatboxer }) {
    if (beatboxer.photoUrl) {
        return (
            <img
                src={absolute(beatboxer.photoUrl)}
                alt=""
                className="h-28 w-28 shrink-0 rounded-2xl object-cover object-top sm:h-36 sm:w-36"
            />
        );
    }
    return (
        <span aria-hidden="true" className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-site-tint text-5xl font-bold text-site-muted sm:h-36 sm:w-36">
            {beatboxer.name.charAt(0).toUpperCase()}
        </span>
    );
}

/** Où le croiser sur le site : une ligne par jeu, avec de quoi y aller. */
function GamesBlock({ beatboxer, t, language }) {
    const { games, blindtestStats, clipUrl } = beatboxer;
    const clip = useClip(clipUrl);
    const rows = [];

    if (games.blindtest) {
        const rate = blindtestStats && blindtestStats.rounds
            ? Math.round((blindtestStats.found / blindtestStats.rounds) * 100)
            : null;
        rows.push({
            key: 'blindtest',
            name: t('games.blindtest.name'),
            text: rate === null
                ? t('beatboxer.inBlindtest')
                : t('beatboxer.blindtestRate', { rate, rounds: formatNumber(language, blindtestStats.rounds) }),
            action: clipUrl ? (
                <button
                    type="button"
                    onClick={clip.toggle}
                    aria-pressed={clip.playing}
                    className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg border border-site-line px-3 text-sm font-semibold text-site-ink transition-colors hover:bg-site-tint"
                >
                    <Icon name={clip.playing ? 'stop' : 'play'} size={16} />
                    {clip.playing ? t('beatboxer.stop') : t('beatboxer.listen')}
                </button>
            ) : null,
        });
    }
    if (games.buzzer) {
        rows.push({ key: 'buzzer', name: t('games.buzzer.name'), text: t('beatboxer.inBuzzer') });
    }
    if (games.beatboxdle && games.beatboxdle.length) {
        rows.push({
            key: 'beatboxdle',
            name: t('games.beatboxdle.name'),
            text: t('beatboxer.inBeatboxdle', { modes: games.beatboxdle.map((mode) => t(`beatboxdle.modes.${mode}`)).join(', ') }),
        });
    }

    if (rows.length === 0) return null;

    return (
        <section aria-labelledby="bbx-games">
            <SectionTitle id="bbx-games">{t('beatboxer.gamesTitle')}</SectionTitle>
            <ul className="flex flex-col">
                {rows.map((row) => (
                    <li key={row.key} className="flex flex-wrap items-center justify-between gap-3 border-t border-site-line py-3">
                        <span className="flex min-w-0 flex-col">
                            <span className="text-sm font-bold">{row.name}</span>
                            <span className="text-sm text-site-muted">{row.text}</span>
                        </span>
                        {row.action}
                    </li>
                ))}
            </ul>
        </section>
    );
}

function Results({ beatboxer, t }) {
    const { results, events } = beatboxer;

    if (results.length > 0) {
        return (
            <section aria-labelledby="bbx-results">
                <SectionTitle id="bbx-results" aside={t('beatboxer.resultsHelp')}>{t('beatboxer.resultsTitle')}</SectionTitle>
                <ol className="flex flex-col">
                    {results.map((result, index) => (
                        <li key={`${result.event}-${result.year}-${index}`} className="grid grid-cols-[3rem_minmax(0,1fr)] items-baseline gap-3 border-t border-site-line py-2.5 text-sm">
                            <span className="tabular-nums text-site-soft">{result.year || '—'}</span>
                            <span className="min-w-0">
                                <span className="font-semibold">{result.event}</span>
                                {result.placement && (
                                    <span className="ml-2 text-site-muted">{t(`beatboxer.placements.${result.placement}`)}</span>
                                )}
                            </span>
                        </li>
                    ))}
                </ol>
            </section>
        );
    }

    if (events.length > 0) {
        return (
            <section aria-labelledby="bbx-events">
                <SectionTitle id="bbx-events">{t('beatboxer.eventsTitle')}</SectionTitle>
                <ul className="flex flex-wrap gap-2">
                    {events.map((event) => (
                        <li key={event} className="rounded-full border border-site-line px-3 py-1.5 text-sm">{event}</li>
                    ))}
                </ul>
            </section>
        );
    }

    return null;
}

function BeatboxerContent() {
    const { t, language } = useSiteI18n();
    const { slug } = useParams();
    const navigate = useNavigate();
    const [state, setState] = useState({ status: 'loading', beatboxer: null });

    useEffect(() => {
        const controller = new AbortController();
        setState({ status: 'loading', beatboxer: null });

        fetch(`${API_BASE_URL}/api/beatboxers/${encodeURIComponent(slug)}`, { signal: controller.signal })
            .then((response) => {
                if (response.status === 404) return { notFound: true };
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((payload) => {
                if (payload.notFound || !payload.beatboxer) {
                    setState({ status: 'missing', beatboxer: null });
                    return;
                }
                setState({ status: 'ready', beatboxer: payload.beatboxer });
                // Lien venu d'un jeu avec le nom : l'adresse prend le slug de la fiche
                if (payload.beatboxer.slug && payload.beatboxer.slug !== slug) {
                    navigate(`/beatboxer/${encodeURIComponent(payload.beatboxer.slug)}`, { replace: true });
                }
            })
            .catch((error) => {
                if (error.name !== 'AbortError') setState({ status: 'error', beatboxer: null });
            });

        return () => controller.abort();
    }, [slug, navigate]);

    if (state.status === 'loading') {
        return <p className="py-16 text-center text-site-soft" aria-live="polite">{t('common.loading')}</p>;
    }

    if (state.status !== 'ready') {
        return (
            <div className="mx-auto flex max-w-lg flex-col items-center py-10 text-center">
                <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-3xl">{t('beatboxer.missingTitle')}</h1>
                <p className="mt-3 text-site-muted">
                    {state.status === 'missing' ? t('beatboxer.missingText') : t('common.loadError')}
                </p>
                <SiteButton className="mt-6" to="/credits">{t('beatboxer.allArtists')}</SiteButton>
            </div>
        );
    }

    const beatboxer = state.beatboxer;
    const country = countryName(language, beatboxer.countryCode);
    const category = categoryName(t, beatboxer.category);
    const bestTitle = beatboxer.bestTitle ? titleName(t, beatboxer.bestTitle, language) : null;
    const years = beatboxer.firstYear
        ? (beatboxer.lastYear && beatboxer.lastYear !== beatboxer.firstYear
            ? t('beatboxer.years', { from: beatboxer.firstYear, to: beatboxer.lastYear })
            : t('beatboxer.year', { year: beatboxer.firstYear }))
        : null;
    const figures = [
        beatboxer.eventCount ? { label: t('beatboxer.eventCount'), value: formatNumber(language, beatboxer.eventCount) } : null,
        beatboxer.titleCount ? { label: t('beatboxer.titleCount'), value: formatNumber(language, beatboxer.titleCount) } : null,
    ].filter(Boolean);
    const battles = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${beatboxer.name} beatbox battle`)}`;

    return (
        <>
            <SEO
                title={t('beatboxer.seoTitle', { name: beatboxer.name })}
                description={t('beatboxer.seoDescription', { name: beatboxer.name })}
                url={`https://beatboxgames.com/#/beatboxer/${beatboxer.slug}`}
            />

            <Link to="/credits" className="inline-flex min-h-[2.75rem] items-center gap-1.5 text-sm font-semibold text-site-muted hover:text-site-ink">
                <Icon name="arrow-left" size={16} />
                {t('beatboxer.allArtists')}
            </Link>

            <header className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end">
                <Portrait beatboxer={beatboxer} />
                <div className="min-w-0">
                    {category && <p className="text-xs font-semibold uppercase tracking-wide text-brand-yellow">{category}</p>}
                    <h1 className="break-words text-[2rem] font-bold leading-tight tracking-tight sm:text-5xl">{beatboxer.name}</h1>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-site-muted">
                        {country && (
                            <span>
                                <span aria-hidden="true" className="mr-1.5">{flagOf(beatboxer.countryCode)}</span>
                                {country}
                            </span>
                        )}
                        {years && <span>{years}</span>}
                    </p>
                </div>
            </header>

            <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-12">
                <div className="flex flex-col gap-10">
                    {(bestTitle || figures.length > 0) && (
                        <section aria-labelledby="bbx-title">
                            <SectionTitle id="bbx-title">{t('beatboxer.bestTitle')}</SectionTitle>
                            {bestTitle && <p className="mb-5 text-xl font-bold leading-snug">{bestTitle}</p>}
                            {figures.length > 0 && <Figures items={figures} />}
                        </section>
                    )}

                    <GamesBlock beatboxer={beatboxer} t={t} language={language} />

                    <section aria-labelledby="bbx-links">
                        <SectionTitle id="bbx-links">{t('beatboxer.linksTitle')}</SectionTitle>
                        <div className="flex flex-wrap gap-3">
                            <a
                                href={battles}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg bg-site-button px-4 text-sm font-bold text-site-on-button transition-colors hover:bg-site-button-hover"
                            >
                                <Icon name="play" size={16} />
                                {t('beatboxer.battles')}
                            </a>
                            {beatboxer.source && (
                                <a
                                    href={beatboxer.source}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="inline-flex min-h-[2.75rem] items-center rounded-lg border border-site-line px-4 text-sm font-bold text-site-ink transition-colors hover:bg-site-tint"
                                >
                                    {t('beatboxer.source')}
                                </a>
                            )}
                        </div>
                    </section>
                </div>

                <Results beatboxer={beatboxer} t={t} />
            </div>
        </>
    );
}

/** Fiche publique d'un beatboxer : /beatboxer/:slug */
export default function BeatboxerPage() {
    return (
        <SiteShell>
            <PageContainer>
                <BeatboxerContent />
            </PageContainer>
        </SiteShell>
    );
}
