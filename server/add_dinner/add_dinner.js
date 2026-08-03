const { MongoClient } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const clientPromise = mongoClient.connect();

const handler = async (event) => {
    try {
        const database = (await clientPromise).db('tommy-data');
        const collection = database.collection('dinners');

        // Keyed on `week` so re-sending a dinner corrects it in place rather
        // than adding a duplicate — there is no delete endpoint for this
        // collection, so accidental duplicates would have to be cleaned up
        // directly in Mongo.
        const dinner = JSON.parse(event.body);
        const results = await collection.updateOne(
            { week: dinner.week },
            { $set: dinner },
            { upsert: true },
        );
        return {
            statusCode: 200,
            body: JSON.stringify(results),
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
