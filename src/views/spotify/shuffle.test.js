import {
    antiClump,
    albumBlocksOf,
    artistKeyOf,
    blocksOf,
    describeOrder,
    dividerMatcher,
    flatten,
    isSeasonDivider,
    markerSectionsOf,
    partsOf,
    sectionsOf,
    SEASON_CYCLE,
    seasonOf,
    seasonOn,
    seasonsFrom,
    seasonSectionsOf,
    seededRandom,
    shuffleKeepingAlbums,
} from './shuffle';

// A compact way to write a playlist: "artist:album" per track.
const trackList = (spec) => spec.map((s, i) => {
    const [artist, album] = s.split(':');
    return {
        uri: `spotify:track:${i}`,
        name: `${s} #${i}`,
        artistIds: [artist],
        artistNames: [artist],
        albumId: album ?? null,
        albumName: album ?? null,
    };
});

const urisOf = (tracks) => tracks.map((t) => t.uri);
const artistsOf = (tracks) => tracks.map((t) => t.artistIds[0]);

describe('blocksOf', () => {
    it('welds a run of consecutive same-album tracks into one block', () => {
        const blocks = blocksOf(trackList(['a:X', 'a:X', 'a:X', 'b:Y']));
        expect(blocks).toHaveLength(2);
        expect(blocks[0].tracks).toHaveLength(3);
        expect(blocks[1].tracks).toHaveLength(1);
    });

    it('keeps a run in its existing internal order', () => {
        const tracks = trackList(['a:X', 'a:X', 'a:X']);
        expect(urisOf(blocksOf(tracks)[0].tracks)).toEqual(urisOf(tracks));
    });

    it('does not weld same-album tracks that were never adjacent', () => {
        // Same album at either end, a different one in between: they were not
        // together, so they stay two separate blocks.
        const blocks = blocksOf(trackList(['a:X', 'b:Y', 'a:X']));
        expect(blocks).toHaveLength(3);
        expect(blocks.every((b) => b.tracks.length === 1)).toBe(true);
    });

    it('never welds on a missing album id', () => {
        const blocks = blocksOf(trackList(['a', 'b', 'c']));
        expect(blocks).toHaveLength(3);
    });

    it('takes an empty or missing list', () => {
        expect(blocksOf([])).toEqual([]);
        expect(blocksOf(undefined)).toEqual([]);
    });
});

describe('artistKeyOf', () => {
    it('keys on the primary artist, ignoring features', () => {
        const block = {
            tracks: [{ artistIds: ['frank', 'guest'], artistNames: ['Frank', 'Guest'] }],
        };
        expect(artistKeyOf(block)).toBe('frank');
    });
});

describe('shuffleKeepingAlbums', () => {
    it('returns exactly the tracks it was given', () => {
        const tracks = trackList(['a:X', 'b:Y', 'c:Z', 'a:W', 'b:V', 'd:U']);
        const out = shuffleKeepingAlbums(tracks, seededRandom(7));
        expect(out).toHaveLength(tracks.length);
        expect(urisOf(out).sort()).toEqual(urisOf(tracks).sort());
    });

    it('keeps every album run intact and contiguous', () => {
        const tracks = trackList([
            'a:X', 'a:X', 'a:X',      // a 3-track run
            'b:Y', 'c:Z', 'd:W',
            'e:V', 'e:V',             // a 2-track run
            'f:U', 'g:T',
        ]);
        const out = shuffleKeepingAlbums(tracks, seededRandom(3));
        // The run's tracks must still sit together, in order.
        const runUris = urisOf(tracks.slice(0, 3));
        const at = urisOf(out).indexOf(runUris[0]);
        expect(urisOf(out).slice(at, at + 3)).toEqual(runUris);

        const pairUris = urisOf(tracks.slice(6, 8));
        const pairAt = urisOf(out).indexOf(pairUris[0]);
        expect(urisOf(out).slice(pairAt, pairAt + 2)).toEqual(pairUris);
    });

    it('separates the same artist when there is room', () => {
        // Six artists, two blocks each — perfectly separable.
        const tracks = trackList([
            'a:1', 'a:2', 'b:3', 'b:4', 'c:5', 'c:6',
            'd:7', 'd:8', 'e:9', 'e:10', 'f:11', 'f:12',
        ]);
        const artists = artistsOf(shuffleKeepingAlbums(tracks, seededRandom(11)));
        const adjacent = artists.filter((a, i) => i > 0 && a === artists[i - 1]);
        expect(adjacent).toHaveLength(0);
    });

    it('spreads a prolific artist across the whole playlist', () => {
        // One artist with a third of the blocks should not end up in a clump.
        const tracks = trackList([
            'a:1', 'a:2', 'a:3', 'a:4',
            'b:5', 'c:6', 'd:7', 'e:8', 'f:9', 'g:10', 'h:11', 'i:12',
        ]);
        const artists = artistsOf(shuffleKeepingAlbums(tracks, seededRandom(5)));
        const positions = artists
            .map((a, i) => (a === 'a' ? i : -1)).filter((i) => i >= 0);
        expect(positions).toHaveLength(4);
        // Never adjacent, and the run reaches into the back half.
        positions.forEach((p, i) => {
            if (i > 0) expect(p - positions[i - 1]).toBeGreaterThan(1);
        });
        expect(Math.max(...positions)).toBeGreaterThan(artists.length / 2);
    });

    it('still terminates when one artist dominates', () => {
        // Eight of nine blocks are the same artist: adjacency is arithmetic,
        // not a bug. It must finish and lose nothing.
        const tracks = trackList([
            'a:1', 'a:2', 'a:3', 'a:4', 'a:5', 'a:6', 'a:7', 'a:8', 'b:9',
        ]);
        const out = shuffleKeepingAlbums(tracks, seededRandom(2));
        expect(out).toHaveLength(9);
        expect(urisOf(out).sort()).toEqual(urisOf(tracks).sort());
    });

    it('gives a different order on a different draw', () => {
        const tracks = trackList([
            'a:1', 'b:2', 'c:3', 'd:4', 'e:5', 'f:6', 'g:7', 'h:8', 'i:9', 'j:10',
        ]);
        const first = urisOf(shuffleKeepingAlbums(tracks, seededRandom(1)));
        const second = urisOf(shuffleKeepingAlbums(tracks, seededRandom(999)));
        expect(first).not.toEqual(second);
    });

    it('handles the trivial sizes', () => {
        expect(shuffleKeepingAlbums([], seededRandom(1))).toEqual([]);
        const one = trackList(['a:X']);
        expect(urisOf(shuffleKeepingAlbums(one, seededRandom(1)))).toEqual(urisOf(one));
    });

    it('is a permutation on every seed it is given', () => {
        const tracks = trackList([
            'a:X', 'a:X', 'b:Y', 'c:Z', 'c:Z', 'c:Z', 'd:W', 'a:V', 'b:U', 'e:T',
            'f:S', 'f:S', 'g:R', 'h:Q', 'a:P',
        ]);
        const want = urisOf(tracks).sort();
        for (let seed = 0; seed < 40; seed++) {
            const out = shuffleKeepingAlbums(tracks, seededRandom(seed));
            expect(urisOf(out).sort()).toEqual(want);
        }
    });
});

