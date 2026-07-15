import { getQuestions, addQuestion, updateQuestion, deleteQuestion } from './server';

describe('questions client server.js', () => {
    beforeEach(() => {
        global.fetch = jest.fn(() =>
            Promise.resolve({ json: () => Promise.resolve({ ok: true }) })
        );
    });

    afterEach(() => {
        delete global.fetch;
    });

    it('getQuestions POSTs to get_questions and returns the parsed body', async () => {
        const result = await getQuestions();

        expect(global.fetch).toHaveBeenCalledWith('.netlify/functions/get_questions', {
            method: 'POST',
        });
        expect(result).toEqual({ ok: true });
    });

    it('addQuestion POSTs the question and depth', async () => {
        await addQuestion({ question: 'Why is the sky blue?', depth: 7 });

        expect(global.fetch).toHaveBeenCalledWith('.netlify/functions/add_question', {
            method: 'POST',
            body: JSON.stringify({ question: 'Why is the sky blue?', depth: 7 }),
        });
    });

    it('updateQuestion POSTs the full item including _id', async () => {
        await updateQuestion({ _id: 'abc', question: 'Edited?' });

        expect(global.fetch).toHaveBeenCalledWith('.netlify/functions/update_question', {
            method: 'POST',
            body: JSON.stringify({ _id: 'abc', question: 'Edited?' }),
        });
    });

    it('deleteQuestion POSTs the _id', async () => {
        await deleteQuestion('abc');

        expect(global.fetch).toHaveBeenCalledWith('.netlify/functions/delete_question', {
            method: 'POST',
            body: JSON.stringify({ _id: 'abc' }),
        });
    });
});
