import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@mui/material';
import { ensurePlaylist, getPlaylist, writeOrder } from './server';
import {
    describeLibraryOrder,
    firstPlayedIndex,
    placedBlocks,
} from './libraryOrder';

// master (ii), replayed in the order it was collected rather than shuffled.
//
// This tab has no shuffle: there is exactly one right answer here, so there is
// nothing to choose and nothing to re-roll. It reads the playlist, sorts it by
// when each record first reached the collection, and writes it to "<name> in
// order".
//
// It reads EVERY part rather than one, which is what the shuffle tabs do. A
// shuffle is confined to its section anyway, so a part is a section it can work
// in; a library order is a property of the whole collection, and sorting one
// part at a time would just be three separate orders stacked end to end.

const PREVIEW = 40;

// The listening history, reduced to one date per record by
// scripts/import-streaming-history.mjs. Static and immutable until the next
// export, so it is fetched once for the life of the page rather than per mount.
const HISTORY_URL = '/spotify-first-played.json';
let historyPromise = null;
const loadHistory = () => {
    if (!historyPromise) {
        historyPromise = fetch(HISTORY_URL)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
            .catch((error) => { historyPromise = null; throw error; });
    }
    return historyPromise;
};

const yearOf = (date) => (date ? date.getUTCFullYear() : null);

const onDate = (at) => (at === null
    ? 'no date'
    : new Date(at).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
    }));

