// Seeds get_playlist's artist genre cache from MusicBrainz.
//
// server/get_playlist/get_playlist.js gives every track its artist's first
// genre, read from one Mongo document (tommy-data.spotify_artist_genres,
// { _id: 'artist_genres', genres: { [spotifyArtistId]: genre } }) and filled
// from Spotify's /artists endpoint for artists it has not seen. That endpoint
// answers 403 for this app now, so the cache never filled and every track
// reached the browser with genre ''. The ranked tab and the genre-aware shuffle
// both read that genre.
//
// This fills the cache the way the taste profile fills its genres: one
// MusicBrainz search per artist name (scripts/lib/genres.mjs, a request a
// second, cached by name), the highest-count tag that is a genre taken as the
// artist's one genre, spelled the way public/spotify-taste.json spells it.
// Artists come from master (ii) (scripts/data/master-ii.json) and the queue
// playlist "git add ./goodMusic" (read once with /items and cached to
// scripts/data/queue-goodmusic.json). No /artists, /albums or /tracks call.
//
// Writes $set genres.<id> per artist into the Mongo document, exactly as
// get_playlist's writeGenreCache does, and public/spotify-artist-genres.json.
// Artists MusicBrainz cannot name are left out of both, so get_playlist still
// treats them as unknown.
//
//   node scripts/seed-artist-genres.mjs [--dry-run] [--limit N] [--refresh-queue]

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { MongoClient } from 'mongodb';
import { playlistTracks } from './lib/spotify.mjs'; // also loads .env.local
import { genresFor } from './lib/genres.mjs';
import { normalizeName } from '../src/views/spotify/names.js';

const MASTER = 'scripts/data/master-ii.json';
const QUEUE = 'scripts/data/queue-goodmusic.json';
const QUEUE_ID = '2hD9q4WrdC1h56j6EXXFVZ';
const PROFILE = 'public/spotify-taste.json';
const PROFILE_GENRE_CACHE = 'scripts/data/artist-genres.json';
const OUT = 'public/spotify-artist-genres.json';

// ---- pure parts (tested in seed-artist-genres.test.mjs) ----------------------

// Tags MusicBrainz users file that are places, roles or in-jokes rather than
// genres. genresFromTags already drops the common ones; these are the rest
// that turn up among Tommy's artists (several sit in the profile's genre list).
const NOT_GENRE = new Set([
    'united states', 'usa', 'america', 'detroit', 'utah', 'provo', 'pennsylvania', 'france',
    'california', 'los angeles', 'new york', 'nashville', 'seattle', 'portland', 'london',
    'guitarist', 'guitariste', 'pianist', 'rapper', 'songwriter', 'multi-instrumentalist',
    'group turned solo project', 'secret machines', 'breakeven', 'mezcal', 'summer',
    'seen on tv', 'american idol', 'queer', 'independent', 'chilled', 'dream', 'death by misadventure',
]);

// One key for spellings that differ only in spacing and punctuation:
// "hip-hop" and "hip hop", "singer/songwriter" and "singer-songwriter".
const squash = (g) => normalizeName(g).replace(/[\s\-/_.]+/g, '');

// Spellings that differ by more than punctuation.
const ALIASES = new Map([
    ['rnb', 'r&b'], ['randb', 'r&b'], ['rhythmandblues', 'r&b'],
    ['hiphoprap', 'hip hop'], ['rockandroll', 'rock'], ['rocknroll', 'rock'],
    ['electronica', 'electronic'], ['lofi', 'lo-fi'],
]);

/**
 * A mapper from a MusicBrainz genre to the profile's spelling of it. `vocab` is
 * the profile's genres[] in weight order, so where two spellings squash alike
 * ("singer-songwriter", "singer/songwriter") the heavier one wins. A genre the
 * profile has never seen keeps MusicBrainz's spelling, lower case.
 */
export const vocabularyMapper = (vocab = []) => {
    const bySquash = new Map();
    for (const raw of vocab) {
        const g = normalizeName(raw);
        if (!g || NOT_GENRE.has(g)) continue;
        if (!bySquash.has(squash(g))) bySquash.set(squash(g), g);
    }
    return (genre) => {
        const g = normalizeName(genre);
        if (!g) return '';
        const k = squash(g);
        if (bySquash.has(k)) return bySquash.get(k);
        const alias = ALIASES.get(k);
        if (alias) return bySquash.get(squash(alias)) ?? alias;
        return g;
    };
};

/**
 * The one genre get_playlist should attach: the first entry of a list already
 * in count order (genresFor's lists are), skipping anything that is not a
 * genre, mapped to the profile's vocabulary. '' when nothing qualifies.
 */
