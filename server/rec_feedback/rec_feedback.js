// Feedback on the "next records" recommendations: which albums were saved,
// already heard, or not wanted. The page records a verdict per album and the
// ranker reads these back to exclude or penalise on its next build.
//
// POST JSON:
//   { albumId, artist, album, verdict: 'saved' | 'heard' | 'not-for-me' } upserts one row
//   { albumId, verdict: 'undo' } deletes it
//   { list: true } answers every row
//
// Rows live in tommy-data.spotify_rec_feedback as
// { _id: albumId, artist, album, verdict, at }. Errors answer plain text.
//
// Needs MONGODB_URI.

const { MongoClient } = require('mongodb');

const mongoClient = new MongoClient(process.env.MONGODB_URI);
const clientPromise = mongoClient.connect();

const VERDICTS = new Set(['saved', 'heard', 'not-for-me']);

// A Spotify id is base62 and 22 characters; anything else is refused rather
// than becoming a stray document.
const isAlbumId = (value) => typeof value === 'string' && /^[A-Za-z0-9]{22}$/.test(value);

const collection = async () => (await clientPromise)
    .db('tommy-data')
    .collection('spotify_rec_feedback');

const json = (body) => ({
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
});

const text = (value) => (typeof value === 'string' ? value.slice(0, 300) : '');

const handler = async (event) => {
    let body;
    try {
        body = JSON.parse(event?.body || '{}');
    } catch (_) {
        return { statusCode: 400, body: 'The request body is not valid JSON.' };
    }

    try {
        if (body.list) {
            const col = await collection();
            const rows = await col.find({}).sort({ at: -1 }).toArray();
            return json({
                feedback: rows.map((row) => ({
                    albumId: row._id,
                    artist: row.artist,
                    album: row.album,
                    verdict: row.verdict,
                    at: row.at,
                })),
            });
        }

        if (!isAlbumId(body.albumId)) {
            return { statusCode: 400, body: 'A Spotify album id is required.' };
        }

        if (body.verdict === 'undo') {
            const col = await collection();
            await col.deleteOne({ _id: body.albumId });
            return json({ ok: true });
        }

        if (!VERDICTS.has(body.verdict)) {
            return {
                statusCode: 400,
                body: 'verdict must be one of saved, heard, not-for-me or undo.',
            };
        }

        const col = await collection();
        await col.updateOne(
            { _id: body.albumId },
            {
                $set: {
                    artist: text(body.artist),
                    album: text(body.album),
                    verdict: body.verdict,
                    at: new Date().toISOString(),
                },
            },
            { upsert: true },
        );
        return json({ ok: true });
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
