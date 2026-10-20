# Licences sheet: the Unicode notice and the bundled packages' notices

Issue #156, milestone v2.0.0. **Blocks 2.0.0** (#116): 2.0.0 is the first build to ship the
CLDR-derived country names, and the Unicode License v3 asks for its notice to accompany
them. Lands on `main`; no release-branch work.

## Why

The app bundle carries data and code whose licences ask for their notice to travel with
every copy, and no screen shows those notices:

- **Unicode License v3.** Most es/fr/it/de country names in `i18n/countries.ts` come from
  Unicode CLDR. The notice must appear "with all copies … or in associated Documentation".
  `i18n/UNICODE-LICENSE.txt` covers the repo, not the app.
- **MIT and ISC.** The bundled JavaScript packages ask that their notice be "included in
  all copies or substantial portions". A minified bundle is arguably one. This gap has
  existed since 1.0.0.

Store review checks neither; acceptance by Apple says nothing either way.

## Decisions

| Decision                                             | Choice                                                       | Why                                                                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                                                | Unicode notice + every bundled JavaScript package (option 1) | Meets both conditions in the binary; chosen over a Unicode-only sheet and a web page on 2026-10-20.                                                                             |
| Web page instead                                     | No                                                           | A link sends the IP to GitHub (a new privacy disclosure in five languages), needs a connection, can break in shipped binaries, and is the weakest reading of "with all copies". |
| What "bundled" means                                 | The packages in Metro's iOS and Android source maps          | Exactly what ships: 77 packages today, against 643 in the lockfile's non-dev tree, most of them build tools.                                                                    |
| Native libraries (SDWebImage, Folly, Glide, OkHttp…) | Out of scope; a follow-up issue in **Stabilisation**         | Not in the JS bundle; there are no `ios/`/`android/` folders to read (EAS generates them), so they need their own source and decision.                                          |
| Fonts                                                | Named in the sheet, no notice                                | The OFL is met by the notice inside each font file (`docs/license.md`).                                                                                                         |
| Licence texts                                        | English, never translated                                    | The English text is the licence.                                                                                                                                                |

## 1. The generator

`scripts/gen-licences.ts`, run by a new npm script `gen:licences` (allowed on `main`; locked
release branches take no new scripts).

1. **Bundle.** One `npx expo export --platform ios --platform android --source-maps
--no-bytecode` (about 30 s; `--no-bytecode` skips Hermes compilation and leaves the module
   set unchanged, checked on 2026-10-20) into a temporary directory (`$RUNNER_TEMP` in CI,
   the OS temp directory otherwise), deleted afterwards. The web build is not distributed
   and is left out.
2. **Collect.** Every `node_modules` path in either map's `sources`, reduced to its package
   folder: the last `node_modules/` segment, scoped names kept whole (`@scope/name`). A
   package nested inside another's `node_modules` (Reanimated's own `semver`) resolves to
   that nested folder and its own version. The union, keyed by folder. Today: 74 on iOS,
   77 on Android (`expo-symbols`, `@expo/ui`, `@expo-google-fonts/material-symbols`), 77 in
   all.
3. **Read.** From each package folder: `license` from `package.json`, and every licence
   file — names starting `LICENSE`, `LICENCE`, `COPYING` or `NOTICE`, any case. The primary
   file (`LICENSE`, `LICENCE` or `COPYING`, optionally `.md`/`.txt`) comes first, the rest
   (`LICENSE_FONT`, `NOTICE`) after it in name order. The Inter, Plex Mono and Material
   Symbols packages carry their font's licence in `LICENSE_FONT`; Apache-2.0 asks that a
   `NOTICE` file travel too. The copyright line or lines come from the primary file,
   verbatim; template lines (`Copyright [yyyy] …`) never count.
