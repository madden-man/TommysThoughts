import React, { useState, useEffect, useCallback } from 'react';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { Button } from '@mui/material';
import { ICON_OPTIONS } from './constants';
import {
    getActivities,
    addActivity,
    updateActivity,
    deleteActivity,
    sendActivityQuestion,
} from './server';

const IconSelect = ({ value, onChange, labelId }) => (
    <FormControl size="small" className="bump-activity__symbol-input">
        <InputLabel id={labelId}>Icon</InputLabel>
        <Select labelId={labelId} label="Icon" value={value} onChange={onChange}>
            {ICON_OPTIONS.map((icon) => (
                <MenuItem key={icon} value={icon}>{icon}</MenuItem>
            ))}
        </Select>
    </FormControl>
);

const emptyDraft = { symbol: '', header: '' };

export const BumpActivities = ({ initialFilter = null }) => {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState(emptyDraft);
    const [newActivity, setNewActivity] = useState(emptyDraft);
    const [filter, setFilter] = useState(initialFilter);

    const fetchActivities = useCallback(async () => {
        setLoading(true);
        try {
            const results = await getActivities();
            setActivities(Array.isArray(results) ? results : []);
        } catch (error) {
            console.error('Failed to load activities', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    const startEdit = (activity) => {
        setEditingId(activity._id);
        setDraft({ symbol: activity.symbol, header: activity.header });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setDraft(emptyDraft);
    };

    const saveEdit = async () => {
        if (!draft.header.trim()) return;
        const updated = { _id: editingId, symbol: draft.symbol.trim(), header: draft.header.trim() };
        setActivities((prev) => prev.map((a) => (a._id === editingId ? { ...a, ...updated } : a)));
        cancelEdit();
        try {
            await updateActivity(updated);
        } catch (error) {
            console.error('Failed to update activity', error);
            fetchActivities();
        }
    };

    const removeActivity = async (id) => {
        setActivities((prev) => prev.filter((a) => a._id !== id));
        if (editingId === id) cancelEdit();
        try {
            await deleteActivity(id);
        } catch (error) {
            console.error('Failed to delete activity', error);
            fetchActivities();
        }
    };

    const createActivity = async () => {
        if (!newActivity.header.trim()) return;
        const payload = { symbol: newActivity.symbol.trim(), header: newActivity.header.trim() };
        setNewActivity(emptyDraft);
        try {
            const created = await addActivity(payload);
            setActivities((prev) => [...prev, created?._id ? created : { ...payload, _id: `tmp-${Date.now()}` }]);
        } catch (error) {
            console.error('Failed to add activity', error);
            fetchActivities();
        }
    };

    const visibleActivities = filter
        ? activities.filter((a) => a.symbol === filter)
        : activities;

    return (
        <div className="bump-activities">
            <h2 className="bump-activities__title">Activities</h2>

            <div className="bump-activities__filters">
                <Button
                    className="bump-filter"
                    variant={filter === null ? 'contained' : 'outlined'}
                    onClick={() => setFilter(null)}
                >
                    All
                </Button>
                {ICON_OPTIONS.map((icon) => (
                    <Button
                        key={icon}
                        className="bump-filter"
                        variant={filter === icon ? 'contained' : 'outlined'}
                        onClick={() => setFilter(icon)}
                    >
                        {icon}
                    </Button>
                ))}
            </div>

            {loading ? (
                <p className="bump-activities__empty">Loading…</p>
            ) : (
                <ul className="bump-activities__list">
                    {visibleActivities.length === 0 && (
                        <li className="bump-activities__empty">
                            {activities.length === 0
                                ? 'No activities yet — add one below.'
                                : 'No activities match this filter.'}
                        </li>
                    )}
                    {visibleActivities.map((activity) => (
                        <li key={activity._id} className="bump-activity">
                            {editingId === activity._id ? (
                                <>
                                    <IconSelect
                                        labelId={`icon-${activity._id}`}
                                        value={draft.symbol}
                                        onChange={(e) => setDraft({ ...draft, symbol: e.target.value })}
                                    />
                                    <TextField
                                        className="bump-activity__header-input"
                                        label="Activity"
                                        value={draft.header}
                                        onChange={(e) => setDraft({ ...draft, header: e.target.value })}
                                        size="small"
                                    />
                                    <Button variant="contained" onClick={saveEdit}>Save</Button>
                                    <Button onClick={cancelEdit}>Cancel</Button>
                                </>
                            ) : (
                                <>
                                    <span className="bump-activity__symbol">{activity.symbol}</span>
                                    <button
                                        type="button"
                                        className="bump-activity__header bump-activity__header--button"
                                        onClick={() => sendActivityQuestion(activity.header)}
                                        title={`Send "${activity.header}?"`}
                                    >
                                        {activity.header}
                                    </button>
                                    <Button onClick={() => startEdit(activity)}>Edit</Button>
                                    <Button color="error" onClick={() => removeActivity(activity._id)}>Delete</Button>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <div className="bump-activity bump-activity--new">
                <IconSelect
                    labelId="icon-new"
                    value={newActivity.symbol}
                    onChange={(e) => setNewActivity({ ...newActivity, symbol: e.target.value })}
                />
                <TextField
                    className="bump-activity__header-input"
                    label="New activity"
                    value={newActivity.header}
                    onChange={(e) => setNewActivity({ ...newActivity, header: e.target.value })}
                    size="small"
                />
                <Button variant="contained" onClick={createActivity}>Add</Button>
            </div>
        </div>
    );
};
