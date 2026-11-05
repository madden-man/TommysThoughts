// How well an album fits the taste profile. One function for two callers: the
// "ranked" tab in the browser (ordering a queue playlist by what is most likely
// to land) and scripts/rank-recommendations.mjs in Node (ordering outside
// candidates). Both must agree, so the scoring lives here once, with no
// imports beyond names.js so Node can load it straight from src/.
//
// The profile is public/spotify-taste.json (docs/SPOTIFY-RECS-CONTRACTS.md,
// section 1). An album to score is a plain object:
//
//   { artist, album, artistIds, albumId, genre, genres, totalTracks, minutes,
//     year, sourceScore }
//
// artist/album are display names; artistIds and albumId are Spotify ids when
// known; genre is the artist's first Spotify genre as get_playlist attaches it
// to tracks, and genres (optional) the artist's whole list, as the ranker
// script looks them up; sourceScore (0..1, optional) is how strongly the
// candidate sources vouched for it, which a queue playlist does not have and
// leaves undefined.
//
// Weights are tuned by scripts/backtest.mjs and stored in
// docs/spotify-recommendations-weights.json; DEFAULT_WEIGHTS is the fallback
// and the starting point.

import { baseAlbumName, normalizeName } from './names.js';

export const DEFAULT_WEIGHTS = {
    artistAffinity: 0.35,
    genreAffinity: 0.25,
    // How often records in the album's genres were kept rather than dropped.
    genreKeep: 0,
    shape: 0.1,
    source: 0.3,
    // Subtracted, not added: a record Tommy already gave a fair hearing and
    // walked away from, or an artist with more misses than hits.
    droppedPenalty: 0.4,
    artistMissPenalty: 0.15,
};

// Judged rows a genre needs before its own keep rate outweighs the overall
// one; below that it is shrunk toward the overall rate.
const KEEP_PRIOR = 4;

/** The album key used everywhere: artist and album, normalised, edition stripped. */
export const albumKeyOf = (artist, album) =>
    `${normalizeName(artist)}\u0000${normalizeName(baseAlbumName(album))}`;

const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/**
 * Lookups built once from a profile, because a queue is a thousand albums and
 * every one of them wants the same maps.
 */
export const profileIndex = (profile) => {
    const artistById = new Map();
    const artistByName = new Map();
    (profile?.artists ?? []).forEach((a) => {
        (a.artistIds ?? []).forEach((id) => artistById.set(id, a));
        artistByName.set(normalizeName(a.name), a);
    });

    const albumByKey = new Map();
    const albumById = new Map();
    (profile?.albums ?? []).forEach((a) => {
        albumByKey.set(a.key, a);
        (a.albumIds ?? []).forEach((id) => albumById.set(id, a));
    });

    const genreWeight = new Map();
    let maxGenre = 0;
    (profile?.genres ?? []).forEach((g) => {
        // Half what the whole history says, half the last two years: the
        // queue is for who Tommy is now, but twelve years is not nothing.
        const w = ((g.weight ?? 0) + (g.recentWeight ?? g.weight ?? 0)) / 2;
        genreWeight.set(normalizeName(g.genre), w);
        if (w > maxGenre) maxGenre = w;
    });

    // Keep rate per genre, from the judged records only (loved and liked
    // against dropped), so it reads the same from the trimmed public profile
    // and the backtest's full one. Genres are the artist's, from the profile.
    const genresByArtist = new Map();
    (profile?.artists ?? []).forEach((a) => {
        if (a.genres?.length) genresByArtist.set(normalizeName(a.name), a.genres.map(normalizeName));
    });
    const keepCounts = new Map();
    let kept = 0;
    let judged = 0;
    (profile?.albums ?? []).forEach((a) => {
        if (!['loved', 'liked', 'dropped'].includes(a.verdict)) return;
        const isKept = a.verdict !== 'dropped';
        judged += 1;
        if (isKept) kept += 1;
        (genresByArtist.get(normalizeName(a.artist)) ?? []).forEach((g) => {
            const c = keepCounts.get(g) ?? { kept: 0, judged: 0 };
            c.judged += 1;
            if (isKept) c.kept += 1;
            keepCounts.set(g, c);
        });
    });
    const keepRate = judged ? kept / judged : 0.5;
    const genreKeep = new Map([...keepCounts].map(([g, c]) => [
        g, (c.kept + KEEP_PRIOR * keepRate) / (c.judged + KEEP_PRIOR),
    ]));

    const heardKeys = new Set(profile?.heard?.albumKeys ?? []);
    const heardIds = new Set(profile?.heard?.albumIds ?? []);

    return {
        artistById,
        artistByName,
        albumByKey,
        albumById,
        genreWeight,
        maxGenre,
        genreKeep,
        keepRate,
        heardKeys,
        heardIds,
        shape: profile?.shape ?? { medianTracks: 12, medianMinutes: 44 },
    };
};

