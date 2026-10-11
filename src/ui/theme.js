// Run before styles load so a saved preference is applied before the first paint.
(() => {
    const key = 'cheesecakefactorydle:theme';
    const valid = value => ['light', 'dark', 'system'].includes(value);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    let preference = 'system';
    try {
        const saved = localStorage.getItem(key);
        if (valid(saved)) preference = saved;
    } catch { /* Appearance still works when storage is unavailable. */ }
    const apply = () => {
        document.documentElement.dataset.theme = preference === 'system'
            ? (media.matches ? 'dark' : 'light') : preference;
    };
    apply();
    media.addEventListener('change', apply);
    document.addEventListener('DOMContentLoaded', () => {
        const control = document.getElementById('theme-preference');
        control.value = preference;
        control.addEventListener('change', () => {
            preference = valid(control.value) ? control.value : 'system';
            try {
                if (preference === 'system') localStorage.removeItem(key);
                else localStorage.setItem(key, preference);
            } catch { /* Keep the preference for this page session. */ }
            apply();
        });
        window.addEventListener('storage', event => {
            if (event.key !== key && event.key !== null) return;
            preference = valid(event.newValue) ? event.newValue : 'system';
            control.value = preference;
            apply();
        });
    });
})();
