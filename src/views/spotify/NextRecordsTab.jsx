import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import { ensurePlaylist, listFeedback, recordFeedback, writeOrder } from './server';

// Albums worth playing next, ranked offline by scripts/rank-recommendations.mjs
// and served as a static file. Each card can be saved (its tracks appended to a
// candidates playlist), marked heard, or turned down. Verdicts go to the
// rec_feedback function so the next build can learn from them.
const RECS_URL = '/spotify-recommendations.json';
export const CANDIDATES_NAME = 'master (ii) candidates';

// Verdicts that take a card off the page. "saved" keeps it, marked.
const HIDDEN = new Set(['heard', 'not-for-me']);

const VERDICT_LABEL = { heard: 'heard it', 'not-for-me': 'not for me', saved: 'saved' };

const loadRecs = () => fetch(RECS_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));

const shortDate = (iso) => (iso ? String(iso).slice(0, 10) : null);

const metaOf = (album) => [
    album.year,
    album.totalTracks != null ? `${album.totalTracks} tracks` : null,
    album.minutes != null ? `${album.minutes} min` : null,
].filter(Boolean).join(' · ');

const footerOf = (data) => {
    const built = shortDate(data?.generated);
    const through = shortDate(data?.profile?.exportTo);
    const count = data?.profile?.masterTrackCount;
    if (!built) return null;
    let line = `Built ${built}`;
    if (through) line += ` from plays through ${through}`;
    if (count != null) line += `${through ? ' and' : ' from'} master (ii) at ${count.toLocaleString()} tracks`;
    return `${line}.`;
};

