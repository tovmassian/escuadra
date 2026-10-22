# The redesigned team picker (#176)

Step 2 of #174. The design is the canvas
([Handoff page, **Pick your squad — Nations** and **— Clubs**](https://claude.ai/artifact/9wopqyRq53dok9ZYqGPT8X))
plus the issue's body. The canvas also draws the confederation pills (#177), Your squads
(#179) and OUTDATED (#180): those are later steps and are not built here. The canvas is
dark only; light comes from the palette roles. The owner was away for this step and gave
autonomy, so the choices below were made by the session and are open to change in review.

## The screen, top to bottom

One column that scrolls as a whole, as on the canvas:

1. **Top bar:** a 44 pt round back button, which goes to Home (`router.dismissTo('/')`), and,
   on the right, the total squad count in IBM Plex Mono capitals ("253 SQUADS"), counted from
   `listSquads()`, whatever the search or tab.
2. **Title:** "PICK YOUR SQUAD" in Archivo display capitals.
3. **Search field,** restyled: 52 pt, a pill, `surface` with a `border` outline, the glyph
   at 20 pt and 16 pt text. Its behaviour is unchanged.
4. **Tabs:** Clubs / Nations as a two-way control. Each tab shows its count: the squads of
   that kind that match the search (the league filter does not narrow the Clubs count), so a
   search shows its matches on the other tab too. The selected tab is `ctaBg` with `ctaText`,
   its count in a new role `ctaMuted`; the other is `textSecondary` with its count `textMuted`.
5. **League pills** (Clubs only): 40 pt pills. Idle is a `border` outline with
   `textSecondary`; active is `ctaBg` with `ctaText`.
6. **A slot for Your squads** (#179): an empty `View` above the list, with no height.
7. **The list.**
   - **Clubs:** a mono caption, the filter's name and its count ("PREMIER LEAGUE · 20", or
     "ALL CLUBS · 96"), then the clubs as a plain list sorted by displayed name, with no letter
     headings.
   - **Nations:** grouped A–Z. Each group opens with its letter in Archivo ExtraCondensed
     Black, 34 pt. A **letter rail** sits at the right edge and shows the letters that have
     groups. It starts beside the first letter heading, never over the tabs, and rides up
     with the list until it is centred vertically, where it stays. It holds still while a
     finger is on it and catches up on release. Tapping or dragging over it jumps to that
     letter's group. The current letter, of the group at the top of the scroll, is `accentLine` in
     both the rail and its heading; the others are `textMuted` in the rail and `textPrimary`
     as headings.
   - **Empty state:** unchanged ("No teams found", plus "No results for …" when searching).

**A row:** the marker at 40 × 27 with a 5 pt radius and a hairline ring (a new role
`markerRing`). That is the club's bands, or the nation's flag image. Then the name in
Inter Bold 16, on one line with an ellipsis, then a score block on the right:

- **Played:** "LEVEL n" in mono capitals, `textMuted`, over the best score of that highest
  level, "x/10", in Archivo ExtraCondensed Black (24 and 15). The score is `textPrimary`, and
  `successText` when it is 10/10; "/10" is `textMuted`.
- **Not played:** a right chevron, `textMuted`.
- **Still hydrating:** neither, so the row never claims "not played" for a squad with
  progress.

Rows are at least 60 pt tall, divided by `hairline`. The season leaves the row, since the
canvas has none; Difficulty and Study still show it. The old `cleared` green sub-line goes
too: a score is green only at 10/10.

## Decisions

1. **Grouping is pure and localized.** `nationSections(squads, names)` in `lib/pickerView.ts`
   groups the visible nations by the first letter of the displayed name, folded the way
   search folds (accents dropped, upper case): "Ägypten" goes under A, "Égypte" under E. Order
   is `localeCompare` in the app's language, so the groups follow it, as the names do.
   Tested in all five languages against `COUNTRY_NAMES`.
2. **The nations list is a plain `ScrollView`, not a virtualized list.** Each letter heading
   records its `y` on layout, and the rail scrolls to it with no animation. That is exact at
   any OS text size, which fixed-height `getItemLayout` maths is not. At 157 nations and 96
   clubs, rendering every row is cheap: the flags are local PNGs, and the old list was a
   `FlatList` mostly for convenience. The whole page, header included, is that one
   `ScrollView`, as the canvas scrolls.
3. **The current letter** comes from a pure `letterAt(offsets, y)` over the recorded
   offsets, fed by `onScroll` (throttled to 16 ms).
4. **The rail is hidden from screen readers.** Each heading is a header, so VoiceOver's
   rotor and TalkBack's heading navigation already jump by letter, and a column of 10 pt
   letters makes a poor control to swipe through. The rail's touch target is its full
   column, 44 pt wide, and a drag maps `y` to a letter. The letters take no touches, so the
   rail is always the target and its top edge is `pageY - locationY` on grant. The letters
   scale with the OS text size up to `fontScaleCap.rail`, 1.1, so they keep their pitch.
5. **The tabs and pills are new components.** `KindTabs` replaces `SegmentedControl`, whose
   only user was the picker, so it is deleted. `PickerPill` sits beside `FilterPill`, which
   Study keeps with its own look.
6. **Shared, renamed tokens.** Settings' display title and mono caption serve the picker too,
   so `typography.settingsTitle` becomes `displayTitle`, and `settingsSection` becomes
   `monoCaption`. Settings' 44 pt round back button becomes a component, `RoundBackButton`,
   used by both screens, and `sizes.settings.roundButton` becomes `sizes.roundButton`.
7. **`TeamRow` is rewritten** around the score block. Its sizes are new tokens
   (`sizes.pickerMarker` 40 × 27 with a 5 pt radius, `sizes.pickerRow` 60, `sizes.rail` with
   its width and letter height), and `Flag` and `TeamMarker` gain the `picker` size. The flag
   PNGs are 160 px wide, so 40 pt at @3x (120 px) still has headroom.

## Deviations accepted in review

- "/10" stays `textMuted` even at 10/10: only the score turns `successText`.
- Pills are 44 pt touch targets around a 40 pt drawn pill.
- `SegmentedControl` is deleted, and so is `TeamMarker`'s `default` variant: `variant` is
  required, `banner` or `picker`.

## Text

Changed in `picker`, each with a `≤ N chars` budget:

- `title` becomes "Pick your squad" (two lines of display capitals).
- `squadCount(n)` replaces `count`: "253 squads", one and other plural.
- `nationalTeams` becomes `nations`, "Nations".
- `allClubs`, "All clubs", is the Clubs caption with no league picked.
- `listCaption(name, count)`: "{name} · {count}".
- `bestSpoken(level, correct, total)` is the score block's spoken text: "Level 2, best 7 of
  10". The row's spoken name is "{team}, {bestSpoken}" for a played squad, and the name alone
  otherwise.

Removed: `notPlayed`, `played`, `home` (the round back button speaks `common.back`) and
`count`. The `LEVEL n` line is `common.level(n)` with an upper-case style. Each of de, es,
fr (France usage) and it gets a fresh native-speaker review until clean.

## Out of scope

Confederation pills (#177), Your squads content (#179) and OUTDATED (#180). No new
telemetry, network call or dependency. Nothing animates.

## Testing

Pure logic, test first, in `lib/__tests__/pickerView.test.ts`:

- `nationSections` in all five languages, and with a search;
- `letterAt`;
- `kindCounts`;
- `scoreBlock`, the score block's model (played, 10/10, unplayed, hydrating).

Screens are checked by `npm run shots`, in Clubs and Nations, dark and light, with a jump to a
later letter captured. Device checks go in the PR, and the screen-reader ones in #187.
