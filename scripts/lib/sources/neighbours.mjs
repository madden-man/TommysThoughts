// What the two similar-artist sources (ListenBrainz, Last.fm) share once each
// has its list of neighbours: turn "an artist like Lord Huron, and their most
// played albums" into Spotify album ids. Not a source itself.
//
// The neighbour's albums come ranked by the outside service's own listen
// counts, because Spotify no longer returns popularity to this app; that
// ranking is what the six-album cap is applied to.

import { albumKey, heardSets, isNotARecord, looseName, mapLimit, MIN_TRACKS } from '../candidates.mjs';
import { baseAlbumName } from '../../../src/views/spotify/names.js';
import {
    BudgetSpent, Throttled, cached, cachedAlbumsByArtistName, cachedArtistAlbums, cachedSearchArtists, throttledEndpoints,
} from './spotify-cached.mjs';

export const ALBUMS_PER_NEIGHBOUR = 6;

/**
 * A neighbour's albums as stubs, or null when Spotify has no such artist. The
 * artist route (search, then /artists/{id}/albums) is complete; while that
 * endpoint is throttled, one album search on the name stands in.
 */
const neighbourAlbums = async (name) => {
    // Whatever an earlier run already learned comes first and costs nothing:
    // the full route if it was walked, else the search stand-in.
    const known = cached('spotify-search-artists', name)
        && (await cachedSearchArtists(name)).find((h) => looseName(h.name) === looseName(name));
    if (known && cached('spotify-artist-albums', known.id)) return cachedArtistAlbums(known.id, known.name);
    if (cached('spotify-albums-by-artist-name', name)) {
        const list = await cachedAlbumsByArtistName(name);
        return list.length ? list : null;
    }
    if (throttledEndpoints().includes('artist-albums')) {
        const list = await cachedAlbumsByArtistName(name);
        return list.length ? list : null;
    }
    const hits = await cachedSearchArtists(name);
    const artist = hits.find((h) => looseName(h.name) === looseName(name));
    return artist ? cachedArtistAlbums(artist.id, artist.name) : null;
};

/**
 * neighbours: [{ name, links: [{ seed, score, rank }], albums: [name, ...] }],
 * `albums` best first. Returns contract rows, one per (album, seed) so the
 * builder's merge keeps every seed that pointed at the record.
 */
export const resolveNeighbours = async (neighbours, profile, { source, log }) => {
    const heard = heardSets(profile);
    const rows = [];
    let noArtist = 0; let unmatched = 0; let unreached = 0;
    // Closest neighbours first, so a spent Spotify budget costs the faintest
    // links rather than a random handful.
    const best = (n) => Math.max(0, ...n.links.map((l) => l.score));
    const ordered = [...neighbours].sort((a, b) => best(b) - best(a));
    await mapLimit(ordered, 2, async (n) => {
        const picks = n.albums
            .filter((name) => !isNotARecord(name) && !heard.keys.has(albumKey(n.name, name)))
            .slice(0, ALBUMS_PER_NEIGHBOUR);
        if (!picks.length) return;
        let list;
        try {
            list = await neighbourAlbums(n.name);
        } catch (e) {
            if (e instanceof BudgetSpent || e instanceof Throttled) { unreached += 1; return; }
            log(`  ${source}: ${n.name}: ${e.message.slice(0, 80)}`);
            return;
        }
        if (!list) { noArtist += 1; return; }
        for (const [i, name] of picks.entries()) {
            const want = looseName(baseAlbumName(name));
            // Several Spotify editions of one record share a base name; the
            // plain one first, so the album fetched is the one people mean.
            const matches = list.filter((a) => looseName(baseAlbumName(a.name)) === want);
            const hit = matches.find((a) => baseAlbumName(a.name) === a.name.trim()) ?? matches[0];
            if (!hit) { unmatched += 1; continue; }
            if (hit.album_type !== 'album' || (hit.total_tracks ?? 0) < MIN_TRACKS || heard.ids.has(hit.id)) continue;
            for (const link of n.links) {
                rows.push({
                    artist: hit.artists?.[0]?.name ?? n.name, album: hit.name, albumId: hit.id,
                    score: Math.round(link.score * 1000) / 1000, via: link.seed,
                    note: `similar artist ${n.name}, rank ${link.rank}; their #${i + 1} album`,
                });
            }
        }
    });
    log(`${source}: ${neighbours.length} neighbours, ${noArtist} not on Spotify, ${unreached} not reached (Spotify budget), ${unmatched} albums with no Spotify match, ${rows.length} rows`);
    return rows;
};

/** Seeds for both similar-artist sources: the top artists Tommy has not turned away from. */
export const seedArtists = (profile, cap) => (profile.artists ?? [])
    .filter((a) => (a.droppedAlbums ?? 0) <= (a.lovedAlbums ?? 0))
    .slice(0, cap);

/**
 * Fold per-seed neighbour lists into one entry per neighbour. A neighbour that
 * is itself a seed is left out: its records come from known-artist, and here
 * it would only crowd out the strangers this source exists to find.
 */
export const foldNeighbours = (perSeed, seeds) => {
    const seedNames = new Set(seeds.map((s) => looseName(s.name)));
    const byName = new Map();
    for (const { seed, list } of perSeed) {
        for (const n of list) {
            const k = looseName(n.name);
            if (seedNames.has(k)) continue;
            const entry = byName.get(k) ?? { name: n.name, id: n.id, links: [] };
            entry.links.push({ seed: seed.name, score: (seed.score ?? 0) * n.similarity, rank: n.rank });
            byName.set(k, entry);
        }
    }
    return [...byName.values()];
};
