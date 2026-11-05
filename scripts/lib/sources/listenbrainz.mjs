// Similar artists from ListenBrainz Labs, which needs no key: MusicBrainz
// resolves each seed's name to an MBID, Labs answers with the artists people
// play in the same listening sessions, and Deezer's per-album fan counts rank
// each neighbour's albums so only their best-known six are looked up on
// Spotify.
//
// Endpoints (checked 2026-11-05 against Of Monsters and Men, whose top
// neighbours came back as The Lumineers, Imagine Dragons, Mumford & Sons):
//   https://musicbrainz.org/ws/2/artist/?query=artist:"<name>"&fmt=json
//   https://labs.api.listenbrainz.org/similar-artists/json?artist_mbids=<mbid>&algorithm=<ALGORITHM>
//   https://api.deezer.com/search/artist?q=<name>, then /artist/<id>/albums
// ALGORITHM is the first session-based one the Labs page lists (five years of
// sessions), so the neighbours reflect what people play now rather than 2008.
//
// Why Deezer for the ranking: Spotify stopped returning album popularity to
// this app, and ListenBrainz's own top-release-groups endpoint began answering
// 401 ("you need to provide an Auth token") on 2026-11-05. Deezer is keyless
// and its album objects carry a fan count, which is the same kind of signal.

import { remember } from '../cache.mjs';
import { looseName, preferStandard } from '../candidates.mjs';
import { baseAlbumName } from '../../../src/views/spotify/names.js';
import { foldNeighbours, resolveNeighbours, seedArtists } from './neighbours.mjs';

const SEEDS = 100;
const NEIGHBOURS = 15;
const ALGORITHM = 'session_based_days_1825_session_300_contribution_3_threshold_10_limit_100_filter_True_skip_30';
const UA = 'TommysThoughts/1.0 (tommysthoughts.com)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// MusicBrainz asks for one request a second from an identified client and
// blocks anyone faster, so its calls go through a single queue.
let mbQueue = Promise.resolve();
const mbFetch = (url) => {
    const run = mbQueue.then(async () => {
        const started = Date.now();
        try {
            for (let attempt = 0; ; attempt += 1) {
                // eslint-disable-next-line no-await-in-loop
                const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
                if (r.status === 503 && attempt < 3) { await sleep(2000); continue; } // eslint-disable-line no-await-in-loop
                if (!r.ok) throw new Error(`MusicBrainz ${r.status} ${url}`);
                return await r.json(); // eslint-disable-line no-await-in-loop
            }
        } finally {
            const wait = 1100 - (Date.now() - started);
            if (wait > 0) await sleep(wait);
        }
    });
    mbQueue = run.catch(() => {});
    return run;
};

// ListenBrainz publishes its budget in headers (30 a ten-second window at the
// time of writing); spend it, then wait the window out instead of earning 429s.
const lbFetch = async (url) => {
    for (let attempt = 0; ; attempt += 1) {
        // eslint-disable-next-line no-await-in-loop
        const r = await fetch(url, { headers: { 'user-agent': UA } });
        const remaining = Number(r.headers.get('x-ratelimit-remaining'));
        const resetIn = Number(r.headers.get('x-ratelimit-reset-in')) || 1;
        if (r.status === 429 && attempt < 5) { await sleep(resetIn * 1000 + 200); continue; } // eslint-disable-line no-await-in-loop
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`ListenBrainz ${r.status} ${url}`);
        const body = await r.json(); // eslint-disable-line no-await-in-loop
        if (r.headers.has('x-ratelimit-remaining') && remaining <= 1) await sleep(resetIn * 1000 + 200); // eslint-disable-line no-await-in-loop
        return body;
    }
};

