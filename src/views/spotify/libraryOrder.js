// The opposite of shuffle.js: master (ii), put back into the order it was
// collected in.
//
// The obvious date to sort on is the playlist entry's own `added_at`, and it is
// the wrong one — it records when a track was added to THAT PLAYLIST, so a master
// assembled in bulk dates almost entirely to the afternoon it was assembled. What
// is wanted is when the music arrived, and the only record of that is the
// listening history: the Extended Streaming History export, reduced by
// scripts/import-streaming-history.mjs to one date per record — the first time
// anything off it was ever played.
//
// A record moves as one thing, placed at that date, and plays start to finish
// from there. Otherwise an album collected a track at a time over two years would
// be strewn across two years of listening, which is not what "in the order I
// found it" means to anyone.
//
// Matching is by artist and album NAME rather than by track URI, which is the
// only key the two sides reliably share: a record is re-released, remastered and
// re-issued under new URIs, and the copy sitting in a playlist is often not the
// copy that was streamed.

import { albumBlocksOf, flatten } from './shuffle';

// Curly apostrophes are the usual trap — Spotify writes "Don't" both ways and the
// two are different strings. NFKC folds the width and accent variants.
const CURLY = /[‘’ʼ]/g;

/** One spelling of a name, so the two sides can be compared at all. */
export const normalizeName = (value) => (value ?? '')
    .normalize('NFKC')
    .replace(CURLY, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// A trailing edition or remaster qualifier, which the catalogue spells a dozen
// ways: "(Deluxe Edition)", "[Explicit]", "- 2011 Remaster". Stripping it lets a
// deluxe copy sitting in a playlist find the standard copy that was streamed.
const QUALIFIER = new RegExp(
    '\\s*(?:[([][^)\\]]*'
    + '(?:deluxe|edition|remaster|version|expanded|anniversary|explicit|bonus|reissue|mono|stereo)'
    + '[^)\\]]*[)\\]]'
    // The dash form carries the qualifier anywhere in the tail — "- 2011
    // Remaster", "- Deluxe" — so the keyword is looked for across it rather than
    // straight after the dash. It still has to BE there: "Live - Paris" stays.
    + '|-\\s*[^-]*(?:deluxe|remaster|expanded|anniversary|bonus|reissue)[^-]*)$',
    'i',
);

/** An album name with its edition qualifiers taken off, however many it carries. */
export const baseAlbumName = (album) => {
    let out = (album ?? '').trim();
    for (let prev = null; prev !== out;) {
        prev = out;
        out = out.replace(QUALIFIER, '').trim();
    }
    // Never strip a name down to nothing — an album really called "(Remastered)"
    // keeps its name rather than becoming a key that matches everything.
    return out || (album ?? '').trim();
};

const keyFor = (artist, album) => `${normalizeName(artist)}\t${normalizeName(album)}`;

/**
 * The lookup the tab sorts by, built from public/spotify-first-played.json.
 *
 * Normalising happens HERE rather than in the importer, so there is exactly one
 * copy of these rules; the file on disk holds the names exactly as Spotify wrote
 * them. Two spellings that normalise together keep the earlier date, which is the
 * whole question being asked.
 *
 * Base-album keys go in alongside the full ones. They are only consulted when the
 * full name misses, so a real "(Deluxe Edition)" entry still answers for itself.
 */
export const firstPlayedIndex = (data) => {
    const index = new Map();
    const keep = (key, at) => {
        const found = index.get(key);
        if (found === undefined || at < found) index.set(key, at);
    };

    (data?.albums ?? []).forEach((row) => {
        const [artist, album, date] = row ?? [];
        const at = Date.parse(date);
        if (!Number.isFinite(at)) return;
        keep(keyFor(artist, album), at);
        const base = baseAlbumName(album);
        if (base !== album) keep(keyFor(artist, base), at);
    });
    return index;
};

// Every name a record might be filed under: each of its artists, against the
// album as written and with its qualifiers stripped. A track credited to the
// feature rather than to the album artist still finds its record this way.
const candidateKeys = (block) => {
    const albums = new Set();
    const artists = new Set();
    (block.tracks ?? []).forEach((track) => {
        if (track?.albumName) {
            albums.add(track.albumName);
            albums.add(baseAlbumName(track.albumName));
        }
        (track?.artistNames ?? []).forEach((name) => { if (name) artists.add(name); });
    });

    const keys = [];
    artists.forEach((artist) => albums.forEach((album) => keys.push(keyFor(artist, album))));
    return keys;
};

/**
 * When this record first reached the collection, or null if the history has
 * nothing on it — a record last played before the export begins, or one whose
 * name in the playlist matches nothing that was ever streamed.
 */
export const firstPlayedAt = (block, index) => {
    let earliest = null;
    candidateKeys(block).forEach((key) => {
        const at = index.get(key);
        if (at !== undefined && (earliest === null || at < earliest)) earliest = at;
    });
    return earliest;
};

/**
 * When this record was added to the playlist: the earliest `added_at` it holds.
 * The fallback rather than the rule — see `placeOf`.
 */
export const addedToPlaylistAt = (block) => {
    const times = (block.tracks ?? [])
        .map((track) => Date.parse(track?.addedAt ?? ''))
        .filter((t) => Number.isFinite(t));
    return times.length ? Math.min(...times) : null;
};

/**
 * Where a record sits, and on what authority.
 *
 * The streaming history is the better answer and is used wherever it has one.
 * Where it does not — a record played before the export window, or one whose
 * name the two sides spell differently — the playlist's own `added_at` stands in.
 * That is a weaker signal, since a playlist assembled in bulk dates a lot of
 * music to one afternoon, but it is a real date on the same timeline and it puts
 * the record somewhere defensible instead of in a heap at the end.
 *
 * Both are compared as plain instants, so the two sources interleave rather than
 * forming two blocks.
 */
export const placeOf = (block, index) => {
    const played = firstPlayedAt(block, index);
    if (played !== null) return { at: played, source: 'history' };
    const added = addedToPlaylistAt(block);
    if (added !== null) return { at: added, source: 'playlist' };
    return { at: null, source: null };
};

/**
 * The playlist as whole records, in the order they reached the collection.
 *
 * Anything neither source can date — no listening history and no `added_at` —
 * goes last rather than first, since an unknown date is not an early one, and
 * holds its playlist order among the others like it.
 */
export const placedBlocks = (tracks, index = new Map()) => {
    const blocks = albumBlocksOf(tracks).map((block) => ({
        ...block,
        ...placeOf(block, index),
    }));

    blocks.sort((a, b) => {
        if (a.at === null || b.at === null) {
            // Both undated: leave them as they were. One undated: it goes last.
            if (a.at === b.at) return a.seq - b.seq;
            return a.at === null ? 1 : -1;
        }
        // Two records dated to the same moment keep their playlist order.
        return a.at - b.at || a.seq - b.seq;
    });

    return blocks;
};

export const inLibraryOrder = (tracks, index = new Map()) =>
    flatten(placedBlocks(tracks, index));

/**
 * What the ordering found, for the tab to report rather than just claiming it
 * worked: how many records the history could date, the span they cover, and how
 * much fell through to the undated tail. Coverage is the number worth watching —
 * a name-matched join is only as good as the two sides agreeing, and a bad run
 * should be visible rather than quietly producing a plausible order.
 */
export const describeLibraryOrder = (tracks, index = new Map()) => {
    const blocks = albumBlocksOf(tracks);
    const dated = [];
    const tracksBySource = { history: 0, playlist: 0, none: 0 };
    const blocksBySource = { history: 0, playlist: 0, none: 0 };

    blocks.forEach((block) => {
        const { at, source } = placeOf(block, index);
        const bucket = source ?? 'none';
        blocksBySource[bucket] += 1;
        tracksBySource[bucket] += block.tracks.length;
        if (at !== null) dated.push(at);
    });
    dated.sort((a, b) => a - b);

    return {
        tracks: tracks.length,
        blocks: blocks.length,
        records: blocks.filter((b) => b.tracks.length > 1).length,
        // Split by which source placed them, because they are not equally good:
        // the history says when you found the music, the playlist only says when
        // this list was built. A run leaning on the fallback is worth seeing.
        blocksBySource,
        tracksBySource,
        from: dated.length ? new Date(dated[0]) : null,
        to: dated.length ? new Date(dated[dated.length - 1]) : null,
    };
};
