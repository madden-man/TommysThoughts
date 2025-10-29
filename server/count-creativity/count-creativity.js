const { MongoClient } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const clientPromise = mongoClient.connect();

// Docs on event and context https://docs.netlify.com/functions/build/#code-your-function-2
const handler = async (event) => {
    try {
        const database = (await clientPromise).db(process.env.MONGODB_DB);
        const collection = database.collection('creativity-counter');
        // Function logic here ...
        console.log(event.body);
        let results;
        if (event.body['_id']) {
          results = await collection.updateOne(event.body['_id'], JSON.parse(event.body), { upsert: true });
        } else if (event.body) {
          results = await collection.insertOne(JSON.parse(event.body));
        }

        return {
          statusCode: 200,
          body: JSON.stringify(results),
      }
    } catch (error) {
        return { statusCode: 500, body: error.toString() }
    }
}

module.exports = { handler }