// These are the tests the first version of antiClump passed while being badly
// broken. It scored candidates by how many blocks they had left, which made it a
// sort by artist frequency: the two biggest artists alternated across the
// opening and every one-block artist was stranded in the last fifth. Nothing
// above noticed, because a one-block artist never repeats and so never shows up
// in any adjacency or gap measurement.
describe('spread', () => {
    // A realistic shape: a few prolific artists, a long tail of one-offs.
    const mixed = () => {
        const spec = [];
        [['big', 30], ['mid', 20], ['med', 12]].forEach(([artist, n]) => {
            for (let i = 0; i < n; i++) spec.push(`${artist}:al-${artist}-${i}`);
        });
        for (let i = 0; i < 60; i++) spec.push(`one${i}:al-one-${i}`);
        return trackList(spec);
    };

    const pilesByPosition = (out) => {
        const counts = new Map();
        out.forEach((t) => counts.set(t.artistIds[0], (counts.get(t.artistIds[0]) ?? 0) + 1));
        return out.map((t) => counts.get(t.artistIds[0]));
    };

    it('does not front-load the prolific artists', () => {
        const out = shuffleKeepingAlbums(mixed(), seededRandom(77));
        const piles = pilesByPosition(out);
        const half = Math.floor(piles.length / 2);
        const mean = (a) => a.reduce((n, x) => n + x, 0) / a.length;
        const front = mean(piles.slice(0, half));
        const back = mean(piles.slice(half));
        // The broken version gave front ~24 and back ~2.
        expect(Math.abs(front - back) / ((front + back) / 2)).toBeLessThan(0.4);
    });

    it('does not strand the one-off artists at the end', () => {
        const out = shuffleKeepingAlbums(mixed(), seededRandom(78));
        const piles = pilesByPosition(out);
        const spots = piles
            .map((n, i) => (n === 1 ? i / piles.length : null))
            .filter((v) => v !== null);
        const average = spots.reduce((a, b) => a + b, 0) / spots.length;
        // The broken version put these at ~0.85 of the way through.
        expect(average).toBeGreaterThan(0.35);
        expect(average).toBeLessThan(0.65);
    });

    it('never lets the two biggest artists ping-pong', () => {
        const out = shuffleKeepingAlbums(mixed(), seededRandom(79));
        const artists = out.map((t) => t.artistIds[0]);
        // The broken version opened big,mid,big,mid,big,mid...
        const alternating = artists
            .slice(0, 20)
            .filter((a, i) => i >= 2 && a === artists[i - 2]).length;
        expect(alternating).toBeLessThan(4);
    });

    it('spaces an artist at roughly the stride the section allows', () => {
        const out = shuffleKeepingAlbums(mixed(), seededRandom(80));
        const spots = out
            .map((t, i) => (t.artistIds[0] === 'big' ? i : null))
            .filter((v) => v !== null);
        const gaps = spots.slice(1).map((p, i) => p - spots[i]).sort((a, b) => a - b);
        const ideal = out.length / spots.length;
        const median = gaps[Math.floor(gaps.length / 2)];
        // The typical gap is what you hear, so that is what is pinned; the
        // extremes of thirty gaps wander either side of the stride and pinning
        // those would be testing the noise.
        expect(median).toBeGreaterThan(ideal * 0.7);
        expect(median).toBeLessThan(ideal * 1.3);
        // Never adjacent, though — that one is a guarantee, not a tendency.
        expect(gaps[0]).toBeGreaterThanOrEqual(2);
    });

    it('places the same artist differently on a different draw', () => {
        const at = (seed) => shuffleKeepingAlbums(mixed(), seededRandom(seed))
            .map((t, i) => (t.artistIds[0] === 'big' ? i : null))
            .filter((v) => v !== null);
        expect(at(81)).not.toEqual(at(82));
    });
});

