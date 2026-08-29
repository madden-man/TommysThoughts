import React, { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Button, Checkbox, FormControlLabel, TextField } from '@mui/material';
import { clearPlaylist, ensurePlaylist, getPlaylist, writeOrder } from './server';
import { TrackCount } from './TrackCount';
import { describeOrder, dividerMatcher, markerSectionsOf, shuffleKeepingAlbums } from './shuffle';

// A generic playlist tab: reads whichever playlist it's given, splits it into
// sections by markers the user sets here, shuffles within those sections, and
// writes the result to a companion "<name> shuffled" playlist. A marker is a
// track from the playlist that opens a section, plus a label — the same idea as
// pre-approved's four season-opening songs, but chosen in the view.
const PREVIEW_PER_SECTION = 8;

// Markers and the write destination both live per playlist, keyed by its Spotify
// id, so they follow the playlist rather than the tab and survive a reload.
// Markers are per part — each slice holds different tracks, so it needs its own
// section boundaries. The destination is NOT: every part of a playlist writes
// into the same "<name> shuffled", appending, so the parts amalgamate there.
const markerKey = (playlistId, part) => `spotify.markers.${playlistId}#${part}`;
const destKey = (playlistId) => `spotify.dest.${playlistId}`;
// Whether an already-adjacent run travels as one unit. A property of how the
// playlist was built rather than of the tab, so it is per playlist and not per
// part, and it survives a reload like the markers do.
const weldKey = (playlistId) => `spotify.weld.${playlistId}`;
// Which parts are currently sitting in the destination. The parts append, so
// getting the whole playlist across takes several writes in order and writing one
// twice silently doubles it — this is what lets the tab say where you are up to
// rather than leaving you to remember. Emptying the destination clears it.
const writtenKey = (playlistId) => `spotify.written.${playlistId}`;

const loadJson = (key, fallback) => {
    try {
        const saved = JSON.parse(localStorage.getItem(key) || 'null');
        return saved ?? fallback;
    } catch (_) {
        return fallback;
    }
};

const loadMarkers = (playlistId, part) => {
    const saved = loadJson(markerKey(playlistId, part), []);
    return Array.isArray(saved) ? saved.filter((m) => m && m.uri) : [];
};