export const InOrderTab = ({ playlistId, name, parts = 1 }) => {
    const [tracks, setTracks] = useState(null);
    const [reading, setReading] = useState(null);
    const [loadError, setLoadError] = useState(null);
    // The history is a nicety, not a prerequisite: if it fails to load the tab
    // still works, falling back to playlist add dates throughout, and says so.
    const [history, setHistory] = useState(null);
    const [historyError, setHistoryError] = useState(null);

    const [progress, setProgress] = useState(null);
    const [writeError, setWriteError] = useState(null);
    const [wrote, setWrote] = useState(null);
    const [dest, setDest] = useState(null);

    const destName = `${name} in order`;

    useEffect(() => {
        let live = true;
        loadHistory()
            .then((data) => { if (live) setHistory(data); })
            .catch((error) => { if (live) setHistoryError(error.message); });
        return () => { live = false; };
    }, []);

    // Every part, one after another. getPlaylist caches per part, so coming back
    // to this tab costs nothing — but the first visit is several reads and is
    // worth reporting as it goes rather than sitting blank.
    useEffect(() => {
        let live = true;
        setTracks(null);
        setLoadError(null);
        (async () => {
            const all = [];
            for (let part = 0; part < parts; part += 1) {
                if (!live) return;
                setReading({ part, parts });
                // eslint-disable-next-line no-await-in-loop
                const data = await getPlaylist(playlistId, part);
                all.push(...data.tracks);
            }
            if (live) { setTracks(all); setReading(null); }
        })().catch((error) => {
            if (live) { setLoadError(error.message); setReading(null); }
        });
        return () => { live = false; };
    }, [playlistId, parts]);

    // Built once per load of the file rather than per sort — it is 7,000-odd rows
    // and both the ordering and the report want it.
    const index = useMemo(() => firstPlayedIndex(history), [history]);
    // Wait for the history before ordering, so the first thing shown is not an
    // added_at ordering that silently rearranges itself a moment later.
    const ready = tracks && (history || historyError);
    // The blocks rather than a flat list, so the preview can label each track
    // with the date its RECORD was placed at — which is what the sort used, and
    // is not the same as the track's own date once the fallback is in play.
    const blocks = useMemo(
        () => (ready ? placedBlocks(tracks, index) : null),
        [ready, tracks, index],
    );
    const order = useMemo(
        () => (blocks ? blocks.flatMap((b) => b.tracks) : null),
        [blocks],
    );
    // uri -> where its record landed. Built from the same blocks the order came
    // from, so the preview cannot disagree with the ordering.
    const placeByUri = useMemo(() => {
        const map = new Map();
        (blocks ?? []).forEach((block) => block.tracks.forEach((t) => {
            map.set(t.uri, { at: block.at, source: block.source });
        }));
        return map;
    }, [blocks]);
    const report = useMemo(
        () => (ready ? describeLibraryOrder(tracks, index) : null),
        [ready, tracks, index],
    );

    const write = async () => {
        setWriteError(null);
        setWrote(null);
        try {
            let target = dest;
            if (!target) {
                target = await ensurePlaylist(destName);
                setDest(target);
            }
            setProgress({ done: 0, total: order.length });
            // The default replaces on the first chunk and appends after it, so
            // one press rebuilds the whole playlist. Nothing to empty first and
            // no way to end up with two copies — unlike the shuffle tabs, this
            // writes the collection whole rather than a part at a time.
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
            <h1 className="spotify__title">{destName}</h1>
            <p className="spotify__muted">
                <strong>{name}</strong> in the order you collected it: every record
                placed at the moment you first <em>played</em> anything off it,
                and playing start to finish from there. That date comes from your
                Extended Streaming History, matched on artist and album name —
                a playlist's own add dates only say when this list was built.
                Where the history has nothing, the playlist add date stands in.
                Nothing is shuffled here. Writes to <strong>{destName}</strong>,
                so the source is never modified.
            </p>

            {historyError && (
                <p className="spotify__warn">
                    Couldn't load the listening history ({historyError}) — falling
                    back to playlist add dates for everything, which dates most of
                    a bulk-assembled playlist to one afternoon.
                </p>
            )}

            {loadError && (
                <p className="spotify__error">Couldn't read the playlist — {loadError}</p>
            )}

            {reading && (
                <p className="spotify__muted">
                    Reading {parts > 1 ? `part ${reading.part + 1} of ${parts}` : 'the playlist'}…
                </p>
            )}

            {tracks && !ready && (
                <p className="spotify__muted">Reading the listening history…</p>
            )}

            {order && report && (
                <>
                    <p className="spotify__count">
                        <strong>{report.tracks.toLocaleString()}</strong> tracks
                        {parts > 1 && (
                            <span className="spotify__muted">
                                {' '}(all {parts} parts, read together)
                            </span>
                        )}
                    </p>

                    <div className="spotify__actions">
                        <Button
                            variant="contained"
                            color="success"
                            onClick={write}
                            disabled={busy || !order.length}
                        >
                            Write to "{destName}"
                        </Button>
                    </div>

                    {busy && (
                        <p className="spotify__progress">
                            Writing {progress.done.toLocaleString()} of{' '}
                            {progress.total.toLocaleString()}…
                        </p>
                    )}

                    {writeError && <p className="spotify__error">{writeError}</p>}

                    {wrote !== null && (
                        <p className="spotify__done">
                            Written — {wrote.toLocaleString()} tracks now in "{destName}"
                            {dest?.created && ' (created just now)'}.
                        </p>
                    )}

                    <div className="spotify__report">
                        <p className="spotify__report-line">
                            <strong>{report.records.toLocaleString()}</strong> records
                            kept whole
                            {report.from && (
                                <>
                                    {' · '}
                                    <strong>
                                        {yearOf(report.from)}–{yearOf(report.to)}
                                    </strong>
                                </>
                            )}
                        </p>
                        <p className="spotify__muted">
                            Dated by the listening history:{' '}
                            <strong>
                                {report.tracksBySource.history.toLocaleString()}
                            </strong>{' '}
                            tracks ({report.blocksBySource.history.toLocaleString()}{' '}
                            records).
                            {report.tracksBySource.playlist > 0 && (
                                <>
                                    {' '}Not in the history, so placed by when they were
                                    added to the playlist:{' '}
                                    <strong>
                                        {report.tracksBySource.playlist.toLocaleString()}
                                    </strong>.
                                </>
                            )}
                            {report.tracksBySource.none > 0 && (
                                <>
                                    {' '}Neither, so left at the end:{' '}
                                    <strong>
                                        {report.tracksBySource.none.toLocaleString()}
                                    </strong>.
                                </>
                            )}
                        </p>
                        <p className="spotify__muted">
                            Nothing has been written yet — this is the order that
                            would be.
                        </p>
                    </div>

                    <div className="spotify__section">
                        <div className="spotify__section-header">
                            <p className="spotify__section-title">
                                The first {Math.min(PREVIEW, order.length)}
                            </p>
                        </div>
                        <ol className="spotify__tracks">
                            {order.slice(0, PREVIEW).map((track, i) => {
                                const place = placeByUri.get(track.uri) ?? {};
                                return (
                                    <li key={`${track.uri}-${i}`}>
                                        {track.name}
                                        <span className="spotify__muted">
                                            {' — '}{track.artistNames.join(', ')}
                                            {' · '}{onDate(place.at ?? null)}
                                            {place.source === 'playlist' && ' (added)'}
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                </>
            )}
        </>
    );
};
