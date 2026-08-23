// The Madden clan's annual traditions. Semper Dulce.
//
// These are the one pile on this calendar that has earned a mark on the grid.
// Everything else that repeats — a dinner every night, a film every night, a
// restaurant every Friday — is `gridSilent`, because a thing that happens daily
// stops being news and becomes wallpaper. Traditions are the opposite: about
// twenty a year, roughly one or two a month, which is the same density as the
// watch plan's switch-overs and exactly what the three-lane grid was tuned for.
// They are also the most deliberate entries in the whole app — written down on
// purpose, years in advance — so when a lane runs out they outrank the holiday
// they happen to land on.
//
// Authored here rather than in Mongo, for the same reason watchPlan.js and the
// holidays in calendarConstants.js are: this is curated data that changes when
// someone edits the file, not rows anyone adds from the site at runtime.
//
// A tradition is a rule, not a row of dates. `on` says how to find the day in
// any given year, in one of three forms:
//
//   { month, day }                  a fixed date — Christmas is always the 25th
//   { month, weekday, ordinal }     the Nth weekday of a month — "the second
//                                   Saturday of October"
//   { anchor: 'Easter' }            a holiday that moves, looked up in EVENTS
//
// The weekday form is the default for anything that only named a month, because
// plans are made of weekdays: the second Saturday of October is always a
// Saturday, while the 11th wanders through the week and lands on a school night
// half the time. (activityEvents.js makes the same argument for monthly repeats.)
//
// Spans are either a fixed length (`spans`, in days, inclusive of the first) or
// run until another rule resolves (`until`) — the gratitude jar is open all
// November and closes on Thanksgiving, whatever date that is.

import { EVENTS } from './calendarConstants';
import { nthWeekdayOfMonth } from './activityEvents';

const SUN = 0;
const SAT = 6;
const JAN = 0, FEB = 1, MAR = 2, APR = 3, JUL = 6, AUG = 7, SEP = 8, OCT = 9,
    NOV = 10, DEC = 11;

export const TRADITIONS = [
    {
        id: 'new-years-letter',
        title: "New Year's Letter",
        icon: '✍️',
        on: { month: JAN, day: 1 },
        note: 'Write to yourself about the year behind and the year ahead.',
    },
    {
        id: 'scrapbook',
        title: 'Scrapbook',
        icon: '📔',
        on: { month: JAN, weekday: SAT, ordinal: 1 },
        note: 'Ali makes the year’s scrapbook of the babies.',
    },
    {
        id: 'build-a-fort',
        title: 'Build a Fort',
        icon: '🏰',
        on: { month: JAN, weekday: SAT, ordinal: 2 },
        note: 'One INSANE blanket fort, more intricate every year as the kids’ '
            + 'skills improve.',
    },
    {
        id: 'family-photo',
        title: 'Family Photo',
        icon: '📷',
        on: { month: FEB, weekday: SAT, ordinal: 1 },
        note: 'Same place, same positions, every year — so you can watch them grow.',
    },
    {
        id: 'restaurant-week',
        title: 'Restaurant Week',
        icon: '🍷',
        on: { month: MAR, weekday: SAT, ordinal: 2 },
        spans: 7,
        note: 'Alison and I go somewhere nice — three to five courses.',
    },
    {
        id: 'irish-baking',
        title: 'Irish Baking',
        icon: '🥧',
        on: { month: MAR, day: 17 },
        note: 'St. Patrick’s deserves more than drinking. Bake something '
            + 'fantastic in defiance of those Brits.',
    },
    {
        id: 'easter-egg-hunt',
        title: 'Easter Egg Hunt',
        icon: '🥚',
        on: { anchor: 'Easter' },
        note: 'We host the hunt for the kids (and friends).',
    },
    {
        id: 'plant-a-tree',
        title: 'Plant a Tree',
        icon: '🌳',
        on: { month: APR, weekday: SAT, ordinal: 3 },
        note: 'Trees are people too.',
    },
    {
        id: 'kids-day',
        title: "Kids' Day",
        icon: '🧃',
        on: { month: JUL, weekday: SAT, ordinal: 2 },
        note: 'The kids make every decision for a whole day, unless both parents veto.',
    },
    {
        id: 'ratatouille',
        title: 'Ratatouille with Ratatouille',
        icon: '🐀',
        on: { month: JUL, day: 14 },
        note: 'The most ancient tradition. Annie is forever included when we partake.',
    },
    {
        id: 'back-to-school-blessing',
        title: 'Back to School Blessing',
        icon: '🕯️',
        on: { month: AUG, weekday: SUN, ordinal: 3 },
        note: 'Special dinner and a special prayer, the night before school starts.',
    },
    {
        id: 'talent-show',
        title: 'Talent Show',
        icon: '🎤',
        on: { month: AUG, weekday: SAT, ordinal: 4 },
        note: 'Everyone brings a talent — something prepared, or a skill that’s '
            + 'been developed.',
    },
    {
        id: 'time-capsule',
        title: 'Time Capsule',
        icon: '⏳',
        on: { month: SEP, weekday: SAT, ordinal: 1 },
        note: 'Bury a bunch of stuffs.',
    },
    {
        id: 'pumpkin-patch',
        title: 'Pumpkin Patch',
        icon: '🎃',
        on: { month: OCT, weekday: SAT, ordinal: 2 },
        note: 'Pick the pumpkins, carve ’em up like psychopaths at home.',
    },
    {
        id: 'over-the-garden-wall',
        title: 'Over the Garden Wall',
        icon: '🍂',
        on: { month: OCT, day: 31 },
        song: 'Into the Unknown',
        note: 'Wirt and Greg are on a strange journey into the unknown. Party.',
    },
    {
        id: 'gratitude-jar',
        title: 'Gratitude Jar',
        icon: '🫙',
        on: { month: NOV, day: 1 },
        until: { anchor: 'Thanksgiving Day' },
        note: 'All month the family adds what they’re thankful for, then we bring '
            + 'the jar to Thanksgiving and read it out.',
    },
    {
        id: 'creative-gift',
        title: 'Creative Gift',
        icon: '🎨',
        on: { month: DEC, day: 1 },
        spans: 24,
        note: 'Ali and I each make the other something creative, in hand by Christmas Eve.',
    },
    {
        id: 'crimus-generosity',
        title: 'Crimus Generosity',
        icon: '🤲',
        on: { month: DEC, weekday: SAT, ordinal: 2 },
        note: 'The family volunteers at Project Angel Heart. We give happily.',
    },
    {
        id: 'crimus-choir',
        title: 'Crimus Choir',
        icon: '🎹',
        on: { month: DEC, day: 24 },
        song: 'Vince Guaraldi Trio',
        note: 'Dad on piano, kids on voice. Maybe someday we take it to the streets.',
    },
    {
        id: 'christmas',
        title: 'Christmas',
        icon: '🎄',
        on: { month: DEC, day: 25 },
        song: 'Vince Guaraldi Trio',
        note: 'Cinnamon rolls, open gifts.',
    },
    {
        id: 'minecraft-day',
        title: 'Minecraft Day',
        icon: '⛏️',
        on: { month: DEC, weekday: SAT, ordinal: 4 },
        note: 'An insane family expedition on the LAN world we’ve been building '
            + 'all year.',
    },
];

