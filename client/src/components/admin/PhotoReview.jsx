import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DataState, Notice, Segmented, SectionTitle, SiteButton } from '../site/SiteUI';
import Icon from '../icons/Icon';
import { useSiteI18n, formatDay, formatNumber } from '../../utils/siteI18n';
import { API_BASE_URL, useApi } from '../../utils/useApi';
import { authFetch, postJson, reviewImageUrl } from './adminApi';

const STATUSES = ['pending', 'approved', 'rejected'];
const PAGE = 30;

/**
 * Revue des photos du Buzzer Battle collectées par scripts/photos/collect.js.
 *
 * Une fiche à la fois, au clavier : c'est ce qui rend la revue de centaines
 * de beatboxers supportable. 1-9 choisit une photo, Entrée valide, X rejette
 * tout, S passe, Z annule la dernière décision.
 */
export default function PhotoReview() {
    const { t, language } = useSiteI18n();
    const [status, setStatus] = useState('pending');
    const summary = useApi('/api/admin/review/photos/summary', { auth: true });
    const data = summary.data?.summary;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented
                    label={t('admin.review.photos.status')}
                    value={status}
                    onChange={setStatus}
                    options={STATUSES.map((id) => ({
                        id,
                        label: `${t(`admin.review.photos.statuses.${id}`)}${data ? ` · ${formatNumber(language, data[id])}` : ''}`,
                    }))}
                />
                {data && status === 'pending' && (
                    <p className="text-xs text-site-soft">
                        {t('admin.review.photos.pendingDetail', { withPhotos: data.pendingWithCandidates, empty: data.pendingEmpty })}
                    </p>
                )}
            </div>

            {data && data.total === 0 && <Notice>{t('admin.review.photos.empty')}</Notice>}
            {data && data.pending > 0 && !data.facesChecked && <Notice>{t('admin.review.photos.facesHint')}</Notice>}

            {status === 'pending'
                ? <PendingQueue onDecision={summary.reload} />
                : <ReviewedList status={status} onChange={summary.reload} />}
        </div>
    );
}

/** Message d'erreur traduit, avec repli quand le code est inconnu. */
export function errorText(t, code) {
    const key = `admin.review.errors.${code}`;
    const text = t(key);
    return text === key ? t('admin.review.errors.generic') : text;
}

function sourceLabel(t, candidate) {
    return t(`admin.review.photos.sources.${candidate.source}`);
}

function kindLabel(t, candidate) {
    return t(`admin.review.photos.kinds.${candidate.kind}`);
}

function CandidateTile({ candidate, index, selected, onSelect, onApprove, t }) {
    const confidence = Math.round((candidate.confidence || 0) * 100);
    return (
        <li className="flex flex-col">
            <button
                type="button"
                onClick={() => onSelect(index)}
                onDoubleClick={() => onApprove(candidate.id)}
                aria-pressed={selected}
                className={`flex flex-col rounded-lg border-2 p-1.5 text-left transition-colors ${selected ? 'border-site-ink bg-site-tint' : 'border-transparent hover:bg-site-tint'}`}
            >
                <span className="relative block aspect-[4/3] overflow-hidden rounded-md bg-black">
                    <img src={reviewImageUrl(candidate.src)} alt="" loading="lazy" className="h-full w-full object-contain" />
                    {index < 9 && (
                        <span className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
                            {index + 1}
                        </span>
                    )}
                    <span className="absolute right-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
                        {confidence} %
                    </span>
                </span>
                <span className="mt-2 px-0.5 text-xs">
                    <span className="font-bold">{sourceLabel(t, candidate)}</span>
                    <span className="text-site-muted"> · {kindLabel(t, candidate)}</span>
                </span>
                <span className="px-0.5 text-[11px] tabular-nums text-site-soft">
                    {candidate.width && candidate.height ? `${candidate.width}×${candidate.height}` : ''}
                    {candidate.faces != null ? ` · ${t('admin.review.photos.faces', { count: candidate.faces })}` : ''}
                </span>
                {candidate.note && <span className="line-clamp-2 px-0.5 text-[11px] text-site-muted">{candidate.note}</span>}
            </button>
            {candidate.page && (
                <a
                    href={candidate.page}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 self-start px-2 text-[11px] text-site-soft hover:text-site-ink"
                >
                    {t('admin.review.openSource')}
                    <Icon name="external" size={11} />
                </a>
            )}
        </li>
    );
}

