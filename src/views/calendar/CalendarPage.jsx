import React, { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import { Button } from '@mui/material';
import { Header } from '../../components/Header';
import { EVENTS } from './calendarConstants';
import { PLAN_START, PLAN_END, TRACKS, TRACK_RUNS } from './watchPlan';
import { buildDinnerRuns } from './dinnerRotation';
import { buildActivityRuns } from './activityRotation';
import { buildMovieRuns } from './movieRotation';
import { buildRestaurantRuns } from './restaurantRotation';
import { buildNewShowRuns } from './newShowRotation';
import { getDinners, getMovies, getRestaurants, getShows } from './dinnersServer';
import { getActivities } from '../bump/server';

import './calendar.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const toIsoDate = (year, month, day) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// Parse as local time (bare ISO dates are otherwise treated as UTC and can
// render as the previous day).
const formatIsoDate = (iso) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

// "14:30" (the time input's value format) -> "2:30 PM".
const formatTime = (time) =>
    new Date(`1970-01-01T${time}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    });

// Every track runs in parallel, so no day belongs to one track — on any date each
// track is simply partway through a show. That makes the only things worth
// drawing on a month grid the moments something *changes*: 119 switches across
// nearly three years, roughly three a month, versus a mark on all 1,024 days.
const SHOW_RUNS = Object.entries(TRACK_RUNS).flatMap(([code, runs]) =>
    runs.map((show, i) => ({ id: `run-${code}-${i}`, code, show, index: i })));

// One event per switch-over, on the day that item takes over its track. Tracks
// flagged gridSilent never reach the grid — a daily-changing track would drown
// out the few marks worth noticing.
const changeEventsFor = (runs) => runs
    .filter((run) => !TRACKS[run.code]?.gridSilent)
    .filter((run) => run.show.start > PLAN_START)   // day-one runs aren't "changes"
    .map((run) => ({
        id: `change-${run.id}`,
        title: run.show.title,
        start: run.show.start,
        end: run.show.start,
        run,
    }));

// What every track is on for a given date. Track order follows TRACKS, so a new
// track shows up simply by being declared there and supplying runs.
const slateFor = (iso, runs) => Object.keys(TRACKS)
    .map((code) => {
        const run = runs.find(
            (r) => r.code === code && r.show.start <= iso && iso <= r.show.end);
        return run ? { code, run } : null;
    })
    .filter(Boolean);

// A split show's title carries its season range, e.g. "Friends (S3–4)". In a day
// cell that suffix is the first thing ellipsis eats, so the grid shows the name
// and the season marker as separate pieces and only truncates the name.
const splitTitle = (event) => {
    const show = event.run?.show;
    const match = show?.series && show.title.match(/^(.*) \(([^)]+)\)$/);
    return match ? { name: match[1], part: match[2] } : { name: event.title, part: null };
};

// Weeks of the month: arrays of 7 cells, each { day, iso } or null padding
// so the grid always starts on Sunday.
const buildWeeks = (year, month) => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Array(firstWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
        cells.push({ day, iso: toIsoDate(year, month, day) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
};

const LANE_COUNT = 3;

// Only switch-overs and holidays reach the grid, so a day carries one or two
// marks at most and simple packing is enough — reserving a lane per track would
// leave rows that are empty nearly every day, and would grow with track count.
const layoutWeek = (week, events) => {
    const isos = week.map((cell) => cell?.iso ?? null);
    const candidates = events
        .filter((e) => isos.some((iso) => iso && e.start <= iso && iso <= e.end))
        .sort((a, b) =>
            a.start.localeCompare(b.start) ||
            b.end.localeCompare(a.end) ||
            // a show taking over its track outranks the holiday it lands on
            (b.run ? 1 : 0) - (a.run ? 1 : 0) ||
            a.title.localeCompare(b.title));

    const lanes = [];
    const segments = [];
    const overflow = Array(7).fill(0);
    candidates.forEach((event) => {
        const cols = isos
            .map((iso, c) => (iso && event.start <= iso && iso <= event.end ? c : null))
            .filter((c) => c !== null);
        const startCol = cols[0];
        const endCol = cols[cols.length - 1];
        let lane = lanes.findIndex(
            (taken) => !taken.some(([s, e]) => startCol <= e && endCol >= s));
        if (lane === -1) { lane = lanes.length; lanes.push([]); }
        if (lane >= LANE_COUNT) {
            for (let c = startCol; c <= endCol; c++) overflow[c] += 1;
            return;
        }
        lanes[lane].push([startCol, endCol]);
        segments.push({
            event,
            startCol,
            endCol,
            lane,
            continuesLeft: event.start < isos[startCol],
            continuesRight: event.end > isos[endCol],
        });
    });
    return { segments, overflow };
};

const emptyDraft = { start: '', end: '', title: '', time: '', notes: '' };

export const CalendarPage = () => {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    // Only holiday/custom events live in state; the watch plan is derived and
    // read-only, so it never has to be copied on every add or delete.
    const [events, setEvents] = useState(EVENTS);
    const [selectedDay, setSelectedDay] = useState(null);
    const [focusedTrack, setFocusedTrack] = useState(null);
    const [draft, setDraft] = useState(null);

    // Dinners and activities live in Mongo rather than in the bundle, so both
    // rotations pick up new or edited rows on the next load. Either failing just
    // omits that track.
    const [dinners, setDinners] = useState([]);
    const [activities, setActivities] = useState([]);
    const [movies, setMovies] = useState([]);
    const [restaurants, setRestaurants] = useState([]);
    const [shows, setShows] = useState([]);
    useEffect(() => {
        let live = true;
        getDinners()
            .then((rows) => { if (live && Array.isArray(rows)) setDinners(rows); })
            .catch(() => { /* calendar still works without dinners */ });
        getActivities()
            .then((rows) => { if (live && Array.isArray(rows)) setActivities(rows); })
            .catch(() => { /* calendar still works without activities */ });
        getMovies()
            .then((rows) => { if (live && Array.isArray(rows)) setMovies(rows); })
            .catch(() => { /* calendar still works without movies */ });
        getRestaurants()
            .then((rows) => { if (live && Array.isArray(rows)) setRestaurants(rows); })
            .catch(() => { /* calendar still works without restaurants */ });
        getShows()
            .then((rows) => { if (live && Array.isArray(rows)) setShows(rows); })
            .catch(() => { /* the generated plan stands on its own */ });
        return () => { live = false; };
    }, []);

    // darts added since the plan was generated, queued after it ends
    const newShowRuns = useMemo(() => buildNewShowRuns(shows, PLAN_END), [shows]);

    // built first: the movie track pairs itself to whatever dinner is on
    const dinnerRuns = useMemo(
        () => buildDinnerRuns(dinners, PLAN_START, PLAN_END), [dinners]);

    const planRuns = useMemo(() => [
        ...SHOW_RUNS,
        ...dinnerRuns,
        ...buildActivityRuns(activities, PLAN_START, PLAN_END),
        ...buildMovieRuns(movies, dinnerRuns, PLAN_START, PLAN_END),
        ...buildRestaurantRuns(restaurants, PLAN_START, PLAN_END),
        ...newShowRuns,
    ], [dinnerRuns, activities, movies, restaurants, newShowRuns]);

    const allEvents = useMemo(
        () => [...changeEventsFor(planRuns), ...events], [planRuns, events]);
    const weeks = useMemo(() => buildWeeks(year, month), [year, month]);

    // Only the events touching the visible grid reach layoutWeek — otherwise
    // every week re-scans all ~1,100 plan nights.
    const visibleEvents = useMemo(() => {
        const cells = weeks.flat().filter(Boolean);
        if (!cells.length) return [];
        const first = cells[0].iso;
        const last = cells[cells.length - 1].iso;
        return allEvents.filter((e) => e.end >= first && e.start <= last);
    }, [allEvents, weeks]);

    const changeMonth = (delta) => {
        const next = new Date(year, month + delta, 1);
        setYear(next.getFullYear());
        setMonth(next.getMonth());
    };

    const goToToday = () => {
        setYear(today.getFullYear());
        setMonth(today.getMonth());
    };

    const openCreate = (isoDate) =>
        setDraft({ ...emptyDraft, start: isoDate ?? toIsoDate(year, month, 1) });

    const saveDraft = () => {
        if (!draft.title.trim() || !draft.start) return;
        const end = draft.end && draft.end > draft.start ? draft.end : draft.start;
        setEvents((prev) => [
            ...prev,
            {
                id: `custom-${Date.now()}`,
                title: draft.title.trim(),
                start: draft.start,
                end,
                time: draft.time || undefined,
                notes: draft.notes.trim() || undefined,
            },
        ]);
        setDraft(null);
    };

    const deleteEvent = (id) => setEvents((prev) => prev.filter((e) => e.id !== id));

    const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });

    const todayIso = toIsoDate(today.getFullYear(), today.getMonth(), today.getDate());

    // The strip reports on today when today is on screen, otherwise on the
    // first of whatever month is being viewed.
    const anchorIso = useMemo(() => {
        const first = toIsoDate(year, month, 1);
        const last = toIsoDate(year, month, new Date(year, month + 1, 0).getDate());
        return todayIso >= first && todayIso <= last ? todayIso : first;
    }, [year, month, todayIso]);

    // Every track is mid-show on any given date — that is the whole slate.
    const inFlight = useMemo(() => slateFor(anchorIso, planRuns), [anchorIso, planRuns]);

    // Clicking a day opens the same slate for that date, plus whatever else it holds.
    const dayDetail = useMemo(() => {
        if (!selectedDay) return null;
        return {
            iso: selectedDay,
            slate: slateFor(selectedDay, planRuns),
            others: allEvents.filter(
                (e) => !e.run && e.start <= selectedDay && selectedDay <= e.end),
            changes: allEvents.filter((e) => e.run && e.start === selectedDay),
        };
    }, [selectedDay, allEvents, planRuns]);

    const daysInto = (run, iso) => {
        const from = new Date(`${run.show.start}T00:00:00`);
        const at = new Date(`${iso}T00:00:00`);
        const total = (new Date(`${run.show.end}T00:00:00`) - from) / 86400000 + 1;
        return { day: Math.round((at - from) / 86400000) + 1, total: Math.round(total) };
    };

    const yearOptions = useMemo(() => {
        const currentYear = Number(todayIso.slice(0, 4));
        const years = allEvents.map((e) => Number(e.start.slice(0, 4)));
        newShowRuns.forEach((r) => years.push(Number(r.show.end.slice(0, 4))));
        const min = Math.min(currentYear, ...years);
        const max = Math.max(currentYear, ...years);
        return Array.from({ length: max - min + 1 }, (_, i) => min + i);
    }, [allEvents, todayIso, newShowRuns]);

    return (
        <div className="page">
            <Header />
            <div className="calendar-page">
                <div className="calendar">
                    <div className="calendar__toolbar">
                        <Button variant="outlined" onClick={() => changeMonth(-1)}>
                            ‹ Prev
                        </Button>
                        <h1 className="calendar__title">{monthLabel}</h1>
                        <Button variant="outlined" onClick={() => changeMonth(1)}>
                            Next ›
                        </Button>
                    </div>
                    <div className="calendar__toolbar calendar__toolbar--secondary">
                        <Button size="small" onClick={goToToday}>Today</Button>
                        <label className="calendar__jump">
                            <span className="calendar__sr-only">Month</span>
                            <select
                                value={month}
                                onChange={(e) => setMonth(Number(e.target.value))}
                            >
                                {MONTHS.map((name, i) => (
                                    <option key={name} value={i}>{name}</option>
                                ))}
                            </select>
                        </label>
                        <label className="calendar__jump">
                            <span className="calendar__sr-only">Year</span>
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                            >
                                {yearOptions.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </label>
                        <Button size="small" variant="contained" onClick={() => openCreate()}>
                            + Add event
                        </Button>
                    </div>

                    {inFlight.length > 0 && (
                        <div className="calendar__inflight">
                            <p className="calendar__inflight-title">
                                In rotation on {formatIsoDate(anchorIso)}
                                <span className="calendar__inflight-hint">
                                    all running at once — click any day to see its slate
                                </span>
                            </p>
                            {inFlight.map(({ code, run }) => {
                                const { day, total } = daysInto(run, anchorIso);
                                const on = focusedTrack === code;
                                return (
                                    <button
                                        key={code}
                                        type="button"
                                        aria-pressed={on}
                                        title={on ? 'Hide this track on the calendar'
                                                  : `Trace ${TRACKS[code].label} through the month`}
                                        onClick={() => setFocusedTrack(on ? null : code)}
                                        className={`calendar__inflight-row calendar__inflight-row--${TRACKS[code].key}`
                                            + (on ? ' calendar__inflight-row--on' : '')
                                            + (focusedTrack && !on ? ' calendar__inflight-row--off' : '')}
                                    >
                                        <span className={`calendar__track-dot calendar__track-dot--${TRACKS[code].key}`} />
                                        <span className="calendar__inflight-track">
                                            <span className="calendar__track-icon">{TRACKS[code].icon}</span>
                                            {TRACKS[code].label}
                                        </span>
                                        <span className="calendar__inflight-show">{run.show.title}</span>
                                        <span className="calendar__inflight-progress">
                                            <span
                                                className={`calendar__inflight-fill calendar__inflight-fill--${TRACKS[code].key}`}
                                                style={{ width: `${Math.min(100, (day / total) * 100)}%` }}
                                            />
                                        </span>
                                        <span className="calendar__inflight-count">
                                            {run.code === 'r'
                                                ? <>{run.show.poolSize}&nbsp;places</>
                                                : run.code === 'm'
                                                ? <>{run.show.poolSize}&nbsp;films</>
                                                : run.show.symbol && run.code !== 'n'
                                                    ? <>{run.show.poolSize}&nbsp;options</>
                                                    : <>{run.show.nights}&nbsp;nights</>}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="calendar__weekdays">
                        {WEEKDAYS.map((name) => (
                            <div key={name} className="calendar__weekday">{name}</div>
                        ))}
                    </div>
                    {weeks.map((week, w) => {
                        const { segments, overflow } = layoutWeek(week, visibleEvents);
                        const isos = week.map((c) => c?.iso ?? null);
                        // The focused track draws a continuous throughline across
                        // the days it covers — including tracks the grid normally
                        // stays silent about.
                        const throughlines = focusedTrack
                            ? planRuns
                                .filter((r) => r.code === focusedTrack)
                                .map((r) => {
                                    const cols = isos
                                        .map((iso, c) => (iso && r.show.start <= iso && iso <= r.show.end ? c : null))
                                        .filter((c) => c !== null);
                                    if (!cols.length) return null;
                                    return {
                                        id: r.id,
                                        title: r.show.title,
                                        startCol: cols[0],
                                        endCol: cols[cols.length - 1],
                                        opensLeft: r.show.start < isos[cols[0]],
                                        opensRight: r.show.end > isos[cols[cols.length - 1]],
                                    };
                                })
                                .filter(Boolean)
                            : [];
                        return (
                            <div key={w} className={'calendar__week' + (focusedTrack ? ' calendar__week--focused' : '')}>
                                {week.map((cell, c) => {
                                    if (!cell) {
                                        return (
                                            <div
                                                key={`pad-${c}`}
                                                className="calendar__day calendar__day--empty"
                                                style={{ gridColumn: c + 1 }}
                                            />
                                        );
                                    }
                                    return (
                                        <div
                                            key={cell.iso}
                                            className={`calendar__day${cell.iso === todayIso ? ' calendar__day--today' : ''}`}
                                            style={{ gridColumn: c + 1 }}
                                        >
                                            {/* A blank day is not an empty day — every track is
                                                still mid-show, so the whole cell opens the slate. */}
                                            <button
                                                className="calendar__day-open"
                                                aria-label={`See what's on for ${cell.iso}`}
                                                onClick={() => setSelectedDay(cell.iso)}
                                            />
                                            <span className="calendar__day-top">
                                                <span className="calendar__day-number">{cell.day}</span>
                                                <button
                                                    className="calendar__add"
                                                    title="Add event"
                                                    aria-label={`Add event on ${cell.iso}`}
                                                    onClick={() => openCreate(cell.iso)}
                                                >
                                                    +
                                                </button>
                                            </span>
                                            {overflow[c] > 0 && (
                                                <span className="calendar__more">+{overflow[c]}</span>
                                            )}
                                        </div>
                                    );
                                })}
                                {throughlines.map((t) => (
                                    <span
                                        key={`thru-${t.id}`}
                                        className={
                                            `calendar__thru calendar__thru--${TRACKS[focusedTrack].key}`
                                            + (t.opensLeft ? ' calendar__thru--open-left' : '')
                                            + (t.opensRight ? ' calendar__thru--open-right' : '')
                                        }
                                        style={{ gridColumn: `${t.startCol + 1} / ${t.endCol + 2}`, gridRow: 2 }}
                                        title={t.title}
                                    >
                                        <span className="calendar__thru-label">{t.title}</span>
                                    </span>
                                ))}
                                {segments.map(({ event, startCol, endCol, lane, continuesLeft, continuesRight }) => {
                                    const { name, part } = splitTitle(event);
                                    return (
                                    <button
                                        key={event.id}
                                        className={
                                            'calendar__event' +
                                            // plan nights carry their track's colour; holidays go
                                            // recessive so colour stays meaningful; events you add
                                            // yourself keep the original blue
                                            (event.run
                                                ? ` calendar__event--${TRACKS[event.run.code].key}`
                                                : event.id.startsWith('custom-')
                                                    ? ''
                                                    : ' calendar__event--holiday') +
                                            (continuesLeft ? ' calendar__event--cont-left' : '') +
                                            (continuesRight ? ' calendar__event--cont-right' : '')
                                        }
                                        style={{
                                            gridColumn: `${startCol + 1} / ${endCol + 2}`,
                                            gridRow: lane + 2,
                                        }}
                                        title={event.run ? `${event.title} takes over` : event.title}
                                        onClick={() => setSelectedDay(event.start)}
                                    >
                                        {event.run && (
                                            <span
                                                className="calendar__event-anchor"
                                                aria-hidden="true"
                                            >
                                                ▶
                                            </span>
                                        )}
                                        <span className="calendar__event-name">{name}</span>
                                        {part && <span className="calendar__event-part">{part}</span>}
                                    </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>

            <Dialog open={draft !== null} onClose={() => setDraft(null)} fullWidth maxWidth="xs">
                <DialogTitle>New event</DialogTitle>
                <DialogContent className="calendar__dialog-content">
                    <TextField
                        label="Title"
                        value={draft?.title ?? ''}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        size="small"
                        autoFocus
                    />
                    <TextField
                        label="Start date"
                        type="date"
                        value={draft?.start ?? ''}
                        onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                        size="small"
                        InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                        label="End date (optional)"
                        type="date"
                        value={draft?.end ?? ''}
                        onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                        size="small"
                        InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                        label="Time (optional)"
                        type="time"
                        value={draft?.time ?? ''}
                        onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                        size="small"
                        InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                        label="Notes (optional)"
                        value={draft?.notes ?? ''}
                        onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                        size="small"
                        multiline
                        minRows={2}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDraft(null)}>Cancel</Button>
                    <Button
                        variant="contained"
                        disabled={!draft?.title.trim() || !draft?.start}
                        onClick={saveDraft}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Clicking any day shows every track at once — the grid only marks
                the switch-overs, so this is where "what's on" actually lives. */}
            <Dialog open={!!dayDetail} onClose={() => setSelectedDay(null)} fullWidth maxWidth="sm">
                {dayDetail && (
                    <>
                        <DialogTitle>{formatIsoDate(dayDetail.iso)}</DialogTitle>
                        <DialogContent className="calendar__dialog-content">
                            {dayDetail.others.map((e) => (
                                <p key={e.id} className="calendar__detail">
                                    <strong>{e.title}</strong>
                                    {e.time && <> · {formatTime(e.time)}</>}
                                    {e.notes && (
                                        <span className="calendar__detail-muted"> — {e.notes}</span>
                                    )}
                                    {e.id.startsWith('custom-') && (
                                        <Button
                                            size="small"
                                            color="error"
                                            onClick={() => deleteEvent(e.id)}
                                        >
                                            Delete
                                        </Button>
                                    )}
                                </p>
                            ))}

                            <p className="calendar__slate-heading">In rotation</p>
                            {dayDetail.slate.map(({ code, run }) => {
                                const { day, total } = daysInto(run, dayDetail.iso);
                                const isNew = run.show.start === dayDetail.iso;
                                return (
                                    <div key={code} className="calendar__slate-row">
                                        <span className={`calendar__slate-bar calendar__slate-bar--${TRACKS[code].key}`} />
                                        <span className="calendar__slate-body">
                                            <span className="calendar__slate-track">
                                                <span className="calendar__track-icon">{TRACKS[code].icon}</span>
                                                {TRACKS[code].label}
                                                <span className="calendar__detail-muted">
                                                    {' '}({TRACKS[code].types})
                                                </span>
                                            </span>
                                            <span className="calendar__slate-title">
                                                {run.show.title}
                                                {isNew && (
                                                    <span className="calendar__slate-new">starts today</span>
                                                )}
                                                {run.show.holidayDate === dayDetail.iso && (
                                                    <span className="calendar__slate-new calendar__slate-new--holiday">
                                                        ★ {run.show.holiday} pick
                                                    </span>
                                                )}
                                            </span>
                                            {run.code === 'r' ? (
                                                <>
                                                    <span className="calendar__slate-meta">
                                                        {run.show.cuisine}
                                                        {run.show.neighborhood && ` · ${run.show.neighborhood}`}
                                                        {run.show.address && ` · ${run.show.address}`}
                                                        {` · 1 of ${run.show.poolSize} to try`}
                                                    </span>
                                                    {run.show.note && (
                                                        <span className="calendar__slate-meta">{run.show.note}</span>
                                                    )}
                                                </>
                                            ) : run.code === 'm' ? (
                                                <>
                                                    <span className="calendar__slate-meta">
                                                        {run.show.curated ? 'a curated pick' : 'from your Letterboxd export'}
                                                        {run.show.rating !== undefined && ` · ${run.show.rating}★`}
                                                        {run.show.heartlighted !== undefined
                                                            && ` · heartlighted ${run.show.heartlighted}`}
                                                        {run.show.liked && ' · liked'}
                                                        {run.show.watched ? ' · seen before' : ' · not seen yet'}
                                                        {` · 1 of ${run.show.poolSize} on this track`}
                                                    </span>
                                                    {run.show.pairedTo && (
                                                        <span className="calendar__slate-meta">
                                                            paired with tonight's {run.show.pairedTo} dinner
                                                        </span>
                                                    )}
                                                    {run.show.lists?.length > 0 && (
                                                        <span className="calendar__slate-meta">
                                                            on your list{run.show.lists.length > 1 ? 's' : ''}:{' '}
                                                            {run.show.lists.join(', ')}
                                                        </span>
                                                    )}
                                                    {run.show.blurb && (
                                                        <span className="calendar__slate-meta">{run.show.blurb}</span>
                                                    )}
                                                </>
                                            ) : run.show.symbol && run.code !== 'n' ? (
                                                <span className="calendar__slate-meta">
                                                    {run.show.involved
                                                        ? 'the more involved pick, so it sits on a Saturday'
                                                        : 'an easier option for a weekday'}
                                                    {' · '}1 of {run.show.poolSize} on this track
                                                </span>
                                            ) : run.code === 'n' ? (
                                                <>
                                                    <span className="calendar__slate-meta">
                                                        week {run.show.weekNumber} · {run.show.cuisine}
                                                        {run.show.occasion && ` · ${run.show.occasion}`}
                                                        {' · '}serves {run.show.servesNights} night
                                                        {run.show.servesNights === 1 ? '' : 's'}
                                                    </span>
                                                    {run.show.blurb && (
                                                        <span className="calendar__slate-meta">
                                                            {run.show.blurb}
                                                        </span>
                                                    )}
                                                    {run.show.supporting.length > 0 && (
                                                        <span className="calendar__slate-meta">
                                                            also this week:{' '}
                                                            {run.show.supporting
                                                                .map((s) => `${s.dinner} (${s.servesNights}n)`)
                                                                .join(' · ')}
                                                        </span>
                                                    )}
                                                    {(run.show.sides.length > 0 || run.show.dessert) && (
                                                        <span className="calendar__slate-meta">
                                                            {run.show.sides.join(', ')}
                                                            {run.show.sides.length > 0 && run.show.dessert && ' · '}
                                                            {run.show.dessert}
                                                        </span>
                                                    )}
                                                    {run.show.recipes.length > 0 && (
                                                        <span className="calendar__slate-meta">
                                                            {run.show.recipes.map((r) => (
                                                                <a
                                                                    key={r.url}
                                                                    className={
                                                                        'calendar__recipe'
                                                                        + (r.verified === false
                                                                            ? ' calendar__recipe--unverified' : '')
                                                                    }
                                                                    href={r.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    title={r.verified === false
                                                                        ? 'This link did not resolve when last checked'
                                                                        : r.url}
                                                                >
                                                                    {r.label}
                                                                    {r.verified === false && ' ⚠'}
                                                                </a>
                                                            ))}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <span className="calendar__slate-meta">
                                                        day {day} of {total} · about {run.show.nights} nights
                                                        of viewing · {run.show.rating}★ · heartlighted{' '}
                                                        {run.show.heartlighted} · enneagram {run.show.enneagram}
                                                    </span>
                                                    {run.show.addedLater && (
                                                        <span className="calendar__slate-meta">
                                                            added to the board after the plan was built, so it
                                                            is queued at the end of this track — length is a
                                                            placeholder, not a real runtime
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                            {(run.show.series || run.show.cut) && (
                                                <span className="calendar__slate-meta">
                                                    {run.show.series && (
                                                        <>block {run.show.part} of {run.show.parts}{' '}
                                                        for {run.show.series}</>
                                                    )}
                                                    {run.show.series && run.show.cut && ' · '}
                                                    {run.show.cut && <>watching {run.show.cut}</>}
                                                </span>
                                            )}
                                            <span className="calendar__slate-range">
                                                {formatIsoDate(run.show.start)} – {formatIsoDate(run.show.end)}
                                            </span>
                                        </span>
                                    </div>
                                );
                            })}
                            <p className="calendar__detail calendar__detail-muted">
                                All tracks run in parallel — watch whichever you feel like tonight.
                                Runtimes are estimates.
                            </p>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => openCreate(dayDetail.iso)}>Add event</Button>
                            <Button variant="contained" onClick={() => setSelectedDay(null)}>Close</Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </div>
    );
};
