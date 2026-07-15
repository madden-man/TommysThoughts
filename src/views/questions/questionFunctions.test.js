/**
 * Tests for the Netlify Functions in server/{get,add,update,delete}_question(s).
 * They live here (under src/) so `npm test` (react-scripts) picks them up.
 * The mongodb driver is mocked; each test asserts the handler hits the
 * `tommy-questions` collection in the `tommy-data` database.
 */

// NOTE: react-scripts sets `resetMocks: true`, which wipes jest.fn
// implementations before every test — so the mock only builds plain-object
// structure here, and implementations are (re)installed in beforeEach below.
jest.mock('mongodb', () => {
    const collection = {
        find: jest.fn(),
        insertOne: jest.fn(),
        updateOne: jest.fn(),
        deleteOne: jest.fn(),
    };
    const db = jest.fn();
    db.collectionSpy = jest.fn();

    class ObjectId {
        constructor(id) {
            this.id = String(id);
        }
        static isValid(id) {
            return /^[0-9a-f]{24}$/i.test(String(id));
        }
    }

    // `connect()` runs once at module load (before resetMocks can interfere),
    // so it is a plain function rather than a jest.fn.
    return {
        MongoClient: function MongoClient() {
            return { connect: () => Promise.resolve({ db }) };
        },
        ObjectId,
        __mock: { collection, db },
    };
});

const { ObjectId, __mock } = require('mongodb');
const { handler: getQuestions } = require('../../../server/get_questions/get_questions');
const { handler: addQuestion } = require('../../../server/add_question/add_question');
const { handler: updateQuestion } = require('../../../server/update_question/update_question');
const { handler: deleteQuestion } = require('../../../server/delete_question/delete_question');

const VALID_ID = '507f1f77bcf86cd799439011';

beforeEach(() => {
    __mock.db.mockImplementation(() => ({ collection: __mock.db.collectionSpy }));
    __mock.db.collectionSpy.mockImplementation(() => __mock.collection);
});

const expectTommyQuestions = () => {
    expect(__mock.db).toHaveBeenCalledWith('tommy-data');
    expect(__mock.db.collectionSpy).toHaveBeenCalledWith('tommy-questions');
};

describe('get_questions', () => {
    it('returns all questions from tommy-data/tommy-questions', async () => {
        const docs = [{ _id: '1', question: 'Why?' }, { _id: '2', question: 'How?' }];
        __mock.collection.find.mockReturnValue({ toArray: () => Promise.resolve(docs) });

        const response = await getQuestions();

        expectTommyQuestions();
        expect(__mock.collection.find).toHaveBeenCalledWith({});
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual(docs);
    });

    it('returns 500 when the query fails', async () => {
        __mock.collection.find.mockReturnValue({ toArray: () => Promise.reject(new Error('boom')) });

        const response = await getQuestions();

        expect(response.statusCode).toBe(500);
        expect(response.body).toContain('boom');
    });
});

describe('add_question', () => {
    it('inserts the question with its depth and returns the created document', async () => {
        __mock.collection.insertOne.mockResolvedValue({ insertedId: 'new-id' });

        const response = await addQuestion({
            body: JSON.stringify({ question: 'What is love?', depth: 8 }),
        });

        expectTommyQuestions();
        expect(__mock.collection.insertOne).toHaveBeenCalledWith({ question: 'What is love?', depth: 8 });
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ _id: 'new-id', question: 'What is love?', depth: 8 });
    });

    it('defaults depth to 5 when omitted', async () => {
        __mock.collection.insertOne.mockResolvedValue({ insertedId: 'new-id' });

        const response = await addQuestion({ body: JSON.stringify({ question: 'Hm?' }) });

        expect(__mock.collection.insertOne).toHaveBeenCalledWith({ question: 'Hm?', depth: 5 });
        expect(response.statusCode).toBe(200);
    });

    it.each([0, 11, 2.5, 'deep'])('returns 400 when depth is %p', async (depth) => {
        const response = await addQuestion({ body: JSON.stringify({ question: 'Hm?', depth }) });

        expect(response.statusCode).toBe(400);
        expect(__mock.collection.insertOne).not.toHaveBeenCalled();
    });

    it('returns 400 when question is missing', async () => {
        const response = await addQuestion({ body: JSON.stringify({}) });

        expect(response.statusCode).toBe(400);
        expect(__mock.collection.insertOne).not.toHaveBeenCalled();
    });

    it('returns 400 when body is empty', async () => {
        const response = await addQuestion({ body: null });

        expect(response.statusCode).toBe(400);
    });

    it('returns 500 when the insert fails', async () => {
        __mock.collection.insertOne.mockRejectedValue(new Error('down'));

        const response = await addQuestion({ body: JSON.stringify({ question: 'Hm?' }) });

        expect(response.statusCode).toBe(500);
        expect(response.body).toContain('down');
    });
});

describe('update_question', () => {
    it('updates by ObjectId and strips _id from the $set payload', async () => {
        __mock.collection.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

        const response = await updateQuestion({
            body: JSON.stringify({ _id: VALID_ID, question: 'Edited?' }),
        });

        expectTommyQuestions();
        const [query, update] = __mock.collection.updateOne.mock.calls[0];
        expect(query._id).toBeInstanceOf(ObjectId);
        expect(query._id.id).toBe(VALID_ID);
        expect(update).toEqual({ $set: { question: 'Edited?' } });
        expect(response.statusCode).toBe(200);
    });

    it('falls back to a string _id when it is not a valid ObjectId', async () => {
        __mock.collection.updateOne.mockResolvedValue({ matchedCount: 1 });

        await updateQuestion({ body: JSON.stringify({ _id: 'tmp-123', question: 'Hi?' }) });

        const [query] = __mock.collection.updateOne.mock.calls[0];
        expect(query).toEqual({ _id: 'tmp-123' });
    });

    it('returns 400 when _id is missing', async () => {
        const response = await updateQuestion({ body: JSON.stringify({ question: 'No id' }) });

        expect(response.statusCode).toBe(400);
        expect(__mock.collection.updateOne).not.toHaveBeenCalled();
    });

    it('returns 500 when the update fails', async () => {
        __mock.collection.updateOne.mockRejectedValue(new Error('nope'));

        const response = await updateQuestion({
            body: JSON.stringify({ _id: VALID_ID, question: 'X?' }),
        });

        expect(response.statusCode).toBe(500);
        expect(response.body).toContain('nope');
    });
});

describe('delete_question', () => {
    it('deletes by ObjectId', async () => {
        __mock.collection.deleteOne.mockResolvedValue({ deletedCount: 1 });

        const response = await deleteQuestion({ body: JSON.stringify({ _id: VALID_ID }) });

        expectTommyQuestions();
        const [query] = __mock.collection.deleteOne.mock.calls[0];
        expect(query._id).toBeInstanceOf(ObjectId);
        expect(query._id.id).toBe(VALID_ID);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ deletedCount: 1 });
    });

    it('returns 400 when _id is missing', async () => {
        const response = await deleteQuestion({ body: JSON.stringify({}) });

        expect(response.statusCode).toBe(400);
        expect(__mock.collection.deleteOne).not.toHaveBeenCalled();
    });

    it('returns 500 when the delete fails', async () => {
        __mock.collection.deleteOne.mockRejectedValue(new Error('gone'));

        const response = await deleteQuestion({ body: JSON.stringify({ _id: VALID_ID }) });

        expect(response.statusCode).toBe(500);
        expect(response.body).toContain('gone');
    });
});
