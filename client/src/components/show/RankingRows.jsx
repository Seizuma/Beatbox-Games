import React from 'react';

/**
 * Lignes de classement hors podium, communes aux deux jeux.
 * rows : [{ key, rank, name, score, isMe, avatarUrl, detail }]
 */
export default function RankingRows({ rows = [], youLabel }) {
    if (rows.length === 0) return null;

    return (
        <ol className="overflow-hidden rounded-xl ring-1 ring-show-muted/15">
            {rows.map((row) => (
                <li
                    key={row.key}
                    className={`flex items-center gap-3 px-4 py-3 text-sm ${row.isMe ? 'bg-show-yellow/15' : 'bg-show-stage-2/50'} border-b border-show-muted/10 last:border-b-0`}
                >
                    <span className="w-6 shrink-0 text-center font-brand text-base text-show-muted">{row.rank}</span>
                    {row.avatarUrl
                        ? <img src={row.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                        : <span aria-hidden="true" className="h-7 w-7 shrink-0 rounded-full bg-show-dim" />}
                    <span className="min-w-0 flex-1 truncate font-semibold">
                        {row.name}
                        {row.isMe && youLabel && <span className="ml-2 text-xs font-bold text-show-yellow">{youLabel}</span>}
                    </span>
                    {row.detail && <span className="hidden shrink-0 text-xs text-show-muted sm:inline">{row.detail}</span>}
                    <span className="w-14 shrink-0 text-right font-brand text-lg tabular-nums">{row.score}</span>
                </li>
            ))}
        </ol>
    );
}