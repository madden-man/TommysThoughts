# Spotify recommendations: the contracts between the pieces

Companion to PLAN-SPOTIFY-RECOMMENDATIONS.md. Several pieces are built in
parallel against these shapes; change a shape here first, then everywhere.

Decisions already made (Tommy, 2026-11-05): master (ii) is the only "kept"
set for now. Twenty albums per build. No Anthropic key exists anywhere in
this repo's environment, so nothing may depend on calling the Claude API at
runtime; Claude-authored inputs are committed files (see 3c).

Rules for every script: ESM `.mjs` under `scripts/`, run from the repo root
with plain `node scripts/<name>.mjs`, Spotify through `scripts/lib/spotify.mjs`
only, credentials from `.env.local` (gitignored, already present), nothing
written outside `public/`, `scripts/data/` and `docs/`. Never write to a
Spotify playlist from a script.

Album identity everywhere: `key` = `normalizeName(artist) + '\u0000' +
normalizeName(baseAlbumName(album))`, using the functions that already live
in `src/views/spotify/libraryOrder.js`. Scripts cannot import that file (it
imports `./shuffle` with no extension), so the profile builder moves
`normalizeName`, `baseAlbumName` and anything they need into a new
import-free `src/views/spotify/names.js`, and `libraryOrder.js` re-exports
them so nothing else changes. Scripts import `../src/views/spotify/names.js`
(Node 22 detects the ESM syntax; the MODULE_TYPELESS warning is fine).

## 1. `public/spotify-taste.json`, by `scripts/build-taste-profile.mjs`

```
node scripts/build-taste-profile.mjs "<path to Spotify Extended Streaming History dir>" [--until YYYY-MM-DD] [--out path]
```

`--until` is for the backtest: ignore plays after that date, and treat master
membership as unknown for any album whose first play is after it (it could
not have been kept yet). Default out is `public/spotify-taste.json`; a
backtest run writes elsewhere.

```jsonc
{
  "source": {
    "export": "Spotify Extended Streaming History",
    "exportFrom": "2014-01-21", "exportTo": "2026-08-25", "plays": 210732,
    "master": { "id": "1QDPVDJSXB9bIrfRg0V36q", "name": "master (ii)", "trackCount": 6095, "readAt": "2026-11-05" }
  },
  "generated": "2026-11-05",
  "until": null,                       // or the cutoff date
  "albums": [                          // every album with at least one play, sorted by score desc
    {
      "key": "lord huron\u0000vide noir",
      "artist": "Lord Huron", "album": "Vide Noir",        // raw spellings, most-played variant
      "artistIds": ["..."], "albumIds": ["..."],          // from master where present, else from resolving track URIs
      "firstPlayed": "2018-04-20", "lastPlayed": "2026-08-26",
      "plays": 902, "hours": 54.0, "distinctTracks": 12, "totalTracks": 12,   // totalTracks null if unknown
      "years": [2018, 2019, 2021, 2024, 2025, 2026],
      "skipRate": 0.04,
      "inMaster": true, "masterTracks": 12, "masterShare": 1.0,   // null/0 when not in master; null when unknowable under --until
      "score": 0.97,                   // 0..1, see plan step 1
      "verdict": "loved"               // loved | liked | dropped | sampled
    }
  ],
  "artists": [                         // sorted by score desc
    { "name": "Lord Huron", "artistIds": ["..."], "score": 0.9, "hours": 140.2,
      "lovedAlbums": 3, "droppedAlbums": 0, "genres": ["indie folk"] }
  ],
  "genres": [ { "genre": "indie folk", "weight": 0.12, "recentWeight": 0.08 } ],   // weights sum to 1; recent = last 24 months
  "shape": { "medianTracks": 12, "medianMinutes": 44, "fullAlbumShare": 0.61 },
  "heard": { "albumKeys": ["..."], "albumIds": ["..."] }   // everything ever played, any length; for exclusion
}
```

Verdicts: `loved` = kept whole or near-whole in master, or very high depth
and longevity; `liked` = in master partially or solid listening; `dropped` =
20+ minutes and 5+ distinct tracks, not in master, no plays in 24 months;
`sampled` = everything else. The exact thresholds are the builder's to pick
and document in its header comment; the backtest will judge them.

