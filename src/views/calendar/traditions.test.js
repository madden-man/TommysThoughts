import { EVENTS } from './calendarConstants';
import { TRADITIONS, expandTraditions } from './traditions';

const find = (events, id) => events.filter((e) => e.id.startsWith(`tradition-${id}-`));
const one = (events, id) => {
    const hits = find(events, id);
    expect(hits).toHaveLength(1);
    return hits[0];
};

const weekdayOf = (iso) => new Date(`${iso}T00:00:00`).getDay();

describe('expandTraditions', () => {
    it('resolves a fixed date', () => {
        const events = expandTraditions('2026-12-01', '2026-12-31');
        expect(one(events, 'christmas')).toMatchObject({
            start: '2026-12-25',
            end: '2026-12-25',
            title: 'Christmas',
        });
    });

    it('lands a month-only tradition on its weekday, every year', () => {
        // Feb 1 2026 is a Sunday, so the first Saturday is the 7th; 2027 and
        // 2028 start the month on different weekdays and must still be Saturdays.
        expect(one(expandTraditions('2026-02-01', '2026-02-28'), 'family-photo').start)
            .toBe('2026-02-07');
        ['2027', '2028', '2029'].forEach((year) => {
            const at = one(
                expandTraditions(`${year}-02-01`, `${year}-02-28`), 'family-photo').start;
            expect(weekdayOf(at)).toBe(6);
            expect(at.slice(0, 7)).toBe(`${year}-02`);
        });
    });

    it('follows a holiday that moves', () => {
        // Easter is nearly a fortnight apart in these two years.
        expect(one(expandTraditions('2026-04-01', '2026-04-30'), 'easter-egg-hunt').start)
            .toBe('2026-04-05');
        expect(one(expandTraditions('2027-03-01', '2027-03-31'), 'easter-egg-hunt').start)
            .toBe('2027-03-28');
    });

    it('agrees with the holiday row it anchors to', () => {
        const easter = EVENTS.find((e) => e.id === 'easter-2028-04-16');
        const hunt = one(expandTraditions('2028-04-01', '2028-04-30'), 'easter-egg-hunt');
        expect(hunt.start).toBe(easter.start);
    });

    it('closes an open-ended span on the holiday it names', () => {
        const jar = one(expandTraditions('2026-11-01', '2026-11-30'), 'gratitude-jar');
        expect(jar.start).toBe('2026-11-01');
        expect(jar.end).toBe('2026-11-26');   // Thanksgiving 2026
    });

    it('counts a fixed span inclusive of its first day', () => {
        // Second Saturday of March 2026 is the 14th; seven days ends the 20th.
        const week = one(expandTraditions('2026-03-01', '2026-03-31'), 'restaurant-week');
        expect(week).toMatchObject({ start: '2026-03-14', end: '2026-03-20' });
    });

    it('shows a span from a day in its middle', () => {
        // The window opens after the jar does and closes before it does.
        const events = expandTraditions('2026-11-10', '2026-11-16');
        expect(one(events, 'gratitude-jar').start).toBe('2026-11-01');
    });

    it('goes quiet past the years the holidays cover, rather than guessing', () => {
        // EVENTS runs to 2029, so an anchored tradition has no 2031 date. Fixed
        // and weekday rules keep working.
        const events = expandTraditions('2031-01-01', '2031-12-31');
        expect(find(events, 'easter-egg-hunt')).toHaveLength(0);
        expect(find(events, 'gratitude-jar')).toHaveLength(0);
        expect(find(events, 'christmas')).toHaveLength(1);
        expect(find(events, 'family-photo')).toHaveLength(1);
    });

    it('never repeats a tradition within one window', () => {
        const events = expandTraditions('2026-11-29', '2027-01-09');
        expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    });

    it('returns nothing without a window', () => {
        expect(expandTraditions(null, '2026-12-31')).toEqual([]);
        expect(expandTraditions('2026-12-01', undefined)).toEqual([]);
    });
});

describe('TRADITIONS', () => {
    it('gives every tradition a unique id, an icon and a note', () => {
        expect(new Set(TRADITIONS.map((t) => t.id)).size).toBe(TRADITIONS.length);
        TRADITIONS.forEach((t) => {
            expect(t.title).toBeTruthy();
            expect(t.icon).toBeTruthy();
            expect(t.note).toBeTruthy();
        });
    });

    it('stays inside the density the three-lane grid was built for', () => {
        // Roughly one or two a month. If this ever fails, the grid is the thing
        // to reconsider, not the assertion.
        const year = expandTraditions('2027-01-01', '2027-12-31');
        expect(year.length).toBe(TRADITIONS.length);
        expect(year.length / 12).toBeLessThan(2.5);
    });
});
