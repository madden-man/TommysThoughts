export const sendBumpNotification = async (button) => {
    try {
        await fetch('.netlify/functions/notify', {
            method: 'POST',
            body: JSON.stringify({
                source: 'TommysThoughts',
                event: 'bump',
                message: `Someone clicked the ${button} button on Bump.`,
            }),
        });
    } catch (error) {
        // Non-critical: don't block the page if the notification fails.
        console.error('Failed to send bump notification', error);
    }
};
