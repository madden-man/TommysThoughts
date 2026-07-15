const { MongoClient } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const clientPromise = mongoClient.connect();

const handler = async (event) => {
    try {
        const database = (await clientPromise).db('tommy-data');
        const collection = database.collection('tommy-questions');

        const { question, depth = 5 } = JSON.parse(event.body || '{}');
        if (!question) {
            return { statusCode: 400, body: 'question is required' };
        }
        const depthNumber = Number(depth);
        if (!Number.isInteger(depthNumber) || depthNumber < 1 || depthNumber > 10) {
            return { statusCode: 400, body: 'depth must be an integer from 1 to 10' };
        }

        const doc = { question, depth: depthNumber };
        const result = await collection.insertOne(doc);
        // Return the full document so the client can render it immediately.
        return {
            statusCode: 200,
            body: JSON.stringify({ _id: result.insertedId, ...doc }),
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
