// Turns the `activities` collection — the same one /bump reads — into three
// parallel tracks, one per bump symbol.
//
// Activities carry only { symbol, header }, and the symbol is the whole signal
// for how involved something is:
//
//   🏓  let's go play   — outings: hot springs, horseback riding, a music festival
//   🔨  time to work    — classes, errands, the gym
//   🏠  low key hang    — reading, puzzles, a fire pit
//
// 🏓 is the involved one, so it only ever lands on a Saturday. 🔨 and 🏠 fill the
// other six days. Each pool cycles independently and wraps when it runs out, so
// the tracks neither align to weeks nor finish the year — they just recycle.
// Adding an activity in /bump drops it into its symbol's rotation on next load.

export const PLAY = '🏓';
export const WORK = '🔨';
export const HOME = '🏠';

// track code -> which symbol it draws from, and which days it runs on
export const ACTIVITY_TRACKS = {
    ap: { symbol: PLAY, saturdayOnly: true },
    aw: { symbol: WORK, saturdayOnly: false },
    ah: { symbol: HOME, saturdayOnly: false },
};

const toIso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * One run per day per track. Each track walks its own pool in a stable order, so
 * the same date always yields the same suggestion rather than reshuffling.
 */
export const buildActivityRuns = (activities, planStart, planEnd) => {
    if (!Array.isArray(activities) || activities.length === 0) return [];

    const sorted = [...activities]
        .filter((a) => a && a.header)
        .sort((a, b) => a.header.localeCompare(b.header));

    const pools = {};
    Object.entries(ACTIVITY_TRACKS).forEach(([code, { symbol }]) => {
        pools[code] = sorted.filter((a) => a.symbol === symbol);
    });

    const runs = [];
    const cursor = {};
    Object.keys(ACTIVITY_TRACKS).forEach((code) => { cursor[code] = 0; });

    const start = new Date(`${planStart}T00:00:00`);
    const end = new Date(`${planEnd}T00:00:00`);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const isSaturday = d.getDay() === 6;
        const iso = toIso(d);
        Object.entries(ACTIVITY_TRACKS).forEach(([code, rules]) => {
            const pool = pools[code];
            if (!pool.length) return;
            if (rules.saturdayOnly !== isSaturday) return;   // wrong kind of day
            const pick = pool[cursor[code]++ % pool.length]; // wraps automatically
            runs.push({
                id: `activity-${code}-${iso}`,
                code,
                show: {
                    title: pick.header,
                    start: iso,
                    end: iso,
                    symbol: pick.symbol,
                    involved: rules.saturdayOnly,
                    poolSize: pool.length,
                },
            });
        });
    }
    return runs;
};
