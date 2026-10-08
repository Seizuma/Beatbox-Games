import React, { useMemo, useState } from 'react';
import { DataState, Notice, Segmented, SectionTitle, SiteButton } from '../site/SiteUI';
import Icon from '../icons/Icon';
import { useSiteI18n, formatDay, formatNumber } from '../../utils/siteI18n';
import { useApi } from '../../utils/useApi';
import { postJson } from './adminApi';

const FILTERS = ['all', 'disabled', 'blindtest', 'buzzer', 'beatboxdle'];
const MAX_ROWS = 150;

const searchable = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Artistes : un nom, les jeux où il apparaît, et un interrupteur qui le retire
 * de tous à la fois. Les graphies voisines (Max0 / MaxO) sont déjà regroupées
 * par le serveur.
 */
export default function ArtistsTab() {
    const { t, language } = useSiteI18n();
    const catalogue = useApi('/api/admin/artists', { auth: true });
    const [filter, setFilter] = useState('all');
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState(null); // clé de l'artiste en cours de désactivation
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);
    const [newName, setNewName] = useState('');

    const artists = useMemo(() => catalogue.data?.artists || [], [catalogue.data]);
    const filtered = useMemo(() => {
        const needle = searchable(query.trim());
        return artists.filter((artist) => {
            if (filter === 'disabled' && !artist.disabled) return false;
            if (['blindtest', 'buzzer', 'beatboxdle'].includes(filter) && !artist.games.includes(filter)) return false;
            return !needle || artist.names.some((name) => searchable(name).includes(needle));
        });
    }, [artists, filter, query]);

    /** Ce que la désactivation a provoqué dans les jeux, en clair. */
    const describeEffects = (effects = []) => effects
        .flatMap((effect) => effect.relaunched || [])
        .map((relaunch) => t('admin.artists.relaunched', {
            mode: t(`beatboxdle.modes.${relaunch.mode}`),
            cleared: relaunch.cleared,
        }));

    const disable = async (name, why) => {
        setBusy(true);
        setMessage(null);
        const result = await postJson('/api/admin/artists/exclusions', { name, reason: why });
        setBusy(false);
        if (!result.ok) {
            setMessage({ tone: 'error', text: t('admin.artists.error') });
            return;
        }
        setEditing(null);
        setReason('');
        setMessage({ tone: 'success', text: [t('admin.artists.disabledDone', { name: result.entry.name }), ...describeEffects(result.effects)].join(' ') });
        catalogue.reload();
    };

    const enable = async (artist) => {
        setBusy(true);
        setMessage(null);
        const result = await postJson(`/api/admin/artists/exclusions/${encodeURIComponent(artist.key)}`, {}, 'DELETE');
        setBusy(false);
        if (!result.ok) {
            setMessage({ tone: 'error', text: t('admin.artists.error') });
            return;
        }
        setMessage({ tone: 'success', text: [t('admin.artists.enabledDone', { name: artist.names[0] }), ...describeEffects(result.effects)].join(' ') });
        catalogue.reload();
    };

    const inputClass = 'min-w-0 rounded-lg border border-site-line bg-site-surface px-3 py-2 text-sm text-site-ink placeholder:text-site-soft focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-site-ink';

    return (
        <div className="flex flex-col gap-6">
            <SectionTitle aside={t('admin.artists.help')}>{t('admin.artists.title')}</SectionTitle>

            <div className="flex flex-wrap items-center gap-3">
                <Segmented
                    label={t('admin.artists.filter')}
                    value={filter}
                    onChange={setFilter}
                    options={FILTERS.map((id) => ({
                        id,
                        label: id === 'disabled'
                            ? `${t('admin.artists.filters.disabled')} · ${formatNumber(language, catalogue.data?.disabledCount || 0)}`
                            : t(`admin.artists.filters.${id}`),
                    }))}
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
            </div>

            {message && <Notice tone={message.tone}>{message.text}</Notice>}

            <DataState
                status={catalogue.status}
                isEmpty={filtered.length === 0}
                loadingText={t('common.loading')}
                errorText={t('common.loadError')}
                emptyText={t('admin.artists.empty')}
            >
                <p className="text-xs text-site-soft">
                    {t('admin.artists.count', { count: formatNumber(language, filtered.length) })}
                    {filtered.length > MAX_ROWS ? ` ${t('admin.artists.refine', { count: MAX_ROWS })}` : ''}
                </p>
                <ul>
                    {filtered.slice(0, MAX_ROWS).map((artist) => (
                        <li key={artist.key} className="border-b border-site-line py-2.5 last:border-b-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                <span className={`min-w-0 flex-1 text-sm font-semibold ${artist.disabled ? 'text-site-soft line-through' : ''}`}>
                                    {artist.names.join(' · ')}
                                </span>
                                <span className="flex gap-1">
                                    {artist.games.map((game) => (
                                        <span key={game} className="rounded-full bg-site-tint px-2 py-0.5 text-[11px] font-bold text-site-muted">
                                            {t(`admin.artists.games.${game}`)}
                                        </span>
                                    ))}
                                    {artist.games.length === 0 && (
                                        <span className="px-2 py-0.5 text-[11px] text-site-soft">{t('admin.artists.inNoGame')}</span>
                                    )}
                                </span>
                                {artist.disabled ? (
                                    <SiteButton variant="secondary" size="sm" disabled={busy} onClick={() => enable(artist)}>
                                        {t('admin.artists.enable')}
                                    </SiteButton>
                                ) : (
                                    <SiteButton
                                        variant="ghost"
                                        size="sm"
                                        disabled={busy}
                                        onClick={() => { setEditing(artist.key); setReason(''); }}
                                    >
                                        {t('admin.artists.disable')}
                                    </SiteButton>
                                )}
                            </div>

                            {artist.disabled && (
                                <p className="mt-1 text-[11px] text-site-soft">
                                    {t('admin.artists.disabledInfo', {
                                        date: formatDay(language, artist.disabledAt, t),
                                        who: artist.disabledBy || '—',
                                    })}
                                    {artist.reason ? ` · ${artist.reason}` : ''}
                                </p>
                            )}

                            {editing === artist.key && (
                                <form
                                    className="mt-2 flex flex-wrap items-center gap-2"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        disable(artist.names[0], reason);
                                    }}
                                >
                                    <input
                                        autoFocus
                                        type="text"
                                        value={reason}
                                        onChange={(event) => setReason(event.target.value)}
                                        placeholder={t('admin.artists.reason')}
                                        aria-label={t('admin.artists.reason')}
                                        className={`flex-1 ${inputClass}`}
                                    />
                                    <SiteButton type="submit" variant="danger" size="sm" disabled={busy}>
                                        {t('admin.artists.confirmDisable')}
                                    </SiteButton>
                                    <SiteButton variant="ghost" size="sm" onClick={() => setEditing(null)}>
                                        {t('common.close')}
                                    </SiteButton>
                                </form>
                            )}
                        </li>
                    ))}
                </ul>
            </DataState>

            {/* Un nom absent du catalogue : on peut le bloquer d'avance (prochaine collecte, prochain ajout audio). */}
            <form
                className="mt-4 flex max-w-xl flex-wrap items-center gap-2 border-t border-site-line pt-6"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (newName.trim()) disable(newName.trim(), '').then(() => setNewName(''));
                }}
            >
                <label htmlFor="artist-disable-name" className="w-full text-sm font-bold">{t('admin.artists.addTitle')}</label>
                <input
                    id="artist-disable-name"
                    type="text"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder={t('admin.artists.addPlaceholder')}
                    className={`flex-1 ${inputClass}`}
                />
                <SiteButton type="submit" variant="secondary" size="sm" disabled={busy || !newName.trim()}>
                    {t('admin.artists.disable')}
                </SiteButton>
            </form>
        </div>
    );
}
