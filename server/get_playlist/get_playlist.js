// Reads "pre-approved" off Spotify. Read-only, always: the shuffled order is
// written to a second playlist, so the original is never touched by any of this.
//
// Spotify has no API keys — it is OAuth all the way down. The one-time
// authorization produced a refresh token, which does not expire; this trades it
// for a fresh access token on every request. That is why nothing here ever asks
// anyone to log in.
//
// Needs SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN.

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

// Spotify's maximum per request on /items is 50 — it was 100 on the /tracks
// endpoint this replaced, so 2019 tracks is 41 pages rather than 21.
const PAGE = 50;

// Only the fields the shuffle reasons over, plus enough to show a track on the
// page. A full playlist item is several KB and there are two thousand of them.
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

// How many requests to keep in flight at once. Spotify rate-limits over a
// rolling window, and firing every page and every artist batch in parallel
// (fifty-plus at once for a large playlist) trips a 429 — which then locks out
// the retries too. A small pool stays comfortably under the limit and is barely
// slower, since each round of requests still overlaps.
const CONCURRENCY = 5;
// One 429 retry, waiting the Retry-After Spotify gives but never long enough to
// blow the function's ten-second budget. The real defence is the pool above;
// this just rides out an occasional collision.
const RETRY_CAP_MS = 3000;

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

// A GET that retries once on 429, honouring Retry-After up to the cap.
const spotifyGet = async (url, token) => {
    for (let attempt = 0; ; attempt += 1) {
        const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
        if (response.status !== 429 || attempt > 0) return response;
        const after = Number(response.headers.get('retry-after')) || 1;
        await new Promise((resolve) => setTimeout(resolve, Math.min(after * 1000, RETRY_CAP_MS)));
    }
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

        // The first page reports the total; the rest go out through the pool,
        // a few at a time. All-at-once trips Spotify's rate limit on a large
        // playlist, and a handful in flight is nearly as fast without the 429.
        const first = await page(token, playlistId, 0);
        const offsets = Array.from(
            { length: Math.ceil((first.total - PAGE) / PAGE) },
            (_, i) => (i + 1) * PAGE,
        );
        const rest = await mapPool(offsets, (offset) => page(token, playlistId, offset));

        const tracks = [first, ...rest]
            .flatMap((p) => p.items ?? [])
            .map(trim)
            // A track pulled from Spotify's catalogue comes back null and cannot
            // be written anywhere, so it is dropped on the way in rather than
            // failing the write later. `total` still reports it, so the page can
            // say how many were skipped.
            .filter((t) => t.uri);

        // Genre enrichment is best-effort: a failure here means the shuffle runs
        // without genre data for this request, but the playlist still loads.
        let genreMap = new Map();
        try {
            const artistIds = [...new Set(tracks.flatMap((t) => t.artistIds).filter(Boolean))];
            if (artistIds.length) {
                // Read the cache first. Only the artists not already stored there
                // need a Spotify call — typically zero on a normal page load.
                const cached = await readGenreCache();
                const missing = artistIds.filter((id) => !cached.has(id));

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
            body: JSON.stringify({ playlistId, total: first.total, tracks: tracksWithGenres }),
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
