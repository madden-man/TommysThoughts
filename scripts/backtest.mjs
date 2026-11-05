// Does the fit score know what Tommy will keep? Step 4 of
// docs/PLAN-SPOTIFY-RECOMMENDATIONS.md, judged against what actually happened.
//
//   node scripts/backtest.mjs [--labels scripts/data/taste-full.json]
//       [--profile scripts/data/taste-until-2023.json]
//       [--candidates scripts/data/candidates-until-2023.json]
//       [--claude scripts/data/claude-proposals-until-2023.json]
//       [--offline] [--write]
//
// The profile is frozen at its --until date (2023-12-31): plays after it are
// invisible to it. The labels come from the whole history, built with --full
// so the sampled rows are there:
//
//   node scripts/build-taste-profile.mjs '<export>' --full --out scripts/data/taste-full.json
//   node scripts/build-taste-profile.mjs '<export>' --until 2023-12-31 --full --out scripts/data/taste-until-2023.json
//
// Targets are albums first played after the cutoff. A hit is one the whole
// history calls loved or liked; a miss is one it calls dropped, or sampled
// after 20+ minutes (tried and not continued). Everything else (a song or
// two) is no verdict and is left out. Each target is scored by fit.js's
// scoreAlbum against the frozen profile with no sourceScore, so this judges
// the fit score alone.
//
// What a target is allowed to carry, so nothing about the outcome leaks in:
// artist and album names only (the profile's ids come from master, which only
// the hits are in), genres from one MusicBrainz lookup for every target alike
// (scripts/lib/genres.mjs), and no track count (known for master records
// only, so the shape term is the same 0.5 for every target and cannot be
// judged here). Ties are coin tosses (scripts/lib/metrics.mjs), never the
// profile's row order, which is sorted by an outcome-aware score.
//
// The weight search runs on the half of the targets whose key hashes even
// and is reported on the other half too. Two objectives are tried (P@25 with
// AUC the tiebreak, and AUC with P@25 the tiebreak), each checked two-fold,
// and the one that holds up better out of sample sets the weights. --write puts the chosen weights in
// docs/spotify-recommendations-weights.json and the report in
// docs/spotify-recommendations-backtest.md; without it the report is printed.
//
// Source recall: --candidates is a candidate build run against the frozen
// profile (contract section 2); a source "surfaced" a target hit when one of
// its candidates has the target's key. --claude is a proposals file written
// from the frozen profile alone. Recall needs no Spotify call here.

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { DEFAULT_WEIGHTS, albumKeyOf, profileIndex, rankAlbums, scoreAlbum } from '../src/views/spotify/fit.js';
import { auc, halfOf, precisionAt } from './lib/metrics.mjs';
import { genresFor } from './lib/genres.mjs';
import { normalizeName } from '../src/views/spotify/names.js';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const LABELS = arg('labels', 'scripts/data/taste-full.json');
const PROFILE = arg('profile', 'scripts/data/taste-until-2023.json');
const CANDIDATES = arg('candidates', 'scripts/data/candidates-until-2023.json');
const CLAUDE = arg('claude', 'scripts/data/claude-proposals-until-2023.json');
const WEIGHTS_OUT = 'docs/spotify-recommendations-weights.json';
const REPORT_OUT = 'docs/spotify-recommendations-backtest.md';
const MISS_MINUTES = 20;
const KS = [10, 25, 50];

const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
for (const f of [LABELS, PROFILE]) {
    if (!existsSync(f)) {
        console.error(`missing ${f}; see the header of scripts/backtest.mjs for the two profile builds`);
        process.exit(1);
    }
}
const full = readJson(LABELS);
const frozen = readJson(PROFILE);
const CUT = frozen.until;
if (!CUT) { console.error(`${PROFILE} has no until date; build it with --until`); process.exit(1); }
if (full.until) { console.error(`${LABELS} is itself cut at ${full.until}; the labels need the whole history`); process.exit(1); }
if (full.albums.length <= full.albums.filter((a) => a.verdict !== 'sampled').length) {
    console.error(`${LABELS} has no sampled rows; build it with --full`);
    process.exit(1);
}

// ---- targets ----------------------------------------------------------------

