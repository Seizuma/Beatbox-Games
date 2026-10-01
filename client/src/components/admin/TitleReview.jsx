import React, { useEffect, useState } from 'react';
import { DataState, Notice, Segmented, SectionTitle, SiteButton } from '../site/SiteUI';
import Icon from '../icons/Icon';
import { useSiteI18n, formatNumber, formatDay } from '../../utils/siteI18n';
import { useApi } from '../../utils/useApi';
import { categoryName, countryName, titleName } from '../../utils/beatboxdleLabels';
import { postJson } from './adminApi';
import { errorText } from './PhotoReview';

const FILTERS = ['todo', 'changed', 'reviewed', 'all'];
const PAGE = 20;

/**
 * Revue des titres Beatboxdle proposés par scripts/beatboxdle/enrich.js.
 *
 * Pour chaque beatboxer : l'indice affiché aujourd'hui, le titre le plus
 * marquant de son palmarès complet, et les alternatives classées. Les
 * décisions ne touchent le jeu qu'au clic sur « Reconstruire la base ».
 */
export default function TitleReview() {
    const { t, language } = useSiteI18n();
    const [filter, setFilter] = useState('todo');
    const [offset, setOffset] = useState(0);
    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const [bulkBusy, setBulkBusy] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(query.trim()), 300);
        return () => clearTimeout(timer);
    }, [query]);
    useEffect(() => setOffset(0), [filter, debounced]);

    const summary = useApi('/api/admin/review/titles/summary', { auth: true });
    const params = new URLSearchParams({ filter, limit: String(PAGE), offset: String(offset), q: debounced });
    const list = useApi(`/api/admin/review/titles?${params}`, { auth: true });

    const info = summary.data?.summary;
    const items = list.data?.items || [];
    const total = list.data?.total || 0;

    const refresh = () => {
        list.reload();
        summary.reload();
    };

    const approvePage = async () => {
        setBulkBusy(true);
        await postJson('/api/admin/review/titles/bulk', { slugs: items.filter((item) => item.proposed).map((item) => item.slug) });
        setBulkBusy(false);
        refresh();
    };

    if (info && !info.ready) {
        return <Notice>{t('admin.review.titles.notReady')}</Notice>;
    }

    return (
        <div className="flex flex-col gap-6">
            {info && (
                <p className="text-sm text-site-muted">
                    {t('admin.review.titles.summary', {
                        total: formatNumber(language, info.total),
                        changed: formatNumber(language, info.changed),
                        todo: formatNumber(language, info.todo),
                        reviewed: formatNumber(language, info.reviewed),
                    })}
                    {info.generatedAt ? ` ${t('admin.review.titles.generatedAt', { date: formatDay(language, info.generatedAt, t) })}` : ''}
                </p>
            )}

            {info?.weights && <WeightsLegend weights={info.weights} />}

            <div className="flex flex-wrap items-center gap-3">
                <Segmented
                    label={t('admin.review.titles.filter')}
                    value={filter}
                    onChange={setFilter}
                    options={FILTERS.map((id) => ({ id, label: t(`admin.review.titles.filters.${id}`) }))}
                />
                <div className="flex max-w-xs flex-1 items-center gap-2 rounded-lg border border-site-line bg-site-surface px-3 focus-within:outline focus-within:outline-2 focus-within:outline-site-ink">
                    <Icon name="search" size={16} className="text-site-soft" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t('admin.review.searchName')}
                        aria-label={t('admin.review.searchName')}
                        className="min-w-0 flex-1 bg-transparent py-2 text-sm text-site-ink placeholder:text-site-soft focus:outline-none"
                    />
                </div>
                {filter === 'todo' && items.length > 0 && (
                    <SiteButton variant="secondary" size="sm" onClick={approvePage} disabled={bulkBusy}>
                        {t('admin.review.titles.approvePage', { count: items.length })}
                    </SiteButton>
                )}
            </div>

            <DataState
                status={list.status}
                isEmpty={items.length === 0}
                loadingText={t('common.loading')}
                errorText={t('common.loadError')}
                emptyText={t(filter === 'todo' ? 'admin.review.titles.allDone' : 'admin.review.titles.nothingHere')}
            >
                <ul className="flex flex-col">
                    {items.map((item) => <TitleRow key={item.slug} item={item} onChanged={refresh} />)}
                </ul>
                {total > PAGE && (
                    <div className="mt-4 flex items-center gap-2">
                        <SiteButton variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                            {t('admin.review.previous')}
                        </SiteButton>
                        <span className="text-xs tabular-nums text-site-soft">
                            {offset + 1}–{Math.min(offset + PAGE, total)} / {total}
                        </span>
                        <SiteButton variant="secondary" size="sm" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
                            {t('admin.review.next')}
                        </SiteButton>
                    </div>
                )}
            </DataState>

            <RebuildPanel onDone={refresh} />
        </div>
    );
}

