// Apply the system appearance before styles load and track live system changes.
(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
        document.documentElement.dataset.theme = media.matches ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
})();
