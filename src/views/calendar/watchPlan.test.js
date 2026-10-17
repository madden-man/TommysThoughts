import { PLAN_START, TRACK_ENDS, TRACK_RUNS, weeklyRuns } from './watchPlan';
import { buildNewShowRuns } from './newShowRotation';

const days = (r) => Math.round((new Date(`${r.end}T00:00:00`) - new Date(`${r.start}T00:00:00`)) / 86400000) + 1;
const weekday = (iso) => new Date(`${iso}T00:00:00`).getDay();

describe('one week per show', () => {
    it.each(['g', 'h', 'd'])('track %s gives every show a Sunday-to-Saturday week from the start', (code) => {
        const runs = TRACK_RUNS[code];
        expect(runs[0].start).toBe(PLAN_START);
        runs.forEach((r) => {
            expect(days(r)).toBe(7);
            expect(weekday(r.start)).toBe(0);
        });
    });

    it.each(['g', 'h', 'd'])('track %s has no gaps or overlaps', (code) => {
        const runs = TRACK_RUNS[code];
        for (let i = 1; i < runs.length; i++) {
            const next = new Date(`${runs[i - 1].end}T00:00:00`);
            next.setDate(next.getDate() + 1);
            expect(new Date(`${runs[i].start}T00:00:00`)).toEqual(next);
        }
    });

    it('keeps a holiday label only on the week that holds the holiday', () => {
        Object.values(TRACK_RUNS).flat().filter((r) => r.holiday).forEach((r) => {
            expect(r.start <= r.holidayDate && r.holidayDate <= r.end).toBe(true);
        });
    });

    it('holds a holiday pick for its week and fills the weeks before it in order', () => {
        const queue = [
            { title: 'Spooky', holiday: 'Halloween' },
            { title: 'A' }, { title: 'B' }, { title: 'C' },
        ];
        const runs = weeklyRuns(queue, '2026-10-11');
        expect(runs.map((r) => [r.title, r.start])).toEqual([
            ['A', '2026-10-11'], ['B', '2026-10-18'], ['Spooky', '2026-10-25'], ['C', '2026-11-01'],
        ]);
        expect(runs[2].holidayDate).toBe('2026-10-31');
    });

    it('plays a waiting holiday pick, unlabelled, once nothing else is left', () => {
        const runs = weeklyRuns([{ title: 'Xmas', holiday: 'Christmas' }, { title: 'A' }], '2026-08-02');
        expect(runs.map((r) => r.title)).toEqual(['A', 'Xmas']);
        expect(runs[1].holiday).toBeUndefined();
    });

    it('queues a new dart for one week after its track ends', () => {
        const [run] = buildNewShowRuns([{ name: 'Totally New Show', enneagram: 4 }]);
        expect(run.code).toBe('h');
        expect(days(run.show)).toBe(7);
        expect(run.show.start > TRACK_ENDS.h).toBe(true);
    });
});
