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
