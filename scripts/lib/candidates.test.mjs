import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    albumKey, looseName, namesAgree, pickMatch, isNotARecord, exclusionReason,
    heardSets, mergeCandidates, preferStandard, labelFromCopyrights, mapLimit, bestScore,
} from './candidates.mjs';

const sp = (name, artists, extra = {}) => ({ name, artists: artists.map((n) => ({ name: n })), album_type: 'album', ...extra });

test('albumKey strips editions and case the way the profile does', () => {
    assert.equal(albumKey('Lord Huron', 'Vide Noir (Deluxe Edition)'), 'lord huron\u0000vide noir');
    assert.equal(albumKey('Of Monsters and Men', 'My Head Is An Animal'), albumKey('of monsters and men', 'My Head Is An Animal - 2012 Remaster'));
});

test('looseName folds punctuation, accents, ampersands and a leading The', () => {
    assert.equal(looseName('Mumford & Sons'), looseName('Mumford and Sons'));
    assert.equal(looseName('Ásgeir'), 'asgeir');
    assert.equal(looseName('The National'), 'national');
    assert.equal(looseName('Don’t Stop'), looseName("Don't Stop"));
});

test('namesAgree accepts spelling variants of the same record', () => {
    assert.ok(namesAgree({ artist: 'Mumford and Sons', album: 'Sigh No More' }, sp('Sigh No More', ['Mumford & Sons'])));
    assert.ok(namesAgree({ artist: 'Lord Huron', album: 'Vide Noir' }, sp('Vide Noir (Deluxe)', ['Lord Huron'])));
    assert.ok(namesAgree({ artist: 'Simon & Garfunkel', album: 'Bookends' }, sp('Bookends', ['Simon', 'Garfunkel'])));
});

test('namesAgree rejects a different record or a different artist', () => {
    assert.ok(!namesAgree({ artist: 'Of Monsters and Men', album: 'My Head Is An Animal' }, sp('My Head Is An Animal (The Cabin Sessions)', ['Of Monsters and Men'])));
    assert.ok(!namesAgree({ artist: 'Lord Huron', album: 'Vide Noir' }, sp('Vide Noir', ['Vide Noir Tribute Band'])));
    assert.ok(!namesAgree({ artist: 'Bon Iver', album: 'Bon Iver' }, sp('Bon Iver, Bon Iver', ['Bon Iver'])));
    assert.ok(!namesAgree({ artist: 'Bon Iver', album: 'x' }, null));
});

test('pickMatch prefers a real album over a compilation of the same name', () => {
    const items = [sp('Boxer', ['The National'], { album_type: 'compilation', id: 'c' }), sp('Boxer', ['The National'], { id: 'a' }), sp('Boxer', ['Someone Else'], { id: 'x' })];
    assert.equal(pickMatch({ artist: 'The National', album: 'Boxer' }, items).id, 'a');
    assert.equal(pickMatch({ artist: 'The National', album: 'High Violet' }, items), null);
});

test('isNotARecord catches concerts and compilations but not studio titles with "live" in them', () => {
    for (const name of ['LIVE FROM VATNAGARÐAR', 'Boxer (Live)', 'Abbey Road - Live', 'Live at Red Rocks', 'Greatest Hits', 'The Best Of Bon Iver', 'The Essential Simon & Garfunkel', 'Anthology 1', 'The Collection', 'Karaoke Hits Vol. 2', 'A Tribute to Lord Huron', 'MTV Unplugged in New York', 'Live', 'Rome (Full Concert)', 'Music for The Starling Girl (Score & Music from the Original Motion Picture)', 'Into the Wild (Soundtrack)', 'Watsky Live! from the Metro', 'Tame Impala - Live Versions', 'Vessel (with commentary)', 'Glass Animals - Remixes', 'Wolf + Instrumentals', 'My Head Is An Animal (The Cabin Sessions)', 'Sunday Night Sessions', 'iTunes Session', 'folklore: the long pond studio sessions (from the Disney+ special) [deluxe edition]']) {
        assert.ok(isNotARecord(name), name);
    }
    for (const name of ['Live Through This', 'Long Live', 'Alive', 'Vide Noir', 'Deliverance', 'Olive Grove', 'Sessions of Sorrow and Song', 'The Remixer', 'Instrumentality']) {
        assert.ok(!isNotARecord(name), name);
    }
});