function PendingQueue({ onDecision }) {
    const { t } = useSiteI18n();
    const [queue, setQueue] = useState([]);
    const [skipped, setSkipped] = useState(0);
    const [total, setTotal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [selected, setSelected] = useState(0);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);
    const [lastDecision, setLastDecision] = useState(null);
    const [url, setUrl] = useState('');
    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const exhausted = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(query.trim()), 300);
        return () => clearTimeout(timer);
    }, [query]);

    // Les fiches tranchées quittent la liste « en attente » côté serveur ; seules
    // les fiches passées y restent, en tête : elles servent de décalage.
    const fetchPage = useCallback(async (offset, reset) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ status: 'pending', limit: String(PAGE), offset: String(offset), q: debounced });
            const response = await authFetch(`/api/admin/review/photos?${params}`);
            if (!response.ok) throw new Error(String(response.status));
            const data = await response.json();
            exhausted.current = offset + data.items.length >= data.total;
            setTotal(data.total);
            setQueue((previous) => {
                const base = reset ? [] : previous;
                const known = new Set(base.map((item) => item.key));
                return [...base, ...data.items.filter((item) => !known.has(item.key))];
            });
            setFailed(false);
        } catch (error) {
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, [debounced]);

    useEffect(() => {
        setSkipped(0);
        exhausted.current = false;
        fetchPage(0, true);
    }, [fetchPage]);

    // Recharge avant d'arriver au bout pour que la revue ne s'interrompe pas.
    useEffect(() => {
        if (!loading && queue.length < 5 && !exhausted.current && total !== null) {
            fetchPage(skipped, false);
        }
    }, [queue.length, loading, skipped, total, fetchPage]);

    const current = queue[0] || null;

    useEffect(() => {
        setSelected(0);
        setUrl('');
    }, [current?.key]);

    const advance = useCallback(() => setQueue((previous) => previous.slice(1)), []);

    const decide = useCallback(async (action, body = {}) => {
        if (!current || busy) return;
        setBusy(true);
        setMessage(null);
        const result = await postJson(`/api/admin/review/photos/${encodeURIComponent(current.key)}/${action}`, body);
        setBusy(false);
        if (!result.ok) {
            setMessage({ tone: 'error', text: errorText(t, result.error) });
            return;
        }
        setLastDecision({ key: current.key, name: current.name, action });
        setTotal((value) => (value === null ? value : value - 1));
        advance();
        onDecision();
    }, [advance, busy, current, onDecision, t]);

    const approve = useCallback((candidateId) => decide('approve', { candidateId }), [decide]);
    const reject = useCallback(() => decide('reject'), [decide]);

    const skip = useCallback(() => {
        if (!current) return;
        setSkipped((value) => value + 1);
        advance();
    }, [advance, current]);

    const undo = useCallback(async () => {
        if (!lastDecision || busy) return;
        setBusy(true);
        const result = await postJson(`/api/admin/review/photos/${encodeURIComponent(lastDecision.key)}/reopen`);
        setBusy(false);
        if (result.ok) {
            setMessage({ tone: 'success', text: t('admin.review.photos.undone', { name: lastDecision.name }) });
            setLastDecision(null);
            setSkipped(0);
            exhausted.current = false;
            fetchPage(0, true);
            onDecision();
        }
    }, [busy, fetchPage, lastDecision, onDecision, t]);

    const addUrl = async (event) => {
        event.preventDefault();
        if (!current || !url.trim()) return;
        setBusy(true);
        const result = await postJson(`/api/admin/review/photos/${encodeURIComponent(current.key)}/candidates`, { url: url.trim() });
        setBusy(false);
        if (!result.ok) {
            setMessage({ tone: 'error', text: errorText(t, result.error) });
            return;
        }
        setQueue((previous) => previous.map((item, index) => (index === 0
            ? { ...item, candidates: [result.candidate, ...item.candidates] }
            : item)));
        setSelected(0);
        setUrl('');
    };

    // Raccourcis clavier, hors des champs de saisie
    useEffect(() => {
        const onKey = (event) => {
            if (event.target.closest('input, textarea, select') || event.altKey) return;
            const candidates = current?.candidates || [];
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
                event.preventDefault();
                undo();
                return;
            }
            if (event.ctrlKey || event.metaKey) return;

            if (/^[1-9]$/.test(event.key) && Number(event.key) <= candidates.length) {
                setSelected(Number(event.key) - 1);
            } else if (event.key === 'Enter' && candidates[selected]) {
                event.preventDefault();
                approve(candidates[selected].id);
            } else if (event.key.toLowerCase() === 'x') {
                reject();
            } else if (event.key.toLowerCase() === 's' || event.key === 'ArrowRight') {
                skip();
            } else if (event.key.toLowerCase() === 'z') {
                undo();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [approve, current, reject, selected, skip, undo]);

    const sources = current?.sources || {};

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
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
                <p className="text-xs text-site-soft">{t('admin.review.photos.shortcuts')}</p>
            </div>

            {message && <Notice tone={message.tone}>{message.text}</Notice>}

            <DataState
                status={failed ? 'error' : (loading && !current ? 'loading' : 'ready')}
                isEmpty={!current}
                loadingText={t('common.loading')}
                errorText={t('common.loadError')}
                emptyText={t('admin.review.photos.done')}
            >
                {current && (
                    <section aria-labelledby="photo-review-name" className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-site-line pb-3">
                            <div className="min-w-0">
                                <p className="text-xs text-site-soft">
                                    {t('admin.review.photos.remaining', { count: total ?? queue.length })}
                                </p>
                                <h3 id="photo-review-name" className="text-2xl font-bold leading-tight">{current.name}</h3>
                                <p className="mt-1 text-sm text-site-muted">
                                    {[current.nationality, ...(current.events || []).slice(0, 4)].filter(Boolean).join(' · ')}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                {sources.beatboxworld?.url && (
                                    <a href={sources.beatboxworld.url} target="_blank" rel="noreferrer" className="text-site-muted hover:text-site-ink">beatbox.world ↗</a>
                                )}
                                {sources.wiki?.url && (
                                    <a href={sources.wiki.url} target="_blank" rel="noreferrer" className="text-site-muted hover:text-site-ink">Beatbox Wiki ↗</a>
                                )}
                                <a
                                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${current.name} beatbox`)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-site-muted hover:text-site-ink"
                                >
                                    YouTube ↗
                                </a>
                            </div>
                        </div>

                        <Notice>{t('admin.review.photos.spoilerHint')}</Notice>

                        {current.candidates.length === 0 ? (
                            <p className="py-6 text-sm text-site-muted">{t('admin.review.photos.noCandidate')}</p>
                        ) : (
                            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                {current.candidates.map((candidate, index) => (
                                    <CandidateTile
                                        key={candidate.id}
                                        candidate={candidate}
                                        index={index}
                                        selected={index === selected}
                                        onSelect={setSelected}
                                        onApprove={approve}
                                        t={t}
                                    />
                                ))}
                            </ul>
                        )}

                        <form onSubmit={addUrl} className="flex max-w-xl flex-wrap items-center gap-2">
                            <label htmlFor="photo-review-url" className="sr-only">{t('admin.review.photos.addUrl')}</label>
                            <input
                                id="photo-review-url"
                                type="url"
                                value={url}
                                onChange={(event) => setUrl(event.target.value)}
                                placeholder={t('admin.review.photos.addUrl')}
                                className="min-w-0 flex-1 rounded-lg border border-site-line bg-site-surface px-3 py-2 text-sm text-site-ink placeholder:text-site-soft focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-site-ink"
                            />
                            <SiteButton type="submit" variant="secondary" size="sm" disabled={busy || !url.trim()}>
                                {t('admin.review.photos.addUrlButton')}
                            </SiteButton>
                        </form>

                        <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-2 border-t border-site-line bg-site-paper px-1 py-3">
                            <SiteButton
                                onClick={() => current.candidates[selected] && approve(current.candidates[selected].id)}
                                disabled={busy || !current.candidates[selected]}
                            >
                                <Icon name="check" size={16} />
                                {t('admin.review.photos.approve', { number: selected + 1 })}
                            </SiteButton>
                            <SiteButton variant="secondary" onClick={reject} disabled={busy}>
                                {t('admin.review.photos.reject')}
                            </SiteButton>
                            <SiteButton variant="ghost" onClick={skip} disabled={busy}>
                                {t('admin.review.photos.skip')}
                            </SiteButton>
                            {lastDecision && (
                                <SiteButton variant="ghost" onClick={undo} disabled={busy} className="ml-auto">
                                    {t('admin.review.photos.undo', { name: lastDecision.name })}
                                </SiteButton>
                            )}
                        </div>
                    </section>
                )}
            </DataState>
        </div>
    );
}

function ReviewedList({ status, onChange }) {
    const { t, language } = useSiteI18n();
    const [offset, setOffset] = useState(0);
    const list = useApi(`/api/admin/review/photos?status=${status}&limit=${PAGE}&offset=${offset}`, { auth: true });
    const [busyKey, setBusyKey] = useState(null);

    useEffect(() => setOffset(0), [status]);

    const reopen = async (key) => {
        setBusyKey(key);
        await postJson(`/api/admin/review/photos/${encodeURIComponent(key)}/reopen`);
        setBusyKey(null);
        list.reload();
        onChange();
    };

    const items = list.data?.items || [];
    const total = list.data?.total || 0;

    return (
        <DataState
            status={list.status}
            isEmpty={items.length === 0}
            loadingText={t('common.loading')}
            errorText={t('common.loadError')}
            emptyText={t('admin.review.photos.nothingHere')}
        >
            <SectionTitle aside={t('admin.review.photos.reopenHelp')}>
                {t(`admin.review.photos.statuses.${status}`)} · {formatNumber(language, total)}
            </SectionTitle>
            <ul>
                {items.map((item) => {
                    // Pour une photo validée, on montre celle qui est réellement en jeu.
                    const thumbnail = item.approvedFile
                        ? `${API_BASE_URL}/api/beatboxer-images/${encodeURIComponent(item.approvedFile)}`
                        : null;
                    return (
                        <li key={item.key} className="flex items-center gap-3 border-b border-site-line py-2.5 last:border-b-0">
                            {thumbnail ? (
                                <img src={thumbnail} alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded bg-black object-contain" />
                            ) : (
                                <span aria-hidden="true" className="h-12 w-16 shrink-0 rounded bg-site-tint" />
                            )}
                            <span className="flex min-w-0 flex-1 flex-col text-sm">
                                <span className="truncate font-semibold">{item.name}</span>
                                <span className="text-xs text-site-soft">
                                    {formatDay(language, item.reviewedAt, t)}{item.reviewedBy ? ` · ${item.reviewedBy}` : ''}
                                </span>
                            </span>
                            <SiteButton variant="secondary" size="sm" onClick={() => reopen(item.key)} disabled={busyKey === item.key}>
                                {t('admin.review.photos.reopen')}
                            </SiteButton>
                        </li>
                    );
                })}
            </ul>
            {total > PAGE && (
                <div className="mt-4 flex gap-2">
                    <SiteButton variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                        {t('admin.review.previous')}
                    </SiteButton>
                    <SiteButton variant="secondary" size="sm" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
                        {t('admin.review.next')}
                    </SiteButton>
                </div>
            )}
        </DataState>
    );
}
