import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/ui/theme.js', import.meta.url), 'utf8');
function page({ saved = null, dark = false, blocked = false } = {}) {
    const listeners = {};
    const control = { addEventListener: (name, fn) => { listeners[name] = fn; } };
    const root = { dataset: {} };
    const media = { matches: dark, addEventListener: (_name, fn) => { listeners.media = fn; } };
    const storage = {
        getItem: () => { if (blocked) throw Error('blocked'); return saved; },
        setItem: (_key, value) => { if (blocked) throw Error('blocked'); saved = value; },
        removeItem: () => { if (blocked) throw Error('blocked'); saved = null; }
    };
    runInNewContext(source, {
        window: { matchMedia: () => media, addEventListener: (name, fn) => { listeners[name] = fn; } },
        document: { documentElement: root, getElementById: () => control, addEventListener: (name, fn) => { listeners[name] = fn; } },
        localStorage: storage
    });
    const initial = root.dataset.theme;
    listeners.DOMContentLoaded();
    return {
        initial, root, control,
        saved: () => saved,
        change: value => { control.value = value; listeners.change(); },
        system: value => { media.matches = value; listeners.media(); },
        sync: value => listeners.storage({ key: 'cheesecakefactorydle:theme', newValue: value })
    };
}
test('system theme applies before DOM ready and follows live system changes', () => {
    const p = page({ dark: true });
    assert.equal(p.initial, 'dark');
    assert.equal(p.control.value, 'system');
    p.system(false);
    assert.equal(p.root.dataset.theme, 'light');
});
test('explicit theme persists across reload and ignores system changes until reset', () => {
    const p = page();
    p.change('dark');
    p.system(false);
    assert.equal(p.root.dataset.theme, 'dark');
    assert.equal(page({ saved: p.saved() }).initial, 'dark');
    p.change('system');
    assert.equal(p.saved(), null);
    assert.equal(p.root.dataset.theme, 'light');
    p.system(true);
    assert.equal(p.root.dataset.theme, 'dark');
});
test('invalid and unavailable storage safely use system and allow session overrides', () => {
    assert.equal(page({ saved: 'invalid', dark: true }).initial, 'dark');
    const p = page({ blocked: true, dark: true });
    p.change('light');
    p.system(true);
    assert.equal(p.root.dataset.theme, 'light');
    p.change('system');
    assert.equal(p.root.dataset.theme, 'dark');
});
test('theme preference changes in another tab update control and theme', () => {
    const p = page({ dark: true });
    p.sync('light');
    assert.equal(p.control.value, 'light');
    assert.equal(p.root.dataset.theme, 'light');
    p.sync(null);
    assert.equal(p.control.value, 'system');
    assert.equal(p.root.dataset.theme, 'dark');
});
