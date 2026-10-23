# How to play: tips on the picker, Difficulty and Study (#183)

Part of #174, step 9. Design: the 2.0 canvas, **How to play** page, artboards **Tips · Pick
your squad (2)** (`CoachTeams`), **Tips · Difficulty (3)** (`CoachDifficulty`) and **Tips ·
Study (2)** (`CoachStudy`), with the **Rules** and **Build notes** notes beside them. The
handoff (`docs/superpowers/handoff/2026-10-16-2-0-redesign-handoff.md`) binds the rest of the
look. #184 adds the question and Results tips on the same layer.

## What it is

The first time someone opens the picker, Difficulty or Study, a short run of tips walks them
through it. Each tip dims the screen, cuts out the control it is about, rings it, points at it
with a short arrow, and says what it does:

- **Kicker:** `HOW TO PLAY · i/n`, mono, in `accentLine`.
- **Heading** in display capitals, then **one line** of body.
- **Step dots** (the current one long) and **Next**, or **Got it** on the last tip.
- **Skip tips**, a pill at the top left, over the scrim.

A tap anywhere moves to the next tip. Got it ends the screen's tips. Skip tips ends the tips on
every screen for good. There is no "Show tips again" (owner, 2026-10-22). Never on Home or
Settings.

## The tips

| Screen     | #   | Target                               | Heading                | Body                                                                                     |
| ---------- | --- | ------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------- |
| Picker     | 1   | The Clubs/Nations tabs and the pills | CLUBS OR NATIONS       | Switch here, then narrow it down by league or confederation.                             |
| Picker     | 2   | The first team row                   | PICK A SQUAD           | Tap any team to see its levels and start.                                                |
| Difficulty | 1   | The focused card's Play              | START HERE             | You get a shirt number and a few clues, and pick the name. Score 8/10 to unlock level 2. |
| Difficulty | 2   | The Your squads star                 | MAKE IT YOURS          | Star a team and it waits for you on Home.                                                |
| Difficulty | 3   | Study this squad                     | OR STUDY FIRST         | Browse the whole squad. Hide the names to test yourself.                                 |
| Study      | 1   | Hide names                           | TEST YOURSELF          | Hide the names, then tap a card to check yourself.                                       |
| Study      | 2   | The position filters                 | ONE POSITION AT A TIME | Learn the keepers, then the defence, the midfield and the attack.                        |

The picker's first row is the first starred team when Your squads shows, else the first row
of the list. Headings are stored in sentence case and set in capitals by the style, like the
rest of the 2.0 display text.

## The layer

`components/TipsLayer.tsx`, one component, rendered last inside each screen's root so it
covers the screen. It takes the screen's tips (each a ref to its target, its copy and its
corner radius) and, for Difficulty, a way to scroll.

