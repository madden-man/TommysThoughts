const { MongoClient } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const clientPromise = mongoClient.connect();

const handler = async (event) => {
    try {
        const database = (await clientPromise).db(process.env.MONGODB_DB);
        const collection = database.collection('bingo');
        // Function logic here ...
        console.log(event.body);
        const boardInfo = JSON.parse(event.body);
        const results = await collection.updateOne({ id: boardInfo.id }, boardInfo, { upsert: true });
        return {
          statusCode: 200,
          body: JSON.stringify(results),
      }
    } catch (error) {
        return { statusCode: 500, body: error.toString() }
    }
}

module.exports = { handler }