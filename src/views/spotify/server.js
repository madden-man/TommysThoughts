// --- Spotify ---
// Two playlists: "pre-approved" is read and never written, and "pre approved
// shuffled" receives the result. Both live on Spotify rather than in Mongo, so
// these go through the Netlify Functions in
// server/{get_playlist,write_shuffled}. The refresh token stays there; nothing
// about Spotify auth reaches the browser.

// A rate-limit circuit breaker. When Spotify throttles the app it answers 429
// with a Retry-After that can run to hours, and — crucially — hammering it while
// throttled can keep pushing that window back. So the first 429 records when the
// app may call again, and every Spotify-backed call short-circuits until then
// WITHOUT touching the network. That both surfaces a clear message and lets the
// penalty actually count down to zero instead of being renewed.
const BREAKER_KEY = 'spotify.rateLimitedUntil';
// Never trust a retry-after longer than a day; a stuck breaker is worse than an
// extra probe once a day.
const MAX_BREAKER_MS = 24 * 60 * 60 * 1000;

const breakerUntil = () => {
    try { return Number(localStorage.getItem(BREAKER_KEY) || 0); } catch (_) { return 0; }
};
const tripBreaker = (retryAfterSec) => {
    const ms = Math.min(Math.max(Number(retryAfterSec) || 0, 0) * 1000, MAX_BREAKER_MS);
    try { localStorage.setItem(BREAKER_KEY, String(Date.now() + ms)); } catch (_) { /* ignore */ }
};
const rateLimitError = (until) => {
    const when = new Date(until);
    const error = new Error(
        `Spotify is rate-limiting the app — try again after ${when.toLocaleString()}.`,
    );
    error.rateLimited = true;
    error.until = until;
    return error;
};

/** Whether the breaker is currently open (calls are being suppressed). */
export const rateLimitedUntil = () => {
    const until = breakerUntil();
    return until > Date.now() ? until : 0;
};

const post = async (name, body) => {
    const until = breakerUntil();
    if (Date.now() < until) throw rateLimitError(until);

    const response = await fetch(`.netlify/functions/${name}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });

    // A 429 trips the breaker: read the retry-after the function forwarded, stop
    // calling until it passes, and report it rather than a raw error string.
    if (response.status === 429) {
        let retryAfter = 0;
        try { retryAfter = (await response.json()).retryAfter || 0; } catch (_) { /* ignore */ }
        tripBreaker(retryAfter);
        throw rateLimitError(breakerUntil());
    }
    // Other failures answer with a plain-text reason, so the page can say what
    // actually went wrong instead of "something went wrong".
    if (!response.ok) throw new Error(await response.text());
    return response.json();
};

// Fetched playlists, kept for the life of the page. Switching tabs remounts the
// tab, and reading a large playlist is many pages of Spotify — so once a
// playlist is pulled, returning to its tab reuses it rather than fetching it all
// again. A source playlist doesn't change under us (writes only ever touch a
// separate "… shuffled" destination), so caching it for the session is safe.
const playlistCache = new Map();

/**
 * The source playlist (its first couple of thousand tracks), in current order.
 * Never modified. Resolves to `{ playlistId, total, tracks, capped }` — `total`
 * is the playlist's real length and `capped` says whether it runs past what was
 * read.
 *
 * `playlistId` names which playlist to read — omit it for the default
 * (pre-approved). The ids are in the playlists' share URLs and are not secrets,
 * so a tab can ask for one directly.
 */
export const getPlaylist = (playlistId, part = 0) => {
    // Keyed by part as well as playlist: a long playlist is several tabs, each
    // reading a different slice, and they must not share one cached response.
    const key = `${playlistId ?? '__default__'}#${part}`;
    if (!playlistCache.has(key)) {
        // Cache the promise, not just the result, so two tabs mounting at once
        // share one request. A failure is evicted so the next open can retry.
        const pending = post('get_playlist', { ...(playlistId ? { playlistId } : {}), part })
            .catch((error) => { playlistCache.delete(key); throw error; });
        playlistCache.set(key, pending);
    }
    return playlistCache.get(key);
};

// One tab's worth of playlist. Mirrors PART_SIZE in server/get_playlist.
export const PART_SIZE = 2500;

/** How many tabs a playlist of this length needs. */
export const partsFor = (trackCount) =>
    Math.max(1, Math.ceil((trackCount ?? 0) / PART_SIZE));

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
