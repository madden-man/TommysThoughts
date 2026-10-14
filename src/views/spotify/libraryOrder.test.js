import {
    addedToPlaylistAt,
    baseAlbumName,
    describeLibraryOrder,
    firstPlayedAt,
    firstPlayedIndex,
    inLibraryOrder,
    normalizeName,
    placeOf,
} from './libraryOrder';

const track = (name, album, artist, trackNumber = 1, addedAt = null) => ({
    uri: `spotify:track:${name}`,
    name,
    albumId: album,
    albumName: album,
    artistIds: [artist],
    artistNames: [artist],
    discNumber: 1,
    trackNumber,
    addedAt,
});

const names = (tracks) => tracks.map((t) => t.name);
const index = (rows) => firstPlayedIndex({ albums: rows });

describe('normalizeName', () => {
    it('folds case, whitespace and curly apostrophes', () => {
        expect(normalizeName('  Don’t   Panic ')).toBe("don't panic");
        expect(normalizeName("DON'T PANIC")).toBe("don't panic");
    });

    it('survives nothing at all', () => {
        expect(normalizeName(null)).toBe('');
        expect(normalizeName(undefined)).toBe('');
    });
});

describe('baseAlbumName', () => {
    it('takes off edition and remaster qualifiers', () => {
        expect(baseAlbumName('Babel (Deluxe Edition)')).toBe('Babel');
        expect(baseAlbumName('Nevermind [Explicit]')).toBe('Nevermind');
        expect(baseAlbumName('Achtung Baby - 2011 Remaster')).toBe('Achtung Baby');
    });

    it('takes off more than one', () => {
        expect(baseAlbumName('Blue (Remastered) (Deluxe Edition)')).toBe('Blue');
    });

    it('leaves an ordinary name alone', () => {
        expect(baseAlbumName('The Head and the Heart')).toBe('The Head and the Heart');
        expect(baseAlbumName('Sigh No More')).toBe('Sigh No More');
    });

    it('never strips a name down to nothing', () => {
        expect(baseAlbumName('(Remastered)')).toBe('(Remastered)');
    });
});

describe('firstPlayedAt', () => {
    it('dates a record by its artist and album', () => {
        const i = index([['Mumford & Sons', 'Babel', '2014-01-21']]);
        expect(firstPlayedAt({ tracks: [track('a', 'Babel', 'Mumford & Sons')] }, i))
            .toBe(Date.parse('2014-01-21'));
    });

    it('keeps the earlier date when two spellings fold together', () => {
        const i = index([
            ['Mumford & Sons', 'Babel', '2016-05-05'],
            ['MUMFORD & SONS', 'babel', '2014-01-21'],
        ]);
        expect(firstPlayedAt({ tracks: [track('a', 'Babel', 'Mumford & Sons')] }, i))
            .toBe(Date.parse('2014-01-21'));
    });

    it('matches a deluxe copy against the standard one that was streamed', () => {
        const i = index([['Mumford & Sons', 'Babel', '2014-01-21']]);
        const block = { tracks: [track('a', 'Babel (Deluxe Edition)', 'Mumford & Sons')] };
        expect(firstPlayedAt(block, i)).toBe(Date.parse('2014-01-21'));
    });

    it('matches the other way round too', () => {
        const i = index([['Mumford & Sons', 'Babel (Deluxe Edition)', '2014-01-21']]);
        const block = { tracks: [track('a', 'Babel', 'Mumford & Sons')] };
        expect(firstPlayedAt(block, i)).toBe(Date.parse('2014-01-21'));
    });

    it('finds a record credited to the feature rather than the album artist', () => {
        const i = index([['Guest Star', 'The Record', '2020-02-02']]);
        const block = { tracks: [{
            ...track('a', 'The Record', 'Main Act'),
            artistNames: ['Main Act', 'Guest Star'],
        }] };
        expect(firstPlayedAt(block, i)).toBe(Date.parse('2020-02-02'));
    });

    it('is null for a record the history has never seen', () => {
        const i = index([['Someone Else', 'Another Record', '2020-01-01']]);
        expect(firstPlayedAt({ tracks: [track('a', 'Babel', 'Mumford & Sons')] }, i)).toBeNull();
    });

    it('ignores rows carrying an unparseable date', () => {
        const i = index([['A', 'B', 'not a date'], [null, null, null]]);
        expect(i.size).toBe(0);
    });
});

