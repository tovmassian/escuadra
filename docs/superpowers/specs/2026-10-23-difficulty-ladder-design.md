# The redesigned difficulty ladder (#178)

Step 4 of #174. The design is the canvas
([Handoff page, **Difficulty**](https://claude.ai/artifact/9wopqyRq53dok9ZYqGPT8X)) plus the
issue's body. The canvas also draws the star (#179) and the OUTDATED scores (#180); those are
later steps. This one builds the `fresh` and `newcomer` states of its `scores` tweak. The canvas
is dark only, so light is built from the palette roles. The owner gave autonomy for this step, so
the choices below were made by the session and are open to change in review.

## The screen, top to bottom

One `ScrollView`. The hero scrolls with the page.

1. **Team hero.** The squad's marker as vertical bands (`bannerBands`, the in-round banner
   rule), full bleed from the top of the window, under the status bar, and under a veil (below).
   In it:
   - **The top bar:** a 44 pt glass back button (`glass`, `glassLine`, chevron in `onPhoto`, the
     same in both themes, as over a photo), and on the right an empty 44 pt slot for the star
     (#179).
   - **The identity row:** the nation's flag image or the club's marker, at the picker's 40 × 27
     with its hairline ring, then the name in Archivo SemiExpanded ExtraBold capitals, 36 pt
     (`textPrimary`, header role). A long name wraps, and the hero grows with it.
   - **The mono line,** in `monoCaption` (`textSecondary`): a nation reads
     "NATIONAL TEAM · 2026 · 26 PLAYERS", a club "PREMIER LEAGUE · 2025-26 · 25 PLAYERS" (its
     league's name as the picker's pill shows it; "UCL" for a UCL-only club).
2. **"THE LADDER",** a `monoCaption` label in `textMuted`.
3. **The rungs,** levels 1 to 3 in order, 12 pt apart. `focusedLevel` picks the card; every
   other rung is compact. A compact rung is always cleared or locked, because the focused level
   is the first unlocked one.
   - **Compact, cleared:** a pressable row (`surface`, `hairline` border, radius 22) holding the
     level number in Archivo ExtraCondensed Black 54 pt, the title in Inter Bold 16, and a score
     block on the right. The score is Archivo ExtraCondensed Black 30 pt with "/10" at 17 pt.
     Under it is a mono label at 10 pt, both in `successText`. At 10/10 the label reads
     "A LA ESCUADRA" and the score and "/10" are `successText`. At 8 or 9 it reads "CLEARED",
     with the score in `textPrimary` and "/10" in `textMuted`. A tap starts that level, as today.
   - **Compact, locked:** the same row with no fill, in `textMuted`: a padlock and the unlock
     hint ("SCORE 8/10 ON L1") in place of the score. It is not pressable.
   - **The focused card:** `surface`, a 1.5 pt `accentLine` border, radius 26. The level number
     in Archivo ExtraCondensed Black 96 pt carries the escuadra corner: a static L of
     `accentLine` bars at its top right. Beside it are a status line in mono 11 pt
     `accentLine` ("YOUR BEST · 6/10", or "NOT PLAYED YET"), the title in Archivo SemiExpanded
     ExtraBold 22 pt capitals, and the description (Inter Medium 14, `textSecondary`). Under
     them is a 56 pt `ctaBg` pill, Play, with a play glyph and "PLAY LEVEL 3".
4. **Exam mode,** beside the ladder rather than on it: a row with a dashed `border` outline,
   the clock glyph, "Exam mode" (`textSecondary`), "The whole squad, on shirt numbers alone."
   (`textMuted`), and the SOON chip as Settings draws it. It is one accessible element, not
   pressable, and has no level number.
5. **Study:** a 56 pt outline pill (1.5 pt `border`), with the book glyph and
   "STUDY THIS SQUAD" in Archivo SemiExpanded ExtraBold 15 pt. It always has this form; the old
   step-down to a text link after level 1 goes.
6. **"Updated 14 Oct 2026 · Wikipedia",** centred, `secondarySmall`, `textMuted`.

**Newcomer:** level 1 is the card ("NOT PLAYED YET"), and levels 2 and 3 are locked rows.

## Decisions

1. **The hero's veil is computed, as the stage's is.** The canvas fades Armenia's dark bands
   into the ground. On Real Madrid's white, or in light theme over a black band, the same fade
   leaves the name and mono line unreadable. The veil ink is the palette's `background`, laid
   down in two layers:
   - **Behind the top bar,** a gradient from the theme's floor
     (`ladderHero.veilFloor[theme]`) to the text alpha.
   - **Behind the identity row and the mono line,** a gradient from the text alpha to solid
     ground.

   `heroTextAlpha(bands, theme)` in `lib/stageView.ts` is the least alpha, in hundredths and
   never below the floor, at which `textSecondary` holds 4.5:1 and `textPrimary` holds 3:1 over
   every band. It is pure, so it is unit-tested against black and white bands in both themes.
   The two layers sit behind their own rows, so the guarantee holds however tall a wrapped name
   makes the hero.

2. **Level 3's description follows `squad.kind`.** The catalog's one level-3 description
   becomes two: `descriptionNation` ("…, then club.") and `descriptionClub`
   ("…, then nationality."). `levelDescription(level, kind, messages)` in `lib/ladderView.ts`
   picks one.
3. **"A LA ESCUADRA" comes from `i18n/names.ts`** and is never translated. "CLEARED" is a new
   key.
4. **Exam mode's strings move from `settings.examMode` to a top-level `examMode`.** Settings
   and Difficulty share them. No text changes, so no new translation.
5. **Play's label is "Play level n" for every level, played or not.** The canvas shows no
   "Play again". `ladder.play` and `ladder.playAgain` go.
6. **Spoken names:**
   - A cleared rung is "Name from Number, best 8 of 10, cleared", or "…, best 10 of 10, a la
     escuadra".
   - A locked rung keeps today's `rungLocked`.
   - The card's title is a header; the status line is read as written, so its numbers are
     words: "Your best, 6 of 10".
   - Play is "Play level 3".
   - The hero's bands and veil are hidden. The flag or marker is hidden, because the name
     follows it.
7. **Removed as dead:** `DifficultyRow`, `DifficultyCard`, `LadderBadge`, `LadderConnector`,
   `BestPill`, the tokens only they use, and `ladder.title`, `ladder.best`, `ladder.play` and
   `ladder.playAgain` in every catalog. `LockGlyph` stays if the locked row uses it, and goes
   otherwise.
8. **No motion.** Rungs and buttons dim to `opacity.settled` while pressed, as other rows do.
   Nothing animates, so Reduce Motion has nothing to change.
9. **Nothing new leaves the device.** No telemetry event or property, no network call, no
   dependency. `verified` is unchanged: the screen still claims nothing about the data beyond
   "Updated … · Wikipedia", its source and date.

## New copy (en, with budgets)

| Key                                 | English                                               | Budget |
| ----------------------------------- | ----------------------------------------------------- | ------ |
| `ladder.heading`                    | The ladder                                            | 20     |
| `ladder.nationalTeam`               | National team                                         | 16     |
| `ladder.cleared`                    | Cleared                                               | 14     |
| `ladder.notPlayed`                  | Not played yet                                        | 22     |
| `ladder.yourBest(c, t)`             | Your best · 6/10                                      | 22     |
| `ladder.yourBestSpoken(c, t)`       | Your best, 6 of 10                                    | spoken |
| `ladder.playLevel(n)`               | Play level 3                                          | 16     |
| `ladder.rungCleared(title, c, t)`   | Name from Number, best 8 of 10, cleared               | spoken |
| `ladder.rungEscuadra(title, c, t)`  | Name from Number, best 10 of 10, a la escuadra        | spoken |
| `ladder.levels.3.descriptionClub`   | Name from 6 options, then position, then nationality. | wraps  |
| `ladder.levels.3.descriptionNation` | Name from 6 options, then position, then club.        | wraps  |

Every catalog (de, es, fr for France, it) gets them, then a fresh native-speaker review per
language until clean.

## Tests

- `lib/__tests__/ladderView.test.ts`:
  - the ladder for a newcomer, a player part way up, and a player with all three cleared, for
    one club squad and one nation squad (the issue's **Test**);
  - `heroLine` for a nation, a league club and a UCL club;
  - `levelDescription` by kind;
  - the compact rung's label (escuadra at 10, cleared at 8 and 9);
  - the status line and the spoken names.
- `lib/__tests__/stageView.test.ts`: `heroTextAlpha` holds both contrast bars over black and
  white bands in both themes, and never drops below the floor.
- The catalog, budget and translation tests cover the copy.

## Screens

- `04-difficulty`: Real Madrid as a newcomer.
- `04b-difficulty-nation`: Armenia part way, with best scores seeded into the persisted store
  (L1 10/10, L2 8/10, L3 6/10).
- `04c-difficulty-cleared`: a club with all three levels cleared.

Each in dark and light. `design/SCREENS.md` is updated.
