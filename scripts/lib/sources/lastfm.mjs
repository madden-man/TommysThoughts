// Last.fm similar artists, the same shape as the ListenBrainz source:
// artist.getSimilar for each seed, artist.getTopAlbums for each neighbour,
// then Spotify for the ids. It needs a free API key, and there is none in
// this repo's environment yet, so without LASTFM_API_KEY it contributes
// nothing and says so once rather than failing the run. Untested against the
// live API for that reason; the first run with a key is its smoke test.

import { remember } from '../cache.mjs';
import { foldNeighbours, resolveNeighbours, seedArtists } from './neighbours.mjs';

const SEEDS = 100;
const NEIGHBOURS = 15;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Last.fm asks for no more than five requests a second per key.
let last = 0;
const call = async (params) => {
    const wait = 220 - (Date.now() - last);
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const qs = new URLSearchParams({ ...params, api_key: process.env.LASTFM_API_KEY, format: 'json', autocorrect: '1' });
    const r = await fetch(`https://ws.audioscrobbler.com/2.0/?${qs}`, { headers: { 'user-agent': 'TommysThoughts/1.0 (tommysthoughts.com)' } });
    if (!r.ok) throw new Error(`Last.fm ${r.status} ${params.method}`);
    const body = await r.json();
    // An unknown artist is an error body with a 200, not an exception.
    return body.error ? null : body;
};

const similar = (name) => remember('lastfm-similar', name, async () =>
    ((await call({ method: 'artist.getSimilar', artist: name, limit: String(NEIGHBOURS) }))?.similarartists?.artist ?? [])
        .map((a) => ({ id: a.mbid || null, name: a.name, score: Number(a.match) || 0 })));

const topAlbums = (name) => remember('lastfm-top-albums', name, async () =>
    ((await call({ method: 'artist.getTopAlbums', artist: name, limit: '15' }))?.topalbums?.album ?? [])
        .map((a) => a.name).filter(Boolean));

export async function candidates(profile, { log = console.log, limitArtists } = {}) {
    if (!process.env.LASTFM_API_KEY) {
        log('lastfm: LASTFM_API_KEY is not set, skipping');
        return [];
    }
    const seeds = seedArtists(profile, Math.min(SEEDS, limitArtists ?? SEEDS));
    log(`lastfm: ${seeds.length} seeds`);
    const perSeed = [];
    for (const seed of seeds) {
        // eslint-disable-next-line no-await-in-loop
        const list = (await similar(seed.name)).slice(0, NEIGHBOURS);
        // Last.fm's match is already 0..1 per seed, so it is the similarity as is.
        perSeed.push({ seed, list: list.map((n, i) => ({ ...n, similarity: n.score, rank: i + 1 })) });
    }
    const neighbours = [];
    for (const n of foldNeighbours(perSeed, seeds)) {
        // eslint-disable-next-line no-await-in-loop
        neighbours.push({ ...n, albums: await topAlbums(n.name) });
    }
    return resolveNeighbours(neighbours, profile, { source: 'lastfm', log });
}
