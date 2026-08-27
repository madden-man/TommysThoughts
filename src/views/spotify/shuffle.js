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

// Genre comes from the primary artist's most representative Spotify tag. Blocks
// with no genre data get an empty string and all land in the same group, which
// falls back to plain artist-spreading.
export const genreKeyOf = (block) => block.tracks[0]?.genre ?? '';

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
        // `seq` is where this block sat before anything moved — the fallback
        // running order for an album whose tracks carry no track numbers.
        else blocks.push({ albumId: track.albumId ?? null, seq: blocks.length, tracks: [track] });
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

// Where a track sits on its own record: disc first, then track. Null when it
// carries no numbering, which is the case for a local file and for anything read
// before get_playlist started asking for those fields.
const trackRank = (track) => {
    if (!Number.isFinite(track?.trackNumber)) return null;
    const disc = Number.isFinite(track.discNumber) ? track.discNumber : 1;
    return disc * 1000 + track.trackNumber;
};

const albumRank = (block) => trackRank(block.tracks[0]);

// Sorting an album's own tracks. Returning 0 for anything unnumbered leans on
// sort being stable, which keeps those in the order they already had rather
// than inventing one.
const byAlbumOrder = (a, b) => {
    const left = trackRank(a);
    const right = trackRank(b);
    return left !== null && right !== null ? left - right : 0;
};

/**
 * Every track on its own, welded to nothing.
 *
 * `blocksOf` protects same-album tracks that are already adjacent, which is
 * right for a playlist curated song by song — a run like that was sequenced on
 * purpose. It is wrong for a playlist built by adding whole records at a time:
 * there, every album is adjacent to begin with, so welding turns the whole
 * playlist into one block per album and "shuffle tracks" quietly becomes
 * "shuffle albums". This is the mode for those.
 *
 * An album still plays in album order across the section — orderWithinAlbums
 * sees to that — it just is not held together while doing it.
 */
export const singleBlocksOf = (tracks) =>
    (Array.isArray(tracks) ? tracks : []).map((track, i) => ({
        albumId: track.albumId ?? null,
        seq: i,
        tracks: [track],
    }));

/**
 * The playlist as whole albums: every track of a record in one block, in album
 * order, however scattered they were to begin with.
 *
 * The alternative to `blocksOf`, which only welds tracks that were already
 * adjacent. Here a record is the atomic thing and it plays start to finish.
 *
 * Grouping is per section by construction — this only ever sees one season at a
 * time — so an album with tracks in two seasons stays as two groups, one in
 * each. Gathering those into one would move tracks across a boundary, and a
 * season outranks a record.
 */
export const albumBlocksOf = (tracks) => {
    const open = new Map();
    const blocks = [];
    (Array.isArray(tracks) ? tracks : []).forEach((track) => {
        const id = track.albumId;
        // No album id means nothing to group on — it stands alone.
        if (!id) {
            blocks.push({ albumId: null, seq: blocks.length, tracks: [track] });
            return;
        }
        if (!open.has(id)) {
            const block = { albumId: id, seq: blocks.length, tracks: [] };
            open.set(id, block);
            blocks.push(block);
        }
        open.get(id).tracks.push(track);
    });
    blocks.forEach((block) => {
        if (block.tracks.length > 1) block.tracks.sort(byAlbumOrder);
    });
    return blocks;
};

/**
 * Put each album's scattered blocks back into album order.
 *
 * Welding only protects tracks that were already adjacent; the rest of a record
 * gets broken up and spread across the season. This makes that break-up
 * survivable: an album still unfolds in its own sequence as the season plays,
 * you just hear other things in between.
 *
 * It permutes blocks ONLY among the slots that album already occupies, so the
 * spacing decided above is untouched — every slot keeps a block by the same
 * artist, so nothing it does can create a new adjacent repeat. That is also why
 * it runs last: whatever `separateNeighbours` rearranged, this still gets the
 * final say on the order within a record.
 *
 * "Where possible" is doing real work in the ordering: an album whose tracks
 * carry no numbering falls back to the order the blocks were in to begin with.
 */
export const orderWithinAlbums = (list) => {
    const slots = new Map();
    list.forEach((block, i) => {
        if (!block.albumId) return;
        if (!slots.has(block.albumId)) slots.set(block.albumId, []);
        slots.get(block.albumId).push(i);
    });

    slots.forEach((indices) => {
        if (indices.length < 2) return;
        const inOrder = indices.map((i) => list[i]).sort((a, b) => {
            const left = albumRank(a);
            const right = albumRank(b);
            if (left !== null && right !== null) return left - right;
            return (a.seq ?? 0) - (b.seq ?? 0);
        });
        // `indices` is ascending, so the earliest slot takes the earliest track.
        indices.forEach((at, k) => { list[at] = inOrder[k]; });
    });
    return list;
};

