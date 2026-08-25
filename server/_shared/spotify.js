// Shared Spotify auth for the Netlify functions.
//
// Every function used to trade the refresh token for a fresh access token on
// every invocation — and a single write fires ~41 of those, one per chunk. An
// access token is good for about an hour, so this caches it in two layers and
// only refreshes when it has actually expired:
//
//   1. module memory — a warm function container reuses the same token with no
//      round trip at all, which covers the burst of writes in one run;
//   2. Mongo — a cold container, or a different function, reads the token the
//      last refresh stored rather than minting another.
//
// The net effect is roughly one token mint per hour instead of one per call.
//
// Needs SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN and
// MONGODB_URI.

const { MongoClient } = require('mongodb');

let clientPromise;
const collection = () => {
    if (!clientPromise) clientPromise = new MongoClient(process.env.MONGODB_URI).connect();
    return clientPromise.then((c) => c.db('tommy-data').collection('spotify_auth'));
};

const TOKEN_ID = 'access_token';
// Treat a token as expired a minute early, so one never lapses mid-request.
const SKEW_MS = 60_000;
const usable = (entry) => entry && entry.token && entry.expiresAt > Date.now();

let memo = null;

const mint = async () => {
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
    const { access_token: token, expires_in: expiresIn } = await response.json();
    return { token, expiresAt: Date.now() + (expiresIn * 1000) - SKEW_MS };
};

/** A valid Spotify access token, refreshed only when the cached one has run out. */
const accessToken = async () => {
    if (usable(memo)) return memo.token;

    // Mongo is best-effort: if it can't be read or written, the token still
    // mints — the cache is an optimisation, not a dependency.
    let col = null;
    try {
        col = await collection();
        const cached = await col.findOne({ _id: TOKEN_ID });
        if (usable(cached)) {
            memo = { token: cached.token, expiresAt: cached.expiresAt };
            return memo.token;
        }
    } catch (_) {
        // fall through to a fresh mint
    }

    const fresh = await mint();
    memo = fresh;
    if (col) {
        try {
            await col.updateOne(
                { _id: TOKEN_ID },
                { $set: { token: fresh.token, expiresAt: fresh.expiresAt } },
                { upsert: true },
            );
        } catch (_) {
            // A token that mints but doesn't cache is fine; next call re-mints.
        }
    }
    return fresh.token;
};

module.exports = { accessToken };
