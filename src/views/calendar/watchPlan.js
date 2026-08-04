// The watch plan for the shows on the /darts board.
//
// Every track runs in PARALLEL — none of them takes a night away from another.
// A track is simply "on" one show across a date range, and you watch it whenever
// you like inside that window. There is deliberately no per-night assignment:
// the plan says what is in rotation and when it changes, not what to watch tonight.
//
// Tracks come from each show's `enneagram` value grouped into the enneagram's
// three Centers, so nothing here is hand-classified by genre. Adding a new track
// (movies, dinners, outings) means adding a key to TRACKS and TRACK_RUNS —
// no changes to CalendarPage.
//
// Shows that fall off are cut to their good seasons (`cut`). Lower-star long
// shows are broken into season blocks (`series`/`part`/`parts`) and spread out.
// A few are pinned to a holiday for resonance (`holiday`).
//
// Generated from the live get_darts "Shows" board. Runtimes are estimates —
// the darts records store no episode count or runtime.

export const PLAN_START = '2026-08-02';
export const PLAN_END = '2029-05-21';

// `family` groups tracks for colour; `icon` distinguishes tracks within a family.
//
// The dinner track has no entry in TRACK_RUNS below: its rotation is built at
// runtime from the `dinners` collection, so adding or editing a meal in Mongo
// changes the calendar without a rebuild. Any future track can work the same way
// — declare it here, supply runs from wherever they live.
export const DINNER_TRACK = 'n';

// `gridSilent` keeps a track out of the month grid entirely — it still appears
// in the day slate, it just never draws a change marker. Movies change nightly,
// which would bury the handful of marks that actually matter.
//
// Activities are deliberately *not* a track: they used to cycle through three
// pools and assign themselves to every day, which asserted plans nobody made.
// They are now scheduled by hand — see activityEvents.js.
export const TRACKS = {
    n: { key: 'dinner', label: 'Dinners', types: 'a 52-week menu', family: 'eat', icon: '🍽️' },
    // The second dinner track. Nightly, so it stays off the grid for the same
    // reason movies do — see nalasMenuRotation.js.
    nm: { key: 'nalas', label: "Nala's menu", types: 'meals you wrote out', family: 'eat',
          icon: '🥘', gridSilent: true },
    m: { key: 'movie', label: 'Movies', types: '4★ and up', family: 'watch', icon: '🎬',
         gridSilent: true },
    r: { key: 'restaurant', label: 'New restaurant', types: 'Friday nights, Lakewood',
         family: 'eat', icon: '🍴' },
    g: { key: 'gut', label: 'Gut / Instinct', types: 'types 8, 9, 1', family: 'watch', icon: '🔥' },
    h: { key: 'heart', label: 'Heart / Feeling', types: 'types 2, 3, 4', family: 'watch', icon: '💗' },
    d: { key: 'head', label: 'Head / Thinking', types: 'types 5, 6, 7', family: 'watch', icon: '🧠' },
};

