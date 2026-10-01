import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DataState, Notice, Segmented, SectionTitle, SiteButton, SiteModal } from '../site/SiteUI';
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

// Au-delà, la demande d'effacement n'a manifestement pas été prise en charge.
const CLEANING_STALE_MS = 30000;

function CleaningStatus({ cleaning, t }) {
    if (!cleaning) return null;
    if (cleaning.status === 'error') {
        return <span className="px-2 text-[11px] font-semibold text-site-danger">{cleaning.error || t('admin.review.errors.generic')}</span>;
    }
    const stale = cleaning.requestedAt && Date.now() - new Date(cleaning.requestedAt).getTime() > CLEANING_STALE_MS;
    return (
        <span role="status" className="px-2 text-[11px] font-semibold text-site-muted">
            {stale ? t('admin.review.photos.cleaningStale') : t('admin.review.photos.cleaning')}
        </span>
    );
}

function CandidateTile({ candidate, index, selected, onSelect, onApprove, onErase, t }) {
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
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <button
                    type="button"
                    onClick={() => onErase(candidate)}
                    disabled={candidate.cleaning?.status === 'queued'}
                    className="px-2 text-[11px] font-semibold text-site-muted hover:text-site-ink disabled:opacity-50"
                >
                    {t('admin.review.photos.erase')}
                </button>
                {candidate.page && (
                    <a
                        href={candidate.page}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 text-[11px] text-site-soft hover:text-site-ink"
                    >
                        {t('admin.review.openSource')}
                        <Icon name="external" size={11} />
                    </a>
                )}
            </span>
            <CleaningStatus cleaning={candidate.cleaning} t={t} />
        </li>
    );
}

/**
 * Solo ou groupe. Un duo doit apparaître au complet sur la photo : la
 * détection automatique (beatbox.world, wiki, nom « A & B ») se corrige ici.
 */
function GroupControl({ item, onChange, busy, t }) {
    const group = item.group || {};
    const kind = group.kind === 'crew' ? t('admin.review.photos.groupCrew') : t('admin.review.photos.groupDuo');

    return (
        <div className="mt-2 flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
                {group.active ? (
                    <span className="rounded-full bg-site-tint px-2.5 py-1 font-bold text-site-ink">
                        {t('admin.review.photos.groupBadge', { kind, count: group.size })}
                        {group.members?.length > 0 && <span className="font-normal text-site-muted"> · {group.members.join(', ')}</span>}
                    </span>
                ) : (
                    <span className="rounded-full bg-site-tint px-2.5 py-1 font-bold text-site-muted">{t('admin.review.photos.solo')}</span>
                )}
                <SiteButton variant="ghost" size="sm" disabled={busy} onClick={() => onChange(!group.active)}>
                    {group.active ? t('admin.review.photos.markSolo') : t('admin.review.photos.markGroup')}
                </SiteButton>
                {group.override !== null && group.override !== undefined && (
                    <SiteButton variant="ghost" size="sm" disabled={busy} onClick={() => onChange(null)}>
                        {t('admin.review.photos.groupAuto')}
                    </SiteButton>
                )}
            </div>
            {group.needsRecheck && (
                <p className="text-[11px] text-site-soft">
                    {t('admin.review.photos.groupRecheck', { command: `faces.py --force --keys ${item.key}` })}
                </p>
            )}
        </div>
    );
}

/**
 * Choix des zones à effacer : on trace des rectangles sur l'image, et/ou on
 * s'en remet à la détection automatique du texte. Les coordonnées partent en
 * relatif (0-1) : le script les rapporte à la taille réelle de l'image.
 */
