// --- Spotify ---
// Two playlists: "pre-approved" is read and never written, and "pre approved
// shuffled" receives the result. Both live on Spotify rather than in Mongo, so
// these go through the Netlify Functions in
// server/{get_playlist,write_shuffled}. The refresh token stays there; nothing
// about Spotify auth reaches the browser.

const post = async (name, body) => {
    const response = await fetch(`.netlify/functions/${name}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });
    // The functions answer failures with a plain-text reason, so the page can
    // say what actually went wrong instead of "something went wrong".
    if (!response.ok) throw new Error(await response.text());
    return response.json();
};

/** The source playlist, in its current order. Never modified. */
export const getPlaylist = () => post('get_playlist');

// Matches the function's per-call cap. /items accepts fewer per request than the
// removed /tracks endpoint did, so this is 50 rather than 100.
export const CHUNK = 50;

/**
 * Write one chunk of at most 50 URIs to the destination playlist.
 * `replace` clears it and starts it over; `append` continues it.
 */
export const writeChunk = (uris, mode, order) =>
    post('write_shuffled', { uris, mode, order });

/**
 * Write a whole order to the destination, chunk by chunk, reporting progress.
 *
 * The first chunk replaces and carries the full order for the log; every chunk
 * after it appends. They have to go in sequence — each append lands at the end —
 * so this is deliberately serial rather than parallel.
 *
 * If a chunk throws, the destination is left holding however much was written.
 * The source is untouched either way, so the fix is simply to run it again; the
 * error says where it stopped so the page can say so too.
 */
export const writeOrder = async (uris, onProgress) => {
    const chunks = [];
    for (let i = 0; i < uris.length; i += CHUNK) chunks.push(uris.slice(i, i + CHUNK));

    for (let i = 0; i < chunks.length; i++) {
        try {
            await writeChunk(chunks[i], i === 0 ? 'replace' : 'append', i === 0 ? uris : undefined);
        } catch (error) {
            throw new Error(
                `Stopped after ${i * CHUNK} of ${uris.length} tracks. "pre-approved" is `
                + `untouched — run it again. ${error.message}`,
            );
        }
        onProgress?.(Math.min((i + 1) * CHUNK, uris.length), uris.length);
    }
};