export const PlaylistTab = ({ playlistId, name, part = 0, parts = 1 }) => {
    const [playlist, setPlaylist] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [markers, setMarkers] = useState(() => loadMarkers(playlistId, part));

    // The shuffled order, which of the two shuffles produced it, and the state of
    // writing it out. Nothing here touches the source playlist.
    const [order, setOrder] = useState(null);
    const [mode, setMode] = useState(null);
    const [progress, setProgress] = useState(null);
    const [writeError, setWriteError] = useState(null);
    const [wrote, setWrote] = useState(null);
    const [cleared, setCleared] = useState(false);
    const [dest, setDest] = useState(() => loadJson(destKey(playlistId), null));
    // Off by default: these playlists are usually built a whole record at a
    // time, so welding would leave "Shuffle tracks" doing nothing but reorder
    // albums. Tick it for a playlist sequenced song by song, where a pair sitting
    // together was put together on purpose.
    const [weld, setWeld] = useState(() => loadJson(weldKey(playlistId), false) === true);
    const [written, setWritten] = useState(() => {
        const saved = loadJson(writtenKey(playlistId), []);
        return Array.isArray(saved) ? saved.filter(Number.isInteger) : [];
    });

    // One destination for the whole playlist, however many parts it is read in.
    const destName = `${name} shuffled`;
    const multi = parts > 1;

    useEffect(() => {
        if (!playlistId) return undefined;
        let live = true;
        setPlaylist(null);
        setLoadError(null);
        setOrder(null);
        setMode(null);
        getPlaylist(playlistId, part)
            .then((data) => { if (live) setPlaylist(data); })
            .catch((error) => { if (live) setLoadError(error.message); });
        return () => { live = false; };
    }, [playlistId, part]);

    useEffect(() => {
        localStorage.setItem(markerKey(playlistId, part), JSON.stringify(markers));
    }, [playlistId, part, markers]);

    useEffect(() => {
        localStorage.setItem(destKey(playlistId), JSON.stringify(dest));
    }, [playlistId, dest]);

    useEffect(() => {
        localStorage.setItem(weldKey(playlistId), JSON.stringify(weld));
    }, [playlistId, weld]);

    useEffect(() => {
        localStorage.setItem(writtenKey(playlistId), JSON.stringify(written));
    }, [playlistId, written]);

    // A track opens a section when it's one of the marker tracks.
    const isDivider = useMemo(
        () => dividerMatcher({ uris: markers.map((m) => m.uri) }),
        [markers],
    );

    // Show sections from the shuffled order when one exists, otherwise from the
    // original playlist — so per-section shuffle buttons are available at once.
    const previewSections = useMemo(
        () => (playlist ? markerSectionsOf(order ?? playlist.tracks, markers) : []),
        [order, playlist, markers],
    );

    const report = useMemo(() => (order ? describeOrder(order, {}) : null), [order]);

    // Markers shown in the order their tracks sit in the playlist — the order the
    // sections actually run — rather than the order they were added.
    const orderedMarkers = useMemo(() => {
        if (!playlist) return markers.map((m) => ({ ...m, index: -1 }));
        const indexByUri = new Map(playlist.tracks.map((t, i) => [t.uri, i]));
        return markers
            .map((m) => ({ ...m, index: indexByUri.has(m.uri) ? indexByUri.get(m.uri) : Infinity }))
            .sort((a, b) => a.index - b.index);
    }, [playlist, markers]);

    const markedUris = useMemo(() => new Set(markers.map((m) => m.uri)), [markers]);

    const addMarker = (track) => {
        if (!track || markedUris.has(track.uri)) return;
        setMarkers((prev) => [...prev, { uri: track.uri, name: track.name, label: track.name }]);
    };

    const setLabel = (uri, label) =>
        setMarkers((prev) => prev.map((m) => (m.uri === uri ? { ...m, label } : m)));

    const removeMarker = (uri) =>
        setMarkers((prev) => prev.filter((m) => m.uri !== uri));

    const pickable = useMemo(
        () => (playlist ? playlist.tracks.filter((t) => !markedUris.has(t.uri)) : []),
        [playlist, markedUris],
    );

    const topGenresOf = (tracks) => {
        const counts = new Map();
        tracks.forEach((t) => {
            if (t.genre) counts.set(t.genre, (counts.get(t.genre) ?? 0) + 1);
        });
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([g]) => g);
    };

    const shuffle = (wholeAlbums) => {
        setWriteError(null);
        setWrote(null);
        setMode(wholeAlbums ? 'albums' : 'tracks');
        setOrder(shuffleKeepingAlbums(playlist.tracks, Math.random, {
            isDivider, wholeAlbums, weldAdjacent: weld,
        }));
    };

    const reshuffleSection = (section) => {
        setWriteError(null);
        setWrote(null);
        const base = order ?? playlist.tracks;
        const dividerUri = section.divider?.uri ?? null;
        const newOrder = markerSectionsOf(base, markers).flatMap((s) => [
            ...(s.divider ? [s.divider] : []),
            ...((s.divider?.uri ?? null) === dividerUri
                ? shuffleKeepingAlbums(s.tracks, Math.random, {
                    wholeAlbums: mode === 'albums', weldAdjacent: weld,
                })
                : s.tracks),
        ]);
        setOrder(newOrder);
        if (!mode) setMode('tracks');
    };

    const write = async () => {
        setWriteError(null);
        setWrote(null);
        setCleared(false);
        try {
            // First write for this playlist? Get (or create) its destination and
            // remember it, so later writes go straight to the same place.
            let target = dest;
            if (!target) {
                target = await ensurePlaylist(destName);
                setDest(target);
            }
            setProgress({ done: 0, total: order.length });
            await writeOrder(
                order.map((t) => t.uri),
                (done, total) => setProgress({ done, total }),
                target.id,
                // Every part of a long playlist lands on the end, so writing
                // part 1, then 2, then 3 assembles the whole thing in order.
                // A single-part playlist replaces instead, so re-running it
                // rebuilds rather than stacking another copy.
                { append: multi },
            );
            setWrote(order.length);
            // Only the appending case is worth recording: a single-part write
            // replaces, so it is always the whole story and never stacks.
            if (multi) setWritten((prev) => [...new Set([...prev, part])].sort((a, b) => a - b));
        } catch (error) {
            setWriteError(error.message);
        } finally {
            setProgress(null);
        }
    };

    // Emptying the destination, so a rebuild starts from nothing. Only worth
    // offering when the parts append — a single-part write replaces anyway.
    const startOver = async () => {
        setWriteError(null);
        setWrote(null);
        try {
            let target = dest;
            if (!target) {
                target = await ensurePlaylist(destName);
                setDest(target);
            }
            setProgress({ done: 0, total: 0 });
            await clearPlaylist(target.id);
            setWritten([]);
            setCleared(true);
        } catch (error) {
            setWriteError(error.message);
        } finally {
            setProgress(null);
        }
    };

    const busy = progress !== null;
    // Writing a part that is already in the destination appends a second copy of
    // it, which is never what you want — so it is called out rather than blocked,
    // since emptying the destination from Spotify itself is also allowed.
    const alreadyIn = multi && written.includes(part);

    return (
        <>
            <h1 className="spotify__title">{name}</h1>
            <p className="spotify__muted">
                Set section markers to split this playlist — each marker is a track
                that opens a section. Sections run in playlist order; anything
                before the first marker is one unnamed run. Reads{' '}
                <strong>{name}</strong> and writes the result to{' '}
                <strong>{destName}</strong>, so the source is never modified.
            </p>

            {loadError && (
                <p className="spotify__error">
                    Couldn't read the playlist — {loadError}
                </p>
            )}

            {!playlist && !loadError && (
                <p className="spotify__muted">Reading the playlist…</p>
            )}

            {playlist && (
                <>
                    <TrackCount playlist={playlist} />

                    <div className="spotify__dividers">
                        <p className="spotify__muted">
                            Section markers ({orderedMarkers.length})
                        </p>

                        {orderedMarkers.length > 0 && (
                            <ul className="spotify__marker-list">
                                {orderedMarkers.map((m) => (
                                    <li key={m.uri} className="spotify__marker">
                                        <TextField
                                            size="small"
                                            variant="standard"
                                            value={m.label}
                                            placeholder="Section name"
                                            onChange={(e) => setLabel(m.uri, e.target.value)}
                                            className="spotify__marker-label"
                                        />
                                        <span className="spotify__muted spotify__marker-track">
                                            opens at <strong>{m.name}</strong>
                                            {m.index === Infinity && ' · not in playlist'}
                                        </span>
                                        <span
                                            role="button"
                                            aria-label={`Remove marker ${m.name}`}
                                            className="spotify__marker-remove"
                                            onClick={() => removeMarker(m.uri)}
                                        >
                                            ×
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <Autocomplete
                            key={markers.length}
                            blurOnSelect
                            openOnFocus
                            options={pickable}
                            getOptionLabel={(t) => `${t.name} — ${t.artistNames.join(', ')}`}
                            onChange={(_, track) => addMarker(track)}
                            renderOption={(props, t) => (
                                <li {...props} key={t.uri}>
                                    {t.name}
                                    <span className="spotify__muted">
                                        {' — '}{t.artistNames.join(', ')}
                                    </span>
                                </li>
                            )}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    size="small"
                                    placeholder="Add a marker — search this playlist…"
                                />
                            )}
                        />
                    </div>

                    <div className="spotify__options">
                        <FormControlLabel
                            control={(
                                <Checkbox
                                    size="small"
                                    checked={weld}
                                    onChange={(e) => setWeld(e.target.checked)}
                                    disabled={busy}
                                />
                            )}
                            label="Keep songs that are already next to each other together"
                        />
                    </div>

                    <div className="spotify__actions">
                        <Button
                            variant={mode === 'tracks' ? 'contained' : 'outlined'}
                            onClick={() => shuffle(false)}
                            disabled={busy || !playlist.tracks.length}
                        >
                            Shuffle tracks
                        </Button>
                        <Button
                            variant={mode === 'albums' ? 'contained' : 'outlined'}
                            onClick={() => shuffle(true)}
                            disabled={busy || !playlist.tracks.length}
                        >
                            Shuffle whole albums
                        </Button>
                        <Button
                            variant="outlined"
                            color="success"
                            onClick={write}
                            disabled={busy || !order}
                        >
                            Write to "{destName}"
                        </Button>
                        {multi && (
                            <Button
                                variant="outlined"
                                color="error"
                                onClick={startOver}
                                disabled={busy}
                            >
                                Empty "{destName}"
                            </Button>
                        )}
                    </div>
                    <p className="spotify__muted">
                        <strong>Shuffle tracks</strong> spreads a record's songs
                        across its section, in album order.{' '}
                        <strong>Shuffle whole albums</strong> keeps each record
                        intact and start-to-finish, and shuffles the records.
                    </p>
                    <p className="spotify__muted">
                        The checkbox decides what <strong>Shuffle tracks</strong>{' '}
                        treats as one indivisible thing. Ticked, a run of same-album
                        tracks that already sit side by side travels together and is
                        never split — right for a playlist sequenced song by song.
                        Unticked, every track moves on its own, so albums added a
                        record at a time get broken up.{' '}
                        <strong>Shuffle whole albums</strong> ignores it: there a
                        record is always the unit.
                    </p>

                    {multi && (
                        <p className="spotify__muted">
                            This is part {part + 1} of {parts}. All {parts} parts write
                            into the one <strong>{destName}</strong>, each landing on the
                            end — so empty it first, then write part 1, then 2, and so on,
                            and the whole playlist arrives in order.
                        </p>
                    )}

                    {multi && (
                        <p className={alreadyIn ? 'spotify__warn' : 'spotify__muted'}>
                            {written.length
                                ? `In "${destName}" so far: ${written.length === parts
                                    ? 'every part'
                                    : `part ${written.map((n) => n + 1).join(', ')} of ${parts}`}.`
                                : `Nothing written into "${destName}" yet — part 1 is next.`}
                            {alreadyIn && ' This part is already in there; writing it again '
                                + 'would add a second copy. Empty it and start over instead.'}
                        </p>
                    )}

                    {cleared && (
                        <p className="spotify__done">
                            "{destName}" is empty — write part 1 next.
                        </p>
                    )}

                    {busy && (
                        <p className="spotify__progress">
                            {progress.total ? `Writing ${progress.done} of ${progress.total}…` : 'Emptying…'}
                        </p>
                    )}

                    {writeError && <p className="spotify__error">{writeError}</p>}

                    {wrote !== null && (
                        <p className="spotify__done">
                            Written — {wrote} tracks
                            {multi ? ` added to the end of "${destName}"` : ` now in "${destName}"`}
                            {dest?.created && ' (created just now)'}.
                        </p>
                    )}

                    {report && (
                        <div className="spotify__report">
                            <p className="spotify__report-line">
                                <strong>{report.albumRuns}</strong>{' '}
                                {mode === 'albums'
                                    ? 'records playing start to finish'
                                    : 'album runs kept together'}
                                {report.longestRun > 0
                                    && ` (longest ${report.longestRun} tracks)`}
                                {' · '}
                                <strong>{report.adjacentArtistRepeats}</strong>{' '}
                                back-to-back artist repeats
                            </p>
                            <p className="spotify__muted">
                                Nothing has been written yet — this is the order
                                that would be.
                            </p>
                        </div>
                    )}

                    {previewSections.map((section, i) => {
                        const genres = topGenresOf(section.tracks);
                        return (
                            <div key={i} className="spotify__section">
                                <div className="spotify__section-header">
                                    <p className="spotify__section-title">
                                        {section.label ?? 'Before the first marker'}
                                        <span className="spotify__muted">
                                            {' '}· {section.tracks.length} tracks
                                        </span>
                                    </p>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => reshuffleSection(section)}
                                        disabled={busy}
                                    >
                                        Shuffle
                                    </Button>
                                </div>
                                {genres.length > 0 && (
                                    <p className="spotify__muted spotify__section-genres">
                                        {genres.join(' · ')}
                                    </p>
                                )}
                                {section.divider && (
                                    <p className="spotify__opener">
                                        opens with <strong>{section.divider.name}</strong>
                                    </p>
                                )}
                                <ol className="spotify__tracks">
                                    {section.tracks.slice(0, PREVIEW_PER_SECTION).map((t) => (
                                        <li key={t.uri}>
                                            {t.name}
                                            <span className="spotify__muted">
                                                {' — '}{t.artistNames.join(', ')}
                                            </span>
                                        </li>
                                    ))}
                                    {section.tracks.length > PREVIEW_PER_SECTION && (
                                        <li className="spotify__muted">
                                            +{section.tracks.length - PREVIEW_PER_SECTION} more
                                        </li>
                                    )}
                                </ol>
                            </div>
                        );
                    })}
                </>
            )}
        </>
    );
};
