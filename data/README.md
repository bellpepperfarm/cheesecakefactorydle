# Menu publishing

`menu.json` is the untouched external source. The app loads only versioned snapshots referenced by `data/menus.json`. Each snapshot freezes names, portions, calorie answers, image locations, selection order and provenance. Do not edit an existing published snapshot, its hash, seed, rule version or effective date.

The initial v1 is retained for migration/recovery but is not exposed as playable content. Public archives begin with the audited pool on 2026-10-11. v2 starts on 2026-10-11 with the reviewed pool. Its frozen `selectionOrder` preserves the original shuffle while skipping excluded IDs. Legacy saves migrate only when the three item IDs still match; an unsafe old challenge is replaced rather than silently scored against changed answers. Current clean challenges retain their selection and progress.

## Update the Cheesecake Factory import

1. Replace the raw import when new source data arrives.
2. Review `policies/cheesecake-factory.json`. Every exclusion has a reason; matches use either item ID or name/category so source ID changes do not reintroduce blocked dishes. Calorie ranges, near-zero values, build-your-own entries and unreviewed changes are rejected automatically. Review new items against an authoritative calorie/portion source before adding them to `verifiedItems`.
3. Generate normalized input outside the repository:

   ```sh
   node scripts/import-cheesecake.mjs menu.json > /tmp/cheesecake-next.json
   ```

4. Choose a **future UTC date** and unused version, then run:

   ```sh
   node scripts/publish-menu.mjs cheesecake-factory v3 YYYY-MM-DD /tmp/cheesecake-next.json
   ```

The publisher filters the policy, writes a new snapshot and exclusion report, and appends its effective date. It refuses overwrites and past/today activation. Existing dates continue loading their existing version, including after an update. Include all referenced local images when committing. CDN fallback handles missing/failed local files, followed by a neutral placeholder.

## Add a restaurant

Add a unique ID, display `name`, `gameTitle`, and empty `versions` array to `menus.json`; leave the existing default unchanged. Create `policies/<id>.json` with minimum calories, excluded item IDs/reasons and reviewed entries. Prepare a normalized input with `products`, `imagepath`, and optional `imageCredit`. Do not reuse Cheesecake Factory attribution for another dataset.

Each product needs a stable string `id`, `name`, `description`, `category`, unambiguous `portion`, positive integer `basecalories`, and `imagefilename` (relative to `imagepath`, or an absolute URL). Optional `localImage` points to a repository-hosted file. Preserve `maxcalories` from imports so range exclusion works. Publish using the same command with the new menu ID. The restaurant picker appears automatically when more than one is registered.

Random selection remains uniform within the eligible pool. Restaurant/version-specific seeds and restaurant-specific save keys prevent cross-contamination. Rule versions in `src/core/menus.js` are immutable: introduce a new rule ID for later scoring changes. Keep existing algorithms available for archives.

The publisher uses SHA-256 hashes so accidental edits to a snapshot are caught at load time rather than changing answers silently. Run `npm run check` before release. This is local browser storage, not a competitive anti-cheating system.