4. **Fail loudly**, listing every problem at once with the package and the rule, when:
   - its `license` is outside the allowlist: `MIT`, `ISC`, `MIT AND OFL-1.1`,
     `MIT AND Apache-2.0`. Widening it further is the owner's decision, like accepting a
     photo licence. `MIT AND Apache-2.0` is on it from the start: the Material Symbols font
     already ships in the Android bundle (through `expo-router` → `expo-symbols`), and
     Apache-2.0 asks for a copy of its licence, which the sheet gives;
   - it has no licence file and no entry in `scripts/licence-sources.json`;
   - its primary licence text has no copyright line;
   - a `licence-sources.json` entry names a package the bundle no longer contains.
5. **Write** `lib/licences.generated.ts` through `formatAndWrite`
   (`tools/squadctl/src/lib/write-json.ts`), the same prettier path as the other generated
   files:

   ```ts
   // GENERATED FILE — run `npm run gen:licences` to regenerate. Do not hand-edit.
   import type { BundledPackage } from './licencesView';
   /** i18n/UNICODE-LICENSE.txt from its "UNICODE LICENSE V3" line on, verbatim. */
   export const UNICODE_LICENSE = '…';
   export const LICENCE_TEXTS: readonly string[] = ['…', '…']; // deduplicated
   export const PACKAGES: readonly BundledPackage[] = [
     {
       name: 'expo',
       version: '57.0.29',
       licence: 'MIT',
       copyright: 'Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)',
       texts: [0],
     },
     // … sorted by name, then version
   ];
   ```

   The notice starts at "UNICODE LICENSE V3": the file's first line is a note for the repo
   that names `i18n/countries.ts`, not part of the licence.

### `scripts/licence-sources.json`

Hand-written, for packages whose npm tarball has no licence file. Each entry carries a
one-line reason and one of two sources: `from`, another bundled package whose licence file
stands in for it (same repository), or `file`, a licence file copied verbatim from the
package's repository into `scripts/licence-texts/`, with the URL it came from.

