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

Add a unique ID, display `name`, `gameTitle`, and empty `versions` array to `menus.json`; leave the existing default unchanged. Create `policies/<id>.json` with minimum calories, excluded item IDs/reasons and reviewed entries. Prepare a normalized input with `products`, `imagepath`, and a source-specific `imageCredit`.

Each product needs a stable string `id`, `name`, `description`, `category`, unambiguous `portion`, positive integer `basecalories`, and `imagefilename` (relative to `imagepath`, or an absolute URL). Optional `localImage` points to a repository-hosted file. Record the item's official source in `sourceURL` and a separate `nutritionURL` when applicable. If the photographed serving combines separately listed components, record each published value in `calorieComponents` and store their sum as the single answer. Preserve `maxcalories` from imports so range exclusion works. Publish using the same command with the new menu ID.

Keep verified lookalike variants in the snapshot with `hidden: true`, a `coveredBy` ID pointing to a playable item in the same snapshot, and a `comment` explaining the choice. For close variants, favor the higher-calorie option or the one that makes a more memorable guess. Both game modes skip hidden entries.

Select a dataset with `?menu=chilis`, `?menu=wagamama`, `?menu=yard-house`, `?menu=ihop`, `?menu=cheddars`, `?menu=dairy-queen`, `?menu=tim-hortons`, `?menu=cactus-club`, `?menu=cheesecake-factory`, or `?menu=all`. Tim Hortons and Cactus Club Cafe start on 2026-11-10 UTC and join the mixed menu on 2026-11-11 UTC. An individual daily samples uniformly from its playable items. A mixed daily picks three distinct restaurants with equal odds and one playable item from each. The mixed menu freezes its list of restaurants in each registry version. Add a future version of `all` to change membership. Each member is resolved using the challenge date.

The Tim Hortons snapshot uses the 463 Robson Street pickup catalog and matches Canadian lunch items to the July 2026 nutrition guide. Each drink flavor uses a named size. The Cactus Club Cafe snapshot uses the Bentall 5 pickup catalog and the August 2026 nutrition report, including Bentall-specific entries where available. Both snapshots retain documented variants as hidden and exclude servings whose calories could not be matched to the photo.

Restaurant/version-specific seeds and restaurant-specific save keys prevent cross-contamination. Rule versions in `src/core/menus.js` are immutable. Introduce a new rule ID for later scoring changes and keep existing algorithms available for archives.

The publisher uses SHA-256 hashes so accidental edits to a snapshot are caught at load time rather than changing answers silently. Run `npm run check` before release. This is local browser storage, not a competitive anti-cheating system.
