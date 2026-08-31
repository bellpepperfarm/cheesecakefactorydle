import test from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateMultiguessScore,
    chooseDailyItem,
    createSeededRandom,
    getDailyDateKey,
    getScoreTier,
    shuffleItems
} from '../src/core/game.js';
import { easing, interpolateCount } from '../src/ui/count-up.js';

test('multiguess score awards full points inside the 45 calorie margin', () => {
    assert.equal(calculateMultiguessScore(1045, 1000), 1000);
    assert.equal(calculateMultiguessScore(955, 1000), 1000);
});

test('multiguess score scales down and never becomes negative', () => {
    assert.equal(calculateMultiguessScore(1545, 1000), 500);
    assert.equal(calculateMultiguessScore(5000, 1000), 0);
});

test('seeded selection is deterministic', () => {
    const values = ['a', 'b', 'c', 'd', 'e'];
    assert.deepEqual(
        shuffleItems(values, createSeededRandom('same-seed')),
        shuffleItems(values, createSeededRandom('same-seed'))
    );
});

test('daily selection avoids recent items when possible', () => {
    const products = [{ id: 1 }, { id: 2 }, { id: 3 }];
    assert.equal(String(chooseDailyItem('2026-08-31', ['1', '2'], products).id), '3');
});

test('daily keys use UTC and score tiers cover the range', () => {
    assert.equal(getDailyDateKey(new Date('2026-08-31T23:59:59Z')), '2026-08-31');
    assert.equal(getScoreTier(2700, 3000).tone, 'gold');
    assert.equal(getScoreTier(0, 3000).tone, 'red');
});

test('count-up interpolation clamps progress and lands on exact values', () => {
    assert.equal(interpolateCount(0, 900, -1), 0);
    assert.equal(interpolateCount(0, 900, 0.5), 450);
    assert.equal(interpolateCount(0, 900, 2), 900);
    assert.equal(interpolateCount(0, 1000, 0.5, easing.outCubic), 875);
});
