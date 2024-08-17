const { MongoClient } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const clientPromise = mongoClient.connect();

const handler = async (event) => {
    try {
        const database = (await clientPromise).db(process.env.MONGODB_DB);
        const collection = database.collection(process.env.MONGODB_COLLECTION);
        // Function logic here ...
        const item = JSON.parse(event.body);
        if (item._id) { delete item._id; }

        const results = await collection.replaceOne({ name: item.name }, item);
        return {
          statusCode: 200,
          body: JSON.stringify(results),
      }
    } catch (error) {
        return { statusCode: 500, body: error.toString() }
    }
}

module.exports = { handler }