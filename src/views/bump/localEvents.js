// Sorting the local events into the three ways you'd go to something:
//
//   today    — just show up: no sign-up, happening on the day you're looking at
//   signup   — tickets, RSVP or registration first, soonest deadline on top
//   anytime  — no date at all, only hours: a trail, a court, an arcade
//
// Repeats are the calendar's own rules (expandActivityEvents), so a weekly
// open mic on /bump lands on exactly the days it would on /calendar.

import { expandActivityEvents, kindForSymbol } from '../calendar/activityEvents';

export const BUCKETS = [
    { key: 'today', label: 'Today', hint: 'no sign-up' },
    { key: 'signup', label: 'Sign up first', hint: 'by deadline' },
    { key: 'anytime', label: 'Anytime', hint: 'open hours' },
];

const pad = (n) => String(n).padStart(2, '0');

export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const fromIso = (iso) => new Date(`${iso}T00:00:00`);

export const addDays = (iso, n) => {
    const d = fromIso(iso);
    return toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};

export const todayIso = () => toIso(new Date());

// How far ahead "next" looks. The data is a month at a time, so this only
// matters for the few rules that run on into the winter.
const HORIZON_DAYS = 60;

export const isAnytime = (event) => !event.date && !Array.isArray(event.dates);

// The days an event happens inside [from, to], in order.
export const occurrencesBetween = (event, from, to) => {
    if (Array.isArray(event.dates)) {
        return event.dates.filter((d) => d >= from && d <= to).sort();
    }
    if (!event.date) return [];
    // The calendar keys its rules by kind; any of the three expands the same.
    const rule = {
        _id: event.id,
        kind: kindForSymbol(event.symbol) ?? 'ap',
        title: event.title,
        date: event.date,
        recurrence: event.recurrence || 'once',
        until: event.until || '',
    };
    return expandActivityEvents([rule], from, to).map((occurrence) => occurrence.start);
};

export const nextOccurrence = (event, today) =>
    occurrencesBetween(event, today, addDays(today, HORIZON_DAYS))[0] ?? null;

const byTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')
    || a.title.localeCompare(b.title);

// Show-up events on one day, earliest first.
export const eventsOnDay = (events, day) => events
    .filter((event) => !event.signup && occurrencesBetween(event, day, day).length > 0)
    .map((event) => ({ event, date: day }))
    .sort((a, b) => byTime(a.event, b.event));

// Everything that needs doing ahead, keyed to the next time it happens. The
// order is the moment you have to act: the sign-up deadline when there is one,
// otherwise the day itself.
export const signupEvents = (events, today) => events
    .filter((event) => event.signup)
    .map((event) => ({ event, date: nextOccurrence(event, today) }))
    .filter(({ date }) => date)
    .sort((a, b) => {
        const actBy = (x) => (x.event.signup.by || x.date).slice(0, 10);
        return actBy(a).localeCompare(actBy(b))
            || a.date.localeCompare(b.date)
            || byTime(a.event, b.event);
    });

// Places with hours. A seasonal one (the golf course, the elk rut) drops off
// after its `until`.
export const anytimeEvents = (events, today) => events
    .filter((event) => isAnytime(event) && (!event.until || event.until >= today))
    .map((event) => ({ event, date: null }))
    .sort((a, b) => a.event.title.localeCompare(b.event.title));

export const eventsForBucket = (bucket, events, { today, day }) => {
    if (bucket === 'signup') return signupEvents(events, today);
    if (bucket === 'anytime') return anytimeEvents(events, today);
    return eventsOnDay(events, day ?? today);
};

const sameCard = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

// What an activity card lists under its name: the next few dated events that
// are instances of it, then — if there's room — places you could go anytime.
export const upcomingForCard = (events, header, today, limit = 2) => {
    const mine = events.filter((event) => sameCard(event.card, header));
    const dated = mine
        .filter((event) => !isAnytime(event))
        .map((event) => ({ event, date: nextOccurrence(event, today) }))
        .filter(({ date }) => date)
        .sort((a, b) => a.date.localeCompare(b.date) || byTime(a.event, b.event));
    const anytime = anytimeEvents(mine, today);
    return [...dated, ...anytime].slice(0, limit);
};

// '20:00' -> '8p', '18:30' -> '6:30p'
export const formatTime = (time) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const hour = h % 12 || 12;
    return `${hour}${m ? `:${pad(m)}` : ''}${h < 12 ? 'a' : 'p'}`;
};

// '2026-10-15' -> 'Thu 15'
export const formatDay = (iso) => {
    const d = fromIso(iso);
    return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}`;
};

// The week of days the Today tab can flip through, starting today.
export const weekFrom = (today) => Array.from({ length: 7 }, (_, n) => addDays(today, n));

// What the bump notification says: enough to answer without opening anything.
// sendActivityQuestion adds the question mark.
export const askAbout = ({ event, date }) => {
    const parts = [event.title, event.venue];
    if (date) parts.push(`${formatDay(date)}${event.time ? ` ${formatTime(event.time)}` : ''}`);
    return parts.filter(Boolean).join(', ');
};
