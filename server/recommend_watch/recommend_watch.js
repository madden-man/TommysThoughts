// Reads a written-out situation ("just bought a house and it's crazy having all
// this space to myself") and picks one film and one show for tonight.
//
// The two darts boards are the whole candidate list, so the answer is always
// something already on the wall rather than a title that has to be hunted down.
// The board is sent as a cached system block and the situation as the user turn:
// the catalogue is the same bytes on every ask, so after the first one it is a
// cache read rather than a fresh charge.
//
// Needs ANTHROPIC_API_KEY alongside the usual MONGODB_* vars.

const { MongoClient } = require('mongodb');
const Anthropic = require('@anthropic-ai/sdk');

const mongoClient = new MongoClient(process.env.MONGODB_URI);
const clientPromise = mongoClient.connect();
const anthropic = new Anthropic();

const PICK = {
    type: 'object',
    properties: {
        title: {
            type: 'string',
            description: 'Copied exactly from the catalogue.',
        },
        why: {
            type: 'string',
            description:
                'One or two sentences tying this to what they wrote. Not a plot summary.',
        },
    },
    required: ['title', 'why'],
    additionalProperties: false,
};

const SCHEMA = {
    type: 'object',
    properties: {
        read: {
            type: 'string',
            description: 'One sentence on what kind of night this sounds like.',
        },
        movie: PICK,
        show: PICK,
    },
    required: ['read', 'movie', 'show'],
    additionalProperties: false,
};

const SYSTEM = [
    'You pick one film and one show to watch tonight, for one person, based on a',
    'few lines they wrote about what is going on in their life.',
    '',
    'Both picks must be titles that appear in the catalogue below — never invent',
    'one, never suggest something that is not there. Copy the title exactly as it',
    'is written.',
    '',
    'Catalogue fields: rating is out of 5 and is their own rating, so it only',
    'exists for things they have already seen; watched=false means they have',
    'never seen it and it is on the watchlist; liked marks a favourite; lists are',
    'the Letterboxd lists it belongs to; enneagram is the type they associate',
    'with it and heartlighted is how much it moved them. description is their own',
    'note about it.',
    '',
    'Read the situation for mood and energy rather than subject matter — someone',
    'rattling around a too-quiet new house wants company and warmth, not a',
    'documentary about real estate. A literal thematic match is usually the worse',
    'pick. Say so in "why" when a film is a revisit versus something new to them.',
    'A show is many nights and a film is one, so the show can ask for more',
    'commitment than the film.',
].join('\n');

// Only the fields worth reasoning over. The board runs to hundreds of rows,
// most of them the imported watchlist, so the long tail of a description is cut
// rather than paid for on every ask.
const trim = (row) => {
    const out = { name: row.name };
    if (row.description) out.description = row.description.slice(0, 160);
    if (typeof row.rating === 'number' && row.rating > 0) out.rating = row.rating;
    if (row.watched === false) out.watched = false;
    if (row.liked) out.liked = true;
    if (row.lists?.length) out.lists = row.lists.slice(0, 4);
    if (row.enneagram !== undefined) out.enneagram = row.enneagram;
    if (row.metrics?.heartlighted) out.heartlighted = row.metrics.heartlighted;
    return out;
};

// Sorted by name so the catalogue is the same bytes on every ask and the cache
// keeps hitting until the board itself changes.
const boardOf = (rows, board) => rows
    .filter((r) => r.board === board && r.name)
    .map(trim)
    .sort((a, b) => a.name.localeCompare(b.name));

const handler = async (event) => {
    try {
        const { situation } = JSON.parse(event.body || '{}');
        if (!situation || !situation.trim()) {
            return { statusCode: 400, body: 'Write a little about the night first.' };
        }

        const database = (await clientPromise).db(process.env.MONGODB_DB);
        const rows = await database.collection(process.env.MONGODB_COLLECTION)
            .find({ board: { $in: ['Movies', 'Shows'] } })
            .toArray();

        const movies = boardOf(rows, 'Movies');
        const shows = boardOf(rows, 'Shows');
        if (!movies.length || !shows.length) {
            return { statusCode: 503, body: 'The boards came back empty.' };
        }

        const response = await anthropic.messages.create({
            model: 'claude-opus-5',
            max_tokens: 4096,
            // Low effort keeps the whole round trip inside a Netlify function's
            // ten seconds; the catalogue does the work, not deep reasoning.
            output_config: {
                effort: 'low',
                format: { type: 'json_schema', schema: SCHEMA },
            },
            system: [
                { type: 'text', text: SYSTEM },
                {
                    type: 'text',
                    text: `<films>\n${JSON.stringify(movies)}\n</films>\n\n`
                        + `<shows>\n${JSON.stringify(shows)}\n</shows>`,
                    cache_control: { type: 'ephemeral' },
                },
            ],
            messages: [{
                role: 'user',
                content: `<situation>\n${situation.trim()}\n</situation>`,
            }],
        });

        const text = response.content.find((b) => b.type === 'text')?.text;
        if (!text) {
            return { statusCode: 502, body: 'No recommendation came back.' };
        }

        return {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: text,
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
