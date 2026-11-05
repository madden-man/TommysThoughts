// Collects albums Tommy has not heard from several sources, kept separate so
// the backtest can judge each one, and checks every one against Spotify.
//
//   node scripts/build-candidates.mjs [--profile public/spotify-taste.json]
//       [--out scripts/data/candidates.json]
//       [--sources known-artist,listenbrainz,lastfm,claude] [--limit-artists N]
//       [--spotify-budget known-artist=100,listenbrainz=120,verify=90,tracks=40]
//
// Writes scripts/data/candidates.json (contract section 2), which the ranker
// reads. Nothing here decides what is good; it decides what is real (an album
// Spotify has under that name), new (not in the profile's heard set) and a
// record (an album of 8+ tracks and 25+ minutes, not live, not a compilation).
//
// Sources propose loosely and the builder is strict, because a wrong album on
// the page is worse than a missing one: a proposal only counts when Spotify's
// artist and album names agree with it once spelling noise is taken out, and
// every reject is logged so a source that keeps missing shows up.
//
// Everything fetched is cached under scripts/data/cache/, so a rerun with a
// new profile (or new proposals) only pays for what it has not asked before.
// --limit-artists N runs the artist-seeded sources on the top N artists only,
// for a quick end-to-end check. --spotify-budget caps the Spotify calls per
// phase (defaults above in BUDGETS); a phase that runs out stops asking, logs
// what it did not reach, and the next run picks up from the cache.
//
// Each candidate carries one field the contract does not list:
// `tracksComplete`, false when the track list is partial or not fetched yet
// (Spotify throttles /albums/{id} by the day). Until it is fetched, trackUris,
// minutes, label and popularity are null rather than the candidate dropped.
// The ranker should only put a complete one on the page, since Save writes
// exactly those uris.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { saveAll } from './lib/cache.mjs';
import {
    albumKey, bestScore, exclusionReason, heardSets, isNotARecord, mapLimit, mergeCandidates,
    MIN_MINUTES, namesAgree, pickMatch, preferStandard,
} from './lib/candidates.mjs';
import {
    albumEndpointThrottled, albumStub, BudgetSpent, setSpotifyBudget, spotifyCallsMade, Throttled, throttledEndpoints, cachedAlbum, cachedSearchAlbums, cachedSearchAlbumsLoose, cachedTracksBySearch,
} from './lib/sources/spotify-cached.mjs';

const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const PROFILE = arg('profile', 'public/spotify-taste.json');
const OUT = arg('out', 'scripts/data/candidates.json');
const SOURCES = arg('sources', 'known-artist,listenbrainz,lastfm,claude').split(',').map((s) => s.trim()).filter(Boolean);
const LIMIT = arg('limit-artists', null) ? Number(arg('limit-artists')) : undefined;
// Spotify calls each phase may spend (cache hits are free). Small on purpose:
// the app was throttled on 2026-11-05, and a rerun continues from the cache.
const BUDGETS = {
    'known-artist': 100, listenbrainz: 120, lastfm: 100, claude: 0, verify: 90, tracks: 40,
    ...Object.fromEntries(arg('spotify-budget', '').split(',').filter(Boolean).map((kv) => {
        const [k, v] = kv.split('=');
        return [k.trim(), Number(v)];
    })),
};

if (!existsSync(PROFILE)) {
    console.error(`No profile at ${PROFILE}; build it with scripts/build-taste-profile.mjs or pass --profile.`);
    process.exit(1);
}
const profile = JSON.parse(readFileSync(PROFILE, 'utf8'));
const heard = heardSets(profile);
const log = (line) => console.log(line);
const started = Date.now();

// Flush the caches if the run is interrupted, so the next one starts warm.
process.on('SIGINT', () => { saveAll(); process.exit(130); });

// 1. Every source, raw. A source that throws costs its own rows, not the run.
const raw = [];
const counts = {};
for (const source of SOURCES) {
    counts[source] = { raw: 0, verified: 0, kept: 0 };
    let rows = [];
    try {
        // eslint-disable-next-line no-await-in-loop
        const mod = await import(`./lib/sources/${source}.mjs`);
        setSpotifyBudget(source, BUDGETS[source] ?? 100);
        // eslint-disable-next-line no-await-in-loop
        rows = await mod.candidates(profile, { log, limitArtists: LIMIT });
    } catch (e) {
        log(`${source}: failed, ${e.stack ?? e.message}`);
    }
    saveAll();
    counts[source].raw = rows.length;
    for (const row of rows) raw.push({ ...row, source });
}

