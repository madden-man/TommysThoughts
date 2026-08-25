// Writes the shuffled order into "pre approved shuffled", fifty tracks at
// a time.
//
// The source playlist is never written to. "pre-approved" is the canon — its
// order, its `added_at` timestamps and its dividers all stay exactly as they
// are — and this second playlist is the disposable output. That makes a failed
// run cheap: nothing was lost, so you just run it again.
//
// Two thousand tracks cannot go in a single call — Spotify caps a write per
// request — and forty sequential writes do not fit inside a Netlify function's
// ten seconds. So the page drives the loop and this handles one chunk per request:
// fast, impossible to time out, and resumable from whichever chunk failed.
//
// The first chunk REPLACES the destination and the rest APPEND, which is what
// makes the sequence order-preserving.

const { MongoClient } = require('mongodb');
const { accessToken } = require('../_shared/spotify');

const mongoClient = new MongoClient(process.env.MONGODB_URI);
const clientPromise = mongoClient.connect();

const TARGET_PLAYLIST_ID =
    process.env.SPOTIFY_TARGET_PLAYLIST_ID || '19jAYFUsXOKcUxxCk8slEX';

// The page can name which playlist to write to — an added tab writes to its own
// "… shuffled" destination — so the incoming id is checked against a Spotify
// id's shape (22-char base62) rather than trusted, and anything else falls back
// to the default pre-approved destination.
const isPlaylistId = (value) => typeof value === 'string' && /^[A-Za-z0-9]{22}$/.test(value);
// Writes go to /items too, and are capped at 50 to match the read side. The
// documented write maximum is 100, but a chunk size that turns out to be too
// large fails partway through and leaves the destination half-built, so this
// takes the number both endpoints certainly accept.
const MAX_URIS = 50;

const handler = async (event) => {
    try {
        const { uris, mode, order, playlistId } = JSON.parse(event.body || '{}');

        if (!Array.isArray(uris) || !uris.length) {
            return { statusCode: 400, body: 'No tracks to write.' };
        }
        if (uris.length > MAX_URIS) {
            return { statusCode: 400, body: `At most ${MAX_URIS} tracks per call.` };
        }
        if (mode !== 'replace' && mode !== 'append') {
            return { statusCode: 400, body: "mode must be 'replace' or 'append'." };
        }

        const target = isPlaylistId(playlistId) ? playlistId : TARGET_PLAYLIST_ID;

        const token = await accessToken();
        const response = await fetch(
            `https://api.spotify.com/v1/playlists/${target}/items`,
            {
                // PUT replaces the destination with these URIs; POST adds them to
                // the end. First chunk clears it out, the rest build it back up.
                method: mode === 'replace' ? 'PUT' : 'POST',
                headers: {
                    authorization: `Bearer ${token}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({ uris }),
            },
        );
        if (!response.ok) {
            return {
                statusCode: 502,
                body: `Spotify ${response.status}: ${await response.text()}`,
            };
        }

        // A log of what was produced, kept once per run alongside the call that
        // starts it. This used to be a safety net for overwriting the original;
        // now that the original is never written to, it is just a record of the
        // orders this has generated. Failing to write it must not fail the run.
        if (mode === 'replace' && Array.isArray(order) && order.length) {
            try {
                await (await clientPromise).db('tommy-data')
                    .collection('spotify_orders')
                    .insertOne({
                        playlistId: target,
                        savedAt: new Date().toISOString(),
                        order,
                    });
            } catch (logError) {
                // Deliberately swallowed: the playlist is what matters.
            }
        }

        return {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ written: uris.length, ...(await response.json()) }),
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
