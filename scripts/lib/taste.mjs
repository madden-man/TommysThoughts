// The pure half of build-taste-profile.mjs: reducing plays to albums, matching
// them to master (ii), scoring and judging them. Nothing here touches the
// network or the disk, so the test file can run it on tiny fixtures and the
// backtest can call it with a different cutoff.
//
// The scoring formula and every threshold are documented in the header of
// build-taste-profile.mjs, next to where they are tuned; the constants below
// are the same numbers.

import { normalizeName, baseAlbumName } from '../../src/views/spotify/names.js';

/** The album identity every script shares (see SPOTIFY-RECS-CONTRACTS.md). */
export const albumKey = (artist, album) =>
    `${normalizeName(artist)}\u0000${normalizeName(baseAlbumName(album))}`;

export const DAY = 24 * 60 * 60 * 1000;
export const MONTHS_24 = 730 * DAY;

/**
 * Keeps the plays on or before `until` (a YYYY-MM-DD date, the whole day
 * included). Comparing the date prefix of `ts` avoids any timezone guesswork:
 * the export writes UTC and so does the cutoff.
 */
export const withinUntil = (ts, until) => !until || (ts ?? '').slice(0, 10) <= until;

// A play that ended because Tommy pressed next within half a minute. The
// export's own `skipped` flag is false on nearly every row (it was only filled
// in on some clients), so `reason_end` carries the signal, and the time limit
// keeps "skipped the outro of a song heard through" from counting.
const SKIP_MS = 30 * 1000;
export const isSkip = (row) => row.skipped === true
    || (row.reason_end === 'fwdbtn' && (row.ms_played ?? 0) < SKIP_MS);

/**
 * Plays to one row per album key. Returns { albums: Map, plays, skippedRows,
 * from, to }. Each album keeps its raw spellings with counts (to report the
 * most-played one), its track names (distinct tracks are counted by name, not
 * URI, because a record re-released under new URIs is still one record), its
 * track URIs with play counts (to resolve a sample later), years, play dates
 * and milliseconds by month (so "recent" can be measured from the export's end
 * once that end is known).
 */
export const reducePlays = (rows, { until = null } = {}) => {
    const albums = new Map();
    let plays = 0;
    let skippedRows = 0;
    let from = null;
    let to = null;

    for (const row of rows) {
        const artist = row.master_metadata_album_artist_name;
        const album = row.master_metadata_album_album_name;
        const ts = row.ts;
        // A podcast, an audiobook, or a play Spotify has no metadata for.
        if (!artist || !album || !ts) { skippedRows += 1; continue; }
        if (!withinUntil(ts, until)) continue;
        plays += 1;
        const day = ts.slice(0, 10);
        if (!from || day < from) from = day;
        if (!to || day > to) to = day;

        const key = albumKey(artist, album);
        let a = albums.get(key);
        if (!a) {
            a = {
                key, spellings: new Map(), trackNames: new Set(), uris: new Map(), trackMs: new Map(),
                years: new Set(), msByMonth: new Map(),
                plays: 0, ms: 0, skips: 0, firstPlayed: day, lastPlayed: day,
            };
            albums.set(key, a);
        }
        const spelling = `${artist}\u0000${album}`;
        a.spellings.set(spelling, (a.spellings.get(spelling) ?? 0) + 1);
        const ms = row.ms_played ?? 0;
        if (row.master_metadata_track_name) {
            const track = normalizeName(row.master_metadata_track_name);
            a.trackNames.add(track);
            // A play that ran to the end is the track's length; the longest such
            // play stands in for the duration Spotify will not hand over today.
            if (row.reason_end === 'trackdone' && ms > (a.trackMs.get(track) ?? 0)) a.trackMs.set(track, ms);
        }
        if (row.spotify_track_uri) a.uris.set(row.spotify_track_uri, (a.uris.get(row.spotify_track_uri) ?? 0) + 1);
        a.years.add(Number(day.slice(0, 4)));
        const month = day.slice(0, 7);
        a.msByMonth.set(month, (a.msByMonth.get(month) ?? 0) + ms);
        a.plays += 1;
        a.ms += ms;
        if (isSkip(row)) a.skips += 1;
        if (day < a.firstPlayed) a.firstPlayed = day;
        if (day > a.lastPlayed) a.lastPlayed = day;
    }
    return { albums, plays, skippedRows, from, to };
};

