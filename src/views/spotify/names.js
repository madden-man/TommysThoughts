// How a record's name is spelled for matching, with no imports of its own so
// the offline scripts under scripts/ can load it with plain node. The browser
// code reaches these through libraryOrder.js, which re-exports them, so there
// is still exactly one copy of the rules.

// Curly apostrophes are the usual trap: Spotify writes "Don't" both ways and the
// two are different strings. NFKC folds the width and accent variants.
const CURLY = /[‘’ʼ]/g;

/** One spelling of a name, so the two sides can be compared at all. */
export const normalizeName = (value) => (value ?? '')
    .normalize('NFKC')
    .replace(CURLY, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// A trailing edition or remaster qualifier, which the catalogue spells a dozen
// ways: "(Deluxe Edition)", "[Explicit]", "- 2011 Remaster". Stripping it lets a
// deluxe copy sitting in a playlist find the standard copy that was streamed.
const QUALIFIER = new RegExp(
    '\\s*(?:[([][^)\\]]*'
    + '(?:deluxe|edition|remaster|version|expanded|anniversary|explicit|bonus|reissue|mono|stereo)'
    + '[^)\\]]*[)\\]]'
    // The dash form carries the qualifier anywhere in the tail, "- 2011
    // Remaster" or "- Deluxe", so the keyword is looked for across it rather than
    // straight after the dash. It still has to BE there: "Live - Paris" stays.
    + '|-\\s*[^-]*(?:deluxe|remaster|expanded|anniversary|bonus|reissue)[^-]*)$',
    'i',
);

/** An album name with its edition qualifiers taken off, however many it carries. */
export const baseAlbumName = (album) => {
    let out = (album ?? '').trim();
    for (let prev = null; prev !== out;) {
        prev = out;
        out = out.replace(QUALIFIER, '').trim();
    }
    // Never strip a name down to nothing: an album really called "(Remastered)"
    // keeps its name rather than becoming a key that matches everything.
    return out || (album ?? '').trim();
};
