import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QuestionsPage } from './QuestionsPage';
import { getQuestions, addQuestion, updateQuestion, deleteQuestion } from './server';

jest.mock('./server');

const QUESTIONS = [
    { _id: 'q1', question: 'What is the meaning of life?', depth: 9 },
    { _id: 'q2', question: 'Where do socks go?', depth: 2 },
];

const renderPage = () =>
    render(
        <MemoryRouter>
            <QuestionsPage />
        </MemoryRouter>
    );

// State updates land asynchronously in this environment, so pick a depth from
// the MUI Select with async queries throughout.
const pickDepth = async (scope, value) => {
    userEvent.click(scope.getByLabelText('Depth'));
    userEvent.click(await screen.findByRole('option', { name: String(value) }));
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
};

beforeEach(() => {
    jest.clearAllMocks();
    getQuestions.mockResolvedValue(QUESTIONS);
});

describe('QuestionsPage', () => {
    it('shows a loading state, then the fetched questions with their depths', async () => {
        renderPage();

        expect(screen.getByText('Loading…')).toBeInTheDocument();

        expect(await screen.findByText('What is the meaning of life?')).toBeInTheDocument();
        expect(screen.getByText('Where do socks go?')).toBeInTheDocument();
        expect(screen.getByText('9/10')).toBeInTheDocument();
        expect(screen.getByText('2/10')).toBeInTheDocument();
        expect(getQuestions).toHaveBeenCalledTimes(1);
    });

    it('shows an empty state when there are no questions', async () => {
        getQuestions.mockResolvedValue([]);
        renderPage();

        expect(await screen.findByText('No questions yet — add one below.')).toBeInTheDocument();
    });

    it('adds a new question with a chosen depth and renders the created document', async () => {
        addQuestion.mockResolvedValue({ _id: 'q3', question: 'Is water wet?', depth: 7 });
        renderPage();
        await screen.findByText('What is the meaning of life?');

        const newRow = screen.getByLabelText('New question').closest('.question--new');
        fireEvent.change(screen.getByLabelText('New question'), {
            target: { value: '  Is water wet?  ' },
        });
        await pickDepth(within(newRow), 7);
        userEvent.click(screen.getByRole('button', { name: 'Add' }));

        expect(await screen.findByText('Is water wet?')).toBeInTheDocument();
        expect(await screen.findByText('7/10')).toBeInTheDocument();
        expect(addQuestion).toHaveBeenCalledWith({ question: 'Is water wet?', depth: 7 });
        await waitFor(() => expect(screen.getByLabelText('New question')).toHaveValue(''));
    });

    it('does not add a blank question', async () => {
        renderPage();
        await screen.findByText('What is the meaning of life?');

        fireEvent.change(screen.getByLabelText('New question'), { target: { value: '   ' } });
        userEvent.click(screen.getByRole('button', { name: 'Add' }));

        await waitFor(() => expect(addQuestion).not.toHaveBeenCalled());
    });

    it('edits a question text and depth and saves the change', async () => {
        updateQuestion.mockResolvedValue({ matchedCount: 1 });
        renderPage();
        await screen.findByText('What is the meaning of life?');

        const row = screen.getByText('What is the meaning of life?').closest('li');
        userEvent.click(within(row).getByRole('button', { name: 'Edit' }));

        const input = await within(row).findByLabelText('Question');
        fireEvent.change(input, { target: { value: 'What is the meaning of pie?' } });
        await pickDepth(within(row), 3);
        userEvent.click(within(row).getByRole('button', { name: 'Save' }));

        // Wait for edit mode to close before asserting, so queries can't grab
        // transient nodes from the outgoing edit form.
        await waitFor(() => expect(screen.queryByLabelText('Question')).not.toBeInTheDocument());
        expect(screen.getByText('What is the meaning of pie?')).toBeInTheDocument();
        expect(screen.getByText('3/10')).toBeInTheDocument();
        expect(screen.queryByText('What is the meaning of life?')).not.toBeInTheDocument();
        expect(updateQuestion).toHaveBeenCalledWith({
            _id: 'q1',
            question: 'What is the meaning of pie?',
            depth: 3,
        });
    });

    it('cancels an edit without saving', async () => {
        renderPage();
        await screen.findByText('What is the meaning of life?');

        const row = screen.getByText('What is the meaning of life?').closest('li');
        userEvent.click(within(row).getByRole('button', { name: 'Edit' }));

        fireEvent.change(await screen.findByLabelText('Question'), {
            target: { value: 'changed' },
        });
        userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        await waitFor(() =>
            expect(screen.queryByLabelText('Question')).not.toBeInTheDocument()
        );
        expect(screen.getByText('What is the meaning of life?')).toBeInTheDocument();
        expect(updateQuestion).not.toHaveBeenCalled();
    });

    it('deletes a question', async () => {
        deleteQuestion.mockResolvedValue({ deletedCount: 1 });
        renderPage();
        await screen.findByText('What is the meaning of life?');

        const row = screen.getByText('Where do socks go?').closest('li');
        userEvent.click(within(row).getByRole('button', { name: 'Delete' }));

        await waitFor(() =>
            expect(screen.queryByText('Where do socks go?')).not.toBeInTheDocument()
        );
        expect(deleteQuestion).toHaveBeenCalledWith('q2');
        expect(screen.getByText('What is the meaning of life?')).toBeInTheDocument();
    });

    it('sorts by depth ascending, then descending, then restores original order', async () => {
        getQuestions.mockResolvedValue([
            { _id: 'q1', question: 'Medium?', depth: 5 },
            { _id: 'q2', question: 'Deep?', depth: 10 },
            { _id: 'q3', question: 'Shallow?', depth: 1 },
        ]);
        renderPage();
        await screen.findByText('Medium?');

        const rowTexts = () =>
            screen.getAllByRole('listitem').map((li) => li.querySelector('.question__text').textContent);

        expect(rowTexts()).toEqual(['Medium?', 'Deep?', 'Shallow?']);

        userEvent.click(screen.getByRole('button', { name: 'Sort by depth' }));
        await screen.findByRole('button', { name: 'Depth: shallow → deep' });
        expect(rowTexts()).toEqual(['Shallow?', 'Medium?', 'Deep?']);

        userEvent.click(screen.getByRole('button', { name: 'Depth: shallow → deep' }));
        await screen.findByRole('button', { name: 'Depth: deep → shallow' });
        expect(rowTexts()).toEqual(['Deep?', 'Medium?', 'Shallow?']);

        userEvent.click(screen.getByRole('button', { name: 'Depth: deep → shallow' }));
        await screen.findByRole('button', { name: 'Sort by depth' });
        expect(rowTexts()).toEqual(['Medium?', 'Deep?', 'Shallow?']);
    });

    it('refetches when a delete fails', async () => {
        deleteQuestion.mockRejectedValue(new Error('offline'));
        renderPage();
        await screen.findByText('What is the meaning of life?');

        const row = screen.getByText('Where do socks go?').closest('li');
        userEvent.click(within(row).getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(getQuestions).toHaveBeenCalledTimes(2));
        expect(await screen.findByText('Where do socks go?')).toBeInTheDocument();
    });
});
