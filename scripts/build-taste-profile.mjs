// Scores every album Tommy has ever played, from the Extended Streaming History
// export plus master (ii), into public/spotify-taste.json: step 1 of
// docs/PLAN-SPOTIFY-RECOMMENDATIONS.md, shape in docs/SPOTIFY-RECS-CONTRACTS.md.
//
//   node scripts/build-taste-profile.mjs '<export dir>' [--until YYYY-MM-DD] [--out path] [--full] [--refresh] [--resolve-uris]
//
// albums[] holds only the judged records (loved, liked, dropped) unless
// `--full` is passed: the ranked tab fetches this file in the browser, and the
// five thousand sampled rows were most of its three megabytes. Every played
// album stays in heard{}, which is all a sampled record is ever used for (fit.js
// reads "heard, no verdict row" as sampled). The backtest profile is built with
// `--full`, since the backtest reads the sampled rows' hours.
//
// `--until` freezes the history at a date for the backtest: later plays are
// ignored, recency and "gone quiet" are measured from the cutoff, and an album
// first played after it has unknown master membership (it could not have been
// kept yet). `--refresh` rereads master (ii) from Spotify; otherwise the copy
// in scripts/data/master-ii.json is used, and it is only reread when missing.
//
// Matching history to master is by name: the shared key from normalizeName and
// baseAlbumName in src/views/spotify/names.js. The export names albums the way
// the catalogue did on the day of the play, and master holds whatever copy is
// current, so some records miss. `--resolve-uris` is the second pass for those:
// the most played track of each unmatched album with five minutes or more goes
// through the batched tracks() helper (50 a call, never one id at a time), and
// the album id or the album's current name is looked up in master. Run it when
// the throttle lifts; it fills scripts/data/track-albums.json, and every later
// run, the backtest included, reads that cache without asking Spotify again.
// (On 2026-11-05 the batch endpoints answered 403 and the single-id ones a
// Retry-After of 85,000 seconds, so the default build makes no Spotify calls.)
//
// Genres come from the cache get_playlist keeps in Mongo
// (tommy-data.spotify_artist_genres, one genre per artist id). Where that has
// nothing for one of the top 300 artists, MusicBrainz artist tags stand in:
// one search per artist, a request a second as MusicBrainz asks, cached by
// artist name in scripts/data/artist-genres.json so it is only paid once.
// `--no-musicbrainz` skips that fallback.
//
// The score, 0..1, is a weighted sum times a skip penalty:
//
//   score = (0.35 kept + 0.35 depth + 0.20 longevity + 0.10 recency) * (1 - 0.3 skipRate)
//
//   kept      = 0 outside master, else 0.5 + 0.5 masterShare. Being in master at
//               all is half the credit; holding the whole record is the rest.
//   depth     = 0.6 log(1 + hours) / log(41) + 0.4 coverage, each capped at 1.
//               Forty hours saturates; coverage is distinct tracks heard over
//               the record's length (master's copy, else a resolved album, else
//               an assumed 10), so one single on repeat is not a full record.
//   longevity = (distinct years with plays - 1) / 5, capped at 1. One year is
//               a binge, six is a record that lasted.
//   recency   = exp(-years since last play / 3), the tiebreaker that leans the
//               profile toward who Tommy is now.
//   skipRate  = plays ended by next within 30 seconds (or flagged skipped) over
//               all plays. Mild on purpose: shuffle skips land on loved records too.
//
// Verdicts, first match wins:
//
//   loved   in master with masterShare >= 0.6 and 2+ hours played; or, kept
//           or not, depth >= 0.75 across 4+ distinct years.
//   dropped not in master, 20+ minutes, 5+ distinct tracks, and no play in the
//           24 months before the export's last play (or the --until date).
//   liked   in master at all; or 3+ hours over 5+ distinct tracks.
//   sampled everything else.
//
// The thresholds are a first guess for the backtest to judge, not a finding.
// An unmatched record is treated as not in master, so a name the two sides
// spell differently can read as dropped; the report counts how many could.
//
// shape.medianMinutes is measured from the history, not the catalogue: for a
// loved or liked record whose every track has a play that ran to the end, the
// longest such plays add up to the album's length.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { MongoClient } from 'mongodb';
import { playlistTracks, get, tracks as fetchTracks } from './lib/spotify.mjs';
import {
    albumKey, reducePlays, topSpelling, genresFromTags, recentMs, indexMaster, masterFacts, membershipUnder,
    scoreAlbum, verdictOf, aggregateArtists, editionMatch, genreWeights, shapeOf, minutesFromPlays, round,
} from './lib/taste.mjs';
import { normalizeName } from '../src/views/spotify/names.js';

