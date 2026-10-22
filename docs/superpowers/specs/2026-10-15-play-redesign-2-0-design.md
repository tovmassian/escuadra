# Escuadra 2.0 — Spotlight play redesign

Ships as **2.0.0, a store build** cut from `main` (`docs/release.md`, "Cut a release"). It adds
native packages and changes what the privacy policy says, so none of it goes over the air
to 1.x. The release order relative to the photo build (#60) is decided outside this spec:
every disclosure below ships in whichever store build first contains its change.

Design canvas: <https://claude.ai/artifact/2P5prLsh9wAsGSkkD4MtwY>. Direction **C ·
Spotlight** was chosen. Boards: rows "C · Spotlight", "C · Round 2", "C · Results and
sharing", "C · Study squad", "C · Motion and haptics", and "Brand step 1" for tokens.
Every C board has Tweaks for theme, squad kind, photo state and accent. The boards use one
real photo (Ferran Torres, cropped from `design/screens`); the others show the fallback.

## What changes

- **Question:** the player's photo fills the top of the screen. The shirt number, the
  question's slots and the answers sit over it in the thumb zone. One layout serves all
  three levels, and every level fits on a 360×640 screen without scrolling.
- **Results:** rebuilt with fewer controls. The missed players become swipeable cards,
  "Study these N" is gone, and a share icon opens a sheet for an image or text share.
- **Study:** the table becomes player cards (or a compact list), with an optional
  Hide names mode for self-testing.
- **Feel:** motion for misses and results, haptics for a pass and a 10/10, a streak
  counter, and a correct answer that moves on by itself.
- **Brand step:** Archivo joins Inter and IBM Plex Mono for numbers and headlines. New
  colour roles for the stage and two contrast fixes.
- **Photos:** 960 px thumbnails, the original's size stored, and a whole round's photos
  loaded when the round starts.

## 1. Decisions

| Decision            | Choice                                                            | Why                                                                       |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Direction           | C · Spotlight                                                     | Chosen over A (card) and B (broadcast) on the canvas.                     |
| Release             | 2.0.0 store build                                                 | New native packages (§4.2); privacy text changes (§10).                   |
| Privacy change      | In this spec, shipped with the build                              | Guardrail 4.                                                              |
| New colour roles    | Added to both palettes as needed                                  | Tokens are not fixed; guardrail 5 still applies.                          |
| Streak colour       | A token, `heat`                                                   | The streak is part of the brand now; it is never a verdict colour.        |
| Level 3 passed      | Close and the main button both choose a different team            | Accepted.                                                                 |
| "Study these N"     | Removed                                                           | The missed cards on Results already are that study list.                  |
| Correct answer      | Moves on after 1,200 ms; tap to skip                              | Faster bursts. A miss always waits.                                       |
| No-photo fallback   | The squad's marker bands, drawn, never a flag image               | Sharp at any size; flag PNGs are 160 px.                                  |
| Share image content | Score, number grid, team colours, link. No player photos or names | No spoilers, and a CC BY-SA photo would need its credit inside the image. |

## 2. Question screen

### 2.1 Layout, top to bottom

1. **Photo stage:** fills the top 68 % of the window (72 % when compact, §2.3), edge to
   edge, behind the status bar. Over it, a top scrim and a bottom gradient into the
   ground (`stageGradients`, §8). Photo `contentFit="cover"`, focal point 50 % / 14 %.
   The status bar is light on this screen in both themes, because it sits on the photo.
2. **Progress:** 10 segments, Stories-style, 3 pt high, 4 pt apart. Past: green or red.
   Current: white until answered, then its verdict. Future: white at 28 %.
3. **Top bar,** 52 pt: close (36 pt glass circle), team name with its banner marker and
   "Level n" beneath, the streak chip (§2.5), and the score pill. The banner keeps the
   in-round rule: vertical bands, `variant="banner"`.
4. **Flexible space.**
5. **Hero cluster:** the shirt number (Archivo ExtraCondensed Black, 152 pt, 112 compact)
   with the escuadra corner at its top right, then the slot chips (§2.2).
6. **Prompt row:** "Who wears 7?", "Position?", "Which club?" or "Nationality?" (Archivo
   SemiExpanded ExtraBold, uppercase, 26 pt, 22 compact), with "2/3" on multi-part levels.
   After the answer it reads "Correct" or "Missed" in the verdict colour.
7. **Answers:** a grid (§2.3).
8. **Footer:** before answering, "Tap your answer" in muted text, where today's inert
   "Select an answer" button was. After a miss, "Got it — next". After a correct answer,
   the auto-next bar (§2.4). The photo credit sits under it for the whole question (§2.7).

### 2.2 Slots: one model for every level

The chips under the number spell out the player. A clue is printed, an asked part is a
slot that fills in as it is answered.

| Level | NAME  | POS   | AGE   | CLUB (nation squad) / NAT (club squad) |
| ----- | ----- | ----- | ----- | -------------------------------------- |
| 1     | asked | given | given | given                                  |
| 2     | asked | asked | given | given                                  |
| 3     | asked | asked | —     | asked                                  |

AGE drops out when the player has no birth date, as today. NAT chips carry the flag image.

Slot states, a pure function of the question, its result and the current part:

| State     | Looks like                            |
| --------- | ------------------------------------- |
| given     | the value                             |
| active    | `?`, accent outline                   |
| pending   | `—`, dashed outline                   |
| correct   | the value, green outline              |
| wrong     | the right value, red outline          |
| not asked | the right value, muted (after a miss) |

This replaces the part rail and the answered-name pill. Invariants 7, 8 and 9 in
`design/SCREENS.md` hold: asking stops at the first wrong part, a slot never turns green
without being answered right, and the question is one scored unit.

### 2.3 Answer grid and fit

Two columns for names, clubs and nationalities; four for positions (code plus "Keeper",
"Defender", "Midfield", "Forward"). 16 pt side padding, 8 pt gaps, `radii.lg` corners.

| Tile height         | Normal | Compact |
| ------------------- | ------ | ------- |
| 4 options (2 × 2)   | 58     | 52      |
| 6 names (2 × 3, L3) | 54     | 48      |
| Positions (1 × 4)   | 64     | 56      |

**Compact** is usable height (window minus safe-area insets) below 700 pt. It replaces
`fitHeroCard` and the `hero*` tokens. Every level and part fits without scrolling at
360×640 (insets 24/16) and 375×667 (20/0) at the default text size.

The answer area keeps a `ScrollView` as a fallback, so a large accessibility text size
pushes content into a scroll instead of off screen. This is how `SCREENS.md` invariant 6
survives, reworded in §12.

Tile verdicts keep today's five states and opacities (`opacity.settled`, `faded`), as
filled glass on dark and white cards on light.

### 2.4 Answer flow

- **Tap:** as today: press scale, a light haptic, instant verdict.
- **Correct, more parts to go:** the slot fills, the next part's options replace the grid
  in place (§6).
- **Correct, last part:** the ball is struck into the corner (§6), and the footer shows "Next
  · tap to skip" with a bar filling over 1,200 ms. Then the round advances.
  Tapping skips the wait. **No auto-advance while a screen reader is on**
  (`AccessibilityInfo.isScreenReaderEnabled`): the footer shows "Next question" instead.
- **Miss:** the right answer is shown, later slots switch to "not asked", and the footer
  shows "Got it — next". It never advances on its own.
- **Last question:** each of these says "See results" instead ("See results · tap to skip"
  on the bar). The bar still moves on by itself.
- **Type:** the button and the bar share `ctaLabel`; filled pill versus filling bar tells
  them apart. `nextButtonText` in `lib/roundView.ts` holds the words.

The 1,200 ms is a pause, not an animation, so it sits outside the 300 ms rule. It is a
token (`durations.autoAdvance`).

### 2.5 Streak

The count of correct answers in a row within the round, from `stores/session.ts`. It shows
from 2, in the top bar, as a `heat` chip with a flame glyph. A miss resets it to 0 and
hides it. It is ephemeral, like the round, and never sent anywhere.

### 2.6 Photo, loading and fallback

- **Photo:** the 960 px thumbnail (§9) when its original is at least 720 px wide. A
  smaller original is **framed** instead: shown whole at 3:4, centred over its own copy
  scaled to fill and darkened. Never stretched full-bleed.
- **No photo, or offline:** the squad's `marker.bands` as full-height vertical bands, under
  a veil. The veil is the stronger of `stage.veil` (0.42 dark, 0.12 light) and the minimum
  that gives white text 3:1 on the lightest band (`stageVeil(bands)`, pure). Real Madrid's
  white must still carry the top bar.
- **Loading:** the fallback with a diagonal shimmer, then the photo crossfades in over
  180 ms (`transition`). The credit shows while loading, so nothing jumps.

A nation is never shown by its flag PNG here. Flags appear only at 22×15, 18×12 and
16×11 pt (answers, NAT chip, Study). That is at most 66 px at 3×, inside the 160 px source.

### 2.7 Credit

The credit line, unchanged in content and component (`PhotoCreditLine`), sits under the
footer action for the whole question. It shows while a photo loads and is absent when there
is no photo. Guardrail 1 holds.

## 3. Results

### 3.1 Layout

1. **Top bar:** close (left) and the share icon in a 44 pt circle (right). The centre says
   "Spain · Level 2".
2. **Score:** Archivo ExtraCondensed Black, 150 pt, with "/10" at 60 pt, muted. The
   escuadra corner at its top right: grey on a fail, accent with a green ball on a pass,
   green with the ball and trail on a 10/10.
3. **Title** (Archivo SemiExpanded ExtraBold, uppercase) and one line of verdict.

   | Tier   | Title                       | Verdict                                |
   | ------ | --------------------------- | -------------------------------------- |
   | fail   | These are the ones to learn | Score 8/10 to unlock level n+1.        |
   | passed | Level n cleared             | You knew most of the starting XI.      |
   | 10/10  | A la escuadra               | Spain · 2026, level n. Nothing missed. |

   On a failed level 3, the verdict reads "Score 8/10 to clear level 3."

4. **Round strip:** the 10 segments, 6 pt, each labelled with its shirt number.
5. **Missed players:** "MISSED · N PLAYERS" and a horizontal, snapping row of player cards
   (§5.2), 140×184 pt. Each shows what was picked: "You picked Marc Pubill", or for a
   later part, "Name right · position is MF, you said FW". A 10/10 shows the ten players
   instead, in 54 pt circles with a green ring.
6. **Actions** (§3.2), then "Photo credits · N", which expands today's credit list.

### 3.2 Actions

`actionOrder` in `lib/resultsView.ts` becomes:

```ts
resultActions(passed: boolean, hasNextLevel: boolean): {
  primary: 'nextLevel' | 'retry' | 'chooseTeam';
  secondary: 'study';
  retryIcon: boolean; // primary !== 'retry'
}
```

| Tier              | Main button           | Secondary        | Retry icon |
| ----------------- | --------------------- | ---------------- | ---------- |
| fail              | Retry this round      | Study this squad | no         |
| passed, level < 3 | Play level n+1        | Study this squad | yes        |
| passed, level 3   | Choose different team | Study this squad | yes        |

Close always chooses a different team. Invariant 10 holds: pass and fail still differ.

## 4. Sharing

### 4.1 Sheet

The share icon opens a bottom sheet: the title "Share your round", an **Image / Text**
switch, and a live preview. Image shows the card; Text shows the message as a chat bubble.
One button, "Share image" or "Share text", hands it to the phone's own share menu, where
WhatsApp, Instagram and the rest appear. No third-party logos are drawn.

### 4.2 Image

`components/ShareCard.tsx` lays out at 360×640 pt:

- the team's bands across the top;
- the Escuadra mark and wordmark;
- "SPAIN · 2026 · LEVEL 2", the score with the corner, and the tier title ("Still
  learning" on a fail);
- 10 rounded squares with the shirt numbers, green filled or red outlined;
- "Can you name Spain's squad?" and `tovmassian.github.io/escuadra`.

It renders off screen and is captured at 1,080×1,920 px. The off-screen copy is laid out at
`1080 / PixelRatio.get()` pt wide, so its native size is the picture's, and `captureRef` takes no
`width` or `height`. Those options are points on iOS but raw pixels on Android. The first draft of
this snippet passed `width: 1080 / PixelRatio.get()`, which gives about 411 px on Android; it was
corrected in #114.

```ts
const uri = await captureRef(ref, {
  format: 'png',
  quality: 1,
  result: 'tmpfile',
});
await Sharing.shareAsync(uri, {
  mimeType: 'image/png',
  UTI: 'public.png',
  dialogTitle: 'Share your round',
});
```

New packages, both through `npx expo install`: `react-native-view-shot` (`captureRef`) and
`expo-sharing`. Both are native, so the fingerprint moves: a store build.

`expo-sharing` shares a file only, so the image carries the link itself. On web
(`npm run shots`) the sheet renders, but the share button does nothing.

### 4.3 Text

Unchanged: `formatShareText` and React Native's `Share.share({ message })`.

## 5. Study

### 5.1 Screen

- **Header:** back, a "Hide names" toggle, a grid/list toggle, then the team banner, the
  season, "SQUAD" and a count ("26 players", or "9 of 26" when filtered).
- **Filters:** today's All / GK / DF / MF / FW pills, now with counts. Sorted by shirt
  number.
- **Grid** (default): two columns of player cards, 218 pt tall (§5.2).
- **List:** 64 pt rows with a 46 pt avatar (photo, or bands and number), number, name,
  club or flag and nationality, and the position. The grid/list choice persists in
  `stores/progress.ts` as `studyView`.
- **Hide names:** photos and numbers stay, each name becomes a dashed "Tap to reveal"
  pill, and a tap reveals it. Turning it off or on clears the reveals. Not persisted.
- **Photo credits:** "Photo credits · N" at the end of the list, as on Results. Each row
  names the photo by shirt number only, so Hide names is not spoiled.
- **Lists are virtualised** (`FlatList`, two columns in the grid). Photos load as cards
  mount (`expo-image`, `recyclingKey` = player id), never all at once.

The `players` and `level` params, the "Missed Players" title and the retry button go. So
do `parsePlayerIds` and `parseLevel` in `lib/studyView.ts` if nothing else uses them.
`study.opened` is unchanged: Hide names and the view toggle are not tracked.

### 5.2 Player card

One component for Results and Study: photo, or bands under the veil; the shirt number at
the top left (Archivo ExtraCondensed Black, 44 pt); the position chip at the top right on
Study; a bottom gradient; the name and one line beneath it.

## 6. Motion

Every mid-round animation finishes within 300 ms. Beats may chain: a goal's shot, then
the corner's kick and ring, end about 640 ms after the tap. That is inside the 1,200 ms
auto-advance pause (§2.4), so a round takes no longer. Results keep the celebration carve-out,
with timings below at `MOTION_TIME_SCALE` 1. With Reduce Motion on (Reanimated
`useReducedMotion`), nothing shakes, bounces, slides or scales: colour and opacity only,
150 ms.

| Moment           | At      | What                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Press            | tap     | Tile to 0.97, 100 ms (today).                                                                                                                                                                                                                                                                                                                      |
| Correct          | 0       | Tile fills green, 180 ms; pop 1.04 → 1 (100 + 120). Others fade to 50 %.                                                                                                                                                                                                                                                                           |
|                  | 60      | Slot chip turns green and crossfades to the answer, 180 ms.                                                                                                                                                                                                                                                                                        |
|                  | 80      | The shot: a ball leaves the tapped tile at 1.7× the corner's ball, swells at the top of its arc and slows into the corner through its open, lower-left side, landing at the corner's ball size. One of Curler, Driven, Dipping lob or Trivela, never the same twice running, 213–291 ms. A trail of three fading balls follows it (`lib/shot.ts`). |
|                  | 293–371 | It lands: the corner turns green and kicks (240 ms), a ring flashes out from the ball (300 ms), and the ball settles under the crossbar (140 ms) and stays.                                                                                                                                                                                        |
|                  | 120     | Streak chip 1 → 1.15 → 1, 180 ms; digit rolls up.                                                                                                                                                                                                                                                                                                  |
|                  | 300     | Auto-next bar fills linearly over 1,200 ms.                                                                                                                                                                                                                                                                                                        |
| Next part        | —       | Old tiles fade out 120 ms; new rise 8 pt and fade in 150 ms, 20 ms apart. Next slot's outline pulses 1 → 1.06 → 1, 200 ms.                                                                                                                                                                                                                         |
| Miss             | 0       | Picked tile turns red and shakes ±6 pt, three swings, 240 ms.                                                                                                                                                                                                                                                                                      |
|                  | 60      | Right answer: green outline, pop 1.03, ANSWER tag fades in, 150 ms. Others fade to 35 %. Slots switch.                                                                                                                                                                                                                                             |
|                  | 80      | The shot goes wide, right or left: Wide right, Wide left, Sliced right or Dragged left, never the same twice running. It keeps its pace (299 ms) and leaves the screen, never within 28 pt of the corner. The corner turns red as it goes by, at about 185 ms. The frame never moves.                                                              |
|                  | 100     | Photo dims 10 %, 180 ms.                                                                                                                                                                                                                                                                                                                           |
|                  | 120     | Streak chip shrinks to 0.8 and fades out, 150 ms.                                                                                                                                                                                                                                                                                                  |
|                  | 140     | "Got it — next" rises 8 pt and fades in, 160 ms.                                                                                                                                                                                                                                                                                                   |
| Next question    | —       | Content slides 16 pt left and fades, 150 ms. Next photo crossfades 180 ms; number rises 12 pt; chips 30 ms apart; tiles 25 ms apart. Done by 300 ms.                                                                                                                                                                                               |
| Results, all     | 0       | Round strip fills left to right, 120 ms each, 40 ms apart; the score counts up with each green segment.                                                                                                                                                                                                                                            |
| Results, fail    | 300     | Corner stays grey, no ball. Title rises 12 pt, 220 ms; missed cards slide in from the right, 60 ms apart.                                                                                                                                                                                                                                          |
| Results, passed  | 480     | Corner draws and the ball strikes in (`strikeTiming.passed`).                                                                                                                                                                                                                                                                                      |
| Results, 10/10   | 480     | Full strike with trail and flash (`strikeTiming.excellent`); score pops 1.15 → 1; the ten circles pop in 40 ms apart.                                                                                                                                                                                                                              |
| Results, actions | last    | Buttons rise 12 pt, 40 ms apart (today's cascade).                                                                                                                                                                                                                                                                                                 |
| Share sheet      | —       | Scrim 200 ms; sheet slides up 240 ms, no overshoot. Switch pill slides 160 ms; preview crossfades 150 ms.                                                                                                                                                                                                                                          |
| Study            | —       | Cards fade in as they mount, 150 ms. A reveal crossfades the name in, 180 ms.                                                                                                                                                                                                                                                                      |

## 7. Haptics

`lib/haptics.ts` is the only module that imports `expo-haptics`. Screens call
`feedback(moment)`, which checks the setting and picks the platform call. On Android it
uses `performAndroidHapticsAsync`, which Expo recommends over the vibrator API. Check the
minimum Android version for each constant. Where one is unsupported, fall back to the iOS
column's call, which goes through the vibrator.

| Moment               | iOS                                                                                                 | Android                            | Today |
| -------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------- | ----- |
| Tap an answer        | `impactAsync(Light)`                                                                                | `Virtual_Key`                      | yes   |
| Correct pick         | `impactAsync(Medium)`                                                                               | `Confirm`                          | yes   |
| Wrong pick           | `notificationAsync(Warning)`                                                                        | `Reject`                           | yes   |
| Streak hits 5 or 10  | `impactAsync(Soft)`                                                                                 | `Segment_Tick`                     | new   |
| Round passed         | `impactAsync(Soft)` as the ball lands                                                               | `Confirm`                          | new   |
| A la escuadra        | `notificationAsync(Success)` as it lands, then two `impactAsync(Light)` 60 ms apart, with the trail | `Confirm`, then two `Segment_Tick` | new   |
| Reveal on Study      | `impactAsync(Light)`                                                                                | `Virtual_Key`                      | new   |
| Fail, share, buttons | none                                                                                                | none                               | —     |

A **Vibration** switch on the Settings screen (#175), on by default, persists as `haptics` in
`stores/progress.ts`. The iOS system setting and Low Power Mode still apply. Haptics never leave the device; no
disclosure.

## 8. Tokens and type

All in `theme/tokens.ts`; both palettes implement every new role.

| Role / token                                 | Dark                                                                    | Light                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `textMuted` (changed)                        | `#868b91` (was `#767b80`, 4.3 → 5.4:1)                                  | `#686c73` (was `#8b8f96`, → 4.9:1)                                      |
| `heat` / `heatBg` / `heatLine` (new, shared) | `#ffaa3c` / 20 % / 50 %; text `#ffc27a`                                 | same: it sits on the photo                                              |
| `glass` / `glassLine` (new, shared)          | `rgba(15,17,23,0.42)` / `rgba(255,255,255,0.18)`                        | same: on the photo                                                      |
| `tile` / `tileLine`                          | white 8 % / white 16 %                                                  | `#ffffff` / `#dcdfe4`                                                   |
| `onStageMuted`                               | white 62 %                                                              | `#686c73`                                                               |
| `ctaBg` / `ctaText`                          | `#f3f5f7` / `#12141a`                                                   | `#14161a` / `#ffffff`                                                   |
| `stageGradients` (per theme)                 | scrim 60 % → 0 at 20 %; ground 0 at 34 % → 88 % at 62 % → 100 % at 74 % | scrim 55 % → 0 at 20 %; ground 0 at 30 % → 94 % at 48 % → 100 % at 56 % |
| `stage.veil`                                 | 0.42                                                                    | 0.12                                                                    |

`accent` (`#3e45a3`) and the brand ramp stay. On dark the accent ink for outlines is
`brandSoft`; on light, `accent`. Volt (`#c6f432`) stays an exploration: not in 2.0.

**Typography,** new entries: `shirtNumber` (Archivo ExtraCondensed Black 152/112,
lineHeight 0.78), `scoreDisplay` (same face, 150), `cardNumber` (same face, 44),
`prompt` (Archivo SemiExpanded ExtraBold, 26/22, uppercase), `titleDisplay` (same face,
25), `ctaLabel` (same face, 16, uppercase), `tileCode` (Archivo Black, 22). The `hero*`
entries go.

**Archivo.** `@expo-google-fonts/archivo` ships normal width only, and React Native
cannot set a variable font's width axis. So the three cuts are static instances,
generated once from Google Fonts' variable `Archivo[wdth,wght].ttf` with fontTools:

```bash
fonttools varLib.instancer "Archivo[wdth,wght].ttf" wdth=62.5 wght=900 --update-name-table -o Archivo-ExtraCondensedBlack.ttf
```

Likewise `wdth=112.5 wght=800` (SemiExpanded ExtraBold) and `wdth=100 wght=900` (Black).
`--update-name-table` gives each cut its own PostScript name, without which iOS registers
only the first. It needs a width the font's STAT table names, which for ExtraCondensed is
62.5, not the axis floor of 62.
They are committed to `assets/fonts/archivo/` with `OFL.txt` and a README recording the
source commit and the commands, as `assets/flags/README.md` does. They are registered in
`theme/fonts.ts`. Check `OFL.txt` for a Reserved Font Name before naming the instances. Add
Archivo (SIL OFL 1.1) to `docs/license.md`.

**Sizes, radii, durations.** These are new:

| Group     | Entries                                                                                                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sizes     | `stage` ratios (0.68 / 0.72), `segment` (3 question, 6 results), `corner` (24/6 question, 40/10 results), tile heights (§2.3), `cta` 52/48, `glassButton` 36, `playerCard` (218; 140×184 on Results), `avatar` 46 |
| Radii     | `sheet` 28                                                                                                                                                                                                        |
| Durations | `shake` 240, `shotFlight` 260 (× each shot's pace), `shotSettle` 140, `cornerShake` 240, `ring` 300, `pulse` 200, `segmentFill` 120 (+ 40 stagger), `sheet` 240, `autoAdvance` 1,200 (a pause, see §2.4)          |

`design/tokens.ts` re-exports, so the handoff stays in step.

## 9. Photo resolution and loading

**Resolution.** Today 1,865 of 2,197 photos are 500 px thumbnails
(`THUMB_WIDTH = 500` in `tools/squadctl/src/lib/photo-credit.ts`), sized for the old 220 pt
hero. Another 331 are originals Commons serves unscaled, so smaller than 500 px. The
spotlight needs about 780 px at 2× and 1,170 px at 3×.

- **Request 960 px.** It is a Commons standard width; the photo POC measured 463 KB against
  119 KB at 500 px for Pedri. It covers 2× and comes close at 3×, under the gradient.
- **Store the original's size.** `iiprop=url|size|extmetadata`; `PhotoCredit` gains
  `width` and `height` (of the original). The app uses them for the framed layout (§2.6).
- **Re-run `squadctl enrich`** and regenerate the data.
- **Update the `PhotoCredit.url` comment** ("A 500 px thumbnail…") and any test that pins 500. `lib/dataIntegrity.test.ts` now requires the original's size, and the 960 px thumbnail for an original at least that wide.

**Loading.** Today only the next question's photo is loaded ahead (`Image.prefetch` in
`app/play/[squadId]/[level]/index.tsx`).

- **When a round starts,** prefetch all ten of its photos in question order:
  `Image.prefetch(urls, { cachePolicy: 'disk' })`, verified on the SDK 57 docs. Its
  result is ignored: it resolves `false` as soon as any image fails, and a failure only
  means a fallback shows a moment longer.
- **The per-question prefetch goes.**
- **Never prefetch a whole squad;** Study loads cards as they mount.
- **Data cost** is about 2–4 MB for a squad's first round at 960 px. After that, the disk
  cache serves repeats.

## 10. Privacy and store declarations

Each change ships in the store build that contains it. The About text and the published
`privacy.html` on `gh-pages` must match word for word (guardrail 4).

1. **Photos are loaded differently.** In About's "Player photos", the first paragraph
   becomes:

   > Escuadra does not ship player photos. They are loaded from Wikimedia Commons, run by
   > the Wikimedia Foundation: the ten photos for a round when the round starts, and a
   > squad's photos on the Study screen as you scroll. Like any website, Wikimedia receives
   > your device's IP address and the details of each request, including which photos were
   > asked for, and so which players are in your round or squad. Escuadra sends nothing
   > else to Wikimedia, and Wikimedia's own privacy policy applies to what it receives.

   In the second paragraph, "shows the shirt number instead of a photo" becomes "shows the
   team's colours and the shirt number instead of a photo".

2. **Sharing.** A new paragraph after the photo credits one:

   > Sharing a result creates a picture or a short text on your device and passes it to the
   > app you pick in your phone's share menu. Escuadra does not see, send or keep what you
   > share.

3. **Telemetry.**
   - `result.shared` gains `format: 'image' | 'text'` in `TELEMETRY_EVENTS` and its
     test.
   - **Text** is tracked as today, on `Share.sharedAction`.
   - **Image** is tracked when `shareAsync` resolves: Expo cannot tell whether it was
     sent.
   - **About text:** "a result was shared, with the level and score" becomes "a result was
     shared, with the level, the score and whether it was shared as a picture or as text".

4. **What is stored on the device.** About's "What is stored on your device" list counts what `stores/progress.ts` persists. #113 adds whether vibration is on (seven things); #115 adds the Study view choice (eight). Each change goes into the About text with its PR and into `privacy.html` with the build.

5. **Store answers.**
   - The new property sits in the category already declared for TelemetryDeck (App Privacy
     "Product Interaction", Data safety "App interactions"). Re-confirm; no change is
     expected.
   - The photo traffic is the Wikimedia disclosure #55 adds. Same hosts, more requests: no
     new category.

Haptics, the streak, Hide names, the Vibration switch and `studyView` never leave the device; whatever part of them is stored is counted in item 4.

## 11. Code map

**New:**

- **Components:** `SpotlightStage` (photo, framed, fallback, loading, gradients),
  `RoundProgress`, `SlotChip`, `AnswerTile` (replaces `AnswerOption` and `ChipOption`),
  `EscuadraCorner` (corner and ball, from `theme/brand.ts` geometry), `StreakChip`,
  `PlayerCard`, `ShareSheet`, `ShareCard`, `ShotOverlay` (the shot and its trail).
- **Libraries:** `lib/haptics.ts`, `lib/share.ts` (capture and hand-off).
- **Pure helpers:** `lib/roundView.ts` gains `slotStates`, `answerLayout` and `streak`;
  `lib/stageView.ts` gets `stageVeil` and `photoLayout`; `lib/shot.ts` plans the shot
  after a question is decided (#129).

**Changed:**

- **Screens:** `app/play/[squadId]/[level]/index.tsx` and `results.tsx`,
  `app/team/[squadId]/study.tsx`, `app/about.tsx` (text, Vibration switch).
- **Libraries:** `lib/resultsView.ts` (`resultActions`), `lib/studyView.ts`,
  `lib/telemetryEvents.ts`.
- **Stores and theme:** `stores/progress.ts` (`haptics`, `studyView`), `stores/session.ts`
  (round prefetch trigger), `theme/tokens.ts`, `theme/fonts.ts`.
- **Types and tooling:** `types/squad.ts` (`PhotoCredit.width/height`), squadctl enrich.

**Removed:** `HeroCard`, `HeroTabFillet`, `PartRail`, `CompletedPartPill`, `StudyRow`,
`ProgressDots`, `fitHeroCard`, `heroTabMetrics`, and the `hero*` tokens. Remove `StatChip`
too if nothing else uses it.

## 12. Guardrail and doc updates (same PRs)

- **`CLAUDE.md` guardrail 1:** the photo fills the top of the question screen behind the
  number; with no photo, or while it loads, the team's colours and the number show. The
  credit rule is unchanged.
- **`CLAUDE.md` architecture:** motion rule: name `durations.autoAdvance` as a pause
  outside the 300 ms rule. Telemetry: the new `format` property.
- **`CLAUDE.md` data model:** `PhotoCredit` carries the original's width and height.
- **`design/SCREENS.md`:**
  - invariant 1 (photo and credit) and invariant 6 ("parts fit without scrolling at
    360×640; a scroll remains for large text sizes");
  - invariant 10's wording (the CTA table in §3.2);
  - the Study and Results descriptions;
  - regenerate `design/screens` (`npm run shots`), then `shots:store`, `shots:play` and
    `gen:play-assets` for the 2.0 listing.
- **`docs/license.md`:** Archivo.
- **Small fix:** the stale `theme/tokens.ts` comment that says flag PNGs are 70×46: they
  are 160×107.

## 13. Testing

- **Pure, Vitest:**
  - `slotStates` for every level, part and verdict, including "not asked" after a miss.
  - `answerLayout` heights and compact switching.
  - `streak`.
  - `resultActions` (the table in §3.2).
  - `stageVeil`: Real Madrid's white band reaches 3:1.
  - `photoLayout` (720 px threshold).
  - `formatShareText` unchanged.
  - The telemetry allowlist with `format`.
- **Data:** integrity accepts 960 px thumbnails and requires `width`/`height` on every
  photo.
- **Fit, by hand on simulators:** 360×640 Android, iPhone SE (375×667), iPhone 17 at every
  level and part, in both themes. Then at the largest text size, where the scroll fallback
  must keep every option reachable.
- **Behaviour:**
  - Auto-advance is off with VoiceOver/TalkBack.
  - Reduce Motion removes shake, bounce and slides.
  - The Vibration switch silences every haptic.
  - Offline play shows the fallback everywhere and nothing errors.
- **Share:** the image is 1,080×1,920 and opens in the share menu on both platforms. Text
  is unchanged.

## 14. Delivery

One milestone, [v2.0.0](https://github.com/tovmassian/escuadra/milestone/5), as issues in
this order. Each leaves `main` working and makes its own §12 doc updates in its own PR.

1. **#111 Tokens, Archivo instances, the contrast fixes** (`textMuted`), `docs/license.md`.
2. **#112 Photo data:** squadctl 960 px and original size, the data re-run, `PhotoCredit`,
   tests.
3. **#113 Question screen:** stage, slots, grid, flow, streak, motion, `lib/haptics.ts`,
   round prefetch.
4. **#114 Results and sharing:** layout, `resultActions`, share sheet and image, telemetry
   `format`, the About and `privacy.html` text.
5. **#115 Study:** cards, list, filters with counts, Hide names, credits, removal of the
   missed view.
6. **#116 Docs and assets:** a consistency pass over `CLAUDE.md` and `SCREENS.md`,
   screenshots, store assets, the `app.json` version bump to 2.0.0 and the release branch.

## 15. Decided on 2026-10-15

- **Hide names** and the **list view** on Study stay in scope (#115).
- **Auto-advance on a correct answer** is confirmed (#113).
- **`MOTION_TIME_SCALE`** goes back to 1 in #114, so §6's timings hold. It is 1.8 on
  `main` today.