describe('album order across a broken-up record', () => {
    // One album's tracks scattered among other artists, plus a second album to
    // prove the two are ordered independently.
    const scattered = () => {
        const t = (name, artist, albumId, trackNumber) => ({
            uri: `spotify:track:${name}`,
            name,
            artistIds: [artist],
            artistNames: [artist],
            albumId,
            albumName: albumId,
            discNumber: 1,
            trackNumber,
        });
        return [
            t('rec-9', 'A', 'REC', 9), t('x1', 'X', 'x1', 1),
            t('rec-2', 'A', 'REC', 2), t('y1', 'Y', 'y1', 1),
            t('other-5', 'B', 'OTHER', 5), t('z1', 'Z', 'z1', 1),
            t('rec-5', 'A', 'REC', 5), t('w1', 'W', 'w1', 1),
            t('other-1', 'B', 'OTHER', 1), t('v1', 'V', 'v1', 1),
            t('rec-1', 'A', 'REC', 1), t('u1', 'U', 'u1', 1),
        ];
    };

    const orderOf = (out, album) => out
        .filter((t) => t.albumId === album)
        .map((t) => t.trackNumber);

    it('plays a scattered album in album order, not playlist order', () => {
        const out = shuffleKeepingAlbums(scattered(), seededRandom(5));
        expect(orderOf(out, 'REC')).toEqual([1, 2, 5, 9]);
    });

    it('orders each album independently', () => {
        const out = shuffleKeepingAlbums(scattered(), seededRandom(6));
        expect(orderOf(out, 'REC')).toEqual([1, 2, 5, 9]);
        expect(orderOf(out, 'OTHER')).toEqual([1, 5]);
    });

    it('holds for every draw', () => {
        for (let seed = 0; seed < 30; seed++) {
            expect(orderOf(shuffleKeepingAlbums(scattered(), seededRandom(seed)), 'REC'))
                .toEqual([1, 2, 5, 9]);
        }
    });

    it('still spreads the album out rather than regrouping it', () => {
        const out = shuffleKeepingAlbums(scattered(), seededRandom(9));
        const at = out.map((t, i) => (t.albumId === 'REC' ? i : null)).filter((i) => i !== null);
        // Four blocks in twelve slots: never adjacent, and reaching both ends.
        at.slice(1).forEach((p, i) => expect(p - at[i]).toBeGreaterThan(1));
    });

    it('uses disc number before track number', () => {
        const t = (n, disc, num) => ({
            uri: `spotify:track:${n}`, name: n, artistIds: ['A'], artistNames: ['A'],
            albumId: 'D', albumName: 'D', discNumber: disc, trackNumber: num,
        });
        const other = (n) => ({
            uri: `spotify:track:${n}`, name: n, artistIds: [n], artistNames: [n],
            albumId: n, albumName: n, discNumber: 1, trackNumber: 1,
        });
        const out = shuffleKeepingAlbums(
            [t('d2t1', 2, 1), other('p'), t('d1t9', 1, 9), other('q')],
            seededRandom(4),
        );
        expect(out.filter((x) => x.albumId === 'D').map((x) => x.name))
            .toEqual(['d1t9', 'd2t1']);
    });

    it('falls back to the original order when tracks carry no numbering', () => {
        const bare = (n, album) => ({
            uri: `spotify:track:${n}`, name: n, artistIds: ['A'], artistNames: ['A'],
            albumId: album, albumName: album,
        });
        const other = (n) => ({
            uri: `spotify:track:${n}`, name: n, artistIds: [n], artistNames: [n],
            albumId: n, albumName: n,
        });
        const src = [bare('first', 'N'), other('p'), bare('second', 'N'), other('q')];
        const out = shuffleKeepingAlbums(src, seededRandom(3));
        expect(out.filter((x) => x.albumId === 'N').map((x) => x.name))
            .toEqual(['first', 'second']);
    });

    it('leaves a welded run alone — it was already in order', () => {
        const t = (n, num) => ({
            uri: `spotify:track:${n}`, name: n, artistIds: ['A'], artistNames: ['A'],
            albumId: 'R', albumName: 'R', discNumber: 1, trackNumber: num,
        });
        // Adjacent in the source, so one block, and its internal order stands
        // even though the track numbers descend.
        const out = shuffleKeepingAlbums([t('c', 7), t('b', 3), t('a', 1)], seededRandom(1));
        expect(out.map((x) => x.name)).toEqual(['c', 'b', 'a']);
    });
});

