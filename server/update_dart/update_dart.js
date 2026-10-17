const { MongoClient, ObjectId } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const clientPromise = mongoClient.connect();

const handler = async (event) => {
    try {
        const database = (await clientPromise).db(process.env.MONGODB_DB);
        const collection = database.collection(process.env.MONGODB_COLLECTION);
        // Function logic here ...
        const item = JSON.parse(event.body);
        // The page sends _id back as a string; matching on the string never finds
        // the ObjectId record, so the upsert used to save the edit as a second copy.
        let theId = ObjectId.isValid(item?._id) ? new ObjectId(item._id) : item?._id;
        if (item._id) { delete item._id; }

        const results = await collection.replaceOne({ _id: theId }, item, { upsert: true });
        return {
          statusCode: 200,
          body: JSON.stringify(results),
      }
    } catch (error) {
        return { statusCode: 500, body: error.toString() }
    }
}

module.exports = { handler }