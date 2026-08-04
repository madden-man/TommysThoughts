// Turns the `dinners` collection into calendar runs.
//
// Nothing here is hardcoded to 52 weeks. The year is divided into as many slices
// as there are dinner documents, so adding a 53rd week — or dropping to 40 —
// reflows the rotation on the next load with no code change. Meals added to an
// existing week widen that week's slate without moving any boundary.
//
// A dinner week covers all seven nights. The meals in it divide the week between
// them by weight rather than each taking only the nights it serves, so there is
// always something on for tonight — the track never goes quiet mid-week.

const toIso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Dinner weeks start on Sunday so they line up with the rows of the month grid.
// Slicing the year from Jan 1 instead would inherit whatever weekday Jan 1
// happens to be — Thursday in 2026, Friday in 2027, Saturday in 2028.
const sundayOnOrBefore = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
};

const yearAnchor = (year) => sundayOnOrBefore(new Date(year, 0, 1));

const addDays = (date, n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
};

// Total nights a week's meals cover, used only for display.
export const plannedNights = (dinner) =>
    (dinner.servesNights ?? 0)
    + (dinner.supporting ?? []).reduce((n, s) => n + (s.servesNights ?? 0), 0);

/**
 * Build one run per dinner-week for every year the plan touches.
 * Returns [] for empty input so the calendar simply omits the track.
 */
export const buildDinnerRuns = (dinners, planStart, planEnd) => {
    if (!Array.isArray(dinners) || dinners.length === 0) return [];

    const ordered = [...dinners]
        .filter((d) => Number.isFinite(d.week))
        .sort((a, b) => a.week - b.week);
    if (!ordered.length) return [];

    const runs = [];
    const firstYear = Number(planStart.slice(0, 4));
    const lastYear = Number(planEnd.slice(0, 4));

    for (let year = firstYear; year <= lastYear + 1; year++) {
        const anchor = yearAnchor(year);
        const nextAnchor = yearAnchor(year + 1);
        // 52 or 53 whole weeks between one year's anchor Sunday and the next.
        const weeksInYear = Math.round((nextAnchor - anchor) / (7 * 86400000));
        const slices = ordered.length;
        ordered.forEach((dinner, i) => {
            // Whole weeks per dinner, so every boundary stays on a Sunday and a
            // 53-week year simply gives one dinner a fortnight.
            const fromWeek = Math.floor((i * weeksInYear) / slices);
            const toWeek = Math.floor(((i + 1) * weeksInYear) / slices);
            if (toWeek <= fromWeek) return;
            const weekStart = addDays(anchor, fromWeek * 7);
            const weekEnd = addDays(anchor, toWeek * 7 - 1);
            if (toIso(weekEnd) < planStart || toIso(weekStart) > planEnd) return;

            const weekContext = {
                cuisine: dinner.cuisine,
                occasion: dinner.occasion,
                produce: dinner.produce ?? [],
                weekNumber: dinner.week,
                weekStart: toIso(weekStart),
                weekEnd: toIso(weekEnd),
                weekPlanned: plannedNights(dinner),
            };

            // The featured dinner leads, then its supporting meals.
            const meals = [
                {
                    title: dinner.dinner,
                    nights: dinner.servesNights ?? 1,
                    featured: true,
                    blurb: dinner.blurb,
                    sides: dinner.sides ?? [],
                    dessert: dinner.dessert,
                    leftovers: dinner.leftovers,
                    menu: dinner.menu ?? [],
                    recipes: dinner.recipes ?? [],
                    supporting: dinner.supporting ?? [],
                },
                ...(dinner.supporting ?? []).map((s) => ({
                    title: s.dinner,
                    nights: s.servesNights ?? 1,
                    featured: false,
                    blurb: s.note,
                    sides: [],
                    dessert: undefined,
                    menu: [],
                    recipes: [],
                    supporting: [],
                    mealCuisine: s.cuisine,
                })),
            ];

            // The week's meals divide the whole week between them — every night
            // belongs to one of them, none is left blank. The split is weighted
            // by how many nights each meal actually serves, so a dinner that
            // stretches to three holds more of the week than a one-night meal,
            // but the same floor-based slicing used for the year above keeps the
            // boundaries flush: no gaps, no overlaps, whatever the weights.
            //
            // A meal can still come out with nothing when a week is crowded —
            // eight meals cannot each take a night out of seven — and that meal
            // simply sits the week out.
            const weekLength = Math.round((weekEnd - weekStart) / 86400000) + 1;
            const weights = meals.map((meal) => Math.max(1, meal.nights));
            const totalWeight = weights.reduce((n, w) => n + w, 0);
            let carried = 0;
            meals.forEach((meal, m) => {
                const from = Math.floor((carried * weekLength) / totalWeight);
                carried += weights[m];
                const to = Math.floor((carried * weekLength) / totalWeight);
                if (to <= from) return;                    // no room this week
                const start = toIso(addDays(weekStart, from));
                const end = toIso(addDays(weekStart, to - 1));
                if (end < planStart || start > planEnd) return;
                // Clamp first, then measure: the weeks at either end of the plan
                // are clipped, and a run there covers the nights it actually
                // gets, not the nights the week would have given it.
                const fromIso = start < planStart ? planStart : start;
                const toIsoClamped = end > planEnd ? planEnd : end;
                runs.push({
                    id: `dinner-${year}-${dinner.week}-${m}`,
                    code: 'n',
                    show: {
                        ...weekContext,
                        ...meal,
                        cuisine: meal.mealCuisine ?? weekContext.cuisine,
                        start: fromIso,
                        end: toIsoClamped,
                        // What the food does, and what the calendar gives it —
                        // now two different numbers, since a meal is spread to
                        // fill the week rather than trimmed to what it serves.
                        servesNights: meal.nights,
                        coversNights: Math.round(
                            (new Date(`${toIsoClamped}T00:00:00`)
                                - new Date(`${fromIso}T00:00:00`)) / 86400000) + 1,
                    },
                });
            });
        });
    }
    return runs.sort((a, b) => a.show.start.localeCompare(b.show.start));
};
