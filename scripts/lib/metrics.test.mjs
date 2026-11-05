import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auc, precisionAt, hash, halfOf } from './metrics.mjs';

const r = (score, hit) => ({ score, hit });

test('auc is 1 for a perfect order, 0 for a reversed one, 0.5 for all ties', () => {
    assert.equal(auc([r(3, true), r(2, true), r(1, false)]), 1);
    assert.equal(auc([r(1, true), r(2, false), r(3, false)]), 0);
    assert.equal(auc([r(1, true), r(1, false), r(1, false), r(1, true)]), 0.5);
});

test('auc counts a tied hit and miss as half', () => {
    // pairs: (h3 vs m1)=1, (h3 vs m2... ) set: hits 3, 2; misses 2, 1
    assert.equal(auc([r(3, true), r(2, true), r(2, false), r(1, false)]), (1 + 1 + 0.5 + 1) / 4);
});

test('auc is null without both classes', () => {
    assert.equal(auc([r(1, true)]), null);
});

test('precisionAt takes the expected share of a tied group at the cut', () => {
    const rows = [r(5, true), r(4, false), r(1, true), r(1, false), r(1, false), r(1, false)];
    assert.equal(precisionAt(rows, 1), 1);
    assert.equal(precisionAt(rows, 2), 0.5);
    // top 4: the 5, the 4, and two of the four tied at 1 (a quarter of them hits)
    assert.equal(precisionAt(rows, 4), (1 + 0 + 2 * 0.25) / 4);
    assert.equal(precisionAt(rows, 99), 2 / 6);
});

test('precisionAt does not depend on input order', () => {
    const a = [r(1, true), r(1, false), r(2, false)];
    assert.equal(precisionAt(a, 2), precisionAt([...a].reverse(), 2));
});

test('hash and halfOf are stable', () => {
    assert.equal(hash('a'), 0xe40c292c);
    assert.equal(halfOf('lord huron\u0000vide noir'), halfOf('lord huron\u0000vide noir'));
});