describe('whole-album mode', () => {
    const t = (name, artist, album, num) => ({
        uri: `spotify:track:${name}`,
        name,
        artistIds: [artist],
        artistNames: [artist],
        albumId: album,
        albumName: album,
        discNumber: 1,
        trackNumber: num,
    });

    // Two records, deliberately scattered and out of order, plus filler.
    const scattered = () => [
        t('rec-3', 'A', 'REC', 3), t('p', 'P', 'p', 1),
        t('two-2', 'B', 'TWO', 2), t('q', 'Q', 'q', 1),
        t('rec-1', 'A', 'REC', 1), t('r', 'R', 'r', 1),
        t('two-1', 'B', 'TWO', 1), t('s', 'S', 's', 1),
        t('rec-2', 'A', 'REC', 2), t('u', 'U', 'u', 1),
    ];

    const whole = { wholeAlbums: true };

    it('gathers every track of a record into one unbroken run', () => {
        const out = shuffleKeepingAlbums(scattered(), seededRandom(3), whole);
        const at = out.map((x, i) => (x.albumId === 'REC' ? i : null)).filter((i) => i !== null);
        expect(at).toHaveLength(3);
        expect(at[2] - at[0]).toBe(2);      // contiguous
    });

    it('plays the gathered record in album order', () => {
        const out = shuffleKeepingAlbums(scattered(), seededRandom(4), whole);
        expect(out.filter((x) => x.albumId === 'REC').map((x) => x.trackNumber))
            .toEqual([1, 2, 3]);
        expect(out.filter((x) => x.albumId === 'TWO').map((x) => x.trackNumber))
            .toEqual([1, 2]);
    });

    it('loses nothing and duplicates nothing', () => {
        const src = scattered();
        const out = shuffleKeepingAlbums(src, seededRandom(5), whole);
        expect(out.map((x) => x.uri).sort()).toEqual(src.map((x) => x.uri).sort());
    });

    it('moves the record around between draws', () => {
        const first = shuffleKeepingAlbums(scattered(), seededRandom(6), whole)
            .findIndex((x) => x.albumId === 'REC');
        const other = shuffleKeepingAlbums(scattered(), seededRandom(40), whole)
            .findIndex((x) => x.albumId === 'REC');
        expect(first).not.toBe(other);
    });

    it('is the difference between the two modes', () => {
        const src = scattered();
        const spread = shuffleKeepingAlbums(src, seededRandom(7));
        const grouped = shuffleKeepingAlbums(src, seededRandom(7), whole);
        const runLength = (out) => {
            const at = out.map((x, i) => (x.albumId === 'REC' ? i : null))
                .filter((i) => i !== null);
            return at[at.length - 1] - at[0];
        };
        expect(runLength(grouped)).toBe(2);            // together
        expect(runLength(spread)).toBeGreaterThan(2);  // spread out
    });

    it('never gathers a record across a season divider', () => {
        const divider = (name, season) => ({
            ...t(name, 'D', `dv-${name}`, 1), name: season,
        });
        // The same album has tracks either side of the Fall divider.
        const src = [
            divider('d1', 'Casita'),
            t('rec-1', 'A', 'REC', 1), t('p', 'P', 'p', 1),
            divider('d2', 'doomsday'),
            t('rec-2', 'A', 'REC', 2), t('q', 'Q', 'q', 1),
        ];
        const out = shuffleKeepingAlbums(src, seededRandom(8), {
            ...whole, isDivider: isSeasonDivider,
        });
        const sections = seasonSectionsOf(out);
        // One REC track stays in each season rather than being pulled together.
        expect(sections[0].tracks.filter((x) => x.albumId === 'REC')).toHaveLength(1);
        expect(sections[1].tracks.filter((x) => x.albumId === 'REC')).toHaveLength(1);
    });

    it('still spreads the artists between records', () => {
        // Four artists, two albums each, two tracks per album.
        const src = [];
        ['A', 'B', 'C', 'D'].forEach((artist) => {
            [1, 2].forEach((album) => {
                [1, 2].forEach((num) =>
                    src.push(t(`${artist}${album}-${num}`, artist, `${artist}${album}`, num)));
            });
        });
        const out = shuffleKeepingAlbums(src, seededRandom(9), whole);
        const blocks = albumBlocksOf(out);
        const clash = blocks.filter((b, i) =>
            i > 0 && artistKeyOf(blocks[i - 1]) === artistKeyOf(b));
        expect(clash).toHaveLength(0);
    });
});

