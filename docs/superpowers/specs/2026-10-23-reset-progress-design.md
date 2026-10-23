# Reset progress: one team, all scores, or the whole app (#197)

Three ways to erase what Escuadra keeps on the phone: start one team over, clear every score,
or reset the app to how it was on first launch. The design is the canvas
([Escuadra — Reset progress](https://claude.ai/artifact/G6hYVuKXgqiQ1qxUbN5oCh)), drawn dark
only; light is built from the same palette roles. This spec records the decisions the canvas
leaves to the build.

## What each one clears

| Stored in `stores/progress.ts`                             | Start one team over | Clear all scores | Reset Escuadra                  |
| ---------------------------------------------------------- | ------------------- | ---------------- | ------------------------------- |
| `bestScores`                                               | that squad's keys   | all              | all                             |
| `lastPlayed`                                               | kept                | yes              | yes                             |
| `starredSquads`                                            | kept                | kept             | cleared                         |
| theme, language, haptics, Study view                       | kept                | kept             | back to their defaults          |
| How-to-play tips state (#183, #184)                        | kept                | kept             | cleared, so the tips show again |
| `telemetryEnabled`                                         | kept                | kept             | **kept**                        |
| `installId`                                                | kept                | kept             | replaced by a new random UUID   |
| `reviewAskedVersion`                                       | kept                | kept             | kept                            |
| Cached player photos (`expo-image` disk and memory caches) | kept                | kept             | cleared                         |

`expo-updates` keeps its own identifier; no reset touches it, and About already lists it
apart from the app's own eleven things.

## Screens

**Difficulty** (`app/team/[squadId]`). Two changes:

- **Study this squad and the source line ("Updated … · Wikipedia") are pinned to the bottom**,
  as Results pins its actions, over a fade from `backgroundClear` to `background`. The ladder
  scrolls under them, with bottom padding so its last item clears them.
- **Start over is a round icon button on Study's right**, as Results places its retry button
  beside Study: the same size and outline as that button, an eraser glyph, no visible text,
  spoken "Start {team} over". The eraser is new in `components/ActionGlyphs.tsx`; Results'
  counter-clockwise `RetryGlyph` means replay, so this action does not reuse it. It shows only
  when the squad has at least one best score, and Study then takes the full width. It opens a
  `Sheet`.

**The team sheet.** The title "Start {team} over?" (the `Sheet` title is text, so no flag); one line,
"{team} goes back to unplayed, as if you had never opened it."; a **Clears** row (best scores,
with each level's score; Home's Continue button is not mentioned, as it follows on its own); a
**Keeps** line (the star, shown only when the squad is starred); a destructive button "Start
over". After it, Difficulty re-renders as never played, with level 1 open.

**Settings** gains a last section, **YOUR DATA**, after ABOUT and above the version line: one
card of two rows, labels in `error`, notes in `textSecondary`.

- **Clear all scores**, "Every team back to unplayed. Settings stay.", with the score count as
  a mono accessory. With no scores, the row is muted and not tappable.
- **Reset Escuadra**, "Everything back to how it was on first launch."

**The Clear all sheet** names the count and the teams ("14 · 5 teams"); it keeps starred
teams and every setting. Its button names the count:
"Clear 14 scores".

**The Reset sheet** lists what it clears (scores and Continue, starred teams with their count,
the four preferences, the tips, cached photos) and what it keeps: "Your usage statistics
choice. Its random identifier is replaced with a new one." Its button reads "Reset Escuadra".
After it, the app replaces the stack with Home in the reset language and theme. The launch
intro does not replay; it stays once per cold launch.

## Decisions

1. **Starting one team over keeps Home's Continue** (owner, 2026-10-23). `lastPlayed` holds one
   team and level, not a history, so clearing it would drop Home to first run even after other
   teams were played. Kept, Continue shows the team at the rung Difficulty now focuses, level 1
   with no best: the round the player most likely wants next. Clear all and Reset Escuadra
   clear it, since nothing is played after them.
2. **Starring is a preference, not progress.** "As if never played" means rounds played, so
   Start one team over and Clear all scores keep the star. Only Reset Escuadra clears it.
3. **A reset never switches usage statistics back on.** Turning a collection back on that the
   user switched off is the one thing a factory reset must not do. Replacing the identifier
   fits a fresh start, and About already says the identifier is random and not linked to the
   user.
4. **`reviewAskedVersion` survives every reset**, as it already survives `reset()`: clearing
   data must not earn a second rating prompt. Nothing on screen mentions it.
5. **Every reset confirms in a `Sheet`**, with real counts, rather than an undo toast: the app
   has no toast, and undoing a reset that has already switched the language would be awkward.
6. **Placement.** The team action sits beside Study, pinned at the bottom of Difficulty, as
   Results places retry; not in the header, which holds back and the star. Your data is the
   last Settings section, where a destructive row is hard to hit by accident.
7. **No telemetry event.** A new event is a disclosure review (`privacy-telemetry`), and a reset
   is not something the product needs to count.
8. **No Cancel button.** Every sheet is the shared `Sheet`, which closes from its ×, the
   backdrop and Android's back; a Cancel under the confirm would be a fourth way.
9. **Settings' icons.** Clear all scores uses the eraser, the same action as Start over at a
   wider scope; Reset Escuadra uses the Escuadra mark, the app itself. No arrow, which means
   replay.
10. **Telemetry follows the new identifier at once.** The TelemetryDeck client is built once per
    launch; after a reset it is pointed at the new `installId`, keeping this launch's session
    code, as About promises one per launch.

## Store

`stores/progress.ts`:

- `reset()` stays as is (it clears `bestScores` and `lastPlayed`) and backs Clear all scores. It
  has no caller today.
- `resetSquad(squadId)` drops the squad's `scoreKey` entries and leaves `lastPlayed` as it is
  (decision 1). The filter is a pure helper in `lib/` for Vitest.
- `factoryReset(installId)` sets every field to its initial value except `telemetryEnabled` and
  `reviewAskedVersion`, and stores the new `installId` it is given. The caller makes the UUID
  with `Crypto.randomUUID()`, as `app/_layout.tsx` does. Clearing the photo caches is the
  screen's call (`Image.clearDiskCache()` and `Image.clearMemoryCache()`; check them against
  the SDK 57 `expo-image` docs).
- No migration: no persisted shape changes.

## Tokens (guardrail 5)

The system has no destructive button. Add `dangerOn`, the text on an `error` fill, to both
palettes: `#12141a` on dark's `#f05653` (about 5.3:1), `#ffffff` on light's `#c23934` (about
5.6:1). Row labels use `error` as text. A contrast test holds both pairs.

## About (guardrail 7)

The owner chose to say it in About (2026-10-23) (owner, 2026-10-24: the app-update identifier
joins the exceptions after review). One sentence follows "Deleting the app deletes
all of it from your device, along with any cached photos." in `en.about`'s "What is stored on
your device":

> You can also erase it in Settings, under Your data: one team's scores, all your scores, or,
> with Reset Escuadra, everything listed above and any cached photos, except your choice about
> usage statistics, the app version that last asked your phone to show a rating prompt, and the
> app-update check's identifier. Reset Escuadra gives usage statistics a new random identifier.

That changes every catalog's `about` in the same PR. Each translation goes through the
language-expert review, the About hash in `i18n/__tests__/catalogs.test.ts` moves, and
`privacy/2/` is regenerated outside the repo and pushed to `gh-pages` after merge, on the
owner's OK. Nothing leaving the device changes, so App Privacy and Data safety stay as they are.

## Text

Every string is in `i18n/en.ts` with a `≤ N chars` budget mirrored in `i18n/budgets.ts`, and
translated in all five catalogs. The team name comes from `squadDisplayName()`. Counts use the
catalogs' plural forms.

## Testing

- Vitest: the squad filter leaves other squads' scores; `resetSquad` leaves `lastPlayed` alone,
  and Home's view then shows that squad's Continue at level 1 with no best;
  `factoryReset` keeps `telemetryEnabled` (on and off) and `reviewAskedVersion`, replaces
  `installId` and returns every other field to its default.
- The `dangerOn` contrast pairs, both palettes.
- `npm run shots`: Settings' end, and Difficulty's end with a score. Add the three sheets to
  `design/SCREENS.md` if the capture script can open them.

## Depends on

**#183 and #184, both merged.** #183 rebuilt Difficulty's Study button as the target of its
third tip, added `tipsSeen` and `tipsSkipped` to `stores/progress.ts` (both survive `reset()`),
and changed About to "eleven things". #184 added the round's and Results' screens to the same
two fields. This builds on them:

- Pinning Study keeps it on screen, so the third tip no longer scrolls to it; the tip still
  points at Study, not at the eraser beside it.
- `resetSquad` and `reset()` keep the tips state; `factoryReset` clears both fields, so every
  screen's How to play shows again. That is also the easy way to re-test the tips.
- About's new sentence follows #183's wording, and the About hash moves again.

## Out of scope

Undo; a per-level reset; a list of teams to reset from Settings; replaying the launch intro;
clearing the `expo-updates` identifier.
