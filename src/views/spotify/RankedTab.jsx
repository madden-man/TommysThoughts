import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@mui/material';
import { clearPlaylist, ensurePlaylist, getPlaylist, writeOrder } from './server';
import { albumBlocksOf } from './shuffle';
import { DEFAULT_WEIGHTS, albumOfBlock, rankAlbums } from './fit';

// A queue playlist, reordered by which records are most likely to land.
//
// It mirrors the in order tab: reads every part, groups the tracks into whole
// albums, orders the albums and writes the flattened result to "<name> ranked",
// so the source is never modified. The ordering is fit.js's rankAlbums against
// the taste profile; this tab never scores anything itself.

const PREVIEW = 40;

// Both files are static until the next build, so each is fetched once for the
// life of the page rather than per mount. A failed fetch clears the promise so
// coming back to the tab tries again.
const caches = [];
const once = (url) => {
    let promise = null;
    caches.push(() => { promise = null; });
    return () => {
        if (!promise) {
            promise = fetch(url)
                .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`http ${r.status}`))))
                .catch((error) => { promise = null; throw error; });
        }
        return promise;
    };
};
/** Forget both files, so a test can load them afresh. */
export const resetRankedCaches = () => caches.forEach((reset) => reset());

const loadProfile = once('/spotify-taste.json');
const loadRecommendations = once('/spotify-recommendations.json');

// The weights the ranker script used, so the tab and the recommendations agree.
// Optional: a missing file or one without a weights block means the defaults.
const loadWeights = () => loadRecommendations()
    .then((data) => (data?.weights && typeof data.weights === 'object'
        ? data.weights
        : DEFAULT_WEIGHTS))
    .catch(() => DEFAULT_WEIGHTS);

const TIERS = ['unheard', 'sampled', 'liked', 'loved', 'dropped'];

const percent = (score) => `${Math.round((score ?? 0) * 100)}%`;

