# Plan: album recommendations on /spotify

Status: plan only, nothing built. 2026-11-05.

## The question

Which albums, that Tommy has never heard, would he love the way he loves the
records in master (ii)? Not tracks: albums. Everything on /spotify treats a
record as the unit (the shuffle keeps albums whole, "in order" places whole
records by the day they arrived), so the recommender should too.

## What we already have

| Signal | Where | Size |
| --- | --- | --- |
| master (ii), the approved set | Spotify, read by get_playlist | 6,095 tracks |
| pre-approved and any added tab | Spotify, same path | varies |
| Every play since 2014-01-21 | ~/Downloads/Spotify Extended Streaming History (raw export, 23 audio files) | 210,732 plays, 7,330 albums |
| First-played date per record | public/spotify-first-played.json (reduced from the export) | ~7,000 rows |
| Artist genre per artist id | Mongo tommy-data.spotify_artist_genres | fills as playlists load |
| Name normalisation and edition stripping | src/views/spotify/libraryOrder.js | reuse, never copy |
| A Claude-ranked picker with a JSON schema and a cached catalogue block | server/recommend_watch | the pattern to follow |

The raw export is the richest thing here and is barely used. Per album it
gives plays, ms_played, distinct tracks heard, skips, reason_end, shuffle
flag, platform and the track URI of every play. 1,764 albums got at least 20
minutes and five distinct tracks. Master (ii) holds roughly 500 to 600 albums,
so about 1,100 albums got a real listen and were not kept. That is a
negative set most recommenders never get.

## What Spotify will and will not give us (probed 2026-11-05 with this app's token)

| Endpoint | Status |
| --- | --- |
| /recommendations | 404 |
| /artists/{id}/related-artists | 403 |
| /audio-features | 403 |
| /artists/{id}/albums | 200 |
| /search?type=album | 200 |
| /me/top/artists, /me/top/tracks | 200 |
| /albums?ids= (tracks, release date, type, label, popularity) | 200 |

So Spotify is the catalogue and the place to verify and save an album, but
it will not tell us what is similar to what. Similarity has to come from our
own history, from Last.fm (artist.getSimilar and artist.getTopAlbums, free
key, no user auth), from ListenBrainz Labs (similar artists, no key), and
from Claude.

## How to assess fit (the heart of it)

### 1. Score every album Tommy has heard

One number per (artist, album) from the export plus master (ii):

- **Depth**: hours played, and distinct tracks heard divided by the album's
  track count. Thirty tracks of Atlas: I over 110 hours is a different kind
  of love than one single on repeat.
- **Longevity**: the number of distinct years with plays. A record played in
  2016, 2019 and 2025 outranks one binged for a month.
- **Kept**: in master (ii) at all, and what fraction of the album made it in.
  A whole record in master is the strongest yes we have.
- **Dropped**: heard for 20+ minutes, never kept, no plays in two years.
  This is a no, and it counts against the artist and the genre.
- **Skip rate** from `skipped` and `reason_end`, as a mild penalty.
- **Recency**: last play date, so the profile can be weighted toward who
  Tommy is now (2024 to 2026) rather than 2014.

The output is `public/spotify-taste.json`: loved albums with scores, dropped
albums, artist scores, genre weights by year. Built offline by a script in
`scripts/`, exactly like import-streaming-history.mjs, re-run per export.

### 2. Describe what the loved albums share

Before any candidate is generated, the profile has to say something a human
would nod at: genres by weight, eras, album length and track count he
favours, the ratio of full-album listens to single-track listens, how often
a loved record is an artist's first versus their fourth, how long after
release he finds things. Claude writes this up once from the JSON as a
readable "what you love" paragraph. If that paragraph reads wrong, the
scoring is wrong, and we fix it before going further.

### 3. Generate candidates from several sources, kept separate

Each source returns (artist, album, source, raw score). None is trusted yet.

- **Known artist, unheard record**: for the top ~150 scored artists, every
  album from /artists/{id}/albums not in the heard set. Cheapest and most
  precise. Also catches new releases from loved artists.
- **Neighbour artists**: Last.fm similar artists of the top ~100 artists,
  weighted by the seed's score times the match score, then their top albums.
  ListenBrainz as a second opinion on the same seeds.
- **Claude proposals**: the profile paragraph plus the top 100 loved albums
  and the 100 most telling dropped albums, asked for 40 albums with one line
  each. Every proposal is verified by Spotify search before it counts.
