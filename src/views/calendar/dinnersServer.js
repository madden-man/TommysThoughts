// --- Dinners ---
// Backed by the `dinners` collection in the `tommy-data` MongoDB database via
// the Netlify Functions in server/{get,add}_dinner(s).
//
// One document per week of the year (1–52), each with a cuisine, a featured
// dinner, sides, dessert, seasonal produce and recipe links. Seed the
// collection with scripts/seed-dinners.mjs.

export const getDinners = async () => {
    return fetch('.netlify/functions/get_dinners', { method: 'POST' })
        .then((response) => response.json());
};

// Upserts on `week`, so re-sending a dinner corrects it rather than duplicating.
export const saveDinner = async (dinner) => {
    return fetch('.netlify/functions/add_dinner', {
        method: 'POST',
        body: JSON.stringify({ ...dinner }),
    }).then((response) => response.json());
};

// --- Movies ---
// The Movies board of the darts collection, via server/get_darts.
export const getMovies = async () => {
    return fetch('.netlify/functions/get_darts', {
        method: 'POST',
        body: JSON.stringify({ board: 'Movies' }),
    }).then((response) => response.json());
};

// --- Restaurants ---
// The `restaurants` collection in tommy-data — new places to try on a Friday.
export const getRestaurants = async () => {
    return fetch('.netlify/functions/get_restaurants', { method: 'POST' })
        .then((response) => response.json());
};

// --- Shows ---
// The Shows board of the darts collection. New darts appear here and get queued
// at the end of their track without re-running the scheduler.
export const getShows = async () => {
    return fetch('.netlify/functions/get_darts', {
        method: 'POST',
        body: JSON.stringify({ board: 'Shows' }),
    }).then((response) => response.json());
};