export const TRACK_RUNS = {
    g: [
        { title: 'Designated Survivor', start: '2026-08-02', end: '2026-10-22', nights: 19, hours: 38.0, enneagram: 1, rating: 4.5, heartlighted: 4 },
        { title: 'Jack Ryan', start: '2026-10-23', end: '2026-11-07', nights: 4, hours: 6.7, enneagram: 1, rating: 4, heartlighted: 3, cut: 'S1–1 of 4' },
        { title: 'Arcane', start: '2026-11-08', end: '2026-12-02', nights: 7, hours: 12.6, enneagram: 8, rating: 5, heartlighted: 2 },
        { title: 'Vinland Saga', start: '2026-12-03', end: '2026-12-19', nights: 10, hours: 19.2, enneagram: 8, rating: 4, heartlighted: 1 },
        { title: 'Rick & Morty', start: '2026-12-20', end: '2027-01-13', nights: 15, hours: 29.7, enneagram: 8, rating: 4.5, heartlighted: 1 },
        { title: 'The Walking Dead (S1)', start: '2027-01-14', end: '2027-01-22', nights: 5, hours: 9.8, enneagram: 1, rating: 4, heartlighted: 1, series: 'The Walking Dead', part: 1, parts: 5, cut: 'S1–5 of 11' },
        { title: 'House of Cards (S1)', start: '2027-01-23', end: '2027-02-01', nights: 6, hours: 10.3, enneagram: 1, rating: 4, heartlighted: 1, series: 'House of Cards', part: 1, parts: 6 },
        { title: 'Breaking Bad', start: '2027-02-02', end: '2027-04-20', nights: 25, hours: 48.6, enneagram: 8, rating: 4.5, heartlighted: 2 },
        { title: 'Invincible', start: '2027-04-21', end: '2027-06-07', nights: 9, hours: 18.0, enneagram: 9, rating: 4.5, heartlighted: 4 },
        { title: 'Frieren: Beyond Journeys End', start: '2027-06-08', end: '2027-07-03', nights: 6, hours: 11.2, enneagram: 9, rating: 5, heartlighted: 6 },
        { title: 'Top Gun', start: '2027-07-04', end: '2027-07-09', nights: 1, hours: 1.8, enneagram: 8, rating: 4, heartlighted: 4, holiday: 'July 4th', holidayDate: '2027-07-04' },
        { title: 'Freaks and Geeks', start: '2027-07-10', end: '2027-08-10', nights: 7, hours: 13.5, enneagram: 9, rating: 5, heartlighted: 6 },
        { title: 'House of Cards (S2)', start: '2027-08-11', end: '2027-09-06', nights: 6, hours: 10.3, enneagram: 1, rating: 4, heartlighted: 1, series: 'House of Cards', part: 2, parts: 6 },
        { title: 'The Office', start: '2027-09-07', end: '2027-12-26', nights: 37, hours: 73.7, enneagram: 9, rating: 5, heartlighted: 6, holiday: 'Christmas', holidayDate: '2027-12-25' },
        { title: 'The Walking Dead (S2)', start: '2027-12-27', end: '2028-01-04', nights: 5, hours: 9.8, enneagram: 1, rating: 4, heartlighted: 1, series: 'The Walking Dead', part: 2, parts: 5, cut: 'S1–5 of 11' },
        { title: 'House of Cards (S3)', start: '2028-01-05', end: '2028-01-14', nights: 6, hours: 10.3, enneagram: 1, rating: 4, heartlighted: 1, series: 'House of Cards', part: 3, parts: 6 },
        { title: '24 (S1)', start: '2028-01-15', end: '2028-01-30', nights: 9, hours: 17.6, enneagram: 1, rating: 4, heartlighted: 3, series: '24', part: 1, parts: 5, cut: 'S1–5 of 9' },
        { title: 'The Walking Dead (S3)', start: '2028-01-31', end: '2028-02-07', nights: 5, hours: 9.8, enneagram: 1, rating: 4, heartlighted: 1, series: 'The Walking Dead', part: 3, parts: 5, cut: 'S1–5 of 11' },
        { title: 'House of Cards (S4)', start: '2028-02-08', end: '2028-02-18', nights: 6, hours: 10.3, enneagram: 1, rating: 4, heartlighted: 1, series: 'House of Cards', part: 4, parts: 6 },
        { title: '24 (S2)', start: '2028-02-19', end: '2028-03-13', nights: 9, hours: 17.6, enneagram: 1, rating: 4, heartlighted: 3, series: '24', part: 2, parts: 5, cut: 'S1–5 of 9' },
        { title: 'Daredevil (S1)', start: '2028-03-14', end: '2028-04-14', nights: 6, hours: 10.8, enneagram: 1, rating: 4, heartlighted: 3, series: 'Daredevil', part: 1, parts: 3 },
        { title: 'Parks & Recreation', start: '2028-04-15', end: '2028-08-05', nights: 23, hours: 45.8, enneagram: 8, rating: 5, heartlighted: 6, holiday: 'July 4th', holidayDate: '2028-07-04' },
        { title: 'The Boys', start: '2028-08-06', end: '2028-10-11', nights: 16, hours: 32.0, enneagram: 8, rating: 4.5, heartlighted: 3 },
        { title: '24 (S3)', start: '2028-10-12', end: '2028-11-16', nights: 9, hours: 17.6, enneagram: 1, rating: 4, heartlighted: 3, series: '24', part: 3, parts: 5, cut: 'S1–5 of 9' },
        { title: 'Demon Slayer: Kimetsu No Yaiba', start: '2028-11-17', end: '2028-12-12', nights: 11, hours: 22.0, enneagram: 1, rating: 4.5, heartlighted: 3 },
        { title: 'House of Cards (S5)', start: '2028-12-13', end: '2028-12-22', nights: 6, hours: 10.3, enneagram: 1, rating: 4, heartlighted: 1, series: 'House of Cards', part: 5, parts: 6 },
        { title: 'The Walking Dead (S4)', start: '2028-12-23', end: '2028-12-30', nights: 5, hours: 9.8, enneagram: 1, rating: 4, heartlighted: 1, series: 'The Walking Dead', part: 4, parts: 5, cut: 'S1–5 of 11' },
        { title: '24 (S4)', start: '2028-12-31', end: '2029-01-15', nights: 9, hours: 17.6, enneagram: 1, rating: 4, heartlighted: 3, series: '24', part: 4, parts: 5, cut: 'S1–5 of 9' },
        { title: 'House of Cards (S6)', start: '2029-01-16', end: '2029-01-25', nights: 6, hours: 10.3, enneagram: 1, rating: 4, heartlighted: 1, series: 'House of Cards', part: 6, parts: 6 },
        { title: 'Daredevil (S2)', start: '2029-01-26', end: '2029-02-04', nights: 6, hours: 10.8, enneagram: 1, rating: 4, heartlighted: 3, series: 'Daredevil', part: 2, parts: 3 },
        { title: 'The Walking Dead (S5)', start: '2029-02-05', end: '2029-02-13', nights: 5, hours: 9.8, enneagram: 1, rating: 4, heartlighted: 1, series: 'The Walking Dead', part: 5, parts: 5, cut: 'S1–5 of 11' },
        { title: 'Adolescence', start: '2029-02-14', end: '2029-02-17', nights: 2, hours: 4.0, enneagram: 1, rating: 4.5, heartlighted: 2 },
        { title: '24 (S5)', start: '2029-02-18', end: '2029-03-13', nights: 9, hours: 17.6, enneagram: 1, rating: 4, heartlighted: 3, series: '24', part: 5, parts: 5, cut: 'S1–5 of 9' },
        { title: 'Beef', start: '2029-03-14', end: '2029-03-30', nights: 3, hours: 5.8, enneagram: 1, rating: 5, heartlighted: 3 },
        { title: 'Daredevil (S3)', start: '2029-03-31', end: '2029-05-01', nights: 6, hours: 10.8, enneagram: 1, rating: 4, heartlighted: 3, series: 'Daredevil', part: 3, parts: 3 },
        { title: 'Mr. Bean', start: '2029-05-02', end: '2029-05-21', nights: 4, hours: 6.25, enneagram: 9, rating: 4, heartlighted: 6 },
    ],
    h: [
        { title: 'My Hero Academia', start: '2026-08-02', end: '2026-10-16', nights: 32, hours: 63.6, enneagram: 3, rating: 4.5, heartlighted: 5 },
        { title: 'The Morning Show', start: '2026-10-17', end: '2026-11-17', nights: 14, hours: 27.5, enneagram: 3, rating: 4.0, heartlighted: 3.5 },
        { title: 'Ted Lasso', start: '2026-11-18', end: '2027-01-09', nights: 10, hours: 19.3, enneagram: 3, rating: 4.5, heartlighted: 5, holiday: 'Christmas', holidayDate: '2026-12-25' },
        { title: 'How I Met Your Mother', start: '2027-01-10', end: '2027-04-28', nights: 39, hours: 76.3, enneagram: 4, rating: 5, heartlighted: 4 },
        { title: 'Hacks', start: '2027-04-29', end: '2027-05-18', nights: 11, hours: 21.0, enneagram: 3, rating: 3.5, heartlighted: 5 },
        { title: 'New Girl', start: '2027-05-19', end: '2027-07-21', nights: 27, hours: 53.5, enneagram: 2, rating: 4.5, heartlighted: 6 },
        { title: 'Scott Pilgrim Takes Off', start: '2027-07-22', end: '2027-07-26', nights: 2, hours: 3.3, enneagram: 4, rating: 4, heartlighted: 7 },
        { title: 'Avatar: TLA', start: '2027-07-27', end: '2027-08-26', nights: 12, hours: 23.4, enneagram: 2, rating: 5, heartlighted: 4 },
        { title: 'Lovesick', start: '2027-08-27', end: '2027-09-07', nights: 5, hours: 8.8, enneagram: 4, rating: 4, heartlighted: 6 },
        { title: 'Sex Education', start: '2027-09-08', end: '2027-10-12', nights: 15, hours: 28.3, enneagram: 4, rating: 4, heartlighted: 4 },
        { title: 'What We Do in the Shadows', start: '2027-10-13', end: '2027-11-10', nights: 13, hours: 26.0, enneagram: 4, rating: 4.5, heartlighted: 6, holiday: 'Halloween', holidayDate: '2027-10-31' },
        { title: 'Living With Yourself', start: '2027-11-11', end: '2027-11-14', nights: 2, hours: 4.0, enneagram: 4, rating: 4, heartlighted: 3 },
        { title: 'Fullmetal Alchemist: Brotherhood', start: '2027-11-15', end: '2028-01-27', nights: 13, hours: 25.6, enneagram: 3, rating: 5, heartlighted: 3 },
        { title: 'The Squid Game', start: '2028-01-28', end: '2028-03-07', nights: 8, hours: 15.6, enneagram: 3, rating: 4.5, heartlighted: 2 },
        { title: 'Dave', start: '2028-03-08', end: '2028-03-23', nights: 9, hours: 16.7, enneagram: 3, rating: 4, heartlighted: 4 },
        { title: 'Fleabag', start: '2028-03-24', end: '2028-03-28', nights: 3, hours: 5.0, enneagram: 4, rating: 5, heartlighted: 3 },
        { title: 'Modern Family (S1–2)', start: '2028-03-29', end: '2028-04-12', nights: 8, hours: 15.3, enneagram: 2, rating: 4, heartlighted: 6, series: 'Modern Family', part: 1, parts: 6 },
        { title: 'Good Girls (S1)', start: '2028-04-13', end: '2028-04-21', nights: 5, hours: 9.1, enneagram: 3, rating: 4, heartlighted: 4, series: 'Good Girls', part: 1, parts: 4 },
        { title: 'glee (S1)', start: '2028-04-22', end: '2028-05-05', nights: 8, hours: 15.4, enneagram: 2, rating: 3.5, heartlighted: 5, series: 'glee', part: 1, parts: 3, cut: 'S1–3 of 6' },
        { title: 'The Great', start: '2028-05-06', end: '2028-05-14', nights: 5, hours: 9.2, enneagram: 3, rating: 4, heartlighted: 5, cut: 'S1–1 of 3' },
        { title: 'Good Girls (S2)', start: '2028-05-15', end: '2028-05-23', nights: 5, hours: 9.1, enneagram: 3, rating: 4, heartlighted: 4, series: 'Good Girls', part: 2, parts: 4 },
        { title: 'Modern Family (S3–4)', start: '2028-05-24', end: '2028-06-09', nights: 8, hours: 15.3, enneagram: 2, rating: 4, heartlighted: 6, series: 'Modern Family', part: 2, parts: 6 },
        { title: 'glee (S2)', start: '2028-06-10', end: '2028-06-30', nights: 8, hours: 15.4, enneagram: 2, rating: 3.5, heartlighted: 5, series: 'glee', part: 2, parts: 3, cut: 'S1–3 of 6' },
        { title: 'The Marvelous Mrs. Maisel', start: '2028-07-01', end: '2028-08-21', nights: 20, hours: 39.4, enneagram: 3, rating: 4.5, heartlighted: 5 },
        { title: 'Modern Family (S5–6)', start: '2028-08-22', end: '2028-09-10', nights: 8, hours: 15.3, enneagram: 2, rating: 4, heartlighted: 6, series: 'Modern Family', part: 3, parts: 6 },
        { title: 'glee (S3)', start: '2028-09-11', end: '2028-09-28', nights: 8, hours: 15.4, enneagram: 2, rating: 3.5, heartlighted: 5, series: 'glee', part: 3, parts: 3, cut: 'S1–3 of 6' },
        { title: 'Good Girls (S3)', start: '2028-09-29', end: '2028-10-09', nights: 5, hours: 9.1, enneagram: 3, rating: 4, heartlighted: 4, series: 'Good Girls', part: 3, parts: 4 },
        { title: 'The Gentlemen', start: '2028-10-10', end: '2028-10-18', nights: 4, hours: 6.7, enneagram: 3, rating: 4, heartlighted: 4 },
        { title: 'Bojack Horseman', start: '2028-10-19', end: '2028-11-26', nights: 17, hours: 33.4, enneagram: 4, rating: 4.5, heartlighted: 3 },
        { title: 'Modern Family (S7)', start: '2028-11-27', end: '2029-01-27', nights: 8, hours: 15.3, enneagram: 2, rating: 4, heartlighted: 6, series: 'Modern Family', part: 4, parts: 6, holiday: 'Christmas', holidayDate: '2028-12-25' },
        { title: 'Death Note', start: '2029-01-28', end: '2029-03-07', nights: 8, hours: 14.2, enneagram: 3, rating: 5, heartlighted: 2 },
        { title: 'Your Lie in April', start: '2029-03-08', end: '2029-03-16', nights: 5, hours: 8.8, enneagram: 4, rating: 3.5, heartlighted: 3 },
        { title: 'Modern Family (S8–9)', start: '2029-03-17', end: '2029-04-01', nights: 8, hours: 15.3, enneagram: 2, rating: 4, heartlighted: 6, series: 'Modern Family', part: 5, parts: 6 },
        { title: 'Pachinko', start: '2029-04-02', end: '2029-04-14', nights: 8, hours: 16.0, enneagram: 4, rating: 4.5, heartlighted: 4 },
        { title: 'Good Girls (S4)', start: '2029-04-15', end: '2029-04-23', nights: 5, hours: 9.1, enneagram: 3, rating: 4, heartlighted: 4, series: 'Good Girls', part: 4, parts: 4 },
        { title: 'Crashing', start: '2029-04-24', end: '2029-05-08', nights: 8, hours: 14.4, enneagram: 4, rating: 4.5, heartlighted: 5 },
        { title: 'Modern Family (S10–11)', start: '2029-05-09', end: '2029-05-21', nights: 8, hours: 15.3, enneagram: 2, rating: 4, heartlighted: 6, series: 'Modern Family', part: 6, parts: 6 },
    ],
    d: [
        { title: 'Cunk on Earth', start: '2026-08-02', end: '2026-08-07', nights: 2, hours: 2.5, enneagram: 7, rating: 4.5, heartlighted: 7 },
        { title: 'Nathan For You', start: '2026-08-08', end: '2026-08-22', nights: 6, hours: 11.7, enneagram: 5, rating: 4.5, heartlighted: 7 },
        { title: 'red vs blue (S1–3)', start: '2026-08-23', end: '2026-08-30', nights: 3, hours: 5.8, enneagram: 7, rating: 3, heartlighted: 6, series: 'red vs blue', part: 1, parts: 6 },
        { title: 'Derry Girls', start: '2026-08-31', end: '2026-09-11', nights: 4, hours: 7.0, enneagram: 7, rating: 4, heartlighted: 5 },
        { title: 'Sherlock', start: '2026-09-12', end: '2026-10-13', nights: 10, hours: 19.5, enneagram: 7, rating: 4.5, heartlighted: 5 },
        { title: 'Better Call Saul (S1)', start: '2026-10-14', end: '2026-10-30', nights: 5, hours: 8.2, enneagram: 6, rating: 4, heartlighted: 2, series: 'Better Call Saul', part: 1, parts: 6 },
        { title: 'Over the Garden Wall', start: '2026-10-31', end: '2026-11-02', nights: 1, hours: 1.8, enneagram: 6, rating: 5, heartlighted: 4, holiday: 'Halloween', holidayDate: '2026-10-31' },
        { title: 'Waco', start: '2026-11-03', end: '2026-11-11', nights: 3, hours: 5.0, enneagram: 5, rating: 4, heartlighted: 3 },
        { title: 'This is Us', start: '2026-11-12', end: '2027-03-21', nights: 38, hours: 76.0, enneagram: 6, rating: 4.5, heartlighted: 4 },
        { title: 'The Good Place', start: '2027-03-22', end: '2027-04-30', nights: 10, hours: 19.4, enneagram: 6, rating: 5, heartlighted: 5, holiday: 'Easter', holidayDate: '2027-03-28' },
        { title: 'Better Call Saul (S2)', start: '2027-05-01', end: '2027-05-20', nights: 5, hours: 8.2, enneagram: 6, rating: 4, heartlighted: 2, series: 'Better Call Saul', part: 2, parts: 6 },
        { title: 'red vs blue (S4–6)', start: '2027-05-21', end: '2027-05-31', nights: 3, hours: 5.8, enneagram: 7, rating: 3, heartlighted: 6, series: 'red vs blue', part: 2, parts: 6 },
        { title: 'Friends (S1–2)', start: '2027-06-01', end: '2027-06-21', nights: 8, hours: 14.4, enneagram: 6, rating: 4, heartlighted: 6, series: 'Friends', part: 1, parts: 6 },
        { title: 'The Eric Andre Show', start: '2027-06-22', end: '2027-07-06', nights: 6, hours: 11.0, enneagram: 7, rating: 3.5, heartlighted: 7 },
        { title: 'Letterkenny', start: '2027-07-07', end: '2027-08-07', nights: 13, hours: 26.0, enneagram: 6, rating: 5, heartlighted: 7 },
        { title: 'Friends (S3)', start: '2027-08-08', end: '2027-08-27', nights: 8, hours: 14.4, enneagram: 6, rating: 4, heartlighted: 6, series: 'Friends', part: 2, parts: 6 },
        { title: 'red vs blue (S7–9)', start: '2027-08-28', end: '2027-09-04', nights: 3, hours: 5.8, enneagram: 7, rating: 3, heartlighted: 6, series: 'red vs blue', part: 3, parts: 6 },
        { title: 'Gravity Falls', start: '2027-09-05', end: '2027-10-01', nights: 8, hours: 14.7, enneagram: 6, rating: 5.0, heartlighted: 5.0 },
        { title: 'Friends (S4–5)', start: '2027-10-02', end: '2027-10-26', nights: 8, hours: 14.4, enneagram: 6, rating: 4, heartlighted: 6, series: 'Friends', part: 3, parts: 6 },
        { title: 'Steins;Gate', start: '2027-10-27', end: '2027-11-11', nights: 5, hours: 9.6, enneagram: 7, rating: 4.5, heartlighted: 4 },
        { title: 'Better Call Saul (S3)', start: '2027-11-12', end: '2027-11-28', nights: 5, hours: 8.2, enneagram: 6, rating: 4, heartlighted: 2, series: 'Better Call Saul', part: 3, parts: 6 },
        { title: 'The Bear', start: '2027-11-29', end: '2027-12-30', nights: 10, hours: 19.0, enneagram: 6, rating: 4.5, heartlighted: 2 },
        { title: 'Attack on Titan', start: '2027-12-31', end: '2028-02-08', nights: 12, hours: 23.6, enneagram: 6, rating: 4.5, heartlighted: 1, cut: 'S1–3 of 4' },
        { title: 'Better Call Saul (S4)', start: '2028-02-09', end: '2028-02-23', nights: 5, hours: 8.2, enneagram: 6, rating: 4, heartlighted: 2, series: 'Better Call Saul', part: 4, parts: 6 },
        { title: 'Sword Art Online', start: '2028-02-24', end: '2028-04-02', nights: 10, hours: 19.2, enneagram: 5, rating: 3.5, heartlighted: 5 },
        { title: 'Pantheon', start: '2028-04-03', end: '2028-04-18', nights: 4, hours: 8.0, enneagram: 6, rating: 5, heartlighted: 4, holiday: 'Easter', holidayDate: '2028-04-16' },
        { title: 'Friends (S6–7)', start: '2028-04-19', end: '2028-05-20', nights: 8, hours: 14.4, enneagram: 6, rating: 4, heartlighted: 6, series: 'Friends', part: 4, parts: 6 },
        { title: 'red vs blue (S10–12)', start: '2028-05-21', end: '2028-05-31', nights: 3, hours: 5.8, enneagram: 7, rating: 3, heartlighted: 6, series: 'red vs blue', part: 4, parts: 6 },
        { title: 'Haikyuu! (S1)', start: '2028-06-01', end: '2028-06-13', nights: 5, hours: 8.5, enneagram: 7, rating: 4.0, heartlighted: 5.5, series: 'Haikyuu!', part: 1, parts: 4 },
        { title: 'Friends (S8)', start: '2028-06-14', end: '2028-07-04', nights: 8, hours: 14.4, enneagram: 6, rating: 4, heartlighted: 6, series: 'Friends', part: 5, parts: 6 },
        { title: 'Shoresy', start: '2028-07-05', end: '2028-07-18', nights: 6, hours: 12.0, enneagram: 7, rating: 5, heartlighted: 7 },
        { title: 'Better Call Saul (S5)', start: '2028-07-19', end: '2028-07-30', nights: 5, hours: 8.2, enneagram: 6, rating: 4, heartlighted: 2, series: 'Better Call Saul', part: 5, parts: 6 },
        { title: 'red vs blue (S13–15)', start: '2028-07-31', end: '2028-08-07', nights: 3, hours: 5.8, enneagram: 7, rating: 3, heartlighted: 6, series: 'red vs blue', part: 5, parts: 6 },
        { title: 'Haikyuu! (S2)', start: '2028-08-08', end: '2028-08-20', nights: 5, hours: 8.5, enneagram: 7, rating: 4.0, heartlighted: 5.5, series: 'Haikyuu!', part: 2, parts: 4 },
        { title: 'Friends (S9–10)', start: '2028-08-21', end: '2028-09-11', nights: 8, hours: 14.4, enneagram: 6, rating: 4, heartlighted: 6, series: 'Friends', part: 6, parts: 6 },
        { title: 'red vs blue (S16–18)', start: '2028-09-12', end: '2028-09-20', nights: 3, hours: 5.8, enneagram: 7, rating: 3, heartlighted: 6, series: 'red vs blue', part: 6, parts: 6 },
        { title: 'Haikyuu! (S3)', start: '2028-09-21', end: '2028-10-06', nights: 5, hours: 8.5, enneagram: 7, rating: 4.0, heartlighted: 5.5, series: 'Haikyuu!', part: 3, parts: 4 },
        { title: 'Loudermilk', start: '2028-10-07', end: '2028-10-26', nights: 6, hours: 11.0, enneagram: 6, rating: 4, heartlighted: 4 },
        { title: 'Stranger Things', start: '2028-10-27', end: '2029-01-01', nights: 20, hours: 38.5, enneagram: 6, rating: 4.5, heartlighted: 3, holiday: 'Halloween', holidayDate: '2028-10-31' },
        { title: 'Only Murders in the Building', start: '2029-01-02', end: '2029-02-16', nights: 14, hours: 26.4, enneagram: 5, rating: 3.5, heartlighted: 5 },
        { title: 'Better Call Saul (S6)', start: '2029-02-17', end: '2029-03-05', nights: 5, hours: 8.2, enneagram: 6, rating: 4, heartlighted: 2, series: 'Better Call Saul', part: 6, parts: 6 },
        { title: 'Shrinking', start: '2029-03-06', end: '2029-03-25', nights: 5, hours: 10.0, enneagram: 7, rating: 4.5, heartlighted: 3 },
        { title: 'Twin Pines', start: '2029-03-26', end: '2029-04-10', nights: 4, hours: 8.0, enneagram: 5, rating: 5, heartlighted: 4, holiday: 'Easter', holidayDate: '2029-04-01' },
        { title: 'Erased', start: '2029-04-11', end: '2029-04-22', nights: 3, hours: 4.6, enneagram: 5, rating: 4, heartlighted: 3 },
        { title: 'Tires', start: '2029-04-23', end: '2029-05-03', nights: 3, hours: 5.0, enneagram: 7, rating: 4, heartlighted: 5 },
        { title: 'Haikyuu! (S4)', start: '2029-05-04', end: '2029-05-21', nights: 5, hours: 8.5, enneagram: 7, rating: 4.0, heartlighted: 5.5, series: 'Haikyuu!', part: 4, parts: 4 },
    ],
};