const labelOf = (a) => {
    if (a.verdict === 'loved' || a.verdict === 'liked') return true;
    if (a.verdict === 'dropped' || a.hours * 60 >= MISS_MINUTES) return false;
    return null;
};

const targets = full.albums
    .filter((a) => a.firstPlayed > CUT)
    .map((a) => ({ row: a, hit: labelOf(a) }))
    .filter((t) => t.hit !== null);

// Records the frozen profile had already sampled and that came back after
// the cutoff: the evidence for where a sampled record belongs in a queue.
const frozenByKey = new Map(frozen.albums.map((a) => [a.key, a]));
const retries = full.albums
    .filter((a) => a.firstPlayed <= CUT && a.lastPlayed > CUT && frozenByKey.get(a.key)?.verdict === 'sampled')
    .map((a) => ({ row: a, hit: labelOf(a) }))
    .filter((t) => t.hit !== null);

const genreMap = await genresFor([...targets, ...retries].map((t) => t.row.artist), {
    offline: has('offline'), log: console.log,
});
const albumOf = (row) => ({
    artist: row.artist, album: row.album, genres: genreMap.get(normalizeName(row.artist)) ?? [],
});
for (const t of [...targets, ...retries]) {
    t.album = albumOf(t.row);
    t.key = t.row.key;
    t.half = halfOf(t.key);
}

const index = profileIndex(frozen);
const artistByName = index.artistByName;

// ---- scoring ----------------------------------------------------------------

const evaluate = (rows) => {
    const m = { n: rows.length, hits: rows.filter((r) => r.hit).length, auc: auc(rows) };
    for (const k of KS) m[`p${k}`] = precisionAt(rows, k);
    return m;
};
const scored = (list, scoreFn) => list.map((t) => ({ hit: t.hit, score: scoreFn(t), key: t.key, t }));
const fitScore = (weights) => (t) => scoreAlbum(t.album, index, weights).score;
const halves = (list) => ({ all: list, tune: list.filter((t) => t.half === 'tune'), holdout: list.filter((t) => t.half === 'holdout') });
const H = halves(targets);

const methods = {};
const addMethod = (name, scoreFn) => {
    methods[name] = Object.fromEntries(Object.entries(H).map(([h, list]) => [h, evaluate(scored(list, scoreFn))]));
};

const NO_SOURCE = { ...DEFAULT_WEIGHTS };
addMethod('fit, default weights', fitScore(NO_SOURCE));
addMethod('artist hours only', (t) => artistByName.get(normalizeName(t.album.artist))?.hours ?? 0);
addMethod('artist score only', fitScore({ artistAffinity: 1, genreAffinity: 0, genreKeep: 0, shape: 0, artistMissPenalty: 0 }));
addMethod('genre weight only', fitScore({ artistAffinity: 0, genreAffinity: 1, genreKeep: 0, shape: 0, artistMissPenalty: 0 }));
addMethod('genre keep rate only', fitScore({ artistAffinity: 0, genreAffinity: 0, genreKeep: 1, shape: 0, artistMissPenalty: 0 }));
addMethod('has any genre', (t) => (t.album.genres.length ? 1 : 0));
// Random: every target tied, which the metrics read as a coin toss.
addMethod('random', () => 0);

// ---- weight search ----------------------------------------------------------

// A coarse grid on the tune half. Only ratios of the positive weights matter
// to the order, except against the penalty, so shape stays in the grid as
// the constant that sets the penalty's scale.
const GRID = {
    artistAffinity: [0, 0.05, 0.1, 0.2, 0.35],
    genreAffinity: [0, 0.1, 0.25, 0.4, 0.6],
    genreKeep: [0, 0.1, 0.25, 0.4, 0.6],
    shape: [0.1],
    artistMissPenalty: [0, 0.05, 0.15, 0.3],
};
const combos = Object.entries(GRID).reduce(
    (acc, [k, values]) => acc.flatMap((c) => values.map((v) => ({ ...c, [k]: v }))),
    [{}],
).filter((c) => c.artistAffinity + c.genreAffinity + c.genreKeep > 0);
const distance = (w) => Object.keys(GRID).reduce((s, k) => s + Math.abs((w[k] ?? 0) - (DEFAULT_WEIGHTS[k] ?? 0)), 0);
const OBJECTIVES = {
    // The brief's: precision at 25, AUC the tiebreak.
    p25: (a, b) => (a.m.p25 - b.m.p25) || ((a.m.auc ?? 0) - (b.m.auc ?? 0)),
    // Smoother: AUC reads every pair, where P@25 turns on a handful of records.
    auc: (a, b) => ((a.m.auc ?? 0) - (b.m.auc ?? 0)) || (a.m.p25 - b.m.p25),
};
// Best combination on `list` under an objective; the last tiebreak is the
// combination closest to the defaults, so a flat search moves them least.
const searchOn = (list, objective) => {
    let best = null;
    const all = combos.map((c) => {
        const w = { ...DEFAULT_WEIGHTS, ...c };
        const entry = { w, m: evaluate(scored(list, fitScore(w))) };
        const cmp = best ? (OBJECTIVES[objective](entry, best) || (distance(best.w) - distance(entry.w))) : 1;
        if (cmp > 1e-12) best = entry;
        return entry;
    });
    return { best, all };
};

