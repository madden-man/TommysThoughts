// Albums Claude proposed by hand from the profile's loved, liked and dropped
// lists, committed as scripts/data/claude-proposals.json. There is no
// Anthropic key in this repo's environment, so the file is the source; it is
// rewritten when the profile changes enough to matter. Every row is
// unverified here; the builder checks each against Spotify search and drops
// the ones that do not exist under that name.

import { existsSync, readFileSync } from 'fs';

const FILE = 'scripts/data/claude-proposals.json';

export async function candidates(_profile, { log = console.log } = {}) {
    if (!existsSync(FILE)) { log(`claude: no ${FILE}, skipping`); return []; }
    const proposals = JSON.parse(readFileSync(FILE, 'utf8'));
    log(`claude: ${proposals.length} proposals`);
    return proposals.map((p) => ({ artist: p.artist, album: p.album, score: 1, via: 'claude', note: p.why }));
}
