import {
    anytimeEvents,
    askAbout,
    eventsOnDay,
    formatDay,
    formatTime,
    signupEvents,
    upcomingForCard,
    weekFrom,
} from './localEvents';
import { LOCAL_EVENTS } from './localEventsData';

// Oct 11 2026 is a Sunday.
const SUNDAY = '2026-10-11';

const openMic = {
    id: 'open-mic', title: 'Open mic', symbol: '🏓', card: 'Open Mic!', venue: "Cactus Jack's",
    date: '2026-10-15', time: '20:00', recurrence: 'weekly', until: '2026-10-31', confirmed: true,
};
const haunt = {
    id: 'haunt', title: 'Haunted house', symbol: '🏓', venue: 'Buchanan Park',
    dates: ['2026-10-16', '2026-10-23'], time: '19:00',
    signup: { by: '', url: 'https://example.com', note: 'tickets' }, confirmed: true,
};
const race = {
    id: 'race', title: 'Zombie 5K', symbol: '🏠', venue: 'Ball fields',
    date: '2026-10-31', time: '10:00',
    signup: { by: '2026-10-15T10:00', url: 'https://example.com', note: 'register' }, confirmed: true,
};
const courts = {
    id: 'courts', title: 'Pickleball courts', symbol: '🏓', card: 'Pickle Ball', venue: 'Marshdale Park',
    hours: 'Daily, sunrise–sunset', confirmed: true,
};
const elk = {
    id: 'elk', title: 'Elk', symbol: '🏓', venue: 'Evergreen Lake', hours: 'Dawn and dusk',
    until: '2026-10-25', confirmed: false,
};
const early = {
    id: 'early', title: 'Early bingo', symbol: '🏠', venue: 'Revival Brews',
    date: '2026-10-15', time: '18:00', confirmed: true,
};

const EVENTS = [openMic, haunt, race, courts, elk, early];

describe('eventsOnDay', () => {
    it('repeats a weekly night on its weekday, earliest first', () => {
        expect(eventsOnDay(EVENTS, '2026-10-15').map(({ event }) => event.id))
            .toEqual(['early', 'open-mic']);
        expect(eventsOnDay(EVENTS, '2026-10-22').map(({ event }) => event.id)).toEqual(['open-mic']);
    });

    it('stops a repeat after its until', () => {
        expect(eventsOnDay(EVENTS, '2026-11-05')).toEqual([]);
    });

    it('leaves out anything that needs a sign-up', () => {
        expect(eventsOnDay(EVENTS, '2026-10-16')).toEqual([]);
    });
});

describe('signupEvents', () => {
    it('orders by the moment you have to act, deadline before the day itself', () => {
        // The race is Oct 31 but registration closes Oct 15, so it comes first.
        expect(signupEvents(EVENTS, SUNDAY).map(({ event, date }) => [event.id, date]))
            .toEqual([['race', '2026-10-31'], ['haunt', '2026-10-16']]);
    });

    it('moves a multi-date event on to its next date and drops it when none are left', () => {
        expect(signupEvents([haunt], '2026-10-20')[0].date).toBe('2026-10-23');
        expect(signupEvents([haunt], '2026-10-24')).toEqual([]);
    });
});

describe('anytimeEvents', () => {
    it('keeps undated places and drops a seasonal one after its until', () => {
        expect(anytimeEvents(EVENTS, SUNDAY).map(({ event }) => event.id)).toEqual(['elk', 'courts']);
        expect(anytimeEvents(EVENTS, '2026-10-26').map(({ event }) => event.id)).toEqual(['courts']);
    });
});

describe('upcomingForCard', () => {
    it('lists the next dates for a card, matching its header loosely', () => {
        expect(upcomingForCard(EVENTS, ' open mic! ', SUNDAY))
            .toEqual([
                { event: openMic, date: '2026-10-15' },
            ]);
    });

    it('falls back to anytime places', () => {
        expect(upcomingForCard(EVENTS, 'Pickle Ball', SUNDAY)).toEqual([{ event: courts, date: null }]);
    });
});

describe('formatting', () => {
    it('writes times and days the short way', () => {
        expect(formatTime('20:00')).toBe('8p');
        expect(formatTime('18:30')).toBe('6:30p');
        expect(formatTime('09:00')).toBe('9a');
        expect(formatTime('12:15')).toBe('12:15p');
        expect(formatDay('2026-10-15')).toBe('Thu 15');
        expect(weekFrom(SUNDAY)).toHaveLength(7);
        expect(weekFrom(SUNDAY)[6]).toBe('2026-10-17');
    });

    it('names the place and time in the bump question', () => {
        expect(askAbout({ event: openMic, date: '2026-10-15' })).toBe("Open mic, Cactus Jack's, Thu 15 8p");
        expect(askAbout({ event: courts, date: null })).toBe('Pickleball courts, Marshdale Park');
    });
});

describe('LOCAL_EVENTS', () => {
    it('gives every entry an id, a bump symbol and exactly one kind of when', () => {
        const ids = new Set();
        LOCAL_EVENTS.forEach((event) => {
            expect(ids.has(event.id)).toBe(false);
            ids.add(event.id);
            expect(['🏓', '🔨', '🏠']).toContain(event.symbol);
            const whens = [!!event.date, Array.isArray(event.dates), !!event.hours].filter(Boolean);
            expect(whens).toHaveLength(1);
            if (event.time) expect(event.time).toMatch(/^\d{2}:\d{2}$/);
        });
    });

    it('has something in every bucket on Sunday Oct 11', () => {
        expect(eventsOnDay(LOCAL_EVENTS, SUNDAY).length).toBeGreaterThan(3);
        expect(signupEvents(LOCAL_EVENTS, SUNDAY).length).toBeGreaterThan(10);
        expect(anytimeEvents(LOCAL_EVENTS, SUNDAY).length).toBeGreaterThan(5);
    });
});