// 2. Group rows that name the same record, so it is verified once however
// many sources found it. An id from any row in the group wins over a search.
const groups = new Map();
for (const row of raw) {
    const k = albumKey(row.artist, row.album);
    const g = groups.get(k) ?? { key: k, rows: [] };
    g.rows.push(row);
    groups.set(k, g);
}

const exclusions = {};
const exclude = (reason, rows) => {
    exclusions[reason] = (exclusions[reason] ?? 0) + 1;
    return { reason, rows };
};

// Some exclusions need no Spotify call at all; take them before spending one.
const toVerify = [];
const verifiedRows = [];
for (const g of groups.values()) {
    if (heard.keys.has(g.key) || g.rows.some((r) => r.albumId && heard.ids.has(r.albumId))) {
        exclude('heard', g.rows);
        for (const r of g.rows) verifiedRows.push(r); // known-good ids count as verified
        continue;
    }
    if (isNotARecord(g.rows[0].album)) { exclude('live or compilation', g.rows); continue; }
    toVerify.push(g);
}
log(`\n${raw.length} raw rows in ${groups.size} distinct records; verifying ${toVerify.length} on Spotify`);

// 3. Verify against a stub (the album as an artist page or search hit shows
// it): an id from a source names its stub, else the search hit whose names
// agree. Either way the names are checked against the proposal.
let rejected = 0;
let unverified = 0;
setSpotifyBudget('verify', BUDGETS.verify);
const verified = await mapLimit(toVerify, 2, async (g) => {
    try {
        return await verify(g);
    } catch (e) {
        if (!(e instanceof BudgetSpent || e instanceof Throttled)) throw e;
        unverified += 1;
        return null;
    }
});
async function verify(g) {
    const proposal = g.rows[0];
    const withId = g.rows.filter((r) => r.albumId);
    let stub = null;
    if (withId.length) {
        const name = preferStandard(withId.map((r) => r.album));
        const id = withId.find((r) => r.album === name).albumId;
        stub = albumStub(id) ?? (await cachedAlbum(id)) ?? null;
    } else {
        stub = pickMatch(proposal, await cachedSearchAlbums(proposal.artist, proposal.album))
            ?? pickMatch(proposal, await cachedSearchAlbumsLoose(proposal.artist, proposal.album));
    }
    if (!stub || !namesAgree(proposal, stub)) {
        rejected += 1;
        log(`  reject [${[...new Set(g.rows.map((r) => r.source))].join(',')}] ${proposal.artist} - ${proposal.album}${stub ? ` (Spotify: ${stub.artists.map((a) => a.name).join(', ')} - ${stub.name})` : ' (not found)'}`);
        return null;
    }
    return { g, stub };
}
saveAll();
log(`${rejected} rejected by verification${unverified ? `, ${unverified} not checked (Spotify budget; rerun to continue)` : ''}`);

// 4. Candidates from the stubs, merged by the key Spotify's own spelling gives
// (two proposals spelled differently can be one record), and every exclusion
// that needs no track list applied before any track list is fetched.
const built = [];
for (const v of verified.filter(Boolean)) {
    const { g, stub } = v;
    for (const r of g.rows) verifiedRows.push(r);
    const artist = stub.artists[0]?.name ?? g.rows[0].artist;
    built.push({
        key: albumKey(artist, stub.name),
        proposalKey: g.key,
        albumId: stub.id,
        artist,
        album: stub.name,
        artistIds: stub.artists.map((a) => a.id),
        year: Number(String(stub.release_date ?? '').slice(0, 4)) || null,
        totalTracks: stub.total_tracks ?? null,
        minutes: null,
        albumType: stub.album_type,
        image: stub.image ?? null,
        popularity: null,
        label: null,
        trackUris: null,
        tracksComplete: false,
        sources: g.rows.map((r) => ({ source: r.source, score: r.score, via: r.via, note: r.note })),
    });
}