describe('the season the year is actually in', () => {
    const on = (iso) => seasonOn(new Date(`${iso}T12:00:00`));

    it('reads the date against the equinoxes and solstices', () => {
        expect(on('2026-01-15')).toBe('Winter');   // tail of the old winter
        expect(on('2026-03-19')).toBe('Winter');   // day before the equinox
        expect(on('2026-03-20')).toBe('Spring');
        expect(on('2026-06-20')).toBe('Spring');
        expect(on('2026-06-21')).toBe('Summer');
        expect(on('2026-08-23')).toBe('Summer');
        expect(on('2026-09-21')).toBe('Summer');   // day before the equinox
        expect(on('2026-09-22')).toBe('Fall');
        expect(on('2026-12-20')).toBe('Fall');
        expect(on('2026-12-21')).toBe('Winter');
        expect(on('2026-12-31')).toBe('Winter');
    });

    it('runs the cycle from whichever season it is', () => {
        expect(seasonsFrom('Summer')).toEqual(['Summer', 'Fall', 'Winter', 'Spring']);
        expect(seasonsFrom('Fall')).toEqual(['Fall', 'Winter', 'Spring', 'Summer']);
        expect(seasonsFrom('Winter')).toEqual(['Winter', 'Spring', 'Summer', 'Fall']);
        expect(seasonsFrom('Spring')).toEqual(['Spring', 'Summer', 'Fall', 'Winter']);
    });

    it('falls back to the plain cycle for a season it does not know', () => {
        expect(seasonsFrom('Monsoon')).toEqual(SEASON_CYCLE);
    });
});

describe('leading with the current season', () => {
    const song = (name, artist, album, num) => ({
        uri: `spotify:track:${name}`, name, artistIds: [artist], artistNames: [artist],
        albumId: album, albumName: album, discNumber: 1, trackNumber: num,
    });
    const divider = (title, artist) => song(title, artist, `dv-${title}`, 1);

    // The playlist as it actually is: Summer, Fall, SPRING, Winter — the
    // filing order, which is not the calendar order.
    const seasonal = () => [
        divider('Casita', 'goth'), song('s1', 'S1', 'as1', 1), song('s2', 'S2', 'as2', 1),
        divider('doomsday', 'lizzy'), song('f1', 'F1', 'af1', 1), song('f2', 'F2', 'af2', 1),
        divider('Analie', 'Stolen Gin'), song('p1', 'P1', 'ap1', 1), song('p2', 'P2', 'ap2', 1),
        divider("Don't Panic", 'cold'), song('w1', 'W1', 'aw1', 1), song('w2', 'W2', 'aw2', 1),
    ];

    const run = (leadWith) => seasonSectionsOf(
        shuffleKeepingAlbums(seasonal(), seededRandom(3), {
            isDivider: isSeasonDivider, leadWith,
        }),
    ).map((s) => s.season);

    it('puts the current season first and runs the calendar from there', () => {
        expect(run('Summer')).toEqual(['Summer', 'Fall', 'Winter', 'Spring']);
        expect(run('Fall')).toEqual(['Fall', 'Winter', 'Spring', 'Summer']);
        expect(run('Winter')).toEqual(['Winter', 'Spring', 'Summer', 'Fall']);
        expect(run('Spring')).toEqual(['Spring', 'Summer', 'Fall', 'Winter']);
    });

    it('fixes the filing order even when Summer already leads', () => {
        // The playlist files Spring third; the calendar puts Winter there.
        expect(seasonSectionsOf(seasonal()).map((s) => s.season))
            .toEqual(['Summer', 'Fall', 'Spring', 'Winter']);
        expect(run('Summer')).toEqual(['Summer', 'Fall', 'Winter', 'Spring']);
    });

    it('carries each divider along at the head of its own season', () => {
        const out = shuffleKeepingAlbums(seasonal(), seededRandom(4), {
            isDivider: isSeasonDivider, leadWith: 'Fall',
        });
        expect(out[0].name).toBe('doomsday');
        expect(seasonSectionsOf(out).map((s) => s.divider.name))
            .toEqual(['doomsday', "Don't Panic", 'Analie', 'Casita']);
    });

    it('keeps every season holding exactly its own tracks', () => {
        const before = seasonSectionsOf(seasonal());
        const after = seasonSectionsOf(shuffleKeepingAlbums(seasonal(), seededRandom(5), {
            isDivider: isSeasonDivider, leadWith: 'Winter',
        }));
        before.forEach((was) => {
            const now = after.find((s) => s.season === was.season);
            expect(now.tracks.map((t) => t.uri).sort())
                .toEqual(was.tracks.map((t) => t.uri).sort());
        });
    });

    it('loses nothing when the seasons move', () => {
        const src = seasonal();
        const out = shuffleKeepingAlbums(src, seededRandom(6), {
            isDivider: isSeasonDivider, leadWith: 'Spring',
        });
        expect(out.map((t) => t.uri).sort()).toEqual(src.map((t) => t.uri).sort());
    });

    it('leaves the order alone when no season is named', () => {
        const out = shuffleKeepingAlbums(seasonal(), seededRandom(7), {
            isDivider: isSeasonDivider,
        });
        expect(seasonSectionsOf(out).map((s) => s.season))
            .toEqual(['Summer', 'Fall', 'Spring', 'Winter']);
    });

    it('leads with a stretch that belongs to no season', () => {
        const stray = [song('stray', 'X', 'ax', 1), ...seasonal()];
        const out = shuffleKeepingAlbums(stray, seededRandom(8), {
            isDivider: isSeasonDivider, leadWith: 'Winter',
        });
        expect(out[0].name).toBe('stray');
        expect(seasonSectionsOf(out).map((s) => s.season))
            .toEqual([null, 'Winter', 'Spring', 'Summer', 'Fall']);
    });

    it('works the same in whole-album mode', () => {
        const out = shuffleKeepingAlbums(seasonal(), seededRandom(9), {
            isDivider: isSeasonDivider, leadWith: 'Fall', wholeAlbums: true,
        });
        expect(seasonSectionsOf(out).map((s) => s.season))
            .toEqual(['Fall', 'Winter', 'Spring', 'Summer']);
    });
});