function WeightsLegend({ weights }) {
    const { t } = useSiteI18n();
    const format = (map) => Object.entries(map || {}).map(([key, value]) => `${key} ${value}`).join(' · ');
    return (
        <details className="rounded-lg bg-site-tint px-4 py-3 text-xs text-site-muted">
            <summary className="cursor-pointer font-bold text-site-ink">{t('admin.review.titles.weightsTitle')}</summary>
            <p className="mt-2">{t('admin.review.titles.weightsHelp')}</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="font-semibold">{t('admin.review.titles.weightLevels')}</dt><dd>{format(weights.levels)}</dd>
                <dt className="font-semibold">{t('admin.review.titles.weightPlacements')}</dt><dd>{format(weights.placements)}</dd>
                <dt className="font-semibold">{t('admin.review.titles.weightDisciplines')}</dt><dd>{format(weights.disciplines)}</dd>
                <dt className="font-semibold">{t('admin.review.titles.weightBonus')}</dt>
                <dd>{t('admin.review.titles.weightBonusValue', { repeat: Math.round(weights.repeatBonus * 100), confirmed: Math.round(weights.confirmedBonus * 100) })}</dd>
            </dl>
        </details>
    );
}

/** Libellé d'un titre tel que le joueur le lira, plus ce qu'il faut pour en juger. */
function TitleLabel({ title, showScore = false }) {
    const { t, language } = useSiteI18n();
    if (!title) return <span className="text-site-soft">—</span>;
    const details = [
        categoryName(t, title.discipline),
        title.detail,
        title.years?.length ? title.years.join(', ') : title.year,
    ].filter(Boolean).join(' · ');

    return (
        <span className="flex flex-col">
            <span className="font-semibold text-site-ink">
                {titleName(t, title, language)}
                {showScore && title.score != null && (
                    <span className="ml-2 text-xs font-normal tabular-nums text-site-soft">{title.score}</span>
                )}
            </span>
            {details && <span className="text-xs text-site-muted">{details}</span>}
            {title.sources?.length > 0 && (
                <span className="text-[11px] text-site-soft">{title.sources.map((source) => t(`admin.review.photos.sources.${source}`)).join(' + ')}</span>
            )}
        </span>
    );
}

const choiceOf = (decision) => {
    if (!decision) return 'proposed';
    if (decision.choice === 'alternative') return `alt:${decision.title?.key}`;
    return decision.choice;
};

