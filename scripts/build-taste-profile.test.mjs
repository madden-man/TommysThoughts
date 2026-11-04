// The pure parts of the taste profile on fixtures small enough to reason
// about by hand: `node --test scripts/`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    albumKey, withinUntil, isSkip, reducePlays, indexMaster, masterFacts, membershipUnder,
    depthOf, longevityOf, keptOf, recencyOf, scoreAlbum, verdictOf, aggregateArtists,
    genreWeights, shapeOf, genresFromTags, recentMs, minutesFromPlays, editionMatch,
} from './lib/taste.mjs';

const play = (over) => ({
    ts: '2020-05-01T12:00:00Z', ms_played: 200000, reason_end: 'trackdone', skipped: false,
    master_metadata_album_artist_name: 'Lord Huron', master_metadata_album_album_name: 'Vide Noir',
    master_metadata_track_name: 'Ancient Names', spotify_track_uri: 'spotify:track:a', ...over,
});

const album = (over) => ({
    key: 'k', artist: 'A', album: 'B', plays: 10, hours: 5, distinctTracks: 10, totalTracks: 10,
    years: [2020, 2021], skipRate: 0, inMaster: false, masterShare: null,
    firstPlayed: '2020-01-01', lastPlayed: '2026-08-01', ...over,
});

test('albumKey folds case, apostrophes and edition qualifiers', () => {
    assert.equal(albumKey('Lord Huron', 'Vide Noir (Deluxe Edition)'), 'lord huron\u0000vide noir');
    assert.equal(albumKey('Don’t', 'X - 2011 Remaster'), albumKey("don't", 'x'));
    assert.notEqual(albumKey('A', 'Live - Paris'), albumKey('A', 'Live'));
});

test('withinUntil keeps the whole cutoff day and nothing after', () => {
    assert.equal(withinUntil('2023-12-31T23:59:59Z', '2023-12-31'), true);
    assert.equal(withinUntil('2024-01-01T00:00:00Z', '2023-12-31'), false);
    assert.equal(withinUntil('2030-01-01T00:00:00Z', null), true);
});

test('isSkip reads reason_end with a time limit, and the skipped flag', () => {
    assert.equal(isSkip(play({ reason_end: 'fwdbtn', ms_played: 5000 })), true);
    assert.equal(isSkip(play({ reason_end: 'fwdbtn', ms_played: 200000 })), false);
    assert.equal(isSkip(play({ skipped: true })), true);
});

test('reducePlays merges spellings, counts distinct tracks by name and honours until', () => {
    const rows = [
        play({}),
        play({ master_metadata_album_album_name: 'Vide Noir (Deluxe)', master_metadata_track_name: 'Wait by the River', ts: '2021-02-01T00:00:00Z' }),
        play({ master_metadata_track_name: 'Ancient Names', spotify_track_uri: 'spotify:track:other', ts: '2024-03-01T00:00:00Z' }),
        play({ master_metadata_album_artist_name: null }),
    ];
    const all = reducePlays(rows);
    assert.equal(all.plays, 3);
    assert.equal(all.skippedRows, 1);
    const a = all.albums.get('lord huron\u0000vide noir');
    assert.equal(a.plays, 3);
    assert.equal(a.trackNames.size, 2);
    assert.deepEqual([...a.years].sort(), [2020, 2021, 2024]);
    assert.equal(a.lastPlayed, '2024-03-01');

    const cut = reducePlays(rows, { until: '2023-12-31' });
    assert.equal(cut.plays, 2);
    assert.equal(cut.to, '2021-02-01');
    assert.equal(cut.albums.get('lord huron\u0000vide noir').years.size, 2);
});

test('recentMs counts only the last 24 months', () => {
    const m = new Map([['2026-07', 1000], ['2024-09', 10], ['2020-01', 99999]]);
    assert.equal(recentMs(m, '2026-08-25'), 1010);
});

