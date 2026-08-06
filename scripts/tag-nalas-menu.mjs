// Tags every recipe in the `nalas-menu` collection with a `type` and a `store`,
// the two things the calendar sorts the menu by.
//
//   node scripts/tag-nalas-menu.mjs                 # dry run, writes nothing
//   node scripts/tag-nalas-menu.mjs --write         # actually sets the fields
//
// Needs a connection string, which is not in the repo (it only exists in the
// Netlify environment):
//
//   MONGODB_URI='mongodb+srv://…' node scripts/tag-nalas-menu.mjs --write
//
// `type` decides what rotates: only `dinner` is an answer to "what's for
// dinner". `fun` is offered by the baking activity instead, and `breakfast` is
// stored and waiting for somewhere to go.
//
// `store` decides the order they rotate in — the meals from one store run on
// consecutive nights, so a cycle reads as a sequence of shopping trips. It is
// read off the ingredients: a meal is Trader Joe's or Costco when it names
// something only that store sells, and a regular grocery run otherwise. That is
// a judgement call, so this table is the place to correct it.
//
// Anything not named below is a dinner from the grocery store, so adding a
// recipe usually means adding nothing here at all.

import { MongoClient } from 'mongodb';

// Keyed on `_id`, which these documents set by hand and which never changes,
// rather than on the display name, which does.
const TYPES = {
    'meal-eggs-for-group': 'breakfast',
    'meal-eggs-on-toast': 'breakfast',
    'meal-banana-bread': 'fun',
};

const STORES = {
    // Named outright in the ingredients.
    'meal-tj-orange-chicken': "Trader Joe's",            // frozen mandarin orange chicken
    'meal-tj-butter-chicken-dumplings': "Trader Joe's",  // frozen butter chicken + dumplings
    'meal-mediterranean-burrito-bowls': "Trader Joe's",  // TJ's marinated chicken shawarma
    'meal-costco-steak': 'Costco',                       // the thin-sliced Costco steak
    'meal-kevins-chicken-potatoes': 'Costco',            // Kevin's pre-cooked chicken
    'meal-rotisserie-chicken-sandwich': 'Costco',        // the rotisserie bird
};

const DEFAULT_TYPE = 'dinner';
const DEFAULT_STORE = 'Grocery store';

const write = process.argv.includes('--write');
const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('MONGODB_URI is not set — cannot connect.');
    console.error("Run:  MONGODB_URI='mongodb+srv://…' node scripts/tag-nalas-menu.mjs");
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
        was: { type: meal.type, store: meal.store },
        type: TYPES[meal._id] ?? DEFAULT_TYPE,
        store: STORES[meal._id] ?? DEFAULT_STORE,
    }));

    const tally = (key) => Object.entries(plan.reduce(
        (acc, p) => ({ ...acc, [p[key]]: (acc[p[key]] ?? 0) + 1 }), {}))
        .map(([v, n]) => `${n} ${v}`).join(', ');

    console.log(`${plan.length} recipes by type:  ${tally('type')}`);
    console.log(`${plan.length} recipes by store: ${tally('store')}\n`);

    // Printed grouped by store, which is the order the rotation will walk them.
    [...new Set(plan.map((p) => p.store))].forEach((store) => {
        console.log(`${store}:`);
        plan.filter((p) => p.store === store).forEach((p) => {
            const changed = p.was.type !== p.type || p.was.store !== p.store;
            console.log(`   ${p.type.padEnd(9)} ${p.name}${changed ? '' : '  (unchanged)'}`);
        });
    });

    const changing = plan.filter((p) => p.was.type !== p.type || p.was.store !== p.store);
    if (!write) {
        console.log(`\nDRY RUN — nothing written. ${changing.length} would change.`);
        console.log('Re-run with --write to set the fields.');
        process.exit(0);
    }

    let updated = 0;
    for (const p of changing) {
        const res = await collection.updateOne(
            { _id: p._id },
            { $set: { type: p.type, store: p.store } },
        );
        updated += res.modifiedCount;
    }
    console.log(`\n${updated} recipes tagged.`);
} catch (error) {
    console.error(error);
    process.exit(1);
} finally {
    await client.close();
}
