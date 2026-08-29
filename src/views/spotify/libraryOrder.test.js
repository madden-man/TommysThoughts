import { describeLibraryOrder, firstSavedAt, inLibraryOrder } from './libraryOrder';

const track = (name, albumId, addedAt, trackNumber = 1) => ({
    uri: `spotify:track:${name}`,
    name,
    albumId,
    albumName: albumId,
    artistIds: ['a1'],
    artistNames: ['An Artist'],
    discNumber: 1,
    trackNumber,
    addedAt,
});

const names = (tracks) => tracks.map((t) => t.name);

describe('firstSavedAt', () => {
    it('takes the earliest date a record holds', () => {
        const block = { tracks: [
            track('b', 'alb', '2021-06-01T00:00:00Z'),
            track('a', 'alb', '2019-01-01T00:00:00Z'),
        ] };
        expect(firstSavedAt(block)).toBe(Date.parse('2019-01-01T00:00:00Z'));
    });

    it('is null when nothing carries a date', () => {
        expect(firstSavedAt({ tracks: [track('a', 'alb', null)] })).toBeNull();
        expect(firstSavedAt({ tracks: [track('a', 'alb', 'not a date')] })).toBeNull();
    });
});

describe('inLibraryOrder', () => {
    it('orders standalone songs by when they were saved', () => {
        const out = inLibraryOrder([
            track('third', 'c', '2023-01-01T00:00:00Z'),
            track('first', 'a', '2019-01-01T00:00:00Z'),
            track('second', 'b', '2021-01-01T00:00:00Z'),
        ]);
        expect(names(out)).toEqual(['first', 'second', 'third']);
    });

    it('keeps a record whole and plays it in album order', () => {
        const out = inLibraryOrder([
            track('single', 'solo', '2020-06-01T00:00:00Z'),
            track('albumTrack2', 'alb', '2020-01-05T00:00:00Z', 2),
            track('albumTrack1', 'alb', '2020-01-01T00:00:00Z', 1),
        ]);
        // The album lands on its earliest date, ahead of the single, and its own
        // tracks run 1 then 2 rather than in the order they were saved.
        expect(names(out)).toEqual(['albumTrack1', 'albumTrack2', 'single']);
    });

    it('places a record by its first save, not its last', () => {
        // A record collected a track at a time still belongs where it started.
        const out = inLibraryOrder([
            track('later', 'b', '2021-01-01T00:00:00Z'),
            track('early', 'a', '2018-01-01T00:00:00Z', 1),
            track('muchLater', 'a', '2024-01-01T00:00:00Z', 2),
        ]);
        expect(names(out)).toEqual(['early', 'muchLater', 'later']);
    });

    it('gathers a record scattered through the playlist', () => {
        const out = inLibraryOrder([
            track('x1', 'x', '2020-01-01T00:00:00Z', 1),
            track('y1', 'y', '2021-01-01T00:00:00Z', 1),
            track('x2', 'x', '2020-01-02T00:00:00Z', 2),
        ]);
        expect(names(out)).toEqual(['x1', 'x2', 'y1']);
    });

    it('sends undated tracks to the end, in playlist order', () => {
        const out = inLibraryOrder([
            track('noDateB', null, null),
            track('dated', 'a', '2020-01-01T00:00:00Z'),
            track('noDateA', null, undefined),
        ]);
        expect(names(out)).toEqual(['dated', 'noDateB', 'noDateA']);
    });

    it('keeps records saved at the same moment in playlist order', () => {
        const same = '2020-01-01T00:00:00Z';
        const out = inLibraryOrder([
            track('b', 'b', same),
            track('a', 'a', same),
        ]);
        expect(names(out)).toEqual(['b', 'a']);
    });

    it('loses no tracks', () => {
        const input = [
            track('a', 'x', '2020-01-01T00:00:00Z', 1),
            track('b', 'x', '2020-01-02T00:00:00Z', 2),
            track('c', null, null),
            track('d', 'y', '2019-01-01T00:00:00Z'),
        ];
        const out = inLibraryOrder(input);
        expect(out).toHaveLength(input.length);
        expect(new Set(names(out))).toEqual(new Set(names(input)));
    });

    it('handles an empty playlist', () => {
        expect(inLibraryOrder([])).toEqual([]);
    });
});

describe('describeLibraryOrder', () => {
    it('reports the span and what carried no date', () => {
        const report = describeLibraryOrder([
            track('a', 'x', '2019-03-01T00:00:00Z', 1),
            track('b', 'x', '2019-03-02T00:00:00Z', 2),
            track('c', 'y', '2023-08-01T00:00:00Z'),
            track('d', null, null),
        ]);
        expect(report.tracks).toBe(4);
        expect(report.records).toBe(1);
        expect(report.undatedTracks).toBe(1);
        expect(report.from.toISOString()).toBe('2019-03-01T00:00:00.000Z');
        expect(report.to.toISOString()).toBe('2023-08-01T00:00:00.000Z');
    });

    it('reports no span when nothing is dated', () => {
        const report = describeLibraryOrder([track('a', null, null)]);
        expect(report.from).toBeNull();
        expect(report.to).toBeNull();
        expect(report.undatedTracks).toBe(1);
    });
});
