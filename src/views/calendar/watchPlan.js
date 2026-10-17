// The watch plan for the shows on the /darts board.
//
// Every track runs in PARALLEL — none of them takes a night away from another.
// A track is simply "on" one show across a date range, and you watch it whenever
// you like inside that window. There is deliberately no per-night assignment:
// the plan says what is in rotation and when it changes, not what to watch tonight.
//
// Every show gets exactly one week on its track: seven days, Sunday to
// Saturday, however long it runs, starting from PLAN_START. All three tracks
// change over together every Sunday. `nights` and `hours` are only a guide to
// how much there is to watch.
//
// Tracks come from each show's `enneagram` value grouped into the enneagram's
// three Centers, so nothing here is hand-classified by genre. Adding a new track
// (movies, dinners, outings) means adding a key to TRACKS and TRACK_RUNS —
// no changes to CalendarPage.
//
// Shows that fall off are cut to their good seasons (`cut`). Lower-star long
// shows are broken into season blocks (`series`/`part`/`parts`), and each block
// is its own week. A holiday pick (`holiday`) waits for the week that contains
// its holiday; once a track has nothing else left, its waiting picks go next
// in order and lose the label.
//
// Generated from the live get_darts "Shows" board. Runtimes are estimates —
// the darts records store no episode count or runtime.

import { EVENTS } from './calendarConstants';

// A Sunday: every show week runs Sunday to Saturday from here.
export const PLAN_START = '2026-08-02';
// The food tracks still run to here; the show tracks end where their queues do.
export const PLAN_END = '2029-05-21';

export const WEEK_DAYS = 7;

// `family` groups tracks for colour; `icon` distinguishes tracks within a family.
//
// The dinner track has no entry in TRACK_RUNS below: its rotation is built at
// runtime from the `dinners` collection, so adding or editing a meal in Mongo
// changes the calendar without a rebuild. Any future track can work the same way
// — declare it here, supply runs from wherever they live.
export const DINNER_TRACK = 'n';

// `gridSilent` keeps a track out of the month grid entirely — it still appears
// in the day slate and the in-rotation strip, it just never draws a chip.
//
// Every generated track is silent now. The grid is left to say only two things:
// a show took over its track, and you put something on this day yourself. Food
// runs continuously — a dinner every night of every week, a menu meal every
// night, a restaurant every Friday — so drawn on the grid it stopped being news
// and started being wallpaper. It all still lives one click away in the day.
//
// Activities are deliberately *not* a track: they used to cycle through three
// pools and assign themselves to every day, which asserted plans nobody made.
// They are now scheduled by hand — see activityEvents.js — and being hand-made
// is exactly what earns them a place on the grid.
// Declaration order is display order, in the strip and in the day slate alike.
// The restaurant leads the food tracks: it's the one that only comes round on a
// Friday, so it's the one worth seeing before the menu that offers something
// every night. The 52-week menu goes last: it's the one that changes least often
// and the one you're least likely to be checking, so it shouldn't lead.
export const TRACKS = {
    r: { key: 'restaurant', label: 'New restaurant', types: 'Friday nights, Lakewood',
         family: 'eat', icon: '🍴', gridSilent: true },
    // The second dinner track — see nalasMenuRotation.js.
    nm: { key: 'nalas', label: "Nala's menu", types: 'meals you wrote out', family: 'eat',
          icon: '🥘', gridSilent: true },
    m: { key: 'movie', label: 'Movies', types: '4★ and up', family: 'watch', icon: '🎬',
         gridSilent: true },
    // Head, heart, body: the three Centers, each with a new show every week.
    d: { key: 'head', label: 'Head / Thinking', types: 'types 5, 6, 7', family: 'watch', icon: '🧠' },
    h: { key: 'heart', label: 'Heart / Feeling', types: 'types 2, 3, 4', family: 'watch', icon: '💗' },
    g: { key: 'gut', label: 'Body / Instinct', types: 'types 8, 9, 1', family: 'watch', icon: '🔥' },
    n: { key: 'dinner', label: 'Dinners', types: 'a 52-week menu', family: 'eat', icon: '🍽️',
         gridSilent: true },
};