// Once everything is placed, an artist can still land beside themselves where
// two strides happen to collide. This walks the result and swaps the second of
// any such pair with a nearby block that fits in both places — a local repair,
// so it costs almost nothing and barely disturbs the spacing.
const separateNeighbours = (list) => {
    const keyAt = (i) => (i >= 0 && i < list.length ? artistKeyOf(list[i]) : null);
    const REACH = 12;

    for (let i = 1; i < list.length; i++) {
        if (keyAt(i) !== keyAt(i - 1)) continue;
        const mine = keyAt(i);

        for (let step = 2; step <= REACH; step++) {
            let swapped = false;
            for (const j of [i + step, i - step]) {
                if (j < 0 || j >= list.length) continue;
                const theirs = keyAt(j);
                // The incoming block must not clash with i's neighbours...
                if (theirs === mine || theirs === keyAt(i - 1) || theirs === keyAt(i + 1)) continue;
                // ...and mine must not clash with the neighbours it moves next to.
                if ((j - 1 !== i && keyAt(j - 1) === mine)
                    || (j + 1 !== i && keyAt(j + 1) === mine)) continue;
                [list[i], list[j]] = [list[j], list[i]];
                swapped = true;
                break;
            }
            if (swapped) break;
        }
    }
    return list;
};

// The placement step of artist-spreading: assigns each block a fractional
// position using the stride formula, sorts by it, and returns the ordered list.
// Finishing passes (separateNeighbours, orderWithinAlbums) are the caller's job
// so that genre interleaving can do a single pass over the full result.
//
// Placing by stride rather than by greed is the point. An earlier version scored
// candidates by how many blocks they had left, which is a sort by artist
// frequency wearing a shuffle's clothes: the two biggest artists ping-ponged
// across the opening — Ed Sheeran, Quinn XCII, Ed Sheeran, Quinn XCII — while
// every artist with a single block scored lowest and was stranded in the last
// fifth of the season. Spacing is a property of the whole section, so it has to
// be decided for the whole section at once rather than one slot at a time.
const placeByArtist = (blocks, random) => {
    const byArtist = new Map();
    blocks.forEach((block) => {
        const key = artistKeyOf(block);
        if (!byArtist.has(key)) byArtist.set(key, []);
        byArtist.get(key).push(block);
    });

    const total = blocks.length;
    const wanted = [];
    byArtist.forEach((list) => {
        // Which of an artist's blocks takes which slot is itself shuffled, so the
        // spacing is stable but the running order inside it is not.
        const order = shuffled(list, random);
        const stride = total / order.length;
        const phase = random();
        order.forEach((block, j) => wanted.push({ block, at: (j + phase) * stride }));
    });

    wanted.sort((a, b) => a.at - b.at);
    return wanted.map((w) => w.block);
};

/**
 * Spread the blocks so each artist recurs as rarely as the section allows.
 *
 * Every artist is dealt across the WHOLE section rather than picked one slot at
 * a time: an artist holding `k` of the `n` blocks wants one every `n / k`, so
 * their blocks ask for positions `(j + u) * n / k` under a single random phase
 * `u`, and everything is then sorted by the position it asked for.
 *
 * The phase is per artist and random, so the same playlist comes out differently
 * every run while each artist stays evenly spread.
 *
 * When one artist holds more than half the blocks, some adjacency is arithmetic
 * rather than a bug: there are not enough other blocks to separate them.
 */
export const antiClump = (blocks, random = Math.random) => {
    if (blocks.length <= 1) return [...blocks];
    return orderWithinAlbums(separateNeighbours(placeByArtist(blocks, random)));
};