describe('sections', () => {
    const four = () => trackList(
        Array.from({ length: 40 }, (_, i) => `a${i % 7}:al${i % 11}`),
    );
    const starts = [10, 20, 30];

    it('splits at the given starts and nowhere else', () => {
        const parts = sectionsOf(four(), starts);
        expect(parts.map((p) => p.length)).toEqual([10, 10, 10, 10]);
    });

    it('is one section when no boundaries are given', () => {
        expect(sectionsOf(four(), []).map((p) => p.length)).toEqual([40]);
    });

    it('ignores boundaries at 0, past the end, or repeated', () => {
        const parts = sectionsOf(four(), [0, 20, 20, 99, -5]);
        expect(parts.map((p) => p.length)).toEqual([20, 20]);
    });

    it('never moves a track out of its section', () => {
        const tracks = four();
        const out = shuffleKeepingAlbums(tracks, seededRandom(21), {
            sectionStarts: starts,
        });
        // Each section must hold exactly the tracks it started with.
        [[0, 10], [10, 20], [20, 30], [30, 40]].forEach(([from, to]) => {
            expect(urisOf(out.slice(from, to)).sort())
                .toEqual(urisOf(tracks.slice(from, to)).sort());
        });
    });

    it('still shuffles inside each section', () => {
        const tracks = four();
        const out = shuffleKeepingAlbums(tracks, seededRandom(33), {
            sectionStarts: starts,
        });
        expect(urisOf(out)).not.toEqual(urisOf(tracks));
    });

    it('lets a section boundary split an album run that straddles it', () => {
        // One 4-track album run, cut down the middle by a boundary at 2.
        const tracks = trackList(['a:X', 'a:X', 'a:X', 'a:X']);
        const out = shuffleKeepingAlbums(tracks, seededRandom(1), {
            sectionStarts: [2],
        });
        expect(urisOf(out.slice(0, 2))).toEqual(urisOf(tracks.slice(0, 2)));
        expect(urisOf(out.slice(2, 4))).toEqual(urisOf(tracks.slice(2, 4)));
    });

    it('reports each section as well as the total', () => {
        const report = describeOrder(four(), { sectionStarts: starts });
        expect(report.sections).toHaveLength(4);
        expect(report.tracks).toBe(40);
        expect(report.sections.reduce((n, s) => n + s.tracks, 0)).toBe(40);
    });

    it('holds up at the real shape: 2000 tracks in four sections', () => {
        // 2000 tracks, ~600 artists, some album runs — the actual playlist.
        const tracks = trackList(Array.from({ length: 2000 }, (_, i) => {
            const artist = `a${i % 613}`;
            // every 7th track repeats the previous album, making runs
            const album = `al${i % 7 === 0 ? Math.floor(i / 3) : i}`;
            return `${artist}:${album}`;
        }));
        const sectionStarts = [500, 1000, 1500];
        const started = Date.now();
        const out = shuffleKeepingAlbums(tracks, seededRandom(8), { sectionStarts });
        const elapsed = Date.now() - started;

        expect(out).toHaveLength(2000);
        expect(urisOf(out).sort()).toEqual(urisOf(tracks).sort());
        [[0, 500], [500, 1000], [1000, 1500], [1500, 2000]].forEach(([f, t]) => {
            expect(urisOf(out.slice(f, t)).sort())
                .toEqual(urisOf(tracks.slice(f, t)).sort());
        });
        // Runs in the browser on every shuffle, so it has to be quick.
        expect(elapsed).toBeLessThan(2000);
    });
});

