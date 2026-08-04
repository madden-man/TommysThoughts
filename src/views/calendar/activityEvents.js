// Activities on the calendar are scheduled, not rotated.
//
// This used to hand every day an activity off three cycling pools, which meant
// the calendar asserted things you never agreed to. Now nothing lands on a day
// unless you put it there — one time, or on a repeat.
//
// The three kinds are still the bump symbols, and the symbol is the whole
// signal for how involved something is:
//
//   🏓  let's go play   — outings: hot springs, horseback riding, a music festival
//   🔨  time to work    — classes, errands, the gym
//   🏠  low key hang    — reading, puzzles, a fire pit
//
// An entry is a rule, not a row of days: { kind, title, date, recurrence, until }.
// expandActivityEvents turns those rules into the occurrences that fall inside
// whatever window the grid is showing, so a daily repeat costs a month of
// events rather than three years of them.

export const PLAY = '🏓';
export const WORK = '🔨';
export const HOME = '🏠';

// kind code -> which bump symbol it draws from, and how it labels itself
export const ACTIVITY_KINDS = {
    ap: { symbol: PLAY, label: "Let's go play", hint: 'outings and bigger plans' },
    aw: { symbol: WORK, label: 'Time to work', hint: 'classes, errands, the gym' },
    ah: { symbol: HOME, label: 'Low key hang', hint: 'reading, puzzles, a fire pit' },
};

export const RECURRENCES = {
    once: { label: 'Just once', repeats: false },
    daily: { label: 'Every day', repeats: true },
    weekly: { label: 'Every week', repeats: true },
    biweekly: { label: 'Every other week', repeats: true },
    monthly: { label: 'Every month', repeats: true },
    yearly: { label: 'Every year', repeats: true },
};

export const isRecurring = (recurrence) => !!RECURRENCES[recurrence]?.repeats;

const toIso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fromIso = (iso) => new Date(`${iso}T00:00:00`);

// Day-interval repeats. Month-length repeats can't be expressed this way — a
// month is not a fixed number of days — so they step by calendar month below.
const DAY_STEP = { daily: 1, weekly: 7, biweekly: 14 };

const DAY_MS = 86400000;

// Every occurrence is computed from the anchor rather than from the previous
// one, so a rule whose day of the month doesn't exist in some months (the 31st,
// Feb 29) skips those months and keeps its date in the rest, instead of
// drifting forward once and never matching again.
const nthOccurrence = (anchor, recurrence, n) => {
    const days = DAY_STEP[recurrence];
    // Day arithmetic rather than milliseconds: a week is not always 7×24h once
    // daylight saving moves, and an hour of drift would land on the wrong date.
    if (days) {
        return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + n * days);
    }
    const months = recurrence === 'monthly' ? n : n * 12;
    const at = new Date(anchor.getFullYear(), anchor.getMonth() + months, anchor.getDate());
    // A short month rolls into the next one — that month gets no occurrence.
    return at.getDate() === anchor.getDate() ? at : null;
};

// Where to start counting so a rule anchored years ago doesn't walk every step
// up to the window. Month repeats overshoot by design: the estimate is floored
// and skipped occurrences only ever move the count later.
const firstIndexNear = (anchor, recurrence, windowStart) => {
    const start = fromIso(windowStart);
    if (start <= anchor) return 0;
    const days = DAY_STEP[recurrence];
    if (days) return Math.floor((start - anchor) / (days * DAY_MS));
    const months = (start.getFullYear() - anchor.getFullYear()) * 12
        + (start.getMonth() - anchor.getMonth());
    return recurrence === 'monthly' ? Math.max(0, months) : Math.max(0, Math.floor(months / 12));
};

// The grid asks for about six weeks at a time, so even a daily rule is well
// under this; it exists so a bad `until` can't spin.
const MAX_OCCURRENCES = 500;

const occurrencesFor = (entry, windowStart, windowEnd) => {
    const { date, recurrence = 'once', until } = entry;
    if (!date) return [];
    if (!isRecurring(recurrence)) {
        return date >= windowStart && date <= windowEnd ? [date] : [];
    }

    const last = until && until < windowEnd ? until : windowEnd;
    if (date > last) return [];

    const anchor = fromIso(date);
    const dates = [];
    let n = firstIndexNear(anchor, recurrence, windowStart);
    for (let guard = 0; guard < MAX_OCCURRENCES; guard++, n++) {
        const at = nthOccurrence(anchor, recurrence, n);
        if (!at) continue;                    // a month this rule skips
        const iso = toIso(at);
        if (iso > last) break;
        if (iso >= windowStart && iso >= date) dates.push(iso);
    }
    return dates;
};

/**
 * Entries (the stored rules) -> calendar events inside [windowStart, windowEnd].
 * Each occurrence is a single-day event carrying its kind, so the grid can
 * colour it and the day dialog can offer to delete the whole series.
 */
export const expandActivityEvents = (entries, windowStart, windowEnd) => {
    if (!Array.isArray(entries) || !windowStart || !windowEnd) return [];

    return entries.flatMap((entry) => {
        const kind = ACTIVITY_KINDS[entry?.kind];
        if (!kind || !entry.title) return [];
        const entryId = entry._id ?? entry.id;
        return occurrencesFor(entry, windowStart, windowEnd).map((iso) => ({
            id: `activity-${entryId}-${iso}`,
            title: entry.title,
            start: iso,
            end: iso,
            time: entry.time || undefined,
            notes: entry.notes || undefined,
            activity: {
                entryId,
                kind: entry.kind,
                symbol: kind.symbol,
                label: kind.label,
                recurrence: entry.recurrence || 'once',
                until: entry.until || undefined,
            },
        }));
    });
};

// How a repeat reads in the day dialog, e.g. "every week · until Mar 1, 2027".
export const describeRecurrence = ({ recurrence, until }) => {
    if (!isRecurring(recurrence)) return null;
    const word = RECURRENCES[recurrence].label.toLowerCase();
    if (!until) return word;
    const stops = fromIso(until).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
    return `${word} · until ${stops}`;
};