const good = { key: 'a\u0000b', albumId: 'id1', album: 'B', albumType: 'album', totalTracks: 11, minutes: 41 };
test('exclusionReason applies every contract rule', () => {
    const heard = heardSets({ heard: { albumKeys: ['lord huron\u0000vide noir'], albumIds: ['heardId'] } });
    assert.equal(exclusionReason(good, heard), null);
    assert.equal(exclusionReason({ ...good, albumId: 'heardId' }, heard), 'heard');
    assert.equal(exclusionReason({ ...good, key: 'lord huron\u0000vide noir' }, heard), 'heard');
    assert.equal(exclusionReason(good, heard, ['lord huron\u0000vide noir']), 'heard');
    assert.equal(exclusionReason({ ...good, albumType: 'compilation' }, heard), 'not an album');
    assert.equal(exclusionReason({ ...good, album: 'B (Live)' }, heard), 'live or compilation');
    assert.equal(exclusionReason({ ...good, totalTracks: 7 }, heard), 'under 8 tracks');
    assert.equal(exclusionReason({ ...good, minutes: 24 }, heard), 'under 25 minutes');
});

test('heardSets tolerates a profile with no heard block', () => {
    const h = heardSets({});
    assert.equal(h.keys.size, 0);
    assert.equal(exclusionReason(good, h), null);
});

test('preferStandard picks the unqualified edition', () => {
    assert.equal(preferStandard(['My Head Is An Animal (10th Anniversary Edition)', 'My Head Is An Animal']), 'My Head Is An Animal');
    assert.equal(preferStandard(['Beneath The Skin (Deluxe)', 'Beneath The Skin (Remastered)']), 'Beneath The Skin (Deluxe)');
});

test('mergeCandidates folds by key, keeps every source once, and keeps the standard edition', () => {
    const rows = [
        { ...good, key: 'k', album: 'Rec (Deluxe)', albumId: 'deluxe', sources: [{ source: 'known-artist', score: 0.8, via: 'X' }] },
        { ...good, key: 'k', album: 'Rec', albumId: 'std', sources: [{ source: 'listenbrainz', score: 0.5, via: 'Y' }] },
        { ...good, key: 'k', album: 'Rec', albumId: 'std', sources: [{ source: 'listenbrainz', score: 0.5, via: 'Y' }, { source: 'claude', score: 1, via: 'claude' }] },
        { ...good, key: 'other', sources: [{ source: 'claude', score: 1, via: 'claude' }] },
    ];
    const merged = mergeCandidates(rows);
    assert.equal(merged.length, 2);
    const k = merged.find((m) => m.key === 'k');
    assert.equal(k.albumId, 'std');
    assert.deepEqual(k.sources.map((s) => s.source).sort(), ['claude', 'known-artist', 'listenbrainz']);
    assert.equal(bestScore(k), 1);
    assert.equal(rows[0].sources.length, 1, 'inputs are not mutated');
});

test('labelFromCopyrights reads the phonographic line', () => {
    assert.equal(labelFromCopyrights([{ text: '© 2018 Whispering Pines', type: 'C' }, { text: '(P) 2018 Republic Records', type: 'P' }]), 'Republic Records');
    assert.equal(labelFromCopyrights([{ text: '℗ 2012 Universal Republic', type: 'P' }]), 'Universal Republic');
    assert.equal(labelFromCopyrights([]), null);
});

test('mapLimit keeps order and bounds concurrency', async () => {
    let inFlight = 0; let peak = 0;
    const out = await mapLimit([5, 1, 3, 2], 2, async (n) => {
        inFlight += 1; peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, n));
        inFlight -= 1;
        return n * 2;
    });
    assert.deepEqual(out, [10, 2, 6, 4]);
    assert.ok(peak <= 2);
});