const MASTER_ID = '1QDPVDJSXB9bIrfRg0V36q';
const DATA = 'scripts/data';
const MASTER_CACHE = `${DATA}/master-ii.json`;
const TRACK_CACHE = `${DATA}/track-albums.json`;
const GENRE_CACHE = `${DATA}/artist-genres.json`;
const REPORT = 'docs/spotify-taste-report.md';

// --resolve-uris budget: 60 batched calls is 3,000 URIs, one for every
// unmatched album with five minutes or more, heaviest first.
const MAX_TRACK_CALLS = 60;
const MIN_RESOLVE_MS = 5 * 60000;
const TOP_ARTISTS_FOR_GENRES = 300;
const MB_AGENT = 'TommysThoughts-taste-profile/0.1 (https://tommysthoughts.com)';

// ---- arguments --------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name) => {
    const i = args.indexOf(name);
    if (i === -1) return null;
    const value = args[i + 1];
    args.splice(i, 2);
    return value;
};
const toggle = (name) => {
    const i = args.indexOf(name);
    if (i === -1) return false;
    args.splice(i, 1);
    return true;
};
const refresh = toggle('--refresh');
const resolveUris = toggle('--resolve-uris');
const noMusicBrainz = toggle('--no-musicbrainz');
const full = toggle('--full');
const until = flag('--until');
const OUT = flag('--out') ?? 'public/spotify-taste.json';
const dir = args[0];