// Two-fold check of each objective: choose on one half, measure on the other,
// both ways round. The objective that holds up better out of sample picks
// the weights, and it picks them on the tune half only, so the holdout
// column stays a number the weights never saw.
const folds = {};
for (const objective of Object.keys(OBJECTIVES)) {
    const a = searchOn(H.tune, objective);
    const b = searchOn(H.holdout, objective);
    const outA = evaluate(scored(H.holdout, fitScore(a.best.w)));
    const outB = evaluate(scored(H.tune, fitScore(b.best.w)));
    folds[objective] = {
        tuneChoice: a, holdoutChoice: b, outA, outB,
        out: { auc: (outA.auc + outB.auc) / 2, p25: (outA.p25 + outB.p25) / 2, p10: (outA.p10 + outB.p10) / 2, p50: (outA.p50 + outB.p50) / 2 },
        inSample: { auc: (a.best.m.auc + b.best.m.auc) / 2, p25: (a.best.m.p25 + b.best.m.p25) / 2 },
    };
}
const objective = Object.keys(folds).sort((x, y) => (folds[y].out.p25 - folds[x].out.p25) || (folds[y].out.auc - folds[x].out.auc))[0];
addMethod('fit, P@25 search', fitScore(folds.p25.tuneChoice.best.w));
addMethod('fit, AUC search', fitScore(folds.auc.tuneChoice.best.w));
const best = folds[objective].tuneChoice.best;
const searched = folds[objective].tuneChoice.all;
const chosen = { ...best.w };
addMethod('fit, chosen weights', fitScore(chosen));

// How flat the top of the search is: the spread of holdout numbers across the
// combinations that come within one record of the chosen one's tune P@25.
const nearBest = searched.filter((e) => e.m.p25 >= best.m.p25 - 1 / 25 - 1e-9);
const holdoutOf = (w) => evaluate(scored(H.holdout, fitScore(w)));
const nearHoldout = nearBest.map((e) => holdoutOf(e.w));
const span = (xs) => [Math.min(...xs), Math.max(...xs)];

// ---- the sampled question ---------------------------------------------------

// A queue holds sampled and unheard records side by side. Score both sets
// together under each placement and see which order the outcomes support.
const mixed = [...targets, ...retries];
const placements = {};
const placementScore = (place, penalty) => (t) => {
    const fit = scoreAlbum(t.album, index, { ...chosen, sampledPenalty: 0 });
    const sampled = fit.tier === 'sampled';
    if (place === 'tier below unheard') return (sampled ? 0 : 10) + fit.score;
    return fit.score - (sampled ? penalty : 0);
};
placements['same tier, no penalty'] = evaluate(scored(mixed, placementScore('same', 0)));
for (const p of [0.05, 0.1, 0.2, 0.3]) placements[`same tier, penalty ${p}`] = evaluate(scored(mixed, placementScore('same', p)));
placements['tier below unheard'] = evaluate(scored(mixed, placementScore('tier below unheard')));
// rankAlbums itself, so the shipped order is the one measured.
const shipped = rankAlbums(mixed.map((t, idx) => ({ ...t.album, idx })), frozen, chosen);
const shippedRows = shipped.map((a, rank) => ({ hit: mixed[a.idx].hit, score: shipped.length - rank }));
placements['rankAlbums as shipped'] = evaluate(shippedRows);
const retryHits = retries.filter((t) => t.hit).length;
const retryTiers = retries.map((t) => scoreAlbum(t.album, index, chosen).tier);

