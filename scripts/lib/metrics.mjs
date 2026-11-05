// How well a score orders labelled records, for scripts/backtest.mjs. Pure.
//
// Rows are { score, hit } with hit true or false. Ties matter here: most
// records by a stranger with no genre score exactly the same, and the
// profile's own row order (by its score, which knows the outcome) must never
// leak in as a tiebreaker. So both metrics treat a tie as a coin toss: AUC
// counts a tied pair as half, and precision at k takes the expected share of
// hits from the tied group that straddles the cut.

/** Area under the ROC curve: the chance a random hit outscores a random miss. */
export const auc = (rows) => {
    const sorted = [...rows].sort((a, b) => a.score - b.score);
    const pos = sorted.filter((r) => r.hit).length;
    const neg = sorted.length - pos;
    if (!pos || !neg) return null;
    // Mann-Whitney with average ranks for ties.
    let rankSum = 0;
    for (let i = 0; i < sorted.length;) {
        let j = i;
        while (j < sorted.length && sorted[j].score === sorted[i].score) j += 1;
        const avg = (i + 1 + j) / 2;
        for (let k = i; k < j; k += 1) if (sorted[k].hit) rankSum += avg;
        i = j;
    }
    return (rankSum - (pos * (pos + 1)) / 2) / (pos * neg);
};

/** Expected share of hits in the top k, ties at the cut broken at random. */
export const precisionAt = (rows, k) => {
    const sorted = [...rows].sort((a, b) => b.score - a.score);
    const n = Math.min(k, sorted.length);
    if (!n) return null;
    let hits = 0;
    let taken = 0;
    for (let i = 0; i < sorted.length && taken < n;) {
        let j = i;
        while (j < sorted.length && sorted[j].score === sorted[i].score) j += 1;
        const group = sorted.slice(i, j);
        const groupHits = group.filter((r) => r.hit).length;
        const take = Math.min(group.length, n - taken);
        hits += (groupHits * take) / group.length;
        taken += take;
        i = j;
    }
    return hits / n;
};

/** A stable 32-bit FNV-1a hash of a string, for the holdout split. */
export const hash = (s) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
};

/** Which half a key falls in: 'tune' or 'holdout', fixed for ever by the key alone. */
export const halfOf = (key) => (hash(key) % 2 === 0 ? 'tune' : 'holdout');
