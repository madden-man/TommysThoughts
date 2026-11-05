import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RankedTab, resetRankedCaches } from './RankedTab';
import { albumKeyOf } from './fit';
import { clearPlaylist, ensurePlaylist, getPlaylist, writeOrder } from './server';

jest.mock('./server', () => ({
    getPlaylist: jest.fn(),
    ensurePlaylist: jest.fn(),
    clearPlaylist: jest.fn(),
    writeOrder: jest.fn(),
}));

const track = (uri, albumId, albumName, artist, artistId, trackNumber, genre) => ({
    uri, name: `${albumName} ${trackNumber}`, albumId, albumName,
    artistNames: [artist], artistIds: [artistId], genre, trackNumber, discNumber: 1,
});

// Four albums across two parts, with tracks out of album order and one album
// split across the parts, so the write proves both grouping and album order.
const PART_0 = [
    track('spotify:track:st2', 'alb-st', 'Strange Trails', 'Lord Huron', 'art-lh', 2, 'indie folk'),
    track('spotify:track:ht1', 'alb-ht', 'Hold Time', 'M. Ward', 'art-mw', 1, 'chamber pop'),
    track('spotify:track:st1', 'alb-st', 'Strange Trails', 'Lord Huron', 'art-lh', 1, 'indie folk'),
];
const PART_1 = [
    track('spotify:track:dr1', 'alb-dr', 'Gone Record', 'Faded Band', 'art-fb', 1, 'pop rock'),
    track('spotify:track:oe1', 'alb-oe', 'Ocean Eyes', 'Owl City', 'art-oc', 1, 'synthpop'),
    track('spotify:track:ht2', 'alb-ht', 'Hold Time', 'M. Ward', 'art-mw', 2, 'chamber pop'),
];

const PROFILE = {
    artists: [
        { name: 'Lord Huron', artistIds: ['art-lh'], score: 0.9, hours: 140, lovedAlbums: 2, droppedAlbums: 0 },
        { name: 'Owl City', artistIds: ['art-oc'], score: 0.5, hours: 30, lovedAlbums: 0, droppedAlbums: 0 },
        { name: 'Faded Band', artistIds: ['art-fb'], score: 0.4, hours: 12, lovedAlbums: 0, droppedAlbums: 1 },
    ],
    albums: [
        { key: albumKeyOf('Owl City', 'Ocean Eyes'), artist: 'Owl City', album: 'Ocean Eyes', albumIds: ['alb-oe'], verdict: 'liked', hours: 20 },
        { key: albumKeyOf('Faded Band', 'Gone Record'), artist: 'Faded Band', album: 'Gone Record', albumIds: ['alb-dr'], verdict: 'dropped', hours: 3 },
    ],
    genres: [
        { genre: 'indie folk', weight: 0.6, recentWeight: 0.6 },
        { genre: 'chamber pop', weight: 0.2, recentWeight: 0.2 },
        { genre: 'pop rock', weight: 0.2, recentWeight: 0.2 },
    ],
    heard: {
        albumKeys: [albumKeyOf('Owl City', 'Ocean Eyes'), albumKeyOf('Faded Band', 'Gone Record')],
        albumIds: ['alb-oe', 'alb-dr'],
    },
    shape: { medianTracks: 12, medianMinutes: 44, fullAlbumShare: 0.6 },
};

const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
const fetchWith = ({ profileOk = true } = {}) => jest.fn((url) => {
    if (url === '/spotify-taste.json') {
        return profileOk ? ok(PROFILE) : Promise.resolve({ ok: false, status: 404 });
    }
    if (url === '/spotify-recommendations.json') return ok({ albums: [] });
    return Promise.reject(new Error(`unexpected ${url}`));
});

const rows = () => screen.queryAllByTestId('ranked-album');

beforeEach(() => {
    resetRankedCaches();
    getPlaylist.mockImplementation((id, part) => Promise.resolve({ tracks: part === 0 ? PART_0 : PART_1 }));
    ensurePlaylist.mockResolvedValue({ id: 'rankedDest0001', name: 'git add ./goodMusic ranked' });
    clearPlaylist.mockResolvedValue({ ok: true });
    writeOrder.mockImplementation(async (uris, onProgress) => onProgress?.(uris.length, uris.length));
});

afterEach(() => {
    jest.clearAllMocks();
    delete global.fetch;
});

describe('RankedTab', () => {
    it('reads every part and previews the four albums with the dropped one last', async () => {
        global.fetch = fetchWith();
        render(<RankedTab playlistId="queue1" name="git add ./goodMusic" parts={2} />);
        await waitFor(() => expect(rows()).toHaveLength(4));

        expect(getPlaylist).toHaveBeenCalledWith('queue1', 0);
        expect(getPlaylist).toHaveBeenCalledWith('queue1', 1);
        const albums = rows().map((row) => row.textContent);
        expect(albums[0]).toMatch(/Lord Huron, Strange Trails/);
        expect(albums[0]).toMatch(/2 tracks · \d+% · unheard · you kept 2 records by Lord Huron/);
        expect(albums[1]).toMatch(/M\. Ward, Hold Time/);
        expect(albums[2]).toMatch(/Owl City, Ocean Eyes.*liked/);
        expect(albums[3]).toMatch(/Faded Band, Gone Record.*dropped/);
    });

    it('counts the tiers in the summary', async () => {
        global.fetch = fetchWith();
        render(<RankedTab playlistId="queue1" name="git add ./goodMusic" parts={2} />);
        const summary = await screen.findByTestId('ranked-summary');
        expect(summary.textContent).toMatch(/2 unheard · 1 liked · 1 dropped · 4 albums, 6 tracks/);
    });

    it('write ensures, clears, then appends the uris in ranked order', async () => {
        global.fetch = fetchWith();
        render(<RankedTab playlistId="queue1" name="git add ./goodMusic" parts={2} />);
        fireEvent.click(await screen.findByRole('button', { name: 'write git add ./goodMusic ranked' }));

        const done = await screen.findByText(/6 tracks now in/);
        expect(within(done).getByText('open in spotify'))
            .toHaveAttribute('href', 'https://open.spotify.com/playlist/rankedDest0001');
        expect(ensurePlaylist).toHaveBeenCalledWith('git add ./goodMusic ranked');
        expect(clearPlaylist).toHaveBeenCalledWith('rankedDest0001');
        expect(writeOrder).toHaveBeenCalledWith(
            [
                'spotify:track:st1', 'spotify:track:st2',
                'spotify:track:ht1', 'spotify:track:ht2',
                'spotify:track:oe1',
                'spotify:track:dr1',
            ],
            expect.any(Function),
            'rankedDest0001',
            { append: true },
        );
        expect(ensurePlaylist.mock.invocationCallOrder[0])
            .toBeLessThan(clearPlaylist.mock.invocationCallOrder[0]);
        expect(clearPlaylist.mock.invocationCallOrder[0])
            .toBeLessThan(writeOrder.mock.invocationCallOrder[0]);
    });

    it('a failed profile fetch warns and offers no write', async () => {
        global.fetch = fetchWith({ profileOk: false });
        render(<RankedTab playlistId="queue1" name="git add ./goodMusic" parts={2} />);
        expect(await screen.findByText(/couldn't load the taste profile/)).toBeInTheDocument();
        await waitFor(() => expect(getPlaylist).toHaveBeenCalledTimes(2));
        expect(screen.queryByRole('button', { name: /write/ })).not.toBeInTheDocument();
        expect(rows()).toHaveLength(0);
    });
});
