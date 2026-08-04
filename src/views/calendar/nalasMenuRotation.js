// The second dinner track: the meals from the `nalas-menu` collection.
//
// The first dinner track is a 52-week menu — a cuisine and a featured dish per
// week, with recipe links that may or may not still resolve. This one is the
// opposite kind of thing: a short list of meals written out by hand, with the
// ingredients and the steps, every one of them marked `verified`. So the two
// tracks answer different questions on the same night — "what's the theme this
// week" and "what do we already know how to cook".
//
// Only verified meals reach the calendar. An unverified row is a draft, and the
// point of this track is that everything on it has been made and checked.
//
// Twelve meals over a nightly rotation means each comes back about every twelve
// days, which is why this track is gridSilent: it would mark every square.

const toIso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * One run per night, cycling the menu in its saved `order` and wrapping when it
 * runs out. Stable by date, so the same night always offers the same meal
 * rather than reshuffling on every load.
 */
export const buildNalasMenuRuns = (meals, planStart, planEnd) => {
    if (!Array.isArray(meals)) return [];

    const pool = meals
        .filter((m) => m && m.verified === true && (m.name || m.dish))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)
            || (a.name ?? '').localeCompare(b.name ?? ''));
    if (!pool.length) return [];

    const runs = [];
    const start = new Date(`${planStart}T00:00:00`);
    const end = new Date(`${planEnd}T00:00:00`);

    let i = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const meal = pool[i++ % pool.length];
        const iso = toIso(d);
        runs.push({
            id: `nalas-${iso}`,
            code: 'nm',
            show: {
                title: meal.name ?? meal.dish,
                start: iso,
                end: iso,
                description: meal.description,
                ingredients: meal.ingredients ?? [],
                options: meal.options ?? [],
                steps: meal.steps ?? [],
                verified: true,
                poolSize: pool.length,
            },
        });
    }
    return runs;
};