## 2. `scripts/data/candidates.json`, by `scripts/build-candidates.mjs`

```
node scripts/build-candidates.mjs [--profile public/spotify-taste.json] [--out scripts/data/candidates.json] [--sources known-artist,listenbrainz,lastfm,claude]
```

Each source lives in `scripts/lib/sources/<name>.mjs` and exports
`async function candidates(profile, { log }) -> [{ artist, album, score, via, note, albumId? }]`.
Raw, unverified. The builder then verifies every row against Spotify
(albumId if given, else `searchAlbums`), fetches the album object, merges
duplicates by `key`, drops anything in `profile.heard` (by key or albumId),
drops `album_type !== 'album'`, fewer than 8 tracks, under 25 minutes,
names matching live/greatest hits/anthology/collection/karaoke/tribute, and
writes:

```jsonc
{
  "generated": "2026-11-05",
  "profile": { "generated": "2026-11-05", "until": null },
  "candidates": [
    {
      "key": "...", "albumId": "...", "artist": "...", "album": "...", "artistIds": ["..."],
      "year": 2019, "totalTracks": 11, "minutes": 41, "albumType": "album",
      "image": "https://i.scdn.co/image/...", "popularity": 54, "label": "...",
      "trackUris": ["spotify:track:..."],                 // in disc/track order
      "sources": [ { "source": "listenbrainz", "score": 0.73, "via": "Lord Huron", "note": "similar artist, rank 3" } ]
    }
  ]
}
```

Sources:

- **known-artist**: every album from `artistAlbums(id)` for the top 150
  profile artists by score (skip artists with droppedAlbums > lovedAlbums).
  `score` = artist score; `via` = the artist.
- **listenbrainz**: MusicBrainz artist search by name for the top 100
  artists (1 request/second, a real User-Agent), then ListenBrainz Labs
  similar-artists, then each neighbour's albums via Spotify artist search +
  `artistAlbums`. `score` = seed score × normalised similarity.
- **lastfm**: same shape via `artist.getSimilar` + `artist.getTopAlbums`,
  only when `LASTFM_API_KEY` is set; otherwise returns `[]` and logs once.
- **claude**: reads `scripts/data/claude-proposals.json`, a committed file of
  `[{ artist, album, why }]` written by hand (by Claude, from the profile's
  loved and dropped lists). `score` = 1 for all; `note` = the why. If
  `ANTHROPIC_API_KEY` is set the source may regenerate the file first; that
  path is optional.

## 3. `public/spotify-recommendations.json`, by `scripts/rank-recommendations.mjs`

```
node scripts/rank-recommendations.mjs [--candidates scripts/data/candidates.json] [--profile public/spotify-taste.json] [--weights docs/spotify-recommendations-weights.json] [--count 20]
```

Reads feedback from Mongo (`tommy-data.spotify_rec_feedback`, see 4) when
`MONGODB_URI` is set: `heard` and `not-for-me` albums are excluded, and an
artist with a `not-for-me` loses score. The output is the page's data:

```jsonc
{
  "generated": "2026-11-05",
  "profile": { "generated": "2026-11-05", "exportTo": "2026-08-25", "masterTrackCount": 6095 },
  "weights": { "known-artist": 0.3, "listenbrainz": 0.4, "lastfm": 0, "claude": 0.3, "artistAffinity": 0.2, "genreAffinity": 0.2, "shape": 0.1, "droppedPenalty": 0.3 },
  "albums": [                       // the top `count`, best first
    {
      "albumId": "...", "uri": "spotify:album:...", "artist": "...", "album": "...", "artistIds": ["..."],
      "year": 2019, "totalTracks": 11, "minutes": 41, "image": "https://...",
      "score": 0.81,
      "why": "You kept all of Strange Trails and Vide Noir and played them across six years; ListenBrainz puts this record's artist beside Lord Huron.",
      "sources": ["listenbrainz", "claude"],
      "trackUris": ["spotify:track:..."]
    }
  ]
}
```

