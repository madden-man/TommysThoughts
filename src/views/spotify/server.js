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

// Fetched playlists, kept for the life of the page. Switching tabs remounts the
// tab, and reading a large playlist is many pages of Spotify — so once a
// playlist is pulled, returning to its tab reuses it rather than fetching it all
// again. A source playlist doesn't change under us (writes only ever touch a
// separate "… shuffled" destination), so caching it for the session is safe.
const playlistCache = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A big playlist is built server-side a chunk of pages at a time, so this drives
// the build to completion: each call advances it, and progress is saved on the
// server, so a call that fails to rate limiting is simply retried and resumes
// from where it left off rather than starting over.
const buildPlaylist = async (playlistId, onProgress) => {
    const body = playlistId ? { playlistId } : undefined;
    let failures = 0;
    for (let step = 0; step < 400; step += 1) {
        let res;
        try {
            res = await post('get_playlist', body);
        } catch (error) {
            // Resume through a transient failure (usually rate limiting) a few
            // times, backing off, before giving up.
            failures += 1;
            if (failures > 6) throw error;
            await sleep(2000);
            continue;
        }
        if (res.complete) return { playlistId: res.playlistId, total: res.total, tracks: res.tracks };
        onProgress?.(res.loaded ?? 0, res.total ?? 0);
        // A brief pause between chunks keeps the overall request rate gentle.
        await sleep(300);
    }
    throw new Error('The playlist did not finish loading.');
};

/**
 * The source playlist, in its current order. Never modified.
 *
 * `playlistId` names which playlist to read — omit it for the default
 * (pre-approved). The ids are in the playlists' share URLs and are not secrets,
 * so a tab can ask for one directly. `onProgress(loaded, total)` reports the
 * build of a large playlist on its first load.
 */
export const getPlaylist = (playlistId, onProgress) => {
    const key = playlistId ?? '__default__';
    if (!playlistCache.has(key)) {
        // Cache the promise, not just the result, so two tabs mounting at once
        // share one build. A failure is evicted so the next open can retry.
        const pending = buildPlaylist(playlistId, onProgress)
            .catch((error) => { playlistCache.delete(key); throw error; });
        playlistCache.set(key, pending);
    }
    return playlistCache.get(key);
};

/**
 * The account's playlists — `{ id, name, trackCount, owner }` each — for the
 * add-tab autocomplete. Read-only, and no playlist is fetched in full here; it
 * is just the list to choose from.
 */
export const listPlaylists = () =>
    post('list_playlists').then((data) => data.playlists ?? []);

/**
 * Get — or create — the destination playlist of the given name in the account,
 * returning `{ id, name, created }`. An added tab calls this before its first
 * write so it has a "… shuffled" playlist to write into.
 */
export const ensurePlaylist = (name) => post('ensure_playlist', { name });

// Matches the function's per-call cap. /items accepts fewer per request than the
// removed /tracks endpoint did, so this is 50 rather than 100.
export const CHUNK = 50;

/**
 * Write one chunk of at most 50 URIs to the destination playlist.
 * `replace` clears it and starts it over; `append` continues it. `playlistId`
 * names the destination — omit it for the default pre-approved one.
 */
export const writeChunk = (uris, mode, order, playlistId) =>
    post('write_shuffled', { uris, mode, order, playlistId });

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
export const writeOrder = async (uris, onProgress, playlistId) => {
    const chunks = [];
    for (let i = 0; i < uris.length; i += CHUNK) chunks.push(uris.slice(i, i + CHUNK));

    for (let i = 0; i < chunks.length; i++) {
        try {
            await writeChunk(
                chunks[i],
                i === 0 ? 'replace' : 'append',
                i === 0 ? uris : undefined,
                playlistId,
            );
        } catch (error) {
            throw new Error(
                `Stopped after ${i * CHUNK} of ${uris.length} tracks. The source is `
                + `untouched — run it again. ${error.message}`,
            );
        }
        onProgress?.(Math.min((i + 1) * CHUNK, uris.length), uris.length);
    }
};
