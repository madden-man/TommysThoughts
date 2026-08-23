import {
    antiClump,
    artistKeyOf,
    blocksOf,
    describeOrder,
    dividerMatcher,
    flatten,
    isSeasonDivider,
    partsOf,
    sectionsOf,
    seasonOf,
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
