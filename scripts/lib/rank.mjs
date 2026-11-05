// The pure half of scripts/rank-recommendations.mjs: how a candidate's sources
// become one source score, how feedback filters and penalises, how the twenty
// are spread across artists, and how the one-sentence why is written. No
// network, no disk, so rank.test.mjs can run it on hand-made rows. The fit
// score itself is fit.js's, never computed here.

import { baseAlbumName, normalizeName } from '../../src/views/spotify/names.js';

/** What a "not for me" costs every other record by that artist, off a 0..1 fit score. */
export const NOT_FOR_ME_PENALTY = 0.2;
export const MAX_PER_ARTIST = 2;

/**
 * One source score per candidate: the weighted max over its sources, so a
 * record two seeds pointed at is not counted twice, and a source weighted 0
 * contributes nothing however sure it was.
 */
export const sourceScoreOf = (candidate, sourceWeights = {}) => {
    let best = 0;
    let bestSource = null;
    for (const s of candidate.sources ?? []) {
        const v = (sourceWeights[s.source] ?? 0) * Math.max(0, Math.min(1, s.score ?? 0));
        if (v > best) { best = v; bestSource = s; }
    }
    return { score: best, source: bestSource };
};

/**
 * Feedback rows ({ albumId, artist, verdict }) as what the ranker needs:
 * album ids to leave out (heard, not for me) and artists who lose score.
 * A saved album stays: the tab shows it marked as saved (contract section 4).
 */
export const feedbackSets = (rows = []) => {
    const excludeIds = new Set();
    const notForMeArtists = new Set();
    for (const r of rows) {
        if (!r?.albumId) continue;
        if (r.verdict === 'heard' || r.verdict === 'not-for-me') excludeIds.add(r.albumId);
        if (r.verdict === 'not-for-me' && r.artist) notForMeArtists.add(normalizeName(r.artist));
    }
    return { excludeIds, notForMeArtists };
};

/** Whether a candidate's artist has a "not for me" against them. */
export const artistTurnedDown = (candidate, notForMeArtists) =>
    notForMeArtists.has(normalizeName(candidate.artist));

/**
 * The first `count` of an already ranked list with no more than `perArtist`
 * records by one artist, in rank order. An artist is the candidate's first
 * artist id, else its normalised name.
 */
export const spread = (ranked, count, perArtist = MAX_PER_ARTIST) => {
    const seen = new Map();
    const out = [];
    for (const c of ranked) {
        if (out.length >= count) break;
        const who = c.artistIds?.[0] ?? normalizeName(c.artist);
        const n = seen.get(who) ?? 0;
        if (n >= perArtist) continue;
        seen.set(who, n + 1);
        out.push(c);
    }
    return out;
};

/**
 * The record behind an edition name, for the case baseAlbumName leaves alone:
 * a qualifier in the middle of the title ("eternal sunshine deluxe: brighter
 * days ahead"). The album name is cut at the first ":" or " deluxe" or " (",
 * then normalised; with the artist it names the record.
 */
