export const GAME_CONFIG = Object.freeze({
    classicMaxGuesses: 6,
    dailyHistoryDays: 30,
    dailySelectionEpoch: '2025-01-01T00:00:00Z',
    multiguessItemCount: 3,
    multiguessMaxItemScore: 1000,
    multiguessFullScoreMargin: 45
});

export function getValidProducts(menuData, requirePositiveCalories = false) {
    return menuData.categories
        .flatMap(category => Array.isArray(category.products) ? category.products : [])
        .filter(product =>
            product.basecalories &&
            product.imagefilename &&
            product.name &&
            (!requirePositiveCalories || Number.parseInt(product.basecalories, 10) > 0)
        );
}

export function getDailyDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

export function isDailyHardMode(date = new Date()) {
    return date.getUTCDay() === 5;
}

export function createSeededRandom(seed) {
    let state = 2166136261;

    for (let index = 0; index < seed.length; index++) {
        state ^= seed.charCodeAt(index);
        state = Math.imul(state, 16777619);
    }

    return function seededRandom() {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

export function shuffleItems(items, random = Math.random) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
}

export function calculateMultiguessScore(guess, actualCalories) {
    const caloriesWrong = Math.max(
        0,
        Math.abs(guess - actualCalories) - GAME_CONFIG.multiguessFullScoreMargin
    );
    const percentageWrongness = caloriesWrong / actualCalories;
    return Math.max(0, Math.round(GAME_CONFIG.multiguessMaxItemScore * (1 - percentageWrongness)));
}

export function getScoreTier(score, maxScore) {
    const ratio = maxScore > 0 ? score / maxScore : 0;
    if (ratio >= 0.9) return { label: 'Menu Oracle', tone: 'gold' };
    if (ratio >= 0.7) return { label: 'Calorie Connoisseur', tone: 'green' };
    if (ratio >= 0.45) return { label: 'Sharp Taster', tone: 'orange' };
    return { label: 'Hungry Apprentice', tone: 'red' };
}

export function chooseDailyItem(dateKey, recentItemIds, validProducts) {
    const random = createSeededRandom(`classic:${dateKey}`);
    const recentIds = new Set(recentItemIds.map(String));
    const maxAttempts = validProducts.length * 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidate = validProducts[Math.floor(random() * validProducts.length)];
        if (!recentIds.has(String(candidate.id))) return candidate;
    }

    return validProducts.find(product => !recentIds.has(String(product.id))) || validProducts[0];
}

export function getDailyItemHistoryThrough(menuData, targetDate) {
    const validProducts = getValidProducts(menuData);
    const history = [];
    const target = new Date(`${getDailyDateKey(targetDate)}T00:00:00Z`);
    const day = new Date(GAME_CONFIG.dailySelectionEpoch);

    if (target < day) {
        day.setTime(target.getTime());
        day.setUTCDate(day.getUTCDate() - GAME_CONFIG.dailyHistoryDays);
    }

    while (day <= target) {
        if (!isDailyHardMode(day)) {
            const recentItems = history
                .filter(entry => {
                    const entryDate = new Date(`${entry.dateKey}T00:00:00Z`);
                    const daysAgo = (day - entryDate) / 86400000;
                    return daysAgo > 0 && daysAgo <= GAME_CONFIG.dailyHistoryDays;
                })
                .map(entry => entry.itemId);
            const dateKey = getDailyDateKey(day);
            const item = chooseDailyItem(dateKey, recentItems, validProducts);
            history.push({ dateKey, itemId: String(item.id) });
        }
        day.setUTCDate(day.getUTCDate() + 1);
    }

    return history;
}
