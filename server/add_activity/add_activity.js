const { MongoClient } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const clientPromise = mongoClient.connect();

const handler = async (event) => {
    try {
        const database = (await clientPromise).db('tommy-data');
        const collection = database.collection('activities');

        const { symbol = '', header } = JSON.parse(event.body || '{}');
        if (!header) {
            return { statusCode: 400, body: 'header is required' };
        }

        const result = await collection.insertOne({ symbol, header });
        // Return the full document so the client can render it immediately.
        return {
            statusCode: 200,
            body: JSON.stringify({ _id: result.insertedId, symbol, header }),
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
