import React from 'react';
import { render, screen } from '@testing-library/react';
import { TrackCount } from './TrackCount';

const playlist = (over) => ({ total: 100, tracks: [], offset: 0, parts: 1, part: 0, ...over });
const tracks = (n) => Array.from({ length: n }, (_, i) => ({ uri: `uri:${i}` }));

describe('TrackCount', () => {
    it('says nothing beyond the count for a whole playlist that arrived whole', () => {
        render(<TrackCount playlist={playlist({ total: 40, tracks: tracks(40) })} />);
        expect(screen.getByText(/40/)).toBeInTheDocument();
        expect(screen.queryByText(/no longer playable/)).not.toBeInTheDocument();
        expect(screen.queryByText(/part/)).not.toBeInTheDocument();
    });

    it('names the window a part covers rather than looking truncated', () => {
        // The regression this guards: a part used to report the tracks in its
        // sibling parts as unplayable, because the flag it branched on was gone.
        render(<TrackCount playlist={playlist({
            total: 6000, tracks: tracks(2500), offset: 2500, partSize: 2500, part: 1, parts: 3,
        })} />);
        expect(screen.getByText(/part 2 of 3/)).toBeInTheDocument();
        expect(screen.getByText(/2,501–5,000 of 6,000/)).toBeInTheDocument();
        expect(screen.queryByText(/no longer playable/)).not.toBeInTheDocument();
    });

    it('counts only the tracks its own window lost as unplayable', () => {
        render(<TrackCount playlist={playlist({
            total: 6000, tracks: tracks(2490), offset: 0, partSize: 2500, part: 0, parts: 3,
        })} />);
        expect(screen.getByText(/10 no longer playable/)).toBeInTheDocument();
    });

    it('reports a short final part without inventing losses', () => {
        render(<TrackCount playlist={playlist({
            total: 5200, tracks: tracks(200), offset: 5000, partSize: 2500, part: 2, parts: 3,
        })} />);
        expect(screen.getByText(/5,001–5,200 of 5,200/)).toBeInTheDocument();
        expect(screen.queryByText(/no longer playable/)).not.toBeInTheDocument();
    });

    it('still reports unplayable tracks on a single-part playlist', () => {
        render(<TrackCount playlist={playlist({ total: 100, tracks: tracks(97) })} />);
        expect(screen.getByText(/3 no longer playable/)).toBeInTheDocument();
    });
});
