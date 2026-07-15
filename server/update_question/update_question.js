const { MongoClient, ObjectId } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const clientPromise = mongoClient.connect();

const handler = async (event) => {
    try {
        const database = (await clientPromise).db('tommy-data');
        const collection = database.collection('tommy-questions');

        const item = JSON.parse(event.body || '{}');
        const theId = item._id;
        delete item._id;

        if (!theId) {
            return { statusCode: 400, body: '_id is required' };
        }

        const query = ObjectId.isValid(theId) ? { _id: new ObjectId(theId) } : { _id: theId };
        const result = await collection.updateOne(query, { $set: item });

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
