// U.S. federal holidays for 2026.
//
// Each event: { id, title, start, end, time?, notes? } — end is inclusive and
// equals start for single-day events. Days show at most MAX_VISIBLE_EVENTS
// lanes; extras collapse to a "+N" marker.
export const MAX_VISIBLE_EVENTS = 3;

export const EVENTS = [
    { id: 'new-years-day-01-01', title: "New Year's Day", start: '2026-01-01', end: '2026-01-01', notes: 'Federal holiday' },
    { id: 'mlk-day-01-19', title: 'Birthday of Martin Luther King, Jr.', start: '2026-01-19', end: '2026-01-19', notes: 'Federal holiday' },
    { id: 'washingtons-birthday-02-16', title: "Washington's Birthday", start: '2026-02-16', end: '2026-02-16', notes: 'Federal holiday' },
    { id: 'memorial-day-05-25', title: 'Memorial Day', start: '2026-05-25', end: '2026-05-25', notes: 'Federal holiday' },
    { id: 'juneteenth-06-19', title: 'Juneteenth National Independence Day', start: '2026-06-19', end: '2026-06-19', notes: 'Federal holiday' },
    { id: 'independence-day-07-04', title: 'Independence Day', start: '2026-07-04', end: '2026-07-04', notes: 'Federal holiday' },
    { id: 'labor-day-09-07', title: 'Labor Day', start: '2026-09-07', end: '2026-09-07', notes: 'Federal holiday' },
    { id: 'columbus-day-10-12', title: 'Columbus Day', start: '2026-10-12', end: '2026-10-12', notes: 'Federal holiday' },
    { id: 'veterans-day-11-11', title: 'Veterans Day', start: '2026-11-11', end: '2026-11-11', notes: 'Federal holiday' },
    { id: 'thanksgiving-day-11-26', title: 'Thanksgiving Day', start: '2026-11-26', end: '2026-11-26', notes: 'Federal holiday' },
    { id: 'christmas-day-12-25', title: 'Christmas Day', start: '2026-12-25', end: '2026-12-25', notes: 'Federal holiday' },
];