describe('addedToPlaylistAt', () => {
    it('takes the earliest added_at a record holds', () => {
        const block = { tracks: [
            track('b', 'R', 'A', 2, '2021-06-01T00:00:00Z'),
            track('a', 'R', 'A', 1, '2019-01-01T00:00:00Z'),
        ] };
        expect(addedToPlaylistAt(block)).toBe(Date.parse('2019-01-01T00:00:00Z'));
    });

    it('is null when nothing carries one', () => {
        expect(addedToPlaylistAt({ tracks: [track('a', 'R', 'A')] })).toBeNull();
        expect(addedToPlaylistAt({ tracks: [track('a', 'R', 'A', 1, 'nonsense')] })).toBeNull();
    });
});

describe('placeOf', () => {
    const history = index([['Artist A', 'Known', '2015-03-01']]);

    it('prefers the streaming history', () => {
        const block = { tracks: [track('a', 'Known', 'Artist A', 1, '2026-01-01T00:00:00Z')] };
        expect(placeOf(block, history)).toEqual({
            at: Date.parse('2015-03-01'), source: 'history',
        });
    });

    it('falls back to the playlist add when the history has nothing', () => {
        const block = { tracks: [track('x', 'Unlogged', 'Nobody', 1, '2020-05-05T00:00:00Z')] };
        expect(placeOf(block, history)).toEqual({
            at: Date.parse('2020-05-05T00:00:00Z'), source: 'playlist',
        });
    });

    it('has nowhere to put a record with neither', () => {
        const block = { tracks: [track('x', 'Unlogged', 'Nobody')] };
        expect(placeOf(block, history)).toEqual({ at: null, source: null });
    });
});

describe('inLibraryOrder', () => {
    const history = index([
        ['Artist A', 'First Record', '2015-03-01'],
        ['Artist B', 'Second Record', '2018-07-04'],
        ['Artist C', 'Third Record', '2022-11-30'],
    ]);

    it('orders records by when they were first heard, not by playlist position', () => {
        const out = inLibraryOrder([
            track('c', 'Third Record', 'Artist C'),
            track('a', 'First Record', 'Artist A'),
            track('b', 'Second Record', 'Artist B'),
        ], history);
        expect(names(out)).toEqual(['a', 'b', 'c']);
    });

    it('keeps a record whole and plays it in album order', () => {
        const out = inLibraryOrder([
            track('b2', 'Second Record', 'Artist B', 2),
            track('a1', 'First Record', 'Artist A', 1),
            track('b1', 'Second Record', 'Artist B', 1),
        ], history);
        expect(names(out)).toEqual(['a1', 'b1', 'b2']);
    });

    it('gathers a record scattered through the playlist', () => {
        const out = inLibraryOrder([
            track('a1', 'First Record', 'Artist A', 1),
            track('c1', 'Third Record', 'Artist C', 1),
            track('a2', 'First Record', 'Artist A', 2),
        ], history);
        expect(names(out)).toEqual(['a1', 'a2', 'c1']);
    });

    it('ignores added_at wherever the history has an answer', () => {
        // The whole point: a master assembled in one afternoon carries one
        // added_at, so the order has to come from the listening history.
        const sameDay = '2026-01-01T00:00:00Z';
        const out = inLibraryOrder([
            { ...track('c', 'Third Record', 'Artist C'), addedAt: sameDay },
            { ...track('a', 'First Record', 'Artist A'), addedAt: sameDay },
        ], history);
        expect(names(out)).toEqual(['a', 'c']);
    });

    it('interleaves the fallback rather than tacking it on the end', () => {
        // Nothing in the history, but added to the playlist in 2016 — so it
        // belongs between the 2015 record and the 2018 one, not after both.
        const out = inLibraryOrder([
            track('b', 'Second Record', 'Artist B'),
            track('a', 'First Record', 'Artist A'),
            track('x', 'Unlogged', 'Nobody', 1, '2016-06-06T00:00:00Z'),
        ], history);
        expect(names(out)).toEqual(['a', 'x', 'b']);
    });

    it('dates a whole unlogged record by its earliest playlist add', () => {
        const out = inLibraryOrder([
            track('a', 'First Record', 'Artist A'),
            track('x2', 'Unlogged', 'Nobody', 2, '2021-01-01T00:00:00Z'),
            track('x1', 'Unlogged', 'Nobody', 1, '2016-06-06T00:00:00Z'),
            track('b', 'Second Record', 'Artist B'),
        ], history);
        expect(names(out)).toEqual(['a', 'x1', 'x2', 'b']);
    });

    it('sends records neither source can date to the end, in playlist order', () => {
        const out = inLibraryOrder([
            track('unknownB', 'Unlogged B', 'Nobody'),
            track('known', 'First Record', 'Artist A'),
            track('unknownA', 'Unlogged A', 'Nobody'),
        ], history);
        expect(names(out)).toEqual(['known', 'unknownB', 'unknownA']);
    });

    it('keeps records dated to the same moment in playlist order', () => {
        const sameDay = index([
            ['Artist A', 'First Record', '2015-03-01'],
            ['Artist B', 'Second Record', '2015-03-01'],
        ]);
        const out = inLibraryOrder([
            track('b', 'Second Record', 'Artist B'),
            track('a', 'First Record', 'Artist A'),
        ], sameDay);
        expect(names(out)).toEqual(['b', 'a']);
    });

    it('loses no tracks', () => {
        const input = [
            track('a1', 'First Record', 'Artist A', 1),
            track('a2', 'First Record', 'Artist A', 2),
            track('x', 'Unlogged', 'Nobody', 1, '2016-06-06T00:00:00Z'),
            track('y', 'Also Unlogged', 'Nobody'),
            track('b', 'Second Record', 'Artist B'),
        ];
        const out = inLibraryOrder(input, history);
        expect(out).toHaveLength(input.length);
        expect(new Set(names(out))).toEqual(new Set(names(input)));
    });

    it('falls back to added_at throughout when there is no history at all', () => {
        const input = [
            track('later', 'R2', 'A2', 1, '2021-01-01T00:00:00Z'),
            track('earlier', 'R1', 'A1', 1, '2019-01-01T00:00:00Z'),
        ];
        expect(names(inLibraryOrder(input))).toEqual(['earlier', 'later']);
    });

    it('handles an empty playlist', () => {
        expect(inLibraryOrder([], history)).toEqual([]);
    });
});

