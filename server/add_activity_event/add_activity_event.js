const { MongoClient } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const clientPromise = mongoClient.connect();

// One document per scheduling rule. `recurrence` is 'once' or one of the repeat
// codes the calendar knows how to expand; `until` bounds a repeat and is
// optional, in which case it repeats as far as the calendar is browsed.
const KINDS = ['ap', 'aw', 'ah'];
// `monthly` repeats on the same weekday of the month (the second Tuesday);
// `monthlyDate` repeats on the same date. The calendar expands both.
const RECURRENCES = ['once', 'daily', 'weekly', 'biweekly', 'monthly', 'monthlyDate', 'yearly'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const handler = async (event) => {
    try {
        const database = (await clientPromise).db('tommy-data');
        const collection = database.collection('activity_events');

        const {
            kind, title, date, recurrence = 'once', until = '', time = '', notes = '',
        } = JSON.parse(event.body || '{}');

        if (!KINDS.includes(kind)) {
            return { statusCode: 400, body: `kind must be one of ${KINDS.join(', ')}` };
        }
        if (!title || !title.trim()) {
            return { statusCode: 400, body: 'title is required' };
        }
        if (!ISO_DATE.test(date || '')) {
            return { statusCode: 400, body: 'date is required as YYYY-MM-DD' };
        }
        if (!RECURRENCES.includes(recurrence)) {
            return { statusCode: 400, body: `recurrence must be one of ${RECURRENCES.join(', ')}` };
        }
        if (until && !ISO_DATE.test(until)) {
            return { statusCode: 400, body: 'until must be YYYY-MM-DD' };
        }

        const document = {
            kind,
            title: title.trim(),
            date,
            recurrence,
            until: recurrence === 'once' ? '' : until,
            time,
            notes: notes.trim(),
        };
        const result = await collection.insertOne(document);
        // Return the full document so the calendar can draw it immediately.
        return {
            statusCode: 200,
            body: JSON.stringify({ _id: result.insertedId, ...document }),
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