// ---- source recall ----------------------------------------------------------

const hitTargets = targets.filter((t) => t.hit);
const hitKeys = new Map(hitTargets.map((t) => [t.key, t]));
const allTargetKeys = new Map(targets.map((t) => [t.key, t]));
const recall = {};
let candidateFile = null;
if (existsSync(CANDIDATES)) {
    candidateFile = readJson(CANDIDATES);
    if (candidateFile.profile?.until !== CUT) {
        console.log(`  ${CANDIDATES} was built from a profile cut at ${candidateFile.profile?.until}, not ${CUT}; recall from it would measure the wrong thing`);
        candidateFile = null;
    }
}
if (candidateFile) {
    const bySource = new Map();
    for (const c of candidateFile.candidates) {
        const keys = [c.key, albumKeyOf(c.artist, c.album)];
        for (const s of c.sources) {
            const r = bySource.get(s.source) ?? { candidates: 0, hits: new Set(), misses: new Set() };
            r.candidates += 1;
            for (const k of keys) {
                if (hitKeys.has(k)) r.hits.add(k);
                else if (allTargetKeys.has(k)) r.misses.add(k);
            }
            bySource.set(s.source, r);
        }
    }
    for (const [source, r] of bySource) {
        recall[source] = {
            candidates: r.candidates, hitsSurfaced: r.hits.size, missesSurfaced: r.misses.size,
            recall: r.hits.size / (hitTargets.length || 1),
            precision: r.candidates ? r.hits.size / r.candidates : 0,
            found: [...r.hits].map((k) => `${hitKeys.get(k).row.artist}, ${hitKeys.get(k).row.album}`),
        };
    }
}
let claudeAlready = null;
if (existsSync(CLAUDE)) {
    const proposals = readJson(CLAUDE);
    const frozenHeard = new Set(frozen.heard.albumKeys);
    const fresh = proposals.filter((p) => !frozenHeard.has(albumKeyOf(p.artist, p.album)));
    const hits = fresh.filter((p) => hitKeys.has(albumKeyOf(p.artist, p.album)));
    const misses = fresh.filter((p) => allTargetKeys.has(albumKeyOf(p.artist, p.album)) && !hitKeys.has(albumKeyOf(p.artist, p.album)));
    // Played at all after the cutoff, hit or not: a softer sign the proposal was on his radar.
    const fullHeard = new Set(full.heard.albumKeys);
    const played = fresh.filter((p) => fullHeard.has(albumKeyOf(p.artist, p.album)));
    recall['claude (from the frozen profile)'] = {
        candidates: fresh.length, hitsSurfaced: hits.length, missesSurfaced: misses.length,
        recall: hits.length / (hitTargets.length || 1),
        precision: fresh.length ? hits.length / fresh.length : 0,
        played: played.length,
        found: hits.map((p) => `${p.artist}, ${p.album}`),
    };
    // Most proposals turn out to be records he had already played by the
    // cutoff. Those cannot be recommendations, but how many of them he kept
    // is a fair read on whether the proposals aim at his taste.
    const already = proposals.filter((p) => frozenHeard.has(albumKeyOf(p.artist, p.album)));
    const verdictOf = (p) => frozenByKey.get(albumKeyOf(p.artist, p.album))?.verdict ?? 'sampled';
    const judgedRows = frozen.albums.filter((a) => a.hours * 60 >= MISS_MINUTES);
    claudeAlready = {
        proposals: proposals.length, alreadyPlayed: already.length,
        kept: already.filter((p) => ['loved', 'liked'].includes(verdictOf(p))).length,
        dropped: already.filter((p) => verdictOf(p) === 'dropped').length,
        baseKeep: judgedRows.filter((a) => ['loved', 'liked'].includes(a.verdict)).length / (judgedRows.length || 1),
    };
}
// What any artist-seeded source could reach at most: hits by an artist the
// frozen profile already had (known-artist's ceiling) or did not.
const knownArtistHits = hitTargets.filter((t) => artistByName.has(normalizeName(t.row.artist))).length;