| package                                                                                                                            | source                                                    | reason                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@react-native/js-polyfills`, `@react-native/normalize-colors`, `@react-native/assets-registry`, `@react-native/virtualized-lists` | `from: react-native`                                      | Published from the React Native repository under its LICENSE.                                                                                                   |
| `expo-router`, `expo-updates`                                                                                                      | `from: expo`                                              | Published from the Expo repository under its MIT LICENSE.                                                                                                       |
| `standard-navigation`                                                                                                              | `file: scripts/licence-texts/standard-navigation.LICENSE` | Its repository, `react-navigation/standard-navigation`, carries an MIT LICENSE ("Copyright (c) 2026 React Navigation Contributors") that the npm tarball omits. |

An entry whose package no longer appears in the bundle fails the generator, so the file
cannot collect dead entries.

### Wiring

`check` runs `npm run gen:licences` after `gen:flags` and adds `lib/licences.generated.ts`
to its `git diff --exit-code` list. Cost: about 30 s per `check`.

When it fails: a dependency bump changes a version or text, so the file changes; run
`gen:licences` and commit, as with `gen:squads`. A new package under an allowed licence
that ships a licence file is listed with no action; anything else stops with the rule it
broke.

## 2. The sheet

**About.** A new last row in the "Data and image credits" card, under "Country names":
`Licences ›`, a `Pressable` with `accessibilityRole="button"`, styled like the card's
sub-headings.

**`components/LicencesSheet.tsx`**, on the existing `components/Sheet.tsx` (opens, drags and
closes like the photo-credits and language sheets). Content in a `ScrollView` with
`flexShrink: 1`:

1. `originalLanguage`: "Licence texts are shown as written, in English."
2. **Country names**: "Unicode CLDR · Unicode License v3", `UNICODE_LICENSE` expanded by
   default.
3. **Fonts**: "Inter · IBM Plex Mono · Archivo" under "SIL Open Font License 1.1", and
   "Material Symbols (Android)" under "Apache License 2.0". Named only; their licence texts
   are under their packages below (Archivo's notice is inside its font files, with
   `OFL.txt` beside them in the repo). The names come from a data constant in
   `lib/licencesView.ts`, since Archivo is not an npm package.
4. **Software · N**: one row per `PACKAGES` entry — name and version, then licence and
   copyright. A tap expands its texts in place. No expand animation.
   `accessibilityState={{ expanded }}`.

Licence files are hard-wrapped at about 80 columns, which a phone wraps again into ragged
lines. The sheet shows each text as paragraphs: a blank line separates paragraphs, and the
line breaks inside one become spaces (`licenceParagraphs` in `lib/licencesView.ts`). The
words are untouched; only the wrapping follows the screen. Proportional body type
(`descriptionSmall`) reads better than mono at that width.

Offline and silent: everything is in the bundle. Colours from `useThemeColors()`, sizes from
tokens; a missing token is added to `theme/tokens.ts` in both palettes. Package names,
versions, licence IDs, copyright lines and font names are data, not catalog text.

## 3. Catalog keys

Under `about.licences` in `i18n/en.ts`, each with a `≤ N chars` budget mirrored in
`i18n/budgets.ts`:

| key                | en                                              |
| ------------------ | ----------------------------------------------- |
| `label`            | Licences (the row and the sheet title)          |
| `originalLanguage` | Licence texts are shown as written, in English. |
| `countryNames`     | Country names                                   |
| `fonts`            | Fonts                                           |
| `software`         | Software                                        |

Translated in `de`, `fr` (France usage), `es`, `it` in the same PR, then reviewed by a fresh
native-language expert per language until clean. The pinned English About hash in
`i18n/__tests__/catalogs.test.ts` changes and is updated with that review. The Privacy
section is untouched, so `privacy/2/` needs no regeneration.

## 4. Tests

- `scripts/licences.test.ts` on `scripts/licences.ts`, the generator's pure half (the I/O
  stays in `gen-licences.ts`), with in-memory inputs and no bundling: package folders from
  source paths (scoped, nested), licence-file ordering, copyright selection (template lines
  refused), text deduplication, `licence-sources.json` resolution, and each failure.
- `lib/licencesView.test.ts`: `licenceParagraphs`, and the generated file itself — every
  text index resolves, every package has a copyright and at least one text, the list is
  sorted with no duplicates, every licence is on the allowlist, and `UNICODE_LICENSE` is
  the `.txt` file from its "UNICODE LICENSE V3" line on.
- The stale check itself is `check`'s `git diff --exit-code`.

## 5. Docs and screens

- `docs/license.md`: three rows in "What Escuadra ships" (bundled JavaScript packages;
  Material Symbols, Apache-2.0, Android only, through `expo-router`; native libraries, not
  yet listed, linking #160); the Unicode paragraph says
  the sheet now meets the condition, and "does not carry it yet" goes; a short "Software
  licences" subsection on the generator, its three failures, and that widening the
  allowlist is the owner's call.
- `CLAUDE.md`: name `lib/licences.generated.ts` beside the other generated files `check`
  verifies. Nothing more.
- `npm run shots` regenerates `design/screens/` (About changes). If the capture script
  already captures other sheets open, the licences sheet gets one too, with a line in
  `design/SCREENS.md`.
- The PR flags the About change (guardrail 7): it adds to what About states and
  contradicts nothing.

## 6. Follow-up

#160, in **Stabilisation**: "Native libraries' licence notices in the Licences sheet",
carrying the two routes and their costs — a hand-curated list with a drift check over the
podspecs and `build.gradle` files in `node_modules`, or build-time generation (CocoaPods
acknowledgements, Google's `oss-licenses` plugin) at an EAS build per check.

## Acceptance

- The 2.0.0 binary shows the Unicode notice and every bundled JavaScript package's notice.
- The list is generated, and `npm run check` fails when it is stale.
- `npm run check` passes.
