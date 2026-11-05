// The Spotify calls the sources and the builder share, behind the disk cache.
// Not a source itself (the builder only loads the names it is given).
//
// Two tiers of album data. A stub (id, names, type, track count, date, cover)
// comes free with every artist-albums page and search hit and is enough to
// verify a proposal. The full object adds the track list and the length. Since
// the 2026 development-mode limits Spotify answers 403 to the batch
// /albums?ids= endpoint, no longer returns popularity or label, and throttles
// the single /albums/{id} by the day (a 429 with an 85,000 second Retry-After
// on 2026-11-05), so the track list has a second route: a track search
// filtered to the album, kept to the album's own id.

import { get } from '../spotify.mjs';
import { cache, remember } from '../cache.mjs';
import { labelFromCopyrights, looseName } from '../candidates.mjs';

// The app was flagged on 2026-11-05, so every network call is spent from a
// named budget and spaced half a second apart, whatever the concurrency above
// it. The builder sets one budget per phase (known-artist, listenbrainz,
// verify, tracks); a phase that runs out gets a BudgetSpent error and stops
// asking, and since every answer is cached, the next run with fresh budgets
// carries on from where this one stopped. Cache hits cost nothing.
//
// Spotify throttles by endpoint, and by the day: /albums/{id} went first, then
// /artists/{id}/albums an hour later, while /search kept answering. So the
// first long 429 from an endpoint closes that endpoint for the rest of the
// run (a Throttled error, no request sent) and the callers fall back to
// search, instead of collecting the same 429 a hundred more times.
const SPACING_MS = 500;
let phase = { name: 'default', left: Infinity };
let queue = Promise.resolve();
let spent = 0;
// Which endpoints are closed, and until when, is kept on disk too, so a rerun
// inside the window goes straight to the fallbacks without a request to learn
// what the last run already knew.
const throttleFile = () => cache('spotify-throttle');
const FAMILIES = ['search', 'artist-albums', 'albums', 'other'];
const closed = new Set(FAMILIES.filter((fam) => (throttleFile().get(fam) ?? 0) > Date.now()));

export class BudgetSpent extends Error {}
export class Throttled extends Error {}

const family = (path) => {
    if (path.includes('/search')) return 'search';
    if (/\/artists\/[^/]+\/albums/.test(path)) return 'artist-albums';
    if (/\/albums\/[^/?]+\/tracks/.test(path)) return 'albums';
    if (/\/albums\/[^/?]+/.test(path)) return 'albums';
    return 'other';
};

/** Start a phase with `n` Spotify calls to spend. */
export const setSpotifyBudget = (name, n) => { phase = { name, left: n }; };
export const spotifyCallsMade = () => spent;
/** Whether a named cache already holds a key (a free lookup). */
export const cached = (name, key) => cache(name).has(key);

/** The endpoint families Spotify has throttled this run. */
export const throttledEndpoints = () => [...closed];

const call = (path) => {
    const fam = family(path);
    if (closed.has(fam)) return Promise.reject(new Throttled(`Spotify ${fam} is throttled`));
    if (phase.left <= 0) return Promise.reject(new BudgetSpent(`Spotify budget for ${phase.name} spent`));
    phase.left -= 1;
    spent += 1;
    const run = queue.then(() => {
        if (closed.has(fam)) throw new Throttled(`Spotify ${fam} is throttled`);
        return get(path);
    }).catch((e) => {
        if (e.status === 429) {
            closed.add(fam);
            throttleFile().set(fam, Date.now() + (e.retryAfter ?? 3600) * 1000);
            throw new Throttled(`Spotify ${fam} is throttled for ${Math.round((e.retryAfter ?? 0) / 3600)}h`);
        }
        throw e;
    });
    queue = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, SPACING_MS)));
    return run;
};

/** Every page of a paged endpoint, each page spent from the budget. */
const callAll = async (path, pick) => {
    const out = [];
    for (let next = path; next;) {
        // eslint-disable-next-line no-await-in-loop
        const page = await call(next);
        out.push(...(pick(page) ?? []));
        next = page.next;
    }
    return out;
};

const stubs = () => cache('spotify-album-stubs');

const stubOf = (a) => ({
    id: a.id, name: a.name, album_type: a.album_type, total_tracks: a.total_tracks,
    release_date: a.release_date ?? null, image: a.images?.[0]?.url ?? a.image ?? null,
    artists: (a.artists ?? []).map((x) => ({ id: x.id, name: x.name })),
});

const keepStubs = (list) => {
    for (const s of list) if (s?.id && !stubs().has(s.id)) stubs().set(s.id, s);
    return list;
};

/** Every stub seen this run or an earlier one, by id. */
export const albumStub = (id) => stubs().get(id) ?? null;

/**
 * An artist's own albums, as stubs. When /artists/{id}/albums is throttled,
 * an album search on `artist:"<name>"` stands in (two pages of ten), kept to
 * albums whose first credited artist is this one. It is cached apart from the
 * real list, so the real one replaces it once the throttle lifts.
 */
