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
import { InOrderTab } from './InOrderTab';
import { listPlaylists, partsFor } from './server';

import './spotify.css';

// pre-approved and master (ii) are the two built-in tabs. pre-approved has the
// season shuffle; master (ii) is a normal playlist tab that's always present.
// Its Spotify id isn't hard-coded — it's found by name in the account's
// playlists, so the tab appears on its own without anything to paste in.
const norm = (value) => (value ?? '').trim().toLowerCase();

// A tab writes into a "<name> shuffled" or "<name> in order" playlist, so those
// outputs also live in the account. They are destinations, not sources — never a
// tab of their own, and never an option in the add picker.
const OUTPUT_SUFFIXES = [' shuffled', ' in order'];
const isOutput = (playlist) =>
    OUTPUT_SUFFIXES.some((suffix) => norm(playlist?.name).endsWith(suffix));

const MASTER_NAME = 'master (ii)';

// The master playlist, and not one of the playlists derived from it.
//
// Every derived playlist spells the master's name in full and then adds to it —
// "master (ii) shuffled", "master (ii) in order" — so a lookup that merely
// contains the name matches all of them and takes whichever the account happens
// to list first. Excluding only the " shuffled" ones was not enough: the tab
// could land on a derived playlist and report its length as the master's, which
// reads as a master with no tracks when that playlist is empty.
//
// So: an exact name wins outright, and failing that the shortest name containing
// it, since adding to a name only ever makes it longer.
const masterIn = (playlists) => {
    const named = playlists.filter((p) => norm(p?.name).includes(MASTER_NAME));
    return named.find((p) => norm(p.name) === MASTER_NAME)
        ?? named.filter((p) => !isOutput(p))
            .sort((a, b) => a.name.length - b.name.length)[0]
        ?? null;
};

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
    const master = useMemo(() => masterIn(options ?? []), [options]);

    // A playlist longer than one part becomes several tabs, one per slice, so
    // nothing goes unread. The length comes from the playlist list, so the tabs
    // exist before the playlist itself is fetched.
    const countOf = (id) => (options ?? []).find((p) => p.id === id)?.trackCount ?? null;

    const tabsFor = (id, name, keyPrefix, closable) => {
        const parts = partsFor(countOf(id));
        if (parts <= 1) {
            return [{
                key: `${keyPrefix}-${id}`, label: name, kind: 'playlist',
                playlistId: id, name, part: 0, parts: 1, closable,
            }];
        }
        return Array.from({ length: parts }, (_, part) => ({
            key: `${keyPrefix}-${id}-${part}`,
            label: `${name} (${part + 1}/${parts})`,
            kind: 'playlist',
            playlistId: id,
            name,
            part,
            parts,
            closable,
        }));
    };

    const tabs = useMemo(() => [
        { key: 'pre-approved', label: 'pre-approved', kind: 'preapproved' },
        ...(master
            ? [
                ...tabsFor(master.id, master.name, 'master', false),
                // Beside master's shuffle tabs, not among them: it reads the
                // same playlist whole rather than a part at a time.
                {
                    key: 'master-in-order',
                    label: `${master.name} in order`,
                    kind: 'inorder',
                    playlistId: master.id,
                    name: master.name,
                    parts: partsFor(countOf(master.id)),
                },
            ]
            : [{ key: 'master', label: 'master (ii)', kind: 'master' }]),
        ...added.flatMap((a) => tabsFor(a.id, a.name, 'pl', true)),
        // tabsFor closes over `options`, which is the dependency that matters
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [added, master, options]);

    const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];

    const addPlaylist = (playlist) => {
        if (!playlist) return;
        setAdding(false);
        // Already open? Just switch to it rather than adding a second copy.
        const existing = added.find((a) => a.id === playlist.id);
        if (!existing) setAdded((prev) => [...prev, { id: playlist.id, name: playlist.name }]);
        setActiveKey(`pl-${playlist.id}`);
    };

    // Closing any part of a playlist closes the playlist — the parts are one
    // thing split for reading, not separate entries you added.
    const removeTab = (tab) => {
        setAdded((prev) => prev.filter((a) => a.id !== tab.playlistId));
        if (activeKey === tab.key) setActiveKey('pre-approved');
    };

    // The pool the picker draws from: real source playlists only. Shuffled
    // outputs, master, and anything already a tab are left out.
    const pickable = (options ?? []).filter(
        (p) => !isOutput(p)
            && p.id !== master?.id
            && !added.some((a) => a.id === p.id),
    );

    const renderActive = () => {
        if (active.kind === 'preapproved') return <PreApprovedTab />;
        if (active.kind === 'inorder') {
            return (
                <InOrderTab
                    playlistId={active.playlistId}
                    name={active.name}
                    parts={active.parts ?? 1}
                />
            );
        }
        if (active.kind === 'master') {
            if (options === null) return <p className="spotify__muted">Finding master (ii)…</p>;
            return (
                <p className="spotify__warn">
                    {optionsError
                        ? `Couldn't load your playlists — ${optionsError}`
                        : `No playlist matching "master (ii)" was found in your account.`}
                </p>
            );
        }
        return (
            <PlaylistTab
                playlistId={active.playlistId}
                name={active.name}
                part={active.part ?? 0}
                parts={active.parts ?? 1}
            />
        );
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
                                                    onClick={(e) => { e.stopPropagation(); removeTab(tab); }}
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
