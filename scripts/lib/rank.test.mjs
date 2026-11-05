// The ranker's pure parts: `node --test scripts/lib/*.test.mjs`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    editionStem, dedupeEditions, heardStems, notForThePage, plainAlbumName, sourceScoreOf, feedbackSets, artistTurnedDown, spread, noDashes, lovedByArtist, whyOf, outputRow,
} from './rank.mjs';

const W = { 'known-artist': 1, listenbrainz: 0.5, lastfm: 0, claude: 0.25 };

test('sourceScoreOf is the weighted max, not a sum', () => {
    const c = { sources: [
        { source: 'listenbrainz', score: 0.8, via: 'Lord Huron' },
        { source: 'listenbrainz', score: 0.6, via: 'The Oh Hellos' },
        { source: 'known-artist', score: 0.3 },
    ] };
    const { score, source } = sourceScoreOf(c, W);
    assert.equal(score, 0.4);
    assert.equal(source.via, 'Lord Huron');
});

test('sourceScoreOf gives nothing for a source weighted 0 or missing', () => {
    assert.equal(sourceScoreOf({ sources: [{ source: 'lastfm', score: 1 }] }, W).score, 0);
    assert.equal(sourceScoreOf({ sources: [{ source: 'mystery', score: 1 }] }, W).score, 0);
    assert.equal(sourceScoreOf({}, W).score, 0);
});

test('feedbackSets leaves out heard and not-for-me, keeps saved, and marks not-for-me artists', () => {
    const { excludeIds, notForMeArtists } = feedbackSets([
        { albumId: 'a', artist: 'X', verdict: 'heard' },
        { albumId: 'b', artist: 'The Band', verdict: 'not-for-me' },
        { albumId: 'c', artist: 'Y', verdict: 'saved' },
        { verdict: 'heard' },
    ]);
    assert.deepEqual([...excludeIds].sort(), ['a', 'b']);
    assert.ok(artistTurnedDown({ artist: 'the band' }, notForMeArtists));
    assert.ok(!artistTurnedDown({ artist: 'Y' }, notForMeArtists));
});

test('spread keeps rank order and at most two per artist', () => {
    const ranked = [
        { albumId: '1', artist: 'A', artistIds: ['a'] },
        { albumId: '2', artist: 'A', artistIds: ['a'] },
        { albumId: '3', artist: 'A', artistIds: ['a'] },
        { albumId: '4', artist: 'B' },
        { albumId: '5', artist: 'b' },
        { albumId: '6', artist: 'B' },
        { albumId: '7', artist: 'C' },
    ];
    assert.deepEqual(spread(ranked, 5).map((c) => c.albumId), ['1', '2', '4', '5', '7']);
    assert.deepEqual(spread(ranked, 2).map((c) => c.albumId), ['1', '2']);
    assert.deepEqual(spread(ranked, 9, 1).map((c) => c.albumId), ['1', '4', '7']);
});

test('noDashes turns em and en dashes into commas', () => {
    assert.equal(noDashes('a \u2014 b'), 'a, b');
    assert.equal(noDashes('a\u2013b'), 'a, b');
    assert.equal(noDashes('plain - hyphen'), 'plain - hyphen');
});

const PROFILE = { albums: [
    { artist: 'Lord Huron', album: 'Strange Trails', verdict: 'loved', score: 0.98 },
    { artist: 'Lord Huron', album: 'Vide Noir', verdict: 'loved', score: 0.99 },
    { artist: 'Lord Huron', album: 'Lonesome Dreams', verdict: 'loved', score: 0.97 },
    { artist: 'Lord Huron', album: 'Long Lost', verdict: 'liked', score: 0.7 },
] };

test('lovedByArtist lists loved records best first', () => {
    const by = lovedByArtist(PROFILE);
    assert.deepEqual(by.get('lord huron').map((a) => a.album), ['Vide Noir', 'Strange Trails', 'Lonesome Dreams']);
});

test('whyOf names the seed artist\'s loved records for a similar-artist source', () => {
    const c = { artist: 'The Brook & The Bluff', sources: [{ source: 'listenbrainz', score: 0.9, via: 'Lord Huron' }] };
    const why = whyOf(c, { reasons: ['indie folk is near the top of your listening'] }, lovedByArtist(PROFILE), W);
    assert.equal(why, 'ListenBrainz puts The Brook & The Bluff beside Lord Huron, whose Vide Noir and Strange Trails you kept; indie folk is near the top of your listening.');
});

test('whyOf for a known artist does not repeat the artist reason', () => {
    const c = { artist: 'Lord Huron', sources: [{ source: 'known-artist', score: 0.9, via: 'Lord Huron' }] };
    const why = whyOf(c, { reasons: ['you kept 3 records by Lord Huron'] }, lovedByArtist(PROFILE), W);
    assert.equal(why, 'It is Lord Huron, whose Vide Noir and Strange Trails you kept.');
});

test('whyOf uses a Claude note and never lets a dash through', () => {
    const c = { artist: 'Typhoon', sources: [{ source: 'claude', score: 1, via: 'claude', note: 'Horns and a choir \u2014 Illinois in one record.' }] };
    const why = whyOf(c, { reasons: [] }, new Map(), W);
    assert.equal(why, 'Horns and a choir, Illinois in one record.');
    assert.ok(!/[\u2014\u2013]/.test(why));
});

