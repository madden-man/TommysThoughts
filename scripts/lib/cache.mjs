// A JSON file per upstream under scripts/data/cache/ (gitignored), so a rerun
// of the candidate build costs nothing for anything already asked once.
// MusicBrainz allows one request a second and ListenBrainz and Spotify both
// throttle, so a cold run takes minutes and a warm one takes seconds. Delete
// a file to refetch that upstream; nothing in it expires on its own, because
// a back catalogue barely moves between two runs a few days apart.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DIR = 'scripts/data/cache';
const open = new Map();

/** The named cache, loaded from disk on first use. */
export const cache = (name) => {
    if (open.has(name)) return open.get(name);
    const file = join(DIR, `${name}.json`);
    const data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    let dirty = 0;
    const save = () => {
        if (!dirty) return;
        mkdirSync(DIR, { recursive: true });
        writeFileSync(file, JSON.stringify(data));
        dirty = 0;
    };
    const c = {
        has: (k) => Object.prototype.hasOwnProperty.call(data, k),
        get: (k) => data[k],
        set: (k, v) => {
            data[k] = v;
            dirty += 1;
            // Save as we go: a long cold run that dies at minute ten keeps its
            // first nine minutes of answers.
            if (dirty >= 25) save();
        },
        save,
    };
    open.set(name, c);
    return c;
};

/** `fn()` once per key, remembered in the named cache. A thrown error is not cached. */
export const remember = async (name, key, fn) => {
    const c = cache(name);
    if (c.has(key)) return c.get(key);
    const value = await fn();
    c.set(key, value);
    return value;
};

/** Flush every cache opened this run. */
export const saveAll = () => { for (const c of open.values()) c.save(); };
