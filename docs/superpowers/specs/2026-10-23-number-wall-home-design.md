# The number-wall Home (#181)

Step 7 of #174. The design is the canvas
([Handoff page, **Home**](https://claude.ai/artifact/9wopqyRq53dok9ZYqGPT8X); its `state` tweak
shows returning and first run) plus the issue's body. The canvas is dark only, so light is built
from the palette roles. Variant B, the poster, is #185 and not built here.

## The screen

One fixed screen, no scroll, on `background`. Back to front:

1. **The number wall,** under everything, from just below the top bar: four rows of shirt
   numbers in Archivo ExtraCondensed Black, 150 pt, rows 129 pt apart (the canvas's 0.86 line
   height). Each number is outlined in a new `wallLine` role, 1.5 pt, with no fill, except three
   filled ones as the canvas draws them: 7 in row 1 and 19 in row 4 in `textPrimary`, and 10 in
   row 2 in `mark`. Rows 1 and 3 drift left, rows 2 and 4 drift right. The wall is hidden from
   screen readers and takes no touches.
2. **Two fades** in `background`: the top one under the status bar and top bar, and a skirt over
   the bottom block, so the wall fades into the ground above the headline. The skirt belongs to
   the bottom block, not to the wall, so on a short phone the wall still fades out above the
   buttons rather than behind them.
3. **The top bar,** 44 pt: the mark (28 pt, `mark`) and "escuadra" in Archivo SemiExpanded
   ExtraBold 21 pt (`textPrimary`), spoken "Escuadra" as a header, as today; on the right the
   Settings gear from #175, unchanged.
4. **The bottom block,** pinned above the bottom inset:
   - **"KNOW EVERY NUMBER."**, Archivo SemiExpanded ExtraBold 34 pt capitals, `textPrimary`.
     It wraps where the language needs it to.
   - **Returning** (a last-played team still in the data):
     - **Continue:** a full-width `ctaBg` pill, at least 68 pt tall. In it: the team's flag
       (34 × 23) or club marker; "CONTINUE SPAIN" in Archivo SemiExpanded ExtraBold 17 pt
       (`ctaText`, up to two lines); under it the meta line in IBM Plex Mono 11 pt
       (`ctaMuted`); and on the right a 46 pt circle in `ctaText` holding a play triangle in
       `ctaBg`. A tap opens that team's Difficulty. The meta line is the level Difficulty will
       focus, the nearest level still to clear (else the last), not the level last played:
       - "LEVEL 2 · BEST 6/10" with its best, and a clock and "OUTDATED" after it when that best
         is outdated (#180);
       - "LEVEL 2 · NOT PLAYED YET" before a first round of it;
       - "A LA ESCUADRA" once every level is cleared and the last is a current 10/10.

       Spoken as one button: "Continue Spain, Level 2, best 6 of 10" (ending "outdated" when it
       is), "Continue Spain, Level 2, Not played yet", or "Continue Spain, a la escuadra".

     - **Your squads and All teams,** one 44 pt row: the starred teams, newest first, as 44 pt
       round buttons (`surface`, hairline `border`) each holding the flag or marker at 24 × 16,
       spoken by the team's name, each opening that team's Difficulty. They scroll sideways when
       they don't fit. On the right, always: "All teams ›" (`textSecondary`) to the picker.
   - **First run** (nothing played, or the last team has left the data):
     - **"START TRAINING":** a 60 pt `ctaBg` pill to the picker.
     - Under it, either the starred-teams row as above (a player can star a team before
       playing one), or the hint: a star outline and "Star a team and it waits for you here."
       (Inter Medium 14 pt, `textMuted`, centred). The hint is text, not a control.

Until the progress store has hydrated, the bottom block shows the headline only, so a returning
player never sees first run flash by. In practice the splash covers the wait.

## The drift

The drift is ambient: slow, linear and endless, at 50 pt a second. It is the one animation the
300 ms rule doesn't fit, and the owner approved an exception (2026-10-22). It is written into
`.claude/rules/design-tokens.md`'s Motion section, beside `autoAdvance`. It stops:

- under Reduce Motion, where the wall stands still. It is read live (`components/useReduceMotion.ts`):
  seeded from Reanimated, then following `AccessibilityInfo`'s `reduceMotionChanged`, because
  Reanimated's own hook reads the setting once, at load;
- while the app is in the background (`AppState`);
- while Home is not the focused screen (`useIsFocused`), which the issue doesn't ask for: Home
  stays mounted under the stack, and an unseen animation only costs battery.

It resumes from where it stopped.

## How the wall is drawn

React Native text has no outline, so each number is its own small `react-native-svg` view of one
`<Text>`: `stroke` for the outline, and `fill` for the three filled numbers. The views sit inside
the row's one view, which is translated on the UI thread by Reanimated. Text in an SVG is drawn
once into its view and moved without redrawing. Each number gets its own view because
react-native-svg on Android caches a view as one bitmap: a 2,000 pt row would be about 7,000 px
on a 3.5× phone, past some GPUs' 4,096 px texture limit, and no drawn layer is now wider than a
number.

- **Each row's numbers are laid out in code,** with no measuring at run time. A pure function
  (`lib/numberWall.ts`) places each number at an x from the font's digit advances (Archivo's
  digits are proportional, 375 to 448 units per 1,000, so a token holds all ten, pinned by a test
  against the TTF's `hmtx` table) plus a fixed gap. That
  gives each row an exact loop width `W`, so the loop wraps without a jump.
- **Each row is only as wide as it needs to be:** one loop, plus enough numbers to cover the
  window's width past it. A drawn layer costs memory in proportion to its area, so the canvas's
  26 numbers twice over (about 7,500 pt wide) would cost roughly 35 MB a row on a 3× phone.
  Instead each row loops over ten numbers, and between them the rows show all 26:
  - row 1: 1–10, with 7 filled, drifting left;
  - row 2: 5–14, with 10 filled, drifting right, starting 60 pt into its loop;
  - row 3: 15–24, drifting left, starting 140 pt in;
  - row 4: 17–26, with 19 filled, drifting right, starting 30 pt in.

  The starting offsets are the canvas's, so the rows don't line up. A loop of ten lasts about
  25 seconds.

## Decisions

1. **Continue opens the team's Difficulty,** as the canvas links it (owner, in review of PR
   #195). The level last played is often not the one a player would pick next: Difficulty
   already focuses the nearest level still to clear, so Continue shows that level, or A LA
   ESCUADRA once the squad is done, using the same rule (`focusedLevel`, `isEscuadra` in
   `lib/ladderView.ts`).
2. **A returning player with no starred teams** sees "All teams ›" alone on the right of the row.
   The hint is for first run only, where the canvas draws it. A returning player has already
   seen the star on Difficulty.
3. **A first-run player with starred teams** sees the starred row under START TRAINING in place
   of the hint, because they've done what the hint asks.
4. **The light theme** uses the same roles: `ctaBg` is near-black in light, so Continue and
   START TRAINING are dark pills there, and the wall's outline is the light `wallLine`.
5. **The old Home lockup goes.** The animated stacked wordmark, `homeCascade`,
   `strikeTiming.home`, `celebrationRiseDuration`, `Wordmark`'s `animate`, `stacked` and
   `showTrail`, the "home lockup" carve-out in the Motion rule, and any token or catalog key only
   the old Home read (`home.browseAllTeams`, `sizes.teamDot`, `iconSize.chevronLarge`, …) are
   removed rather than left dead. The launch intro (#182) brings its own timeline.
6. **The new dependency,** `react-native-svg`, is MIT-licensed, sends nothing, and ships in Expo
   Go, so the Home can be tried there. It moves the fingerprint. That is fine on `main`, since
   2.0 is a store build. `lib/licences.generated.ts` is regenerated, so About → Licences lists it.
7. **Difficulty marks a squad done** (owner, in review of PR #195). When the focused card's level
   is a current 10/10, which happens only once every level is cleared and the last is a la
   escuadra, its outline and escuadra corner turn `success` and its status line reads
   "A LA ESCUADRA · 10/10" in `successText` (spoken "Your best, 10 of 10, a la escuadra"). An
   outdated 10/10 stays grey, as #180 draws it, and an 8 or 9 keeps the accent: there is still
   something to chase.

## Text

New keys in `home`, each with a budget in `i18n/budgets.ts` and translated in de, es, fr (France
usage) and it, then reviewed by a native speaker:

- `headline`: "Know every number." (in display capitals)
- `continueTeam(team)`: "Continue {team}" (in display capitals; may wrap)
- `allTeams`: "All teams"
- `starHint`: "Star a team and it waits for you here."

Continue's spoken name joins `continueTeam` to the picker's `bestSpoken` or
`bestOutdatedSpoken` (or `common.level` and `ladder.notPlayed` before a best), so it reads as the
picker's rows do. "a la escuadra" is never translated, so Continue's and Difficulty's
A LA ESCUADRA lines need no new key. `home.startTraining` and `home.continueMeta` stay.
`home.browseAllTeams` goes.

## Not changing

- Nothing new leaves the device: no telemetry event or property, no network call.
- The picker, Settings and the round are untouched, and Difficulty only gains the done state
  (decision 7). Language and theme are changed in Settings, as since #175.
- About is unchanged. Its licence notices regenerate on their own.

## Testing

- **Unit (Vitest):**
  - `lib/numberWall.ts`: positions, loop width, coverage of the window, filled numbers, phases.
  - `lib/homeView.ts`: returning, first run, no starred teams, a starred id or last team gone
    from the data, outdated.
  - The digit-advance token against the TTF.
  - The catalogs, budgets and translations tests.
- **Screens:** `npm run shots` adds `01e-home-returning` (a club to continue, four starred teams)
  and `01f-home-outdated` (an outdated nation, no starred teams); `01-home` becomes first run.
  Home's shots emulate Reduce Motion, so the wall stands still and the PNGs diff cleanly.
  `design/SCREENS.md` is updated.
- **Device:** the PR carries a device checklist: the drift, its stops, and Still works. Screen
  readers and large text go to #187.
