# The strike: the launch intro (#182)

Part of #174, step 8. Design: the 2.0 canvas, Handoff page, artboards **Launch intro — the
strike (real speed)** (`OpenStrike`) and **Launch intro — four beats** (`StrikeFrames`), and
the timing note beside them. The handoff (`docs/superpowers/handoff/2026-10-16-2-0-redesign-handoff.md`)
binds the rest of the look.

## What it is

On a cold launch the Escuadra mark is drawn as a perfect strike, then Home shows:

1. **Frame.** The crossbar and post, in `mark`, on `background`. "TAP TO SKIP" at the foot.
2. **Shot.** The ball flies in from off-screen bottom left, on an arc, shrinking from 1.6× to
   1×. The two trail squares appear behind it as it passes them, the far one first.
3. **Goal.** It lands in the corner. Frame and ball flash `success`, a `success` ring flashes
   out from the ball, and the frame kicks up and right.
4. **A la escuadra.** Frame and ball return to `mark`; the wordmark rises in, "A LA
   ESCUADRA" fades in under it, "TAP TO SKIP" fades out. Then the intro fades and Home is
   there.

Built from `markGeometry` (`theme/brand.ts`) in plain Views, like `EscuadraMark`: no video,
no SVG, no new asset.

## Timeline

Each layer has its own shared value, started with `withDelay` at its first stop and run over
its own span with its own easing (linear unless the table names one, as the canvas's CSS
keyframes are); the whole intro's fade starts at `end`. The stops are the canvas's (its 4 s
loop × 40 ms per percent), in a `launchIntro` token in `theme/tokens.ts`:

| Layer               | From → to (ms) | Change                                                         |
| ------------------- | -------------- | -------------------------------------------------------------- |
| ball, appears       | 280 → 300      | opacity 0 → 1                                                  |
| ball, flight        | 300 → 700      | x linear, y on `bezier(.15,.6,.35,1)`, scale 1.6 → 1 linear    |
| far trail square    | 540 → 580      | opacity 0 → its `markGeometry` opacity                         |
| near trail square   | 600 → 640      | the same                                                       |
| frame + ball colour | 680 → 720      | `mark` → `success`                                             |
| ring                | 700 → 1000     | scale 0.6 → 2.8 (× the ball), opacity 0.9 → 0, ease-out        |
| frame kick          | 700 → 920      | to (+6, −6) at 780, back to rest by 920, ease-out (frame only) |
| wordmark            | 800 → 1060     | rises 16 dp, opacity 0 → 1, `celebrationEasingCurves.rise`     |
| "A LA ESCUADRA"     | 1000 → 1200    | opacity 0 → 1                                                  |
| "TAP TO SKIP"       | 1040 → 1200    | opacity 1 → 0                                                  |
| frame + ball colour | 1000 → 1200    | `success` → `mark`                                             |
| the whole intro     | 1200 → 1400    | opacity 1 → 0, the screen beneath showing; then it unmounts    |

The ball's start offset (−244, +473 dp at the canvas's 200 dp mark) is stored in mark units
(÷ `200 / MARK_VIEWBOX`), as are the kick (`kick.offset`, 1.92) and the ring's stroke
(`ring.stroke`, 0.96: the canvas's 3 px), so the strike scales with the mark's size.

**Call: the colour returns at 1000 → 1200, not the canvas's 1120 → 1360,** so beat 4 is
whole when the tagline settles and the intro ends near the timing note's "~1.1 s, then Home"
(1.2 s, plus the 200 ms fade). Everything else is the canvas's timing.

## When it plays

`lib/launchIntro.ts` is a pure decision, unit-tested: given whether Reduce Motion and a
screen reader are on, and whether this JavaScript launch has already shown it, it returns
`play`, `still` or `none`.

- **Once per JavaScript launch.** A module-level flag, set when the intro mounts. A warm
  resume never replays it: the root layout does not remount, and on Android, where backing
  out and reopening can remount it in the same process, the flag holds. An OTA update's
  reload is a new launch, so it plays.
- **Reduce Motion:** `still`, beat 4 only (mark colour, trail, wordmark and tagline), held
  for the same 1200 ms, then the same fade (a fade is allowed under Reduce Motion, as in
  `riseIn`).
- **A screen reader on: `none`.** The intro is decoration that would take focus and then
  vanish; with VoiceOver or TalkBack the launch goes straight to Home, as `autoAdvance` never
  runs with one on. The question is asked as `LaunchIntro`'s module loads (not on web, where
  react-native-web always answers yes), so the answer is usually in by the first mount; if
  it comes later, `useScreenReader` brings it and an intro already playing ends at once.