/** A seed's MBID: an exact (loosened) name match among the top hits, else none. */
const mbid = (name) => remember('musicbrainz-artist', name, async () => {
    const q = encodeURIComponent(`artist:"${name.replace(/"/g, '')}"`);
    const body = await mbFetch(`https://musicbrainz.org/ws/2/artist/?query=${q}&fmt=json&limit=5`);
    const want = looseName(name);
    const hit = (body.artists ?? []).find((a) => looseName(a.name) === want)
        ?? (body.artists ?? []).find((a) => (a.aliases ?? []).some((al) => looseName(al.name) === want));
    return hit?.id ?? null;
});

const similar = (id) => remember('listenbrainz-similar', `${ALGORITHM}:${id}`, async () => {
    const body = await lbFetch(`https://labs.api.listenbrainz.org/similar-artists/json?artist_mbids=${id}&algorithm=${ALGORITHM}`);
    return (body ?? []).slice(0, 50).map((a) => ({ id: a.artist_mbid, name: a.name, score: a.score }));
});

// Deezer allows 50 requests in five seconds; a tenth of a second apart keeps
// well inside that.
let lastDeezer = 0;
const deezer = async (path) => {
    const wait = 120 - (Date.now() - lastDeezer);
    if (wait > 0) await sleep(wait);
    lastDeezer = Date.now();
    const r = await fetch(`https://api.deezer.com${path}`, { headers: { 'user-agent': UA } });
    if (!r.ok) throw new Error(`Deezer ${r.status} ${path}`);
    const body = await r.json();
    if (body.error?.code === 4) { await sleep(5000); return deezer(path); } // quota, wait a window
    return body;
};

/**
 * A neighbour's albums, most-followed first. Editions of one record are
 * pooled under the plainest name, so a deluxe reissue with the fans does not
 * push the record itself off the list. Singles and EPs are left out.
 */
const topAlbums = (name) => remember('deezer-top-albums', name, async () => {
    const want = looseName(name);
    const artists = (await deezer(`/search/artist?q=${encodeURIComponent(name)}&limit=10`)).data ?? [];
    const artist = artists.filter((a) => looseName(a.name) === want).sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))[0];
    if (!artist) return [];
    const list = (await deezer(`/artist/${artist.id}/albums?limit=100`)).data ?? [];
    const pooled = new Map();
    for (const a of list.filter((x) => x.record_type === 'album' && x.title)) {
        const k = looseName(baseAlbumName(a.title));
        const p = pooled.get(k) ?? { names: [], fans: 0 };
        p.names.push(a.title);
        p.fans += a.fans ?? 0;
        pooled.set(k, p);
    }
    return [...pooled.values()]
        .sort((a, b) => b.fans - a.fans)
        .map((p) => ({ name: preferStandard(p.names), fans: p.fans }));
});

export async function candidates(profile, { log = console.log, limitArtists } = {}) {
    const seeds = seedArtists(profile, Math.min(SEEDS, limitArtists ?? SEEDS));
    log(`listenbrainz: ${seeds.length} seeds`);
    const perSeed = [];
    let unresolved = 0;
    for (const seed of seeds) {
        // eslint-disable-next-line no-await-in-loop
        const id = await mbid(seed.name);
        if (!id) { unresolved += 1; continue; }
        // eslint-disable-next-line no-await-in-loop
        const list = (await similar(id)).slice(0, NEIGHBOURS);
        if (!list.length) continue;
        // Raw Labs scores are co-occurrence counts that scale with the seed's
        // own audience; dividing by the seed's best neighbour puts a niche
        // seed's closest match on the same footing as a famous one's.
        const top = list[0].score || 1;
        perSeed.push({ seed, list: list.map((n, i) => ({ ...n, similarity: n.score / top, rank: i + 1 })) });
    }
    log(`listenbrainz: ${unresolved} seeds with no MusicBrainz match, ${perSeed.length} with neighbours`);
    const folded = foldNeighbours(perSeed, seeds);
    const neighbours = [];
    for (const n of folded) {
        // eslint-disable-next-line no-await-in-loop
        const albums = await topAlbums(n.name);
        neighbours.push({ ...n, albums: albums.map((a) => a.name) });
    }
    return resolveNeighbours(neighbours, profile, { source: 'listenbrainz', log });
}
