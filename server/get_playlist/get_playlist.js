// Reads a playlist off Spotify. Read-only, always: a shuffled order is written
// to a second playlist, so the source is never touched by any of this.
//
// Spotify has no API keys — it is OAuth all the way down. A one-time
// authorization produced a refresh token; the shared auth module trades it for a
// short-lived access token and caches that. Nothing here ever asks anyone to log
// in.
//
// Only the first MAX_TRACKS are read. A huge playlist (some run to five figures)
// would take hundreds of page requests, which trips Spotify's rate limit and
// doesn't fit a function's ten seconds — so the tool shuffles the first couple
// of thousand and leaves the tail alone, keeping every playlist to the same
// small, safe footprint.
//
// Needs SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN and
// MONGODB_URI.

const { MongoClient } = require('mongodb');
const { accessToken } = require('../_shared/spotify');

const mongoClient = new MongoClient(process.env.MONGODB_URI);
const clientPromise = mongoClient.connect();

// The playlist ids are in their share URLs and are not secrets, so they sit here
// with env overrides rather than becoming more things to configure.
const SOURCE_PLAYLIST_ID =
    process.env.SPOTIFY_SOURCE_PLAYLIST_ID || '6WukX3ygx4jlDsOih5fQtI';

// A Spotify id is base62 and 22 characters. The page can name which playlist to
// read, so the incoming value is checked against that shape rather than trusted
// — anything else falls back to the default source.
const isPlaylistId = (value) => typeof value === 'string' && /^[A-Za-z0-9]{22}$/.test(value);

// Spotify's maximum per request on /items is 50.
const PAGE = 50;
// The most tracks read from any one playlist — 50 pages, comfortably above
// pre-approved's ~2,000. Anything past this is left unshuffled.
const MAX_TRACKS = 2500;
// Requests in flight at once — kept small so the burst stays under the rate
// limit and inside the function's budget.
const CONCURRENCY = 3;
// Missing-artist batches to resolve per load. Genres fill in over a few loads
// rather than in one burst that would rate-limit the read.
const MAX_GENRE_BATCHES = 4;
// Leave the function a little room under its ten seconds for the response.
const BUDGET_MS = 9000;

let deadline = 0;

// Run `fn` over `items` with at most `CONCURRENCY` in flight, preserving order.
const mapPool = async (items, fn) => {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i], i);
        }
    };
    await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker),
    );
    return out;
};

// Raised when Spotify keeps answering 429 — carries the Retry-After so the page
// can stop calling for that long instead of hammering a throttled app.
class RateLimited extends Error {
    constructor(retryAfter) {
        super('rate_limited');
        this.rateLimited = true;
        this.retryAfter = retryAfter;
    }
}

// A GET that retries on 429, honouring Retry-After but never waiting past what
// the function's budget allows. If it still can't get through, it throws with
// the Retry-After rather than returning the 429 for a caller to misread.
const spotifyGet = async (url, token) => {
    for (let attempt = 0; ; attempt += 1) {
        const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
        if (response.status !== 429) return response;
        const retryAfter = Number(response.headers.get('retry-after')) || 1;
        const room = deadline - Date.now() - 1500;
        if (attempt >= 2 || retryAfter * 1000 > room) throw new RateLimited(retryAfter);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    }
};

// Only the fields the shuffle reasons over, plus enough to show a track on the
// page. A full playlist item is several KB and there are thousands of them.
//
// The March 2026 Web API migration renamed the entry's payload from `track` to
// `item`; `track` is still sent but deprecated, so this prefers `item` and falls
// back rather than depending on which one a given response carries.
const trim = (entry) => {
    const track = entry?.item ?? entry?.track ?? {};
    return {
        uri: track.uri,
        name: track.name,
        artistIds: (track.artists ?? []).map((a) => a.id),
        artistNames: (track.artists ?? []).map((a) => a.name),
        albumId: track.album?.id ?? null,
        albumName: track.album?.name ?? null,
        // Where the track sits on its own album. The shuffle scatters an
        // album's tracks across a season but plays them in this order, so a
        // record still unfolds the way it was sequenced.
        discNumber: track.disc_number ?? null,
        trackNumber: track.track_number ?? null,
        addedAt: entry?.added_at ?? null,
    };
};

// Genres live on the artist, not the track or the playlist item. Spotify returns
// them sorted by relevance, so the first one is the most representative tag.
const fetchArtistGenres = async (token, artistIds) => {
    const batches = [];
    for (let i = 0; i < artistIds.length; i += 50)
        batches.push(artistIds.slice(i, i + 50));

    const results = await mapPool(batches, async (batch) => {
        const url = `https://api.spotify.com/v1/artists?ids=${batch.join(',')}`;
        try {
            const response = await spotifyGet(url, token);
            if (!response.ok) return [];
            return (await response.json()).artists ?? [];
        } catch (_) {
            return [];
        }
    });

    const map = new Map();
    results.flat().forEach((artist) => {
        if (artist?.id) map.set(artist.id, artist.genres?.[0] ?? '');
    });
    return map;
};

