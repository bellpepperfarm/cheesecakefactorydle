import { createSeededRandom, shuffleItems } from './game.js';

// Published rule versions and menu snapshots are immutable. Add a version for changes.
export const DAILY_RULES = Object.freeze({
    'daily-v1': Object.freeze({ itemCount: 3, maxItemScore: 1000, fullScoreMargin: 45 })
});

export function resolveMenuVersion(menu, dateKey) {
    const version = [...menu.versions].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
        .filter(version => version.effectiveFrom <= dateKey).at(-1);
    if (!version) throw new Error('No menu is available for this date.');
    if (!DAILY_RULES[version.rules]) throw new Error('Unsupported game rules.');
    return version;
}

export function playableMenuItems(products) {
    return products.filter(item => !item.hidden);
}

export function validateMenuSnapshot(snapshot, menu, version) {
    if (snapshot.schemaVersion !== 1 || snapshot.menuId !== menu.id || snapshot.version !== version.id ||
        !Array.isArray(snapshot.products) || playableMenuItems(snapshot.products).length < 5) {
        throw new Error('Invalid menu snapshot.');
    }
    const ids = new Set();
    const displays = new Map();
    const playableIds = new Set(playableMenuItems(snapshot.products).map(item => item.id));
    for (const item of snapshot.products) {
        if (typeof item.id !== 'string' || !item.id || ids.has(item.id) ||
            typeof item.name !== 'string' || !item.name.trim() ||
            typeof item.portion !== 'string' || !item.portion.trim() ||
            !Number.isSafeInteger(item.basecalories) || item.basecalories <= 0 ||
            typeof item.imagefilename !== 'string' || !item.imagefilename ||
            (item.hidden !== undefined && typeof item.hidden !== 'boolean') ||
            (item.hidden && (typeof item.comment !== 'string' || !item.comment.trim() || !playableIds.has(item.coveredBy)))) {
            throw new Error('Menu items need unique IDs, names, portions, images and positive calories.');
        }
        ids.add(item.id);
        const display = JSON.stringify([item.name.trim(), item.portion.trim(), item.description || '', item.imagefilename]);
        if (displays.has(display) && displays.get(display) !== item.basecalories) {
            throw new Error('Different calorie answers need distinct portion labels.');
        }
        displays.set(display, item.basecalories);
    }
    return snapshot;
}

export function selectDailyItems(snapshot, version, dateKey) {
    const random = createSeededRandom(`${version.seedPrefix}${dateKey}`);
    const { itemCount } = DAILY_RULES[version.rules];
    const eligible = playableMenuItems(snapshot.products);
    if (version.menuIds) {
        const byMenu = new Map(version.menuIds.map(id => [id, []]));
        for (const item of eligible) byMenu.get(item.sourceMenuId).push(item);
        return shuffleItems(version.menuIds, random).slice(0, itemCount).map(id => {
            const items = byMenu.get(id);
            return items[Math.floor(random() * items.length)];
        });
    }
    const products = new Map(eligible.map(item => [item.id, item]));
    // A frozen ID order preserves existing clean challenges during the initial
    // safety migration, without exposing blacklisted dishes to play.
    const order = snapshot.selectionOrder || snapshot.products.map(item => item.id);
    return shuffleItems(order, random)
        .filter(id => products.has(id)).slice(0, itemCount)
        .map(id => products.get(id));
}

export async function fetchJSON(path) {
    const response = await fetch(path, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
    return response.json();
}

export class MenuRepository {
    constructor(registry) {
        if (registry.schemaVersion !== 1 || !Array.isArray(registry.menus)) throw new Error('Invalid menu registry.');
        this.registry = registry;
        this.cache = new Map();
    }

    async load(menuId, dateKey) {
        const menu = this.registry.menus.find(menu => menu.id === menuId);
        if (!menu) throw new Error('This menu is not available.');
        if (menu.firstPlayableDate && dateKey < menu.firstPlayableDate) throw new Error('This date predates the reviewed menu.');
        const version = resolveMenuVersion(menu, dateKey);
        if (menu.id === 'all') {
            const ids = version.menuIds;
            const rules = DAILY_RULES[version.rules];
            if (!Array.isArray(ids) || ids.length < rules.itemCount || new Set(ids).size !== ids.length || ids.includes('all')) {
                throw new Error('Invalid mixed menu membership.');
            }
            const sources = await Promise.all(ids.map(id => this.load(id, dateKey)));
            const products = sources.flatMap(({ menu: source, snapshot }) => snapshot.products.map(item => ({
                ...item,
                id: `${source.id}:${item.id}`,
                sourceMenuId: source.id,
                imagepath: snapshot.imagepath,
                imageCredit: snapshot.imageCredit
            })));
            return { menu, version, snapshot: { products }, dateKey, rules };
        }
        const key = `${menuId}:${version.id}`;
        if (!this.cache.has(key)) {
            const response = await fetch(version.path, { signal: AbortSignal.timeout(15000) });
            if (!response.ok) throw new Error('Could not load the menu.');
            const bytes = await response.arrayBuffer();
            const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
                byte => byte.toString(16).padStart(2, '0')).join('');
            if (hash !== version.sha256) throw new Error('The published menu has changed unexpectedly.');
            const snapshot = validateMenuSnapshot(JSON.parse(new TextDecoder().decode(bytes)), menu, version);
            this.cache.set(key, snapshot);
        }
        return { menu, version, snapshot: this.cache.get(key), dateKey, rules: DAILY_RULES[version.rules] };
    }
}