// The primary artist is the first id, or the display name; a featured artist
// further down the list counts, but at half strength, so a guest verse by
// someone Tommy loves does not make a stranger's record look like theirs.
const artistFor = (index, album) => {
    const ids = album.artistIds ?? [];
    const primary = (ids[0] && index.artistById.get(ids[0]))
        || index.artistByName.get(normalizeName(album.artist))
        || null;
    if (primary) return { artist: primary, strength: 1 };
    for (const id of ids.slice(1)) {
        const hit = index.artistById.get(id);
        if (hit) return { artist: hit, strength: 0.5 };
    }
    return { artist: null, strength: 0 };
};

const heardAlbumFor = (index, album, key) =>
    (album.albumId && index.albumById.get(album.albumId))
    || index.albumByKey.get(key)
    || null;

// How close the record's length is to the shape Tommy keeps. Anything from
// eight to twenty tracks scores well; a two-track single or a forty-track
// box set does not, however good the artist.
const shapeScore = (album, shape) => {
    const n = album.totalTracks ?? 0;
    if (!n) return 0.5;
    if (n < 5) return 0;
    if (n > 30) return 0.2;
    const median = shape.medianTracks || 12;
    const distance = Math.abs(n - median) / median;
    return clamp01(1 - distance / 2);
};

/**
 * Score one album against the profile. Returns
 *   { score, tier, parts, reasons }
 * where tier is one of 'unheard' | 'sampled' | 'liked' | 'loved' | 'dropped'
 * (what the history already says about this exact record), parts are the
 * weighted components for the preview, and reasons are short phrases a card or
 * a preview line can show ("you kept all of Vide Noir", "indie folk is a
 * fifth of your listening").
 */
