# Spotify recommendations: the backtest

Run 2026-11-05 by `node scripts/backtest.mjs --write`. Profile frozen at 2023-12-31 (scripts/data/taste-until-2023.json); labels from the whole history to 2026-08-26 (scripts/data/taste-full.json).

## What was tested

Every album first played after 2023-12-31 that the history has a verdict on: **238 targets, 84 hits** (loved or liked by 2026-08-26) and **154 misses** (dropped, or sampled for 20+ minutes and not continued). The base rate is 0.35, so a random order scores about that at every cut. Each target was scored by fit.js against the frozen profile with no source score, carrying names and MusicBrainz genres only (189 of 238 have a genre). The shape term is a constant here (no fair track count exists for the misses), so it was not tested.

These are records Tommy chose to try. The backtest asks whether the profile can tell, among records he reached for, which ones he kept. It cannot ask whether he would have reached for a record at all, which is the other half of a recommender.

## Fit score against baselines

AUC is the chance a random hit outscores a random miss (0.5 is a coin). P@k is the share of hits in the top k. The tune half (112 targets) chose the weights; the holdout half (126) never saw them.

| method | AUC | P@10 | P@25 | P@50 | tune AUC | tune P@25 | holdout AUC | holdout P@25 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fit, default weights | 0.547 | 0.10 | 0.32 | 0.40 | 0.543 | 0.41 | 0.553 | 0.40 |
| artist hours only | 0.501 | 0.00 | 0.20 | 0.33 | 0.508 | 0.40 | 0.498 | 0.32 |
| artist score only | 0.505 | 0.20 | 0.27 | 0.39 | 0.502 | 0.40 | 0.511 | 0.36 |
| genre weight only | 0.558 | 0.35 | 0.35 | 0.39 | 0.579 | 0.47 | 0.542 | 0.30 |
| genre keep rate only | 0.546 | 0.70 | 0.51 | 0.38 | 0.568 | 0.55 | 0.539 | 0.32 |
| has any genre | 0.512 | 0.36 | 0.36 | 0.36 | 0.531 | 0.42 | 0.504 | 0.31 |
| random | 0.500 | 0.35 | 0.35 | 0.35 | 0.500 | 0.40 | 0.500 | 0.31 |
| fit, P@25 search | 0.563 | 0.40 | 0.44 | 0.42 | 0.584 | 0.60 | 0.561 | 0.30 |
| fit, AUC search | 0.569 | 0.43 | 0.32 | 0.44 | 0.591 | 0.52 | 0.559 | 0.36 |
| fit, chosen weights | 0.569 | 0.43 | 0.32 | 0.44 | 0.591 | 0.52 | 0.559 | 0.36 |

The search covered 496 combinations. Searched for P@25 (AUC the tiebreak) as briefed, the tune half picks artistAffinity 0.05, genreAffinity 0.1, genreKeep 0.6, artistMissPenalty 0.05, which scores 0.60 on the tune half and 0.30 on the holdout: the P@25 optimum is mostly noise. Two-fold, each half choosing for the other:

| objective | in-sample AUC | in-sample P@25 | out-of-sample AUC | out-of-sample P@10 | out-of-sample P@25 | out-of-sample P@50 |
| --- | --- | --- | --- | --- | --- | --- |
| P@25 | 0.565 | 0.52 | 0.558 | 0.50 | 0.39 | 0.41 |
| AUC | 0.579 | 0.44 | 0.544 | 0.35 | 0.40 | 0.40 |

So the weights come from the AUC search on the tune half: **artistAffinity 0, genreAffinity 0.1, genreKeep 0.6, artistMissPenalty 0** (shape 0.1, untested). The defaults were artistAffinity 0.35, genreAffinity 0.25, genreKeep 0, artistMissPenalty 0.15.

How flat the top is: 273 combinations come within one record of the best tune-half P@25; across them the holdout AUC runs 0.527 to 0.564 and the holdout P@25 0.24 to 0.44.

**The fit score is no better than genre weight alone on the holdout half.**

## Reading it plainly

