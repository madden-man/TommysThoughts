const { MongoClient } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const clientPromise = mongoClient.connect();

const handler = async (event) => {
    try {
        const database = (await clientPromise).db('tommy-data');
        const collection = database.collection('recipes');

        // Keyed on `dish` so re-sending a recipe corrects it in place. There is no
        // delete endpoint for this database, so duplicates would need cleaning up
        // by hand in Mongo.
        const recipe = JSON.parse(event.body);
        const results = await collection.updateOne(
            { dish: recipe.dish },
            { $set: recipe },
            { upsert: true },
        );
        return { statusCode: 200, body: JSON.stringify(results) };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