// Genre-aware version of antiClump. Groups blocks by genre, spreads artists
// within each genre group independently, then interleaves the groups round-robin
// so each genre recurs in multiple short runs across the section rather than
// sitting in one lump. When all blocks share the same genre (or carry none),
// this falls back to plain antiClump so the behaviour is unchanged.
//
// The finishing passes run once on the full interleaved result rather than per
// group, so separateNeighbours can repair any genre-boundary collisions.
const antiClumpWithGenres = (blocks, random) => {
    if (blocks.length <= 1) return [...blocks];

    const byGenre = new Map();
    blocks.forEach((block) => {
        const key = genreKeyOf(block);
        if (!byGenre.has(key)) byGenre.set(key, []);
        byGenre.get(key).push(block);
    });

    if (byGenre.size <= 1) return antiClump(blocks, random);

    // Randomise the genre cycle so the leading genre changes each run.
    const genreLists = shuffled([...byGenre.values()], random)
        .map((genreBlocks) => placeByArtist(genreBlocks, random));

    // Round-robin in chunks so genre sections are long enough to be audible.
    // One block at a time switches genre every 1-3 tracks — indistinguishable
    // from random. A chunk of ~10 blocks produces sections of roughly 20-30
    // tracks, which is perceptible as a genre run.
    const GENRE_CHUNK = 10;
    const result = [];
    const indices = genreLists.map(() => 0);
    while (genreLists.some((list, g) => indices[g] < list.length)) {
        for (let g = 0; g < genreLists.length; g++) {
            const end = Math.min(indices[g] + GENRE_CHUNK, genreLists[g].length);
            while (indices[g] < end) result.push(genreLists[g][indices[g]++]);
        }
    }

    return orderWithinAlbums(separateNeighbours(result));
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

// The year as it actually turns. Note this is NOT the order the seasons sit in
// the playlist, where Spring is filed third — the playlist is a filing order and
// this is a calendar, so the shuffle reorders to match the calendar.
export const SEASON_CYCLE = ['Summer', 'Fall', 'Winter', 'Spring'];

// Equinoxes and solstices wander a day or two from year to year — the September
// equinox lands anywhere from the 21st to the 24th. These are the usual dates
// rather than the computed ones: being a day out decides which season leads a
// playlist on one day of the year, which is not worth an astronomical almanac.
export const SEASON_STARTS = [
    { season: 'Winter', month: 12, day: 21 },
    { season: 'Fall', month: 9, day: 22 },
    { season: 'Summer', month: 6, day: 21 },
    { season: 'Spring', month: 3, day: 20 },
];

/** Which season a date falls in, north of the equator. */
export const seasonOn = (date = new Date()) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const reached = ({ month: m, day: d }) => month > m || (month === m && day >= d);
    // January through to the March equinox is the tail of the previous winter,
    // which is the one stretch no start date in this year has been reached for.
    return (SEASON_STARTS.find(reached) ?? { season: 'Winter' }).season;
};

/**
 * The four seasons in calendar order, beginning with the one given — so once the
 * fall equinox comes round the playlist opens on Fall and runs Fall, Winter,
 * Spring, Summer.
 */
export const seasonsFrom = (season) => {
    const at = SEASON_CYCLE.indexOf(season);
    return at < 0
        ? [...SEASON_CYCLE]
        : [...SEASON_CYCLE.slice(at), ...SEASON_CYCLE.slice(0, at)];
};

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
 * The generic form of `seasonSectionsOf`: split a playlist into labelled sections
 * using markers the user set in the view rather than the four hard-coded seasons.
 *
 * A marker is `{ uri, label }` — the track that opens a section, and the name of
 * the section it opens. Sections follow the order the marker tracks sit in the
 * playlist, not the order they were added, because the split walks the playlist.
 * Anything before the first marker becomes a section with no label, exactly as an
 * unnamed pre-first-divider run does for the seasons.
 */
export const markerSectionsOf = (tracks, markers = []) => {
    const labelByUri = new Map((markers ?? []).map((m) => [m.uri, m.label]));
    const out = [];
    let open = { label: null, divider: null, tracks: [] };
    (Array.isArray(tracks) ? tracks : []).forEach((track) => {
        if (labelByUri.has(track?.uri)) {
            if (open.divider || open.tracks.length) out.push(open);
            open = { label: labelByUri.get(track.uri) || track.name, divider: track, tracks: [] };
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
    {
        isDivider = null, sectionStarts = [], wholeAlbums = false, leadWith = null,
        weldAdjacent = true,
    } = {},
) => {
    // The two modes differ only in what counts as one indivisible thing: a run
    // of tracks that were already adjacent, or an entire record. Everything
    // after that — spacing the artists, pinning the dividers, sealing the
    // seasons — is the same either way.
    // Three ways to decide what cannot be split: a whole record, a run that was
    // already adjacent, or nothing at all.
    const toBlocks = wholeAlbums
        ? albumBlocksOf
        : (weldAdjacent ? blocksOf : singleBlocksOf);
    const shuffle = (list) => flatten(antiClumpWithGenres(toBlocks(list), random));

    if (isDivider && leadWith) {
        // Whole seasons move here, so the dividers do NOT stay on the indices
        // they held — that guarantee is about a season keeping its own tracks,
        // and each still opens its own season wherever that season now sits.
        const wanted = seasonsFrom(leadWith);
        const rank = (section) => wanted.indexOf(section.season);
        return [...seasonSectionsOf(tracks, isDivider)]
            // A stretch before the first divider belongs to no season and leads,
            // rather than being shuffled in among ones that do. Sort is stable,
            // so several of them keep their order relative to each other.
            .sort((a, b) => rank(a) - rank(b))
            .flatMap((section) => [
                ...(section.divider ? [section.divider] : []),
                ...shuffle(section.tracks),
            ]);
    }

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
