const { MongoClient } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const clientPromise = mongoClient.connect();

const handler = async () => {
    try {
        const database = (await clientPromise).db(process.env.MONGODB_DB);
        const collection = database.collection('bingo');
        // Function logic here ...

        const results = await collection.find({}).toArray();
        return {
          statusCode: 200,
          body: JSON.stringify(results),
      }
    } catch (error) {
        return { statusCode: 500, body: error.toString() }
    }
}

module.exports = { handler }