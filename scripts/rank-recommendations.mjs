// The twenty albums on the "next records" tab: step 5 of
// docs/PLAN-SPOTIFY-RECOMMENDATIONS.md, output shape in contract section 3.
//
//   node scripts/rank-recommendations.mjs [--candidates scripts/data/candidates.json]
//       [--profile public/spotify-taste.json] [--weights docs/spotify-recommendations-weights.json]
//       [--count 20] [--out public/spotify-recommendations.json] [--offline]
//
// Every candidate is scored by fit.js's rankAlbums with its sourceScore set
// (the weighted max over its sources, weights from the backtest), and only
// tier unheard is kept: a candidate the profile has any play of is not a
// recommendation. Then feedback from Mongo (tommy-data.spotify_rec_feedback,
// when MONGODB_URI is set): heard and not-for-me albums are left out, and every
// other record by a not-for-me artist loses NOT_FOR_ME_PENALTY. Then the
// spread rule (no more than two by one artist) and the top `count`.
//
// Save writes a card's trackUris exactly, so a card carries them only when
// the candidate build has the complete list; otherwise trackUris is null and
// tracksComplete false, and the tab disables Save on it. Every candidate
// ranks either way (on 2026-11-05 Spotify's album endpoint was throttled and
// most had no list yet); a rerun of the candidate build fills them in.
//
// Editions: two candidates by one artist whose names agree up to the first
// ":", " deluxe" or bracket are one record (baseAlbumName does not strip a
// mid-title qualifier); the standard one is kept, with both sets of sources.
//
// Genres: candidates carry none, so each artist's genres come from the
// profile's own artist row where it has one, else one MusicBrainz lookup
// (scripts/lib/genres.mjs, cached). --offline uses the caches only.
//
// No Spotify call is made here.

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { MongoClient } from 'mongodb';
import { DEFAULT_WEIGHTS, rankAlbums } from '../src/views/spotify/fit.js';
import { normalizeName } from '../src/views/spotify/names.js';
import { genresFor } from './lib/genres.mjs';
import {
    NOT_FOR_ME_PENALTY, artistTurnedDown, dedupeEditions, editionStem, feedbackSets, heardStems, notForThePage, lovedByArtist, outputRow, sourceScoreOf, spread, whyOf,
} from './lib/rank.mjs';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const CANDIDATES = arg('candidates', 'scripts/data/candidates.json');
const PROFILE = arg('profile', 'public/spotify-taste.json');
const WEIGHTS = arg('weights', 'docs/spotify-recommendations-weights.json');
const OUT = arg('out', 'public/spotify-recommendations.json');
const COUNT = Number(arg('count', '20'));
const OFFLINE = argv.includes('--offline');

// .env.local for MONGODB_URI, the way scripts/lib/spotify.mjs reads it.
const envFile = resolve(process.cwd(), '.env.local');
if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
}

const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
for (const f of [CANDIDATES, PROFILE]) {
    if (!existsSync(f)) { console.error(`missing ${f}`); process.exit(1); }
}
const profile = readJson(PROFILE);
const { candidates } = readJson(CANDIDATES);
const weightsFile = existsSync(WEIGHTS) ? readJson(WEIGHTS) : null;
const fitWeights = { ...DEFAULT_WEIGHTS, ...(weightsFile?.fit ?? {}) };
const sourceWeights = weightsFile?.sources ?? { 'known-artist': 0.5, listenbrainz: 0.5, lastfm: 0, claude: 0.5 };
if (!weightsFile) console.log(`no ${WEIGHTS}; default fit weights and prior source weights`);

// ---- feedback ---------------------------------------------------------------

const readFeedback = async () => {
    if (!process.env.MONGODB_URI) { console.log('MONGODB_URI not set; no feedback read'); return []; }
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    try {
        await client.connect();
        const rows = await client.db('tommy-data').collection('spotify_rec_feedback').find({}).toArray();
        return rows.map((r) => ({ albumId: r._id, artist: r.artist, album: r.album, verdict: r.verdict }));
    } catch (e) {
        // A build with no feedback is still a build; say so rather than fail.
        console.log(`feedback unreadable (${e.message.slice(0, 100)}); ranking without it`);
        return [];
    } finally {
        await client.close().catch(() => {});
    }
};
const feedback = await readFeedback();
const { excludeIds, notForMeArtists } = feedbackSets(feedback);
console.log(`feedback: ${feedback.length} rows, ${excludeIds.size} albums left out, ${notForMeArtists.size} artists turned down`);

// ---- score ------------------------------------------------------------------

const heard = heardStems(profile);
const usable = dedupeEditions(candidates.filter((c) => c.albumId && !excludeIds.has(c.albumId)
    && !heard.has(editionStem(c)) && !notForThePage(c)));
console.log(`${candidates.length} candidates, ${usable.length} records after editions fold and feedback, ${usable.filter((c) => c.tracksComplete && c.trackUris?.length).length} with a complete track list`);

const profileGenres = new Map((profile.artists ?? [])
    .filter((a) => a.genres?.length).map((a) => [normalizeName(a.name), a.genres]));
const genres = await genresFor(usable.map((c) => c.artist), { seed: profileGenres, offline: OFFLINE, log: console.log });

const albums = usable.map((c) => ({
    artist: c.artist, album: c.album, artistIds: c.artistIds, albumId: c.albumId,
    genres: genres.get(normalizeName(c.artist)) ?? [],
    totalTracks: c.totalTracks, minutes: c.minutes, year: c.year,
    sourceScore: sourceScoreOf(c, sourceWeights).score,
    candidate: c,
}));
const ranked = rankAlbums(albums, profile, fitWeights)
    .filter((a) => a.fit.tier === 'unheard')
    .map((a) => {
        const down = artistTurnedDown(a, notForMeArtists);
        const score = Math.max(0, a.fit.score - (down ? NOT_FOR_ME_PENALTY : 0));
        return { ...a, finalScore: score, down };
    })
    .sort((x, y) => y.finalScore - x.finalScore);
const top = spread(ranked, COUNT);

// ---- write ------------------------------------------------------------------

const lovedBy = lovedByArtist(profile);
const rows = top.map((a) => outputRow(a.candidate, a.finalScore, whyOf(a.candidate, a.fit, lovedBy, sourceWeights), sourceWeights));
const out = {
    generated: new Date().toLocaleDateString('en-CA'),
    profile: {
        generated: profile.generated, exportTo: profile.source?.exportTo ?? null,
        masterTrackCount: profile.source?.master?.trackCount ?? null,
    },
    // The fit weights, which the ranked tab reads as such; the source
    // weights sit beside them so the build can be reproduced.
    weights: fitWeights,
    sourceWeights,
    albums: rows,
};
writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);

top.forEach((a, i) => {
    const c = a.candidate;
    const flags = [rows[i].tracksComplete ? null : 'no track list yet, Save disabled', a.down ? 'artist turned down' : null].filter(Boolean);
    console.log(`${String(i + 1).padStart(2)}. ${a.finalScore.toFixed(3)}  ${c.artist}, ${c.album} (${c.year ?? '?'}, ${c.totalTracks ?? '?'} tracks)  [${rows[i].sources.join(', ')}]${flags.length ? `  (${flags.join(', ')})` : ''}`);
    console.log(`    ${rows[i].why}`);
});
console.log(`wrote ${OUT}: ${rows.length} albums`);
