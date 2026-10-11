import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BumpEvents } from './BumpEvents';
import { sendActivityQuestion } from './server';

jest.mock('./server', () => ({ sendActivityQuestion: jest.fn() }));

const EVENTS = [
    {
        id: 'open-mic', title: "Jonathan's Open Mic", symbol: '🏓', card: 'Open Mic!',
        venue: "Cactus Jack's", town: 'Evergreen', cost: 'free',
        date: '2026-10-15', time: '20:00', recurrence: 'weekly', until: '2026-10-31', confirmed: true,
    },
    {
        id: 'church', title: 'Church of the Hills', symbol: '🔨', card: 'Church',
        venue: 'Church of the Hills', town: 'Evergreen',
        date: '2026-10-11', time: '10:00', recurrence: 'weekly', until: '2026-12-31', confirmed: true,
    },
    {
        id: 'clay', title: 'Clay Date', symbol: '🏓', venue: 'CAE', town: 'Evergreen', cost: '$75',
        date: '2026-10-24', time: '18:00',
        signup: { by: '', url: 'https://evergreenarts.org/events/', note: 'RSVP' }, confirmed: true,
    },
    {
        id: 'courts', title: 'Marshdale pickleball', symbol: '🏓', venue: 'Marshdale Park',
        hours: 'Daily, sunrise–sunset', confirmed: false,
    },
];

const renderBox = (props = {}) => render(
    <MemoryRouter>
        <BumpEvents events={EVENTS} today="2026-10-11" {...props} />
    </MemoryRouter>,
);

const rows = () => screen.queryAllByRole('listitem');

describe('BumpEvents', () => {
    beforeEach(() => sendActivityQuestion.mockClear());

    it("opens on today's show-up events, narrowed to the bump you came from", () => {
        renderBox({ initialFilter: '🔨' });
        expect(screen.getByRole('tab', { name: /Today/ })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Church of the Hills', { selector: 'button' })).toBeInTheDocument();
        expect(screen.queryByText("Jonathan's Open Mic")).not.toBeInTheDocument();
    });

    it('flips to another day of the week', () => {
        renderBox();
        fireEvent.click(screen.getByRole('button', { name: /Thu\s*15/ }));
        expect(screen.getByText("Jonathan's Open Mic", { selector: 'button' })).toBeInTheDocument();
        expect(screen.queryByText('Church of the Hills', { selector: 'button' })).not.toBeInTheDocument();
    });

    it('lists sign-ups with their link, and anytime places with hours', () => {
        renderBox();
        fireEvent.click(screen.getByRole('tab', { name: /Sign up first/ }));
        expect(screen.getByText('Clay Date', { selector: 'button' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'RSVP' })).toHaveAttribute('href', 'https://evergreenarts.org/events/');

        fireEvent.click(screen.getByRole('tab', { name: /Anytime/ }));
        expect(screen.getByText('Daily, sunrise–sunset')).toBeInTheDocument();
        expect(screen.getByText('check first')).toBeInTheDocument();
    });

    it('asks about an event by name, place and time', () => {
        renderBox();
        fireEvent.click(screen.getByRole('button', { name: /Thu\s*15/ }));
        fireEvent.click(screen.getByText("Jonathan's Open Mic", { selector: 'button' }));
        expect(sendActivityQuestion).toHaveBeenCalledWith("Jonathan's Open Mic, Cactus Jack's, Thu 15 8p");
        expect(screen.getByText('sent!')).toBeInTheDocument();
        expect(rows()).toHaveLength(1);
        expect(within(rows()[0]).getByRole('button', { name: /on a day/ })).toBeInTheDocument();
    });

    it('folds a long list behind Show all', () => {
        const many = Array.from({ length: 8 }, (_, n) => ({
            id: `e${n}`, title: `Event ${n}`, symbol: '🏓', venue: 'Somewhere',
            date: '2026-10-11', time: `1${n}:00`, confirmed: true,
        }));
        renderBox({ events: many });
        expect(rows()).toHaveLength(6);
        fireEvent.click(screen.getByRole('button', { name: 'Show all 8' }));
        expect(rows()).toHaveLength(8);
        fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
        expect(rows()).toHaveLength(6);
    });
});
