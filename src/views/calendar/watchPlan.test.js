import { TRACK_ENDS, TRACK_RUNS, WEEKLY_FROM, weeklyRuns } from './watchPlan';
import { buildNewShowRuns } from './newShowRotation';

const days = (r) => Math.round((new Date(`${r.end}T00:00:00`) - new Date(`${r.start}T00:00:00`)) / 86400000) + 1;
const weekday = (iso) => new Date(`${iso}T00:00:00`).getDay();

describe('one week per show', () => {
    it.each(['g', 'h', 'd'])('track %s gives every show from WEEKLY_FROM a Sunday-to-Saturday week', (code) => {
        const weekly = TRACK_RUNS[code].filter((r) => r.start >= WEEKLY_FROM);
        expect(weekly.length).toBeGreaterThan(0);
        expect(weekly[0].start).toBe(WEEKLY_FROM);
        weekly.forEach((r) => {
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

    it('keeps finished runs and closes the one on that week', () => {
        const queue = [
            { title: 'Done', start: '2026-09-01', end: '2026-09-30' },
            { title: 'Mid', start: '2026-10-01', end: '2026-10-30' },
            { title: 'Next', start: '2026-10-31', end: '2026-12-30', holiday: 'Halloween', holidayDate: '2026-10-31' },
        ];
        const [done, mid, next] = weeklyRuns(queue, '2026-10-18', '2026-10-14');
        expect(done).toMatchObject({ start: '2026-09-01', end: '2026-09-30' });
        expect(mid).toMatchObject({ start: '2026-10-01', end: '2026-10-17' });
        expect(next).toMatchObject({ start: '2026-10-18', end: '2026-10-24' });
        expect(next.holiday).toBeUndefined();
    });

    it('sends a show that had not started by the switch to the weekly queue', () => {
        const queue = [
            { title: 'On', start: '2026-08-02', end: '2026-10-16' },
            { title: 'Due Saturday', start: '2026-10-17', end: '2026-11-17' },
        ];
        const [on, due] = weeklyRuns(queue, '2026-10-18', '2026-10-14');
        expect(on).toMatchObject({ start: '2026-08-02', end: '2026-10-17' });
        expect(due).toMatchObject({ start: '2026-10-18', end: '2026-10-24' });
    });

    it('queues a new dart for one week after its track ends', () => {
        const [run] = buildNewShowRuns([{ name: 'Totally New Show', enneagram: 4 }]);
        expect(run.code).toBe('h');
        expect(days(run.show)).toBe(7);
        expect(run.show.start > TRACK_ENDS.h).toBe(true);
    });
});