`why` is built from the evidence (seed albums by name, years, sources), one
sentence, no em dashes anywhere in any generated text.

## 4. Feedback function: `server/rec_feedback/rec_feedback.js`

POST JSON, same shape conventions as the other functions (plain-text error
bodies, JSON success):

- `{ "albumId": "...", "artist": "...", "album": "...", "verdict": "saved" | "heard" | "not-for-me" }` upserts
  `{ _id: albumId, artist, album, verdict, at }` in `tommy-data.spotify_rec_feedback` and answers `{ ok: true }`.
- `{ "albumId": "...", "verdict": "undo" }` deletes the row.
- `{ "list": true }` answers `{ feedback: [ { albumId, artist, album, verdict, at } ] }`.

Needs `MONGODB_URI`. Mongo client pattern as in `server/get_playlist`.

## 5. The tab

`src/views/spotify/NextRecordsTab.jsx`, a built-in tab labelled
`next records`, placed right after the master (ii) in order tab in
`SpotifyPage.jsx` (kind `nextrecords`, not closable, always present).

- Fetches `/spotify-recommendations.json` and the feedback list, shows the
  albums not yet marked `heard` or `not-for-me`, in order.
- Card: cover (image), artist, album, year · tracks · minutes, the why, the
  source names small. Three buttons: **Save** (writes `trackUris` to a
  playlist named `master (ii) candidates`, via `ensurePlaylist` and
  `writeOrder` with `append: true` so earlier saves stay, then records
  `saved`), **Heard it**, **Not for me** (record and hide, with an Undo
  line that appears for the last action).
- Footer in the box: "Built 2026-11-05 from plays through 2026-08-25 and
  master (ii) at 6,095 tracks."
- Everything in the standard white ridge-bordered box (CLAUDE.md), styles
  in `spotify.css` under a `.next-records` prefix, mobile first (one column
  on a phone, cards no wider than the panel).
- Tests with React Testing Library against a fixture file
  `src/views/spotify/__fixtures__/recommendations.json` (three albums) and a
  mocked `./server` module: renders cards, Save calls ensurePlaylist then
  writeOrder with the fixture's uris and append true, Not for me posts and
  hides, Undo restores.

`src/views/spotify/server.js` gains `recordFeedback(payload)` and
`listFeedback()` wrapping the function through the existing `post` helper
(so the rate-limit breaker is shared), nothing else changes there.

## 6. `src/views/spotify/fit.js`: the one fit score

Pure, import-free beyond names.js, loadable from Node and the browser.
`profileIndex(profile)`, `scoreAlbum(album, index, weights)` returning
`{ score, tier, parts, reasons, key }`, `rankAlbums(albums, profile, weights)`
(unheard and sampled by score, then liked and loved, then dropped),
`albumOfBlock(block)` for shuffle.js album blocks, `DEFAULT_WEIGHTS`. The
ranker script and the ranked tab both call these and never score on their
own. Weights live in `docs/spotify-recommendations-weights.json` once the
backtest has chosen them; the tab fetches `/spotify-recommendations.json`
and uses its `weights` block, falling back to DEFAULT_WEIGHTS.

## 7. The ranked tab (Tommy, 2026-11-05: "sort git add goodMusic by which albums I'm most likely to enjoy")

The queue playlist is named `git add ./goodMusic` (id 2hD9q4WrdC1h56j6EXXFVZ,
9,864 tracks, 999 albums, 817 of them whole). A built-in tab `RankedTab`
(kind `ranked`), found by name the way master (ii) is, labelled
`<name> ranked`, sitting after `next records`. It mirrors InOrderTab: reads
every part, groups with `albumBlocksOf`, fetches `/spotify-taste.json` once,
ranks the blocks with `rankAlbums` (via `albumOfBlock`), previews the top 40
with score, tier and the first reason, shows tier counts (unheard / already
kept / dropped), and writes the flattened order to `<name> ranked` through
ensurePlaylist, clearPlaylist and writeOrder with append, exactly as
InOrderTab writes `in order`. ` ranked` joins OUTPUT_SUFFIXES. Profile load
failure: the tab says so and refuses to write (there is no fallback order
worth writing).
