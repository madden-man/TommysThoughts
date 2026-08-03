// Seeds the 52-week dinner plan into the `dinners` collection of the
// `tommy-data` database — the same database the darts, activities and questions
// boards live in.
//
//   node scripts/seed-dinners.mjs                 # dry run, writes nothing
//   node scripts/seed-dinners.mjs --write         # actually upserts
//
// Needs a connection string, which is not in the repo (it only exists in the
// Netlify environment):
//
//   MONGODB_URI='mongodb+srv://…' node scripts/seed-dinners.mjs --write
//
// Every dinner is upserted on `week`, so running this twice corrects the rows
// rather than duplicating them. That matters because there is no delete
// endpoint for this collection — a bad insert would have to be cleaned up by
// hand in Mongo.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MongoClient } from 'mongodb';

const here = dirname(fileURLToPath(import.meta.url));
const dinners = JSON.parse(readFileSync(join(here, 'dinners.json'), 'utf8'));

const write = process.argv.includes('--write');
const uri = process.env.MONGODB_URI;

const unverified = dinners.flatMap((d) =>
    d.recipes.filter((r) => !r.verified).map((r) => `week ${d.week}: ${r.url}`));

const supporting = dinners.reduce((n, d) => n + d.supporting.length, 0);
const planned = dinners.reduce((n, d) =>
    n + d.servesNights + d.supporting.reduce((m, s) => m + s.servesNights, 0), 0);
const flex = dinners.reduce((n, d) => n + d.flexNights, 0);

console.log(`${dinners.length} weeks, ${dinners.length + supporting} meals `
    + `(${dinners.length} featured + ${supporting} supporting)`);
console.log(`${planned} planned nights + ${flex} flex = ${planned + flex} of ${dinners.length * 7}`);
console.log(`${dinners.reduce((n, d) => n + d.recipes.length, 0)} recipe links `
    + `(${unverified.length} did not resolve when checked)`);

if (!write) {
    console.log('\nDRY RUN — nothing written. Re-run with --write to upsert.');
    console.log('\nFirst record:');
    console.log(JSON.stringify(dinners[0], null, 2));
    if (unverified.length) {
        console.log(`\nUnverified recipe links (${unverified.length}):`);
        unverified.forEach((u) => console.log(`   ${u}`));
    }
    process.exit(0);
}

if (!uri) {
    console.error('\nMONGODB_URI is not set — cannot connect.');
    console.error("Run:  MONGODB_URI='mongodb+srv://…' node scripts/seed-dinners.mjs --write");
    process.exit(1);
}

const client = new MongoClient(uri);
try {
    await client.connect();
    const collection = client.db('tommy-data').collection('dinners');

    const before = await collection.countDocuments();
    let inserted = 0;
    let updated = 0;
    for (const dinner of dinners) {
        const res = await collection.updateOne(
            { week: dinner.week },
            { $set: dinner },
            { upsert: true },
        );
        if (res.upsertedCount) inserted += 1;
        else if (res.modifiedCount) updated += 1;
    }
    await collection.createIndex({ week: 1 }, { unique: true });

    const after = await collection.countDocuments();
    console.log(`\ndone — ${inserted} inserted, ${updated} updated, `
        + `${dinners.length - inserted - updated} already current`);
    console.log(`collection went from ${before} to ${after} documents`);
} finally {
    await client.close();
}
