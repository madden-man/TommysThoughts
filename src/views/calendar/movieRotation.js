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

export const buildMovieRuns = (movies, planStart, planEnd) => {
    const pool = rankMovies(Array.isArray(movies) ? movies : []);
    if (!pool.length) return [];

    const runs = [];
    const start = new Date(`${planStart}T00:00:00`);
    const end = new Date(`${planEnd}T00:00:00`);
    let i = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const film = pool[i++ % pool.length];   // wraps when the pool runs dry
        const iso = toIso(d);
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
                letterboxdUri: film.letterboxdUri,
            },
        });
    }
    return runs;
};