export const scoreAlbum = (album, index, weights = DEFAULT_WEIGHTS) => {
    const w = { ...DEFAULT_WEIGHTS, ...(weights ?? {}) };
    const key = albumKeyOf(album.artist, album.album);
    const reasons = [];

    const { artist, strength } = artistFor(index, album);
    const artistAffinity = clamp01((artist?.score ?? 0) * strength);
    if (artist && artistAffinity > 0.3) {
        reasons.push(artist.lovedAlbums > 0
            ? `you kept ${artist.lovedAlbums} ${artist.lovedAlbums === 1 ? 'record' : 'records'} by ${artist.name}`
            : `you have played ${artist.name} for ${Math.round(artist.hours ?? 0)} hours`);
    }

    // The album's best-weighted genre counts: a record tagged "indie folk,
    // americana" is an indie folk record to someone who plays indie folk.
    const genres = (album.genres?.length ? album.genres : [album.genre]).filter(Boolean);
    let genreAffinity = 0;
    let topGenre = null;
    if (index.maxGenre > 0) {
        genres.forEach((g) => {
            const a = clamp01((index.genreWeight.get(normalizeName(g)) ?? 0) / index.maxGenre);
            if (a > genreAffinity) { genreAffinity = a; topGenre = g; }
        });
    }
    if (genreAffinity > 0.5 && topGenre) reasons.push(`${topGenre} is near the top of your listening`);

    // Mean keep rate over the album's genres; no genre reads as the overall rate.
    const rates = genres.map((g) => index.genreKeep.get(normalizeName(g))).filter((x) => x !== undefined);
    const genreKeep = rates.length ? rates.reduce((sum, x) => sum + x, 0) / rates.length : index.keepRate;

    const shape = shapeScore(album, index.shape);

    // A queue playlist has no candidate sources vouching for it, so the source
    // weight leaves the scale entirely rather than capping every album at 70%.
    const hasSource = album.sourceScore !== undefined && album.sourceScore !== null;
    const sourceScore = hasSource ? clamp01(album.sourceScore) : 0;

    const heard = heardAlbumFor(index, album, key);
    const heardAnywhere = Boolean(heard)
        || index.heardKeys.has(key)
        || (album.albumId && index.heardIds.has(album.albumId));
    let tier = 'unheard';
    if (heard?.verdict) tier = heard.verdict;
    else if (heardAnywhere) tier = 'sampled';

    let penalty = 0;
    if (tier === 'dropped') {
        penalty += w.droppedPenalty;
        reasons.push(`you gave this ${Math.round(heard.hours ?? 0)} hours and let it go`);
    }
    if (artist && (artist.droppedAlbums ?? 0) > (artist.lovedAlbums ?? 0)) {
        penalty += w.artistMissPenalty;
        reasons.push(`${artist.name} has more misses than keeps with you`);
    }
    if (tier === 'loved' || tier === 'liked') {
        reasons.push(tier === 'loved' ? 'already one of yours' : 'you already know this one');
    }

    const parts = {
        artist: w.artistAffinity * artistAffinity,
        genre: w.genreAffinity * genreAffinity,
        genreKeep: (w.genreKeep ?? 0) * genreKeep,
        shape: w.shape * shape,
        source: w.source * sourceScore,
        penalty: -penalty,
    };
    const positive = w.artistAffinity + w.genreAffinity + (w.genreKeep ?? 0) + w.shape
        + (hasSource ? w.source : 0);
    const score = clamp01(
        (parts.artist + parts.genre + parts.genreKeep + parts.shape + parts.source) / (positive || 1)
        - penalty,
    );

    return { score, tier, parts, reasons, key };
};

// Where each tier sits in a queue: the point of a queue is what is unheard,
// so those lead by score. A sampled record (played briefly, never continued)
// comes next, as its own tier rather than with a penalty: in the backtest
// (docs/spotify-recommendations-backtest.md) records sampled before the
// cutoff and tried again after it were kept about one time in twelve, against
// one in three for records tried for the first time, a gap no fit score
// closes. Records already kept are known quantities and go after; records
// given a fair hearing and dropped go last.
export const TIER_ORDER = { unheard: 0, sampled: 1, liked: 2, loved: 2, dropped: 3 };

/**
 * Rank a list of albums: unheard records by score, then sampled ones, then
 * the ones already kept, then the dropped. Returns the same objects with
 * `fit` attached ({ score, tier, parts, reasons }), best first; stable for
 * ties so a caller's existing order is the tiebreaker.
 */
export const rankAlbums = (albums, profile, weights = DEFAULT_WEIGHTS) => {
    const index = profileIndex(profile);
    return albums
        .map((album, i) => ({ ...album, fit: scoreAlbum(album, index, weights), i }))
        .sort((a, b) => (TIER_ORDER[a.fit.tier] - TIER_ORDER[b.fit.tier])
            || (b.fit.score - a.fit.score)
            || (a.i - b.i))
        .map(({ i, ...rest }) => rest);
};

/**
 * An album block from shuffle.js's albumBlocksOf, as something scoreAlbum can
 * read: display names from the first track, genre from the track get_playlist
 * enriched, track count from the block (the playlist's copy, which is what
 * would be written out).
 */
export const albumOfBlock = (block) => {
    const first = block.tracks[0] ?? {};
    return {
        artist: first.artistNames?.[0] ?? '',
        album: first.albumName ?? '',
        artistIds: first.artistIds ?? [],
        albumId: block.albumId ?? null,
        genre: first.genre ?? '',
        totalTracks: block.tracks.length,
    };
};
