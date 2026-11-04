import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import fixture from './__fixtures__/recommendations.json';
import { NextRecordsTab } from './NextRecordsTab';
import { ensurePlaylist, listFeedback, recordFeedback, writeOrder } from './server';

jest.mock('./server', () => ({
    ensurePlaylist: jest.fn(),
    writeOrder: jest.fn(),
    recordFeedback: jest.fn(),
    listFeedback: jest.fn(),
}));

const [first, second] = fixture.albums;

const cards = () => screen.queryAllByTestId('next-records-card');
const cardFor = (album) => cards().find((c) => within(c).queryByText(album.album));

beforeEach(() => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(fixture) }));
    ensurePlaylist.mockResolvedValue({ id: 'candidatesPlaylist0001', name: 'master (ii) candidates' });
    writeOrder.mockImplementation(async (uris, onProgress) => onProgress?.(uris.length, uris.length));
    recordFeedback.mockResolvedValue({ ok: true });
    listFeedback.mockResolvedValue([]);
});

afterEach(() => {
    jest.clearAllMocks();
    delete global.fetch;
});

describe('NextRecordsTab', () => {
    it('renders a card per album with artist, album and why', async () => {
        render(<NextRecordsTab />);
        await waitFor(() => expect(cards()).toHaveLength(3));
        fixture.albums.forEach((album) => {
            const card = cardFor(album);
            expect(within(card).getByText(album.artist)).toBeInTheDocument();
            expect(within(card).getByText(album.why)).toBeInTheDocument();
        });
        expect(global.fetch).toHaveBeenCalledWith('/spotify-recommendations.json');
        expect(screen.getByText(
            'Built 2026-11-05 from plays through 2026-08-25 and master (ii) at 6,095 tracks.',
        )).toBeInTheDocument();
    });

    it('save appends the tracks to the candidates playlist, then records saved', async () => {
        render(<NextRecordsTab />);
        await waitFor(() => expect(cards()).toHaveLength(3));
        fireEvent.click(within(cardFor(first)).getByRole('button', { name: 'save' }));

        await waitFor(() => expect(screen.getByText('open in spotify')).toBeInTheDocument());
        await waitFor(() => expect(within(cardFor(first)).getByRole('button', { name: 'heard it' })).toBeEnabled());
        expect(ensurePlaylist).toHaveBeenCalledWith('master (ii) candidates');
        expect(writeOrder).toHaveBeenCalledWith(
            first.trackUris, expect.any(Function), 'candidatesPlaylist0001', { append: true },
        );
        expect(ensurePlaylist.mock.invocationCallOrder[0])
            .toBeLessThan(writeOrder.mock.invocationCallOrder[0]);
        expect(writeOrder.mock.invocationCallOrder[0])
            .toBeLessThan(recordFeedback.mock.invocationCallOrder[0]);
        expect(recordFeedback).toHaveBeenCalledWith({
            albumId: first.albumId, artist: first.artist, album: first.album, verdict: 'saved',
        });

        const card = cardFor(first);
        expect(within(card).getByText('open in spotify'))
            .toHaveAttribute('href', `https://open.spotify.com/album/${first.albumId}`);
        expect(within(card).queryByRole('button', { name: 'save' })).not.toBeInTheDocument();
        expect(cards()).toHaveLength(3);
    });

    it('not for me records and hides the card, and undo restores it', async () => {
        render(<NextRecordsTab />);
        await waitFor(() => expect(cards()).toHaveLength(3));
        fireEvent.click(within(cardFor(second)).getByRole('button', { name: 'not for me' }));

        await waitFor(() => expect(cards()).toHaveLength(2));
        expect(recordFeedback).toHaveBeenCalledWith({
            albumId: second.albumId, artist: second.artist, album: second.album, verdict: 'not-for-me',
        });
        expect(cardFor(second)).toBeUndefined();

        fireEvent.click(screen.getByRole('button', { name: 'undo' }));
        await waitFor(() => expect(cards()).toHaveLength(3));
        expect(recordFeedback).toHaveBeenLastCalledWith({ albumId: second.albumId, verdict: 'undo' });
        expect(screen.queryByRole('button', { name: 'undo' })).not.toBeInTheDocument();
    });

    it('hides albums already marked heard in the feedback list', async () => {
        listFeedback.mockResolvedValue([{ albumId: first.albumId, verdict: 'heard' }]);
        render(<NextRecordsTab />);
        await waitFor(() => expect(cards()).toHaveLength(2));
        expect(cardFor(first)).toBeUndefined();
    });

    it('still renders the cards when the feedback list fails', async () => {
        listFeedback.mockRejectedValue(new Error('Mongo down'));
        render(<NextRecordsTab />);
        await waitFor(() => expect(cards()).toHaveLength(3));
        expect(await screen.findByText(/Couldn't load earlier verdicts/)).toBeInTheDocument();
    });

    it('warns when the recommendations file fails', async () => {
        global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 404 }));
        render(<NextRecordsTab />);
        expect(await screen.findByText(/Couldn't load the recommendations \(HTTP 404\)/))
            .toBeInTheDocument();
        expect(cards()).toHaveLength(0);
    });
});
