import React, { useState, useEffect, useCallback } from 'react';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { Button } from '@mui/material';
import { Header } from '../../components/Header';
import {
    getQuestions,
    addQuestion,
    updateQuestion,
    deleteQuestion,
} from './server';

import './questions.css';

const DEPTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const DepthSelect = ({ value, onChange, labelId }) => (
    <FormControl size="small" className="question__depth-input">
        <InputLabel id={labelId}>Depth</InputLabel>
        <Select labelId={labelId} label="Depth" value={value} onChange={onChange}>
            {DEPTH_OPTIONS.map((n) => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
            ))}
        </Select>
    </FormControl>
);

const emptyDraft = { question: '', depth: 5 };

export const QuestionsPage = () => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState(emptyDraft);
    const [newQuestion, setNewQuestion] = useState(emptyDraft);
    // null = original order, 'asc' = shallowest first, 'desc' = deepest first
    const [depthSort, setDepthSort] = useState(null);

    const fetchQuestions = useCallback(async () => {
        setLoading(true);
        try {
            const results = await getQuestions();
            setQuestions(Array.isArray(results) ? results : []);
        } catch (error) {
            console.error('Failed to load questions', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQuestions();
    }, [fetchQuestions]);

    const startEdit = (item) => {
        setEditingId(item._id);
        setDraft({ question: item.question, depth: item.depth ?? 5 });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setDraft(emptyDraft);
    };

    const saveEdit = async () => {
        if (!draft.question.trim()) return;
        const updated = { _id: editingId, question: draft.question.trim(), depth: draft.depth };
        setQuestions((prev) => prev.map((q) => (q._id === editingId ? { ...q, ...updated } : q)));
        cancelEdit();
        try {
            await updateQuestion(updated);
        } catch (error) {
            console.error('Failed to update question', error);
            fetchQuestions();
        }
    };

    const removeQuestion = async (id) => {
        setQuestions((prev) => prev.filter((q) => q._id !== id));
        if (editingId === id) cancelEdit();
        try {
            await deleteQuestion(id);
        } catch (error) {
            console.error('Failed to delete question', error);
            fetchQuestions();
        }
    };

    const createQuestion = async () => {
        if (!newQuestion.question.trim()) return;
        const payload = { question: newQuestion.question.trim(), depth: newQuestion.depth };
        setNewQuestion(emptyDraft);
        try {
            const created = await addQuestion(payload);
            setQuestions((prev) => [...prev, created?._id ? created : { ...payload, _id: `tmp-${Date.now()}` }]);
        } catch (error) {
            console.error('Failed to add question', error);
            fetchQuestions();
        }
    };

    const toggleDepthSort = () =>
        setDepthSort((prev) => (prev === null ? 'asc' : prev === 'asc' ? 'desc' : null));

    const visibleQuestions = depthSort
        ? [...questions].sort((a, b) =>
            depthSort === 'asc'
                ? (a.depth ?? 0) - (b.depth ?? 0)
                : (b.depth ?? 0) - (a.depth ?? 0))
        : questions;

    return (
        <div className="page">
            <Header />
            <div className="questions-page">
                <div className="questions">
                    <h1 className="questions__title">Questions</h1>

                    <div className="questions__controls">
                        <Button
                            variant={depthSort ? 'contained' : 'outlined'}
                            onClick={toggleDepthSort}
                        >
                            {depthSort === 'asc' && 'Depth: shallow → deep'}
                            {depthSort === 'desc' && 'Depth: deep → shallow'}
                            {depthSort === null && 'Sort by depth'}
                        </Button>
                    </div>

                    {loading ? (
                        <p className="questions__empty">Loading…</p>
                    ) : (
                        <ul className="questions__list">
                            {questions.length === 0 && (
                                <li className="questions__empty">
                                    No questions yet — add one below.
                                </li>
                            )}
                            {visibleQuestions.map((item) => (
                                <li key={item._id} className="question">
                                    {editingId === item._id ? (
                                        <>
                                            <TextField
                                                className="question__input"
                                                label="Question"
                                                value={draft.question}
                                                onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                                                size="small"
                                                multiline
                                            />
                                            <DepthSelect
                                                labelId={`depth-${item._id}`}
                                                value={draft.depth}
                                                onChange={(e) => setDraft({ ...draft, depth: e.target.value })}
                                            />
                                            <Button variant="contained" onClick={saveEdit}>Save</Button>
                                            <Button onClick={cancelEdit}>Cancel</Button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="question__text">{item.question}</span>
                                            {item.depth != null && (
                                                <span className="question__depth" title="Depth">
                                                    {item.depth}/10
                                                </span>
                                            )}
                                            <Button onClick={() => startEdit(item)}>Edit</Button>
                                            <Button color="error" onClick={() => removeQuestion(item._id)}>Delete</Button>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="question question--new">
                        <TextField
                            className="question__input"
                            label="New question"
                            value={newQuestion.question}
                            onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                            size="small"
                            multiline
                        />
                        <DepthSelect
                            labelId="depth-new"
                            value={newQuestion.depth}
                            onChange={(e) => setNewQuestion({ ...newQuestion, depth: e.target.value })}
                        />
                        <Button variant="contained" onClick={createQuestion}>Add</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
