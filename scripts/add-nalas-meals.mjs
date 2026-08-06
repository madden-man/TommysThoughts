// Adds meals to the `nalas-menu` collection — the hand-written recipes the
// second dinner track rotates.
//
//   node scripts/add-nalas-meals.mjs                 # dry run, writes nothing
//   node scripts/add-nalas-meals.mjs --write         # actually upserts
//
//   MONGODB_URI='mongodb+srv://…' node scripts/add-nalas-meals.mjs --write
//
// Upserts on `_id`, so re-running corrects a meal rather than duplicating it —
// which matters because there is no delete endpoint for this collection.
// `order` only decides position within a store's stretch now, so a new meal can
// simply take the next number.
//
// A meal with no steps yet is still a real menu entry: it is a decision about
// what to eat, and the calendar says the recipe is still to come rather than
// pretending it has none.

import { MongoClient } from 'mongodb';

const MEALS = [
    {
        _id: 'meal-bacon-cheeseburgers',
        name: 'Bacon Cheeseburgers + Snacks',
        description: 'Bacon cheeseburgers with snacks on the side. Recipe still to come.',
        verified: true,
        type: 'dinner',
        store: 'Grocery store',
        ingredients: [],
        steps: [],
        order: 18,
    },
    {
        _id: 'meal-tortellini-red-sauce',
        name: 'Tortellini + Red Sauce',
        description: 'Cheese tortellini in jarred marinara, done in the time the water boils.',
        verified: true,
        type: 'dinner',
        store: 'Grocery store',
        ingredients: [
            '2 packs refrigerated cheese tortellini',
            '1 jar marinara sauce',
            'Parmesan',
        ],
        options: ['Italian sausage', 'Garlic bread', 'Spinach'],
        steps: [
            'Boil a large pot of salted water.',
            'Cook the tortellini for the 3–5 minutes on the pack — they float when they are done.',
            'Warm the jar of marinara in a pan while the tortellini cook.',
            'Drain the tortellini, fold them through the sauce, and top with parmesan.',
        ],
        order: 19,
    },
];

const write = process.argv.includes('--write');
const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('MONGODB_URI is not set — cannot connect.');
    console.error("Run:  MONGODB_URI='mongodb+srv://…' node scripts/add-nalas-meals.mjs");
    process.exit(1);
}

const client = new MongoClient(uri);
try {
    await client.connect();
    const collection = client.db('tommy-data').collection('nalas-menu');

    for (const meal of MEALS) {
        const existing = await collection.findOne({ _id: meal._id });
        console.log(`${existing ? 'update' : 'insert'}  ${meal.name}`
            + `  (${meal.type}, ${meal.store}, ${meal.steps.length} steps)`);
    }

    if (!write) {
        console.log(`\nDRY RUN — nothing written. ${MEALS.length} meals to upsert.`);
        console.log('Re-run with --write to add them.');
        process.exit(0);
    }

    let inserted = 0;
    let updated = 0;
    for (const meal of MEALS) {
        const { _id, ...rest } = meal;
        const res = await collection.updateOne(
            { _id },
            { $set: { ...rest, updatedAt: new Date().toISOString() } },
            { upsert: true },
        );
        if (res.upsertedCount) inserted += 1;
        else updated += res.modifiedCount;
    }
    console.log(`\n${inserted} added, ${updated} corrected. `
        + `${await collection.countDocuments()} recipes on the menu.`);
} catch (error) {
    console.error(error);
    process.exit(1);
} finally {
    await client.close();
}
