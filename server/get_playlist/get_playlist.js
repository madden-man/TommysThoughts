// Reads "pre-approved" off Spotify. Read-only, always: the shuffled order is
// written to a second playlist, so the original is never touched by any of this.
//
// Spotify has no API keys — it is OAuth all the way down. The one-time
// authorization produced a refresh token, which does not expire; this trades it
// for a fresh access token on every request. That is why nothing here ever asks
// anyone to log in.
//
// Needs SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN.

// The playlist ids are in their share URLs and are not secrets, so they sit here
// with env overrides rather than becoming more things to configure.
const SOURCE_PLAYLIST_ID =
    process.env.SPOTIFY_SOURCE_PLAYLIST_ID || '6WukX3ygx4jlDsOih5fQtI';

// Spotify's maximum per request on /items is 50 — it was 100 on the /tracks
// endpoint this replaced, so 2019 tracks is 41 pages rather than 21.
const PAGE = 50;

const accessToken = async () => {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            authorization: 'Basic ' + Buffer.from(
                `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
            ).toString('base64'),
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
        }).toString(),
    });
    if (!response.ok) {
        throw new Error(`Spotify refused the refresh token: ${await response.text()}`);
    }
    return (await response.json()).access_token;
};

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

// Genres live on the artist, not the track or the playlist item. Spotify returns
// them sorted by relevance, so the first one is the most representative tag.
// Failures are swallowed: genres improve the shuffle but the playlist fetch must
// succeed either way.
const fetchArtistGenres = async (token, artistIds) => {
    const batches = [];
    for (let i = 0; i < artistIds.length; i += 50)
        batches.push(artistIds.slice(i, i + 50));

    const results = await Promise.all(batches.map(async (batch) => {
        const url = `https://api.spotify.com/v1/artists?ids=${batch.join(',')}`;
        const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
        if (!response.ok) return [];
        return (await response.json()).artists ?? [];
    }));

    const map = new Map();
    results.flat().forEach((artist) => {
        if (artist?.id) map.set(artist.id, artist.genres?.[0] ?? '');
    });
    return map;
};

const page = async (token, offset) => {
    // /items, not /tracks: the older endpoint was removed in the March 2026
    // migration and now answers 403 for every playlist, including public ones.
    const url = `https://api.spotify.com/v1/playlists/${SOURCE_PLAYLIST_ID}/items`
        + `?offset=${offset}&limit=${PAGE}`
        + '&fields=total,items(added_at,item(uri,name,disc_number,track_number,'
        + 'artists(id,name),album(id,name)))';
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Spotify ${response.status}: ${await response.text()}`);
    return response.json();
};

const handler = async () => {
    try {
        const token = await accessToken();

        // The first page reports the total, and the rest go out together —
        // twenty sequential round trips would not fit in a function's ten
        // seconds, twenty parallel ones comfortably do.
        const first = await page(token, 0);
        const rest = await Promise.all(
            Array.from(
                { length: Math.ceil((first.total - PAGE) / PAGE) },
                (_, i) => page(token, (i + 1) * PAGE),
            ),
        );

        const tracks = [first, ...rest]
            .flatMap((p) => p.items ?? [])
            .map(trim)
            // A track pulled from Spotify's catalogue comes back null and cannot
            // be written anywhere, so it is dropped on the way in rather than
            // failing the write later. `total` still reports it, so the page can
            // say how many were skipped.
            .filter((t) => t.uri);

        // Unique primary artist IDs across the whole playlist. The /artists
        // endpoint returns up to 50 per request; they all go out in parallel
        // alongside the playlist pages and cost no extra round trips.
        let genreMap = new Map();
        try {
            const artistIds = [...new Set(tracks.flatMap((t) => t.artistIds).filter(Boolean))];
            if (artistIds.length) genreMap = await fetchArtistGenres(token, artistIds);
        } catch (_) {
            // Genre enrichment is best-effort: a failed fetch just means the
            // shuffle will not have genre information for this run.
        }

        const tracksWithGenres = tracks.map((t) => ({
            ...t,
            genre: genreMap.get(t.artistIds[0]) ?? '',
        }));

        return {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ playlistId: SOURCE_PLAYLIST_ID, total: first.total, tracks: tracksWithGenres }),
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
