import {
    DEFAULT_WEIGHTS, TIER_ORDER, albumKeyOf, albumOfBlock, profileIndex, rankAlbums, scoreAlbum,
} from './fit';

const PROFILE = {
    artists: [
        { name: 'Lord Huron', artistIds: ['art-lh'], score: 0.9, hours: 140, lovedAlbums: 3, droppedAlbums: 0, genres: ['indie folk'] },
        { name: 'Owl City', artistIds: ['art-oc'], score: 0.5, hours: 30, lovedAlbums: 0, droppedAlbums: 0, genres: ['synthpop'] },
        { name: 'Faded Band', artistIds: ['art-fb'], score: 0.4, hours: 12, lovedAlbums: 0, droppedAlbums: 2, genres: ['pop rock'] },
    ],
    albums: [
        { key: albumKeyOf('Lord Huron', 'Strange Trails'), artist: 'Lord Huron', album: 'Strange Trails', albumIds: ['alb-st'], verdict: 'loved', hours: 48 },
        { key: albumKeyOf('Owl City', 'Ocean Eyes'), artist: 'Owl City', album: 'Ocean Eyes', albumIds: ['alb-oe'], verdict: 'liked', hours: 20 },
        { key: albumKeyOf('Faded Band', 'Gone Record'), artist: 'Faded Band', album: 'Gone Record', albumIds: ['alb-dr'], verdict: 'dropped', hours: 3 },
        { key: albumKeyOf('Faded Band', 'Second Try'), artist: 'Faded Band', album: 'Second Try', albumIds: ['alb-d2'], verdict: 'dropped', hours: 2 },
    ],
    genres: [
        { genre: 'indie folk', weight: 0.6, recentWeight: 0.6 },
        { genre: 'synthpop', weight: 0.2, recentWeight: 0.2 },
        { genre: 'pop rock', weight: 0.2, recentWeight: 0.2 },
    ],
    heard: {
        // Owl City's All Things Bright is heard but has no verdict row: sampled.
        albumKeys: [
            albumKeyOf('Lord Huron', 'Strange Trails'), albumKeyOf('Owl City', 'Ocean Eyes'),
            albumKeyOf('Faded Band', 'Gone Record'), albumKeyOf('Faded Band', 'Second Try'),
            albumKeyOf('Owl City', 'All Things Bright and Beautiful'),
        ],
        albumIds: ['alb-st', 'alb-oe', 'alb-dr', 'alb-d2', 'alb-atb'],
    },
    shape: { medianTracks: 12, medianMinutes: 44, fullAlbumShare: 0.6 },
};
const index = profileIndex(PROFILE);

describe('scoreAlbum', () => {
    it('reads the tier from the profile: unheard, sampled, liked, loved, dropped', () => {
        const tier = (album) => scoreAlbum(album, index).tier;
        expect(tier({ artist: 'Lord Huron', album: 'Long Lost' })).toBe('unheard');
        expect(tier({ artist: 'Owl City', album: 'All Things Bright and Beautiful' })).toBe('sampled');
        expect(tier({ artist: 'Owl City', album: 'Ocean Eyes (Deluxe Version)' })).toBe('liked');
        expect(tier({ artist: 'Somebody', album: 'Renamed', albumId: 'alb-st' })).toBe('loved');
        expect(tier({ artist: 'Faded Band', album: 'Gone Record' })).toBe('dropped');
    });

    it('scores a loved artist in a loved genre above a stranger', () => {
        const known = scoreAlbum({ artist: 'Lord Huron', album: 'Long Lost', artistIds: ['art-lh'], genre: 'indie folk', totalTracks: 12 }, index);
        const stranger = scoreAlbum({ artist: 'Nobody', album: 'Anything', genre: 'polka', totalTracks: 12 }, index);
        expect(known.score).toBeGreaterThan(stranger.score);
        expect(known.reasons[0]).toBe('you kept 3 records by Lord Huron');
        expect(known.reasons).toContain('indie folk is near the top of your listening');
        expect(known.key).toBe(albumKeyOf('Lord Huron', 'Long Lost'));
    });

    it('takes the best of a genres list', () => {
        const one = scoreAlbum({ artist: 'Nobody', album: 'X', genres: ['polka'] }, index);
        const two = scoreAlbum({ artist: 'Nobody', album: 'X', genres: ['polka', 'indie folk'] }, index);
        expect(two.parts.genre).toBeGreaterThan(one.parts.genre);
        expect(two.reasons).toContain('indie folk is near the top of your listening');
    });

    it('reads genre keep rates from the judged rows, shrunk toward the overall rate', () => {
        const w = { ...DEFAULT_WEIGHTS, genreKeep: 1 };
        const folk = scoreAlbum({ artist: 'Nobody', album: 'X', genres: ['indie folk'] }, index, w);
        const poprock = scoreAlbum({ artist: 'Nobody', album: 'X', genres: ['pop rock'] }, index, w);
        const none = scoreAlbum({ artist: 'Nobody', album: 'X' }, index, w);
        expect(folk.parts.genreKeep).toBeGreaterThan(none.parts.genreKeep);
        expect(poprock.parts.genreKeep).toBeLessThan(none.parts.genreKeep);
        // overall: 2 kept of 4 judged
        expect(none.parts.genreKeep).toBeCloseTo(0.5);
    });

    it('penalises a dropped record and an artist with more misses than keeps', () => {
        const dropped = scoreAlbum({ artist: 'Faded Band', album: 'Gone Record', genre: 'pop rock' }, index);
        const fresh = scoreAlbum({ artist: 'Faded Band', album: 'Third Go', genre: 'pop rock' }, index);
        expect(dropped.parts.penalty).toBeCloseTo(-(DEFAULT_WEIGHTS.droppedPenalty + DEFAULT_WEIGHTS.artistMissPenalty));
        expect(fresh.parts.penalty).toBeCloseTo(-DEFAULT_WEIGHTS.artistMissPenalty);
        expect(fresh.reasons).toContain('Faded Band has more misses than keeps with you');
        expect(dropped.score).toBeLessThan(fresh.score);
    });

    it('leaves the source weight off the scale when there is no source score', () => {
        const album = { artist: 'Nobody', album: 'X', genre: 'indie folk', totalTracks: 12 };
        const without = scoreAlbum(album, index);
        const withZero = scoreAlbum({ ...album, sourceScore: 0 }, index);
        const withOne = scoreAlbum({ ...album, sourceScore: 1 }, index);
        expect(without.score).toBeGreaterThan(withZero.score);
        expect(withOne.score).toBeGreaterThan(withZero.score);
        expect(withOne.parts.source).toBeCloseTo(DEFAULT_WEIGHTS.source);
    });

    it('credits a featured artist at half strength', () => {
        const lead = scoreAlbum({ artist: 'Lord Huron', album: 'X', artistIds: ['art-lh'] }, index);
        const feature = scoreAlbum({ artist: 'Stranger', album: 'X', artistIds: ['art-zz', 'art-lh'] }, index);
        expect(feature.parts.artist).toBeCloseTo(lead.parts.artist / 2);
    });

    it('is safe on an empty profile', () => {
        const r = scoreAlbum({ artist: 'A', album: 'B' }, profileIndex(null));
        expect(r.tier).toBe('unheard');
        expect(Number.isFinite(r.score)).toBe(true);
    });
});

