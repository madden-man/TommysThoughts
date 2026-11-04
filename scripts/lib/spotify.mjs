// Spotify for the offline scripts. The functions in server/ have their own
// copy of the auth dance (server/_shared/spotify.js) that caches tokens in
// Mongo; a script runs once and needs none of that, so this is the short form:
// mint one access token from the refresh token in the environment and reuse it
// for the run.
//
// Reads SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN from
// process.env, falling back to .env.local in the repo root (gitignored; written
// from `netlify env:list --json`).

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const loadDotEnv = () => {
    const file = resolve(process.cwd(), '.env.local');
    if (!existsSync(file)) return;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
};
loadDotEnv();

let tokenPromise = null;

/** One access token for the run, minted on first use. */
export const accessToken = () => {
    if (!tokenPromise) {
        tokenPromise = (async () => {
            const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret, SPOTIFY_REFRESH_TOKEN: refresh } = process.env;
            if (!id || !secret || !refresh) {
                throw new Error('SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN are needed (env or .env.local)');
            }
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
                },
                body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }).toString(),
            });
            if (!response.ok) throw new Error(`Spotify refused the refresh token: ${await response.text()}`);
            return (await response.json()).access_token;
        })();
    }
    return tokenPromise;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The longest 429 wait worth sitting through (SPOTIFY_MAX_429_WAIT seconds, default 600). */
const MAX_429_WAIT_MS = (Number(process.env.SPOTIFY_MAX_429_WAIT) || 600) * 1000;

/**
 * GET a Web API path (or full URL) as JSON. Honours Retry-After on 429 and
 * waits it out: a script has all the time it needs, and hammering a throttled
 * app only pushes the window back. Throws on any other non-2xx.
 */
export const get = async (path, { retries = 5 } = {}) => {
    const url = path.startsWith('http') ? path : `https://api.spotify.com/v1${path}`;
    const token = await accessToken();
    for (let attempt = 0; ; attempt += 1) {
        const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
        if (response.status === 429 && attempt < retries) {
            const wait = (Number(response.headers.get('retry-after')) || 1) * 1000;
            // A Retry-After of hours is a daily quota spent, not a burst: Spotify
            // answered 85,000 seconds on 2026-11-05 for /albums/{id} and
            // /tracks/{id}. Waiting that out inside a script just hangs it, so
            // past MAX_429_WAIT_MS the caller gets an error it can route around.
            if (wait > MAX_429_WAIT_MS) {
                const err = new Error(`Spotify 429 ${url}: Retry-After ${wait / 1000}s, over the ${MAX_429_WAIT_MS / 1000}s this script will wait`);
                err.status = 429;
                err.retryAfter = wait / 1000;
                throw err;
            }
            process.stderr.write(`  429, waiting ${wait / 1000}s\n`);
            await sleep(wait);
            continue;
        }
        if (!response.ok) throw new Error(`Spotify ${response.status} ${url}: ${await response.text()}`);
        return response.json();
    }
};

/** Every page of a paged endpoint, concatenated. `pick` names the items array. */
export const getAll = async (path, pick = (page) => page.items) => {
    const out = [];
    let next = path;
    while (next) {
        // eslint-disable-next-line no-await-in-loop
        const page = await get(next);
        out.push(...(pick(page) ?? []));
        next = page.next;
    }
    return out;
};

/** The account's playlists: { id, name, trackCount }. */
export const listPlaylists = async () => (await getAll('/me/playlists?limit=50'))
    .filter((p) => p && p.id)
    .map((p) => ({ id: p.id, name: p.name, trackCount: p.items?.total ?? p.tracks?.total ?? null }));

/**
 * Every item of a playlist, trimmed to what the scripts reason over. /items,
 * not /tracks: the old endpoint went away in the March 2026 migration.
 */
export const playlistTracks = async (playlistId) => {
    const fields = 'next,items(added_at,item(uri,name,disc_number,track_number,artists(id,name),album(id,name,album_type,total_tracks,release_date)))';
    const items = await getAll(`/playlists/${playlistId}/items?limit=50&fields=${encodeURIComponent(fields)}`);
    return items.map((entry) => {
        const track = entry?.item ?? entry?.track ?? {};
        return {
            uri: track.uri,
            name: track.name,
            artistIds: (track.artists ?? []).map((a) => a.id),
            artistNames: (track.artists ?? []).map((a) => a.name),
            albumId: track.album?.id ?? null,
            albumName: track.album?.name ?? null,
            albumType: track.album?.album_type ?? null,
            albumTotalTracks: track.album?.total_tracks ?? null,
            releaseDate: track.album?.release_date ?? null,
            discNumber: track.disc_number ?? null,
            trackNumber: track.track_number ?? null,
            addedAt: entry?.added_at ?? null,
        };
    }).filter((t) => t.uri);
};

const chunks = (list, size) => {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
};

/** Full album objects for any number of ids (20 per request). */
export const albums = async (ids) => {
    const out = [];
    for (const batch of chunks([...new Set(ids)].filter(Boolean), 20)) {
        // eslint-disable-next-line no-await-in-loop
        out.push(...((await get(`/albums?ids=${batch.join(',')}`)).albums ?? []).filter(Boolean));
    }
    return out;
};

/** Track objects for any number of track ids (50 per request). */
export const tracks = async (ids) => {
    const out = [];
    for (const batch of chunks([...new Set(ids)].filter(Boolean), 50)) {
        // eslint-disable-next-line no-await-in-loop
        out.push(...((await get(`/tracks?ids=${batch.join(',')}`)).tracks ?? []).filter(Boolean));
    }
    return out;
};

/** Artist objects (genres, popularity) for any number of ids (50 per request). */
export const artists = async (ids) => {
    const out = [];
    for (const batch of chunks([...new Set(ids)].filter(Boolean), 50)) {
        // eslint-disable-next-line no-await-in-loop
        out.push(...((await get(`/artists?ids=${batch.join(',')}`)).artists ?? []).filter(Boolean));
    }
    return out;
};

/**
 * An artist's own albums (album_group=album only; no singles, no appears-on).
 * Ten a page: since the 2026 development-mode limits Spotify answers 400
 * "Invalid limit" to anything higher here.
 */
export const artistAlbums = (artistId) =>
    getAll(`/artists/${artistId}/albums?include_groups=album&limit=10`);

/** Album search; returns the simplified album objects. */
export const searchAlbums = async (artist, album, limit = 5) => {
    const q = encodeURIComponent(`album:${album} artist:${artist}`);
    return (await get(`/search?type=album&limit=${limit}&q=${q}`)).albums?.items ?? [];
};

/** Artist search by name. */
export const searchArtists = async (name, limit = 3) =>
    (await get(`/search?type=artist&limit=${limit}&q=${encodeURIComponent(name)}`)).artists?.items ?? [];

/** The account's top artists for a range: long_term | medium_term | short_term. */
export const topArtists = (timeRange = 'long_term') =>
    getAll(`/me/top/artists?limit=50&time_range=${timeRange}`);