describe('describeLibraryOrder', () => {
    it('reports what each source placed, and the span', () => {
        const history = index([
            ['Artist A', 'First Record', '2015-03-01'],
            ['Artist C', 'Third Record', '2022-11-30'],
        ]);
        const report = describeLibraryOrder([
            track('a1', 'First Record', 'Artist A', 1),
            track('a2', 'First Record', 'Artist A', 2),
            track('c', 'Third Record', 'Artist C'),
            track('x', 'Unlogged', 'Nobody', 1, '2016-06-06T00:00:00Z'),
            track('y', 'Also Unlogged', 'Nobody'),
        ], history);

        expect(report.tracks).toBe(5);
        expect(report.blocks).toBe(4);
        expect(report.records).toBe(1);
        expect(report.blocksBySource).toEqual({ history: 2, playlist: 1, none: 1 });
        expect(report.tracksBySource).toEqual({ history: 3, playlist: 1, none: 1 });
        expect(report.from.toISOString().slice(0, 10)).toBe('2015-03-01');
        expect(report.to.toISOString().slice(0, 10)).toBe('2022-11-30');
    });

    it('reports no span when nothing could be dated at all', () => {
        const report = describeLibraryOrder([track('x', 'Unlogged', 'Nobody')]);
        expect(report.from).toBeNull();
        expect(report.to).toBeNull();
        expect(report.tracksBySource.none).toBe(1);
    });
});

// The generated file is the join's other half, so it is checked here rather than
// trusted: a rename, a re-export in a different shape, or a truncated write would
// otherwise show up only as an order that looks vaguely plausible.
describe('the generated spotify-first-played.json', () => {
    // eslint-disable-next-line global-require
    const data = JSON.parse(require('fs').readFileSync('public/spotify-first-played.json', 'utf8'));

    it('is the shape the reader expects', () => {
        expect(data.source).toBe('Spotify Extended Streaming History');
        expect(Array.isArray(data.albums)).toBe(true);
        expect(data.albums.length).toBeGreaterThan(5000);
        data.albums.slice(0, 50).forEach(([artist, album, date]) => {
            expect(typeof artist).toBe('string');
            expect(typeof album).toBe('string');
            expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    it('indexes without dropping rows on the floor', () => {
        const i = firstPlayedIndex(data);
        // At least one key per row, plus the base-album aliases.
        expect(i.size).toBeGreaterThanOrEqual(data.albums.length);
    });

    it('dates a record that is actually in the history', () => {
        const i = firstPlayedIndex(data);
        const [artist, album, date] = data.albums[0];
        const block = { tracks: [{ albumName: album, artistNames: [artist] }] };
        expect(firstPlayedAt(block, i)).toBe(Date.parse(date));
    });

    it('reaches the same record through a deluxe spelling', () => {
        const i = firstPlayedIndex(data);
        // Pick a real entry whose name carries a qualifier, and look it up by the
        // stripped name — the case a playlist hits when it holds another edition.
        const row = data.albums.find(([, album]) => baseAlbumName(album) !== album);
        expect(row).toBeDefined();
        const [artist, album, date] = row;
        const block = { tracks: [{ albumName: baseAlbumName(album), artistNames: [artist] }] };
        expect(firstPlayedAt(block, i)).toBeLessThanOrEqual(Date.parse(date));
    });
});