function TitleRow({ item, onChanged }) {
    const { t, language } = useSiteI18n();
    const [choice, setChoice] = useState(choiceOf(item.decision));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => setChoice(choiceOf(item.decision)), [item.decision]);

    // La proposition n'est autre que l'alternative n° 1 : on ne la répète pas.
    const alternatives = item.alternatives.filter((alternative) => alternative.key !== item.proposed?.key);
    const shown = item.live || item.current;

    const save = async () => {
        setBusy(true);
        setError(null);
        const result = await postJson(`/api/admin/review/titles/${encodeURIComponent(item.slug)}/decision`, { choice });
        setBusy(false);
        if (!result.ok) setError(errorText(t, result.error));
        else onChanged();
    };

    const cancel = async () => {
        setBusy(true);
        await postJson(`/api/admin/review/titles/${encodeURIComponent(item.slug)}/decision`, {}, 'DELETE');
        setBusy(false);
        onChanged();
    };

    const name = `title-choice-${item.slug}`;
    const option = (value, content) => (
        <label className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 transition-colors ${choice === value ? 'bg-site-tint' : 'hover:bg-site-tint'}`}>
            <input type="radio" name={name} value={value} checked={choice === value} onChange={() => setChoice(value)} className="mt-1 h-4 w-4 shrink-0" />
            <span className="min-w-0 text-sm">{content}</span>
        </label>
    );

    return (
        <li className="border-b border-site-line py-5 last:border-b-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-lg font-bold">
                    {item.name}
                    {item.countryCode && <span className="ml-2 text-sm font-normal text-site-muted">{countryName(language, item.countryCode)}</span>}
                </h3>
                <div className="flex gap-4 text-xs">
                    {item.sources?.beatboxworld && <a href={item.sources.beatboxworld} target="_blank" rel="noreferrer" className="text-site-muted hover:text-site-ink">beatbox.world ↗</a>}
                    {item.sources?.wiki && <a href={item.sources.wiki} target="_blank" rel="noreferrer" className="text-site-muted hover:text-site-ink">Beatbox Wiki ↗</a>}
                </div>
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-site-soft">{t('admin.review.titles.current')}</p>
                    <TitleLabel title={shown} />
                </div>
                <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-site-soft">{t('admin.review.titles.proposed')}</p>
                    <TitleLabel title={item.proposed} showScore />
                </div>
            </div>

            <fieldset className="mt-4">
                <legend className="mb-1 text-xs font-bold text-site-muted">{t('admin.review.titles.choose')}</legend>
                <div className="flex flex-col gap-0.5">
                    {item.proposed && option('proposed', <><span className="text-xs font-bold text-site-soft">{t('admin.review.titles.proposedShort')} · </span><TitleLabel title={item.proposed} showScore /></>)}
                    {alternatives.map((alternative) => (
                        <React.Fragment key={alternative.key}>{option(`alt:${alternative.key}`, <TitleLabel title={alternative} showScore />)}</React.Fragment>
                    ))}
                    {option('current', <span className="text-site-muted">{t('admin.review.titles.keepCurrent')}</span>)}
                </div>
            </fieldset>

            {item.unclassified?.length > 0 && (
                <p className="mt-2 text-[11px] text-site-soft">
                    {t('admin.review.titles.unclassified', { events: item.unclassified.slice(0, 6).join(', ') })}
                </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
                <SiteButton size="sm" onClick={save} disabled={busy}>
                    <Icon name="check" size={14} />
                    {t('admin.review.titles.save')}
                </SiteButton>
                {item.decision && (
                    <>
                        <span className="text-xs text-site-muted">
                            {t('admin.review.titles.decided', { who: item.decision.reviewedBy || '—', date: formatDay(language, item.decision.reviewedAt, t) })}
                        </span>
                        <SiteButton variant="ghost" size="sm" onClick={cancel} disabled={busy}>{t('admin.review.titles.cancel')}</SiteButton>
                    </>
                )}
                {item.decision?.stale && <span className="text-xs font-bold text-site-danger">{t('admin.review.titles.stale')}</span>}
                {error && <span className="text-xs text-site-danger">{error}</span>}
            </div>
        </li>
    );
}

function RebuildPanel({ onDone }) {
    const { t } = useSiteI18n();
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);

    const rebuild = async (force = false) => {
        setBusy(true);
        setResult(null);
        const response = await postJson('/api/admin/review/titles/rebuild', { force });
        setBusy(false);
        setResult(response.ok ? response.result : { ok: false, reason: response.error || 'server_error', errors: [] });
        if (response.ok && response.result?.ok) onDone();
    };

    return (
        <section className="mt-6 max-w-2xl border-t border-site-line pt-8">
            <SectionTitle aside={t('admin.review.titles.rebuildHelp')}>{t('admin.review.titles.rebuild')}</SectionTitle>
            <SiteButton onClick={() => rebuild(false)} disabled={busy}>
                {busy ? t('admin.review.titles.rebuilding') : t('admin.review.titles.rebuildButton')}
            </SiteButton>

            {result?.ok && (
                <div className="mt-5">
                    <Notice tone="success">
                        {t('admin.review.titles.rebuilt', { count: result.count, changed: result.changedTitles, reviewed: result.reviewedCount })}
                    </Notice>
                </div>
            )}

            {result && !result.ok && result.reason === 'draw_changed' && (
                <div className="mt-5 flex flex-col gap-3">
                    <Notice tone="error">{t('admin.review.titles.drawChanged', { modes: (result.modes || []).join(', ') })}</Notice>
                    <div>
                        <SiteButton variant="danger" size="sm" onClick={() => rebuild(true)} disabled={busy}>
                            {t('admin.review.titles.forceRebuild')}
                        </SiteButton>
                    </div>
                </div>
            )}

            {result && !result.ok && result.reason !== 'draw_changed' && (
                <div className="mt-5">
                    <Notice tone="error">
                        {t('admin.review.titles.rebuildFailed')}
                        {(result.errors || []).length > 0 && (
                            <ul className="mt-2 list-disc pl-5">
                                {result.errors.map((line) => <li key={line}>{line}</li>)}
                            </ul>
                        )}
                    </Notice>
                </div>
            )}

            {result?.warnings?.length > 0 && (
                <ul className="mt-3 list-disc pl-5 text-xs text-site-muted">
                    {result.warnings.slice(0, 8).map((line) => <li key={line}>{line}</li>)}
                </ul>
            )}
        </section>
    );
}
