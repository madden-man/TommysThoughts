// Turns the `restaurants` collection into a Friday-night rotation: one new place
// to try each week.
//
// Every restaurant is used once before any repeats, so this works through the
// list rather than circling the same few. Adding a row in Mongo puts it in the
// rotation on the next load; an empty collection simply hides the track.

const toIso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const RESTAURANT_NIGHT = 5;   // Friday

export const buildRestaurantRuns = (restaurants, planStart, planEnd) => {
    const pool = (Array.isArray(restaurants) ? restaurants : [])
        .filter((r) => r && r.name)
        .sort((a, b) => a.name.localeCompare(b.name));
    if (!pool.length) return [];

    const runs = [];
    const start = new Date(`${planStart}T00:00:00`);
    const end = new Date(`${planEnd}T00:00:00`);
    let i = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== RESTAURANT_NIGHT) continue;
        const place = pool[i++ % pool.length];
        const iso = toIso(d);
        runs.push({
            id: `restaurant-${iso}`,
            code: 'r',
            show: {
                title: place.name,
                start: iso,
                end: iso,
                cuisine: place.cuisine,
                neighborhood: place.neighborhood,
                address: place.address,
                url: place.url,
                note: place.note,
                poolSize: pool.length,
                visitNumber: Math.floor(i / pool.length) + 1,
            },
        });
    }
    return runs;
};