export const pickGenre = (genres = [], mapGenre = (g) => normalizeName(g)) => {
    for (const raw of genres ?? []) {
        const g = normalizeName(raw);
        if (!g || NOT_GENRE.has(g)) continue;
        const mapped = mapGenre(g);
        if (mapped && !NOT_GENRE.has(mapped)) return mapped;
    }
    return '';
};

/**
 * Unique artists ({ id, name }) across track lists, every credited artist
 * included (the shuffle reasons over all of a track's artists). First spelling
 * of a name wins; tracks without ids (local files) are skipped.
 */
export const collectArtists = (...trackLists) => {
    const out = new Map();
    for (const tracks of trackLists) {
        for (const t of tracks ?? []) {
            (t.artistIds ?? []).forEach((id, i) => {
                const name = t.artistNames?.[i];
                if (id && name && !out.has(id)) out.set(id, { id, name });
            });
        }
    }
    return [...out.values()];
};

// ---- the run ------------------------------------------------------------------

const main = async () => {
    const started = Date.now();
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const refreshQueue = args.includes('--refresh-queue');
    const limitAt = args.indexOf('--limit');
    const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : Infinity;
    if (limitAt >= 0 && !(limit > 0)) throw new Error('--limit needs a positive number');

    const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);

    const master = readJson(MASTER, null);
    if (!master) throw new Error(`${MASTER} is missing; build-taste-profile.mjs writes it`);

    let queue = refreshQueue ? null : readJson(QUEUE, null);
    if (!queue) {
        console.log(`Reading the queue playlist ${QUEUE_ID} from Spotify (/items only)...`);
        const tracks = await playlistTracks(QUEUE_ID);
        queue = { id: QUEUE_ID, name: 'git add ./goodMusic', readAt: new Date().toISOString(), tracks };
        writeFileSync(QUEUE, JSON.stringify(queue));
    }
    console.log(`master (ii): ${master.tracks.length} tracks; queue: ${queue.tracks.length} tracks (read ${queue.readAt})`);

    let artists = collectArtists(master.tracks, queue.tracks);
    console.log(`artists found: ${artists.length}`);
    if (Number.isFinite(limit)) artists = artists.slice(0, limit);

    // The profile's own MusicBrainz cache answers first: same search, same tags.
    const profileCache = readJson(PROFILE_GENRE_CACHE, {});
    const seed = new Map(Object.entries(profileCache).map(([k, v]) => [k, v?.genres ?? []]));
    const byName = await genresFor(artists.map((a) => a.name), { seed, log: console.log });

    const mapGenre = vocabularyMapper((readJson(PROFILE, {}).genres ?? []).map((g) => g.genre));
    const found = new Map();
    const none = [];
    for (const a of artists) {
        const genre = pickGenre(byName.get(normalizeName(a.name)) ?? [], mapGenre);
        if (genre) found.set(a.id, genre); else none.push(a);
    }

    console.log(`artists looked up: ${artists.length}`);
    console.log(`artists with a genre: ${found.size}`);
    console.log(`artists with none: ${none.length}`);
    const counts = new Map();
    found.forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1));
    console.log('top genres:');
    [...counts].sort((x, y) => y[1] - x[1]).slice(0, 15)
        .forEach(([g, n]) => console.log(`  ${String(n).padStart(4)}  ${g}`));
    if (none.length) console.log(`no genre, e.g.: ${none.slice(0, 10).map((a) => a.name).join(', ')}`);

    if (dryRun) {
        console.log('dry run: Mongo and the public file left alone');
    } else {
        // Merged into what is there, so a --limit run never shrinks the file.
        const previous = readJson(OUT, { genres: {} }).genres ?? {};
        const genres = Object.fromEntries(Object.entries({ ...previous, ...Object.fromEntries(found) }).sort());
        writeFileSync(OUT, `${JSON.stringify({ generated: new Date().toISOString(), genres }, null, 1)}\n`);
        console.log(`wrote ${OUT}: ${Object.keys(genres).length} artists`);

        if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set (env or .env.local)');
        const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
        try {
            await client.connect();
            // As writeGenreCache in get_playlist.js: one $set per artist, upsert,
            // never a wholesale replace.
            const update = {};
            found.forEach((genre, id) => { update[`genres.${id}`] = genre; });
            if (found.size) {
                await client.db('tommy-data').collection('spotify_artist_genres').updateOne(
                    { _id: 'artist_genres' },
                    { $set: { ...update, updatedAt: new Date().toISOString() } },
                    { upsert: true },
                );
            }
            const doc = await client.db('tommy-data').collection('spotify_artist_genres').findOne({ _id: 'artist_genres' });
            console.log(`Mongo: ${found.size} artists set; document now holds ${Object.keys(doc?.genres ?? {}).length}`);
        } finally {
            await client.close().catch(() => {});
        }
    }
    console.log(`run time: ${((Date.now() - started) / 1000).toFixed(1)}s`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((e) => { console.error(e); process.exit(1); });
}