const survivors = [];
for (const c of mergeCandidates(built)) {
    // Minutes are not known yet; the length rule runs once they are.
    const reason = exclusionReason({ ...c, minutes: Infinity }, heard, [c.proposalKey]);
    if (reason) { exclude(reason, c.sources); continue; }
    survivors.push(c);
}
survivors.sort((a, b) => bestScore(b) - bestScore(a) || a.key.localeCompare(b.key));

// 5. Track lists and lengths, best-scored first: the album object where
// Spotify will give it, else the track search, within TRACK_SEARCH_BUDGET
// albums so a throttled day cannot spend the search quota too. An album past
// the budget keeps an empty track list and tracksComplete false, and a rerun
// fills it from the cache's gaps.
let viaSearch = 0;
let pending = 0;
setSpotifyBudget('tracks', BUDGETS.tracks);
await mapLimit(survivors, 2, async (c) => {
    try {
        await fillTracks(c);
    } catch (e) {
        if (!(e instanceof BudgetSpent || e instanceof Throttled)) throw e;
        pending += 1;
    }
});
async function fillTracks(c) {
    const full = await cachedAlbum(c.albumId);
    if (full) {
        Object.assign(c, {
            minutes: Math.round(full.ms / 60000), trackUris: full.trackUris, tracksComplete: true,
            popularity: full.popularity, label: full.label, image: full.image ?? c.image,
            totalTracks: full.total_tracks ?? c.totalTracks,
        });
        return;
    }
    if (full === null) { pending += 1; return; }
    const found = await cachedTracksBySearch(albumStub(c.albumId) ?? { id: c.albumId, name: c.album, artists: [{ name: c.artist }], total_tracks: c.totalTracks });
    // A partial list is scaled up to the album's track count for the length
    // rule only; the uris stay exactly what was found.
    viaSearch += 1;
    const scale = found.trackUris.length ? (c.totalTracks ?? found.trackUris.length) / found.trackUris.length : 0;
    Object.assign(c, {
        minutes: found.trackUris.length ? Math.round((found.ms * scale) / 60000) : null,
        trackUris: found.trackUris.length ? found.trackUris : null, tracksComplete: found.complete,
    });
}
saveAll();
if (albumEndpointThrottled()) {
    log(`/albums/{id} is throttled: ${viaSearch} track lists by search, ${pending} left without one (rerun once the throttle lifts)`);
}

const kept = [];
// A length from a partial track list is an estimate, so only a complete list
// can drop a record for being short; the rest wait for the real album object.
for (const c of survivors) {
    if (c.tracksComplete && c.minutes < MIN_MINUTES) { exclude('under 25 minutes', c.sources); continue; }
    const { proposalKey, ...out } = c;
    // Same source and seed twice (two editions both proposed) is one vote.
    out.sources = out.sources.filter((s, i, all) => all.findIndex((t) => t.source === s.source && t.via === s.via) === i);
    kept.push(out);
}
kept.sort((a, b) => bestScore(b) - bestScore(a) || a.key.localeCompare(b.key));

// Per-source counts are rows, so a record two seeds pointed at counts twice
// for that source; that is the honest measure of how much each one proposed.
for (const r of verifiedRows) counts[r.source].verified += 1;
for (const c of kept) for (const s of c.sources) counts[s.source].kept += 1;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify({
    generated: new Date().toISOString().slice(0, 10),
    profile: { generated: profile.generated ?? null, until: profile.until ?? null },
    candidates: kept,
}, null, 1)}\n`);
saveAll();

log('\nsource          raw  verified  kept');
for (const [source, c] of Object.entries(counts)) {
    log(`${source.padEnd(14)} ${String(c.raw).padStart(5)} ${String(c.verified).padStart(9)} ${String(c.kept).padStart(5)}`);
}
log(`excluded: ${Object.entries(exclusions).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}`);
log(`${kept.length} candidates (${kept.filter((c) => c.tracksComplete).length} with full track lists) -> ${OUT}`);
if (throttledEndpoints().length) log(`throttled by Spotify this run: ${throttledEndpoints().join(', ')}`);
log(`${spotifyCallsMade()} Spotify calls, ${Math.round((Date.now() - started) / 1000)}s`);
