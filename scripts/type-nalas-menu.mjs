// Marks every recipe in the `nalas-menu` collection with a `type`, so the
// second dinner track can take the dinners and leave the rest.
//
//   node scripts/type-nalas-menu.mjs                 # dry run, writes nothing
//   node scripts/type-nalas-menu.mjs --write         # actually sets the field
//
// Needs a connection string, which is not in the repo (it only exists in the
// Netlify environment):
//
//   MONGODB_URI='mongodb+srv://…' node scripts/type-nalas-menu.mjs --write
//
// The calendar reads `type` and rotates only `dinner`; `fun` is offered by the
// baking activity, and `breakfast` is stored and waiting for somewhere to go.
// Everything not named below is a dinner, so a recipe added later is typed by
// adding it here and re-running, or by setting the field by hand in Mongo.

import { MongoClient } from 'mongodb';

// Keyed on `_id`, which these documents set by hand and which never changes,
// rather than on the display name, which does.
const TYPES = {
    'meal-eggs-for-group': 'breakfast',
    'meal-eggs-on-toast': 'breakfast',
    'meal-banana-bread': 'fun',
};

const DEFAULT_TYPE = 'dinner';

const write = process.argv.includes('--write');
const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('MONGODB_URI is not set — cannot connect.');
    console.error("Run:  MONGODB_URI='mongodb+srv://…' node scripts/type-nalas-menu.mjs");
    process.exit(1);
}

const client = new MongoClient(uri);
try {
    await client.connect();
    const collection = client.db('tommy-data').collection('nalas-menu');
    const meals = await collection.find({}).sort({ order: 1 }).toArray();

    const plan = meals.map((meal) => ({
        _id: meal._id,
        name: meal.name ?? meal.dish,
        was: meal.type,
        type: TYPES[meal._id] ?? DEFAULT_TYPE,
    }));

    const counts = plan.reduce((acc, p) => ({ ...acc, [p.type]: (acc[p.type] ?? 0) + 1 }), {});
    console.log(`${plan.length} recipes: `
        + Object.entries(counts).map(([t, n]) => `${n} ${t}`).join(', '));
    plan.forEach((p) => {
        const change = p.was === p.type ? '  (unchanged)' : p.was ? `  (was ${p.was})` : '';
        console.log(`   ${p.type.padEnd(9)} ${p.name}${change}`);
    });

    const changing = plan.filter((p) => p.was !== p.type);
    if (!write) {
        console.log(`\nDRY RUN — nothing written. ${changing.length} would change.`);
        console.log('Re-run with --write to set the field.');
        process.exit(0);
    }

    let updated = 0;
    for (const p of changing) {
        const res = await collection.updateOne({ _id: p._id }, { $set: { type: p.type } });
        updated += res.modifiedCount;
    }
    console.log(`\n${updated} recipes typed.`);
} catch (error) {
    console.error(error);
    process.exit(1);
} finally {
    await client.close();
}
