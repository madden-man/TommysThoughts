// Reordering "pre-approved" without breaking up the albums.
//
// Spotify's own shuffle is uniform random, which is why it keeps handing you two
// SZA tracks in a row and then none for twenty minutes. Uniform random does that
// — evenly spaced is not what random looks like. This does the opposite: it
// treats the playlist as a set of blocks and spreads each artist as far apart as
// the playlist allows.
//
// Two rules, in this order:
//
//   1. Tracks from the same album that are ALREADY next to each other stay next
//      to each other, in their existing internal order. A run like that is a
//      deliberate sequence — an album's side, a segue — so it travels as one
//      unit and is never split.
//
//   2. Those units are then dealt out so the same artist comes round as rarely
//      as possible.
//
// Rule 1 is about adjacency in the CURRENT order, not about the album as such.
// Two tracks from one album sitting at opposite ends of the playlist were never
// together, so they are not welded together now — they are two separate blocks
// and rule 2 will push them apart like anything else.

// Blocks are keyed for spacing by the PRIMARY artist of their first track. A
// feature credit doesn't count: a Frank Ocean track featuring someone else is a
// Frank Ocean track, and spacing on the full artist set would let two Frank
// Ocean tracks sit together because their guest lists differ.
export const artistKeyOf = (block) =>
    block.tracks[0]?.artistIds?.[0] ?? block.tracks[0]?.artistNames?.[0] ?? '';

/**
 * The current order -> atomic blocks. A run of consecutive same-album tracks
 * becomes one block; everything else is a block of one.
 */
export const blocksOf = (tracks) => {
    const blocks = [];
    (Array.isArray(tracks) ? tracks : []).forEach((track) => {
        const open = blocks[blocks.length - 1];
        // A missing album id never matches — local files and the odd track with
        // no album shouldn't all weld into one lump because they share a blank.
        const joins = open
            && open.albumId
            && track.albumId
            && open.albumId === track.albumId;
        if (joins) open.tracks.push(track);
        else blocks.push({ albumId: track.albumId ?? null, tracks: [track] });
    });
    return blocks;
};

