import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@mui/material';
import { ensurePlaylist, getPlaylist, writeOrder } from './server';
import { describeLibraryOrder, inLibraryOrder } from './libraryOrder';

// master (ii), replayed in the order it was collected rather than shuffled.
//
// This tab has no shuffle: there is exactly one right answer here, so there is
// nothing to choose and nothing to re-roll. It reads the playlist, sorts it by
// when each record was first saved, and writes it to "<name> in order".
//
// It reads EVERY part rather than one, which is what the shuffle tabs do. A
// shuffle is confined to its section anyway, so a part is a section it can work
// in; a library order is a property of the whole collection, and sorting one
// part at a time would just be three separate orders stacked end to end.

const PREVIEW = 40;

const yearOf = (date) => (date ? date.getUTCFullYear() : null);

const savedOn = (track) => {
    const at = Date.parse(track?.addedAt ?? '');
    return Number.isFinite(at)
        ? new Date(at).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
        })
        : 'no date';
};

export const InOrderTab = ({ playlistId, name, parts = 1 }) => {
    const [tracks, setTracks] = useState(null);
    const [reading, setReading] = useState(null);
    const [loadError, setLoadError] = useState(null);

    const [progress, setProgress] = useState(null);
    const [writeError, setWriteError] = useState(null);
    const [wrote, setWrote] = useState(null);
    const [dest, setDest] = useState(null);

    const destName = `${name} in order`;

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

    const order = useMemo(() => (tracks ? inLibraryOrder(tracks) : null), [tracks]);
    const report = useMemo(() => (tracks ? describeLibraryOrder(tracks) : null), [tracks]);

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
                placed at the moment you first saved anything off it, and playing
                start to finish from there. Nothing is shuffled here. Writes to{' '}
                <strong>{destName}</strong>, so the source is never modified.
            </p>

            {loadError && (
                <p className="spotify__error">Couldn't read the playlist — {loadError}</p>
            )}

            {reading && (
                <p className="spotify__muted">
                    Reading {parts > 1 ? `part ${reading.part + 1} of ${parts}` : 'the playlist'}…
                </p>
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
                        {report.undatedTracks > 0 && (
                            <p className="spotify__muted">
                                {report.undatedTracks.toLocaleString()} tracks carry no
                                save date and sit at the end — Spotify gives no
                                `added_at` for some older or local entries.
                            </p>
                        )}
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
                            {order.slice(0, PREVIEW).map((track, i) => (
                                <li key={`${track.uri}-${i}`}>
                                    {track.name}
                                    <span className="spotify__muted">
                                        {' — '}{track.artistNames.join(', ')}
                                        {' · '}{savedOn(track)}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </>
            )}
        </>
    );
};