if (!dir || (until && !/^\d{4}-\d{2}-\d{2}$/.test(until))) {
    console.error('usage: node scripts/build-taste-profile.mjs <export dir> [--until YYYY-MM-DD] [--out path] [--full] [--refresh] [--resolve-uris] [--no-musicbrainz]');
    process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value)}\n`);
mkdirSync(DATA, { recursive: true });
// Local calendar dates, not UTC: Tommy's "today" is the one on his clock.
const localDay = (d) => new Date(d).toLocaleDateString('en-CA');
const today = localDay(Date.now());

// ---- the export -------------------------------------------------------------

const files = readdirSync(dir).filter((f) => /^Streaming_History_Audio_.*\.json$/.test(f)).sort();
if (!files.length) {
    console.error(`No Streaming_History_Audio_*.json in ${dir}`);
    process.exit(1);
}
const rows = files.flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
const { albums: reduced, plays, from: exportFrom, to: exportTo } = reducePlays(rows, { until });
// Everything time-relative is measured from here: the cutoff when there is one,
// so a backtest profile cannot see past its own edge.
const refDay = until ?? exportTo;
console.log(`${files.length} files, ${plays.toLocaleString()} plays, ${reduced.size.toLocaleString()} albums, ${exportFrom} .. ${exportTo}`);

// ---- master (ii) ------------------------------------------------------------

// 122 pages, and the playlist does not change between a build and its
// backtest, so the cached read is used unless asked otherwise.
const loadMaster = async () => {
    const cached = readJson(MASTER_CACHE, null);
    if (cached && !refresh) return cached;
    console.log('reading master (ii) from Spotify...');
    const meta = await get(`/playlists/${MASTER_ID}?fields=name`);
    const master = { id: MASTER_ID, name: meta.name, readAt: new Date().toISOString(), tracks: await playlistTracks(MASTER_ID) };
    writeJson(MASTER_CACHE, master);
    return master;
};
const master = await loadMaster();
const { byKey: masterByKey, byId: masterById } = indexMaster(master.tracks);
console.log(`master (ii): ${master.tracks.length.toLocaleString()} tracks, ${masterById.size} album ids, read ${localDay(master.readAt)}`);

// ---- matching ---------------------------------------------------------------

const matchKey = new Map(); // history key -> master key
const matchedBy = new Map(); // history key -> 'name' | 'edition' | 'uri'
for (const key of reduced.keys()) {
    if (masterByKey.has(key)) { matchKey.set(key, key); matchedBy.set(key, 'name'); }
}
// Editions the shared qualifier rule does not strip, matched within this script
// only: widening names.js would change the in-order tab's matching too.
const masterKeys = [...masterByKey.keys()];
for (const key of reduced.keys()) {
    if (matchKey.has(key)) continue;
    const mk = editionMatch(key, masterKeys);
    if (mk) { matchKey.set(key, mk); matchedBy.set(key, 'edition'); }
}

const trackCache = readJson(TRACK_CACHE, {});
const unmatched = [...reduced.values()].filter((a) => !matchKey.has(a.key)).sort((x, y) => y.ms - x.ms);
// The most played track names the album; a second would mostly confirm it.
const sampleOf = (a) => (a.ms >= MIN_RESOLVE_MS ? [...a.uris].sort((x, y) => y[1] - x[1]).slice(0, 1).map(([u]) => u) : []);

if (resolveUris) {
    const wanted = unmatched.flatMap(sampleOf).filter((u) => !(u in trackCache)).slice(0, MAX_TRACK_CALLS * 50);
    console.log(`resolving ${wanted.length.toLocaleString()} track URIs in ${Math.ceil(wanted.length / 50)} batched calls...`);
    // A batch at a time, saved after each, so a refusal partway keeps what was paid for.
    for (let i = 0; i < wanted.length; i += 50) {
        const batch = wanted.slice(i, i + 50);
        let got;
        try {
            got = await fetchTracks(batch.map((u) => u.split(':').pop()));
        } catch (e) {
            console.log(`  stopped after ${i} URIs: ${e.message.slice(0, 120)}`);
            break;
        }
        const byId = new Map(got.map((t) => [t.id, t]));
        for (const u of batch) {
            const t = byId.get(u.split(':').pop());
            // A null is cached too: a URI Spotify no longer knows will not know it tomorrow.
            trackCache[u] = t ? {
                albumId: t.album?.id ?? null, albumName: t.album?.name ?? null,
                totalTracks: t.album?.total_tracks ?? null,
                artists: (t.artists ?? []).map((x) => [x.id, x.name]),
                albumArtists: (t.album?.artists ?? []).map((x) => [x.id, x.name]),
            } : null;
        }
        writeJson(TRACK_CACHE, trackCache);
    }
}

// What a resolved sample says, from the cache only: free whether or not this
// run resolved anything.
const resolvedOf = (a) => sampleOf(a).map((u) => trackCache[u]).filter(Boolean);

for (const a of unmatched) {
    for (const r of resolvedOf(a)) {
        let mk = r.albumId ? masterById.get(r.albumId) : null;
        // The album may also be in master as a different copy whose name the
        // catalogue now spells the way master does.
        if (!mk && r.albumName) {
            for (const [, name] of [...r.albumArtists, ...r.artists]) {
                const k = albumKey(name, r.albumName);
                if (masterByKey.has(k)) { mk = k; break; }
            }
        }
        if (mk) { matchKey.set(a.key, mk); matchedBy.set(a.key, 'uri'); break; }
    }
}

// ---- album rows -------------------------------------------------------------

const albums = [...reduced.values()].map((a) => {
    const [artist, album] = topSpelling(a.spellings);
    const mk = matchKey.get(a.key);
    const rec = mk ? masterByKey.get(mk) : null;
    const facts = rec ? masterFacts(rec) : null;
    const resolved = resolvedOf(a);
    const artistNorm = normalizeName(artist);

    const albumIds = new Set(rec ? rec.albumIds : []);
    resolved.forEach((r) => r.albumId && albumIds.add(r.albumId));
    const artistIds = new Set();
    const masterArtistId = rec?.artistIdByName.get(artistNorm);
    if (masterArtistId) artistIds.add(masterArtistId);
    for (const r of resolved) {
        for (const [id, name] of [...r.artists, ...r.albumArtists]) {
            if (id && normalizeName(name) === artistNorm) artistIds.add(id);
        }
    }

    const totalTracks = facts?.totalTracks ?? resolved.find((r) => r.totalTracks)?.totalTracks ?? null;
    const row = {
        key: a.key, artist, album,
        artistIds: [...artistIds], albumIds: [...albumIds],
        firstPlayed: a.firstPlayed, lastPlayed: a.lastPlayed,
        plays: a.plays, hours: a.ms / 3600000, distinctTracks: a.trackNames.size, totalTracks,
        years: [...a.years].sort((x, y) => x - y),
        skipRate: a.plays ? a.skips / a.plays : 0,
        ...membershipUnder(facts, a.firstPlayed, until),
        recentHours: recentMs(a.msByMonth, refDay) / 3600000,
        minutes: minutesFromPlays(a.trackMs, totalTracks),
    };
    row.score = scoreAlbum(row, refDay);
    row.verdict = verdictOf(row, refDay);
    return row;
}).sort((x, y) => y.score - x.score || y.hours - x.hours);

// ---- artists and genres -----------------------------------------------------

const artists = aggregateArtists(albums);

// get_playlist's cache, read only. Missing MONGODB_URI or an unreachable
// cluster leaves it empty rather than failing the build.
const mongoGenres = async () => {
    if (!process.env.MONGODB_URI) return {};
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    try {
        await client.connect();
        const doc = await client.db('tommy-data').collection('spotify_artist_genres').findOne({ _id: 'artist_genres' });
        return doc?.genres ?? {};
    } catch (e) {
        console.log(`  Mongo genre cache unreadable: ${e.message.slice(0, 120)}`);
        return {};
    } finally {
        await client.close().catch(() => {});
    }
};
const byArtistId = await mongoGenres();
console.log(`Mongo genre cache: ${Object.values(byArtistId).filter(Boolean).length} artists with a genre`);

const mbSearch = async (name) => {
    const url = `https://musicbrainz.org/ws/2/artist/?fmt=json&limit=1&query=${encodeURIComponent(`artist:"${name}"`)}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        let response;
        try { response = await fetch(url, { headers: { 'user-agent': MB_AGENT } }); } catch (_) { await sleep(3000); continue; }
        if (response.status === 503 || response.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
        if (!response.ok) return null;
        const hit = (await response.json()).artists?.[0];
        // A weak hit is a different artist with a similar name; better no genres than wrong ones.
        if (!hit || hit.score < 90) return { mbid: null, genres: [] };
        return { mbid: hit.id, genres: genresFromTags(hit.tags) };
    }
    return null;
};
const fromMongo = (r) => [...new Set(r.artistIds.map((id) => byArtistId[id]).filter(Boolean))];
// Keyed by normalised artist name, which is what MusicBrainz is searched by.
const genreCache = readJson(GENRE_CACHE, {});
const genreWanted = artists.slice(0, TOP_ARTISTS_FOR_GENRES)
    .filter((r) => !fromMongo(r).length && !(normalizeName(r.name) in genreCache));
