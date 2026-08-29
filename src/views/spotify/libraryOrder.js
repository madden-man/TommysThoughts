// The opposite of shuffle.js: master (ii), put back into the order it was
// collected in.
//
// A playlist's position is not that order. Tracks get dragged about, added in
// batches, re-added after a tidy-up — but every entry carries the moment it was
// added, and that is the record of when the music actually arrived. Sorting on
// it replays the library the way it was built.
//
// A record moves as one thing, placed by its EARLIEST added_at — the day you
// first saved anything off it — and plays start to finish from there. Otherwise
// an album bought a track at a time over two years would be strewn across two
// years of listening, which is not what "in the order I saved it" means to
// anyone. A song with no album stands on its own, at its own moment.

import { albumBlocksOf, flatten } from './shuffle';

// When a block first arrived. `added_at` is ISO-8601 and UTC, so it parses to a
// comparable instant; anything unparseable is treated as absent rather than as
// 1970, which would drag it to the front.
export const firstSavedAt = (block) => {
    const times = (block.tracks ?? [])
        .map((track) => Date.parse(track?.addedAt ?? ''))
        .filter((t) => Number.isFinite(t));
    return times.length ? Math.min(...times) : null;
};

/**
 * The playlist as whole records, in the order they were first saved.
 *
 * Anything carrying no timestamp goes last rather than first — a missing date is
 * not an old one — and holds its playlist order among the others like it.
 */
export const inLibraryOrder = (tracks) => {
    const blocks = albumBlocksOf(tracks).map((block) => ({
        ...block,
        savedAt: firstSavedAt(block),
    }));

    blocks.sort((a, b) => {
        if (a.savedAt === null || b.savedAt === null) {
            // Both undated: leave them as they were. One undated: it goes last.
            if (a.savedAt === b.savedAt) return a.seq - b.seq;
            return a.savedAt === null ? 1 : -1;
        }
        // Two records saved the same day keep their playlist order.
        return a.savedAt - b.savedAt || a.seq - b.seq;
    });

    return flatten(blocks);
};

/**
 * What the ordering found, for the tab to report: how many records it gathered,
 * the span they cover, and how many tracks carried no date and were left at the
 * end. A playlist read before get_playlist asked for `added_at` would have no
 * dates at all, and that should be visible rather than silently producing the
 * playlist's own order back.
 */
export const describeLibraryOrder = (tracks) => {
    const blocks = albumBlocksOf(tracks);
    const dated = blocks
        .map(firstSavedAt)
        .filter((t) => t !== null)
        .sort((a, b) => a - b);
    const undatedTracks = blocks
        .filter((block) => firstSavedAt(block) === null)
        .reduce((n, block) => n + block.tracks.length, 0);

    return {
        tracks: tracks.length,
        records: blocks.filter((b) => b.tracks.length > 1).length,
        blocks: blocks.length,
        undatedTracks,
        from: dated.length ? new Date(dated[0]) : null,
        to: dated.length ? new Date(dated[dated.length - 1]) : null,
    };
};
