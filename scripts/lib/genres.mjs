// Artist genres for records the profile has never seen: the backtest's
// targets and the ranker's candidates. Neither carries a genre (the candidate
// contract has none, and Spotify's artist endpoint is throttled), and the
// profile only knows genres for its own top artists, so this looks the rest
// up the way build-taste-profile.mjs does for its top 300: one MusicBrainz
// artist search per name, a request a second, tags folded to genres by
// genresFromTags. Cached by normalised name in scripts/data/cache/
// musicbrainz-genres.json, so each name is paid for once.
//
// The backtest must give every target its genre from the same place, or the
// genre term measures which artists happened to be looked up rather than
// what Tommy likes; that is why this exists instead of reading the profile's
// own artist genres for some targets and nothing for the rest.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { genresFromTags } from './taste.mjs';
import { normalizeName } from '../../src/views/spotify/names.js';

export const GENRE_CACHE = 'scripts/data/cache/musicbrainz-genres.json';
const AGENT = 'TommysThoughts-recommendations/0.1 (https://tommysthoughts.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const search = async (name) => {
    const url = `https://musicbrainz.org/ws/2/artist/?fmt=json&limit=1&query=${encodeURIComponent(`artist:"${name.replace(/"/g, '')}"`)}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        let response;
        try { response = await fetch(url, { headers: { 'user-agent': AGENT }, signal: AbortSignal.timeout(15000) }); } catch (_) { await sleep(3000); continue; }
        if (response.status === 503 || response.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
        if (!response.ok) return null;
        const hit = (await response.json()).artists?.[0];
        // A weak hit is a different artist with a similar name.
        if (!hit || hit.score < 90) return [];
        return genresFromTags(hit.tags);
    }
    return null;
};

/**
 * Genres for each name, as a Map of normalised name to a list (possibly
 * empty). `seed` is a Map of names already known (the profile's own artist
 * genres), used before any lookup. `offline` answers from the caches only.
 */
export const genresFor = async (names, { seed = new Map(), offline = false, log = () => {} } = {}) => {
    const cache = existsSync(GENRE_CACHE) ? JSON.parse(readFileSync(GENRE_CACHE, 'utf8')) : {};
    const out = new Map();
    const wanted = [];
    for (const name of new Set(names.filter(Boolean))) {
        const k = normalizeName(name);
        if (out.has(k)) continue;
        if (seed.get(k)?.length) out.set(k, seed.get(k));
        else if (k in cache) out.set(k, cache[k]);
        else wanted.push([k, name]);
    }
    if (wanted.length && !offline) {
        log(`MusicBrainz genres for ${wanted.length} artists (about ${Math.ceil((wanted.length * 1.2) / 60)} min)...`);
        for (const [i, [k, name]] of wanted.entries()) {
            const genres = await search(name);
            if (genres) { cache[k] = genres; out.set(k, genres); }
            if ((i + 1) % 50 === 0) save(cache);
            await sleep(1100);
        }
        save(cache);
    }
    for (const [k] of wanted) if (!out.has(k)) out.set(k, []);
    return out;
};

const save = (cache) => {
    mkdirSync(dirname(GENRE_CACHE), { recursive: true });
    writeFileSync(GENRE_CACHE, JSON.stringify(cache));
};
