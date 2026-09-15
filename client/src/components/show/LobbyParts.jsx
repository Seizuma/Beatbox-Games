import React, { useEffect, useRef, useState } from 'react';
import Icon from '../icons/Icon';
import ShowButton from './ShowButton';
import { copyToClipboard } from '../../utils/clipboard';

// Copie du code et partage du lien, avec retour visuel temporaire
export function useRoomSharing({ roomCode, shareLink, shareText }) {
    const [copyState, setCopyState] = useState(null);
    const timeoutRef = useRef(null);

    useEffect(() => () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    const flash = (state) => {
        setCopyState(state);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopyState(null), 2000);
    };

    const copyCode = async () => {
        if (!roomCode) return;
        flash((await copyToClipboard(roomCode)) ? 'code' : 'error');
    };

    const shareRoom = async () => {
        if (!shareLink) return;
        if (navigator.share) {
            try {
                await navigator.share({ title: 'BeatBox Games', text: shareText, url: shareLink });
                return;
            } catch (error) {
                if (error?.name === 'AbortError') return;
            }
        }
        flash((await copyToClipboard(shareLink)) ? 'link' : 'error');
    };

    return { copyState, copyCode, shareRoom };
}

// Panneau latéral de la salle : code, partage, réglages, règles
export function RoomPanel({ codeLabel, roomCode, sharing, labels, children }) {
    const { copyState, copyCode, shareRoom } = sharing;

    return (
        <aside className="flex flex-col gap-5 rounded-2xl bg-show-night/45 p-4 ring-1 ring-white/5 sm:p-5">
            <div className="rounded-xl bg-show-yellow px-4 py-3 text-center text-show-night shadow-[0_4px_0_#C99400]">
                <p className="text-xs font-extrabold">{codeLabel}</p>
                <p className="font-brand text-4xl leading-tight tracking-[0.08em]">{roomCode}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <ShowButton variant="outline" size="sm" block onClick={copyCode}>
                    <Icon name={copyState === 'code' ? 'check' : 'copy'} size={15} />
                    {copyState === 'code' ? labels.codeCopied : labels.copyCode}
                </ShowButton>
                <ShowButton variant="outline" size="sm" block onClick={shareRoom}>
                    <Icon name={copyState === 'link' ? 'check' : 'link'} size={15} />
                    {copyState === 'link' ? labels.linkCopied : labels.shareLink}
                </ShowButton>
            </div>
            {copyState === 'error' && (
                <p role="alert" className="-mt-3 text-center text-xs font-semibold text-show-yellow">{labels.copyFailed}</p>
            )}

            {children}
        </aside>
    );
}

// Bloc de réglages résumé (lecture pour tous, bouton Modifier pour l'hôte)
export function SettingsSummary({ title, rows, editLabel, onEdit }) {
    return (
        <section>
            <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-sm font-extrabold">{title}</h2>
                {onEdit && (
                    <button
                        type="button"
                        onClick={onEdit}
                        className="inline-flex items-center gap-1.5 rounded-full bg-show-white px-2.5 py-1 text-xs font-extrabold text-show-night hover:brightness-95"
                    >
                        <Icon name="settings" size={13} />
                        {editLabel}
                    </button>
                )}
            </div>
            <dl className="divide-y divide-white/5 rounded-xl bg-show-stage/60">
                {rows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <dt className="text-show-muted">{row.label}</dt>
                        <dd className="truncate text-right font-extrabold">{row.value}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

// Rappel des règles en trois lignes
export function RulesBrief({ title, rules, moreLabel, onMore }) {
    return (
        <section>
            <h2 className="mb-2 text-sm font-extrabold">{title}</h2>
            <ol className="flex flex-col gap-2 text-sm text-show-muted">
                {rules.map((rule, index) => (
                    <li key={rule} className="flex gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-show-stage-2 text-[11px] font-extrabold text-show-yellow">
                            {index + 1}
                        </span>
                        <span>{rule}</span>
                    </li>
                ))}
            </ol>
            {onMore && (
                <button
                    type="button"
                    onClick={onMore}
                    className="mt-3 text-xs font-extrabold text-show-muted underline decoration-show-yellow decoration-2 underline-offset-4 hover:text-show-white"
                >
                    {moreLabel}
                </button>
            )}
        </section>
    );
}

// Écran de pupitre pour la salle d'attente
export function StatusScreen({ state, label }) {
    const tone = state === 'ready' ? 'text-show-ready' : state === 'offline' ? 'text-show-muted' : 'text-show-white/70';
    return (
        <span className={`flex items-center gap-1.5 font-show text-xs font-extrabold ${tone}`}>
            {state === 'ready' && <Icon name="check" size={14} />}
            {label}
        </span>
    );
}