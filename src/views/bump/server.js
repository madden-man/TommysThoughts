// --- Activities CRUD ---
// Backed by the `activities` collection in the `tommy-data` MongoDB database
// via the Netlify Functions in server/{get,add,update,delete}_activity.

export const getActivities = async () => {
    return fetch('.netlify/functions/get_activities', { method: 'POST' })
        .then((response) => response.json());
};

export const addActivity = async (activity) => {
    return fetch('.netlify/functions/add_activity', {
        method: 'POST',
        body: JSON.stringify({ ...activity }),
    }).then((response) => response.json());
};

export const updateActivity = async (activity) => {
    return fetch('.netlify/functions/update_activity', {
        method: 'POST',
        body: JSON.stringify({ ...activity }),
    }).then((response) => response.json());
};

export const deleteActivity = async (id) => {
    return fetch('.netlify/functions/delete_activity', {
        method: 'POST',
        body: JSON.stringify({ _id: id }),
    }).then((response) => response.json());
};

export const sendBumpNotification = async (header) => {
    try {
        await fetch('.netlify/functions/notify', {
            method: 'POST',
            body: JSON.stringify({
                source: 'TommysThoughts',
                event: 'bump',
                message: `Someone's up for a ${header}.`,
            }),
        });
    } catch (error) {
        // Non-critical: don't block the page if the notification fails.
        console.error('Failed to send bump notification', error);
    }
};
