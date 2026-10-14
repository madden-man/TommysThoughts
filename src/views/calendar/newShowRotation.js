// Picks up shows added to the /darts "Shows" board after the plan was generated
// and appends them to the end of their track.
//
// Deliberately simple: the existing plan is the product of a scheduler that does
// seasonal fitting, star alternation, season splitting and holiday anchoring, and
// none of that is re-run here. A new dart just joins the queue at the end of its
// enneagram Center's track, in the order the board returns it.
//
// Like every show in the plan, a new one gets one week on its track. Runtime is
// the one thing the darts records never carry, so its night count is a
// placeholder flagged `estimated` — the calendar says so rather than pretending
// it knows.

import { TRACK_ENDS, TRACK_RUNS, WEEK_DAYS, addDays } from './watchPlan';

const TRIAD = { 8: 'g', 9: 'g', 1: 'g', 2: 'h', 3: 'h', 4: 'h', 5: 'd', 6: 'd', 7: 'd' };

export const DEFAULT_NIGHTS = 10;   // ~20 hours, a mid-sized season

const norm = (s = '') => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// The board has real typos in it — "Gravirty Falls" sits alongside the scheduled
// "Gravity Falls". A near-identical title is a misspelling of something already
// planned, not a new show, so it should not get queued a second time.
const editDistance = (a, b) => {
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let last = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = prev[j];
            prev[j] = Math.min(
                prev[j] + 1,
                prev[j - 1] + 1,
                last + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
            last = tmp;
        }
    }
    return prev[b.length];
};

const nearlyKnown = (key, known) => {
    if (known.has(key)) return true;
    // only worth checking titles of a similar length
    for (const k of known) {
        if (Math.abs(k.length - key.length) > 2) continue;
        if (editDistance(key, k) <= 2) return true;
    }
    return false;
};

/** Every show title already somewhere in the generated plan. */
export const scheduledTitles = () => {
    const set = new Set();
    Object.values(TRACK_RUNS).forEach((runs) => runs.forEach((r) => {
        set.add(norm(r.series ?? r.title));
        set.add(norm(r.title.replace(/\s*\([^)]*\)$/, '')));
    }));
    return set;
};

/**
 * Runs for shows on the board that the plan has never heard of, a week each,
 * queued after the end of whichever Center track their enneagram puts them on.
 */
export const buildNewShowRuns = (shows, trackEnds = TRACK_ENDS) => {
    if (!Array.isArray(shows) || !shows.length) return [];
    const known = scheduledTitles();

    const seen = new Set();
    const fresh = shows.filter((s) => {
        if (!s || !s.name || s.enneagram === undefined) return false;
        const k = norm(s.name);
        if (nearlyKnown(k, known) || seen.has(k)) return false;   // planned, a typo of it, or a dupe row
        seen.add(k);
        return true;
    });
    if (!fresh.length) return [];

    // each track picks up the day after its queue finishes
    const cursor = {};
    const runs = [];
    fresh.forEach((s, i) => {
        const code = TRIAD[s.enneagram];
        if (!code) return;
        const start = cursor[code] ?? addDays(trackEnds[code], 1);
        const nights = DEFAULT_NIGHTS;
        const end = addDays(start, WEEK_DAYS - 1);
        cursor[code] = addDays(end, 1);
        runs.push({
            id: `newshow-${code}-${i}`,
            code,
            show: {
                title: s.name,
                start,
                end,
                nights,
                estimated: true,
                rating: s.rating,
                heartlighted: s.metrics?.heartlighted,
                enneagram: s.enneagram,
                blurb: s.description,
                addedLater: true,
            },
        });
    });
    return runs;
};
