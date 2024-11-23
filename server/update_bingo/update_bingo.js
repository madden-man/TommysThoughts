const { MongoClient } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const clientPromise = mongoClient.connect();

const handler = async (event) => {
    try {
        const database = (await clientPromise).db(process.env.MONGODB_DB);
        const collection = database.collection('bingo');
        // Function logic here ...
        const { rows } = JSON.parse(event.body);
        console.log({ rows });

        // const results = {};
        const results = await collection.updateOne({ id: boardInfo._id }, { rows });
        // const results = await collection.findOneAndUpdate({ id: boardInfo['_id'] }, { rows });
        // const results = await collection.replaceOne({ id: boardInfo._id }, bingoBoard);

        // const results = await collection.find({});
        return {
          statusCode: 200,
          body: JSON.stringify(results),
      }
    } catch (error) {
        return { statusCode: 500, body: error.toString() }
    }
}

module.exports = { handler }