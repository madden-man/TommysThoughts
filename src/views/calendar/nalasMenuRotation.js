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
// A recipe also carries a `type`. Only meals marked `dinner` rotate here —
// breakfasts and the `fun` bakes are real recipes but they aren't answers to
// "what's for dinner". `fun` surfaces instead under the baking activity in the
// calendar's add-activity dialog; breakfast is stored and waiting for somewhere
// to belong.
//
// Seventeen meals over a nightly rotation means each comes back about every
// fortnight, which is why this track is gridSilent: it would mark every square.
//
// The meals are grouped by `store` before they cycle, so the rotation runs the
// Trader Joe's meals together, then the Costco ones, then everything a regular
// grocery run covers. That turns the cycle into shopping trips: what one trip
// buys is eaten on consecutive nights, rather than the frozen orange chicken
// coming up on a night eleven days from the last time you were at Trader Joe's.

const toIso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// `type` arrived after the collection did, and for a while an untyped recipe
// counted as a dinner — that's what they all were before the field existed. But
// no row was ever actually typed, so the breakfasts and the banana bread went on
// turning up as tonight's dinner under that fallback. scripts/type-nalas-menu.mjs
// has since typed all of them, so a recipe now has to say it is a dinner to
// rotate as one; a new row added without a type sits out until it is given one.
export const typeOf = (meal) => meal?.type;

export const isVerified = (meal) => !!meal && meal.verified === true && !!(meal.name || meal.dish);

// Where the meal's distinctive ingredients come from. Unlike `type`, a missing
// `store` has a sensible answer — most of these meals are a normal grocery run,
// and only the ones that name Trader Joe's or Costco in their ingredients need
// saying. scripts/tag-nalas-menu.mjs sets the field; an untagged recipe just
// joins the grocery block.
export const DEFAULT_STORE = 'Grocery store';

export const storeOf = (meal) => meal?.store ?? DEFAULT_STORE;

/**
 * The menu in shopping order: meals from one store together, each store in the
 * order its first meal appears on the menu. Grouping this way rather than from a
 * hardcoded list of stores means a new store is added by tagging a recipe, and
 * within a store the menu's own `order` still decides.
 */
export const groupedByStore = (meals) => {
    const blocks = new Map();
    meals.forEach((meal) => {
        const store = storeOf(meal);
        if (!blocks.has(store)) blocks.set(store, []);
        blocks.get(store).push(meal);
    });
    return [...blocks.values()].flat();
};

/** Verified recipes of one type, in menu order — the picker for `fun` uses this. */
export const recipesOfType = (meals, type) =>
    (Array.isArray(meals) ? meals : [])
        .filter((m) => isVerified(m) && typeOf(m) === type)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)
            || (a.name ?? '').localeCompare(b.name ?? ''));

/**
 * One run per night, cycling the menu store by store and wrapping when it runs
 * out. Stable by date, so the same night always offers the same meal rather
 * than reshuffling on every load.
 */
export const buildNalasMenuRuns = (meals, planStart, planEnd) => {
    if (!Array.isArray(meals)) return [];

    const pool = groupedByStore(recipesOfType(meals, 'dinner'));
    if (!pool.length) return [];

    // Where each meal sits in its store's stretch, worked out once: the night's
    // slate says which trip this is and what else that trip would buy.
    const trips = new Map();
    pool.forEach((meal) => {
        const store = storeOf(meal);
        if (!trips.has(store)) trips.set(store, []);
        trips.get(store).push(meal.name ?? meal.dish);
    });

    const runs = [];
    const start = new Date(`${planStart}T00:00:00`);
    const end = new Date(`${planEnd}T00:00:00`);

    let i = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const meal = pool[i++ % pool.length];
        const iso = toIso(d);
        const title = meal.name ?? meal.dish;
        const store = storeOf(meal);
        const trip = trips.get(store);
        runs.push({
            id: `nalas-${iso}`,
            code: 'nm',
            show: {
                title,
                start: iso,
                end: iso,
                description: meal.description,
                ingredients: meal.ingredients ?? [],
                options: meal.options ?? [],
                steps: meal.steps ?? [],
                verified: true,
                poolSize: pool.length,
                store,
                storeNight: trip.indexOf(title) + 1,
                storeSize: trip.length,
                // What the same trip still has to feed. Only what's ahead: the
                // grocery block is eleven nights long, and the meals behind you
                // are already eaten.
                storeAhead: trip.slice(trip.indexOf(title) + 1),
            },
        });
    }
    return runs;
};