// Source weights: precision relative to the best source, so a sourceScore of 1
// from the most precise source is worth the whole source weight. A source that
// surfaced no hit gets 0. When recall could not be measured, a source keeps
// a prior weight and the report says so.
const PRIOR_SOURCES = { 'known-artist': 0.5, listenbrainz: 0.5, lastfm: 0, claude: 0.5 };
const measured = Object.entries(recall).filter(([s]) => !s.startsWith('claude ('));
const bestPrecision = Math.max(0, ...Object.values(recall).map((r) => r.precision));
const sourceWeights = {};
for (const s of Object.keys(PRIOR_SOURCES)) {
    const r = s === 'claude' ? recall['claude (from the frozen profile)'] : recall[s];
    if (s === 'lastfm' && !process.env.LASTFM_API_KEY) { sourceWeights[s] = 0; continue; }
    if (!r) { sourceWeights[s] = measured.length ? 0 : PRIOR_SOURCES[s]; continue; }
    sourceWeights[s] = bestPrecision > 0 ? Math.round((100 * r.precision) / bestPrecision) / 100 : 0;
}

// ---- report -----------------------------------------------------------------

const f3 = (x) => (x == null ? '-' : x.toFixed(3));
const f2 = (x) => (x == null ? '-' : x.toFixed(2));
const today = new Date().toLocaleDateString('en-CA');
const baseRate = targets.filter((t) => t.hit).length / targets.length;
const row = (name, m) => `| ${name} | ${f3(m.all.auc)} | ${f2(m.all.p10)} | ${f2(m.all.p25)} | ${f2(m.all.p50)} | ${f3(m.tune.auc)} | ${f2(m.tune.p25)} | ${f3(m.holdout.auc)} | ${f2(m.holdout.p25)} |`;
const weightLine = (w) => Object.keys(GRID).filter((k) => k !== 'shape').map((k) => `${k} ${w[k]}`).join(', ');

const C = methods['fit, chosen weights'];
const D = methods['fit, default weights'];
const G = methods['genre weight only'];
const verdictLine = (C.holdout.auc ?? 0) - 0.5 < 0.05
    ? 'The fit score does not beat random on the holdout half.'
    : (C.holdout.auc ?? 0) - (G.holdout.auc ?? 0) < 0.02
        ? 'The fit score is no better than genre weight alone on the holdout half.'
        : 'The fit score beats every single-signal baseline on the holdout half.';

