// node scripts/publish-menu.mjs <menu-id> <version> <YYYY-MM-DD> <snapshot.json>
// Input is the normalized schema documented in data/README.md.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { validateMenuSnapshot, DAILY_RULES } from '../src/core/menus.js';
import { exclusionReasons } from '../src/core/menu-policy.js';
const [menuId, versionId, effectiveFrom, input] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(menuId || '') || !/^[a-z0-9-]+$/.test(versionId || '') || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom || '') || !input) {
    throw new Error('Usage: node scripts/publish-menu.mjs <menu-id> <version> <YYYY-MM-DD> <snapshot.json>');
}
const today = new Date().toISOString().slice(0, 10);
if (!Number.isFinite(Date.parse(effectiveFrom)) || new Date(effectiveFrom).toISOString().slice(0, 10) !== effectiveFrom || effectiveFrom <= today) throw new Error('New versions must start on a future UTC date.');
const registryPath = 'data/menus.json';
const registry = JSON.parse(fs.readFileSync(registryPath));
const menu = registry.menus.find(menu => menu.id === menuId);
if (!menu) throw new Error('Add restaurant metadata and an empty versions array to data/menus.json first.');
if (menu.versions.some(version => version.id === versionId || version.effectiveFrom >= effectiveFrom)) throw new Error('Append a new version after all existing effective dates.');
const relativePath = `data/menus/${menuId}/${versionId}.json`;
if (fs.existsSync(relativePath)) throw new Error('Published snapshots cannot be overwritten.');
let snapshot = JSON.parse(fs.readFileSync(input));
snapshot = { ...snapshot, schemaVersion: 1, menuId, version: versionId };
const policyPath = `data/policies/${menuId}.json`;
if (!fs.existsSync(policyPath)) throw new Error('Create a reviewed exclusion policy for this restaurant first.');
const policy = JSON.parse(fs.readFileSync(policyPath));
const excluded = [];
snapshot.products = snapshot.products.filter(item => {
    const reasons = exclusionReasons(item, policy);
    if (reasons.length) excluded.push({ id: item.id, name: item.name, reasons });
    return !reasons.length;
});
// Each new version freezes its own candidate order. Existing snapshots stay intact.
delete snapshot.selectionOrder;
const version = { id: versionId, effectiveFrom, path: relativePath, seedPrefix: `${menuId}:${versionId}:`, rules: 'daily-v1' };
if (!DAILY_RULES[version.rules]) throw new Error('Unknown rules.');
validateMenuSnapshot(snapshot, menu, version);
for (const item of snapshot.products) if (item.localImage && !fs.existsSync(item.localImage)) throw new Error(`Missing hosted image: ${item.localImage}`);
const bytes = JSON.stringify(snapshot, null, 2) + '\n';
version.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
fs.mkdirSync(path.dirname(relativePath), { recursive: true });
fs.writeFileSync(relativePath, bytes, { flag: 'wx' });
fs.writeFileSync(`${relativePath}.exclusions.json`, JSON.stringify(excluded, null, 2) + '\n');
menu.versions.push(version);
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
console.log(`Published ${snapshot.products.length} items for ${effectiveFrom}; excluded ${excluded.length}. No existing version was modified.`);
