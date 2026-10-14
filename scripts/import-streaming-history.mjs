// Reduces a Spotify Extended Streaming History export to one date per record:
// the first time anything off it was ever played.
//
//   node scripts/import-streaming-history.mjs '~/Downloads/Spotify Extended Streaming History'
//
// Writes public/spotify-first-played.json, which the "in order" tab fetches to
// sort master (ii) by when each record entered the collection. A playlist entry's
// own `added_at` cannot answer that — it is when the track was added to THAT
// PLAYLIST, which for a master playlist assembled in bulk is one afternoon.
//
// The export is ~200MB of individual plays across a dozen years. This keeps the
// only part that matters: for each (artist, album), the earliest `ts`. That is
// ~7,000 rows and around 110KB over the wire.
//
// Names are emitted RAW, exactly as Spotify wrote them. Matching them against a
// playlist means normalising both sides, and that normalisation lives in
// src/views/spotify/libraryOrder.js so there is exactly one copy of it — a second
// copy here would drift and silently stop matching.

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const dir = process.argv[2];
if (!dir) {
    console.error(
        'usage: node scripts/import-streaming-history.mjs <unzipped-export-dir>',
    );
    process.exit(1);
}

const OUT = 'public/spotify-first-played.json';

// Audio only. The export also carries video and podcast files, which have no
// album to speak of and never appear in a playlist.
const files = readdirSync(dir)
    .filter((f) => /^Streaming_History_Audio_.*\.json$/.test(f))
    .sort();

if (!files.length) {
    console.error(`No Streaming_History_Audio_*.json in ${dir}`);
    process.exit(1);
}

// key -> [artist, album, ts]. The key is the raw pair, so two spellings stay two
// rows here and are merged by the reader, which is the side that normalises.
const earliest = new Map();
let plays = 0;
let skipped = 0;

for (const file of files) {
    const rows = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    for (const row of rows) {
        const artist = row.master_metadata_album_artist_name;
        const album = row.master_metadata_album_album_name;
        const ts = row.ts;
        // A podcast, an audiobook, or a play Spotify has no metadata for. There
        // is nothing to key on, so it cannot date anything.
        if (!artist || !album || !ts) { skipped += 1; continue; }
        plays += 1;

        const key = `${artist}\u0000${album}`;
        const found = earliest.get(key);
        // Every play counts, however short. A ten-second skip is still the day
        // the record reached you, and filtering on a listened-for threshold threw
        // away 1,155 records that were only ever sampled.
        if (!found || ts < found[2]) earliest.set(key, [artist, album, ts]);
    }
}

// Sorted by date, so the file reads as a history and a diff after a fresh export
// shows the new records at the end rather than scattered through.
const albums = [...earliest.values()]
    .map(([artist, album, ts]) => [artist, album, ts.slice(0, 10)])
    .sort((a, b) => (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0));

const payload = {
    // What produced this, so a stale file is recognisable as one.
    source: 'Spotify Extended Streaming History',
    generated: new Date().toISOString().slice(0, 10),
    plays,
    from: albums[0]?.[2] ?? null,
    to: albums[albums.length - 1]?.[2] ?? null,
    // [artist, album, first played] — see the note above on raw names.
    albums,
};

writeFileSync(OUT, `${JSON.stringify(payload)}\n`);

const kb = (readFileSync(OUT).length / 1024).toFixed(1);
console.log(`${files.length} files, ${plays.toLocaleString()} plays `
    + `(${skipped.toLocaleString()} without album metadata, skipped)`);
console.log(`${albums.length.toLocaleString()} records, ${payload.from} .. ${payload.to}`);
console.log(`wrote ${OUT} — ${kb} KB`);