export const cachedArtistAlbums = async (artistId, name = null) => {
    const real = cache('spotify-artist-albums');
    if (real.has(artistId)) return keepStubs(real.get(artistId));
    const bySearch = cache('spotify-artist-albums-by-search');
    try {
        return keepStubs(await remember('spotify-artist-albums', artistId, async () =>
            (await callAll(`/artists/${artistId}/albums?include_groups=album&limit=10`, (p) => p.items)).map(stubOf)));
    } catch (e) {
        if (!(e instanceof Throttled || e instanceof BudgetSpent)) throw e;
        // The stand-in from an earlier throttled run beats nothing, whichever
        // reason the real call could not be made.
        if (bySearch.has(artistId)) return keepStubs(bySearch.get(artistId));
        if (!(e instanceof Throttled) || !name) throw e;
    }
    return keepStubs(await remember('spotify-artist-albums-by-search', artistId, async () => {
        const q = encodeURIComponent(`artist:"${name.replace(/"/g, '')}"`);
        const out = [];
        for (let page = 0; page < 2; page += 1) {
            // eslint-disable-next-line no-await-in-loop
            const items = (await call(`/search?type=album&limit=10&offset=${page * 10}&q=${q}`)).albums?.items ?? [];
            out.push(...items.filter((a) => a?.artists?.[0]?.id === artistId).map(stubOf));
            if (items.length < 10) break;
        }
        return out;
    }));
};

/**
 * Albums credited first to an artist of this name, by album search alone: one
 * call where the artist route costs an artist search plus the album pages.
 * Used for neighbours while /artists/{id}/albums is throttled.
 */
export const cachedAlbumsByArtistName = async (name) => keepStubs(await remember('spotify-albums-by-artist-name', name, async () => {
    const want = looseName(name);
    const q = encodeURIComponent(`artist:"${name.replace(/"/g, '')}"`);
    const items = (await call(`/search?type=album&limit=10&q=${q}`)).albums?.items ?? [];
    return items.filter((a) => looseName(a?.artists?.[0]?.name ?? '') === want).map(stubOf);
}));

export const cachedSearchArtists = (name) => remember('spotify-search-artists', name, async () =>
    ((await call(`/search?type=artist&limit=5&q=${encodeURIComponent(name)}`)).artists?.items ?? []).map((a) => ({ id: a.id, name: a.name })));

export const cachedSearchAlbums = async (artist, album) => keepStubs(await remember('spotify-search-albums', `${artist}\u0000${album}`, async () =>
    ((await call(`/search?type=album&limit=10&q=${encodeURIComponent(`album:${album} artist:${artist}`)}`)).albums?.items ?? []).map(stubOf)));

// A free-text search for when the field-filtered one finds nothing: Spotify's
// `album:` filter is literal about punctuation that a hand-written proposal
// gets slightly wrong.
export const cachedSearchAlbumsLoose = async (artist, album) => keepStubs(await remember('spotify-search-albums-loose', `${artist}\u0000${album}`, async () =>
    ((await call(`/search?type=album&limit=10&q=${encodeURIComponent(`${artist} ${album}`)}`)).albums?.items ?? []).map(stubOf)));

// Once /albums/{id} has said "come back tomorrow", asking again per album
// only spends requests against a quota that is already gone.
let albumsThrottled = false;
export const albumEndpointThrottled = () => albumsThrottled;

/**
 * The full album, trimmed, or undefined when it cannot be had this run (the
 * endpoint is throttled); null means Spotify does not know the id. Only real
 * answers are cached, so a throttled run leaves the gap for the next one.
 */
export const cachedAlbum = async (id) => {
    const c = cache('spotify-albums');
    if (c.has(id)) return c.get(id);
    if (albumsThrottled) return undefined;
    let a;
    try {
        a = await call(`/albums/${id}`);
    } catch (e) {
        if (e instanceof BudgetSpent) return undefined;
        if (e instanceof Throttled) { albumsThrottled = true; return undefined; }
        if (/Spotify (404|400)/.test(e.message)) { c.set(id, null); return null; }
        throw e;
    }
    const items = [...(a.tracks?.items ?? [])];
    if (a.tracks?.next) items.push(...await callAll(a.tracks.next, (p) => p.items));
    items.sort((x, y) => (x.disc_number - y.disc_number) || (x.track_number - y.track_number));
    const full = {
        ...stubOf(a),
        popularity: a.popularity ?? null,
        label: a.label ?? labelFromCopyrights(a.copyrights),
        ms: items.reduce((sum, t) => sum + (t.duration_ms ?? 0), 0),
        trackUris: items.map((t) => t.uri).filter(Boolean),
        complete: true,
    };
    c.set(id, full);
    return full;
};

/**
 * The track list by search, for when /albums/{id} is throttled: tracks from
 * `album:"<name>" artist:"<artist>"`, ten a page (the search limit for this
 * app), kept only when their album id is this album's. `complete` says whether
 * every track was found; an incomplete list is cached all the same, because
 * the search will not find more tomorrow, and a later run with /albums/{id}
 * back replaces it.
 */
export const cachedTracksBySearch = (stub, { maxPages = 4 } = {}) => remember('spotify-tracks-by-search', stub.id, async () => {
    const q = encodeURIComponent(`album:"${stub.name.replace(/"/g, '')}" artist:"${(stub.artists?.[0]?.name ?? '').replace(/"/g, '')}"`);
    const found = new Map();
    for (let page = 0; page < maxPages; page += 1) {
        // eslint-disable-next-line no-await-in-loop
        const items = (await call(`/search?type=track&limit=10&offset=${page * 10}&q=${q}`)).tracks?.items ?? [];
        for (const t of items) if (t?.album?.id === stub.id && t.uri) found.set(t.uri, t);
        if (items.length < 10 || found.size >= (stub.total_tracks ?? Infinity)) break;
    }
    const tracks = [...found.values()].sort((x, y) => (x.disc_number - y.disc_number) || (x.track_number - y.track_number));
    return {
        ms: tracks.reduce((sum, t) => sum + (t.duration_ms ?? 0), 0),
        trackUris: tracks.map((t) => t.uri),
        complete: tracks.length >= (stub.total_tracks ?? Infinity),
    };
});