if (genreWanted.length && !noMusicBrainz) {
    console.log(`MusicBrainz tags for ${genreWanted.length} artists (about ${Math.ceil((genreWanted.length * 1.2) / 60)} min)...`);
    for (const [i, r] of genreWanted.entries()) {
        const found = await mbSearch(r.name);
        if (found) genreCache[normalizeName(r.name)] = { name: r.name, ...found };
        if ((i + 1) % 50 === 0) { process.stderr.write(`  musicbrainz ${i + 1}/${genreWanted.length}\n`); writeJson(GENRE_CACHE, genreCache); }
        await sleep(1100);
    }
    writeJson(GENRE_CACHE, genreCache);
}
const genresByArtistName = new Map();
for (const r of artists) {
    const mongo = fromMongo(r);
    const genres = mongo.length ? mongo : genreCache[normalizeName(r.name)]?.genres ?? [];
    r.genres = genres;
    if (genres.length) genresByArtistName.set(normalizeName(r.name), genres);
}
const genres = genreWeights(albums, genresByArtistName);

// ---- shape ------------------------------------------------------------------

const minutesByKey = new Map(albums.filter((a) => a.minutes).map((a) => [a.key, a.minutes]));
const shape = shapeOf(albums, minutesByKey);

// ---- heard ------------------------------------------------------------------

// Everything played, plus everything in master. Master's own records are
// left out of a backtest's heard set: a record kept after the cutoff is
// exactly what the backtest hopes a source will find.
const heardKeys = new Set(albums.map((a) => a.key));
const heardIds = new Set(albums.flatMap((a) => a.albumIds));
if (!until) {
    for (const k of masterByKey.keys()) heardKeys.add(k);
    for (const id of masterById.keys()) heardIds.add(id);
}

// ---- write ------------------------------------------------------------------

const payload = {
    source: {
        export: 'Spotify Extended Streaming History',
        exportFrom, exportTo, plays,
        master: { id: master.id, name: master.name, trackCount: master.tracks.length, readAt: localDay(master.readAt) },
    },
    generated: today,
    until: until ?? null,
    albums: albums.filter((a) => full || a.verdict !== 'sampled').map((a) => ({
        key: a.key, artist: a.artist, album: a.album,
        artistIds: a.artistIds, albumIds: a.albumIds,
        firstPlayed: a.firstPlayed, lastPlayed: a.lastPlayed,
        plays: a.plays, hours: round(a.hours, 1), distinctTracks: a.distinctTracks, totalTracks: a.totalTracks,
        years: a.years, skipRate: round(a.skipRate),
        inMaster: a.inMaster, masterTracks: a.masterTracks, masterShare: round(a.masterShare),
        score: round(a.score, 3), verdict: a.verdict,
    })),
    // Artists with an hour of listening or a judged record. The thousands of
    // one-song artists below that carry no signal any consumer reads, and
    // cutting them is most of what keeps the file near its size budget.
    artists: artists.filter((r) => r.hours >= 1 || r.lovedAlbums || r.droppedAlbums)
        .map((r) => ({ ...r, score: round(r.score, 3), hours: round(r.hours, 1) })),
    genres: genres.map((g) => ({ genre: g.genre, weight: round(g.weight, 3), recentWeight: round(g.recentWeight, 3) })),
    shape: {
        medianTracks: shape.medianTracks,
        medianMinutes: round(shape.medianMinutes, 0),
        fullAlbumShare: round(shape.fullAlbumShare),
    },
    heard: { albumKeys: [...heardKeys], albumIds: [...heardIds] },
};
writeJson(OUT, payload);

