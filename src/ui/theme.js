// Apply the system appearance before styles load and track live system changes.
(() => {
    // Brand preview is URL-only; appearance still follows the operating system.
    document.documentElement.dataset.brand = new URLSearchParams(window.location.search).get('theme') === 'caloriedle'
        ? 'caloriedle' : 'classic';
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
        document.documentElement.dataset.theme = media.matches ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
})();
