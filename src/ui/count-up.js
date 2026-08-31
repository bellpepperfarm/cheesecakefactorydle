export const easing = Object.freeze({
    linear: value => value,
    outCubic: value => 1 - Math.pow(1 - value, 3)
});

export function interpolateCount(from, to, progress, easingFunction = easing.linear) {
    const clampedProgress = Math.min(1, Math.max(0, progress));
    return Math.round(from + (to - from) * easingFunction(clampedProgress));
}

export function animateCount({
    from = 0,
    to,
    duration,
    easingFunction = easing.linear,
    onUpdate,
    shouldContinue = () => true
}) {
    onUpdate(from, 0);

    return new Promise(resolve => {
        let startedAt;

        const tick = timestamp => {
            if (!shouldContinue()) {
                resolve(false);
                return;
            }

            startedAt ??= timestamp;
            const progress = duration <= 0 ? 1 : Math.min(1, (timestamp - startedAt) / duration);
            onUpdate(interpolateCount(from, to, progress, easingFunction), progress);

            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                resolve(true);
            }
        };

        requestAnimationFrame(tick);
    });
}

export function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