// ---- report -----------------------------------------------------------------

const count = (v) => albums.filter((a) => a.verdict === v).length;
const by = (how) => albums.filter((a) => matchedBy.get(a.key) === how).length;
const pct = (n, d) => `${((100 * n) / (d || 1)).toFixed(1)}%`;
// Master's records counted by album id's first-artist key, so a feature
// credit does not count a record twice.
const masterRecords = new Set([...masterById.values()]).size;
const matchedMasterKeys = new Set([...matchKey.values()]
    .flatMap((mk) => [...masterByKey.get(mk).albumIds].map((id) => masterById.get(id)))).size;
const real = albums.filter((a) => a.hours * 60 >= 20 && a.distinctTracks >= 5);
const realMatched = real.filter((a) => matchKey.has(a.key)).length;

const masterArtists = new Set(master.tracks.flatMap((t) => (t.artistNames ?? []).map(normalizeName)));
const fmt = (a) => `${a.score.toFixed(3)}  ${a.hours.toFixed(1).padStart(6)}h  ${String(a.years.length).padStart(2)}y  `
    + `${a.masterShare == null ? '   -' : a.masterShare.toFixed(2)}  ${a.artist} - ${a.album}`;
const lines = [
    `# Taste profile report`,
    '',
    `Generated ${today} by scripts/build-taste-profile.mjs${until ? `, --until ${until}` : ''}. Written to ${OUT}.`,
    '',
    '```',
    `plays ${plays.toLocaleString()}, ${exportFrom} .. ${exportTo}; albums ${albums.length.toLocaleString()}`,
    '',
    'verdicts',
    ...['loved', 'liked', 'dropped', 'sampled'].map((v) => `  ${v.padEnd(8)} ${count(v)}`),
    '',
    'matching to master (ii)',
    `  by name  ${by('name')}`,
    `  by edition prefix ${by('edition')}`,
    `  by uri   ${by('uri')}`,
    `  none     ${albums.length - by('name') - by('edition') - by('uri')}`,
    `  albums with 20+ min and 5+ tracks matched: ${realMatched} of ${real.length} (${pct(realMatched, real.length)})`,
    `  master records (by first-artist key) found in the history: ${matchedMasterKeys} of ${masterRecords}`,
    `  dropped albums by an artist who is in master (worth a look for a spelling miss): ${albums.filter((a) => a.verdict === 'dropped' && masterArtists.has(normalizeName(a.artist))).length}`,
    `  track-albums cache: ${Object.keys(trackCache).length} URIs${resolveUris ? '' : ' (run with --resolve-uris when the throttle lifts)'}`,
    '',
    `shape from ${albums.filter((a) => a.verdict === 'loved' || a.verdict === 'liked').length} loved+liked (${minutesByKey.size} with a length from plays)`,
    `shape  medianTracks ${shape.medianTracks}, medianMinutes ${round(shape.medianMinutes, 0)}, fullAlbumShare ${round(shape.fullAlbumShare)}`,
    `top genres  ${genres.slice(0, 12).map((g) => `${g.genre} ${(g.weight * 100).toFixed(1)}%`).join(', ') || '(none)'}`,
    `top artists ${artists.slice(0, 12).map((r) => r.name).join(', ')}`,
    '',
    'top 50 loved (score, hours, distinct years, masterShare)',
    ...albums.filter((a) => a.verdict === 'loved').slice(0, 50).map(fmt),
    '',
    '50 highest-scoring dropped',
    ...albums.filter((a) => a.verdict === 'dropped').slice(0, 50).map(fmt),
    '```',
    '',
];
const text = lines.join('\n');
console.log(text);
// A backtest run, or a --full copy written elsewhere, keeps its report out of
// docs so the real one is not overwritten.
const isDefault = !until && OUT === 'public/spotify-taste.json';
if (isDefault) writeFileSync(REPORT, text);
const kb = (statSync(OUT).size / 1024).toFixed(1);
console.log(`wrote ${OUT}: ${kb} KB, ${full ? 'every album row' : 'judged album rows only (--full keeps the sampled ones)'}${isDefault ? `, and ${REPORT}` : ''}`);
