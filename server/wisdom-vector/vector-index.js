const { MongoClient } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGODB_URI);

async function run() {
   try {
     const database = mongoClient.db(process.env.MONGODB_DB);
     const collection = database.collection('well-of-wisdom');
    
     // define your MongoDB Vector Search index
     const index = {
         name: "vector_index",
         type: "vectorSearch",
         definition: {
           "fields": [
             {
               "type": "vector",
               "numDimensions": 2048,
               "path": "plot_embedding_voyage_3_large",
               "similarity": "dotProduct",
               "quantization": "scalar"
             },
             {
               "type": "filter",
               "path": "genres"
             },
             {
               "type": "filter",
               "path": "year"
             }
           ]
         }
     }
     // run the helper method
     const result = await collection.createSearchIndex(index);
     console.log(`New search index named ${result} is building.`);
     // wait for the index to be ready to query
     console.log("Polling to check if the index is ready. This may take up to a minute.")
     let isQueryable = false;
     while (!isQueryable) {
       const cursor = collection.listSearchIndexes();
       for await (const index of cursor) {
         if (index.name === result) {
           if (index.queryable) {
             console.log(`${result} is ready for querying.`);
             isQueryable = true;
           } else {
             await new Promise(resolve => setTimeout(resolve, 5000));
           }
         }
       }
     }
   } finally {
     await mongoClient.close();
   }
}
run().catch(console.dir);


/*

Yes — you can use that MongoDB Atlas Vector Search tutorial to set up semantic search for your list of philosophy quotes in MongoDB and Node.js, with a few additions. The tutorial you linked (the Atlas Vector Search tutorial) teaches how to create a vector index and perform semantic search queries using the $vectorSearch aggregation stage, and it includes Node.js examples. 
MongoDB

Here’s how that applies to your use case:

✅ What the Tutorial Covers

The tutorial shows you how to:

Create a vector search index on a field that contains vector embeddings.

Run semantic (nearest-neighbor) search queries using the $vectorSearch stage in an aggregation pipeline.

Use several drivers — including Node.js — to do this. 
MongoDB

So the mechanics of indexing and querying with vector search in MongoDB Atlas via Node.js are definitely covered.

🚧 What Isn’t Covered (But You’ll Need It)

The tutorial doesn’t automatically vectorize your philosophy quotes — that is, it doesn’t show how to generate the embedding vectors for each quote (e.g., using an LLM or embedding model).

Before following the tutorial you’ll want to:

Choose an embedding model or service (e.g., OpenAI, Hugging Face, etc.).

Convert each quote to a numeric vector using that model.

Store those vectors with your quote documents in MongoDB.

That gives you the actual data the vector index will index and search.

After you generate embeddings and store them, you can follow the tutorial to create the vector index on that vector field and run similarity searches from Node.js.

🧠 Basic Workflow for Your Quote Search

Here’s what the full pipeline would look like:

Generate Embeddings

Use an API or local model to convert each quote to a fixed-length vector.

Save each quote with its vector into MongoDB (e.g., a field like embedding: [0.12, …]).

Set Up Atlas Vector Search

In MongoDB Atlas, create a Vector Search index on your embedding field.

Tutorial covers exactly how to do this. 
MongoDB

Query from Node.js

Use the Node.js MongoDB driver to run a $vectorSearch aggregation that finds the quotes most semantically similar to a query embedding.

You first embed the query text (using the same embedding method), then feed that embedding into the $vectorSearch query.

Atlas returns the most similar quote docs.

🧪 Example High-Level Pseudocode (Node.js)

This is not in the official tutorial but shows how it fits together:

import { MongoClient } from "mongodb";
import { getEmbedding } from "./your-embedding-service.js";

const client = new MongoClient(process.env.MONGO_URI);
await client.connect();

const db = client.db("quotesDB");
const coll = db.collection("quotes");

// 1) Create or fetch the query embedding
const queryText = "What is the meaning of life?";
const queryVector = await getEmbedding(queryText);

// 2) Run semantic search using $vectorSearch
const results = await coll.aggregate([
  {
    $vectorSearch: {
      vector: queryVector,
      path: "embedding",
      k: 10
    }
  }
]).toArray();

console.log(results);

📌 Summary

✔️ The tutorial is appropriate for the vector index and search parts. 
MongoDB

✔️ It's applicable in a Node.js environment (they include Node.js examples). 
MongoDB

⚠️ You’ll need to separately generate and store embeddings for your quotes before using the vector index.

If you want, I can also provide a step-by-step example with a specific embedding provider (e.g., OpenAI) and the exact Node.js code to load quotes, embed them, index in Atlas, and perform a semantic search!

*/