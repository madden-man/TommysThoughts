// Reads a playlist off Spotify. Read-only, always: a shuffled order is written
// to a second playlist, so the source is never touched by any of this.
//
// Spotify has no API keys — it is OAuth all the way down. A one-time
// authorization produced a refresh token; the shared auth module trades it for a
// short-lived access token and caches that. Nothing here ever asks anyone to log
// in.
//
// Large playlists (the "master" lists run to five figures) are the reason this
// is not a single fetch: pulling 160 pages at once trips Spotify's rate limit
// (429), and would not fit inside a function's ten seconds anyway. So a playlist
// is BUILT — a bounded chunk of pages per call, progress saved to Mongo — and
// CACHED by its snapshot id, so once built it is served without touching Spotify
// again until the playlist itself changes.
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
// Pages fetched per invocation. Kept low so the burst stays under the rate limit
// and comfortably inside the function's budget; the client re-calls until the
// build is complete, resuming from where the last call left off.
const PAGES_PER_CALL = 20;
// Requests in flight at once — small on purpose, for the same reason.
const CONCURRENCY = 3;
// Missing-artist batches to resolve per served response. Genres fill in over a
// few loads rather than in one burst that would rate-limit the build.
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

// A GET that retries on 429, honouring Retry-After but never waiting past what
// the function's budget allows.
const spotifyGet = async (url, token) => {
    for (let attempt = 0; ; attempt += 1) {
        const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
        if (response.status !== 429) return response;
        const afterMs = (Number(response.headers.get('retry-after')) || 1) * 1000;
        const room = deadline - Date.now() - 1500;
        if (attempt >= 2 || afterMs > room) return response;
        await new Promise((resolve) => setTimeout(resolve, Math.min(afterMs, room)));
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

// Built playlists: one document per playlist in tommy-data.spotify_playlists,
// keyed by its Spotify id. Holds the trimmed tracks, the snapshot id they were
// built from, and how far the build has got.
const playlistCollection = async () => {
    const db = (await clientPromise).db('tommy-data');
    return db.collection('spotify_playlists');
};

const page = async (token, playlistId, offset) => {
    // /items, not /tracks: the older endpoint was removed in the March 2026
    // migration and now answers 403 for every playlist, including public ones.
    const url = `https://api.spotify.com/v1/playlists/${playlistId}/items`
        + `?offset=${offset}&limit=${PAGE}`
        + '&fields=items(added_at,item(uri,name,disc_number,track_number,'
        + 'artists(id,name),album(id,name)))';
    const response = await spotifyGet(url, token);
    if (!response.ok) throw new Error(`Spotify ${response.status}: ${await response.text()}`);
    return response.json();
};

const json = (body) => ({
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
});

// A finished playlist, with genres applied from the cache. A bounded number of
// still-missing artists are resolved on each serve, so genres fill in over a few
// loads without ever bursting.
const serve = async (col, token, playlistId, total) => {
    const doc = await col.findOne({ _id: playlistId });
    const tracks = doc?.tracks ?? [];

    let genreMap = new Map();
    try {
        const artistIds = [...new Set(tracks.flatMap((t) => t.artistIds).filter(Boolean))];
        if (artistIds.length) {
            const cached = await readGenreCache();
            const missing = artistIds
                .filter((id) => !cached.has(id))
                .slice(0, MAX_GENRE_BATCHES * 50);
            if (missing.length) {
                const fetched = await fetchArtistGenres(token, missing);
                fetched.forEach((genre, id) => cached.set(id, genre));
                writeGenreCache(fetched).catch(() => {});
            }
            genreMap = cached;
        }
    } catch (_) {
        // Genres are best-effort; the playlist still serves without them.
    }

    const withGenres = tracks.map((t) => ({ ...t, genre: genreMap.get(t.artistIds[0]) ?? '' }));
    return json({ complete: true, playlistId, total, tracks: withGenres });
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

        // One cheap call: the snapshot id (which changes only when the playlist
        // does) and the track count. A cached build keyed to the same snapshot
        // needs no page fetches at all.
        const metaUrl = `https://api.spotify.com/v1/playlists/${playlistId}`
            + '?fields=snapshot_id,tracks.total';
        const metaRes = await spotifyGet(metaUrl, token);
        if (!metaRes.ok) throw new Error(`Spotify ${metaRes.status}: ${await metaRes.text()}`);
        const meta = await metaRes.json();
        const snapshotId = meta.snapshot_id;
        const total = meta.tracks?.total ?? 0;

        const col = await playlistCollection();
        const state = await col.findOne({ _id: playlistId }, { projection: { tracks: 0 } });

        // A build that no longer matches the live snapshot (or is missing) starts
        // over; the playlist changed under us, so its saved tracks are stale.
        const stale = !state || state.snapshotId !== snapshotId || state.total !== total;
        if (stale) {
            await col.updateOne(
                { _id: playlistId },
                { $set: { snapshotId, total, nextOffset: 0, complete: false, tracks: [], updatedAt: new Date().toISOString() } },
                { upsert: true },
            );
        }

        if (!stale && state.complete) {
            return await serve(col, token, playlistId, total);
        }

        // Fetch the next bounded run of pages and append them, saving how far the
        // build has now reached so the next call resumes from here.
        const baseOffset = stale ? 0 : (state.nextOffset ?? 0);
        const offsets = [];
        for (let o = baseOffset; o < total && offsets.length < PAGES_PER_CALL; o += PAGE) {
            offsets.push(o);
        }

        const pages = await mapPool(offsets, (offset) => page(token, playlistId, offset));
        const newTracks = pages
            .flatMap((p) => p.items ?? [])
            .map(trim)
            // A track pulled from Spotify's catalogue comes back null and cannot
            // be written anywhere, so it is dropped on the way in.
            .filter((t) => t.uri);

        const nextOffset = baseOffset + (offsets.length * PAGE);
        const complete = nextOffset >= total;

        // Guard on the offset this chunk was based on, so if a second build (a
        // second window) already advanced past it, this append no-ops rather than
        // duplicating pages.
        const result = await col.updateOne(
            { _id: playlistId, nextOffset: baseOffset },
            {
                $push: { tracks: { $each: newTracks } },
                $set: { nextOffset, complete, updatedAt: new Date().toISOString() },
            },
        );

        if (result.matchedCount === 0) {
            // Someone else moved it on; report whatever the current state is.
            const current = await col.findOne({ _id: playlistId }, { projection: { tracks: 0 } });
            if (current?.complete) return await serve(col, token, playlistId, total);
            return json({ complete: false, playlistId, total, loaded: Math.min(current?.nextOffset ?? 0, total) });
        }

        if (!complete) {
            return json({ complete: false, playlistId, total, loaded: Math.min(nextOffset, total) });
        }
        return await serve(col, token, playlistId, total);
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