export const editionStem = (candidate) => {
    const name = normalizeName(candidate.album ?? '');
    const cut = name.search(/:| deluxe\b| \(| \[/);
    const stem = (cut > 0 ? name.slice(0, cut) : name).trim();
    return `${normalizeName(candidate.artist ?? '')}\u0000${stem}`;
};

/**
 * The edition stems of everything the profile has heard, so a mid-title
 * edition of a record Tommy already played ("x deluxe: more") is not offered
 * as new. Heard keys are already normalised, so only the cut is applied.
 */
export const heardStems = (profile) => new Set((profile?.heard?.albumKeys ?? []).map((k) => {
    const [artist, album = ''] = k.split('\u0000');
    return editionStem({ artist, album });
}));

/**
 * One candidate per record: editions by the same artist that share a stem
 * fold into the standard one (the name that is the stem itself, else the
 * shortest name), and its sources gain the others' sources.
 */
export const dedupeEditions = (candidates) => {
    const groups = new Map();
    for (const c of candidates) {
        const k = editionStem(c);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(c);
    }
    const out = [];
    for (const [k, group] of groups) {
        if (group.length === 1) { out.push(group[0]); continue; }
        const stem = k.split('\u0000')[1];
        const standard = group.find((c) => normalizeName(c.album) === stem)
            ?? [...group].sort((a, b) => a.album.length - b.album.length)[0];
        const sources = group.flatMap((c) => c.sources ?? [])
            .filter((s, i, all) => all.findIndex((t) => t.source === s.source && t.via === s.via) === i);
        out.push({ ...standard, sources, editions: group.length });
    }
    return out;
};

// What the candidate build's live and compilation rule lets through but the
// page should not offer: a dated live set ("Live 2003"), a DJ mix, a remix
// record, a commentary or instrumental edition.
const NOT_FOR_THE_PAGE = /\blive (?:\d{4}|19\d\d|20\d\d)\b|\bdj mix\b|\bremix(?:es|ed)?\b|\bcommentary\b|\binstrumentals?\b|\bacoustic sessions?\b/i;
export const notForThePage = (candidate) => NOT_FOR_THE_PAGE.test(candidate.album ?? '');

/** A seed album's name as a reader would say it: no edition, no " - EP". */
export const plainAlbumName = (name) => baseAlbumName(String(name ?? ''))
    .replace(/\s+-\s+(?:EP|Single)$/i, '')
    .replace(/\s+-\s+.*(?:Edition|Experience|Version|Remaster(?:ed)?)$/i, '')
    .trim();

/** No em or en dashes in anything generated for the page. */
export const noDashes = (text) => String(text ?? '')
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .trim();

const list = (names) => {
    if (names.length <= 1) return names.join('');
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/** A profile's loved albums by artist (normalised name), best first. */
export const lovedByArtist = (profile) => {
    const by = new Map();
    for (const a of profile?.albums ?? []) {
        if (a.verdict !== 'loved') continue;
        const k = normalizeName(a.artist);
        if (!by.has(k)) by.set(k, []);
        by.get(k).push(a);
    }
    for (const rows of by.values()) rows.sort((x, y) => (y.score ?? 0) - (x.score ?? 0));
    return by;
};

const SOURCE_NAMES = {
    'known-artist': 'known artist',
    listenbrainz: 'ListenBrainz',
    lastfm: 'Last.fm',
    claude: 'Claude',
};
export const sourceLabel = (source) => SOURCE_NAMES[source] ?? source;

/**
 * One sentence of why, from the evidence: the strongest source (and, where
 * it names a seed artist, that artist's loved records by name), then the fit
 * score's first reason. `lovedBy` is lovedByArtist(profile).
 */
export const whyOf = (candidate, fit, lovedBy, sourceWeights = {}) => {
    const { source } = sourceScoreOf(candidate, sourceWeights);
    const top = source ?? (candidate.sources ?? [])[0] ?? null;
    const clauses = [];
    if (top) {
        const via = top.via && top.via !== 'claude' ? top.via : null;
        // Two different records by name: editions of one record count once.
        const seeds = via ? [...new Map((lovedBy.get(normalizeName(via)) ?? [])
            .map((a) => plainAlbumName(a.album))
            .map((n) => [normalizeName(n), n])).values()].slice(0, 2) : [];
        if (top.source === 'known-artist') {
            clauses.push(seeds.length
                ? `It is ${candidate.artist}, whose ${list(seeds)} you kept`
                : `It is a ${candidate.artist} record you have not played`);
        } else if (top.source === 'claude') {
            clauses.push(noDashes(top.note).replace(/[.\s]+$/, ''));
        } else if (via) {
            clauses.push(seeds.length
                ? `${sourceLabel(top.source)} puts ${candidate.artist} beside ${via}, whose ${list(seeds)} you kept`
                : `${sourceLabel(top.source)} puts ${candidate.artist} beside ${via}, an artist you play`);
        }
    }
    // The fit's first reason that is not already said by the source clause.
    const reason = (fit?.reasons ?? []).find((r) => !(top?.source === 'known-artist' && r.includes(candidate.artist)));
    if (reason) clauses.push(reason);
    if (!clauses.length) clauses.push('It fits the shape of the records you keep');
    let sentence = clauses.join('; ');
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    return noDashes(`${sentence.replace(/[.\s]+$/, '')}.`);
};

/** The page's row for one ranked candidate (contract section 3). */
export const outputRow = (candidate, score, why, sourceWeights = {}) => ({
    albumId: candidate.albumId,
    uri: `spotify:album:${candidate.albumId}`,
    artist: candidate.artist,
    album: candidate.album,
    artistIds: candidate.artistIds ?? [],
    year: candidate.year ?? null,
    totalTracks: candidate.totalTracks ?? null,
    minutes: candidate.minutes ?? null,
    image: candidate.image ?? null,
    score: Math.round(score * 1000) / 1000,
    why,
    // Strongest first, each source once, and only the ones that counted.
    sources: [...new Set((candidate.sources ?? [])
        .filter((s) => (sourceWeights[s.source] ?? 0) > 0)
        .sort((a, b) => (sourceWeights[b.source] ?? 0) * (b.score ?? 0) - (sourceWeights[a.source] ?? 0) * (a.score ?? 0))
        .map((s) => s.source))],
    // Null until the candidate build has the whole list: Save writes exactly
    // these, and the tab disables it on a card that has none.
    trackUris: candidate.tracksComplete !== false && candidate.trackUris?.length ? candidate.trackUris : null,
    tracksComplete: candidate.tracksComplete !== false && Boolean(candidate.trackUris?.length),
});
