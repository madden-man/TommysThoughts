import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@mui/material';
import {
    SEASONS,
    describeOrder,
    isSeasonDivider,
    seasonOf,
    seasonOn,
    seasonSectionsOf,
    seasonsFrom,
    shuffleKeepingAlbums,
} from './shuffle';
import { getPlaylist, writeOrder } from './server';

// The shuffle runs here rather than on the server: two thousand tracks reorder
// in well under a second, and doing it in the browser means you see the result
// before anything is written to Spotify.

const PREVIEW_PER_SECTION = 8;

// The pre-approved playlist, shuffled by season. This is the original /spotify
// view; it now lives inside a tab so other playlists can sit beside it.
export const PreApprovedTab = () => {
    const [playlist, setPlaylist] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [order, setOrder] = useState(null);
    // Which of the two shuffles produced `order`, so the preview and the report
    // can say what you are looking at rather than leaving you to guess.
    const [mode, setMode] = useState(null);

    // Which season it is today. The shuffle opens on it and runs the calendar
    // from there, so the playlist arrives already pointed at the time of year
    // rather than always starting in Summer because that is how it is filed.
    const leadWith = useMemo(() => seasonOn(new Date()), []);
    const running = useMemo(() => seasonsFrom(leadWith), [leadWith]);

    const [progress, setProgress] = useState(null);
    const [writeError, setWriteError] = useState(null);
    const [wrote, setWrote] = useState(null);

    useEffect(() => {
        let live = true;
        getPlaylist()
            .then((data) => { if (live) setPlaylist(data); })
            .catch((error) => { if (live) setLoadError(error.message); });
        return () => { live = false; };
    }, []);

    const sections = useMemo(
        () => (playlist ? seasonSectionsOf(playlist.tracks) : []),
        [playlist],
    );

    // Measured once per shuffle rather than per render — it walks all 2019.
    const report = useMemo(() => (order ? describeOrder(order, {}) : null), [order]);

    // Show sections from the shuffled order when one exists, otherwise from the
    // original playlist — so per-season shuffle buttons are available immediately.
    const previewSections = useMemo(
        () => (playlist ? seasonSectionsOf(order ?? playlist.tracks) : []),
        [order, playlist],
    );

    // Each season should be opened by exactly one song. Naming a song rather
    // than a marker means a second track with the same title would split a
    // season in two, so this is checked and shown rather than assumed.
    const seasonCheck = useMemo(() => {
        if (!playlist) return [];
        const found = new Map();
        playlist.tracks.forEach((track) => {
            const hit = seasonOf(track);
            if (hit) found.set(hit.season, (found.get(hit.season) ?? 0) + 1);
        });
        return SEASONS.map((entry) => ({ ...entry, found: found.get(entry.season) ?? 0 }));
    }, [playlist]);

    const seasonsLookRight = seasonCheck.length > 0
        && seasonCheck.every((s) => s.found === 1);

    const shuffle = (wholeAlbums) => {
        setWriteError(null);
        setWrote(null);
        setMode(wholeAlbums ? 'albums' : 'tracks');
        setOrder(shuffleKeepingAlbums(playlist.tracks, Math.random, {
            isDivider: isSeasonDivider,
            wholeAlbums,
            leadWith,
        }));
    };

    const reshuffleSeason = (seasonName) => {
        setWriteError(null);
        setWrote(null);
        const base = order ?? playlist.tracks;
        const sections = seasonSectionsOf(base);
        const newOrder = sections.flatMap((section) => [
            ...(section.divider ? [section.divider] : []),
            ...(section.season === seasonName
                ? shuffleKeepingAlbums(section.tracks, Math.random, {
                    wholeAlbums: mode === 'albums',
                })
                : section.tracks),
        ]);
        setOrder(newOrder);
        if (!mode) setMode('tracks');
    };

    // Top genre tags by track count for a set of tracks — capped at four so the
    // line stays readable. Empty strings (no genre data) are skipped.
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

    const write = async () => {
        setWriteError(null);
        setWrote(null);
        setProgress({ done: 0, total: order.length });
        try {
            await writeOrder(
                order.map((t) => t.uri),
                (done, total) => setProgress({ done, total }),
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
            <h1 className="spotify__title">pre-approved</h1>
            <p className="spotify__lede">
                Spotify's shuffle is uniform random, which is why it hands you
                two of the same artist in a row and then none for twenty
                minutes. This spreads every artist as far apart as the season
                allows — while keeping album runs welded together and never
                moving a song out of the season it belongs to.
            </p>
            <p className="spotify__muted">
                Reads <strong>pre-approved</strong> and writes the result to{' '}
                <strong>pre approved shuffled</strong>. The original is never
                modified, so a run that goes wrong costs nothing but a re-run.
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
                        {playlist.total !== playlist.tracks.length && (
                            <span className="spotify__muted">
                                {' '}({playlist.total} in Spotify — the rest are
                                no longer playable and were skipped)
                            </span>
                        )}
                    </p>

                    {/* Each season is opened by a named song, so the thing
                        worth checking is that each name caught exactly one. */}
                    <div className="spotify__dividers">
                        <p className="spotify__muted">The four seasons turn on:</p>
                        <ul className="spotify__divider-list">
                            {seasonCheck.map((s) => (
                                <li key={s.season}>
                                    <strong>{s.season}</strong> — {s.title}
                                    {s.artist && ` by ${s.artist}`}
                                    {s.found === 1 ? (
                                        <span className="spotify__muted"> · found</span>
                                    ) : (
                                        <span className="spotify__warn">
                                            {s.found === 0
                                                ? ' · not in the playlist'
                                                : ` · matches ${s.found} tracks`}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                        <p className="spotify__muted">
                            Sections:{' '}
                            {sections.map((s) => `${s.season ?? 'unnamed'} ${s.tracks.length}`)
                                .join(' · ')}
                        </p>
                        <p className="spotify__muted">
                            It's <strong>{leadWith}</strong>, so the shuffle runs{' '}
                            {running.join(' → ')}.
                        </p>
                        {!seasonsLookRight && (
                            <p className="spotify__warn">
                                The seasons don't line up — shuffling would still
                                work, but the sections wouldn't be the four you
                                meant. Worth checking before writing.
                            </p>
                        )}
                    </div>

                    {/* Two shuffles, differing only in what counts as
                        one indivisible thing. */}
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
                            Write to "pre approved shuffled"
                        </Button>
                    </div>
                    <p className="spotify__muted">
                        <strong>Shuffle tracks</strong> spreads a record's songs
                        across its season, in album order, keeping only the runs
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
                            Written — {wrote} tracks now in "pre approved shuffled".
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
                                        {section.season ?? 'Before the first season'}
                                        <span className="spotify__muted">
                                            {' '}· {section.tracks.length} tracks
                                        </span>
                                    </p>
                                    {section.season && (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => reshuffleSeason(section.season)}
                                            disabled={busy}
                                        >
                                            Shuffle
                                        </Button>
                                    )}
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