/**
 * An album's length in minutes from the history alone, or null. Only answerable
 * for a record heard through: every one of its tracks must have a play that ran
 * to the end, and the longest `totalTracks` of those are summed.
 */
export const minutesFromPlays = (trackMs, totalTracks) => {
    if (!totalTracks || trackMs.size < totalTracks) return null;
    const longest = [...trackMs.values()].sort((x, y) => y - x).slice(0, totalTracks);
    return longest.reduce((s, x) => s + x, 0) / 60000;
};

/** The spelling heard most often, as [artist, album]. Ties go to the first seen. */
export const topSpelling = (spellings) => {
    let best = null;
    let bestCount = -1;
    for (const [s, n] of spellings) if (n > bestCount) { best = s; bestCount = n; }
    return (best ?? '\u0000').split('\u0000');
};

/** Milliseconds played in the 24 months up to `refDay`. */
export const recentMs = (msByMonth, refDay) => {
    const since = new Date(Date.parse(refDay) - MONTHS_24).toISOString().slice(0, 7);
    let total = 0;
    for (const [month, ms] of msByMonth) if (month >= since) total += ms;
    return total;
};

/**
 * master (ii) as records. A track is filed under every one of its artists
 * against the album's base name, the same way libraryOrder.js lets a featured
 * artist still find the record. Returns { byKey, byId }:
 *   byKey: key -> { albumIds: Set, trackNames: Set, tracksById: Map, totalById: Map, artistIdByName: Map }
 *   byId:  albumId -> key (the key of the record's first artist)
 */
export const indexMaster = (tracks) => {
    const byKey = new Map();
    const byId = new Map();
    for (const t of tracks) {
        if (!t.albumName) continue;
        const names = t.artistNames ?? [];
        names.forEach((artistName, i) => {
            const key = albumKey(artistName, t.albumName);
            let rec = byKey.get(key);
            if (!rec) {
                rec = { albumIds: new Set(), trackNames: new Set(), tracksById: new Map(), totalById: new Map(), artistIdByName: new Map() };
                byKey.set(key, rec);
            }
            if (t.albumId) {
                rec.albumIds.add(t.albumId);
                rec.tracksById.set(t.albumId, (rec.tracksById.get(t.albumId) ?? 0) + 1);
                if (t.albumTotalTracks) rec.totalById.set(t.albumId, t.albumTotalTracks);
                if (i === 0 && !byId.has(t.albumId)) byId.set(t.albumId, key);
            }
            rec.trackNames.add(normalizeName(t.name));
            (t.artistNames ?? []).forEach((n, j) => {
                if (t.artistIds?.[j]) rec.artistIdByName.set(normalizeName(n), t.artistIds[j]);
            });
        });
    }
    return { byKey, byId };
};

/**
 * A looser name match for the editions baseAlbumName leaves alone, such as
 * "x - Wembley Edition" or "Hunter Hayes (Encore)": the history's album name
 * starts with a master album name by the same artist and what follows opens
 * with a dash, bracket or colon. The longest such master name wins, so "Vol. 2"
 * does not fall back to "Vol". Returns the master key or null.
 */