function EraseTextModal({ candidate, onClose, onSubmit, t }) {
    const [boxes, setBoxes] = useState([]);
    const [draft, setDraft] = useState(null);
    const [auto, setAuto] = useState(true);
    const surface = useRef(null);
    const start = useRef(null);

    const point = (event) => {
        const rect = surface.current.getBoundingClientRect();
        const clamp = (value) => Math.min(1, Math.max(0, value));
        return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
    };
    const toBox = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

    const onPointerDown = (event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = point(event);
        setDraft(toBox(start.current, start.current));
    };
    const onPointerMove = (event) => {
        if (start.current) setDraft(toBox(start.current, point(event)));
    };
    const onPointerUp = (event) => {
        if (!start.current) return;
        const box = toBox(start.current, point(event));
        start.current = null;
        setDraft(null);
        // Un simple clic ne fait pas une zone
        if (box.w > 0.01 && box.h > 0.01) setBoxes((previous) => [...previous, box]);
    };

    const style = (box) => ({ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` });

    return (
        <SiteModal
            open
            onClose={onClose}
            title={t('admin.review.photos.eraseTitle')}
            closeLabel={t('common.close')}
            footer={(
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} className="h-4 w-4" />
                        {t('admin.review.photos.eraseAuto')}
                    </label>
                    <div className="flex gap-2">
                        {boxes.length > 0 && (
                            <SiteButton variant="ghost" size="sm" onClick={() => setBoxes([])}>{t('admin.review.photos.eraseClear')}</SiteButton>
                        )}
                        <SiteButton size="sm" onClick={() => onSubmit({ auto, boxes })} disabled={!auto && boxes.length === 0}>
                            {t('admin.review.photos.eraseSubmit')}
                        </SiteButton>
                    </div>
                </div>
            )}
        >
            <p className="mb-3 text-sm text-site-muted">{t('admin.review.photos.eraseHelp')}</p>
            <div
                ref={surface}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                className="relative cursor-crosshair touch-none select-none overflow-hidden rounded-md bg-black"
            >
                <img src={reviewImageUrl(candidate.src)} alt="" draggable={false} className="block h-auto w-full" />
                {[...boxes, ...(draft ? [draft] : [])].map((box, index) => (
                    <span
                        key={index}
                        aria-hidden="true"
                        style={style(box)}
                        className="pointer-events-none absolute border-2 border-brand-yellow bg-brand-yellow/30"
                    />
                ))}
            </div>
            <p className="mt-2 text-xs text-site-soft">{t('admin.review.photos.eraseBoxes', { count: boxes.length })}</p>
        </SiteModal>
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

    // --- Effacement du texte -----------------------------------------------
    // La demande est traitée par clean_text.py sur l'hôte : on relit la fiche
    // toutes les quelques secondes jusqu'à l'arrivée de l'image nettoyée.
    const [erasing, setErasing] = useState(null);
    const isCleaning = Boolean(current?.candidates.some((candidate) => candidate.cleaning?.status === 'queued'));

    // Duo / crew : la fiche revient triée pour plusieurs visages attendus.
    const setGroup = async (value) => {
        if (!current) return;
        setBusy(true);
        const result = await postJson(`/api/admin/review/photos/${encodeURIComponent(current.key)}/group`, { group: value });
        setBusy(false);
        if (!result.ok) {
            setMessage({ tone: 'error', text: errorText(t, result.error) });
            return;
        }
        setQueue((previous) => (previous[0]?.key === result.item.key ? [result.item, ...previous.slice(1)] : previous));
        setSelected(0);
    };

    const submitErase = async ({ auto, boxes }) => {
        const candidate = erasing;
        setErasing(null);
        if (!current || !candidate) return;
        const result = await postJson(
            `/api/admin/review/photos/${encodeURIComponent(current.key)}/candidates/${encodeURIComponent(candidate.id)}/clean`,
            { auto, boxes },
        );
        if (!result.ok) {
            setMessage({ tone: 'error', text: errorText(t, result.error) });
            return;
        }
        setQueue((previous) => previous.map((item, index) => (index === 0
            ? {
                ...item,
                candidates: item.candidates.map((other) => (other.id === candidate.id ? { ...other, cleaning: result.result.cleaning } : other)),
            }
            : item)));
    };

    const queueRef = useRef(queue);
    queueRef.current = queue;
    const currentKey = current?.key;

    useEffect(() => {
        if (!isCleaning || !currentKey) return undefined;
        const timer = setInterval(async () => {
            try {
                const response = await authFetch(`/api/admin/review/photos/${encodeURIComponent(currentKey)}`);
                if (!response.ok) return;
                const { item } = await response.json();
                const shown = queueRef.current[0];
                if (!shown || shown.key !== currentKey) return;

                const before = new Set(shown.candidates.map((candidate) => candidate.id));
                const fresh = item.candidates.findIndex((candidate) => !before.has(candidate.id));
                setQueue((previous) => (previous[0]?.key === currentKey ? [item, ...previous.slice(1)] : previous));
                // L'image nettoyée arrive : on la sélectionne, c'est elle qu'on veut valider.
                if (fresh >= 0) setSelected(fresh);
            } catch (error) {
                // Réseau capricieux : on retentera au prochain tour.
            }
        }, 3000);
        return () => clearInterval(timer);
    }, [currentKey, isCleaning]);

    // Raccourcis clavier, hors des champs de saisie et de la fenêtre d'effacement
    useEffect(() => {
        const onKey = (event) => {
            if (erasing || event.target.closest('input, textarea, select') || event.altKey) return;
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
    }, [approve, current, erasing, reject, selected, skip, undo]);

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
                                <GroupControl item={current} onChange={setGroup} busy={busy} t={t} />
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

                        {erasing && (
                            <EraseTextModal candidate={erasing} onClose={() => setErasing(null)} onSubmit={submitErase} t={t} />
                        )}

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
                                        onErase={setErasing}
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
