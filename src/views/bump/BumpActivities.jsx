import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { Button } from '@mui/material';
import { BUMP_BUTTONS, ICON_OPTIONS, getBumpKeyForSymbol } from './constants';
import { CalendarIcon, CheckIcon, CrossIcon, PencilIcon } from './icons';
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

// A round icon button. The label is the whole accessible name — the glyph is
// decorative — so every action still reads out loud as a sentence.
const IconButton = ({ label, onClick, className = '', children }) => (
    <button
        type="button"
        className={`bump-icon-button ${className}`}
        onClick={onClick}
        title={label}
        aria-label={label}
    >
        {children}
    </button>
);

const emptyDraft = { symbol: '', header: '' };

export const BumpActivities = ({ initialFilter = null }) => {
    const navigate = useNavigate();
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState(emptyDraft);
    const [newActivity, setNewActivity] = useState(emptyDraft);
    const [filter, setFilter] = useState(initialFilter);
    // The card that was just bumped, so the click has something to show for
    // itself — the notification goes out silently otherwise.
    const [bumpedId, setBumpedId] = useState(null);
    const bumpTimer = useRef(null);

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

    useEffect(() => () => clearTimeout(bumpTimer.current), []);

    const bump = (activity) => {
        sendActivityQuestion(activity.header);
        setBumpedId(activity._id);
        clearTimeout(bumpTimer.current);
        bumpTimer.current = setTimeout(() => setBumpedId(null), 1800);
    };

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

    // Two things you can do with an activity: ask about it now, or put it on a
    // day. The name is the first — clicking it sends the question. This is the
    // second: hand the activity to the calendar, which opens its add-activity
    // dialog already filled in. Passed as router state rather than in the URL so
    // the emoji needs no encoding and a refresh doesn't reopen the dialog.
    const scheduleActivity = (activity) =>
        navigate('/calendar', {
            state: { scheduleActivity: { header: activity.header, symbol: activity.symbol } },
        });

    const visibleActivities = filter
        ? activities.filter((a) => a.symbol === filter)
        : activities;

    const countFor = (symbol) => activities.filter((a) => a.symbol === symbol).length;

    return (
        <div className="bump-activities">
            <h2 className="bump-activities__title">Activities</h2>
            <p className="bump-activities__hint">
                Tap a name to ask about it — or put it on a day.
            </p>

            <div className="bump-activities__filters">
                <button
                    type="button"
                    className={'bump-filter' + (filter === null ? ' bump-filter--on' : '')}
                    onClick={() => setFilter(null)}
                >
                    <span className="bump-filter__label">Everything</span>
                    <span className="bump-filter__count">{activities.length}</span>
                </button>
                {BUMP_BUTTONS.map(({ key, symbol, header }) => (
                    <button
                        key={key}
                        type="button"
                        className={`bump-filter bump-filter--${key}`
                            + (filter === symbol ? ' bump-filter--on' : '')}
                        onClick={() => setFilter(filter === symbol ? null : symbol)}
                    >
                        <span className="bump-filter__symbol">{symbol}</span>
                        <span className="bump-filter__label">{header}</span>
                        <span className="bump-filter__count">{countFor(symbol)}</span>
                    </button>
                ))}
            </div>

            {loading ? (
                <p className="bump-activities__empty">Loading…</p>
            ) : (
                <ul className="bump-activities__list">
                    {visibleActivities.length === 0 && (
                        <li className="bump-activities__empty">
                            {activities.length === 0
                                ? 'Nothing here yet — add the first one below.'
                                : 'Nothing under this one. Try another, or add it below.'}
                        </li>
                    )}
                    {visibleActivities.map((activity) => {
                        const kind = getBumpKeyForSymbol(activity.symbol);
                        const editing = editingId === activity._id;
                        return (
                            <li
                                key={activity._id}
                                className={`bump-activity${kind ? ` bump-activity--${kind}` : ''}`
                                    + (editing ? ' bump-activity--editing' : '')
                                    + (bumpedId === activity._id ? ' bump-activity--bumped' : '')}
                            >
                                {editing ? (
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
                                            autoFocus
                                        />
                                        <span className="bump-activity__actions">
                                            <IconButton
                                                label="Save changes"
                                                className="bump-icon-button--save"
                                                onClick={saveEdit}
                                            >
                                                <CheckIcon />
                                            </IconButton>
                                            <IconButton label="Cancel" onClick={cancelEdit}>
                                                <CrossIcon />
                                            </IconButton>
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className="bump-activity__symbol" aria-hidden="true">
                                            {activity.symbol}
                                        </span>
                                        <button
                                            type="button"
                                            className="bump-activity__header bump-activity__header--button"
                                            onClick={() => bump(activity)}
                                            title={`Ask "${activity.header}?"`}
                                        >
                                            <span className="bump-activity__name">{activity.header}</span>
                                            {/* Swaps in for a moment after a bump, then leaves. */}
                                            <span className="bump-activity__sent" aria-live="polite">
                                                {bumpedId === activity._id ? 'sent!' : ''}
                                            </span>
                                        </button>
                                        <span className="bump-activity__actions">
                                            <IconButton
                                                label={`Put "${activity.header}" on a day`}
                                                className="bump-icon-button--schedule"
                                                onClick={() => scheduleActivity(activity)}
                                            >
                                                <CalendarIcon />
                                            </IconButton>
                                            <IconButton
                                                label={`Edit "${activity.header}"`}
                                                onClick={() => startEdit(activity)}
                                            >
                                                <PencilIcon />
                                            </IconButton>
                                            <IconButton
                                                label={`Delete "${activity.header}"`}
                                                className="bump-icon-button--delete"
                                                onClick={() => removeActivity(activity._id)}
                                            >
                                                <CrossIcon />
                                            </IconButton>
                                        </span>
                                    </>
                                )}
                            </li>
                        );
                    })}
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
                    label="Something else you'd do"
                    value={newActivity.header}
                    onChange={(e) => setNewActivity({ ...newActivity, header: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') createActivity(); }}
                    size="small"
                />
                <Button variant="contained" onClick={createActivity}>Add</Button>
            </div>
        </div>
    );
};