export const RankedTab = ({ playlistId, name, parts = 1 }) => {
    const [tracks, setTracks] = useState(null);
    const [reading, setReading] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [profile, setProfile] = useState(null);
    const [profileError, setProfileError] = useState(null);
    const [weights, setWeights] = useState(null);

    const [progress, setProgress] = useState(null);
    const [writeError, setWriteError] = useState(null);
    const [wrote, setWrote] = useState(null);
    const [dest, setDest] = useState(null);

    const destName = `${name} ranked`;

    useEffect(() => {
        let live = true;
        loadProfile()
            .then((data) => { if (live) setProfile(data); })
            .catch((error) => { if (live) setProfileError(error.message); });
        loadWeights().then((w) => { if (live) setWeights(w); });
        return () => { live = false; };
    }, []);

    // Every part, one after another, reported as it goes.
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

    // Ranked albums, each holding the index of the block it came from, so the
    // written order is exactly the blocks' own tracks in ranked order.
    const ranked = useMemo(() => {
        if (!tracks || !profile || !weights) return null;
        const blocks = albumBlocksOf(tracks);
        const albums = blocks.map((block, blockIndex) => ({ ...albumOfBlock(block), blockIndex }));
        return rankAlbums(albums, profile, weights)
            .map((album) => ({ ...album, block: blocks[album.blockIndex] }));
    }, [tracks, profile, weights]);

    const order = useMemo(
        () => (ranked ? ranked.flatMap((album) => album.block.tracks) : null),
        [ranked],
    );

    const tierCounts = useMemo(() => {
        const counts = Object.fromEntries(TIERS.map((t) => [t, 0]));
        (ranked ?? []).forEach((album) => {
            counts[album.fit.tier] = (counts[album.fit.tier] ?? 0) + 1;
        });
        return counts;
    }, [ranked]);

    const write = async () => {
        setWriteError(null);
        setWrote(null);
        try {
            let target = dest;
            if (!target) {
                target = await ensurePlaylist(destName);
                setDest(target);
            }
            // Empty it first and append throughout, so a rerun rebuilds the
            // playlist rather than stacking a second copy on the end.
            await clearPlaylist(target.id);
            setProgress({ done: 0, total: order.length });
            await writeOrder(
                order.map((t) => t.uri),
                (done, total) => setProgress({ done, total }),
                target.id,
                { append: true },
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
        <div className="ranked">
            <h1 className="spotify__title">{destName}</h1>
            <p className="spotify__muted">
                <strong>{name}</strong> by how likely each record is to land, whole
                albums in album order: unheard records first, then the ones you
                already keep, then the ones you let go. writes to{' '}
                <strong>{destName}</strong>, so the source is never modified.
            </p>

            {profileError && (
                <p className="spotify__warn">
                    couldn't load the taste profile ({profileError}), so there is no
                    ranking to write.
                </p>
            )}

            {loadError && (
                <p className="spotify__error">couldn't read the playlist: {loadError}</p>
            )}

            {reading && (
                <p className="spotify__muted">
                    reading {parts > 1 ? `part ${reading.part + 1} of ${parts}` : 'the playlist'}…
                </p>
            )}

            {tracks && !ranked && !profileError && (
                <p className="spotify__muted">reading the taste profile…</p>
            )}

            {ranked && order && (
                <>
                    <p className="spotify__count ranked__summary" data-testid="ranked-summary">
                        {TIERS.filter((t) => tierCounts[t] > 0).map((t, i) => (
                            <span key={t}>
                                {i > 0 && ' · '}
                                <strong>{tierCounts[t].toLocaleString()}</strong> {t}
                            </span>
                        ))}
                        {' · '}
                        <strong>{ranked.length.toLocaleString()}</strong> albums,{' '}
                        <strong>{order.length.toLocaleString()}</strong> tracks
                        {parts > 1 && (
                            <span className="spotify__muted"> (all {parts} parts)</span>
                        )}
                    </p>

                    <div className="spotify__actions">
                        <Button
                            variant="contained"
                            color="success"
                            onClick={write}
                            disabled={busy || !order.length}
                        >
                            write {destName}
                        </Button>
                    </div>

                    {busy && (
                        <p className="spotify__progress">
                            writing {progress.done.toLocaleString()} of{' '}
                            {progress.total.toLocaleString()}…
                        </p>
                    )}

                    {writeError && <p className="spotify__error">{writeError}</p>}

                    {wrote !== null && (
                        <p className="spotify__done">
                            written: {wrote.toLocaleString()} tracks now in "{destName}"
                            {dest?.created && ' (created just now)'}.{' '}
                            <a
                                href={`https://open.spotify.com/playlist/${dest?.id}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                open in spotify
                            </a>
                        </p>
                    )}

                    <div className="spotify__section">
                        <div className="spotify__section-header">
                            <p className="spotify__section-title">
                                the top {Math.min(PREVIEW, ranked.length)}
                            </p>
                        </div>
                        <ol className="spotify__tracks ranked__list">
                            {ranked.slice(0, PREVIEW).map((album) => (
                                <li
                                    key={`${album.fit.key}-${album.blockIndex}`}
                                    className="ranked__item"
                                    data-testid="ranked-album"
                                >
                                    <span className="ranked__name">
                                        <strong>{album.artist}</strong>, {album.album}
                                    </span>
                                    <span className="spotify__muted ranked__meta">
                                        {' '}{album.block.tracks.length}{' '}
                                        {album.block.tracks.length === 1 ? 'track' : 'tracks'}
                                        {' · '}{percent(album.fit.score)}
                                        {' · '}
                                        <span className={`ranked__tier ranked__tier--${album.fit.tier}`}>
                                            {album.fit.tier}
                                        </span>
                                        {album.fit.reasons[0] && <>{' · '}{album.fit.reasons[0]}</>}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </>
            )}
        </div>
    );
};
