import React, { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Button, TextField } from '@mui/material';
import { ensurePlaylist, getPlaylist, writeOrder } from './server';
import { describeOrder, dividerMatcher, markerSectionsOf, shuffleKeepingAlbums } from './shuffle';

// A generic playlist tab: reads whichever playlist it's given, splits it into
// sections by markers the user sets here, shuffles within those sections, and
// writes the result to a companion "<name> shuffled" playlist. A marker is a
// track from the playlist that opens a section, plus a label — the same idea as
// pre-approved's four season-opening songs, but chosen in the view.
const PREVIEW_PER_SECTION = 8;

// Markers and the write destination both live per playlist, keyed by its Spotify
// id, so they follow the playlist rather than the tab and survive a reload.
const markerKey = (playlistId) => `spotify.markers.${playlistId}`;
const destKey = (playlistId) => `spotify.dest.${playlistId}`;

const loadJson = (key, fallback) => {
    try {
        const saved = JSON.parse(localStorage.getItem(key) || 'null');
        return saved ?? fallback;
    } catch (_) {
        return fallback;
    }
};

const loadMarkers = (playlistId) => {
    const saved = loadJson(markerKey(playlistId), []);
    return Array.isArray(saved) ? saved.filter((m) => m && m.uri) : [];
};

export const PlaylistTab = ({ playlistId, name }) => {
    const [playlist, setPlaylist] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [markers, setMarkers] = useState(() => loadMarkers(playlistId));

    // The shuffled order, which of the two shuffles produced it, and the state of
    // writing it out. Nothing here touches the source playlist.
    const [order, setOrder] = useState(null);
    const [mode, setMode] = useState(null);
    const [progress, setProgress] = useState(null);
    const [writeError, setWriteError] = useState(null);
    const [wrote, setWrote] = useState(null);
    const [dest, setDest] = useState(() => loadJson(destKey(playlistId), null));

    const destName = `${name} shuffled`;

    useEffect(() => {
        if (!playlistId) return undefined;
        let live = true;
        setPlaylist(null);
        setLoadError(null);
        setOrder(null);
        setMode(null);
        getPlaylist(playlistId)
            .then((data) => { if (live) setPlaylist(data); })
            .catch((error) => { if (live) setLoadError(error.message); });
        return () => { live = false; };
    }, [playlistId]);

    useEffect(() => {
        localStorage.setItem(markerKey(playlistId), JSON.stringify(markers));
    }, [playlistId, markers]);

    useEffect(() => {
        localStorage.setItem(destKey(playlistId), JSON.stringify(dest));
    }, [playlistId, dest]);

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
        setOrder(shuffleKeepingAlbums(playlist.tracks, Math.random, { isDivider, wholeAlbums }));
    };

    const reshuffleSection = (section) => {
        setWriteError(null);
        setWrote(null);
        const base = order ?? playlist.tracks;
        const dividerUri = section.divider?.uri ?? null;
        const newOrder = markerSectionsOf(base, markers).flatMap((s) => [
            ...(s.divider ? [s.divider] : []),
            ...((s.divider?.uri ?? null) === dividerUri
                ? shuffleKeepingAlbums(s.tracks, Math.random, { wholeAlbums: mode === 'albums' })
                : s.tracks),
        ]);
        setOrder(newOrder);
        if (!mode) setMode('tracks');
    };

    const write = async () => {
        setWriteError(null);
        setWrote(null);
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
            );
            setWrote(order.length);
        } catch (error) {
            setWriteError(error.message);
        } finally {
            setProgress(null);
        }
    };

    const busy = progress !== null;

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
                    <p className="spotify__count">
                        <strong>{playlist.tracks.length}</strong> tracks
                        {playlist.capped ? (
                            <span className="spotify__muted">
                                {' '}(the first {playlist.tracks.length} of{' '}
                                {playlist.total} — only these are shuffled)
                            </span>
                        ) : playlist.total !== playlist.tracks.length && (
                            <span className="spotify__muted">
                                {' '}({playlist.total} in Spotify — the rest are
                                no longer playable and were skipped)
                            </span>
                        )}
                    </p>

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
                    </div>
                    <p className="spotify__muted">
                        <strong>Shuffle tracks</strong> spreads a record's songs
                        across its section, in album order, keeping only the runs
                        that were already together.{' '}
                        <strong>Shuffle whole albums</strong> keeps each record
                        intact and start-to-finish, and shuffles the records.
                    </p>

                    {busy && (
                        <p className="spotify__progress">
                            Writing {progress.done} of {progress.total}…
                        </p>
                    )}

                    {writeError && <p className="spotify__error">{writeError}</p>}

                    {wrote !== null && (
                        <p className="spotify__done">
                            Written — {wrote} tracks now in "{destName}"
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
