// Unheard records by artists Tommy already plays: the cheapest source and the
// most precise, and the one that catches a loved artist's new release. An
// artist whose dropped records outnumber the loved ones is skipped; a fourth
// album from someone he tried three times and left is not a recommendation.

import { albumKey, heardSets, isNotARecord, looseName, MIN_TRACKS, mapLimit } from '../candidates.mjs';
import { BudgetSpent, Throttled, cachedArtistAlbums, cachedSearchArtists } from './spotify-cached.mjs';

const TOP = 150;

/** The Spotify id for a profile artist: its own id when it has one, else a name search. */
const artistId = async (artist) => {
    if (artist.artistIds?.[0]) return artist.artistIds[0];
    const hits = await cachedSearchArtists(artist.name);
    return hits.find((h) => looseName(h.name) === looseName(artist.name))?.id ?? null;
};

export async function candidates(profile, { log = console.log, limitArtists } = {}) {
    const heard = heardSets(profile);
    const seeds = (profile.artists ?? [])
        .filter((a) => (a.droppedAlbums ?? 0) <= (a.lovedAlbums ?? 0))
        .slice(0, Math.min(TOP, limitArtists ?? TOP));
    log(`known-artist: ${seeds.length} artists`);
    const rows = [];
    let unreached = 0;
    // Seeds are in score order and the calls are spaced in that order, so a
    // spent budget costs the least-loved artists, not a random handful.
    await mapLimit(seeds, 2, async (artist) => {
        let list;
        try {
            const id = await artistId(artist);
            if (!id) { log(`  known-artist: no Spotify artist for ${artist.name}`); return; }
            list = await cachedArtistAlbums(id, artist.name);
        } catch (e) {
            if (e instanceof BudgetSpent || e instanceof Throttled) { unreached += 1; return; }
            log(`  known-artist: ${artist.name}: ${e.message.slice(0, 80)}`);
            return;
        }
        for (const a of list) {
            // Cheap filters on the simplified object, so the builder does not
            // spend an album fetch on something it would throw out anyway.
            if (a.album_type !== 'album' || (a.total_tracks ?? 0) < MIN_TRACKS || isNotARecord(a.name)) continue;
            if (heard.ids.has(a.id)) continue;
            const credited = a.artists?.[0]?.name ?? artist.name;
            if (heard.keys.has(albumKey(credited, a.name)) || heard.keys.has(albumKey(artist.name, a.name))) continue;
            rows.push({
                artist: credited, album: a.name, albumId: a.id, score: artist.score ?? 0, via: artist.name,
                note: `unheard album by ${artist.name}`,
            });
        }
    });
    if (unreached) log(`known-artist: Spotify budget spent or endpoint throttled, ${unreached} lowest-scored artists not reached (rerun to continue from the cache)`);
    log(`known-artist: ${rows.length} rows`);
    return rows;
}
