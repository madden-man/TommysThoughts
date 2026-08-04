// --- Scheduled activity events ---
// Backed by the `activity_events` collection in the `tommy-data` MongoDB
// database via the Netlify Functions in
// server/{get_activity_events,add_activity_event,delete_activity_event}.
//
// One document per rule, not per day: { kind, title, date, recurrence, until?,
// time?, notes? }. activityEvents.js expands a rule into the occurrences that
// fall inside the visible window.

export const getActivityEvents = async () => {
    return fetch('.netlify/functions/get_activity_events', { method: 'POST' })
        .then((response) => response.json());
};

export const addActivityEvent = async (entry) => {
    return fetch('.netlify/functions/add_activity_event', {
        method: 'POST',
        body: JSON.stringify({ ...entry }),
    }).then((response) => response.json());
};

// Deletes the whole rule — a recurring activity is one document, so removing an
// occurrence removes the series.
export const deleteActivityEvent = async (id) => {
    return fetch('.netlify/functions/delete_activity_event', {
        method: 'POST',
        body: JSON.stringify({ _id: id }),
    }).then((response) => response.json());
};
