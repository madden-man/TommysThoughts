import React from 'react';

// The line under a tab's title saying what it is holding.
//
// It has two things to report, and they are independent. A long playlist is read
// in parts, so this tab holds a window into it rather than the whole thing — the
// window is worth naming so the numbers are not mistaken for the playlist's
// length. Separately, a track Spotify no longer serves comes back empty and is
// dropped on the way in, so a part can hold fewer tracks than its window is wide.
//
// The two used to be one either/or branch on a `capped` flag, which the server
// stopped sending when parts replaced the old 2,500-track cap. That left every
// multi-part tab reporting the tracks in its other parts as "no longer playable".
export const TrackCount = ({ playlist }) => {
    const total = playlist.total ?? playlist.tracks.length;
    const offset = playlist.offset ?? 0;
    const parts = playlist.parts ?? 1;
    // How wide this part's window is: a full part, or whatever is left at the end
    // of the playlist. Without a partSize the window is the whole playlist.
    const width = Math.min(total, offset + (playlist.partSize ?? total)) - offset;
    // Anything the window covered that didn't arrive is a track Spotify dropped.
    const skipped = Math.max(0, width - playlist.tracks.length);
    const n = (value) => value.toLocaleString();

    return (
        <p className="spotify__count">
            <strong>{n(playlist.tracks.length)}</strong> tracks
            {parts > 1 && (
                <span className="spotify__muted">
                    {' '}(part {playlist.part + 1} of {parts} — tracks{' '}
                    {n(offset + 1)}–{n(offset + width)} of {n(total)}; the rest
                    are in the other tabs)
                </span>
            )}
            {skipped > 0 && (
                <span className="spotify__muted">
                    {parts > 1 ? ' · ' : ' '}
                    ({n(skipped)} no longer playable on Spotify, skipped)
                </span>
            )}
        </p>
    );
};