export const editionMatch = (key, masterKeys) => {
    const [artist, album] = key.split('\u0000');
    let best = null;
    for (const mk of masterKeys) {
        const [mArtist, mAlbum] = mk.split('\u0000');
        if (mArtist !== artist || !mAlbum || mAlbum.length >= album.length) continue;
        if (!album.startsWith(mAlbum) || !/^\s*[-([:]/.test(album.slice(mAlbum.length))) continue;
        if (!best || mAlbum.length > best.split('\u0000')[1].length) best = mk;
    }
    return best;
};

/**
 * How much of a record master holds. The track count is the copy master
 * holds most of: a deluxe and a standard copy both in master should be judged
 * against the one actually kept.
 */
export const masterFacts = (rec) => {
    let bestId = null;
    let bestCount = -1;
    for (const [id, n] of rec.tracksById) if (n > bestCount) { bestId = id; bestCount = n; }
    const totalTracks = bestId ? rec.totalById.get(bestId) ?? null : null;
    const masterTracks = rec.trackNames.size;
    const masterShare = totalTracks ? Math.min(1, masterTracks / totalTracks) : null;
    return { totalTracks, masterTracks, masterShare };
};

// ---- scoring ---------------------------------------------------------------

export const W = { kept: 0.35, depth: 0.35, longevity: 0.2, recency: 0.1 };
export const HOURS_FULL = 40;        // hours at which hours-depth saturates
export const YEARS_FULL = 6;         // distinct years at which longevity saturates
export const RECENCY_YEARS = 3;      // e-folding time of the recency term
export const SKIP_PENALTY = 0.3;     // a record skipped every time loses 30%
export const UNKNOWN_TOTAL = 10;     // assumed track count when none is known

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** Coverage: distinct tracks heard over the record's length, capped at 1. */
export const coverageOf = ({ distinctTracks, totalTracks }) =>
    clamp01(distinctTracks / (totalTracks || UNKNOWN_TOTAL));

export const depthOf = ({ hours, distinctTracks, totalTracks }) => {
    const h = clamp01(Math.log1p(hours) / Math.log1p(HOURS_FULL));
    return 0.6 * h + 0.4 * coverageOf({ distinctTracks, totalTracks });
};

export const longevityOf = (yearCount) => clamp01((yearCount - 1) / (YEARS_FULL - 1));

export const keptOf = ({ inMaster, masterShare }) =>
    (inMaster ? 0.5 + 0.5 * (masterShare ?? 0) : 0);

export const recencyOf = (lastPlayed, refDay) => {
    const years = Math.max(0, (Date.parse(refDay) - Date.parse(lastPlayed)) / (365 * DAY));
    return Math.exp(-years / RECENCY_YEARS);
};

/** One album's score in 0..1. `a` carries the album row's own fields. */
export const scoreAlbum = (a, refDay) => {
    const raw = W.kept * keptOf(a)
        + W.depth * depthOf(a)
        + W.longevity * longevityOf(a.years.length)
        + W.recency * recencyOf(a.lastPlayed, refDay);
    return clamp01(raw * (1 - SKIP_PENALTY * (a.skipRate ?? 0)));
};

// Verdict thresholds.
export const LOVED_SHARE = 0.6;      // master holds 60%+ of the record
export const LOVED_MIN_HOURS = 2;    // and it was actually played, not just filed
export const LOVED_DEPTH = 0.75;     // or, in master or not: deep...
export const LOVED_YEARS = 4;        // ...and across four or more years
export const DROPPED_MINUTES = 20;
export const DROPPED_TRACKS = 5;
export const LIKED_HOURS = 3;        // solid listening, not in master and not gone quiet
export const LIKED_TRACKS = 5;

/**
 * loved | liked | dropped | sampled. Order matters: a record kept whole is
 * loved however little it was played lately, and "dropped" is only reachable
 * outside master. A record whose master membership is unknowable (null, under
 * --until) is never dropped, since it may yet have been kept.
 */
export const verdictOf = (a, refDay) => {
    if (a.inMaster && (a.masterShare ?? 0) >= LOVED_SHARE && a.hours >= LOVED_MIN_HOURS) return 'loved';
    if (depthOf(a) >= LOVED_DEPTH && a.years.length >= LOVED_YEARS) return 'loved';
    const quiet = Date.parse(refDay) - Date.parse(a.lastPlayed) > MONTHS_24;
    if (a.inMaster === false && a.hours * 60 >= DROPPED_MINUTES && a.distinctTracks >= DROPPED_TRACKS && quiet) return 'dropped';
    if (a.inMaster) return 'liked';
    if (a.hours >= LIKED_HOURS && a.distinctTracks >= LIKED_TRACKS) return 'liked';
    return 'sampled';
};

/**
 * Master membership as the profile may know it. Under --until a record first
 * played after the cutoff could not have been kept by then, so its membership
 * is unknown rather than false.
 */
export const membershipUnder = (match, firstPlayed, until) => {
    if (until && firstPlayed > until) return { inMaster: null, masterTracks: null, masterShare: null };
    if (!match) return { inMaster: false, masterTracks: 0, masterShare: null };
    return { inMaster: true, masterTracks: match.masterTracks, masterShare: match.masterShare };
};

// ---- artists, genres, shape -------------------------------------------------

export const ARTIST_HOURS_FULL = 100;

/**
 * Artists from albums. An artist's score leans on their best record (one great
 * album is a real yes), then on total time, then on the balance of loved to
 * dropped records, so an artist with three dropped albums and one hit reads as
 * a mixed case rather than a favourite.
 */
export const aggregateArtists = (albums) => {
    const by = new Map();
    for (const a of albums) {
        const name = normalizeName(a.artist);
        let r = by.get(name);
        if (!r) {
            r = { name: a.artist, spellings: new Map(), artistIds: new Set(), hours: 0, best: 0, loved: 0, liked: 0, dropped: 0 };
            by.set(name, r);
        }
        r.spellings.set(a.artist, (r.spellings.get(a.artist) ?? 0) + a.plays);
        (a.artistIds ?? []).slice(0, 1).forEach((id) => id && r.artistIds.add(id));
        r.hours += a.hours;
        r.best = Math.max(r.best, a.score);
        if (a.verdict === 'loved') r.loved += 1;
        if (a.verdict === 'liked') r.liked += 1;
        if (a.verdict === 'dropped') r.dropped += 1;
    }
    return [...by.values()].map((r) => {
        const judged = r.loved + r.liked + r.dropped;
        const balance = judged ? (r.loved + 0.5 * r.liked - r.dropped) / judged : 0;
        const hoursS = clamp01(Math.log1p(r.hours) / Math.log1p(ARTIST_HOURS_FULL));
        const score = clamp01(0.55 * r.best + 0.3 * hoursS + 0.15 * balance);
        const name = [...r.spellings].sort((x, y) => y[1] - x[1])[0][0];
        return {
            name, artistIds: [...r.artistIds], score, hours: r.hours,
            lovedAlbums: r.loved, droppedAlbums: r.dropped, genres: [],
        };
    }).sort((x, y) => y.score - x.score || y.hours - x.hours);
};

/**
 * Genre weights: each album's hours split evenly over its artist's genres,
 * normalised to sum to 1. recentWeight is the same over the last 24 months
 * only, normalised on its own, so "who Tommy is now" can be compared to the
 * whole twelve years.
 */
export const genreWeights = (albums, genresByArtistName) => {
    const all = new Map();
    const recent = new Map();
    for (const a of albums) {
        const genres = genresByArtistName.get(normalizeName(a.artist)) ?? [];
        if (!genres.length) continue;
        for (const g of genres) {
            all.set(g, (all.get(g) ?? 0) + a.hours / genres.length);
            recent.set(g, (recent.get(g) ?? 0) + (a.recentHours ?? 0) / genres.length);
        }
    }
    const sum = (m) => [...m.values()].reduce((s, x) => s + x, 0) || 1;
    const sa = sum(all);
    const sr = sum(recent);
    return [...all.keys()]
        .map((genre) => ({ genre, weight: all.get(genre) / sa, recentWeight: (recent.get(genre) ?? 0) / sr }))
        .sort((x, y) => y.weight - x.weight);
};

const median = (xs) => {
    const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!s.length) return null;
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * What a kept record looks like, from the loved and liked albums. A "full
 * album" here is one heard at 80% coverage or more; it is the closest the
 * export gets to "listens to records, not singles".
 */
export const shapeOf = (albums, minutesByKey = new Map()) => {
    const kept = albums.filter((a) => a.verdict === 'loved' || a.verdict === 'liked');
    const withTotal = kept.filter((a) => a.totalTracks);
    return {
        medianTracks: median(withTotal.map((a) => a.totalTracks)),
        medianMinutes: median(kept.map((a) => minutesByKey.get(a.key))),
        fullAlbumShare: withTotal.length
            ? withTotal.filter((a) => coverageOf(a) >= 0.8).length / withTotal.length
            : null,
    };
};

// MusicBrainz tags are folksonomy: genres, but also places, decades and
// "seen live". These are the non-genres that show up among Tommy's artists.
const NOT_GENRE = /^(seen live|favorites?|male vocalists?|female vocalists?|american|british|english|canadian|australian|irish|scottish|swedish|icelandic|norwegian|german|french|usa|uk|us|\d{2,4}s?|singer|vocalist|composer|producer|musician|band)$/i;

/**
 * Up to four genres from a MusicBrainz tag list. Where any tag has two or more
 * votes the single-vote tags are noise and are dropped; an artist with only
 * single votes keeps its first three.
 */
export const genresFromTags = (tags = []) => {
    const usable = (tags ?? []).filter((t) => t?.name && !NOT_GENRE.test(t.name.trim()))
        .sort((x, y) => (y.count ?? 0) - (x.count ?? 0));
    const strong = usable.filter((t) => (t.count ?? 0) >= 2);
    return (strong.length ? strong : usable.slice(0, 3)).slice(0, 4).map((t) => t.name.toLowerCase());
};

/** Rounds to `d` decimals, for a smaller file. */
export const round = (x, d = 2) => (x == null ? x : Math.round(x * 10 ** d) / 10 ** d);