test('indexMaster files tracks under each artist and masterFacts uses the copy kept', () => {
    const t = (name, albumId, total, artists = ['Lord Huron']) => ({
        name, albumId, albumName: 'Vide Noir', albumTotalTracks: total, artistNames: artists, artistIds: artists.map((x) => `id-${x}`),
    });
    const { byKey, byId } = indexMaster([
        t('One', 'std', 12), t('Two', 'std', 12), t('Three', 'std', 12, ['Lord Huron', 'Guest']), t('Bonus', 'dlx', 16),
    ]);
    const rec = byKey.get('lord huron\u0000vide noir');
    assert.ok(byKey.has('guest\u0000vide noir'));
    assert.equal(byId.get('std'), 'lord huron\u0000vide noir');
    assert.deepEqual(masterFacts(rec), { totalTracks: 12, masterTracks: 4, masterShare: 4 / 12 });
});

test('membershipUnder: unknown after the cutoff, false when unmatched', () => {
    const facts = { masterTracks: 10, masterShare: 1 };
    assert.deepEqual(membershipUnder(facts, '2024-02-01', '2023-12-31'), { inMaster: null, masterTracks: null, masterShare: null });
    assert.equal(membershipUnder(null, '2020-01-01', null).inMaster, false);
    assert.equal(membershipUnder(facts, '2020-01-01', '2023-12-31').inMaster, true);
});

test('score components sit in 0..1 and order sensibly', () => {
    assert.equal(longevityOf(1), 0);
    assert.equal(longevityOf(6), 1);
    assert.equal(longevityOf(12), 1);
    assert.equal(keptOf({ inMaster: false }), 0);
    assert.equal(keptOf({ inMaster: true, masterShare: 1 }), 1);
    assert.equal(recencyOf('2026-08-25', '2026-08-25'), 1);
    assert.ok(depthOf({ hours: 40, distinctTracks: 12, totalTracks: 12 }) > 0.99);
    // One single on repeat is not a full record even with the same hours.
    assert.ok(depthOf({ hours: 10, distinctTracks: 1, totalTracks: 12 }) < depthOf({ hours: 10, distinctTracks: 12, totalTracks: 12 }));
    // Unknown length is judged against ten tracks.
    assert.equal(depthOf({ hours: 0, distinctTracks: 5, totalTracks: null }), 0.4 * 0.5);
});

test('scoreAlbum: kept whole, deep and lasting beats a binge; skips cost a little', () => {
    const ref = '2026-08-25';
    const best = scoreAlbum(album({ inMaster: true, masterShare: 1, hours: 50, years: [2018, 2019, 2020, 2021, 2022, 2026] }), ref);
    const binge = scoreAlbum(album({ hours: 50, years: [2018], lastPlayed: '2018-06-01' }), ref);
    assert.ok(best > 0.95 && best <= 1);
    assert.ok(binge < best);
    const skippy = scoreAlbum(album({ skipRate: 1 }), ref);
    assert.ok(Math.abs(skippy / scoreAlbum(album({}), ref) - 0.7) < 1e-9);
});

test('verdictOf covers each verdict and its edges', () => {
    const ref = '2026-08-25';
    assert.equal(verdictOf(album({ inMaster: true, masterShare: 0.6, hours: 2 }), ref), 'loved');
    assert.equal(verdictOf(album({ inMaster: true, masterShare: 0.6, hours: 1 }), ref), 'liked');
    assert.equal(verdictOf(album({ inMaster: true, masterShare: 0.2, hours: 1 }), ref), 'liked');
    assert.equal(verdictOf(album({ hours: 45, years: [2015, 2017, 2019, 2021] }), ref), 'loved');
    const quiet = { lastPlayed: '2024-08-01', hours: 20 / 60, distinctTracks: 5 };
    assert.equal(verdictOf(album(quiet), ref), 'dropped');
    assert.equal(verdictOf(album({ ...quiet, lastPlayed: '2024-09-01' }), ref), 'sampled');
    assert.equal(verdictOf(album({ ...quiet, distinctTracks: 4 }), ref), 'sampled');
    assert.equal(verdictOf(album({ ...quiet, hours: 19 / 60 }), ref), 'sampled');
    // Unknowable membership is never dropped.
    assert.equal(verdictOf(album({ ...quiet, inMaster: null }), ref), 'sampled');
    assert.equal(verdictOf(album({ hours: 3, distinctTracks: 5 }), ref), 'liked');
});

