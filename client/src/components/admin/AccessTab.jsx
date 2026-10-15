import React, { useCallback, useEffect, useId, useState } from 'react';
import { Avatar, DataState, Notice, SectionTitle, SiteButton } from '../site/SiteUI';
import { useSiteI18n, formatDay } from '../../utils/siteI18n';
import { authFetch, postJson } from './adminApi';

// Liste d'accès de la version de test : qui peut ouvrir dev.beatboxgames.com
// (server/services/accessGate.js). Onglet affiché seulement quand le client est
// construit avec REACT_APP_ACCESS_GATE=true.

const DISCORD_ID = /^\d{17,20}$/;

function AccountRow({ avatarUrl, name, meta, children }) {
    return (
        <li className="flex flex-wrap items-center gap-3 border-t border-site-line py-3">
            <Avatar src={avatarUrl} name={name} size={36} />
            <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{name}</p>
                <p className="text-xs text-site-soft">{meta}</p>
            </div>
            {children}
        </li>
    );
}

export default function AccessTab() {
    const { t, language } = useSiteI18n();
    const idInput = useId();
    const labelInput = useId();
    const [data, setData] = useState(null);
    const [status, setStatus] = useState('loading');
    const [discordId, setDiscordId] = useState('');
    const [label, setLabel] = useState('');
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(null);

    const day = (timestamp) => formatDay(language, timestamp ? new Date(timestamp).toISOString() : null, t);

    const load = useCallback(async () => {
        try {
            const response = await authFetch('/api/admin/access');
            if (!response.ok) throw new Error(String(response.status));
            setData(await response.json());
            setStatus('ready');
        } catch (error) {
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const allow = async (id, note = '') => {
        const cleanId = String(id).trim();
        if (!DISCORD_ID.test(cleanId)) {
            setNotice({ tone: 'error', text: t('admin.access.invalid') });
            return;
        }
        setBusy(true);
        setNotice(null);
        const result = await postJson('/api/admin/access', { discordId: cleanId, label: note.trim() });
        setBusy(false);
        if (result.ok) {
            setNotice({ tone: 'success', text: t('admin.access.added') });
            setDiscordId('');
            setLabel('');
            load();
        } else {
            setNotice({ tone: 'error', text: result.error === 'invalid_discord_id' ? t('admin.access.invalid') : t('admin.access.error') });
        }
    };

    const remove = async (id) => {
        if (confirming !== id) {
            setConfirming(id);
            return;
        }
        setConfirming(null);
        const result = await postJson(`/api/admin/access/${id}`, {}, 'DELETE');
        if (!result.ok) setNotice({ tone: 'error', text: t('admin.access.error') });
        load();
    };

    const entries = data?.entries || [];
    const denied = data?.denied || [];

    return (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div className="min-w-0">
                <SectionTitle aside={t('admin.access.intro')}>{t('admin.access.title')}</SectionTitle>
                {data && !data.gate && <div className="mb-6"><Notice>{t('admin.access.inactive')}</Notice></div>}

                <form
                    className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                    onSubmit={(event) => {
                        event.preventDefault();
                        allow(discordId, label);
                    }}
                >
                    <div>
                        <label htmlFor={idInput} className="block text-sm font-bold">{t('admin.access.idLabel')}</label>
                        <input
                            id={idInput}
                            inputMode="numeric"
                            autoComplete="off"
                            value={discordId}
                            onChange={(event) => setDiscordId(event.target.value.replace(/\D/g, ''))}
                            placeholder="123456789012345678"
                            className="mt-2 w-full rounded-lg border border-site-line bg-site-surface px-3 py-2.5 font-mono text-base tabular-nums text-site-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-site-ink"
                        />
                    </div>
                    <div>
                        <label htmlFor={labelInput} className="block text-sm font-bold">{t('admin.access.labelLabel')}</label>
                        <input
                            id={labelInput}
                            autoComplete="off"
                            maxLength={80}
                            value={label}
                            onChange={(event) => setLabel(event.target.value)}
                            placeholder={t('admin.access.labelPlaceholder')}
                            className="mt-2 w-full rounded-lg border border-site-line bg-site-surface px-3 py-2.5 text-base text-site-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-site-ink"
                        />
                    </div>
                    <SiteButton type="submit" disabled={busy || !discordId}>
                        {busy ? t('admin.access.adding') : t('admin.access.add')}
                    </SiteButton>
                </form>
                <p className="mt-2 text-xs text-site-soft">{t('admin.access.idHelp')}</p>
                {notice && <div className="mt-4"><Notice tone={notice.tone}>{notice.text}</Notice></div>}

                <div className="mt-10">
                    <SectionTitle>{t('admin.access.listTitle')}</SectionTitle>
                    <DataState
                        status={status === 'ready' ? 'ready' : status}
                        isEmpty={entries.length === 0}
                        loadingText={t('admin.access.loading')}
                        errorText={t('admin.access.loadError')}
                        emptyText={t('admin.access.empty')}
                    >
                        <ul>
                            {entries.map((entry) => {
                                const name = entry.username || entry.label || t('admin.access.unknownName');
                                const seen = entry.lastSeenAt
                                    ? t('admin.access.lastSeen', { date: day(entry.lastSeenAt) })
                                    : t('admin.access.neverSeen');
                                const note = entry.label && entry.label !== name ? `${entry.label} · ` : '';
                                return (
                                    <AccountRow
                                        key={entry.discordId}
                                        avatarUrl={entry.avatarUrl}
                                        name={name}
                                        meta={`${note}${entry.discordId} · ${t('admin.access.addedOn', { date: day(entry.addedAt) })} · ${seen}`}
                                    >
                                        <SiteButton
                                            size="sm"
                                            variant={confirming === entry.discordId ? 'danger' : 'secondary'}
                                            onClick={() => remove(entry.discordId)}
                                            onBlur={() => setConfirming((current) => (current === entry.discordId ? null : current))}
                                        >
                                            {confirming === entry.discordId ? t('admin.access.confirmRemove') : t('admin.access.remove')}
                                        </SiteButton>
                                    </AccountRow>
                                );
                            })}
                        </ul>
                    </DataState>
                </div>
            </div>

            <aside className="min-w-0">
                {denied.length > 0 && (
                    <section className="mb-10">
                        <SectionTitle aside={t('admin.access.deniedIntro')}>{t('admin.access.deniedTitle')}</SectionTitle>
                        <ul>
                            {denied.map((item) => (
                                <AccountRow
                                    key={item.discordId}
                                    avatarUrl={item.avatarUrl}
                                    name={item.username || item.discordId}
                                    meta={`${item.discordId} · ${t('admin.access.attempts', { count: item.attempts, date: day(item.lastAttemptAt) })}`}
                                >
                                    <SiteButton size="sm" onClick={() => allow(item.discordId, item.username || '')} disabled={busy}>
                                        {t('admin.access.allow')}
                                    </SiteButton>
                                </AccountRow>
                            ))}
                        </ul>
                    </section>
                )}

                <section>
                    <SectionTitle aside={t('admin.access.adminsIntro')}>{t('admin.access.adminsTitle')}</SectionTitle>
                    <ul className="flex flex-col gap-1 font-mono text-sm tabular-nums text-site-muted">
                        {(data?.admins || []).map((id) => <li key={id}>{id}</li>)}
                    </ul>
                </section>
            </aside>
        </div>
    );
}