- **Scrim with a cut-out.** One `react-native-svg` path, full screen with a rounded-rect hole
  (`fillRule="evenodd"`), in a new `tipScrim` role. The hole is the target itself (`cut` in
  `TipPlacement`, with the target's own radius), not outset: the `tips.gap` (5 pt) between the
  target and the ring stays scrim-dark, as the canvas draws it. Drawn in SVG, not a 3000 pt
  box shadow as the canvas does, so it is exact on iOS, Android and web.
- **Ring.** A 2 pt `accentLine` stroke on a rounded rect `tips.gap + 1` outside the target.
- **Arrow.** A short curved stroke with an open head, in `textPrimary`, between the tip and
  the target, pointing at it. Mirrored when the target sits right of centre. Decorative.
- **The tip.** Laid out at the screen's gutters, under the target when it fits, else over it.
  A soft backing (`tipBacking`, with a wide blurred `boxShadow` of the same colour) sits behind
  the text so the dimmed screen never shows through it.
- **Skip tips** at the top left, under the safe area, in `surfaceRaised` with a `border` line.

**Measured, never fixed.** Each target is measured with `measureInWindow`, and the layer's own
origin the same way, so the hole lands on the real control whatever the safe areas, the
language or the text size. The first measure waits until two frames agree (a push transition
is still moving the screen), capped at `tips.settleCap` (600 ms), then shows what it has.
Placement is a pure function, `placeTip` in `lib/tips.ts`: given the target box, the screen
size, the safe areas and the tip's measured height, it returns the hole, the ring, the tip's
top, which side it is on, and the arrow's position and direction. The tip is laid out hidden
once to learn its height, then placed.

**Below the fold.** When the target, its ring and the tip together don't fit between the safe
areas, `scrollDelta` (pure, in `lib/tips.ts`) says how far to scroll, and the screen's
`scrollBy` does it without animation, under the fading tip; then the target is measured
again. Only Difficulty's Study button needs it today, on a short phone or at a large text size.
The picker passes its scroll too, for its first row at 360 × 640 with large text.

## State

In `stores/progress.ts`, persisted, and surviving `reset()` like the other preferences:

- `tipsSeen: TipScreen[]`, the screens whose tips have shown. `TipScreen` is
  `'picker' | 'difficulty' | 'study'`; #184 adds its own.
- `tipsSkipped: boolean`.
- `markTipsSeen(screen)` and `skipTips()`.

`shouldShowTips(screen, tipsSeen, tipsSkipped)` in `lib/tips.ts` is the pure decision. A screen
shows its tips only once the store has hydrated, so a returning player never sees a flash of
them. Persisted fields added with defaults need no `version` bump: `persist` merges them over
the initial state.

**Calls:**

- **A screen is marked seen when its first tip shows**, not on Got it. Leaving mid-way (an
  edge swipe back, the app killed) never brings them back: "once, the first time it opens".
- **Android's back button closes the tips** for that screen, as it closes a sheet, rather than
  leaving the screen under them.
- **Players updating from 1.x see the tips once too.** The layer is new to everyone in 2.0.

## Screen readers and motion

- The tip is a dialog: `role="dialog"` with `aria-modal`, named "How to play, tip i of n".
  On iOS the layer is `accessibilityViewIsModal`; on Android the screen's content is
  `importantForAccessibility="no-hide-descendants"` while tips show. Focus moves to the tip's
  heading on each step.
- Next (Got it) and Skip tips are buttons. The tap-anywhere catcher, the scrim, ring, arrow and
  dots are hidden from screen readers.
- The tip fades in over `durations.tipFade` (200 ms, under the 300 ms rule; the canvas uses 220).
  Reduce Motion drops the fade.

## Theme

The canvas is dark only. Dark is the canvas: scrim `rgba(8,9,12,0.82)`, backing
`rgba(8,9,12,0.94)`, body `#dfe1e6`; the canvas's backing, 0.78, let the dimmed screen ghost
through the tip, so it is raised. Light is built from the light palette the same way: the
light ground's own ink as the scrim and backing (`rgba(247,247,249,0.9)`, `0.95`), heading
`textPrimary`, body `textSecondary`, ring and kicker `accentLine`, Next `ctaBg` on `ctaText`.
New roles in both palettes: `tipScrim`, `tipBacking`, `tipBody`. Everything else is an existing
role. A composite contrast test holds the body over the backing over the scrim to 4.5:1 in
both themes.

## Text

New `tips` section in `i18n/en.ts`, each with a `≤ N chars` budget mirrored in
`i18n/budgets.ts`, translated in `de`, `es`, `fr` (France) and `it`, each reviewed by a fresh
native-speaker pass until clean:

- `kicker(i, n)` (≤ 22), `spoken(i, n)` (the dialog's name), `next` (≤ 10), `gotIt` (≤ 12),
  `skip` (≤ 14);
- each tip's `heading` (≤ 32, it may wrap) and `body` (≤ 120).

**About.** "What is stored on your device" lists ten things. The tips' state is an eleventh:
"which screens have shown you their How to play tips, and whether you skipped them". Both counts in that
section change, in all five catalogs, with the About hash in `catalogs.test.ts`. Nothing new
leaves the device. The privacy pages are regenerated outside the repo and their diff goes in
the PR; `gh-pages` is pushed after merge, on the owner's word.

## Screenshots

Every existing capture seeds `tipsSkipped`, so today's shots don't change. New captures, dark
and light: each picker, Difficulty and Study tip (`02c-…`, `04f-…`, `05b-…`), Difficulty's third
after its scroll. `design/SCREENS.md` gains the rows and a line on the layer.

## Testing

Pure, in `lib/__tests__/tips.test.ts`: `shouldShowTips`, `placeTip` (below, above, the arrow's
side, a target at either edge, 360 × 640), `scrollDelta` and the settle check. The store's
new fields and their survival of `reset()` in `stores/__tests__`. Token and palette tests for
the new roles. On a device: the issue's **Still works** and **Test** lists, in the PR's device
checklist; screen-reader and large-text checks go to #187.

## The round and Results (#184)

Design: the canvas's **Tips · First question, level 1 (2)** (`CoachPlay`), **levels 2 and 3
(1)** (`CoachParts`) and **First results (2)** (`CoachResults`). Same layer, same rules: once
per screen, Skip ends every screen's tips, never on Home or Settings. The copy is the issue's,
which wins over the canvas where they differ.

### Screens and when

`TipScreen` gains `'question-1' | 'question-2' | 'question-3' | 'results'`: the question
screen counts once per level, Results once. `useTips(screen, ready)` takes a second argument,
`true` by default, and decides only once the store has hydrated **and** `ready` is true:

- **Question:** ready when this route's round is playing, on question 1, part 1, with nothing
  answered. The layer's catcher takes every tap, so nothing is answered behind it, and
  auto-advance only follows an answer.
- **Results:** ready once the celebration is over, `resultsTimeline.tips` (1,200 ms) after
  Results opens: a pause, not an animation, like `reviewPrompt`.

### The tips

| Screen        | #   | Target                            | Heading              | Body                                                                               |
| ------------- | --- | --------------------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| Level 1       | 1   | The shirt number and its clues    | A number, some clues | The shirt number is the question. Position, age and club help you find the player. |
| Level 1       | 2   | The answers                       | Tap who wears it     | A right answer moves on by itself. A miss shows who it was and waits for you.      |
| Level 2       | 1   | The parts (the slot chips)        | Two parts now        | Name first, then the position. It only counts if both are right.                   |
| Level 3       | 1   | The parts (the slot chips)        | Three parts          | Name, position, then the club. In a club squad, the nationality instead.           |
| Results       | 1   | The missed players' cards         | The ones to learn    | Every miss, with who it was and what you picked. Swipe for all.                    |
| Results, fail | 2   | The actions (main button and row) | Again, or study      | Score 8/10 to unlock the next level. Retry now, or study the squad first.          |
| Results, pass | 2   | The actions                       | On to the next       | Play the next level, or study the squad first.                                     |

- **Level 1's clues follow the squad.** A club squad's clue chips are position, age and
  nationality; a nation squad's are position, age and club. The body has a club variant, "…
  Position, age and nationality help you find the player.", so it is never untrue.
- **A single tip** (levels 2 and 3) carries the canvas's kicker, `HOW TO PLAY · LEVEL 2`, its
  spoken name "How to play, level 2", Got it, and no step dots. `TipsLayer` takes an optional
  `kicker` and `spoken` for that.
- **Results leaves a tip out when it has nothing to point at:** the first when nothing was
  missed (a 10/10 shows the roster instead), the second after passing the last level (no next
  level; the main button chooses a team). With both out, the layer doesn't open and Results
  keeps its tips for next time.
- **Results scrolls** like Difficulty: the actions can sit below the fold on a small phone.

### The store-rating prompt

Results never asks the OS for its rating dialog while the tips are open; the wait
(`resultsTimeline.reviewPrompt`) starts again when they close. A first round ever never asks
anyway (#57), so this only matters for a player updating from 1.x.

### About

No change: "which screens have shown you their How to play tips" stays true.
