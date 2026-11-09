import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { MenuRepository, resolveMenuVersion, selectDailyItems, validateMenuSnapshot } from '../src/core/menus.js';
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
    for (const restaurant of registry.menus.filter(menu => menu.id !== 'all')) {
        for (const version of restaurant.versions) {
            const bytes = fs.readFileSync(version.path);
            assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), version.sha256);
            const data = validateMenuSnapshot(JSON.parse(bytes), restaurant, version);
            assert.match(data.imageCredit, /^© /);
            for (const item of data.products) {
                assert.ok(fs.existsSync(item.localImage), item.localImage);
                if (restaurant.id !== menu.id) assert.match(item.sourceURL, /^https:\/\//);
                if (item.calorieComponents) {
                    assert.equal(item.calorieComponents.reduce((sum, component) => sum + component.calories, 0), item.basecalories);
                }
            }
        }
    }
    for (const item of snapshot.products) assert.deepEqual(exclusionReasons(item, policy), [], item.name);
});

test('mixed dailies preserve photo credits and pick from distinct restaurants', async t => {
    t.mock.method(globalThis, 'fetch', async path => new Response(fs.readFileSync(path)));
    const repository = new MenuRepository(registry);
    const mixed = registry.menus.find(menu => menu.id === 'all');
    const date = mixed.firstPlayableDate;
    const context = await repository.load('all', date);
    const { snapshot, version } = context;
    assert.equal(new Set(snapshot.products.map(item => item.id)).size, snapshot.products.length);
    for (const id of version.menuIds) {
        const source = await repository.load(id, date);
        const mixedItems = snapshot.products.filter(item => item.sourceMenuId === id);
        assert.equal(mixedItems.length, source.snapshot.products.length);
        assert.ok(mixedItems.every(item => item.imageCredit === source.snapshot.imageCredit));
    }
    const restaurants = new Set();
    for (let day = 10; day <= 30; day++) {
        const dateKey = `2026-11-${day}`;
        const picks = selectDailyItems(snapshot, version, dateKey);
        assert.equal(new Set(picks.map(item => item.sourceMenuId)).size, 3);
        assert.ok(picks.every(item => !item.hidden));
        assert.deepEqual(selectDailyItems(snapshot, version, dateKey), picks);
        picks.forEach(item => restaurants.add(item.sourceMenuId));
    }
    assert.deepEqual(restaurants, new Set(version.menuIds));
});

test('the Vancouver menus join the mixed pool on the new effective date', async t => {
    t.mock.method(globalThis, 'fetch', async path => new Response(fs.readFileSync(path)));
    const repository = new MenuRepository(registry);
    const before = await repository.load('all', '2026-11-10');
    const after = await repository.load('all', '2026-11-11');
    const restaurants = [
        ['tim-hortons', '© Tim Hortons'],
        ['cactus-club', '© Cactus Club Cafe']
    ];
    assert.equal(before.version.id, 'v1');
    assert.equal(after.version.id, 'v2');
    assert.deepEqual(after.version.menuIds, [...before.version.menuIds, ...restaurants.map(([id]) => id)]);
    for (const [id, credit] of restaurants) {
        const source = await repository.load(id, '2026-11-10');
        const mixedItems = after.snapshot.products.filter(item => item.sourceMenuId === id);
        assert.equal(mixedItems.length, source.snapshot.products.length);
        assert.ok(mixedItems.every(item => item.imageCredit === credit));
    }
    const picks = selectDailyItems(after.snapshot, after.version, '2026-11-11');
    assert.equal(new Set(picks.map(item => item.sourceMenuId)).size, 3);
    assert.ok(picks.every(item => !item.hidden));
});

test('both game modes exclude hidden variants even when their IDs are in the snapshot order', () => {
    const products = Array.from({ length: 100 }, (_, id) => ({ id: String(id), basecalories: 100 + id * 100, hidden: id > 4 }));
    const fixture = { products, selectionOrder: products.map(item => item.id) };
    assert.ok(selectDailyItems(fixture, version, '2026-11-10').every(item => !item.hidden));
    for (const hard of [false, true]) {
        const picks = selectSortingItems(products, hard, createSeededRandom('hidden'));
        assert.equal(picks.length, 5);
        assert.ok(picks.every(item => !item.hidden));
    }
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
