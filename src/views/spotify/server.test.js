import { PART_SIZE, partsFor } from './server';

// A playlist longer than one part is split across that many tabs. Getting this
// off by one either drops the tail of a playlist or opens an empty tab, and
// neither announces itself — the old cap silently discarded 3,471 of master
// (ii)'s 5,971 tracks for exactly this kind of reason.
describe('partsFor', () => {
    it('is one tab for anything that fits', () => {
        expect(partsFor(1)).toBe(1);
        expect(partsFor(2019)).toBe(1);
        expect(partsFor(PART_SIZE)).toBe(1);
    });

    it('opens a second tab for one track over', () => {
        expect(partsFor(PART_SIZE + 1)).toBe(2);
    });

    it('adds a tab per part, and only a full part gets its own', () => {
        expect(partsFor(PART_SIZE * 2)).toBe(2);
        expect(partsFor(PART_SIZE * 2 + 1)).toBe(3);
        expect(partsFor(5971)).toBe(3);      // master (ii)
        expect(partsFor(9727)).toBe(4);      // git add ./goodMusic
    });

    it('still gives one tab when the length is unknown', () => {
        // The playlist list can answer null, and a tab that never appears is
        // worse than one that loads and reports its own size.
        expect(partsFor(null)).toBe(1);
        expect(partsFor(undefined)).toBe(1);
        expect(partsFor(0)).toBe(1);
    });

    it('covers every track across its parts', () => {
        [1, 2500, 2501, 5971, 9727].forEach((total) => {
            const parts = partsFor(total);
            const covered = Array.from({ length: parts }, (_, part) => {
                const from = part * PART_SIZE;
                return Math.min(total, from + PART_SIZE) - from;
            });
            expect(covered.reduce((a, b) => a + b, 0)).toBe(total);
            expect(covered.every((n) => n > 0)).toBe(true);
        });
    });
});