// The queue, in watch order. Dates are assigned by weeklyRuns below.
const QUEUE = {
    g: [
        { title: 'Designated Survivor', nights: 19, hours: 38.0, enneagram: 1, rating: 4.5, heartlighted: 4 },
        { title: 'Jack Ryan', nights: 4, hours: 6.7, enneagram: 1, rating: 4, heartlighted: 3, cut: 'S1–1 of 4' },
        { title: 'Arcane', nights: 7, hours: 12.6, enneagram: 8, rating: 5, heartlighted: 2 },
        { title: 'Vinland Saga', nights: 10, hours: 19.2, enneagram: 8, rating: 4, heartlighted: 1 },
        { title: 'Rick & Morty', nights: 15, hours: 29.7, enneagram: 8, rating: 4.5, heartlighted: 1 },
        { title: 'The Walking Dead (S1)', nights: 5, hours: 9.8, enneagram: 1, rating: 4, heartlighted: 1, series: 'The Walking Dead', part: 1, parts: 5, cut: 'S1–5 of 11' },
        { title: 'House of Cards (S1)', nights: 6, hours: 10.3, enneagram: 1, rating: 4, heartlighted: 1, series: 'House of Cards', part: 1, parts: 6 },
        { title: 'Breaking Bad', nights: 25, hours: 48.6, enneagram: 8, rating: 4.5, heartlighted: 2 },
        { title: 'Invincible', nights: 9, hours: 18.0, enneagram: 9, rating: 4.5, heartlighted: 4 },
        { title: 'Frieren: Beyond Journeys End', nights: 6, hours: 11.2, enneagram: 9, rating: 5, heartlighted: 6 },
        { title: 'Top Gun', nights: 1, hours: 1.8, enneagram: 8, rating: 4, heartlighted: 4, holiday: 'July 4th' },
        { title: 'Freaks and Geeks', nights: 7, hours: 13.5, enneagram: 9, rating: 5, heartlighted: 6 },
        { title: 'House of Cards (S2)', nights: 6, hours: 10.3, enneagram: 1, rating: 4, heartlighted: 1, series: 'House of Cards', part: 2, parts: 6 },
        { title: 'The Office', nights: 37, hours: 73.7, enneagram: 9, rating: 5, heartlighted: 6, holiday: 'Christmas' },
        { title: 'The Walking Dead (S2)', nights: 5, hours: 9.8, enneagram: 1, rating: 4, heartlighted: 1, series: 'The Walking Dead', part: 2, parts: 5, cut: 'S1–5 of 11' },
        { title: 'House of Cards (S3)', nights: 6, hours: 10.3, enneagram: 1, rating: 4, heartlighted: 1, series: 'House of Cards', part: 3, parts: 6 },
        { title: '24 (S1)', nights: 9, hours: 17.6, enneagram: 1, rating: 4, heartlighted: 3, series: '24', part: 1, parts: 5, cut: 'S1–5 of 9' },
        { title: 'The Walking Dead (S3)', nights: 5, hours: 9.8, enneagram: 1, rating: 4, heartlighted: 1, series: 'The Walking Dead', part: 3, parts: 5, cut: 'S1–5 of 11' },
        { title: 'House of Cards (S4)', nights: 6, hours: 10.3, enneagram: 1, rating: 4, heartlighted: 1, series: 'House of Cards', part: 4, parts: 6 },
        { title: '24 (S2)', nights: 9, hours: 17.6, enneagram: 1, rating: 4, heartlighted: 3, series: '24', part: 2, parts: 5, cut: 'S1–5 of 9' },
        { title: 'Daredevil (S1)', nights: 6, hours: 10.8, enneagram: 1, rating: 4, heartlighted: 3, series: 'Daredevil', part: 1, parts: 3 },
        { title: 'Parks & Recreation', nights: 23, hours: 45.8, enneagram: 8, rating: 5, heartlighted: 6, holiday: 'July 4th' },
        { title: 'The Boys', nights: 16, hours: 32.0, enneagram: 8, rating: 4.5, heartlighted: 3 },
        { title: '24 (S3)', nights: 9, hours: 17.6, enneagram: 1, rating: 4, heartlighted: 3, series: '24', part: 3, parts: 5, cut: 'S1–5 of 9' },
        { title: 'Demon Slayer: Kimetsu No Yaiba', nights: 11, hours: 22.0, enneagram: 1, rating: 4.5, heartlighted: 3 },
        { title: 'House of Cards (S5)', nights: 6, hours: 10.3, enneagram: 1, rating: 4, heartlighted: 1, series: 'House of Cards', part: 5, parts: 6 },
        { title: 'The Walking Dead (S4)', nights: 5, hours: 9.8, enneagram: 1, rating: 4, heartlighted: 1, series: 'The Walking Dead', part: 4, parts: 5, cut: 'S1–5 of 11' },
        { title: '24 (S4)', nights: 9, hours: 17.6, enneagram: 1, rating: 4, heartlighted: 3, series: '24', part: 4, parts: 5, cut: 'S1–5 of 9' },
        { title: 'House of Cards (S6)', nights: 6, hours: 10.3, enneagram: 1, rating: 4, heartlighted: 1, series: 'House of Cards', part: 6, parts: 6 },
        { title: 'Daredevil (S2)', nights: 6, hours: 10.8, enneagram: 1, rating: 4, heartlighted: 3, series: 'Daredevil', part: 2, parts: 3 },
        { title: 'The Walking Dead (S5)', nights: 5, hours: 9.8, enneagram: 1, rating: 4, heartlighted: 1, series: 'The Walking Dead', part: 5, parts: 5, cut: 'S1–5 of 11' },
        { title: 'Adolescence', nights: 2, hours: 4.0, enneagram: 1, rating: 4.5, heartlighted: 2 },
        { title: '24 (S5)', nights: 9, hours: 17.6, enneagram: 1, rating: 4, heartlighted: 3, series: '24', part: 5, parts: 5, cut: 'S1–5 of 9' },
        { title: 'Beef', nights: 3, hours: 5.8, enneagram: 1, rating: 5, heartlighted: 3 },
        { title: 'Daredevil (S3)', nights: 6, hours: 10.8, enneagram: 1, rating: 4, heartlighted: 3, series: 'Daredevil', part: 3, parts: 3 },
        { title: 'Mr. Bean', nights: 4, hours: 6.25, enneagram: 9, rating: 4, heartlighted: 6 },
    ],
    h: [
        { title: 'My Hero Academia', nights: 32, hours: 63.6, enneagram: 3, rating: 4.5, heartlighted: 5 },
        { title: 'The Morning Show', nights: 14, hours: 27.5, enneagram: 3, rating: 4.0, heartlighted: 3.5 },
        { title: 'Ted Lasso', nights: 10, hours: 19.3, enneagram: 3, rating: 4.5, heartlighted: 5, holiday: 'Christmas' },
        { title: 'How I Met Your Mother', nights: 39, hours: 76.3, enneagram: 4, rating: 5, heartlighted: 4 },
        { title: 'Hacks', nights: 11, hours: 21.0, enneagram: 3, rating: 3.5, heartlighted: 5 },
        { title: 'New Girl', nights: 27, hours: 53.5, enneagram: 2, rating: 4.5, heartlighted: 6 },
        { title: 'Scott Pilgrim Takes Off', nights: 2, hours: 3.3, enneagram: 4, rating: 4, heartlighted: 7 },
        { title: 'Avatar: TLA', nights: 12, hours: 23.4, enneagram: 2, rating: 5, heartlighted: 4 },
        { title: 'Lovesick', nights: 5, hours: 8.8, enneagram: 4, rating: 4, heartlighted: 6 },
        { title: 'Sex Education', nights: 15, hours: 28.3, enneagram: 4, rating: 4, heartlighted: 4 },
        { title: 'What We Do in the Shadows', nights: 13, hours: 26.0, enneagram: 4, rating: 4.5, heartlighted: 6, holiday: 'Halloween' },
        { title: 'Living With Yourself', nights: 2, hours: 4.0, enneagram: 4, rating: 4, heartlighted: 3 },
        { title: 'Fullmetal Alchemist: Brotherhood', nights: 13, hours: 25.6, enneagram: 3, rating: 5, heartlighted: 3 },
        { title: 'The Squid Game', nights: 8, hours: 15.6, enneagram: 3, rating: 4.5, heartlighted: 2 },
        { title: 'Dave', nights: 9, hours: 16.7, enneagram: 3, rating: 4, heartlighted: 4 },
        { title: 'Fleabag', nights: 3, hours: 5.0, enneagram: 4, rating: 5, heartlighted: 3 },
        { title: 'Modern Family (S1–2)', nights: 8, hours: 15.3, enneagram: 2, rating: 4, heartlighted: 6, series: 'Modern Family', part: 1, parts: 6 },
        { title: 'Good Girls (S1)', nights: 5, hours: 9.1, enneagram: 3, rating: 4, heartlighted: 4, series: 'Good Girls', part: 1, parts: 4 },
        { title: 'glee (S1)', nights: 8, hours: 15.4, enneagram: 2, rating: 3.5, heartlighted: 5, series: 'glee', part: 1, parts: 3, cut: 'S1–3 of 6' },
        { title: 'The Great', nights: 5, hours: 9.2, enneagram: 3, rating: 4, heartlighted: 5, cut: 'S1–1 of 3' },
        { title: 'Good Girls (S2)', nights: 5, hours: 9.1, enneagram: 3, rating: 4, heartlighted: 4, series: 'Good Girls', part: 2, parts: 4 },
        { title: 'Modern Family (S3–4)', nights: 8, hours: 15.3, enneagram: 2, rating: 4, heartlighted: 6, series: 'Modern Family', part: 2, parts: 6 },
        { title: 'glee (S2)', nights: 8, hours: 15.4, enneagram: 2, rating: 3.5, heartlighted: 5, series: 'glee', part: 2, parts: 3, cut: 'S1–3 of 6' },
        { title: 'The Marvelous Mrs. Maisel', nights: 20, hours: 39.4, enneagram: 3, rating: 4.5, heartlighted: 5 },
        { title: 'Modern Family (S5–6)', nights: 8, hours: 15.3, enneagram: 2, rating: 4, heartlighted: 6, series: 'Modern Family', part: 3, parts: 6 },
        { title: 'glee (S3)', nights: 8, hours: 15.4, enneagram: 2, rating: 3.5, heartlighted: 5, series: 'glee', part: 3, parts: 3, cut: 'S1–3 of 6' },
        { title: 'Good Girls (S3)', nights: 5, hours: 9.1, enneagram: 3, rating: 4, heartlighted: 4, series: 'Good Girls', part: 3, parts: 4 },
        { title: 'The Gentlemen', nights: 4, hours: 6.7, enneagram: 3, rating: 4, heartlighted: 4 },
        { title: 'Bojack Horseman', nights: 17, hours: 33.4, enneagram: 4, rating: 4.5, heartlighted: 3 },
        { title: 'Modern Family (S7)', nights: 8, hours: 15.3, enneagram: 2, rating: 4, heartlighted: 6, series: 'Modern Family', part: 4, parts: 6, holiday: 'Christmas' },
        { title: 'Death Note', nights: 8, hours: 14.2, enneagram: 3, rating: 5, heartlighted: 2 },
        { title: 'Your Lie in April', nights: 5, hours: 8.8, enneagram: 4, rating: 3.5, heartlighted: 3 },
        { title: 'Modern Family (S8–9)', nights: 8, hours: 15.3, enneagram: 2, rating: 4, heartlighted: 6, series: 'Modern Family', part: 5, parts: 6 },
        { title: 'Pachinko', nights: 8, hours: 16.0, enneagram: 4, rating: 4.5, heartlighted: 4 },
        { title: 'Good Girls (S4)', nights: 5, hours: 9.1, enneagram: 3, rating: 4, heartlighted: 4, series: 'Good Girls', part: 4, parts: 4 },
        { title: 'Crashing', nights: 8, hours: 14.4, enneagram: 4, rating: 4.5, heartlighted: 5 },
        { title: 'Modern Family (S10–11)', nights: 8, hours: 15.3, enneagram: 2, rating: 4, heartlighted: 6, series: 'Modern Family', part: 6, parts: 6 },
    ],
    d: [
        { title: 'Cunk on Earth', nights: 2, hours: 2.5, enneagram: 7, rating: 4.5, heartlighted: 7 },
        { title: 'Nathan For You', nights: 6, hours: 11.7, enneagram: 5, rating: 4.5, heartlighted: 7 },
        { title: 'red vs blue (S1–3)', nights: 3, hours: 5.8, enneagram: 7, rating: 3, heartlighted: 6, series: 'red vs blue', part: 1, parts: 6 },
        { title: 'Derry Girls', nights: 4, hours: 7.0, enneagram: 7, rating: 4, heartlighted: 5 },
        { title: 'Sherlock', nights: 10, hours: 19.5, enneagram: 7, rating: 4.5, heartlighted: 5 },
        { title: 'Better Call Saul (S1)', nights: 5, hours: 8.2, enneagram: 6, rating: 4, heartlighted: 2, series: 'Better Call Saul', part: 1, parts: 6 },
        { title: 'Over the Garden Wall', nights: 1, hours: 1.8, enneagram: 6, rating: 5, heartlighted: 4, holiday: 'Halloween' },
        { title: 'Waco', nights: 3, hours: 5.0, enneagram: 5, rating: 4, heartlighted: 3 },
        { title: 'This is Us', nights: 38, hours: 76.0, enneagram: 6, rating: 4.5, heartlighted: 4 },
        { title: 'The Good Place', nights: 10, hours: 19.4, enneagram: 6, rating: 5, heartlighted: 5, holiday: 'Easter' },
        { title: 'Better Call Saul (S2)', nights: 5, hours: 8.2, enneagram: 6, rating: 4, heartlighted: 2, series: 'Better Call Saul', part: 2, parts: 6 },
        { title: 'red vs blue (S4–6)', nights: 3, hours: 5.8, enneagram: 7, rating: 3, heartlighted: 6, series: 'red vs blue', part: 2, parts: 6 },
        { title: 'Friends (S1–2)', nights: 8, hours: 14.4, enneagram: 6, rating: 4, heartlighted: 6, series: 'Friends', part: 1, parts: 6 },
        { title: 'The Eric Andre Show', nights: 6, hours: 11.0, enneagram: 7, rating: 3.5, heartlighted: 7 },
        { title: 'Letterkenny', nights: 13, hours: 26.0, enneagram: 6, rating: 5, heartlighted: 7 },
        { title: 'Friends (S3)', nights: 8, hours: 14.4, enneagram: 6, rating: 4, heartlighted: 6, series: 'Friends', part: 2, parts: 6 },
        { title: 'red vs blue (S7–9)', nights: 3, hours: 5.8, enneagram: 7, rating: 3, heartlighted: 6, series: 'red vs blue', part: 3, parts: 6 },
        { title: 'Gravity Falls', nights: 8, hours: 14.7, enneagram: 6, rating: 5.0, heartlighted: 5.0 },
        { title: 'Friends (S4–5)', nights: 8, hours: 14.4, enneagram: 6, rating: 4, heartlighted: 6, series: 'Friends', part: 3, parts: 6 },
        { title: 'Steins;Gate', nights: 5, hours: 9.6, enneagram: 7, rating: 4.5, heartlighted: 4 },
        { title: 'Better Call Saul (S3)', nights: 5, hours: 8.2, enneagram: 6, rating: 4, heartlighted: 2, series: 'Better Call Saul', part: 3, parts: 6 },
        { title: 'The Bear', nights: 10, hours: 19.0, enneagram: 6, rating: 4.5, heartlighted: 2 },
        { title: 'Attack on Titan', nights: 12, hours: 23.6, enneagram: 6, rating: 4.5, heartlighted: 1, cut: 'S1–3 of 4' },
        { title: 'Better Call Saul (S4)', nights: 5, hours: 8.2, enneagram: 6, rating: 4, heartlighted: 2, series: 'Better Call Saul', part: 4, parts: 6 },
        { title: 'Sword Art Online', nights: 10, hours: 19.2, enneagram: 5, rating: 3.5, heartlighted: 5 },
        { title: 'Pantheon', nights: 4, hours: 8.0, enneagram: 6, rating: 5, heartlighted: 4, holiday: 'Easter' },
        { title: 'Friends (S6–7)', nights: 8, hours: 14.4, enneagram: 6, rating: 4, heartlighted: 6, series: 'Friends', part: 4, parts: 6 },
        { title: 'red vs blue (S10–12)', nights: 3, hours: 5.8, enneagram: 7, rating: 3, heartlighted: 6, series: 'red vs blue', part: 4, parts: 6 },
        { title: 'Haikyuu! (S1)', nights: 5, hours: 8.5, enneagram: 7, rating: 4.0, heartlighted: 5.5, series: 'Haikyuu!', part: 1, parts: 4 },
        { title: 'Friends (S8)', nights: 8, hours: 14.4, enneagram: 6, rating: 4, heartlighted: 6, series: 'Friends', part: 5, parts: 6 },
        { title: 'Shoresy', nights: 6, hours: 12.0, enneagram: 7, rating: 5, heartlighted: 7 },
        { title: 'Better Call Saul (S5)', nights: 5, hours: 8.2, enneagram: 6, rating: 4, heartlighted: 2, series: 'Better Call Saul', part: 5, parts: 6 },
        { title: 'red vs blue (S13–15)', nights: 3, hours: 5.8, enneagram: 7, rating: 3, heartlighted: 6, series: 'red vs blue', part: 5, parts: 6 },
        { title: 'Haikyuu! (S2)', nights: 5, hours: 8.5, enneagram: 7, rating: 4.0, heartlighted: 5.5, series: 'Haikyuu!', part: 2, parts: 4 },
        { title: 'Friends (S9–10)', nights: 8, hours: 14.4, enneagram: 6, rating: 4, heartlighted: 6, series: 'Friends', part: 6, parts: 6 },
        { title: 'red vs blue (S16–18)', nights: 3, hours: 5.8, enneagram: 7, rating: 3, heartlighted: 6, series: 'red vs blue', part: 6, parts: 6 },
        { title: 'Haikyuu! (S3)', nights: 5, hours: 8.5, enneagram: 7, rating: 4.0, heartlighted: 5.5, series: 'Haikyuu!', part: 3, parts: 4 },
        { title: 'Loudermilk', nights: 6, hours: 11.0, enneagram: 6, rating: 4, heartlighted: 4 },
        { title: 'Stranger Things', nights: 20, hours: 38.5, enneagram: 6, rating: 4.5, heartlighted: 3, holiday: 'Halloween' },
        { title: 'Only Murders in the Building', nights: 14, hours: 26.4, enneagram: 5, rating: 3.5, heartlighted: 5 },
        { title: 'Better Call Saul (S6)', nights: 5, hours: 8.2, enneagram: 6, rating: 4, heartlighted: 2, series: 'Better Call Saul', part: 6, parts: 6 },
        { title: 'Shrinking', nights: 5, hours: 10.0, enneagram: 7, rating: 4.5, heartlighted: 3 },
        { title: 'Twin Pines', nights: 4, hours: 8.0, enneagram: 5, rating: 5, heartlighted: 4, holiday: 'Easter' },
        { title: 'Erased', nights: 3, hours: 4.6, enneagram: 5, rating: 4, heartlighted: 3 },
        { title: 'Tires', nights: 3, hours: 5.0, enneagram: 7, rating: 4, heartlighted: 5 },
        { title: 'Haikyuu! (S4)', nights: 5, hours: 8.5, enneagram: 7, rating: 4.0, heartlighted: 5.5, series: 'Haikyuu!', part: 4, parts: 4 },
    ],
};

