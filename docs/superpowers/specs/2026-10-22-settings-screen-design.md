# Settings screen (#175)

Step 1 of #174, the 2.0 redesign around the round. The design is the canvas
([Handoff page, **Settings**, and the gear in **Home**'s top bar](https://claude.ai/artifact/9wopqyRq53dok9ZYqGPT8X))
plus the issue's body. The canvas is drawn dark only; light is built from the same palette
roles. This spec records the decisions the canvas and issue leave to the build.

## Screens

**Home.** The top bar's About link, language chip and theme toggle go; one gear button
takes their place, on the right: a 44 pt circle in `surface` with a hairline `border`, the
gear glyph in `textPrimary`, spoken "Settings". Everything else on Home stays until #181.

**Settings** (`app/settings.tsx`), a scrolling screen, top to bottom:

| Block       | Content                                                                                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header      | A 44 pt round back button (Study's `BackGlyph`), then the title in Archivo, uppercase                                                                                                                    |
| PLAY        | One card: **Language** row (globe, the resolved language's own name, chevron) opens `LanguageSheet`; **Appearance** (moon, then a three-way control: Match phone / Dark / Light); **Vibration** (switch) |
| PRIVACY     | One card: **Usage statistics** switch, with the line "Anonymous. About says exactly what is sent."                                                                                                       |
| SUPPORT     | One card: the app-icon plate, **Rate Escuadra** and one line, a **RATE** pill button                                                                                                                     |
| COMING NEXT | A dashed card, not tappable: clock, **Exam mode**, one line, a **SOON** chip                                                                                                                             |
| ABOUT       | One card of three link rows: **About Escuadra** (`/about`), **Privacy** (`/about` scrolled to its Privacy card), **Licences** (`LicencesSheet`, opened over Settings)                                    |
| Footer      | The Escuadra mark in `mark` beside the version line from `versionLabel`, centred                                                                                                                         |

Section labels are IBM Plex Mono capitals in `textMuted`. Cards are `surface` with a
`hairline` outline and dividers; the Coming next card has no fill and a dashed `border`
outline. Row icons are `textSecondary`, chevrons `textMuted`.

**About** loses the Vibration and Usage statistics switches and the version line. It keeps
all its text and the Licences row. It reads an optional `section=privacy` route param and,
once laid out, scrolls so the Privacy card's top sits at the top of the scroll view, with no
animation.

## Decisions

1. **Icons are drawn from Views**, in `components/SettingsGlyphs.tsx`, as `ActionGlyphs.tsx`
   draws Study's and Results' marks: gear, globe, moon, vibration (a phone with two side
   bars), bar chart, info, document, book, clock, and a right chevron. There is no icon
   library in the app, and adding one would be a new asset licence, which is the owner's
   decision (`docs/license.md`, Changing the list). `@expo/vector-icons` stays unused. Each
   glyph is a simplification of the canvas's stroke icon on its 24-unit grid that still
   reads at 20 pt.
2. **Appearance** writes `themePreference`: `'system'`, `'dark'` or `'light'`. Match phone is
   back within reach, which the two-state toggle could never offer. The selected option is
   `ctaBg` with `ctaText`, the others `textSecondary` on a `background` track with a
   `hairline` outline. Spoken as a radio group named "Appearance", each option a radio with
   its checked state (and `aria-checked` for react-native-web). The theme changes on the
   tap, with no animation.
3. **Switches** are React Native's `Switch`, as About's are today: on-track `brandBright`,
   off-track `surfaceRaised`, thumb a new shared role `switchThumb` (white). Each is
   labelled by its row's text.
4. **Usage statistics is the switch's new name**, as the canvas has it, replacing "Share
   anonymous usage statistics": the line under it now says it is anonymous. The privacy
   text quotes the switch by this constant, so it follows. In every catalog, the sentence
   changes from switching it off "on the app's About screen" to switching it off "in the
   app's Settings". What leaves the device does not change.
5. **Rate opens the store's own page**, through `openStorePage()` in `lib/storeReview.ts`
   (still the one module that imports store code). Its pure sibling
   `lib/reviewPrompt.ts` gains `storePageUrl(os)`: the App Store's write-a-review page
   (`https://apps.apple.com/app/id6810705505?action=write-review`) on iOS, the Play listing
   (`https://play.google.com/store/apps/details?id=com.tovmassian.escuadra`) on Android, and
   `null` on web, where the button does nothing. `Linking.openURL`, never awaited by the
   screen, errors swallowed. `app.json` stays untouched (no `appStoreUrl`), so the
   fingerprint does not move for this. The OS hands the link to the store app; Escuadra
   sends nothing itself, so no disclosure changes (flagged in the PR all the same,
   guardrail 7).
6. **The version line moves** with its model: `lib/aboutView.ts` becomes
   `lib/settingsView.ts` (and its test), unchanged in behaviour. Its strings move from
   `about.version`/`about.builtIn` to `settings.version`/`settings.builtIn`.
7. **Exam mode** is one accessible text element ("Exam mode, Soon, …"), with no button role
   and no press feedback.
8. **Dead code goes.** `ThemeToggle`, `LanguageChip`, `languageChipCode` (and its test),
   `home.aboutLink`, `home.darkTheme`, `home.languageLabel`, `about.vibration`,
   `about.usageStatistics`, the palette roles `thumbBg`/`thumbIcon`, `sizes.themeToggle`,
   `sizes.themeToggleGlyph` and `sizes.languageChip.minHeight`. `durations.toggle` stays;
   the share sheet and question footer use it.

## Text

A new `settings` namespace in `i18n/en.ts`, each short label with a `≤ N chars` budget
mirrored in `i18n/budgets.ts`: the title, the five section labels, the row labels, the three
Appearance options, the two lines under Usage statistics and Rate, the Rate button, Exam
mode's title, line and SOON chip, the three About rows, the version strings, and the
gear's spoken name (under `home`). _Escuadra_ comes from `i18n/names.ts`.

Every catalog's `about` changes (the moved keys and the privacy sentence), so the About
hash pin in `i18n/__tests__/catalogs.test.ts` is updated, and `de`, `es`, `fr` (France
usage) and `it` are each translated and reviewed by a fresh native-speaker pass until clean.
A change of meaning goes to the owner.

## Privacy pages

`scripts/privacy-pages.ts` renders About's Privacy section into `privacy/2/` on
`gh-pages`. The pages are generated during this work and their diff goes in the PR body.
They are pushed to `gh-pages` only after the PR merges, on the owner's OK (owner, 22 Oct
2026).

## Tokens

New, in `theme/tokens.ts`, and in both palettes where a colour:

- Roles: `switchThumb` and `plateMark` (shared), `soonBg` (the SOON chip's fill, a translucent ink per
  theme).
- Typography: `settingsTitle` (Archivo SemiExpanded ExtraBold 32, uppercase),
  `settingsSection` (Plex Mono SemiBold 12, tracked, uppercase), `settingsLabel` (Inter
  SemiBold 16), `settingsAction` (Archivo SemiExpanded ExtraBold 13, uppercase),
  `soonChip` (Plex Mono SemiBold 10, uppercase).
- Sizes: a `settings` group (row heights 60 and 56, the 44 pt round button, glyph 20,
  chevron 16, plate 48 with a 30 pt mark, footer mark 18, Rate button 40, segment 40) and
  `radii.settingsCard` (22).

Nothing animates that did not before.

## Docs and rules that change with it

`stores/progress.ts`'s comments, `.claude/rules/stores.md` and
`.claude/rules/privacy-telemetry.md` (the opt-out now lives on Settings), the 2.0 spec's §7
Vibration line, `design/SCREENS.md`, and `scripts/capture-screens.mjs`: a new
`01c-settings` capture, and the `--lang` check reads Settings' Language row instead of
the chip, whose sheet capture moves to Settings.

## Testing

Pure logic, test first: `storePageUrl`, the moved `versionLabel`, budgets, the catalog
hash. Screens are checked by `npm run shots` (dark and light) and on a device; the PR
carries the issue's **Still works** list as a device checklist.