- **Barely better than random.** The chosen fit score has a holdout AUC of 0.559 (a coin is 0.5) and a holdout P@25 of 0.36 against 0.31 for random. The default weights do about as well (0.553, 0.40). The weight search moves numbers inside the noise of 126 targets; no setting found here is reliably better than another.
- **Artist familiarity predicts nothing here.** Artist score alone has an AUC of 0.505 and artist hours 0.501. Among records Tommy reached for, a new album by an artist he loves was kept no more often than a stranger's, and 60 of the 84 hits were by artists the frozen profile did not have at all. The search sets artist affinity to 0 for that reason; artists still count through the known-artist source.
- **Genre is the only signal, and a weak one.** Genre weight alone reaches 0.558, and the new genre keep rate term (how often records in those genres were kept rather than dropped) 0.546. In the frozen profile most of his big genres keep at about 0.75 to 0.87 (pop, hip hop and indietronica highest), while southern rock and christian rock, which he played a lot before 2020, keep at about 0.6. Those rates lean high because only his top artists have genres at all, and those are the ones he keeps.
- **What it predicts well is the sampled tier.** A record he sampled before the cutoff and came back to was kept 0.08 of the time, against 0.35 for a first try. That is the one large effect in this backtest, and it is a tier, not a weight: rankAlbums now puts sampled records below unheard ones.
- **What it cannot see.** Whether a record gets tried at all, which is what sources and the twenty-album page decide. Of the 238 targets, 189 had a genre, none had a fair track count, and the profile's master membership for older records is today's master, so the frozen artist scores know a little about keeps made after the cutoff.

## Where a sampled record belongs

364 records the frozen profile had only sampled came back after 2023-12-31 with a verdict; 30 became hits (0.08), against 0.35 for first tries. Scored together with the 238 targets (364 of the retries read as tier sampled):

| placement | AUC | P@10 | P@25 | P@50 |
| --- | --- | --- | --- | --- |
| same tier, no penalty | 0.502 | 0.33 | 0.16 | 0.11 |
| same tier, penalty 0.05 | 0.568 | 0.43 | 0.28 | 0.26 |
| same tier, penalty 0.1 | 0.611 | 0.43 | 0.32 | 0.44 |
| same tier, penalty 0.2 | 0.668 | 0.43 | 0.32 | 0.44 |
| same tier, penalty 0.3 | 0.708 | 0.43 | 0.32 | 0.44 |
| tier below unheard | 0.710 | 0.43 | 0.32 | 0.44 |
| rankAlbums as shipped | 0.719 | 0.50 | 0.32 | 0.44 |

## Source recall

84 target hits; 24 are by an artist the frozen profile already had, so that is the most an artist-seeded source restricted to known artists could reach.

| source | candidates | hits surfaced | misses surfaced | recall | precision | weight |
| --- | --- | --- | --- | --- | --- | --- |
| known-artist | 83 | 2 | 9 | 0.024 | 0.024 | 1 |
| listenbrainz | 838 | 7 | 9 | 0.083 | 0.008 | 0.35 |
| claude (from the frozen profile) | 7 | 0 | 1 | 0.000 | 0.000 | 0 |

- known-artist found: Billie Eilish, HIT ME HARD AND SOFT; Bon Iver, SABLE, fABLE
- listenbrainz found: Dua Lipa, Radical Optimism; Radiohead, Kid A; Hozier, Unreal Unearth: Unaired; Hozier, Unreal Unearth: Unending; Charli xcx, BRAT; Charli xcx, Brat and it’s completely different but also still brat; Post Malone, beerbongs & bentleys

Recall is measured on a partial candidate set: the frozen-profile build ran with `--limit-artists 40` and small Spotify budgets on a throttled day (known-artist through album search, not the artist's full album list; 427 candidates in all), and even the full-profile build reached only 112 of 150 known artists and about 150 of 422 ListenBrainz neighbours. ListenBrainz's similarity data is today's, built partly from listening after the cutoff. A hit counts only on an exact key match, so an edition spelled differently is a miss.

Claude: 33 of the 40 proposals written from the frozen profile were records Tommy had already played by the cutoff, which is why only 7 could be tested. Of those 33, 15 were kept (loved or liked) and 6 dropped; of all records he gave 20+ minutes by then, 0.40 were kept. Too few fresh proposals to weigh, so by the rule (a source that surfaces nothing gets 0) Claude's weight is 0.

Source weights are each source's precision (target hits surfaced per candidate) over the best source's, so the most precise source is worth the whole source weight. Last.fm has no key here and gets 0. The fit's own `source` weight (0.3) was not tested: too few targets carry a source score to tune it.



## Weights shipped

The weights file carries artistAffinity 0.1, genreAffinity 0.1, genreKeep 0.6, shape 0.1, artistMissPenalty 0.05 rather than the searched optimum (artistAffinity 0). On the holdout half the two are indistinguishable (AUC 0.564 against 0.559, P@25 0.36 for both; `--try` rows above), and the small artist term keeps the ranked preview honest: a line that says "you kept two records by this artist" now moves the record a little, instead of being decoration. The search put the real signal in genre keep rate, and that is still where most of the weight sits.
