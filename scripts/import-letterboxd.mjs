// Imports a Letterboxd data export into the Movies board of the darts
// collection, which stays the source of truth.
//
//   node scripts/import-letterboxd.mjs <unzipped-export-dir>            # dry run
//   MONGODB_URI='…' node scripts/import-letterboxd.mjs <dir> --write
//
// Rules:
//   * Films already on the board are LEFT ALONE. Those were curated by hand and
//     carry enneagram / heartlighted values Letterboxd knows nothing about.
//   * New films are inserted with `source: 'letterboxd'` so imported rows stay
//     distinguishable from curated ones.
//   * Everything upserts on { board, name }, so re-running corrects rather than
//     duplicating — there is no delete endpoint for this collection.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { MongoClient } from 'mongodb';

const dir = process.argv[2];
const write = process.argv.includes('--write');
if (!dir) {
    console.error('usage: node scripts/import-letterboxd.mjs <unzipped-export-dir> [--write]');
    process.exit(1);
}

// Minimal RFC-4180 CSV reader — review text contains commas, quotes and newlines.
const parseCsv = (text) => {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
            } else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c !== '\r') field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
};

const readTable = (path, skip = 0) => {
    if (!existsSync(path)) return [];
    const rows = parseCsv(readFileSync(path, 'utf8')).slice(skip).filter((r) => r.length > 1);
    const head = rows.shift();
    return rows.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
};

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const watchlist = readTable(join(dir, 'watchlist.csv'));
const ratings = readTable(join(dir, 'ratings.csv'));
const watched = readTable(join(dir, 'watched.csv'));
const likes = readTable(join(dir, 'likes/films.csv'));
const reviews = readTable(join(dir, 'reviews.csv'));

// Letterboxd list exports carry two header lines before the real table.
const listsDir = join(dir, 'lists');
const lists = existsSync(listsDir)
    ? readdirSync(listsDir).filter((f) => f.endsWith('.csv')).map((f) => ({
        name: basename(f, '.csv'),
        films: readTable(join(listsDir, f), 3),
    }))
    : [];

const ratingOf = new Map(ratings.map((r) => [norm(r.Name), Number(r.Rating)]));
const reviewOf = new Map(reviews.filter((r) => r.Review).map((r) => [norm(r.Name), r.Review]));
const likedSet = new Set(likes.map((r) => norm(r.Name)));
const watchedSet = new Set(watched.map((r) => norm(r.Name)));
const listsOf = new Map();
lists.forEach(({ name, films }) => films.forEach((f) => {
    if (!f.Name) return;
    const k = norm(f.Name);
    if (!listsOf.has(k)) listsOf.set(k, []);
    listsOf.get(k).push(name);
}));

// Union of everything the export knows about, watchlist first so unseen films
// keep their watchlist date.
const seen = new Map();
[...watchlist, ...ratings, ...watched, ...likes].forEach((r) => {
    if (!r.Name) return;
    const k = norm(r.Name);
    if (!seen.has(k)) seen.set(k, r);
});

const films = [...seen.entries()].map(([k, r]) => {
    const doc = {
        board: 'Movies',
        name: r.Name,
        source: 'letterboxd',
        year: r.Year ? Number(r.Year) : undefined,
        letterboxdUri: r['Letterboxd URI'] || undefined,
        watched: watchedSet.has(k),
        onWatchlist: watchlist.some((w) => norm(w.Name) === k),
        liked: likedSet.has(k),
    };
    if (ratingOf.has(k)) doc.rating = ratingOf.get(k);
    if (reviewOf.has(k)) doc.description = reviewOf.get(k);
    if (listsOf.has(k)) doc.lists = listsOf.get(k);
    Object.keys(doc).forEach((key) => doc[key] === undefined && delete doc[key]);
    return doc;
});

const run = async () => {
    const uri = process.env.MONGODB_URI;
    if (write && !uri) { console.error('MONGODB_URI is not set'); process.exit(1); }

    console.log(`export: ${watchlist.length} watchlist · ${ratings.length} rated · `
        + `${watched.length} watched · ${likes.length} liked · ${lists.length} lists`);
    console.log(`distinct films in export: ${films.length}`);

    if (!uri) {
        console.log('\nDRY RUN (no MONGODB_URI) — cannot compare against the board.');
        console.log(JSON.stringify(films.slice(0, 2), null, 2));
        return;
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const col = client.db('tommy-data').collection(process.env.MONGODB_COLLECTION || 'darts');
        const existing = await col.find({ board: 'Movies' }).toArray();
        const have = new Set(existing.map((m) => norm(m.name)));
        const fresh = films.filter((f) => !have.has(norm(f.name)));

        console.log(`board already holds ${existing.length} movies `
            + `(${existing.filter((m) => m.source !== 'letterboxd').length} curated)`);
        console.log(`would add ${fresh.length} new films; ${films.length - fresh.length} already present and untouched`);

        if (!write) {
            console.log('\nDRY RUN — nothing written. Re-run with --write.');
            return;
        }
        let added = 0;
        for (const f of fresh) {
            const res = await col.updateOne(
                { board: 'Movies', name: f.name }, { $set: f }, { upsert: true });
            if (res.upsertedCount) added += 1;
        }
        const after = await col.countDocuments({ board: 'Movies' });
        console.log(`\ndone — ${added} inserted; board went from ${existing.length} to ${after}`);
    } finally {
        await client.close();
    }
};

run();