const lines = [
    '# Spotify recommendations: the backtest',
    '',
    `Run ${today} by \`node scripts/backtest.mjs --write\`. Profile frozen at ${CUT} (${PROFILE}); labels from the whole history to ${full.source.exportTo} (${LABELS}).`,
    '',
    '## What was tested',
    '',
    `Every album first played after ${CUT} that the history has a verdict on: **${targets.length} targets, ${targets.filter((t) => t.hit).length} hits** (loved or liked by ${full.source.exportTo}) and **${targets.filter((t) => !t.hit).length} misses** (dropped, or sampled for ${MISS_MINUTES}+ minutes and not continued). The base rate is ${f2(baseRate)}, so a random order scores about that at every cut. Each target was scored by fit.js against the frozen profile with no source score, carrying names and MusicBrainz genres only (${targets.filter((t) => t.album.genres.length).length} of ${targets.length} have a genre). The shape term is a constant here (no fair track count exists for the misses), so it was not tested.`,
    '',
    `These are records Tommy chose to try. The backtest asks whether the profile can tell, among records he reached for, which ones he kept. It cannot ask whether he would have reached for a record at all, which is the other half of a recommender.`,
    '',
    '## Fit score against baselines',
    '',
    `AUC is the chance a random hit outscores a random miss (0.5 is a coin). P@k is the share of hits in the top k. The tune half (${H.tune.length} targets) chose the weights; the holdout half (${H.holdout.length}) never saw them.`,
    '',
    '| method | AUC | P@10 | P@25 | P@50 | tune AUC | tune P@25 | holdout AUC | holdout P@25 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...Object.entries(methods).map(([name, m]) => row(name, m)),
    '',
    `The search covered ${combos.length} combinations. Searched for P@25 (AUC the tiebreak) as briefed, the tune half picks ${weightLine(folds.p25.tuneChoice.best.w)}, which scores ${f2(folds.p25.tuneChoice.best.m.p25)} on the tune half and ${f2(folds.p25.outA.p25)} on the holdout: the P@25 optimum is mostly noise. Two-fold, each half choosing for the other:`,
    '',
    '| objective | in-sample AUC | in-sample P@25 | out-of-sample AUC | out-of-sample P@10 | out-of-sample P@25 | out-of-sample P@50 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...Object.entries(folds).map(([k, f]) => `| ${k === 'p25' ? 'P@25' : 'AUC'} | ${f3(f.inSample.auc)} | ${f2(f.inSample.p25)} | ${f3(f.out.auc)} | ${f2(f.out.p10)} | ${f2(f.out.p25)} | ${f2(f.out.p50)} |`),
    '',
    `So the weights come from the ${objective === 'p25' ? 'P@25' : 'AUC'} search on the tune half: **${weightLine(chosen)}** (shape ${chosen.shape}, untested). The defaults were ${weightLine(DEFAULT_WEIGHTS)}.`,
    '',
    `How flat the top is: ${nearBest.length} combinations come within one record of the best tune-half P@25; across them the holdout AUC runs ${span(nearHoldout.map((m) => m.auc)).map(f3).join(' to ')} and the holdout P@25 ${span(nearHoldout.map((m) => m.p25)).map(f2).join(' to ')}.`,
    '',
    `**${verdictLine}**`,
    '',
    '## Reading it plainly',
    '',
    `- **Barely better than random.** The chosen fit score has a holdout AUC of ${f3(C.holdout.auc)} (a coin is 0.5) and a holdout P@25 of ${f2(C.holdout.p25)} against ${f2(methods.random.holdout.p25)} for random. The default weights do about as well (${f3(D.holdout.auc)}, ${f2(D.holdout.p25)}). The weight search moves numbers inside the noise of ${H.holdout.length} targets; no setting found here is reliably better than another.`,
    `- **Artist familiarity predicts nothing here.** Artist score alone has an AUC of ${f3(methods['artist score only'].all.auc)} and artist hours ${f3(methods['artist hours only'].all.auc)}. Among records Tommy reached for, a new album by an artist he loves was kept no more often than a stranger's, and ${hitTargets.length - knownArtistHits} of the ${hitTargets.length} hits were by artists the frozen profile did not have at all. The search sets artist affinity to ${chosen.artistAffinity} for that reason; artists still count through the known-artist source.`,
    `- **Genre is the only signal, and a weak one.** Genre weight alone reaches ${f3(G.all.auc)}, and the new genre keep rate term (how often records in those genres were kept rather than dropped) ${f3(methods['genre keep rate only'].all.auc)}. In the frozen profile most of his big genres keep at about 0.75 to 0.87 (pop, hip hop and indietronica highest), while southern rock and christian rock, which he played a lot before 2020, keep at about 0.6. Those rates lean high because only his top artists have genres at all, and those are the ones he keeps.`,
    `- **What it predicts well is the sampled tier.** A record he sampled before the cutoff and came back to was kept ${f2(retryHits / (retries.length || 1))} of the time, against ${f2(baseRate)} for a first try. That is the one large effect in this backtest, and it is a tier, not a weight: rankAlbums now puts sampled records below unheard ones.`,
    `- **What it cannot see.** Whether a record gets tried at all, which is what sources and the twenty-album page decide. Of the ${targets.length} targets, ${targets.filter((t) => t.album.genres.length).length} had a genre, none had a fair track count, and the profile's master membership for older records is today's master, so the frozen artist scores know a little about keeps made after the cutoff.`,
    '',
    '## Where a sampled record belongs',
    '',
    `${retries.length} records the frozen profile had only sampled came back after ${CUT} with a verdict; ${retryHits} became hits (${f2(retryHits / (retries.length || 1))}), against ${f2(baseRate)} for first tries. Scored together with the ${targets.length} targets (${retryTiers.filter((t) => t === 'sampled').length} of the retries read as tier sampled):`,
    '',
    '| placement | AUC | P@10 | P@25 | P@50 |',
    '| --- | --- | --- | --- | --- |',
    ...Object.entries(placements).map(([name, m]) => `| ${name} | ${f3(m.auc)} | ${f2(m.p10)} | ${f2(m.p25)} | ${f2(m.p50)} |`),
    '',
    '## Source recall',
    '',
    `${hitTargets.length} target hits; ${knownArtistHits} are by an artist the frozen profile already had, so that is the most an artist-seeded source restricted to known artists could reach.`,
    '',
    Object.keys(recall).length
        ? ['| source | candidates | hits surfaced | misses surfaced | recall | precision | weight |', '| --- | --- | --- | --- | --- | --- | --- |',
            ...Object.entries(recall).map(([s, r]) => `| ${s} | ${r.candidates} | ${r.hitsSurfaced} | ${r.missesSurfaced} | ${f3(r.recall)} | ${f3(r.precision)} | ${sourceWeights[s.startsWith('claude') ? 'claude' : s] ?? '-'} |`)].join('\n')
        : `No candidate build against the frozen profile was found at ${CANDIDATES}, so recall was not measured and the source weights are priors.`,
    '',
    ...Object.entries(recall).filter(([, r]) => r.found.length).map(([s, r]) => `- ${s} found: ${r.found.join('; ')}`),
    '',
    `Recall is measured on a partial candidate set: the frozen-profile build ran with \`--limit-artists 40\` and small Spotify budgets on a throttled day (known-artist through album search, not the artist's full album list; ${candidateFile ? candidateFile.candidates.length : 0} candidates in all), and even the full-profile build reached only 112 of 150 known artists and about 150 of 422 ListenBrainz neighbours. ListenBrainz's similarity data is today's, built partly from listening after the cutoff. A hit counts only on an exact key match, so an edition spelled differently is a miss.`,
    '',
    ...(claudeAlready ? [`Claude: ${claudeAlready.alreadyPlayed} of the ${claudeAlready.proposals} proposals written from the frozen profile were records Tommy had already played by the cutoff, which is why only ${claudeAlready.proposals - claudeAlready.alreadyPlayed} could be tested. Of those ${claudeAlready.alreadyPlayed}, ${claudeAlready.kept} were kept (loved or liked) and ${claudeAlready.dropped} dropped; of all records he gave ${MISS_MINUTES}+ minutes by then, ${f2(claudeAlready.baseKeep)} were kept. Too few fresh proposals to weigh, so by the rule (a source that surfaces nothing gets 0) Claude's weight is 0.`, ''] : []),
    `Source weights are each source's precision (target hits surfaced per candidate) over the best source's, so the most precise source is worth the whole source weight. Last.fm has no key here and gets 0. The fit's own \`source\` weight (${chosen.source}) was not tested: too few targets carry a source score to tune it.`,
    '',
];
const report = lines.join('\n');