test('aggregateArtists: the best record leads, dropped records drag', () => {
    const rows = [
        album({ artist: 'A', score: 0.9, verdict: 'loved', hours: 50, artistIds: ['a1'] }),
        album({ artist: 'a', score: 0.2, verdict: 'dropped', hours: 1, artistIds: ['a1'] }),
        album({ artist: 'B', score: 0.9, verdict: 'loved', hours: 50, artistIds: ['b1'] }),
    ];
    const [first, second] = aggregateArtists(rows);
    assert.equal(first.name, 'B');
    assert.equal(second.name, 'A');
    assert.equal(second.lovedAlbums, 1);
    assert.equal(second.droppedAlbums, 1);
    assert.deepEqual(second.artistIds, ['a1']);
});

test('genreWeights split hours over genres and sum to 1, recent separately', () => {
    const rows = [album({ artist: 'A', hours: 3, recentHours: 0 }), album({ artist: 'B', hours: 1, recentHours: 1 })];
    const g = genreWeights(rows, new Map([['a', ['folk', 'rock']], ['b', ['folk']]]));
    const folk = g.find((x) => x.genre === 'folk');
    assert.equal(folk.weight, 2.5 / 4);
    assert.equal(folk.recentWeight, 1);
    assert.ok(Math.abs(g.reduce((s, x) => s + x.weight, 0) - 1) < 1e-9);
});

test('shapeOf reads only loved and liked records', () => {
    const rows = [
        album({ key: '1', verdict: 'loved', totalTracks: 10, distinctTracks: 10 }),
        album({ key: '2', verdict: 'liked', totalTracks: 14, distinctTracks: 2 }),
        album({ key: '3', verdict: 'sampled', totalTracks: 30, distinctTracks: 30 }),
    ];
    assert.deepEqual(shapeOf(rows, new Map([['1', 40], ['2', 50]])), { medianTracks: 12, medianMinutes: 45, fullAlbumShare: 0.5 });
});

test('genresFromTags drops non-genres and single votes when stronger ones exist', () => {
    assert.deepEqual(genresFromTags([
        { name: 'indie folk', count: 3 }, { name: 'nuno', count: 1 }, { name: 'indie rock', count: 2 }, { name: 'seen live', count: 9 },
    ]), ['indie folk', 'indie rock']);
    assert.deepEqual(genresFromTags([{ name: 'folk', count: 1 }, { name: 'american', count: 1 }]), ['folk']);
    assert.deepEqual(genresFromTags(undefined), []);
});

test('minutesFromPlays needs every track heard through', () => {
    const ms = new Map([['a', 180000], ['b', 240000], ['c', 60000]]);
    assert.equal(minutesFromPlays(ms, 2), 7);
    assert.equal(minutesFromPlays(ms, 4), null);
    assert.equal(minutesFromPlays(ms, null), null);
});

test('reducePlays keeps the longest finished play per track as its length', () => {
    const { albums } = reducePlays([
        play({ ms_played: 100000, reason_end: 'fwdbtn' }),
        play({ ms_played: 180000 }),
        play({ ms_played: 170000 }),
    ]);
    assert.equal(albums.get('lord huron\u0000vide noir').trackMs.get('ancient names'), 180000);
});

test('editionMatch finds a dash or bracket edition of a master record by the same artist', () => {
    const master = ['ed sheeran\u0000x', 'ed sheeran\u0000+', 'a\u0000vol', 'a\u0000vol 2'];
    assert.equal(editionMatch('ed sheeran\u0000x - wembley edition', master), 'ed sheeran\u0000x');
    assert.equal(editionMatch('ed sheeran\u0000xo', master), null);
    assert.equal(editionMatch('someone\u0000x - wembley edition', master), null);
    assert.equal(editionMatch('a\u0000vol 2 (live)', master), 'a\u0000vol 2');
});