describe('rankAlbums', () => {
    it('orders the tiers unheard, sampled, kept, dropped, by score within a tier', () => {
        expect(TIER_ORDER.unheard).toBeLessThan(TIER_ORDER.sampled);
        expect(TIER_ORDER.sampled).toBeLessThan(TIER_ORDER.liked);
        expect(TIER_ORDER.liked).toBe(TIER_ORDER.loved);
        expect(TIER_ORDER.loved).toBeLessThan(TIER_ORDER.dropped);

        const ranked = rankAlbums([
            { artist: 'Faded Band', album: 'Gone Record', genre: 'pop rock' },
            { artist: 'Owl City', album: 'All Things Bright and Beautiful', genre: 'indie folk' },
            { artist: 'Lord Huron', album: 'Strange Trails', genre: 'indie folk' },
            { artist: 'Nobody', album: 'Weak', genre: 'polka' },
            { artist: 'Lord Huron', album: 'Long Lost', artistIds: ['art-lh'], genre: 'indie folk' },
        ], PROFILE);
        expect(ranked.map((a) => `${a.album}:${a.fit.tier}`)).toEqual([
            'Long Lost:unheard', 'Weak:unheard',
            'All Things Bright and Beautiful:sampled',
            'Strange Trails:loved',
            'Gone Record:dropped',
        ]);
        // A sampled record sits below even a weak unheard one.
        expect(ranked[2].fit.score).toBeGreaterThan(ranked[1].fit.score);
    });

    it('keeps the caller\'s order for ties and does not leak its index', () => {
        const ranked = rankAlbums([
            { artist: 'X', album: 'first' }, { artist: 'Y', album: 'second' },
        ], PROFILE);
        expect(ranked.map((a) => a.album)).toEqual(['first', 'second']);
        expect(ranked[0]).not.toHaveProperty('i');
    });
});

describe('albumOfBlock', () => {
    it('reads names and genre from the first track and the count from the block', () => {
        const block = {
            albumId: 'alb-st',
            tracks: [
                { albumName: 'Strange Trails', artistNames: ['Lord Huron', 'Guest'], artistIds: ['art-lh', 'g'], genre: 'indie folk' },
                { albumName: 'Strange Trails', artistNames: ['Lord Huron'], artistIds: ['art-lh'] },
            ],
        };
        expect(albumOfBlock(block)).toEqual({
            artist: 'Lord Huron', album: 'Strange Trails', artistIds: ['art-lh', 'g'],
            albumId: 'alb-st', genre: 'indie folk', totalTracks: 2,
        });
    });

    it('copes with a block whose tracks carry nothing', () => {
        expect(albumOfBlock({ tracks: [{}] })).toEqual({
            artist: '', album: '', artistIds: [], albumId: null, genre: '', totalTracks: 1,
        });
    });
});
