// Turns the Movies board into a nightly rotation.
//
// The board is the source of truth: 60 hand-curated films carrying enneagram and
// heartlighted values, plus everything imported from the Letterboxd export
// (watchlist, ratings, likes, list membership). Adding a film to the board — by
// hand in /darts or by re-running scripts/import-letterboxd.mjs — puts it in the
// rotation on the next load.
//
// A film is roughly one evening, so it gets exactly one night rather than a span,
// and there is one every night.
//
// Only films rated 4 stars or better make the cut. Note what that implies: you
// can only rate a film you have seen, so the 555-film unwatched watchlist is
// excluded by definition and this track suggests favourites worth revisiting
// rather than something new.

const toIso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const MIN_STARS = 4;

// Films from the board that suit a given cuisine, so a Japanese dinner can be
// paired with a Japanese film. Only confident pairings are listed — several
// cuisines on the menu have no matching film on the board at all, and those
// nights fall back to food films and then to the general ranked pool rather
// than forcing a bad match.
const CUISINE_FILMS = {
    japanese: ['Princess Mononoke', 'My Neighbor Totoro', 'Grave of the Fireflies',
        'Castle in the Sky', 'Nausicaä of the Valley of the Wind', 'Akira', 'Your Name',
        'Suzume', 'The Boy and the Heron', 'Demon Slayer', 'Toshikoshi'],
    korean: ['Parasite', 'KPop Demon Hunters', 'Past Lives'],
    chinese: ['Everything, Everywhere, All at Once', 'Crazy Rich Asians', 'Dìdi'],
    indian: ['Slumdog Millionaire', 'The Big Sick'],
    french: ['Ratatouille', 'La Haine'],
    italian: ['The Italian Job', 'The Talented Mr. Ripley'],
    'italian-american': ['The Italian Job', 'The Talented Mr. Ripley'],
    irish: ['Song of the Sea'],
    german: ['Jojo Rabbit'],
    polish: ["Schindler's List"],
    jewish: ["Schindler's List"],
    greek: ['The Odyssey'],
    mediterranean: ['The Odyssey'],
    american: ['Forrest Gump', 'Talladega Nights', 'Independence Day', 'Top Gun',
        'National Treasure', 'Do the Right Thing', 'Moneyball', 'Little Miss Sunshine',
        'Captain America: The First Avenger'],
    hawaiian: ["Surf's Up", 'Point Break'],
    cajun: ['Sinners'],
    louisiana: ['Sinners'],
};

// Films about food itself — a decent pairing for any dinner whose cuisine has no
// film on the board.
const FOOD_FILMS = ['Chef', 'The Menu', 'Ratatouille'];

const cuisineKeys = (cuisine = '') => {
    const c = cuisine.toLowerCase();
    const hit = Object.keys(CUISINE_FILMS).filter((k) => c.includes(k));
    // "Italian-American" should prefer the italian-american list over plain italian
    return hit.sort((a, b) => b.length - a.length);
};

const matches = (film, needles) =>
    needles.some((n) => film.name.toLowerCase().includes(n.toLowerCase()));


/**
 * Rank the board so the best candidates come up first — there are more films than
 * nights in the plan, so ordering decides what actually gets watched.
 * Curated picks and list members outrank the rest.
 */
export const rankMovies = (movies) => [...movies]
    .filter((m) => m && m.name && typeof m.rating === 'number' && m.rating >= MIN_STARS)
    .sort((a, b) => {
        const unseen = (m) => (m.watched ? 1 : 0);
        const curated = (m) => (m.enneagram !== undefined ? 0 : 1);
        const listed = (m) => (m.lists?.length ? 0 : 1);
        const liked = (m) => (m.liked ? 0 : 1);
        return unseen(a) - unseen(b)
            || curated(a) - curated(b)
            || listed(a) - listed(b)
            || liked(a) - liked(b)
            || (b.rating ?? 0) - (a.rating ?? 0)
            || a.name.localeCompare(b.name);
    });

// How long a film has to sit out before it can come round again. Pairing pulls
// from lists as short as one film — "cajun" is only Sinners — and a dinner
// cuisine now holds a whole week, so without this the same film paired itself
// to all seven nights and read as a film that runs for a week.
export const MIN_GAP_DAYS = 60;

export const buildMovieRuns = (movies, dinnerRuns, planStart, planEnd) => {
    const pool = rankMovies(Array.isArray(movies) ? movies : []);
    if (!pool.length) return [];

    // what cuisine is on the menu each night
    const cuisineOn = new Map();
    (dinnerRuns ?? []).forEach((r) => {
        const from = new Date(`${r.show.start}T00:00:00`);
        const to = new Date(`${r.show.end}T00:00:00`);
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
            cuisineOn.set(toIso(d), r.show.cuisine);
        }
    });

    // Shortlists don't change night to night, so build them once rather than
    // re-filtering the whole board for every day of the plan.
    const shortlists = new Map();
    Object.keys(CUISINE_FILMS).forEach((key) => {
        shortlists.set(key, pool.filter((m) => matches(m, CUISINE_FILMS[key])));
    });
    const foodShortlist = pool.filter((m) => matches(m, FOOD_FILMS));

    const runs = [];
    const start = new Date(`${planStart}T00:00:00`);
    const end = new Date(`${planEnd}T00:00:00`);
    const lastUsed = new Map();   // film name -> the day index it last came up
    let dayIndex = 0;

    // Never seen? Take it, and because the pool is ranked, that's the best film
    // still unwatched. Otherwise offer the one that's been waiting longest, and
    // only if it has waited long enough — a caller that gets null tries a less
    // specific source rather than repeating a film.
    const pick = (candidates, { force = false } = {}) => {
        let waiting = null;
        let waitingSince = Infinity;
        for (const film of candidates) {
            const at = lastUsed.get(film.name);
            if (at === undefined) return film;
            if (at < waitingSince) { waiting = film; waitingSince = at; }
        }
        if (!waiting) return null;
        return force || dayIndex - waitingSince >= MIN_GAP_DAYS ? waiting : null;
    };

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1), dayIndex++) {
        const iso = toIso(d);
        const cuisine = cuisineOn.get(iso);

        // pair with the dinner where the board actually has a suitable film
        let film = null;
        let pairedTo = null;
        for (const key of cuisineKeys(cuisine)) {
            const choice = pick(shortlists.get(key) ?? []);
            if (!choice) continue;   // that cuisine's films are all still recent
            film = choice;
            pairedTo = cuisine;
            break;
        }
        if (!film && cuisine) {
            const choice = pick(foodShortlist);
            if (choice) {
                film = choice;
                pairedTo = `${cuisine} — no film for that cuisine, so a food film`;
            }
        }
        // Falling back to the whole board, and finally to whichever film has
        // been waiting longest — with fewer films than nights in the plan,
        // something has to come round again eventually.
        if (!film) film = pick(pool) ?? pick(pool, { force: true });
        lastUsed.set(film.name, dayIndex);
        runs.push({
            id: `movie-${iso}`,
            code: 'm',
            show: {
                title: film.year ? `${film.name} (${film.year})` : film.name,
                start: iso,
                end: iso,
                rating: film.rating,
                heartlighted: film.metrics?.heartlighted,
                enneagram: film.enneagram,
                blurb: film.description,
                lists: film.lists ?? [],
                liked: !!film.liked,
                watched: !!film.watched,
                curated: film.enneagram !== undefined,
                poolSize: pool.length,
                minStars: MIN_STARS,
                pairedTo,
                dinnerCuisine: cuisine,
                letterboxdUri: film.letterboxdUri,
            },
        });
    }
    return runs;
};