// Genre cache: one document in tommy-data.spotify_artist_genres keyed by
// { _id: 'artist_genres', genres: { [artistId]: genre } }. Only artists missing
// from the cache hit Spotify; new entries are merged in with $set so the document
// grows incrementally rather than being replaced wholesale.
const genreCollection = async () => {
    const db = (await clientPromise).db('tommy-data');
    return db.collection('spotify_artist_genres');
};

const readGenreCache = async () => {
    const col = await genreCollection();
    const doc = await col.findOne({ _id: 'artist_genres' });
    return new Map(Object.entries(doc?.genres ?? {}));
};

const writeGenreCache = async (newGenres) => {
    if (!newGenres.size) return;
    const col = await genreCollection();
    const update = {};
    newGenres.forEach((genre, id) => { update[`genres.${id}`] = genre; });
    await col.updateOne(
        { _id: 'artist_genres' },
        { $set: { ...update, updatedAt: new Date().toISOString() } },
        { upsert: true },
    );
};

const page = async (token, playlistId, offset) => {
    // /items, not /tracks: the older endpoint was removed in the March 2026
    // migration and now answers 403 for every playlist, including public ones.
    const url = `https://api.spotify.com/v1/playlists/${playlistId}/items`
        + `?offset=${offset}&limit=${PAGE}`
        + '&fields=total,items(added_at,item(uri,name,disc_number,track_number,'
        + 'artists(id,name),album(id,name)))';
    const response = await spotifyGet(url, token);
    if (!response.ok) throw new Error(`Spotify ${response.status}: ${await response.text()}`);
    return response.json();
};

const handler = async (event) => {
    try {
        deadline = Date.now() + BUDGET_MS;

        // A tab can name which playlist to read; anything not shaped like a
        // Spotify id falls back to the default source.
        let requested;
        try {
            requested = JSON.parse(event?.body || '{}').playlistId;
        } catch (_) {
            requested = undefined;
        }
        const playlistId = isPlaylistId(requested) ? requested : SOURCE_PLAYLIST_ID;

        const token = await accessToken();

        // The first page reports the total; the rest go out through the pool, a
        // few at a time, and only up to the cap.
        const first = await page(token, playlistId, 0);
        const total = first.total ?? 0;
        const wanted = Math.min(total, MAX_TRACKS);
        const offsets = [];
        for (let o = PAGE; o < wanted; o += PAGE) offsets.push(o);
        const rest = await mapPool(offsets, (offset) => page(token, playlistId, offset));

        const tracks = [first, ...rest]
            .flatMap((p) => p.items ?? [])
            .map(trim)
            // A track pulled from Spotify's catalogue comes back null and cannot
            // be written anywhere, so it is dropped on the way in.
            .filter((t) => t.uri)
            .slice(0, MAX_TRACKS);

        // Genre enrichment is best-effort: a failure here means the shuffle runs
        // without genre data for this request, but the playlist still loads.
        let genreMap = new Map();
        try {
            const artistIds = [...new Set(tracks.flatMap((t) => t.artistIds).filter(Boolean))];
            if (artistIds.length) {
                // Read the cache first. Only the artists not already stored there
                // need a Spotify call — and only a bounded batch per load, so a
                // fresh playlist fills in over a few visits rather than bursting.
                const cached = await readGenreCache();
                const missing = artistIds
                    .filter((id) => !cached.has(id))
                    .slice(0, MAX_GENRE_BATCHES * 50);

                if (missing.length) {
                    const fetched = await fetchArtistGenres(token, missing);
                    fetched.forEach((genre, id) => cached.set(id, genre));
                    // Fire-and-forget: a write failure must not delay the response.
                    writeGenreCache(fetched).catch(() => {});
                }

                genreMap = cached;
            }
        } catch (_) {
            // Swallowed — see above.
        }

        const tracksWithGenres = tracks.map((t) => ({
            ...t,
            genre: genreMap.get(t.artistIds[0]) ?? '',
        }));

        return {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                playlistId,
                total,
                tracks: tracksWithGenres,
                // Whether the playlist runs past the cap, so the page can say the
                // tail isn't being shuffled.
                capped: total > MAX_TRACKS,
            }),
        };
    } catch (error) {
        if (error && error.rateLimited) {
            return {
                statusCode: 429,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ error: 'rate_limited', retryAfter: error.retryAfter }),
            };
        }
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
