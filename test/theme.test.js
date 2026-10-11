import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/ui/theme.js', import.meta.url), 'utf8');
function page({ dark = false, saved = null } = {}) {
    let onSystemChange;
    const root = { dataset: {} };
    const media = { matches: dark, addEventListener: (_name, fn) => { onSystemChange = fn; } };
    runInNewContext(source, {
        window: { matchMedia: () => media },
        document: { documentElement: root },
        localStorage: { getItem: () => saved }
    });
    return {
        root,
        system: value => { media.matches = value; onSystemChange(); }
    };
}
test('system appearance applies before DOM ready and follows changes in both directions', () => {
    const p = page({ dark: true });
    assert.equal(p.root.dataset.theme, 'dark');
    p.system(false);
    assert.equal(p.root.dataset.theme, 'light');
    p.system(true);
    assert.equal(p.root.dataset.theme, 'dark');
});
test('old saved overrides cannot override system appearance', () => {
    assert.equal(page({ dark: false, saved: 'dark' }).root.dataset.theme, 'light');
    assert.equal(page({ dark: true, saved: 'light' }).root.dataset.theme, 'dark');
});