const weightsFile = {
    fit: Object.fromEntries(Object.keys(DEFAULT_WEIGHTS).map((k) => [k, chosen[k]])),
    sources: sourceWeights,
    chosenOn: today,
    metric: {
        objective: `${objective === 'p25' ? 'precision at 25, AUC the tiebreak' : 'AUC, precision at 25 the tiebreak'}, chosen on the tune half; picked over the other objective by two-fold out-of-sample P@25`,
        twoFold: Object.fromEntries(Object.entries(folds).map(([k, f]) => [k, f.out])),
        targets: targets.length, hits: targets.filter((t) => t.hit).length, cutoff: CUT,
        all: C.all, tune: C.tune, holdout: C.holdout,
        baselines: Object.fromEntries(Object.entries(methods).filter(([k]) => !k.startsWith('fit')).map(([k, m]) => [k, m.holdout])),
        recall: Object.fromEntries(Object.entries(recall).map(([k, r]) => [k, { recall: r.recall, precision: r.precision, hits: r.hitsSurfaced }])),
        recallNote: 'measured on a partial candidate set (frozen-profile build with --limit-artists 40 on a throttled day)',
    },
};

console.log(report);
console.log(JSON.stringify(weightsFile, null, 1));
export { weightsFile, report };
if (has('write')) {
    const round3 = (_k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v);
    writeFileSync(WEIGHTS_OUT, `${JSON.stringify(weightsFile, round3, 2)}\n`);
    writeFileSync(REPORT_OUT, `${report}\n`);
    console.log(`wrote ${WEIGHTS_OUT} and ${REPORT_OUT}`);
}
