const normalize = value => String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');

export function exclusionReasons(item, policy) {
    const reasons = [];
    const calories = Number(item.basecalories);
    if (!Number.isSafeInteger(calories) || calories <= 0) reasons.push('Missing or invalid calorie answer.');
    if (calories < policy.minimumCalories) reasons.push('Below the minimum calorie threshold for a useful guessing challenge.');
    if (policy.excludeCalorieRanges && item.maxcalories && Number(item.maxcalories) !== calories) reasons.push('Calorie range depends on an unspecified configuration.');
    if ((policy.blockedNamePatterns || []).some(pattern => normalize(item.name).includes(normalize(pattern)))) reasons.push('Customizable dish without a fixed calorie answer.');
    const exclusion = policy.excludedItems.find(entry => entry.id === String(item.id) ||
        (normalize(entry.name) === normalize(item.name) && normalize(entry.category) === normalize(item.category)));
    if (exclusion) reasons.push(...exclusion.reasons);
    // New and changed imported items must be reviewed, not silently admitted.
    if (policy.requireReviewedItems && !policy.verifiedItems.some(entry =>
        normalize(entry.name) === normalize(item.name) && normalize(entry.category) === normalize(item.category) && entry.calories === calories)) {
        reasons.push('New or changed item requires a calorie/portion review before publication.');
    }
    return [...new Set(reasons)];
}