export const NextRecordsTab = () => {
    const [data, setData] = useState(null);
    const [recsError, setRecsError] = useState(null);
    // albumId -> verdict, from the function and then from presses here.
    const [verdicts, setVerdicts] = useState({});
    const [feedbackError, setFeedbackError] = useState(null);
    // The last hide, so one undo line can put it back. `previous` is whatever
    // verdict the album had before (a saved album can still be marked heard).
    const [lastAction, setLastAction] = useState(null);
    // albumId -> { done, total } while its tracks are being written.
    const [progress, setProgress] = useState({});
    const [busy, setBusy] = useState({});
    const [errors, setErrors] = useState({});
    const [undoError, setUndoError] = useState(null);
    const dest = useRef(null);

    useEffect(() => {
        let live = true;
        loadRecs()
            .then((json) => { if (live) setData(json); })
            .catch((error) => { if (live) setRecsError(error.message); });
        // A failed feedback read must not hide the cards: they show as if
        // nothing had been marked yet, with a note saying so.
        listFeedback()
            .then((rows) => {
                if (!live) return;
                const map = {};
                rows.forEach((row) => { if (row?.albumId) map[row.albumId] = row.verdict; });
                setVerdicts((prev) => ({ ...map, ...prev }));
            })
            .catch((error) => { if (live) setFeedbackError(error.message); });
        return () => { live = false; };
    }, []);

    const setFor = (setter, id, value) => setter((prev) => {
        const next = { ...prev };
        if (value === undefined) delete next[id];
        else next[id] = value;
        return next;
    });

    const payloadOf = (album, verdict) => ({
        albumId: album.albumId, artist: album.artist, album: album.album, verdict,
    });

    const save = async (album) => {
        const id = album.albumId;
        setFor(setErrors, id, undefined);
        setFor(setBusy, id, true);
        try {
            if (!dest.current) dest.current = await ensurePlaylist(CANDIDATES_NAME);
            const uris = album.trackUris ?? [];
            setFor(setProgress, id, { done: 0, total: uris.length });
            // Append, so every earlier save stays in the candidates playlist.
            await writeOrder(
                uris,
                (done, total) => setFor(setProgress, id, { done, total }),
                dest.current.id,
                { append: true },
            );
            setFor(setProgress, id, undefined);
            setFor(setVerdicts, id, 'saved');
            await recordFeedback(payloadOf(album, 'saved'));
        } catch (error) {
            setFor(setErrors, id, error.message);
        } finally {
            setFor(setProgress, id, undefined);
            setFor(setBusy, id, undefined);
        }
    };

    const hide = async (album, verdict) => {
        const id = album.albumId;
        setFor(setErrors, id, undefined);
        setFor(setBusy, id, true);
        try {
            await recordFeedback(payloadOf(album, verdict));
            setLastAction({ album, verdict, previous: verdicts[id] });
            setUndoError(null);
            setFor(setVerdicts, id, verdict);
        } catch (error) {
            setFor(setErrors, id, error.message);
        } finally {
            setFor(setBusy, id, undefined);
        }
    };

    const undo = async () => {
        if (!lastAction) return;
        const { album, previous } = lastAction;
        setUndoError(null);
        try {
            await recordFeedback({ albumId: album.albumId, verdict: 'undo' });
            // Put back a verdict the hide replaced, so undoing "heard it" on a
            // saved album leaves it saved rather than forgotten.
            if (previous) await recordFeedback(payloadOf(album, previous));
            setFor(setVerdicts, album.albumId, previous);
            setLastAction(null);
        } catch (error) {
            setUndoError(error.message);
        }
    };

    const albums = (data?.albums ?? []).filter((a) => !HIDDEN.has(verdicts[a.albumId]));
    const footer = footerOf(data);

    return (
        <div className="next-records">
            <h1 className="spotify__title">next records</h1>

            {recsError && (
                <p className="spotify__warn">
                    Couldn't load the recommendations ({recsError}).
                </p>
            )}
            {feedbackError && (
                <p className="spotify__muted">
                    Couldn't load earlier verdicts, so every record shows.
                </p>
            )}
            {!data && !recsError && <p className="spotify__muted">Loading recommendations…</p>}

            {lastAction && (
                <p className="next-records__undo">
                    <span>
                        Marked <strong>{lastAction.album.album}</strong>{' '}
                        {VERDICT_LABEL[lastAction.verdict]}.
                    </span>
                    <Button size="small" onClick={undo}>undo</Button>
                </p>
            )}
            {undoError && <p className="spotify__error">{undoError}</p>}

            {data && !albums.length && (
                <p className="spotify__muted">Nothing left on the list until the next build.</p>
            )}

            {albums.length > 0 && (
                <ul className="next-records__grid">
                    {albums.map((album) => {
                        const id = album.albumId;
                        const saved = verdicts[id] === 'saved';
                        const step = progress[id];
                        const working = Boolean(busy[id]);
                        return (
                            <li
                                key={id}
                                className={`next-records__card${saved ? ' next-records__card--saved' : ''}`}
                                data-testid="next-records-card"
                            >
                                {album.image && (
                                    <img
                                        className="next-records__cover"
                                        src={album.image}
                                        alt={`${album.album} cover`}
                                        loading="lazy"
                                    />
                                )}
                                <div className="next-records__body">
                                    <p className="next-records__artist">{album.artist}</p>
                                    <p className="next-records__album">{album.album}</p>
                                    {metaOf(album) && (
                                        <p className="next-records__meta">{metaOf(album)}</p>
                                    )}
                                    {album.why && <p className="next-records__why">{album.why}</p>}
                                    {album.sources?.length > 0 && (
                                        <p className="next-records__sources">
                                            {album.sources.join(' · ')}
                                        </p>
                                    )}

                                    <div className="next-records__actions">
                                        {saved ? (
                                            <span className="next-records__saved">
                                                saved{' '}
                                                <a
                                                    href={`https://open.spotify.com/album/${id}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    open in spotify
                                                </a>
                                            </span>
                                        ) : (
                                            <Button
                                                size="small"
                                                variant="contained"
                                                color="success"
                                                disabled={working || !album.trackUris?.length}
                                                onClick={() => save(album)}
                                            >
                                                save
                                            </Button>
                                        )}
                                        {/* A build made while Spotify was throttling album
                                            reads carries no track list, so there is nothing
                                            to write yet; the record is still a click away. */}
                                        {!saved && !album.trackUris?.length && (
                                            <span className="spotify__muted next-records__no-tracks">
                                                tracks arrive on the next build
                                                {' · '}
                                                <a
                                                    href={`https://open.spotify.com/album/${id}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    open in spotify
                                                </a>
                                            </span>
                                        )}
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            disabled={working}
                                            onClick={() => hide(album, 'heard')}
                                        >
                                            heard it
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            color="secondary"
                                            disabled={working}
                                            onClick={() => hide(album, 'not-for-me')}
                                        >
                                            not for me
                                        </Button>
                                    </div>

                                    {step && (
                                        <p className="spotify__progress">
                                            Writing {step.done} of {step.total}…
                                        </p>
                                    )}
                                    {errors[id] && <p className="spotify__error">{errors[id]}</p>}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {footer && <p className="spotify__muted next-records__footer">{footer}</p>}
        </div>
    );
};
