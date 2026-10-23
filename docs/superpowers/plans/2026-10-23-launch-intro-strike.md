# The strike, the launch intro: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a cold launch, draw the Escuadra mark as a strike into the corner (~1.2 s), then
fade to Home (#182).

**Architecture:** A pure decision (`lib/launchIntro.ts`) says whether to play, show the still
end frame, or show nothing. A `launchIntro` token holds the canvas's timeline. A
`LaunchIntro` component overlays the root `Stack` in `app/_layout.tsx` and unmounts itself
when done. Reanimated shared values, one per layer, each started with `withDelay` +
`withTiming`, as `components/EscuadraStrike.tsx` does.

**Tech stack:** Expo SDK 57, React Native 0.86, Reanimated 4.5 (`scheduleOnRN` from
`react-native-worklets` to call back to JS), Vitest (node), Playwright for `npm run shots`.

**Spec:** `docs/superpowers/specs/2026-10-23-launch-intro-strike-design.md`. Read it first.

## Global constraints

- Run `nvm use` first (Node 24). Open project files with Read, not `cat`, so their rules load.
- Guardrail 5: no hard-coded colour, spacing or font size. Colours from `useThemeColors()`
  inside the component (never a module-scope `StyleSheet.create` holding colours).
- No user-visible string outside `i18n/`; `npm run lint` fails one in `app/` or `components/`.
- "escuadra" and "a la escuadra" come from `i18n/names.ts` (`ESCUADRA_WORDMARK`,
  `A_LA_ESCUADRA`), never a catalog.
- TypeScript strict with `noUncheckedIndexedAccess`; never weaken it.
- Tests live in `__tests__/` beside the code (`lib/__tests__/`, `theme/__tests__/`).
- Nothing new leaves the device: no telemetry event or property, no network call.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: The decision, the timeline tokens and the motion exception

**Files:**

- Create: `lib/launchIntro.ts`, `lib/__tests__/launchIntro.test.ts`
- Modify: `theme/tokens.ts` (a `launchIntro` timeline after `resultsTimeline`; `sizes.introMark`;
  three typography tokens; the comment above `durations`)
- Modify: `theme/__tests__/tokens.test.ts` (a `launch intro motion` describe)
- Modify: `.claude/rules/design-tokens.md` (Motion), `CLAUDE.md` (Working conventions'
  animation line)

**Interfaces — produces:**

- `type IntroPlan = 'play' | 'still' | 'none'`
- `introPlan(c: { alreadyShown: boolean; screenReader: boolean; reduceMotion: boolean }): IntroPlan`
- `launchIntro` (shape below), `sizes.introMark: 200`,
  `typography.introWordmark`, `typography.introTagline`, `typography.introSkip`

- [ ] **Step 1: Write the failing test** `lib/__tests__/launchIntro.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { introPlan } from '@/lib/launchIntro';

const fresh = { alreadyShown: false, screenReader: false, reduceMotion: false };

describe('introPlan', () => {
  it('plays the strike on a fresh launch', () => {
    expect(introPlan(fresh)).toBe('play');
  });

  it('shows only the end frame under Reduce Motion', () => {
    expect(introPlan({ ...fresh, reduceMotion: true })).toBe('still');
  });

  it('never shows twice in one launch, so a warm resume goes straight on', () => {
    expect(introPlan({ ...fresh, alreadyShown: true })).toBe('none');
    expect(introPlan({ ...fresh, alreadyShown: true, reduceMotion: true })).toBe('none');
  });

  it('shows nothing with a screen reader on', () => {
    expect(introPlan({ ...fresh, screenReader: true })).toBe('none');
    expect(introPlan({ ...fresh, screenReader: true, reduceMotion: true })).toBe('none');
  });
});
```

- [ ] **Step 2:** `npx vitest run lib/__tests__/launchIntro.test.ts` — FAIL, cannot resolve
      `@/lib/launchIntro`.

- [ ] **Step 3: Implement** `lib/launchIntro.ts`:

```ts
// Whether the launch intro (#182) shows, and how. Pure, so it is tested;
// `components/LaunchIntro.tsx` asks it.

/** `play` the strike, show its `still` end frame, or `none`. */
export type IntroPlan = 'play' | 'still' | 'none';

export interface IntroConditions {
  /** This JavaScript launch has shown it already: a warm resume, or a remount. */
  alreadyShown: boolean;
  /** VoiceOver or TalkBack: the intro is decoration that would take focus and vanish. */
  screenReader: boolean;
  reduceMotion: boolean;
}

export function introPlan({
  alreadyShown,
  screenReader,
  reduceMotion,
}: IntroConditions): IntroPlan {
  if (alreadyShown || screenReader) return 'none';
  return reduceMotion ? 'still' : 'play';
}
```

- [ ] **Step 4:** the test passes.

- [ ] **Step 5: Write the failing token tests.** In `theme/__tests__/tokens.test.ts`, add
      `launchIntro` to the import from `'../tokens'` and append:

```ts
describe('launch intro motion', () => {
  // #182: the canvas's timeline, in ms from the first frame.
  const {
    ballIn,
    flight,
    trail,
    flash,
    ring,
    kick,
    wordmark,
    tagline,
    skipHint,
    colourBack,
    end,
    fadeOut,
  } = launchIntro;
  const ends = [
    ballIn.at + ballIn.duration,
    flight.at + flight.duration,
    ...trail.map((t) => t.at + t.duration),
    flash.at + flash.duration,
    ring.at + ring.duration,
    kick.at + kick.rise + kick.settle,
    wordmark.at + wordmark.duration,
    tagline.at + tagline.duration,
    skipHint.at + skipHint.duration,
    colourBack.at + colourBack.duration,
  ];

  it('has every beat over by the time the intro fades', () => {
    expect(Math.max(...ends)).toBeLessThanOrEqual(end);
  });

  it('lands the ball before it flashes the goal', () => {
    expect(flight.at + flight.duration).toBeLessThanOrEqual(ring.at);
    expect(flash.at + flash.duration).toBeLessThanOrEqual(colourBack.at);
  });

  it('passes the far trail square before the near one', () => {
    const [near, far] = trail;
    expect(far!.at).toBeLessThan(near!.at);
  });

  it('hands over to Home within about a second and a half', () => {
    expect(end + fadeOut).toBeLessThanOrEqual(1500);
  });
});
```

- [ ] **Step 6:** `npx vitest run theme/__tests__/tokens.test.ts` — FAIL, `launchIntro` is not
      exported.

- [ ] **Step 7: Add the tokens** to `theme/tokens.ts`, right after `resultsTimeline`:

```ts
// The launch intro, "the strike" (#182; the 2.0 canvas's OpenStrike artboard). ms
// from the first frame, read off the canvas's 4 s CSS loop at 40 ms per percent.
// Distances are in mark units (`MARK_VIEWBOX`), so the strike scales with the mark:
// the canvas draws the mark at 200 dp, 3.125 dp a unit. Its third written
// exception to the 300 ms rule (owner approved, 2026-10-22). One change from
// the canvas: the colour comes back at 1000–1200, not 1120–1360, so the end
// frame is whole as the tagline settles (spec, Timeline).
export const launchIntro = {
  // The ball pops in off-screen, bottom left, then flies to the corner: x
  // straight, y on `curve`, so it arcs; it shrinks from `scale` to 1.
  ballIn: { at: 280, duration: 20 },
  flight: {
    at: 300,
    duration: 400,
    curve: [0.15, 0.6, 0.35, 1],
    from: { x: -78, y: 151 },
    scale: 1.6,
  },
  // As the ball passes, each trail square shows. Indexed as `markGeometry.trail`:
  // [0] the near one, [1] the far one, which the ball passes first.
  trail: [
    { at: 600, duration: 40 },
    { at: 540, duration: 40 },
  ],
  // The goal: frame and ball turn `success`, a ring flashes out from the ball
  // (scale × the ball, starting opacity), and the frame kicks up and right
  // (units), back to rest after `settle`.
  flash: { at: 680, duration: 40 },
  ring: { at: 700, duration: 300, from: 0.6, to: 2.8, opacity: 0.9 },
  kick: { at: 700, rise: 80, settle: 140, x: 1.92 },
  // The end frame: the wordmark rises `rise` dp in, the tagline fades in, the
  // skip hint fades out, the colour comes back to `mark`.
  wordmark: { at: 800, duration: 260, rise: 16 },
  tagline: { at: 1000, duration: 200 },
  skipHint: { at: 1040, duration: 160 },
  colourBack: { at: 1000, duration: 200 },
  // Then the whole intro fades over `fadeOut`, Home showing through. Under
  // Reduce Motion the end frame holds until `end` and fades the same way.
  end: 1200,
  fadeOut: 200,
} as const;
```

In `sizes`, after `wordmarkMarkHero`:

```ts
  // The launch intro's mark (#182).
  introMark: 200,
```

In `typography`, after `wordmarkHero`:

```ts
  // The launch intro (#182): the lockup's word at 46 / −1, the "A LA ESCUADRA"
  // tagline under it, and "TAP TO SKIP" at the foot.
  introWordmark: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 46,
    letterSpacing: -1,
  },
  introTagline: {
    fontFamily: 'IBMPlexMono-SemiBold',
    fontWeight: '600' as const,
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase' as const,
  },
  introSkip: {
    fontFamily: 'IBMPlexMono-SemiBold',
    fontWeight: '600' as const,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
```

Check `theme/__tests__/tokens.test.ts`'s `Archivo display type` and `font weights` describes:
if they enumerate typography tokens or require a `lineHeight` for Archivo sizes, satisfy
them (a big Archivo word likely wants the face's natural line height, as the comment above
the Archivo tokens explains; follow that convention).

Above `durations`, extend the comment's last line: after the `numberWall.speed` sentence add
``The launch intro (#182) is the third carve-out: see `launchIntro`.``

- [ ] **Step 8:** both test files pass: `npx vitest run lib theme`.

- [ ] **Step 9: Write the exception down.** In `.claude/rules/design-tokens.md`, Motion,
      replace the paragraph "The round-over celebration is the other carve-out: …" with:

```md
The launch intro (#182), "the strike", runs about 1.2 s and fades to Home over 200 ms
(`launchIntro`). It is a written exception (owner approved, 2026-10-22): once per cold launch,
a tap skips it, Reduce Motion shows its end frame, and it never plays with a screen reader on.

The round-over celebration is the last carve-out: its timelines (`strikeTiming`,
`resultsTimeline` in `theme/tokens.ts`) may run past 300 ms.
```

In `CLAUDE.md`, Working conventions, change "Animations stay under 300 ms by default, with
the carve-outs in `design-tokens`" to "Animations stay under 300 ms by default, with the
carve-outs in `design-tokens` (the launch intro, Home's drift, the round-over celebration)".
Keep the rest of that bullet as is. The rule must stay ≤ 100 lines and `CLAUDE.md` ≤ 200
(`scripts/claude/__tests__/repo.test.ts`).

- [ ] **Step 10:** `npx vitest run && npx prettier --check theme lib CLAUDE.md .claude` pass.
      Commit: `feat(launch): the intro's decision and timeline tokens (#182)`.

---

### Task 2: "Tap to skip" in five languages

**Files:** `i18n/en.ts`, `i18n/budgets.ts`, `i18n/de.ts`, `i18n/es.ts`, `i18n/fr.ts`,
`i18n/it.ts`. Read `.claude/rules/i18n.md` (it loads when you Read `i18n/en.ts`).

**Interfaces — produces:** `messages.launch.tapToSkip: string`.

- [ ] **Step 1:** In `i18n/en.ts`, add a `launch` group directly after `home`'s closing `},`:

```ts
  launch: {
    /** ≤ 22 chars: the launch intro's foot (#182), in mono capitals; a tap anywhere skips. */
    tapToSkip: 'Tap to skip',
  },
```

- [ ] **Step 2:** In `i18n/budgets.ts`, after the `home.starHint` entry (the groups are in
      file order):

```ts
  { budget: 22, texts: { 'launch.tapToSkip': (m) => m.launch.tapToSkip } },
```

- [ ] **Step 3:** In each other catalog, the same group, same position (after `home`):
  - `de.ts`: `tapToSkip: 'Tippen zum Überspringen',`
  - `es.ts`: `tapToSkip: 'Toca para saltar',`
  - `fr.ts`: `tapToSkip: 'Touchez pour passer',` (France usage, `vous` form)
  - `it.ts`: `tapToSkip: 'Tocca per saltare',`

  Check each catalog's own conventions first (how it words "tap", formal or informal address,
  any comment style for the choice) by reading the surrounding entries, e.g. Home's and the
  round's tap hints, and match them; note a deviation from the strings above in your report.

- [ ] **Step 4:** `npx vitest run i18n && npm run typecheck` pass. Commit:
      `feat(launch): "Tap to skip" in five languages (#182)`.

(The controller runs the native-speaker review afterwards.)

---

### Task 3: The intro component, over the root stack

**Files:**

- Create: `components/LaunchIntro.tsx`
- Modify: `app/_layout.tsx`

**Interfaces — consumes:** `introPlan` (Task 1), `launchIntro`, `sizes.introMark`,
`typography.intro*` (Task 1), `t.launch.tapToSkip` (Task 2), `markGeometry`, `MARK_VIEWBOX`
(`theme/brand.ts`), `useReduceMotion`, `useScreenReader`, `useT`, `useThemeColors`.
**Produces:** `<LaunchIntro onDone={() => void} />`, `testID="launch-intro"` on its root.

Read first: `components/EscuadraStrike.tsx` (the pattern), `components/EscuadraMark.tsx`,
`components/Wordmark.tsx`, `components/Sheet.tsx` (`scheduleOnRN`), the spec's Timeline and
Layout sections, and the canvas source the spec is drawn from (the timeline table is the
contract).

- [ ] **Step 1: The component.** Requirements, in order:
  - **Once per launch.** Module-level `let shown = false;`. In the component,
    `const reduceMotion = useReduceMotion(); const screenReader = useScreenReader();` and
    compute the plan once on mount: `const [plan] = useState(() => introPlan({ alreadyShown: shown, screenReader: false, reduceMotion }))`,
    then set `shown = true` in a mount effect. (`useScreenReader` starts `false` and answers
    later; see the next point.) If the plan is `none`, call `onDone` from an effect and render
    `null`.
  - **Screen reader arrives late:** an effect on `screenReader`: when it turns `true` while the
    intro is mounted, call `onDone()` at once (no fade).
  - **Shared values**, one per layer, started in a mount effect when the plan is `play`:
    `ballIn`, `flyX` (linear), `flyY` (`Easing.bezier(...launchIntro.flight.curve)`),
    `trailNear`, `trailFar`, `goal` (0 = `mark`, 1 = `success`: `withDelay(flash.at, withSequence(withTiming(1, {duration: flash.duration}), withDelay(colourBack.at - flash.at - flash.duration, withTiming(0, {duration: colourBack.duration}))))`),
    `ring` (`Easing.out(Easing.ease)`), `kick` (`withDelay(kick.at, withSequence(withTiming(1, {duration: kick.rise, easing: Easing.out(Easing.ease)}), withTiming(0, {duration: kick.settle, easing: Easing.out(Easing.ease)})))`),
    `word` (`Easing.bezier(...celebrationEasingCurves.rise)`), `tagline` (linear),
    `skipHint` (starts at 1, to 0), and `fade` (the root's opacity: `withDelay(end, withTiming(0, {duration: fadeOut}, (finished) => { if (finished) scheduleOnRN(onDone); }))`).
    For `still`, set every value to its end state at once (ball in place, trails on,
    `goal` 0, ring 0, word and tagline 1, skipHint 0) and start only `fade`.
  - **Geometry** with `u = sizes.introMark / MARK_VIEWBOX`, as `EscuadraMark` does, using the
    large `markGeometry.ball` (200 is far over `MARK_SMALL_BALL_THRESHOLD`). Ball transform:
    `translateX: launchIntro.flight.from.x * u * (1 - flyX)`,
    `translateY: launchIntro.flight.from.y * u * (1 - flyY)`,
    `scale: 1 + (launchIntro.flight.scale - 1) * (1 - flyX)`, opacity `ballIn`.
    Frame (crossbar and post in one absolutely-filled wrapper, so they kick together):
    `translateX: launchIntro.kick.x * u * kick`, `translateY: -launchIntro.kick.x * u * kick`.
    Ring: a ball-sized circle, `borderWidth: borderWidths.emphasis`, `borderColor: colors.success`,
    `scale: interpolate(ring, [0, 1], [ring.from, ring.to])`, opacity
    `ring.value === 0 ? 0 : ring.opacity * (1 - ring.value)` (invisible before it starts).
    Trails: `markGeometry.trail[i]` rects, opacity `trailX * trail[i].opacity`, filled like the
    ball. Frame, ball and trail colours: `interpolateColor(goal, [0, 1], [colors.mark, colors.success])`
    (trails stay `mark`; only frame and ball flash, as the canvas does).
  - **Layout:** the root is `StyleSheet.absoluteFill`, `backgroundColor: colors.background`,
    a `Pressable` (tap skips: cancel by starting `fade` at once,
    `withTiming(0, { duration: durations.transition }, …onDone)`), centring a column: the mark
    box (`sizes.introMark` square), then `ESCUADRA_WORDMARK` in `typography.introWordmark` /
    `textPrimary` with `marginTop: spacing.xxl`, its style `opacity: word`,
    `translateY: launchIntro.wordmark.rise * (1 - word)`; then `A_LA_ESCUADRA` in
    `typography.introTagline` / `textMuted`, `marginTop: spacing.sm`, opacity `tagline`.
    "TAP TO SKIP" (`t.launch.tapToSkip`, `typography.introSkip`, `textMuted`, opacity
    `skipHint`) is absolutely positioned at the foot, `bottom: insets.bottom + spacing.huge`
    (`useSafeAreaInsets`), centred.
  - **Accessibility:** the root carries `accessible={false}`,
    `importantForAccessibility="no-hide-descendants"` and `accessibilityElementsHidden`; it
    never plays with a screen reader on (spec, When it plays).
  - Colour styles are built inside the component from `useThemeColors()`; the only
    module-scope `StyleSheet.create` holds colour-free layout, as `EscuadraStrike` does.
  - A header comment in the house style: what it is, the four beats, where the timing lives.

- [ ] **Step 2: Wire it in** `app/_layout.tsx`: `const [introDone, setIntroDone] = useState(false);`
      and render `{!introDone && <LaunchIntro onDone={() => setIntroDone(true)} />}` after the
      `<Stack … />` inside `ThemeProvider` (so it overlays the stack), before `<StatusBar>`.
      Extend the comment above `ready` with one line: the intro (#182) mounts with the stack,
      when the splash hides, so it never starts before the theme and fonts are known. Keep the
      `useState` import with the existing `useEffect` one.

- [ ] **Step 3: Verify.** `npm run typecheck && npm run lint && npx prettier --check components app`.
      Then run the web build briefly to see it render without a page error:
      `npx expo start --web --port 8099` in the background, open `http://localhost:8099/` with
      Playwright's Chromium (e.g. a short `node -e` script using `playwright`'s `chromium`,
      as `scripts/capture-screens.mjs` does), screenshot at ~900 ms and ~2000 ms into the
      scratchpad, and look at both images: the first mid-strike (frame green, ball in the
      corner, wordmark rising), the second Home with no overlay. Stop the server.

- [ ] **Step 4:** Commit: `feat(launch): the strike plays as the app opens (#182)`.

---

### Task 4: The screenshot and the handoff

**Files:** `scripts/capture-screens.mjs`, `design/SCREENS.md`, `design/screens/*`.
Read `.claude/rules/design-handoff.md` (it loads when you Read `design/SCREENS.md`).

- [ ] **Step 1: Capture the end frame.** In `scripts/capture-screens.mjs`, add a function next
      to `openHomeStill`:

```js
/**
 * The launch intro's end frame (#182). Under emulated Reduce Motion it holds
 * still until `launchIntro.end` (1,200 ms) after the app is ready, so shoot as
 * soon as it shows instead of waiting out `SETTLE_MS`, which outlasts it.
 */
async function shootLaunchIntro(capture) {
  await capture.page.emulateMedia({ reducedMotion: 'reduce' });
  await capture.page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await capture.page.getByTestId('launch-intro').waitFor({ state: 'visible' });
  capture.assertLive();
  await capture.page.screenshot({ path: join(OUT_DIR, capture.file('00-launch-intro')) });
  await capture.page.emulateMedia({ reducedMotion: 'no-preference' });
}
```

Match how `shoot` builds its path and screenshot options (read it; reuse its path join and
any `fullPage`/`scale` options rather than the guesses above). Call it first in
`captureTheme`, before `openHomeStill`. `networkidle` may already be past the intro's start;
if `waitFor` proves flaky, wait on `domcontentloaded` instead.

- [ ] **Step 2: Describe it** in `design/SCREENS.md`, in its per-screen list (read the file
      for the format), as the first entry: `00-launch-intro`: the launch intro's end frame
      (#182), as Reduce Motion shows it: the mark with its trail, "escuadra", "A LA
      ESCUADRA". Plays once per cold launch (the strike, ~1.2 s, then a fade to Home); a tap
      skips it; never with a screen reader on. Captured under emulated Reduce Motion.

- [ ] **Step 3:** `npm run shots` (it starts its own web server; takes a few minutes). Look at
      `design/screens/00-launch-intro.png` and `-light.png`, and at `01-home.png` (no overlay
      left over). `git status design/screens` should show the two new files; other PNGs that
      changed only by rendering noise are fine to commit, as before.

- [ ] **Step 4:** Commit: `docs(design): the launch intro's screenshot (#182)`.

---

### Finish (controller)

- Native-speaker review of the four translations (fresh subagent per language, until clean).
- `npm run check`, its output in the PR.
- PR with `Closes #182`, a device checklist (Still works, the Test list), screen-reader and
  large-text checks added to #187, the issue's DoD ticked as each is met.
