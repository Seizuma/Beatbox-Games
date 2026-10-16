// Distances sur le plateau, en nombre de cases à parcourir (balise du Micro d'or, carrefour).
// Les routes payantes (gate) ne comptent que si le joueur a de quoi payer.

/** Cases à parcourir pour aller de from à to (0 si on y est, null si impossible) */
export function distanceTo(board, from, to, hype = Infinity) {
    if (!board || from == null || to == null) return null;
    if (from === to) return 0;
    const seen = new Map([[from, 0]]);
    const queue = [from];
    while (queue.length) {
        const id = queue.shift();
        const d = seen.get(id);
        for (const n of board.spaces[id].next) {
            if (seen.has(n)) continue;
            if ((board.spaces[n].gate || 0) > hype) continue;
            seen.set(n, d + 1);
            if (n === to) return d + 1;
            queue.push(n);
        }
    }
    return null;
}

/** Distance au Micro d'or par chaque route d'un carrefour (en entrant sur la case option.spaceId) */
export function routeDistance(board, spaceId, star) {
    const rest = distanceTo(board, spaceId, star);
    return rest == null ? null : rest + 1;
}