test('whyOf falls back to a plain line with no evidence', () => {
    assert.equal(whyOf({ artist: 'X', sources: [] }, { reasons: [] }, new Map(), W), 'It fits the shape of the records you keep.');
});

test('outputRow carries the contract fields and only the sources that counted', () => {
    const row = outputRow({
        albumId: 'abc', artist: 'A', album: 'B', artistIds: ['x'], year: 2019, totalTracks: 11, minutes: 41,
        image: 'i', trackUris: ['spotify:track:1'],
        sources: [{ source: 'lastfm', score: 1 }, { source: 'claude', score: 1 }, { source: 'known-artist', score: 0.5 }],
    }, 0.81234, 'Why.', W);
    assert.equal(row.uri, 'spotify:album:abc');
    assert.equal(row.score, 0.812);
    assert.deepEqual(row.sources, ['known-artist', 'claude']);
    assert.deepEqual(row.trackUris, ['spotify:track:1']);
    assert.equal(row.tracksComplete, true);
});

test('outputRow writes null track uris for an incomplete list', () => {
    const partial = outputRow({ albumId: 'p', artist: 'A', album: 'B', trackUris: ['spotify:track:1'], tracksComplete: false, sources: [] }, 0.5, 'Why.', W);
    assert.equal(partial.trackUris, null);
    assert.equal(partial.tracksComplete, false);
    const none = outputRow({ albumId: 'n', artist: 'A', album: 'B', trackUris: null, sources: [] }, 0.5, 'Why.', W);
    assert.equal(none.trackUris, null);
    assert.equal(none.tracksComplete, false);
});

test('editionStem cuts a mid-title qualifier', () => {
    assert.equal(editionStem({ artist: 'Ariana Grande', album: 'eternal sunshine deluxe: brighter days ahead' }),
        editionStem({ artist: 'Ariana Grande', album: 'eternal sunshine' }));
    assert.equal(editionStem({ artist: 'Hozier', album: 'Unreal Unearth: Unending' }),
        editionStem({ artist: 'Hozier', album: 'Unreal Unearth' }));
    assert.notEqual(editionStem({ artist: 'A', album: 'Deluxe' }), editionStem({ artist: 'A', album: 'Other' }));
});

test('dedupeEditions keeps the standard edition and pools the sources', () => {
    const out = dedupeEditions([
        { albumId: 'd', artist: 'Ariana Grande', album: 'eternal sunshine deluxe: brighter days ahead', sources: [{ source: 'listenbrainz', via: 'X', score: 0.5 }] },
        { albumId: 's', artist: 'Ariana Grande', album: 'eternal sunshine', sources: [{ source: 'known-artist', via: 'Ariana Grande', score: 0.7 }] },
        { albumId: 'o', artist: 'Other', album: 'eternal sunshine', sources: [] },
    ]);
    assert.deepEqual(out.map((c) => c.albumId).sort(), ['o', 's']);
    const s = out.find((c) => c.albumId === 's');
    assert.deepEqual(s.sources.map((x) => x.source).sort(), ['known-artist', 'listenbrainz']);
});

test('heardStems catches a mid-title edition of a heard record', () => {
    const stems = heardStems({ heard: { albumKeys: ['ariana grande\u0000eternal sunshine'] } });
    assert.ok(stems.has(editionStem({ artist: 'Ariana Grande', album: 'eternal sunshine deluxe: brighter days ahead' })));
    assert.ok(!stems.has(editionStem({ artist: 'Ariana Grande', album: 'Positions' })));
});

test('notForThePage catches dated live sets, DJ mixes and remix records only', () => {
    assert.ok(notForThePage({ album: 'Live 2003' }));
    assert.ok(notForThePage({ album: 'Club Future Nostalgia (DJ Mix)' }));
    assert.ok(notForThePage({ album: 'The Remixes' }));
    assert.ok(!notForThePage({ album: 'Long Live' }));
    assert.ok(!notForThePage({ album: 'Live Through This' }));
    assert.ok(!notForThePage({ album: 'Ambient 1' }));
});

test('plainAlbumName drops editions and " - EP", and whyOf names two different records', () => {
    assert.equal(plainAlbumName('Up From Below (10th Anniversary Edition)'), 'Up From Below');
    assert.equal(plainAlbumName('Woodland - EP'), 'Woodland');
    assert.equal(plainAlbumName('The 20/20 Experience - The Complete Experience'), 'The 20/20 Experience');
    const loved = lovedByArtist({ albums: [
        { artist: 'JT', album: 'The 20/20 Experience (Deluxe Version)', verdict: 'loved', score: 0.9 },
        { artist: 'JT', album: 'The 20/20 Experience - The Complete Experience', verdict: 'loved', score: 0.8 },
        { artist: 'JT', album: 'FutureSex/LoveSounds', verdict: 'loved', score: 0.7 },
    ] });
    const why = whyOf({ artist: 'JT', sources: [{ source: 'known-artist', score: 1, via: 'JT' }] }, { reasons: [] }, loved, W);
    assert.equal(why, 'It is JT, whose The 20/20 Experience and FutureSex/LoveSounds you kept.');
});
