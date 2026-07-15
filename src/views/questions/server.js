// --- Questions CRUD ---
// Backed by the `tommy-questions` collection in the `tommy-data` MongoDB database
// via the Netlify Functions in server/{get,add,update,delete}_question(s).

export const getQuestions = async () => {
    return fetch('.netlify/functions/get_questions', { method: 'POST' })
        .then((response) => response.json());
};

export const addQuestion = async (item) => {
    return fetch('.netlify/functions/add_question', {
        method: 'POST',
        body: JSON.stringify({ ...item }),
    }).then((response) => response.json());
};

export const updateQuestion = async (item) => {
    return fetch('.netlify/functions/update_question', {
        method: 'POST',
        body: JSON.stringify({ ...item }),
    }).then((response) => response.json());
};

export const deleteQuestion = async (id) => {
    return fetch('.netlify/functions/delete_question', {
        method: 'POST',
        body: JSON.stringify({ _id: id }),
    }).then((response) => response.json());
};
