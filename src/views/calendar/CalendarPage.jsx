import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import { Button } from '@mui/material';
import { Header } from '../../components/Header';
import { EVENTS, MAX_VISIBLE_EVENTS } from './calendarConstants';

import './calendar.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

// Lay one week's events out into lanes. Returns the bar segments to draw
// (with grid columns and a lane index) and a per-column count of events that
// didn't fit in the visible lanes.
const layoutWeek = (week, events) => {
    const isos = week.map((cell) => cell?.iso ?? null);
    const candidates = events
        .filter((e) => isos.some((iso) => iso && e.start <= iso && iso <= e.end))
        .sort((a, b) =>
            a.start.localeCompare(b.start) ||
            b.end.localeCompare(a.end) ||
            a.title.localeCompare(b.title));

    const lanes = []; // lanes[i] = list of [startCol, endCol] taken
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
        if (lane === -1) {
            lane = lanes.length;
            lanes.push([]);
        }
        if (lane >= MAX_VISIBLE_EVENTS) {
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
    const [events, setEvents] = useState(EVENTS);
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState(null);

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

    const deleteSelected = () => {
        setEvents((prev) => prev.filter((e) => e.id !== selectedId));
        setSelectedId(null);
    };

    const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });

    const todayIso = toIsoDate(today.getFullYear(), today.getMonth(), today.getDate());
    const selectedEvent = selectedId
        ? events.find((e) => e.id === selectedId)
        : null;

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
                        <Button size="small" variant="contained" onClick={() => openCreate()}>
                            + Add event
                        </Button>
                    </div>

                    <div className="calendar__weekdays">
                        {WEEKDAYS.map((name) => (
                            <div key={name} className="calendar__weekday">{name}</div>
                        ))}
                    </div>
                    {buildWeeks(year, month).map((week, w) => {
                        const { segments, overflow } = layoutWeek(week, events);
                        return (
                            <div key={w} className="calendar__week">
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
                                {segments.map(({ event, startCol, endCol, lane, continuesLeft, continuesRight }) => (
                                    <button
                                        key={event.id}
                                        className={
                                            'calendar__event' +
                                            (continuesLeft ? ' calendar__event--cont-left' : '') +
                                            (continuesRight ? ' calendar__event--cont-right' : '')
                                        }
                                        style={{
                                            gridColumn: `${startCol + 1} / ${endCol + 2}`,
                                            gridRow: lane + 2,
                                        }}
                                        title={event.title}
                                        onClick={() => setSelectedId(event.id)}
                                    >
                                        {event.title}
                                    </button>
                                ))}
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

            <Dialog open={!!selectedEvent} onClose={() => setSelectedId(null)} fullWidth maxWidth="xs">
                {selectedEvent && (
                    <>
                        <DialogTitle>{selectedEvent.title}</DialogTitle>
                        <DialogContent className="calendar__dialog-content">
                            <p className="calendar__detail">
                                <strong>{selectedEvent.end !== selectedEvent.start ? 'Dates:' : 'Date:'}</strong>{' '}
                                {formatIsoDate(selectedEvent.start)}
                                {selectedEvent.end !== selectedEvent.start &&
                                    ` – ${formatIsoDate(selectedEvent.end)}`}
                            </p>
                            {selectedEvent.time && (
                                <p className="calendar__detail">
                                    <strong>Time:</strong> {formatTime(selectedEvent.time)}
                                </p>
                            )}
                            {selectedEvent.notes && (
                                <p className="calendar__detail">
                                    <strong>Notes:</strong> {selectedEvent.notes}
                                </p>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button color="error" onClick={deleteSelected}>Delete</Button>
                            <Button variant="contained" onClick={() => setSelectedId(null)}>Close</Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </div>
    );
};