// A small seeded generator, so a test can assert on an exact order and the page
// can still get a different shuffle every time it asks.
export const seededRandom = (seed) => {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const shuffled = (list, random) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

/**
 * Deal blocks out so the same artist recurs as rarely as the playlist allows.
 *
 * At each slot it takes the artist with the most blocks still waiting, never the
 * artist it just played unless nothing else is left. Taking the biggest pile
 * first is what stops one prolific artist from being squeezed into a solid run
 * at the end — the failure mode of just picking whoever waited longest.
 *
 * When one artist holds more than half the blocks, some adjacency is arithmetic
 * rather than a bug: there are not enough other blocks to separate them.
 */
export const antiClump = (blocks, random = Math.random) => {
    const waiting = new Map();
    blocks.forEach((block) => {
        const key = artistKeyOf(block);
        if (!waiting.has(key)) waiting.set(key, []);
        waiting.get(key).push(block);
    });
    // Shuffled within each artist, so asking twice doesn't give the same answer
    // even though the artist ORDER is decided greedily.
    waiting.forEach((list, key) => waiting.set(key, shuffled(list, random)));

    const out = [];
    const playedAt = new Map();
    let previous = null;

    while (out.length < blocks.length) {
        const live = [...waiting.entries()].filter(([, list]) => list.length);
        // Anyone but whoever just played — unless they're the only one left, in
        // which case the run is unavoidable and the loop still has to finish.
        // Held in a const so the filter closes over this pass's value, not the
        // loop variable everyone else is about to reassign.
        const justPlayed = previous;
        const pool = live.length > 1
            ? live.filter(([key]) => key !== justPlayed)
            : live;
        if (!pool.length) break;   // unreachable, but never spin

        let pick = null;
        let best = -Infinity;
        pool.forEach(([key, list]) => {
            const since = out.length - (playedAt.get(key) ?? -1000);
            // Pile size decides; how long they've waited breaks ties; the last
            // term keeps equal piles from always resolving the same way.
            const score = list.length * 1000 + Math.min(since, 999) + random();
            if (score > best) { best = score; pick = key; }
        });

        out.push(waiting.get(pick).pop());
        playedAt.set(pick, out.length - 1);
        previous = pick;
    }
    return out;
};

/** Blocks back to a flat track list. */
export const flatten = (blocks) => blocks.flatMap((block) => block.tracks);

/**
 * Split the playlist at the given start indices. `pre-approved` runs in four
 * sections of roughly 500, and a section is a place in the playlist rather than
 * a property of its tracks — so it is defined by where it starts, and shuffling
 * never moves a track across a boundary.
 *
 * With no boundaries given this returns the playlist as a single section, which
 * is what makes sections opt-in rather than something every caller pays for.
 */
export const sectionsOf = (tracks, starts = []) => {
    const list = Array.isArray(tracks) ? tracks : [];
    if (!list.length) return [];
    const cuts = [...new Set(starts)]
        .filter((n) => Number.isInteger(n) && n > 0 && n < list.length)
        .sort((a, b) => a - b);
    const edges = [0, ...cuts, list.length];
    return edges.slice(0, -1).map((from, i) => list.slice(from, edges[i + 1]));
};

/**
 * Split on divider tracks, keeping each divider as a part of its own.
 *
 * Sections are marked in the playlist itself rather than recorded as index
 * ranges somewhere else, which means they survive you adding songs: the seams
 * are wherever the dividers currently sit, recomputed on every run. The price is
 * that a divider must never move — see `shuffleKeepingAlbums`.
 */
export const partsOf = (tracks, isDivider) => {
    const parts = [];
    let open = null;
    (Array.isArray(tracks) ? tracks : []).forEach((track) => {
        if (isDivider(track)) {
            parts.push({ divider: track });
            open = null;
            return;
        }
        if (!open) { open = { tracks: [] }; parts.push(open); }
        open.tracks.push(track);
    });
    return parts;
};

/**
 * Build a divider test from configuration: an explicit list of track URIs, a
 * pattern matched against the track name, or both.
 */
export const dividerMatcher = ({ uris = [], namePattern = null } = {}) => {
    const pinned = new Set(uris);
    const pattern = namePattern ? new RegExp(namePattern, 'i') : null;
    return (track) => pinned.has(track?.uri)
        || (!!pattern && pattern.test(track?.name ?? ''));
};

// The four seasons of "pre-approved". Each of these songs opens its season, so
// it is pinned where it is and the rest of that season shuffles beneath it —
// the divider is the first thing you hear when the season turns.
//
// Listed in the order they run in the playlist, which is not calendar order.
// `artist` is only given where the title alone might catch something else; a
// two-thousand track playlist can easily hold a second song called Doomsday, and
// the page reports what actually matched so an over-match is visible before
// anything is written.
export const SEASONS = [
    { season: 'Summer', title: 'Casita' },
    { season: 'Fall', title: 'Doomsday' },
    { season: 'Spring', title: 'Analie', artist: 'Stolen Gin' },
    { season: 'Winter', title: "Don't Panic" },
];

// Apostrophes are the trap here: "Don't Panic" comes back from Spotify with a
// typographic apostrophe as often as a straight one, and the two are different
// strings. Folding them makes the match survive either.
const norm = (value) => (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'");

/** The season this track opens, or null if it opens none. */
export const seasonOf = (track) => SEASONS.find((entry) =>
    norm(track?.name) === norm(entry.title)
    && (!entry.artist
        || (track?.artistNames ?? []).some((a) => norm(a) === norm(entry.artist))),
) ?? null;

export const isSeasonDivider = (track) => seasonOf(track) !== null;

/**
 * The playlist as labelled seasons: each one led by the song that names it, with
 * the tracks that follow it up to the next divider.
 *
 * Anything sitting before the first divider becomes a section with no season —
 * it is still shuffled, it just has nothing naming it.
 */
export const seasonSectionsOf = (tracks, isDivider = isSeasonDivider) => {
    const out = [];
    let open = { season: null, divider: null, tracks: [] };
    (Array.isArray(tracks) ? tracks : []).forEach((track) => {
        if (isDivider(track)) {
            if (open.divider || open.tracks.length) out.push(open);
            open = { season: seasonOf(track)?.season ?? null, divider: track, tracks: [] };
            return;
        }
        open.tracks.push(track);
    });
    if (open.divider || open.tracks.length) out.push(open);
    return out;
};

/**
 * The whole thing: current order in, new order out.
 * Same tracks, every album run intact, artists spread, sections untouched.
 *
 * Each section is shuffled entirely within itself, so a track never leaves the
 * section it started in. Because a section keeps its exact length, every divider
 * lands back on the index it already occupied — which is what stops the seams
 * from dissolving the first time you shuffle.
 *
 * An album run that straddles a boundary is split by it: the two halves are in
 * different sections, and a section outranks an album run.
 *
 * Sections come from dividers when `isDivider` is given, and from explicit
 * `sectionStarts` otherwise — the index form is the fallback for when the
 * playlist has no markers to read.
 */
export const shuffleKeepingAlbums = (
    tracks,
    random = Math.random,
    { isDivider = null, sectionStarts = [] } = {},
) => {
    const shuffle = (list) => flatten(antiClump(blocksOf(list), random));
    if (isDivider) {
        return partsOf(tracks, isDivider)
            .flatMap((part) => (part.divider ? [part.divider] : shuffle(part.tracks)));
    }
    return sectionsOf(tracks, sectionStarts).flatMap(shuffle);
};

const reportFor = (tracks) => {
    const blocks = blocksOf(tracks);
    const runs = blocks.filter((b) => b.tracks.length > 1);
    const gaps = [];
    const seenAt = new Map();
    blocks.forEach((block, i) => {
        const key = artistKeyOf(block);
        if (seenAt.has(key)) gaps.push(i - seenAt.get(key));
        seenAt.set(key, i);
    });
    return {
        tracks: tracks.length,
        blocks: blocks.length,
        albumRuns: runs.length,
        longestRun: runs.reduce((n, b) => Math.max(n, b.tracks.length), 0),
        // The worst case is what you actually notice, so report that rather
        // than an average that a single bad pair disappears into.
        closestArtistRepeat: gaps.length ? Math.min(...gaps) : null,
        adjacentArtistRepeats: gaps.filter((g) => g === 1).length,
    };
};

/**
 * What the reorder actually achieved, for the page to report rather than just
 * claiming it worked: how many album runs were protected, and how close
 * together the same artist still lands.
 *
 * Measured per section and then totalled, because that is how the shuffle
 * works — an artist either side of a boundary was never a repeat to fix.
 */
export const describeOrder = (tracks, { sectionStarts = [] } = {}) => {
    const sections = sectionsOf(tracks, sectionStarts).map(reportFor);
    if (sections.length <= 1) return sections[0] ?? reportFor([]);

    const closest = sections
        .map((s) => s.closestArtistRepeat)
        .filter((n) => n !== null);
    const sum = (pick) => sections.reduce((n, s) => n + pick(s), 0);
    return {
        tracks: sum((s) => s.tracks),
        blocks: sum((s) => s.blocks),
        albumRuns: sum((s) => s.albumRuns),
        longestRun: sections.reduce((n, s) => Math.max(n, s.longestRun), 0),
        closestArtistRepeat: closest.length ? Math.min(...closest) : null,
        adjacentArtistRepeats: sum((s) => s.adjacentArtistRepeats),
        sections,
    };
};