- **Every route.** It overlays whatever the stack shows first, which is Home on a phone. A web
  reload of a deep link plays it too; the screenshot build waits it out (below).

## Where it sits

`app/_layout.tsx` renders `<LaunchIntro />` above the `<Stack />`, absolutely filling the
screen, until it calls `onDone`. It mounts at the same moment as the stack: when fonts are
loaded and the progress store has hydrated, which is when the splash hides today. Home renders
beneath it, so its own first-render work runs under the intro.

**Call: the intro starts when the app is ready, not before.** Starting it as the splash hides
any earlier would draw it before the stored theme is known (a pinned-light player would get a
dark intro) and before the wordmark's font has loaded. So the launch takes "ready + 1.4 s" at
most, and the intro adds nothing to a slow device's load beyond its own length, as the issue
asks. The native splash and its colours are unchanged: its ground is `background` in both
themes, so the hand-off is the splash's full mark giving way to beat 1's empty frame.

`expo-updates`' launch check is native and untouched.

## Skipping

A tap anywhere skips: the intro fades out over `durations.transition` and unmounts. The
overlay is one full-screen `Pressable`, hidden from screen readers (it never plays with one
on), so it has no spoken name.

## Layout and look

- A centred column: the mark at `sizes.introMark` (200), the wordmark, the tagline, with the
  canvas's gaps as spacing tokens. "TAP TO SKIP" is pinned to the foot, above the bottom
  safe-area inset.
- Colours are existing roles in both palettes: `background`, `mark`, `success`,
  `textPrimary` (wordmark), `textMuted` (tagline, skip). The canvas is drawn dark; light uses
  the same roles. No new role.
- Type: three new tokens. The wordmark is `typography.wordmark`'s Archivo SemiExpanded
  ExtraBold at 46 / −1; the tagline IBM Plex Mono SemiBold 12 / +3; "TAP TO SKIP" IBM Plex
  Mono SemiBold 11 / +1, both uppercased by style.

## Text

- The wordmark is `ESCUADRA_WORDMARK`, and the tagline `A_LA_ESCUADRA` (`i18n/names.ts`),
  never translated.
- **"Tap to skip"** is the one new string, `launch.tapToSkip`, with a budget, in all five
  catalogs and reviewed by a native speaker per language.

## Motion rule

The intro is a written exception to the 300 ms rule (owner approved, 2026-10-22), beside
Home's drift and the round-over celebration: in `.claude/rules/design-tokens.md` (Motion), in
`CLAUDE.md`'s summary of the carve-outs, and beside `durations` in `theme/tokens.ts`.

## Tests and checks

- `lib/__tests__/launchIntro.test.ts`: the decision.
- `theme/__tests__/tokens.test.ts`: the `launchIntro` stops run forwards and end by `end`,
  and `end` plus the fade stays within 1.5 s.
- `npm run shots` captures `00-launch-intro` (beat 4, under emulated Reduce Motion, in both
  themes); `design/SCREENS.md` describes it. Every other capture waits, after each load,
  until the intro has left the page (`launch-intro` detached), so no shot can catch it.
- On a device (the PR's checklist): a cold launch, a warm resume, tap to skip, Reduce Motion,
  a slow launch, the update check, the splash. Screen-reader checks go to #187.

Nothing new leaves the device: no event, no property, no network call.
