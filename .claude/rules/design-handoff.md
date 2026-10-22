---
paths:
  - "design/**"
  - "app/**"
  - "scripts/capture-screens.mjs"
  - "scripts/screenshot-profiles.ts"
  - "scripts/generate-play-listing-assets.mjs"
  - "assets/images/**"
  - "theme/brand.ts"
  - "theme/tokens.ts"
  - "components/**"
---

# The design handoff and store assets

```bash
npm run shots           # capture design/screens/ from the running web build
npm run shots:store     # capture the 1320×2868 App Store profile to design/store/
npm run shots:play      # capture the 1080×1920 (9:16) Google Play profile to design/play/
npm run shots:play -- --lang=<code>   # the same, in one supported language, to design/play/<code>/
npm run gen:play-assets # write design/play/icon-512.png and feature-graphic.jpg
```

`design/` is the handoff surface pushed to the Claude Design project.
`design/tokens.ts` and `design/brand.ts` re-export from `theme/tokens.ts` and
`theme/brand.ts` rather than copy — `design/handoff.test.ts` pins object
identity so they cannot quietly drift into a duplicate. `design/screens/`
holds PNGs captured by `npm run shots`; after any change to a screen,
regenerate them, or the design side is working from a stale picture.

`design/store/` (App Store, 1320×2868 PNG, `npm run shots:store`) and
`design/play/` (Google Play, 1080×1920 JPEG, `npm run shots:play`) are the
same screens re-captured at each store's listing dimensions — both
gitignored and not part of the `design/screens/` handoff surface. They are
regenerated for each release and attached to its GitHub Release
(`docs/release.md`, Cut a release), never committed. `npm run gen:play-assets` additionally writes
`design/play/icon-512.png` (the shipped app icon resized to Play's required
512×512, alpha preserved) and `design/play/feature-graphic.jpg` (1024×500,
rendered from the dedicated `app/store/feature-graphic.tsx` capture-only
route — nothing like it exists for iOS). **Regenerate `design/screens/` in the
same PR whenever a captured screen, the app icon or the brand mark changes** —
a task that touches `assets/images/icon.png`, `theme/brand.ts`,
`theme/tokens.ts`'s brand roles or any `app/` screen re-runs `npm run shots`.
The store and Play sets are regenerated at release, as above. See
`scripts/screenshot-profiles.ts` for every profile's exact viewport/scale/
format facts and `design/SCREENS.md` for what each captured file shows.
