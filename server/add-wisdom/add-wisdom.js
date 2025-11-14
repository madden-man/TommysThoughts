const { MongoClient, ObjectId } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const clientPromise = mongoClient.connect();

const handler = async (event) => {
    try {
        const database = (await clientPromise).db(process.env.MONGODB_DB);
        const collection = database.collection('well-of-wisdom');
        // Function logic here ...
        let results;
        if (event.body.includes('_id')) {
          const intendedBody = JSON.parse(event.body);
          let thisId = new ObjectId(intendedBody._id);
          delete intendedBody._id;
          delete intendedBody.index;
          console.log(intendedBody, thisId);
          results = await collection.updateOne({ _id: thisId },
            { $set: intendedBody }, { upsert: true });
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