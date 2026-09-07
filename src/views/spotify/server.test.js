import { SPLIT_THRESHOLD, TAB_SIZE, partSizeFor, partsFor } from './server';

// A playlist longer than one part is split across that many tabs. Getting this
// off by one either drops the tail of a playlist or opens an empty tab, and
// neither announces itself — the old cap silently discarded 3,471 of master
// (ii)'s 5,971 tracks for exactly this kind of reason.
describe('partSizeFor', () => {
    it('keeps a short playlist whole in one wide tab', () => {
        expect(partSizeFor(1)).toBe(SPLIT_THRESHOLD);
        expect(partSizeFor(2019)).toBe(SPLIT_THRESHOLD);
        expect(partSizeFor(SPLIT_THRESHOLD)).toBe(SPLIT_THRESHOLD);
    });

    it('switches to narrow tabs the moment a playlist is over the threshold', () => {
        expect(partSizeFor(SPLIT_THRESHOLD + 1)).toBe(TAB_SIZE);
        expect(partSizeFor(5971)).toBe(TAB_SIZE);
    });

    it('treats an unknown length as short', () => {
        expect(partSizeFor(null)).toBe(SPLIT_THRESHOLD);
        expect(partSizeFor(undefined)).toBe(SPLIT_THRESHOLD);
        expect(partSizeFor(0)).toBe(SPLIT_THRESHOLD);
    });
});

describe('partsFor', () => {
    it('is one tab for anything at or under the threshold', () => {
        expect(partsFor(1)).toBe(1);
        expect(partsFor(2019)).toBe(1);
        expect(partsFor(SPLIT_THRESHOLD)).toBe(1);
    });

    it('breaks a longer playlist into 1,000-track tabs, first 2,500 included', () => {
        // One track over the threshold is three narrow tabs, not two —
        // 1,000 / 1,000 / 501 — because the whole thing now splits by 1,000.
        expect(partsFor(SPLIT_THRESHOLD + 1)).toBe(3);
        expect(partsFor(2600)).toBe(3);
        expect(partsFor(3000)).toBe(3);
        expect(partsFor(3001)).toBe(4);
    });

    it('adds a tab per 1,000, and only a full 1,000 gets its own', () => {
        expect(partsFor(5971)).toBe(6);      // master (ii)
        expect(partsFor(9727)).toBe(10);     // git add ./goodMusic
    });

    it('still gives one tab when the length is unknown', () => {
        // The playlist list can answer null, and a tab that never appears is
        // worse than one that loads and reports its own size.
        expect(partsFor(null)).toBe(1);
        expect(partsFor(undefined)).toBe(1);
        expect(partsFor(0)).toBe(1);
    });

    it('covers every track across its parts', () => {
        [1, 2500, 2501, 2600, 5971, 9727].forEach((total) => {
            const parts = partsFor(total);
            const partSize = partSizeFor(total);
            const covered = Array.from({ length: parts }, (_, part) => {
                const from = part * partSize;
                return Math.min(total, from + partSize) - from;
            });
            expect(covered.reduce((a, b) => a + b, 0)).toBe(total);
            expect(covered.every((n) => n > 0)).toBe(true);
        });
    });
});