describe('dividers', () => {
    const isDivider = dividerMatcher({ namePattern: '^--' });
    // Four sections of four, separated by three dividers.
    const withDividers = () => {
        const named = (s, name) => ({ ...trackList([s])[0], name });
        const out = [];
        ['w', 'x', 'y', 'z'].forEach((letter, s) => {
            if (s > 0) out.push(named('div:D', `-- section ${s + 1} --`));
            for (let i = 0; i < 4; i++) out.push(named(`${letter}${i}:al${i}`, `${letter}${i}`));
        });
        return out.map((t, i) => ({ ...t, uri: `spotify:track:${i}` }));
    };

    it('finds the dividers and the sections between them', () => {
        const parts = partsOf(withDividers(), isDivider);
        expect(parts.filter((p) => p.divider)).toHaveLength(3);
        expect(parts.filter((p) => p.tracks).map((p) => p.tracks.length))
            .toEqual([4, 4, 4, 4]);
    });

    it('leaves every divider on exactly the index it started on', () => {
        const tracks = withDividers();
        const before = tracks
            .map((t, i) => (isDivider(t) ? i : null)).filter((i) => i !== null);
        const out = shuffleKeepingAlbums(tracks, seededRandom(12), { isDivider });
        const after = out
            .map((t, i) => (isDivider(t) ? i : null)).filter((i) => i !== null);
        expect(after).toEqual(before);
    });

    it('never moves a track across a divider', () => {
        const tracks = withDividers();
        const out = shuffleKeepingAlbums(tracks, seededRandom(13), { isDivider });
        // Each section is w/x/y/z respectively — no letter may cross.
        [[0, 4], [5, 9], [10, 14], [15, 19]].forEach(([from, to]) => {
            const letters = new Set(out.slice(from, to).map((t) => t.artistIds[0][0]));
            expect(letters.size).toBe(1);
        });
    });

    it('shuffles within a section even though the seams hold', () => {
        const tracks = withDividers();
        const out = shuffleKeepingAlbums(tracks, seededRandom(14), { isDivider });
        expect(urisOf(out)).not.toEqual(urisOf(tracks));
        expect(urisOf(out).sort()).toEqual(urisOf(tracks).sort());
    });

    it('treats a playlist with no dividers as one section', () => {
        const tracks = trackList(['a:X', 'b:Y', 'c:Z']);
        const out = shuffleKeepingAlbums(tracks, seededRandom(15), { isDivider });
        expect(urisOf(out).sort()).toEqual(urisOf(tracks).sort());
    });

    it('matches dividers by uri as well as by name', () => {
        const byUri = dividerMatcher({ uris: ['spotify:track:1'] });
        expect(byUri({ uri: 'spotify:track:1', name: 'anything' })).toBe(true);
        expect(byUri({ uri: 'spotify:track:2', name: 'anything' })).toBe(false);
    });

    it('matches nothing when configured with nothing', () => {
        const none = dividerMatcher();
        expect(none({ uri: 'spotify:track:1', name: '-- section 2 --' })).toBe(false);
    });
});

describe('seasons', () => {
    const song = (name, artist, album, i) => ({
        uri: `spotify:track:${i}`,
        name,
        artistIds: [artist],
        artistNames: [artist],
        albumId: album,
        albumName: album,
    });

    // Four seasons, each opened by its divider, four songs deep.
    const seasonal = () => {
        const out = [];
        let i = 0;
        [['Casita', 'x'], ['Doomsday', 'y'], ['Analie', 'z'], ["Don't Panic", 'w']]
            .forEach(([divider, letter]) => {
                const artist = divider === 'Analie' ? 'Stolen Gin' : 'someone';
                out.push(song(divider, artist, `dv${i}`, i++));
                for (let n = 0; n < 4; n++) {
                    out.push(song(`${letter}${n}`, `${letter}${n}`, `al${n}`, i++));
                }
            });
        return out;
    };

    it('recognises each divider and names its season', () => {
        expect(seasonOf(song('Casita', 'someone', 'a', 0)).season).toBe('Summer');
        expect(seasonOf(song('Doomsday', 'someone', 'a', 0)).season).toBe('Fall');
        expect(seasonOf(song('Analie', 'Stolen Gin', 'a', 0)).season).toBe('Spring');
        expect(seasonOf(song("Don't Panic", 'someone', 'a', 0)).season).toBe('Winter');
    });

    it('matches regardless of case or which apostrophe Spotify sends', () => {
        expect(isSeasonDivider(song('don’t panic', 'someone', 'a', 0))).toBe(true);
        expect(isSeasonDivider(song('CASITA', 'someone', 'a', 0))).toBe(true);
    });

    it('requires the named artist where one is given', () => {
        // Another song called Analie is not the divider.
        expect(seasonOf(song('Analie', 'Someone Else', 'a', 0))).toBeNull();
        expect(seasonOf(song('Analie', 'Stolen Gin', 'a', 0))).not.toBeNull();
    });

    it('is not fooled by a title that merely contains a divider name', () => {
        expect(isSeasonDivider(song('Doomsday Clock', 'someone', 'a', 0))).toBe(false);
        expect(isSeasonDivider(song('Casita Grande', 'someone', 'a', 0))).toBe(false);
    });

    it('splits the playlist into four labelled seasons', () => {
        const sections = seasonSectionsOf(seasonal());
        expect(sections.map((s) => s.season))
            .toEqual(['Summer', 'Fall', 'Spring', 'Winter']);
        expect(sections.map((s) => s.tracks.length)).toEqual([4, 4, 4, 4]);
    });

    it('keeps each divider first in its own season after a shuffle', () => {
        const tracks = seasonal();
        const out = shuffleKeepingAlbums(tracks, seededRandom(31), {
            isDivider: isSeasonDivider,
        });
        // Dividers land on exactly the indices they held before.
        const before = tracks.map((t, i) => (isSeasonDivider(t) ? i : null))
            .filter((i) => i !== null);
        const after = out.map((t, i) => (isSeasonDivider(t) ? i : null))
            .filter((i) => i !== null);
        expect(after).toEqual(before);
        expect(after).toEqual([0, 5, 10, 15]);
        // And each still opens its own season, in the same season order.
        expect(seasonSectionsOf(out).map((s) => s.season))
            .toEqual(['Summer', 'Fall', 'Spring', 'Winter']);
    });

    it('never moves a song into another season', () => {
        const tracks = seasonal();
        const out = shuffleKeepingAlbums(tracks, seededRandom(32), {
            isDivider: isSeasonDivider,
        });
        seasonSectionsOf(out).forEach((section, i) => {
            const letter = ['x', 'y', 'z', 'w'][i];
            section.tracks.forEach((t) => expect(t.name.startsWith(letter)).toBe(true));
        });
    });

    it('keeps anything before the first divider as an unnamed section', () => {
        const tracks = [song('stray', 'a', 'al', 99), ...seasonal()];
        const sections = seasonSectionsOf(tracks);
        expect(sections[0].season).toBeNull();
        expect(sections[0].divider).toBeNull();
        expect(sections.map((s) => s.season))
            .toEqual([null, 'Summer', 'Fall', 'Spring', 'Winter']);
    });
});

