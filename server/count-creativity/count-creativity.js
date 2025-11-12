const { MongoClient, ObjectId } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const clientPromise = mongoClient.connect();

// Docs on event and context https://docs.netlify.com/functions/build/#code-your-function-2
const handler = async (event) => {
    try {
        const database = (await clientPromise).db(process.env.MONGODB_DB);
        const collection = database.collection('creativity-counter');
        // Function logic here ...
        let results;
        if (event.body.includes('_id')) {
          let thisId = new ObjectId(event.body._id);
          const intendedBody = JSON.parse(event.body);
          delete intendedBody._id;
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