- **Spotify's own**: /me/top/artists over long_term and medium_term, used
  only as extra seeds for the two sources above.

Candidates are de-duplicated by MusicBrainz-free means: normalizeName plus
baseAlbumName from libraryOrder.js, then a Spotify album id once verified.
Compilations, live albums, greatest hits and anything under eight tracks or
25 minutes are dropped unless the profile says Tommy likes those.

### 4. Measure the sources before believing them (the backtest)

This is how we know which assessment is right instead of guessing. Freeze
the history at 2023-12-31. Build the profile from plays before that date
only. Run every source against that profile. Then look at what actually
happened in 2024 to 2026: which albums first-played after the cutoff ended
up loved (kept in master or scored high) and which were dropped.

For each source, and for the combined ranker, report precision at 10, 25
and 50, and how many of the real 2024-2026 loves it would have surfaced at
all. The weights in step 5 are tuned on this and nothing else. The report
is committed as `docs/spotify-recommendations-backtest.md` so the next
export can be compared against it.

### 5. Rank and explain

The surviving candidates get a fit score: a weighted sum of source scores
(weights from the backtest), artist affinity, genre affinity for the
current era, album shape fit, and a penalty for closeness to dropped
artists. The top 50 go to Claude with the profile for a final re-rank and
one sentence of why per album, the recommend_watch pattern with a schema
and a cached profile block. The result is twenty albums, in order, with
cover art, year, length, the why, and which source found it.

## The product

A new built-in tab on /spotify beside master (ii), named **next records**.

1. Twenty album cards, cover, artist, year, one line of why.
2. On each card: **Save** writes the album's tracks to a "master (ii)
   candidates" playlist through the existing ensure_playlist and
   write_shuffled functions. **Heard it** and **Not for me** store feedback
   in Mongo (tommy-data.spotify_rec_feedback) and hide the card.
3. Feedback feeds the next build: "Not for me" joins the dropped set,
   "Save" joins the loved set once it shows up in a later export.
4. A small footer: profile date, export date, and a Refresh button.

Everything new sits in a white ridge-bordered box per CLAUDE.md.

## Where the work runs

A Netlify function has ten seconds. The profile build and the backtest are
local scripts that commit JSON, like the first-played import. The candidate
build (a few hundred Spotify and Last.fm calls) is also a local script,
writing `public/spotify-recommendations.json`. The function layer only
serves feedback writes and the Save action, both already fast. A later
step can move the candidate build to a Netlify background function or a
scheduled run once the method is settled.

## Packages, in order

| # | Package | Output | Done when |
| --- | --- | --- | --- |
| 0 | Last.fm API key, ListenBrainz check, raw export kept outside Downloads | env vars, a scripts/README note | both APIs answer for Of Monsters and Men |
| 1 | `scripts/build-taste-profile.mjs` | public/spotify-taste.json plus a printed top 50 loved and top 50 dropped | Tommy reads both lists and agrees with them |
| 2 | Profile paragraph | docs/spotify-taste-profile.md | reads true |
| 3 | Candidate sources behind one interface | `scripts/lib/sources/*.mjs` | each returns verified Spotify album ids |
| 4 | Backtest harness and report | docs/spotify-recommendations-backtest.md | precision numbers per source, weights chosen |
| 5 | Ranker and Claude explain | public/spotify-recommendations.json | twenty albums with a why |
| 6 | next records tab, Save, feedback | src/views/spotify/NextRecordsTab.jsx, server/rec_feedback | works on tommysthoughts.com/spotify |
| 7 | Refresh path | a one-command rebuild, export cadence noted | second export runs clean |

Packages 1, 2 and 4 are the assessment. They can ship and be judged with no
UI at all, and nothing in 5 or 6 is worth building until 4 says a source
beats picking at random from the top of Last.fm.

## Open questions for Tommy

- Should "others" mean pre-approved and the added tabs as weaker yeses, or
  only master (ii)?
- Weight toward the last two years, or the whole twelve?
- Is a record an artist already in master has made, but Tommy skipped,
  wanted, or already judged? (The export settles most of these.)
- Twenty albums at a time, or fewer and better?
- Is the export worth re-requesting quarterly? It takes Spotify days to
  deliver, and the profile goes stale without it.

## Not doing

- Audio-feature similarity (tempo, energy): the endpoint is gone, and
  third-party replacements cost money for a signal the history already
  beats.
- Scraping Rate Your Music or Album of the Year: no API, and the terms do
  not allow it.
- Per-track recommendations: tracks go in through albums here.