const toIso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const addDays = (iso, n) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return toIso(d);
};

// A pick's `holiday` names the row in calendarConstants that dates it.
const HOLIDAY_EVENT = {
    Christmas: 'Christmas Day',
    Easter: 'Easter',
    Halloween: 'Halloween',
    'July 4th': 'Independence Day',
};

/** The date of a pick's holiday that falls inside [start, end], if any. */
const holidayWithin = (run, start, end) => {
    const title = HOLIDAY_EVENT[run.holiday];
    return EVENTS.find((e) => e.title === title && start <= e.start && e.start <= end)?.start
        ?? null;
};

/**
 * One track's queue as back-to-back Sunday-to-Saturday weeks from `from`, one
 * show a week. Each week takes the waiting holiday pick whose holiday it holds,
 * otherwise the next show in the queue.
 */
export const weeklyRuns = (queue, from = PLAN_START) => {
    const regular = queue.filter((run) => !run.holiday);
    const pinned = queue.filter((run) => run.holiday);
    const runs = [];
    for (let start = from; regular.length || pinned.length; start = addDays(start, WEEK_DAYS)) {
        const end = addDays(start, WEEK_DAYS - 1);
        const p = pinned.findIndex((run) => holidayWithin(run, start, end));
        if (p !== -1) {
            const [run] = pinned.splice(p, 1);
            runs.push({ ...run, start, end, holidayDate: holidayWithin(run, start, end) });
        } else {
            const { holiday, ...run } = regular.length ? regular.shift() : pinned.shift();
            runs.push({ ...run, start, end });
        }
    }
    return runs;
};

export const TRACK_RUNS = Object.fromEntries(
    Object.entries(QUEUE).map(([code, queue]) => [code, weeklyRuns(queue)]));

/** The last day each show track has something on. */
export const TRACK_ENDS = Object.fromEntries(
    Object.entries(TRACK_RUNS).map(([code, runs]) => [code, runs[runs.length - 1].end]));
