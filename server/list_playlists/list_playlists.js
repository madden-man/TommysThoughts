// Lists the account's playlists — id and name only — so the /spotify page can
// offer them in an autocomplete when adding a tab.
//
// Same auth as get_playlist: the stored refresh token is traded for a short
// access token on every request, so nothing here asks anyone to log in. Read
// only; this never modifies a playlist.
//
// Needs SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN.

const { accessToken } = require('../_shared/spotify');

// Spotify caps /me/playlists at 50 per page.
const PAGE = 50;

// Raised on a 429 so the page can back off for Retry-After rather than retrying
// into a throttled app.
class RateLimited extends Error {
    constructor(retryAfter) {
        super('rate_limited');
        this.rateLimited = true;
        this.retryAfter = retryAfter;
    }
}

const page = async (token, offset) => {
    const url = `https://api.spotify.com/v1/me/playlists?offset=${offset}&limit=${PAGE}`;
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (response.status === 429) {
        throw new RateLimited(Number(response.headers.get('retry-after')) || 1);
    }
    if (!response.ok) throw new Error(`Spotify ${response.status}: ${await response.text()}`);
    return response.json();
};

const handler = async () => {
    try {
        const token = await accessToken();

        // The first page reports the total; the rest go out together so a large
        // library still fits inside the function's ten seconds.
        const first = await page(token, 0);
        const rest = await Promise.all(
            Array.from(
                { length: Math.ceil((first.total - PAGE) / PAGE) },
                (_, i) => page(token, (i + 1) * PAGE),
            ),
        );

        const playlists = [first, ...rest]
            .flatMap((p) => p.items ?? [])
            .filter((p) => p && p.id)
            .map((p) => ({
                id: p.id,
                name: p.name,
                // The March 2026 migration renamed a playlist's track collection
                // from `tracks` to `items` here as well, so this read null for
                // every playlist and nothing could be sized before loading it.
                trackCount: p.items?.total ?? p.tracks?.total ?? null,
                owner: p.owner?.display_name ?? null,
            }));

        return {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ playlists }),
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
