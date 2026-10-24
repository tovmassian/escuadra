---
paths:
  - "store/**"
  - "scripts/store-listing.ts"
  - "scripts/store-bundle.ts"
  - "scripts/__tests__/store-listing.test.ts"
  - "app/store/**"
---

# Store listings

The App Store and Google Play listings, from the words to the paste sheet. The design is
`docs/superpowers/specs/2026-10-24-store-listings-design.md`, the procedure
`docs/release.md` (Cut a release, steps 4 and 7, and Change the store listing), and the
walk-through the `escuadra-store-listing` skill.

## What lives where

- `store/listing/<lang>.md`: one file per language, six fields under fixed headings
  (`FIELDS` in `scripts/store-listing.ts`, each with its store and limit). Pasted as
  written: plain text, no Markdown formatting, which is why Prettier skips the folder.
- `store/screenshots.json`: the listing's shots in order, named as in `design/screens/`;
  the same set in every language and both stores, at most 8.
- `store/declarations.md`: English, entered once per app: the name, URLs, category, age
  rating, and the App Privacy and Data safety answers. What they mean is the owner's
  (guardrail 7), and they agree with `en.about.privacy`. A change to what leaves the device
  updates the file in the same PR (`.claude/rules/privacy-telemetry.md`).
- `STORE_LOCALES` in `scripts/store-listing.ts`: each language's locale in each console.
- The feature graphic's tagline is `store.tagline` in the catalogs, because
  `app/store/feature-graphic.tsx` is a rendered route (`.claude/rules/design-handoff.md`).

## The words

- _Escuadra_ and _a la escuadra_ are never translated, and the product has no other name
  (guardrail 6). "Football squad quiz" and the like are category words.
- A screen or control the text names is the catalog's label for it in that language, so
  the listing says what the app shows. French follows France usage.
- Each translation is signed off by a native reviewer before it merges, as the catalogs
  were (#145).

## Checks

`scripts/__tests__/store-listing.test.ts`, in `npm run check`, checks each file's headings
and their order, empty fields, each limit in characters, a field left in English, the
untranslated names, other product names, keyword spacing and repeats, the screenshot set
against `design/screens/`, and the declared privacy URL against `pageUrl('en')` in
`scripts/privacy-pages.ts`. A console's own counter has the last word on a field written
to its limit.

## The paste sheet

`node scripts/store-bundle.ts` compares with the listing that is live: the highest
`vX.Y.Z` tag at or below `app.json`'s version, found by name, because a version's tag sits
on its release branch. It marks each field, the images and the declarations _paste_ or
_skip_ and writes `dist/store-listing/paste-sheet.md`; on a `release/X.Y.Z` checkout it
also copies the images there. `--review` writes the reviewers' sheets to
`dist/store-listing/review/`. It has no npm script, because a new one would move the
fingerprint; nothing under `store/` feeds it.
