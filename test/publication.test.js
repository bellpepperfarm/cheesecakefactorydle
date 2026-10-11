import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { resolveMenuVersion, selectDailyItems, validateMenuSnapshot } from '../src/core/menus.js';
import { correctPositions, selectSortingItems } from '../src/modes/sorting.js';
import { exclusionReasons } from '../src/core/menu-policy.js';
import { buildShareText } from '../src/core/share.js';
import { createSeededRandom } from '../src/core/game.js';
const registry = JSON.parse(fs.readFileSync('data/menus.json'));
const menu = registry.menus[0];
const version = menu.versions.at(-1);
const snapshot = JSON.parse(fs.readFileSync(version.path));
const policy = JSON.parse(fs.readFileSync('data/policies/cheesecake-factory.json'));

test('published menu hashes, item identities, hosted photos and disambiguation remain valid', () => {
    for (const version of menu.versions) {
        const bytes = fs.readFileSync(version.path);
        assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), version.sha256);
        const data = validateMenuSnapshot(JSON.parse(bytes), menu, version);
        for (const item of data.products) assert.ok(fs.existsSync(item.localImage));
    }
    for (const item of snapshot.products) assert.deepEqual(exclusionReasons(item, policy), [], item.name);
});

test('future menu versions cannot change an earlier daily selection', () => {
    const date = '2026-10-11';
    const before = selectDailyItems(snapshot, resolveMenuVersion(menu, date), date);
    const futureMenu = { ...menu, versions: [...menu.versions, { ...version, id: 'future', effectiveFrom: '2099-01-01', seedPrefix: 'new:' }] };
    assert.deepEqual(selectDailyItems(snapshot, resolveMenuVersion(futureMenu, date), date), before);
    assert.deepEqual(before.map(item => item.id), ['42087077', '42087074', '84734271']);
});

test('calorie ties are valid in either order and hard selection is bounded on small menus', () => {
    const items = [500, 500, 300, 200, 100].map((basecalories, id) => ({ id: String(id), basecalories }));
    assert.deepEqual(correctPositions(items), [true, true, true, true, true]);
    assert.deepEqual(correctPositions([items[1], items[0], ...items.slice(2)]), [true, true, true, true, true]);
    const equal = items.map(item => ({ ...item, basecalories: 500 }));
    assert.equal(selectSortingItems(equal, true, createSeededRandom('small')).length, 5);
});

test('source updates cannot reintroduce exclusions through changed IDs or calories', () => {
    const excluded = policy.excludedItems.find(item => item.name === 'Creamy Milkshakes');
    assert.ok(exclusionReasons({ ...excluded, id: 'new-id', basecalories: 1210, maxcalories: 1260 }, policy).length);
    assert.ok(exclusionReasons({ ...snapshot.products[0], basecalories: 9999 }, policy).length);
});

test('share text leads with the game name and date without revealing dishes or calorie answers', () => {
    const text = buildShareText({ title: 'Cheesecakefactorydle', dateKey: '2026-10-11', results: [{ score: 950, item: { name: 'SECRET' }, actualCalories: 1340 }], maxItemScore: 1000, url: 'https://example.test/' });
    assert.equal(text, 'Cheesecakefactorydle · Daily 2026-10-11\n🟩\n950 / 1000\nhttps://example.test/');
    assert.ok(!text.includes('SECRET')); assert.ok(!text.includes('1340'));
});