const toIso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Easter and Thanksgiving already exist on this calendar — calendarConstants.js
// carries them precisely so the watch plan can pin a show to them — so an
// anchored tradition reads the same row rather than recomputing the date and
// risking a day's disagreement with the holiday chip beside it.
//
// That does mean an anchored tradition only exists for the years EVENTS covers
// (2026–2029). It goes quiet after that rather than landing wrong, and extending
// it is the same edit that keeps every other Easter in the app working.
const holidayIn = (title, year) =>
    EVENTS.find((e) => e.title === title && e.start.startsWith(`${year}-`))?.start ?? null;

// A rule plus a year -> an ISO date, or null when that year has no such day.
const dateFor = (on, year) => {
    if (!on) return null;
    if (on.anchor) return holidayIn(on.anchor, year);
    if (on.weekday !== undefined) {
        const at = nthWeekdayOfMonth(year, on.month, on.weekday, on.ordinal);
        return at ? toIso(at) : null;
    }
    return toIso(new Date(year, on.month, on.day));
};

const endFor = (tradition, start, year) => {
    if (tradition.until) return dateFor(tradition.until, year);
    if (!tradition.spans || tradition.spans <= 1) return start;
    const at = new Date(`${start}T00:00:00`);
    at.setDate(at.getDate() + tradition.spans - 1);
    return toIso(at);
};

/**
 * Traditions -> calendar events inside [windowStart, windowEnd].
 *
 * Resolved per visible window rather than built once for every year, the same
 * way activity rules are: the grid asks for about six weeks, so this is twenty
 * or so date calculations, not a table of every tradition until 2050.
 */
export const expandTraditions = (windowStart, windowEnd) => {
    if (!windowStart || !windowEnd) return [];

    const events = [];
    // A span can open in one year and close in the next, and the grid's padding
    // days belong to the neighbouring months, so look a year either side of the
    // window instead of only the years it names.
    const from = Number(windowStart.slice(0, 4)) - 1;
    const to = Number(windowEnd.slice(0, 4)) + 1;

    for (let year = from; year <= to; year++) {
        TRADITIONS.forEach((tradition) => {
            const start = dateFor(tradition.on, year);
            if (!start) return;
            const end = endFor(tradition, start, year);
            // An `until` that can't resolve leaves the tradition without an end,
            // which is a missing holiday rather than a single-day event.
            if (!end || end < start) return;
            if (end < windowStart || start > windowEnd) return;
            events.push({
                id: `tradition-${tradition.id}-${year}`,
                title: tradition.title,
                start,
                end,
                notes: tradition.note,
                tradition,
            });
        });
    }
    return events;
};
