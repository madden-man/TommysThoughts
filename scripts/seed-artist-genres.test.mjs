// The pure parts of seed-artist-genres.mjs: `node --test scripts/*.test.mjs`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vocabularyMapper, pickGenre, collectArtists } from './seed-artist-genres.mjs';

const vocab = ['pop', 'indie folk', 'hip hop', 'singer-songwriter', 'singer/songwriter', 'r&b', 'synth-pop', 'anti-folk', 'antifolk', 'utah', 'lo-fi'];
const map = vocabularyMapper(vocab);

test('MusicBrainz spellings fold to the profile vocabulary', () => {
    assert.equal(map('hip-hop'), 'hip hop');
    assert.equal(map('Hip Hop'), 'hip hop');
    assert.equal(map('singer/songwriter'), 'singer-songwriter'); // heavier spelling wins
    assert.equal(map('synthpop'), 'synth-pop');
    assert.equal(map('rnb'), 'r&b');
    assert.equal(map('lofi'), 'lo-fi');
    assert.equal(map('antifolk'), 'anti-folk');
});

test('a genre the profile has never seen keeps its own spelling, lower case', () => {
    assert.equal(map('Shoegaze'), 'shoegaze');
    assert.equal(map(''), '');
});

test('pickGenre takes the first real genre in count order', () => {
    assert.equal(pickGenre(['indie folk', 'folk'], map), 'indie folk');
    assert.equal(pickGenre(['utah', 'provo', 'hip-hop'], map), 'hip hop');
    assert.equal(pickGenre(['united states'], map), '');
    assert.equal(pickGenre([], map), '');
    assert.equal(pickGenre(undefined, map), '');
});

test('collectArtists keeps every credited artist once and skips missing ids', () => {
    const got = collectArtists(
        [{ artistIds: ['a', 'b'], artistNames: ['Lord Huron', 'Feature'] }, { artistIds: [null], artistNames: ['Local'] }],
        [{ artistIds: ['a'], artistNames: ['LORD HURON'] }, { artistIds: ['c'], artistNames: ['Novo Amor'] }],
    );
    assert.deepEqual(got, [{ id: 'a', name: 'Lord Huron' }, { id: 'b', name: 'Feature' }, { id: 'c', name: 'Novo Amor' }]);
});
