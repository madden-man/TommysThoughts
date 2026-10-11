import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BumpActivities } from './BumpActivities';
import { getActivities } from './server';

jest.mock('./server', () => ({
    getActivities: jest.fn(),
    addActivity: jest.fn(),
    updateActivity: jest.fn(),
    deleteActivity: jest.fn(),
    sendActivityQuestion: jest.fn(),
}));

describe('BumpActivities next dates', () => {
    it('lists the next real places to do an activity under its name', async () => {
        // react-scripts resets mock implementations before each test.
        getActivities.mockResolvedValue([
            { _id: 'a1', symbol: '🏓', header: 'Open Mic!' },
            { _id: 'a2', symbol: '🏓', header: 'Pickle Ball' },
            { _id: 'a3', symbol: '🏠', header: 'Puzzle' },
        ]);
        render(<MemoryRouter><BumpActivities today="2026-10-13" /></MemoryRouter>);

        const openMic = (await screen.findByText('Open Mic!')).closest('li');
        // Wednesday the 14th: the Holiday Bar and Barrels & Bottles both run an open mic.
        expect(within(openMic).getAllByText('Wed 14')).toHaveLength(2);

        const pickleball = screen.getByText('Pickle Ball').closest('li');
        expect(within(pickleball).getAllByText('Anytime').length).toBeGreaterThan(0);

        // Nothing local matches a puzzle, so the card stays as it was.
        expect(screen.getByText('Puzzle').closest('li').querySelector('.bump-activity__next')).toBeNull();
    });
});
