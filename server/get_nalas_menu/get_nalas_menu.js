const { MongoClient } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const clientPromise = mongoClient.connect();

// The `nalas-menu` collection: meals written out by hand — ingredients and
// steps, not a link to someone else's recipe. Sorted by `order` so the calendar
// walks them in the order they were arranged rather than by insertion.
const handler = async () => {
    try {
        const database = (await clientPromise).db('tommy-data');
        const collection = database.collection('nalas-menu');

        const results = await collection.find({}).sort({ order: 1 }).toArray();
        return {
            statusCode: 200,
            body: JSON.stringify(results),
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
