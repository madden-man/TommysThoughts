import React, { useEffect, useMemo, useState } from 'react';
import {
    Autocomplete,
    Box,
    CircularProgress,
    IconButton,
    Tab,
    Tabs,
    TextField,
} from '@mui/material';
import { Header } from '../../components/Header';
import { PreApprovedTab } from './PreApprovedTab';
import { PlaylistTab } from './PlaylistTab';
import { listPlaylists } from './server';

import './spotify.css';

// pre-approved and master (ii) are the two built-in tabs. pre-approved has the
// season shuffle; master (ii) is a normal playlist tab that's always present.
// Its Spotify id isn't hard-coded — it's found by name in the account's
// playlists, so the tab appears on its own without anything to paste in.
const norm = (value) => (value ?? '').trim().toLowerCase();

// A tab writes into a "<name> shuffled" playlist, so those outputs also live in
// the account. They are destinations, not sources — never a tab, and never an
// option in the add picker.
const isShuffledOutput = (playlist) => norm(playlist?.name).endsWith(' shuffled');

// master (ii), but NOT "master (ii) shuffled" — the output contains the same
// words, so it has to be excluded or it could win the lookup.
const matchesMaster = (playlist) =>
    norm(playlist?.name).includes('master (ii)') && !isShuffledOutput(playlist);

// Every other tab is one the user added from the picker, kept here so they
// survive a reload.
const STORAGE_KEY = 'spotify.addedTabs';

const loadAdded = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(saved)
            ? saved.filter((t) => t && t.id && t.name)
            : [];
    } catch (_) {
        return [];
    }
};

export const SpotifyPage = () => {
    const [added, setAdded] = useState(loadAdded);
    const [activeKey, setActiveKey] = useState('pre-approved');

    // The playlist list backs both the master (ii) lookup and the add picker, so
    // it's fetched once when the page opens rather than per feature.
    const [options, setOptions] = useState(null);
    const [optionsError, setOptionsError] = useState(null);
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        listPlaylists()
            .then((list) => setOptions(list))
            .catch((error) => { setOptionsError(error.message); setOptions([]); });
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(added));
    }, [added]);

    // The account's own "… (ii)" master playlist, once the list has loaded.
    const master = useMemo(
        () => (options ?? []).find(matchesMaster) ?? null,
        [options],
    );

    const tabs = useMemo(() => [
        { key: 'pre-approved', label: 'pre-approved', kind: 'preapproved' },
        { key: 'master', label: master?.name ?? 'master (ii)', kind: 'master' },
        ...added.map((a) => ({
            key: `pl-${a.id}`, label: a.name, kind: 'playlist', playlistId: a.id, name: a.name, closable: true,
        })),
    ], [added, master]);

    const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];

    const addPlaylist = (playlist) => {
        if (!playlist) return;
        setAdding(false);
        // Already open? Just switch to it rather than adding a second copy.
        const existing = added.find((a) => a.id === playlist.id);
        if (!existing) setAdded((prev) => [...prev, { id: playlist.id, name: playlist.name }]);
        setActiveKey(`pl-${playlist.id}`);
    };

    const removeTab = (key) => {
        const id = key.replace(/^pl-/, '');
        setAdded((prev) => prev.filter((a) => a.id !== id));
        if (activeKey === key) setActiveKey('pre-approved');
    };

    // The pool the picker draws from: real source playlists only. Shuffled
    // outputs, master, and anything already a tab are left out.
    const pickable = (options ?? []).filter(
        (p) => !isShuffledOutput(p)
            && p.id !== master?.id
            && !added.some((a) => a.id === p.id),
    );

    const renderActive = () => {
        if (active.kind === 'preapproved') return <PreApprovedTab />;
        if (active.kind === 'master') {
            if (master) return <PlaylistTab playlistId={master.id} name={master.name} />;
            if (options === null) return <p className="spotify__muted">Finding master (ii)…</p>;
            return (
                <p className="spotify__warn">
                    {optionsError
                        ? `Couldn't load your playlists — ${optionsError}`
                        : `No playlist matching "master (ii)" was found in your account.`}
                </p>
            );
        }
        return <PlaylistTab playlistId={active.playlistId} name={active.name} />;
    };

    return (
        <div className="page">
            <Header />
            <div className="spotify-page">
                <div className="spotify">
                    <Box className="spotify__tabbar">
                        <Tabs
                            value={active.key}
                            onChange={(_, next) => setActiveKey(next)}
                            variant="scrollable"
                            scrollButtons="auto"
                            className="spotify__tabs"
                        >
                            {tabs.map((tab) => (
                                <Tab
                                    key={tab.key}
                                    value={tab.key}
                                    label={(
                                        <span className="spotify__tab-label">
                                            {tab.label}
                                            {tab.closable && (
                                                <span
                                                    role="button"
                                                    aria-label={`Close ${tab.label}`}
                                                    className="spotify__tab-close"
                                                    onClick={(e) => { e.stopPropagation(); removeTab(tab.key); }}
                                                >
                                                    ×
                                                </span>
                                            )}
                                        </span>
                                    )}
                                />
                            ))}
                        </Tabs>
                        <IconButton
                            aria-label="Add a playlist tab"
                            className="spotify__add"
                            onClick={() => setAdding((v) => !v)}
                            size="small"
                        >
                            +
                        </IconButton>
                    </Box>

                    {adding && (
                        <div className="spotify__picker">
                            <Autocomplete
                                autoHighlight
                                openOnFocus
                                options={pickable}
                                loading={options === null}
                                getOptionLabel={(p) => p.name ?? ''}
                                onChange={(_, value) => addPlaylist(value)}
                                noOptionsText={
                                    optionsError
                                        ? `Couldn't load playlists — ${optionsError}`
                                        : 'No playlists'
                                }
                                renderOption={(props, p) => (
                                    <li {...props} key={p.id}>
                                        {p.name}
                                        {p.trackCount != null && (
                                            <span className="spotify__muted">
                                                {' '}· {p.trackCount} tracks
                                            </span>
                                        )}
                                    </li>
                                )}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        autoFocus
                                        size="small"
                                        placeholder="Search your playlists…"
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {options === null && (
                                                        <CircularProgress size={16} />
                                                    )}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                            />
                        </div>
                    )}

                    {/* Each tab keeps its own playlist state, so remounting on
                        switch is deliberate — nothing to preserve across tabs. */}
                    <div key={active.key}>{renderActive()}</div>
                </div>
            </div>
        </div>
    );
};
