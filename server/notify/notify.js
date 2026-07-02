// Sends a push notification via ntfy.sh (https://ntfy.sh).
//
// Setup: install the ntfy app on your phone, subscribe to the topic named in
// the NTFY_TOPIC env var, and you'll get a push whenever this runs.
//
// Shared across projects: any project can POST here with { source, event }
// (or a custom title/message) to notify the same phone. Configure per-deploy:
//   NTFY_TOPIC   - the secret topic to publish to (required)
//   NTFY_SERVER  - defaults to https://ntfy.sh

const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const topic = process.env.NTFY_TOPIC;
    if (!topic) {
        return { statusCode: 500, body: 'NTFY_TOPIC is not configured' };
    }
    const server = process.env.NTFY_SERVER || 'https://ntfy.sh';

    let payload = {};
    try {
        payload = event.body ? JSON.parse(event.body) : {};
    } catch (e) {
        return { statusCode: 400, body: 'Invalid JSON body' };
    }

    const { source = 'TommysThoughts', event: eventName = 'bump', message, title } = payload;

    const notifyTitle = title || `${source}: ${eventName}`;
    const notifyBody = message || `Someone triggered "${eventName}" on ${source}.`;

    try {
        const response = await fetch(`${server}/${topic}`, {
            method: 'POST',
            headers: {
                'Title': notifyTitle,
                'Tags': 'bell',
                'Priority': 'default',
            },
            body: notifyBody,
        });

        if (!response.ok) {
            const text = await response.text();
            return { statusCode: 502, body: `ntfy error: ${response.status} ${text}` };
        }

        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports = { handler };