describe('describeOrder', () => {
    it('reports the runs it protected and the closest artist repeat', () => {
        const tracks = trackList(['a:X', 'a:X', 'b:Y', 'a:Z', 'c:W']);
        const report = describeOrder(tracks);
        expect(report).toMatchObject({
            tracks: 5,
            blocks: 4,          // [a:X ×2], [b:Y], [a:Z], [c:W]
            albumRuns: 1,
            longestRun: 2,
        });
        // block 0 is artist a, block 2 is artist a -> a gap of 2
        expect(report.closestArtistRepeat).toBe(2);
        expect(report.adjacentArtistRepeats).toBe(0);
    });

    it('counts an unavoidable adjacency rather than hiding it', () => {
        const report = describeOrder(trackList(['a:X', 'a:Y']));
        expect(report.blocks).toBe(2);
        expect(report.adjacentArtistRepeats).toBe(1);
        expect(report.closestArtistRepeat).toBe(1);
    });

    it('reports no repeat when every artist is distinct', () => {
        expect(describeOrder(trackList(['a:X', 'b:Y'])).closestArtistRepeat).toBeNull();
    });
});

describe('flatten', () => {
    it('is the inverse of blocksOf on any order', () => {
        const tracks = trackList(['a:X', 'a:X', 'b:Y', 'c:Z']);
        expect(flatten(blocksOf(tracks))).toEqual(tracks);
    });
});

describe('antiClump', () => {
    it('returns every block exactly once', () => {
        const blocks = blocksOf(trackList(['a:X', 'b:Y', 'c:Z', 'a:W']));
        const out = antiClump(blocks, seededRandom(4));
        expect(out).toHaveLength(blocks.length);
        expect(new Set(out).size).toBe(blocks.length);
    });
});

describe('markerSectionsOf', () => {
    // uri is `spotify:track:<index>`, so a marker is the track at that index.
    const marker = (i, label) => ({ uri: `spotify:track:${i}`, label });

    it('is one unlabelled section when there are no markers', () => {
        const tracks = trackList(['a:X', 'b:Y', 'c:Z']);
        const sections = markerSectionsOf(tracks, []);
        expect(sections).toHaveLength(1);
        expect(sections[0].label).toBeNull();
        expect(sections[0].tracks).toHaveLength(3);
    });

    it('splits at each marker and labels the section it opens', () => {
        const tracks = trackList(['a:X', 'b:Y', 'c:Z', 'd:W']);
        const sections = markerSectionsOf(tracks, [marker(1, 'Side B'), marker(3, 'Encore')]);
        expect(sections.map((s) => s.label)).toEqual([null, 'Side B', 'Encore']);
        // The divider track is held separately, so `tracks` is what follows it:
        // one before the first marker, one after 'Side B', none after 'Encore'.
        expect(sections.map((s) => s.tracks.length)).toEqual([1, 1, 0]);
        expect(sections.map((s) => s.divider?.uri)).toEqual([undefined, tracks[1].uri, tracks[3].uri]);
    });

    it('sections follow playlist order, not the order markers were given', () => {
        const tracks = trackList(['a:X', 'b:Y', 'c:Z', 'd:W']);
        const sections = markerSectionsOf(tracks, [marker(3, 'Late'), marker(1, 'Early')]);
        expect(sections.map((s) => s.label)).toEqual([null, 'Early', 'Late']);
    });

    it('falls back to the track name when a marker has no label', () => {
        const tracks = trackList(['a:X', 'b:Y']);
        const [, opened] = markerSectionsOf(tracks, [marker(1, '')]);
        expect(opened.label).toBe(tracks[1].name);
        expect(opened.divider.uri).toBe(tracks[1].uri);
    });
});
