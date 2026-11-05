// The pure half of the candidate build: how a proposal is matched to a
// Spotify album, which albums are thrown out, and how rows from several
// sources fold into one candidate. Nothing here touches the network, so the
// rules can be tested against hand-written rows and the builder stays a thin
// loop of fetches around them.

import { baseAlbumName, normalizeName } from '../../src/views/spotify/names.js';

/** Album identity, the contract's `key`. Shared with the profile so heard albums line up. */
export const albumKey = (artist, album) =>
    `${normalizeName(artist)}\u0000${normalizeName(baseAlbumName(album))}`;

// Looser than the key, for one job only: deciding whether a search hit is the
// record that was asked for. A proposal written from memory says "Sigh No
// More" where Spotify says "Sigh No More", but also "Mumford and Sons" where
// Spotify says "Mumford & Sons", and "Ásgeir" where a hand typed "Asgeir".
// Punctuation, accents, "&" and a leading "The" carry no identity here.
export const looseName = (value) => normalizeName(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/^the /, '')
    .replace(/\s+/g, ' ')
    .trim();

const looseAlbum = (album) => looseName(baseAlbumName(album));

/**
 * Whether a Spotify album object is the (artist, album) a source proposed.
 * Album names must agree exactly once loosened; a near miss is a different
 * record more often than a typo (a "Cabin Sessions" beside the studio album),
 * and a wrong album is worse than a lost one. The artist may be any of the
 * album's credited artists, or all of them written as one string.
 */
export const namesAgree = (proposal, spotifyAlbum) => {
    if (!spotifyAlbum) return false;
    if (looseAlbum(proposal.album) !== looseAlbum(spotifyAlbum.name)) return false;
    const want = looseName(proposal.artist);
    const credited = (spotifyAlbum.artists ?? []).map((a) => looseName(a.name));
    return credited.includes(want) || looseName(credited.join(' and ')) === want
        || looseName((spotifyAlbum.artists ?? []).map((a) => a.name).join(' ')) === want;
};

/** The first search hit that agrees with the proposal, preferring a real album over a compilation. */
export const pickMatch = (proposal, items) => {
    const agreeing = (items ?? []).filter((item) => namesAgree(proposal, item));
    return agreeing.find((item) => item.album_type === 'album') ?? agreeing[0] ?? null;
};

// Records that are not records in the sense the page means: a show, a
// sampler, somebody else's covers, a film's score, a commentary track or a
// remix, instrumental or sessions re-take of a record already out. "Live" is
// the hard one, because "Live Through This" and "Long Live" are studio albums;
// it only counts when it is written the way the catalogue marks a concert
// ("(Live)", "- Live", "Live at", "Live!", "Live Versions").
const NOT_A_RECORD = new RegExp([
    '[([]\\s*live\\b',
    '-\\s*live\\b',
    '\\blive (?:at|in|from|on|session|sessions|recording|recordings)\\b',
    '^live$',
    '\\blive versions?\\b',
    '\\blive!',
    '\\bcommentary\\b',
    '\\bremix(?:es|ed)\\b',
    '\\binstrumentals?\\b',
    // A "Sessions" record is a re-recording of one already heard ("The Cabin
    // Sessions", "Spotify Sessions"), so it only counts at the end of a title.
    '\\bsessions?\\s*[)\\]]?\\s*$',
    '\\bsessions?\\b[^)\\]]*[)\\]]',
    '\\bunplugged\\b',
    '\\bconcert\\b',
    'original motion picture',
    '\\bsoundtrack\\b',
    'greatest hits',
    '\\bbest of\\b',
    '\\bthe essential\\b',
    '\\banthology\\b',
    '\\bcollection\\b',
    '\\bkaraoke\\b',
    '\\btribute\\b',
].join('|'), 'i');

/** Whether an album name marks a live set, a compilation, a tribute or a karaoke record. */
export const isNotARecord = (name) => NOT_A_RECORD.test(name ?? '');

export const MIN_TRACKS = 8;
export const MIN_MINUTES = 25;

/** Sets out of the profile's heard block, built once for the whole run. */
export const heardSets = (profile) => ({
    keys: new Set(profile?.heard?.albumKeys ?? []),
    ids: new Set(profile?.heard?.albumIds ?? []),
});

/**
 * Why a verified candidate is dropped, or null to keep it. Order matters only
 * for the counts the builder prints: "heard" first, because an album Tommy
 * already played is not a recommendation however it is shaped.
 */
export const exclusionReason = (candidate, heard, extraKeys = []) => {
    if (heard.ids.has(candidate.albumId)) return 'heard';
    if (heard.keys.has(candidate.key) || extraKeys.some((k) => heard.keys.has(k))) return 'heard';
    if (candidate.albumType !== 'album') return 'not an album';
    if (isNotARecord(candidate.album)) return 'live or compilation';
    if ((candidate.totalTracks ?? 0) < MIN_TRACKS) return 'under 8 tracks';
    if ((candidate.minutes ?? 0) < MIN_MINUTES) return 'under 25 minutes';
    return null;
};

/** The standard edition of a set of spellings: the one with no qualifier, else the shortest name. */
export const preferStandard = (names) => [...names].sort((a, b) => {
    const qa = baseAlbumName(a) !== a.trim();
    const qb = baseAlbumName(b) !== b.trim();
    if (qa !== qb) return qa ? 1 : -1;
    return a.length - b.length;
})[0];

/**
 * Fold candidates that share a key into one. Two deluxe editions, or the same
 * record found by known-artist and by ListenBrainz, become a single card that
 * remembers every source; the album object kept is the standard edition's,
 * since that is the one a person means by the name.
 */
export const mergeCandidates = (candidates) => {
    const byKey = new Map();
    for (const c of candidates) {
        const prior = byKey.get(c.key);
        if (!prior) { byKey.set(c.key, { ...c, sources: [...c.sources] }); continue; }
        const keepNew = preferStandard([prior.album, c.album]) === c.album && prior.album !== c.album;
        const base = keepNew ? { ...c, sources: [...prior.sources] } : prior;
        for (const s of (keepNew ? c.sources : c.sources)) {
            if (!base.sources.some((t) => t.source === s.source && t.via === s.via)) base.sources.push(s);
        }
        byKey.set(c.key, base);
    }
    return [...byKey.values()];
};

/** The best source score a candidate carries, for ordering the output. */
export const bestScore = (candidate) => Math.max(0, ...candidate.sources.map((s) => s.score ?? 0));

/** Copyright text to a label name: "(P) 2019 Republic Records" -> "Republic Records". */
export const labelFromCopyrights = (copyrights) => {
    const row = (copyrights ?? []).find((c) => c.type === 'P') ?? (copyrights ?? [])[0];
    if (!row?.text) return null;
    const label = row.text
        .replace(/^\s*(?:\(?[pc℗©]\)?|℗|©)\s*/i, '')
        .replace(/^\d{4}\s*/, '')
        .replace(/^,\s*/, '')
        .trim();
    return label || null;
};

/** Run `fn` over items with at most `limit` in flight; results in input order. */
export const mapLimit = async (items, limit, fn) => {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next;
            next += 1;
            // eslint-disable-next-line no-await-in-loop
            out[i] = await fn(items[i], i);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
};
