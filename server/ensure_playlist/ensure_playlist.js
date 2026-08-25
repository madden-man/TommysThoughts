// Finds — or creates — the destination playlist an added tab shuffles into.
//
// Each source playlist writes to a companion named "<source> shuffled". The
// first time a tab is written, that playlist may not exist yet, so this
// get-or-creates it by name under the account and hands back its id. Reusing an
// existing one by exact name means writing from a second browser doesn't spawn a
// duplicate.
//
// Creating a playlist is a write, but only ever a private one in the account's
// own library — the same account whose refresh token every other function here
// already uses.
//
// Needs SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN.

const { accessToken } = require('../_shared/spotify');

const PAGE = 50;

const me = async (token) => {
    const response = await fetch('https://api.spotify.com/v1/me', {
        headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Spotify ${response.status}: ${await response.text()}`);
    return response.json();
};

// The account's own playlists, so an existing "<source> shuffled" can be reused
// rather than duplicated. Only ones the account owns count — a followed playlist
// that happens to share the name is somebody else's and must not be written to.
const findOwned = async (token, userId, name) => {
    for (let offset = 0; ; offset += PAGE) {
        const url = `https://api.spotify.com/v1/me/playlists?offset=${offset}&limit=${PAGE}`;
        const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error(`Spotify ${response.status}: ${await response.text()}`);
        const data = await response.json();
        const hit = (data.items ?? []).find(
            (p) => p && p.owner?.id === userId && p.name === name,
        );
        if (hit) return hit;
        if (!data.next) return null;
    }
};

const create = async (token, userId, name) => {
    const response = await fetch(
        `https://api.spotify.com/v1/users/${encodeURIComponent(userId)}/playlists`,
        {
            method: 'POST',
            headers: {
                authorization: `Bearer ${token}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                name,
                public: false,
                description: 'Shuffled by TommysThoughts.',
            }),
        },
    );
    if (!response.ok) throw new Error(`Spotify ${response.status}: ${await response.text()}`);
    return response.json();
};

const handler = async (event) => {
    try {
        const name = (JSON.parse(event?.body || '{}').name || '').trim();
        if (!name) return { statusCode: 400, body: 'A playlist name is required.' };

        const token = await accessToken();
        const { id: userId } = await me(token);

        const existing = await findOwned(token, userId, name);
        const playlist = existing ?? await create(token, userId, name);

        return {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: playlist.id, name: playlist.name, created: !existing }),
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
