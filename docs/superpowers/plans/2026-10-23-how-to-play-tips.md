# How to play tips (#183) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "How to play" layer that shows each of the picker, Difficulty and Study its tips once, the first time it opens, as the canvas draws them.

**Architecture:** Pure decisions and geometry in `lib/tips.ts` (unit-tested). State in `stores/progress.ts`. One `TipsLayer` component draws an SVG scrim with a cut-out, a ring, an arrow and the tip over a screen, measuring each target with `measureInWindow`. A `useTips(screen)` hook decides whether the screen opens with it. Each screen hands the layer refs to its targets.

**Tech Stack:** Expo SDK 57, React Native 0.86, react-native-svg 15, Reanimated 4, Zustand 5 with AsyncStorage persist, Vitest (node env).

**Spec:** `docs/superpowers/specs/2026-10-23-how-to-play-tips-design.md`. Read it first. Canvas: the **How to play** page of https://claude.ai/artifact/9wopqyRq53dok9ZYqGPT8X (`CoachTeams`, `CoachDifficulty`, `CoachStudy`).

## Global Constraints

- Node 24: `nvm use` once per shell. Run `npm run check` before reporting a task done; report its real output.
- No hard-coded colour, spacing or font size (guardrail 5): every value from `theme/tokens.ts`, colour from `useThemeColors()` inside the component, never a module-scope `StyleSheet` with colours. A new palette role goes in both `palettes.dark` and `palettes.light`.
- Every user-visible string in `i18n/en.ts`, read with `useT()`; `npm run lint` fails a literal in `app/` or `components/` JSX.
- TypeScript strict with `noUncheckedIndexedAccess`; never loosen it.
- Tests live in a `__tests__/` folder beside the code. No React Native renderer: components are checked by `npm run shots` and on a device, logic by Vitest.
- Animations under 300 ms; the tip's fade is `durations.tipFade` = 200 ms; Reduce Motion drops it.
- Nothing new leaves the device: no telemetry event or property, no network call.
- Never touch `package.json`, `app.json`, `eas.json` or `.gitignore`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, conventional prefix, `(#183)` in the subject.

---

### Task 1: The pure tips logic

**Files:**

- Create: `lib/tips.ts`
- Test: `lib/__tests__/tips.test.ts`

**Interfaces:**

- Produces (used by Tasks 2, 5–8):
  - `type TipScreen = 'picker' | 'difficulty' | 'study'`
  - `interface Box { x: number; y: number; width: number; height: number }`
  - `interface RoundedBox extends Box { radius: number }`
  - `interface TipGeometry { gap: number; ring: number; arrow: { width: number; height: number }; arrowGap: number; tipGap: number; gutter: number; skipClear: number }`
  - `shouldShowTips(screen: TipScreen, seen: readonly TipScreen[], skipped: boolean): boolean`
  - `placeTip(input: PlaceInput, geometry: TipGeometry): TipPlacement`
  - `interface PlaceInput { target: Box; radius: number; screen: { width: number; height: number }; insets: { top: number; bottom: number }; tipHeight: number }`
  - `interface TipPlacement { hole: RoundedBox; ring: RoundedBox; side: 'below' | 'above'; tipTop: number; arrow: { x: number; y: number; flip: boolean } }`
  - `scrollDelta(input: Omit<PlaceInput, 'tipHeight'>, geometry: TipGeometry): number`
  - `settled(previous: Box | null, next: Box): boolean`
  - `roundedRectPath(box: RoundedBox): string`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/__tests__/tips.test.ts
import { describe, expect, it } from 'vitest';
import {
  placeTip,
  roundedRectPath,
  scrollDelta,
  settled,
  shouldShowTips,
  type TipGeometry,
} from '../tips';

const G: TipGeometry = {
  gap: 5,
  ring: 2,
  arrow: { width: 40, height: 40 },
  arrowGap: 4,
  tipGap: 8,
  gutter: 24,
  skipClear: 100,
};
const SCREEN = { width: 390, height: 844 };
const INSETS = { top: 47, bottom: 34 };

describe('shouldShowTips', () => {
  it('shows a screen whose tips have not shown', () => {
    expect(shouldShowTips('picker', [], false)).toBe(true);
    expect(shouldShowTips('study', ['picker'], false)).toBe(true);
  });
  it('never shows a screen twice', () => {
    expect(shouldShowTips('picker', ['picker'], false)).toBe(false);
  });
  it('shows nothing anywhere once skipped', () => {
    expect(shouldShowTips('difficulty', [], true)).toBe(false);
  });
});

describe('placeTip', () => {
  const play = { x: 20, y: 380, width: 350, height: 56 };

  it('cuts the hole the gap outside the target, its radius grown by the gap', () => {
    const p = placeTip(
      { target: play, radius: 999, screen: SCREEN, insets: INSETS, tipHeight: 150 },
      G,
    );
    expect(p.hole).toEqual({ x: 15, y: 375, width: 360, height: 66, radius: 33 });
  });

  it('rings the hole one stroke-centre further out', () => {
    const p = placeTip(
      { target: play, radius: 999, screen: SCREEN, insets: INSETS, tipHeight: 150 },
      G,
    );
    expect(p.ring).toEqual({ x: 14, y: 374, width: 362, height: 68, radius: 34 });
  });

  it('puts the tip under the target when it fits', () => {
    const p = placeTip(
      { target: play, radius: 28, screen: SCREEN, insets: INSETS, tipHeight: 150 },
      G,
    );
    expect(p.side).toBe('below');
    // ring bottom 442, + arrowGap 4 = arrow at 446, + 40 + tipGap 8 = 494
    expect(p.arrow.y).toBe(446);
    expect(p.tipTop).toBe(494);
  });

  it('puts the tip over a target near the bottom', () => {
    const study = { x: 20, y: 700, width: 350, height: 56 };
    const p = placeTip(
      { target: study, radius: 28, screen: SCREEN, insets: INSETS, tipHeight: 150 },
      G,
    );
    expect(p.side).toBe('above');
    // ring top 694, - arrowGap 4 - arrow 40 = arrow at 650; - tipGap 8 - 150 = 492
    expect(p.arrow.y).toBe(650);
    expect(p.tipTop).toBe(492);
  });

  it('takes the roomier side, clamped on screen, when neither fits', () => {
    const middle = { x: 20, y: 300, width: 350, height: 200 };
    const p = placeTip(
      {
        target: middle,
        radius: 16,
        screen: { width: 360, height: 640 },
        insets: { top: 0, bottom: 0 },
        tipHeight: 260,
      },
      G,
    );
    expect(p.side).toBe('above');
    expect(p.tipTop).toBeGreaterThanOrEqual(G.skipClear);
  });

  it('points the arrow at a narrow target centre, mirrored on the right half', () => {
    const star = { x: 326, y: 54, width: 44, height: 44 };
    const p = placeTip(
      { target: star, radius: 22, screen: SCREEN, insets: INSETS, tipHeight: 120 },
      G,
    );
    expect(p.arrow.flip).toBe(true);
    // centre 348 - 20 = 328, clamped to 390 - 24 - 40 = 326
    expect(p.arrow.x).toBe(326);
  });

  it('sets the arrow at the left of a wide target', () => {
    const p = placeTip(
      { target: play, radius: 28, screen: SCREEN, insets: INSETS, tipHeight: 150 },
      G,
    );
    expect(p.arrow.flip).toBe(false);
    expect(p.arrow.x).toBe(play.x + G.gutter);
  });

  it('clips a target wider than the screen to it', () => {
    const pills = { x: 16, y: 120, width: 600, height: 36 };
    const p = placeTip(
      { target: pills, radius: 999, screen: SCREEN, insets: INSETS, tipHeight: 120 },
      G,
    );
    expect(p.hole.x + p.hole.width).toBeLessThanOrEqual(SCREEN.width);
  });
});

describe('scrollDelta', () => {
  it('is 0 for a target on screen', () => {
    const target = { x: 20, y: 700, width: 350, height: 56 };
    expect(scrollDelta({ target, radius: 28, screen: SCREEN, insets: INSETS }, G)).toBe(0);
  });
  it('scrolls a target below the fold up to the bottom gutter', () => {
    const target = { x: 20, y: 900, width: 350, height: 56 };
    // ring bottom 900 + 56 + 6 = 962; visible bottom 844 - 34 - 24 = 786
    expect(scrollDelta({ target, radius: 28, screen: SCREEN, insets: INSETS }, G)).toBe(176);
  });
});

describe('roundedRectPath', () => {
  it('draws a rounded rect clockwise', () => {
    expect(roundedRectPath({ x: 0, y: 0, width: 10, height: 10, radius: 2 })).toBe(
      'M2 0H8A2 2 0 0 1 10 2V8A2 2 0 0 1 8 10H2A2 2 0 0 1 0 8V2A2 2 0 0 1 2 0Z',
    );
  });
  it('caps the radius at half the shorter side', () => {
    expect(roundedRectPath({ x: 0, y: 0, width: 20, height: 10, radius: 99 })).toBe(
      'M5 0H15A5 5 0 0 1 20 5V5A5 5 0 0 1 15 10H5A5 5 0 0 1 0 5V5A5 5 0 0 1 5 0Z',
    );
  });
});

describe('settled', () => {
  const box = { x: 1, y: 2, width: 3, height: 4 };
  it('waits for a first measure', () => {
    expect(settled(null, box)).toBe(false);
  });
  it('holds when two measures agree to half a point', () => {
    expect(settled(box, { ...box, y: 2.4 })).toBe(true);
    expect(settled(box, { ...box, x: 12 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run lib/__tests__/tips.test.ts`
Expected: FAIL, cannot resolve `../tips`.

- [ ] **Step 3: Write `lib/tips.ts`**

```ts
// How to play (#183; spec docs/superpowers/specs/2026-10-23-how-to-play-tips-design.md):
// whether a screen opens with its tips, and where a tip's cut-out, ring, arrow
// and text go around a measured target. Pure, so it is tested; `TipsLayer` draws it.

export type TipScreen = 'picker' | 'difficulty' | 'study';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoundedBox extends Box {
  radius: number;
}

export interface TipGeometry {
  /** Between the target and the scrim's cut-out. */
  gap: number;
  /** The ring's stroke, drawn just outside the cut-out. */
  ring: number;
  arrow: { width: number; height: number };
  /** Between the ring and the arrow. */
  arrowGap: number;
  /** Between the arrow and the tip. */
  tipGap: number;
  /** The screen's side margin, which the tip and arrow keep inside. */
  gutter: number;
  /** How far down the tip must stay to clear Skip tips. */
  skipClear: number;
}

export interface PlaceInput {
  target: Box;
  /** The target's own corner radius; a pill passes `radii.pill`. */
  radius: number;
  screen: { width: number; height: number };
  insets: { top: number; bottom: number };
  tipHeight: number;
}

export interface TipPlacement {
  hole: RoundedBox;
  ring: RoundedBox;
  side: 'below' | 'above';
  tipTop: number;
  /** The arrow's box's top left; `flip` mirrors it to curve leftwards. */
  arrow: { x: number; y: number; flip: boolean };
}

export function shouldShowTips(
  screen: TipScreen,
  seen: readonly TipScreen[],
  skipped: boolean,
): boolean {
  return !skipped && !seen.includes(screen);
}

function outset(box: Box, by: number, radius: number): RoundedBox {
  return {
    x: box.x - by,
    y: box.y - by,
    width: box.width + by * 2,
    height: box.height + by * 2,
    radius: Math.min(radius, box.height / 2) + by,
  };
}

/** The target cut to the screen's width, less the gap, so the cut-out stays on
 *  screen: a pill row may run past the edge. */
function onScreen(target: Box, width: number, inset: number): Box {
  const x = Math.max(inset, target.x);
  return { ...target, x, width: Math.min(width - inset, target.x + target.width) - x };
}

function ringOf(input: Omit<PlaceInput, 'tipHeight'>, g: TipGeometry) {
  const target = onScreen(input.target, input.screen.width, g.gap);
  const hole = outset(target, g.gap, input.radius);
  const ring = outset(target, g.gap + g.ring / 2, input.radius);
  return { target, hole, ring };
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function placeTip(input: PlaceInput, g: TipGeometry): TipPlacement {
  const { screen, insets, tipHeight } = input;
  const { target, hole, ring } = ringOf(input, g);
  const top = insets.top + g.skipClear;
  const bottom = screen.height - insets.bottom - g.gutter;

  const belowArrow = ring.y + ring.height + g.arrowGap;
  const belowTip = belowArrow + g.arrow.height + g.tipGap;
  const aboveArrow = ring.y - g.arrowGap - g.arrow.height;
  const aboveTip = aboveArrow - g.tipGap - tipHeight;

  const fitsBelow = belowTip + tipHeight <= bottom;
  const fitsAbove = aboveTip >= top;
  const side =
    fitsBelow || (!fitsAbove && bottom - belowTip >= aboveArrow - g.tipGap - top)
      ? 'below'
      : 'above';
  const tipTop =
    side === 'below'
      ? clamp(belowTip, top, Math.max(top, bottom - tipHeight))
      : clamp(aboveTip, top, Math.max(top, bottom - tipHeight));

  const centre = target.x + target.width / 2;
  const narrow = target.width < screen.width / 2;
  const maxX = screen.width - g.gutter - g.arrow.width;
  const arrowX = narrow
    ? clamp(centre - g.arrow.width / 2, g.gutter, maxX)
    : clamp(target.x + g.gutter, g.gutter, maxX);

  return {
    hole,
    ring,
    side,
    tipTop,
    arrow: {
      x: arrowX,
      y: side === 'below' ? belowArrow : aboveArrow,
      flip: narrow && centre > screen.width / 2,
    },
  };
}

/** How far to scroll down so a target below the fold sits, ringed, above the
 *  bottom gutter; 0 when it is already on screen. */
export function scrollDelta(input: Omit<PlaceInput, 'tipHeight'>, g: TipGeometry): number {
  const { ring } = ringOf(input, g);
  const bottom = input.screen.height - input.insets.bottom - g.gutter;
  return Math.max(0, ring.y + ring.height - bottom);
}

/** An SVG path for a rounded rect, drawn clockwise, to cut out of the scrim
 *  with `fillRule="evenodd"`. */
export function roundedRectPath({ x, y, width, height, radius }: RoundedBox): string {
  const r = Math.min(radius, width / 2, height / 2);
  return [
    `M${x + r} ${y}`,
    `H${x + width - r}`,
    `A${r} ${r} 0 0 1 ${x + width} ${y + r}`,
    `V${y + height - r}`,
    `A${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
    `H${x + r}`,
    `A${r} ${r} 0 0 1 ${x} ${y + height - r}`,
    `V${y + r}`,
    `A${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z',
  ].join('');
}

/** Two measures half a point apart or less: the screen has stopped moving. */
export function settled(previous: Box | null, next: Box): boolean {
  if (previous === null) return false;
  return (
    Math.abs(previous.x - next.x) <= 0.5 &&
    Math.abs(previous.y - next.y) <= 0.5 &&
    Math.abs(previous.width - next.width) <= 0.5 &&
    Math.abs(previous.height - next.height) <= 0.5
  );
}
```

The ring's box is the hole outset by half the stroke more than the gap's own outset (`gap + ring / 2` from the target), so a 2 pt stroke centred on it sits 5–7 pt out, as the canvas draws it. Check the expected values in the tests against this: hole `gap` = 5, ring `gap + 1` = 6.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run lib/__tests__/tips.test.ts`
Expected: PASS. If an expected number in a test disagrees with the geometry described in the spec, fix the test only when the spec's geometry backs the code; otherwise fix the code.

- [ ] **Step 5: Commit**

```bash
git add lib/tips.ts lib/__tests__/tips.test.ts
git commit -m "feat(tips): where a tip goes, and whether a screen shows its tips (#183)"
```

---

### Task 2: Tips state in the progress store

**Files:**

- Modify: `stores/progress.ts`
- Modify: `stores/__tests__/progress.test.ts`
- Modify: `.claude/rules/stores.md` (the persisted list gains "which tips have shown")

**Interfaces:**

- Consumes: `TipScreen` from `lib/tips.ts`.
- Produces: `useProgress` state `tipsSeen: TipScreen[]` (default `[]`), `tipsSkipped: boolean` (default `false`); actions `markTipsSeen(screen: TipScreen): void` (idempotent), `skipTips(): void`. Both survive `reset()`.

- [ ] **Step 1: Write the failing tests** (append to `stores/__tests__/progress.test.ts`; extend its `beforeEach` with `tipsSeen: [], tipsSkipped: false`)

```ts
describe('how to play tips', () => {
  it('starts with nothing seen and nothing skipped', () => {
    const initial = useProgress.getInitialState();
    expect(initial.tipsSeen).toEqual([]);
    expect(initial.tipsSkipped).toBe(false);
  });

  it('marks a screen seen once', () => {
    useProgress.getState().markTipsSeen('picker');
    useProgress.getState().markTipsSeen('picker');
    useProgress.getState().markTipsSeen('study');
    expect(useProgress.getState().tipsSeen).toEqual(['picker', 'study']);
  });

  it('skips for good', () => {
    useProgress.getState().skipTips();
    expect(useProgress.getState().tipsSkipped).toBe(true);
  });

  it('survives reset', () => {
    useProgress.getState().markTipsSeen('difficulty');
    useProgress.getState().skipTips();
    useProgress.getState().reset();
    expect(useProgress.getState().tipsSeen).toEqual(['difficulty']);
    expect(useProgress.getState().tipsSkipped).toBe(true);
  });

  it('persists both', () => {
    useProgress.getState().markTipsSeen('picker');
    useProgress.getState().skipTips();
    const stored = JSON.parse(disk.get('escuadra-progress') ?? '{}') as {
      state: { tipsSeen: unknown; tipsSkipped: unknown };
    };
    expect(stored.state.tipsSeen).toEqual(['picker']);
    expect(stored.state.tipsSkipped).toBe(true);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run stores/__tests__/progress.test.ts`
Expected: FAIL, `markTipsSeen` is not a function.

- [ ] **Step 3: Implement**

In `stores/progress.ts`: `import type { TipScreen } from '@/lib/tips';`. In `ProgressState`, after `starredSquads`:

```ts
  /** How to play (#183): the screens whose tips have shown, each once. A
   *  preference like `themePreference`, so it survives `reset()`. */
  tipsSeen: TipScreen[];
  /** Skip tips: no screen shows its tips again. Survives `reset()`. */
  tipsSkipped: boolean;
```

and with the actions:

```ts
  markTipsSeen: (screen: TipScreen) => void;
  skipTips: () => void;
```

In the initial state `tipsSeen: [], tipsSkipped: false,` and the actions:

```ts
      markTipsSeen: (screen) =>
        set((s) => (s.tipsSeen.includes(screen) ? s : { tipsSeen: [...s.tipsSeen, screen] })),
      skipTips: () => set({ tipsSkipped: true }),
```

`reset()` stays `set({ bestScores: {}, lastPlayed: null })`. No `version` bump: `persist` merges new defaulted fields over the initial state.

In `.claude/rules/stores.md`, change "best scores, teams played, starred teams, preferences" to "best scores, teams played, starred teams, which How to play tips have shown, preferences".

- [ ] **Step 4: Run and see them pass**

Run: `npx vitest run stores/__tests__/progress.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add stores/progress.ts stores/__tests__/progress.test.ts .claude/rules/stores.md
git commit -m "feat(tips): remember which screens showed their tips, and Skip (#183)"
```

---

### Task 3: Tokens

**Files:**

- Modify: `theme/tokens.ts`
- Modify: `theme/__tests__/tokens.test.ts`

**Interfaces:**

- Produces:
  - Palette roles in both palettes: `tipScrim`, `tipBacking`, `tipBody`.
  - `export const tips` (shape `TipGeometry` from `lib/tips.ts` plus `settleCap`, `skipHeight`, `dot`, `dotActive`, `backingBlur`, `backingSpread`).
  - `durations.tipFade: 200`.
  - Typography: `tipKicker`, `tipHeading`, `tipBody`, `tipButton`, `tipSkip`.

- [ ] **Step 1: Write the failing tests** (in `theme/__tests__/tokens.test.ts`, using its `blend` helper)

```ts
describe('how to play tips (#183)', () => {
  // A tip's text sits on the backing, over the scrim, over whatever the screen
  // shows. The worst case under the scrim is the ground's opposite: white in dark,
  // black in light.
  const worst = { dark: '#ffffff', light: '#000000' } as const;

  it.each(['dark', 'light'] as const)('%s: the tip text holds AA over its worst ground', (name) => {
    const p = palettes[name];
    const under = blend(p.tipBacking, blend(p.tipScrim, worst[name]));
    for (const role of ['textPrimary', 'tipBody', 'accentLine'] as const) {
      expect(contrastRatio(p[role], under), `${name}.${role}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the fade under the motion rule', () => {
    expect(durations.tipFade).toBeLessThan(300);
  });
});
```

Import `durations` if the file does not already.

- [ ] **Step 2: Run and see it fail**

Run: `npx vitest run theme/__tests__/tokens.test.ts`
Expected: FAIL (type error or undefined roles).

- [ ] **Step 3: Implement**

`Palette` interface, after `ctaLine`:

```ts
// ---- 2.0 How to play (#183) ----
/** The scrim around a tip's target: the ground's own ink. Translucent; a
 *  composite test holds the tip's text over it. */
tipScrim: string;
/** The soft backing behind a tip's text, so the dimmed screen never shows
 *  through it. Translucent. */
tipBacking: string;
/** A tip's body line. */
tipBody: string;
```

`darkRoles`: `tipScrim: 'rgba(8,9,12,0.82)', tipBacking: 'rgba(8,9,12,0.78)', tipBody: '#dfe1e6',`
`lightRoles`: `tipScrim: 'rgba(247,247,249,0.9)', tipBacking: 'rgba(247,247,249,0.85)', tipBody: '#4b4f56',`

`durations`, after `scrim`: `tipFade: 200, // a How to play tip fading in (#183)`.

Typography, after `homeHint`:

```ts
  // ---- 2.0 How to play (#183) ----
  // "HOW TO PLAY · 1/3".
  tipKicker: {
    fontFamily: 'IBMPlexMono-SemiBold',
    fontWeight: '600' as const,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  tipHeading: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 26,
    lineHeight: 28,
    textTransform: 'uppercase' as const,
  },
  tipBody: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 16, lineHeight: 22 },
  // Next and Got it.
  tipButton: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  tipSkip: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 14 },
```

A new exported token after `sizes` (the canvas's values):

```ts
// How to play (#183): the gap round a tip's target and the ring's stroke; the
// arrow's box, its stroke and the space either side of it; the tip's side
// margin; how far below the safe area the tip stays, clear of Skip tips (Skip's
// top margin and height, and a gap); how long the first measure may wait for a
// pushed screen to settle; Skip's height; the step dots; and the blur and
// spread of the backing's soft edge.
export const tips = {
  gap: 5,
  ring: 2,
  arrow: { width: 40, height: 40 },
  arrowStroke: 2.5,
  arrowGap: 4,
  tipGap: 8,
  gutter: 24,
  skipClear: 96,
  settleCap: 600,
  skipHeight: 40,
  dot: 6,
  dotActive: 18,
  backingBlur: 30,
  backingSpread: 32,
} as const;
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run theme/__tests__/tokens.test.ts`
Expected: PASS. If the light body fails AA, darken `tipBody` (light) or raise the light scrim's alpha, not the test.

- [ ] **Step 5: Commit**

```bash
git add theme/tokens.ts theme/__tests__/tokens.test.ts
git commit -m "feat(tips): the tips' palette roles, type and geometry (#183)"
```

---

### Task 4: Text, in five languages, and About's stored list

**Files:**

- Modify: `i18n/en.ts`, `i18n/budgets.ts`, `i18n/de.ts`, `i18n/es.ts`, `i18n/fr.ts`, `i18n/it.ts`
- Modify: `i18n/__tests__/catalogs.test.ts` (the About hash only, after all five `about`s change)

**Interfaces:**

- Produces `t.tips`:
  - `kicker(step: number, count: number): string`, `spoken(step: number, count: number): string`, `next`, `gotIt`, `skip`
  - `picker.switch`, `picker.pick`, `difficulty.start`, `difficulty.star`, `difficulty.study`, `study.hide`, `study.positions`, each `{ heading: string; body: string }`

- [ ] **Step 1: Add the English section**, after `home` in `i18n/en.ts` (keys and budgets in this order, so `budgets.ts` follows the file order):

```ts
  tips: {
    /** ≤ 22 chars: over each tip, in mono capitals. */
    kicker: (step: number, count: number) => `How to play · ${step}/${count}`,
    /** A tip's spoken name, as a dialog. */
    spoken: (step: number, count: number) => `How to play, tip ${step} of ${count}`,
    /** ≤ 10 chars: the button to the next tip, in display capitals. */
    next: 'Next',
    /** ≤ 12 chars: the last tip's button, in display capitals. */
    gotIt: 'Got it',
    /** ≤ 14 chars: the pill at the top left that ends every screen's tips. */
    skip: 'Skip tips',
    // Each tip's heading is ≤ 32 chars, in display capitals, and may wrap to
    // two lines; its body is ≤ 120 chars.
    picker: {
      switch: {
        heading: 'Clubs or nations',
        body: 'Switch here, then narrow it down by league or confederation.',
      },
      pick: { heading: 'Pick a squad', body: 'Tap any team to see its levels and start.' },
    },
    difficulty: {
      start: {
        heading: 'Start here',
        body: 'You get a shirt number and a few clues, and pick the name. Score 8/10 to unlock level 2.',
      },
      star: { heading: 'Make it yours', body: 'Star a team and it waits for you on Home.' },
      study: {
        heading: 'Or study first',
        body: 'Browse the whole squad. Hide the names to test yourself.',
      },
    },
    study: {
      hide: { heading: 'Test yourself', body: 'Hide the names, then tap a card to check yourself.' },
      positions: {
        heading: 'One position at a time',
        body: 'Learn the keepers, then the defence, the midfield and the attack.',
      },
    },
  },
```

The comment over `picker` carries two `≤ N chars` markers, 32 then 120: the budgets test reads them in file order as two groups, which Step 2 mirrors.

- [ ] **Step 2: Mirror the budgets** in `i18n/budgets.ts`, after the `home.starHint` group, in this order:

```ts
  { budget: 22, texts: { 'tips.kicker': (m) => m.tips.kicker(3, 3) } },
  { budget: 10, texts: { 'tips.next': (m) => m.tips.next } },
  { budget: 12, texts: { 'tips.gotIt': (m) => m.tips.gotIt } },
  { budget: 14, texts: { 'tips.skip': (m) => m.tips.skip } },
  {
    budget: 32,
    texts: {
      'tips.picker.switch.heading': (m) => m.tips.picker.switch.heading,
      'tips.picker.pick.heading': (m) => m.tips.picker.pick.heading,
      'tips.difficulty.start.heading': (m) => m.tips.difficulty.start.heading,
      'tips.difficulty.star.heading': (m) => m.tips.difficulty.star.heading,
      'tips.difficulty.study.heading': (m) => m.tips.difficulty.study.heading,
      'tips.study.hide.heading': (m) => m.tips.study.hide.heading,
      'tips.study.positions.heading': (m) => m.tips.study.positions.heading,
    },
  },
  {
    budget: 120,
    texts: {
      'tips.picker.switch.body': (m) => m.tips.picker.switch.body,
      'tips.picker.pick.body': (m) => m.tips.picker.pick.body,
      'tips.difficulty.start.body': (m) => m.tips.difficulty.start.body,
      'tips.difficulty.star.body': (m) => m.tips.difficulty.star.body,
      'tips.difficulty.study.body': (m) => m.tips.difficulty.study.body,
      'tips.study.hide.body': (m) => m.tips.study.hide.body,
      'tips.study.positions.body': (m) => m.tips.study.positions.body,
    },
  },
```

- [ ] **Step 3: About's stored list.** In `en.about.privacy`, "What is stored on your device": "ten things" → "eleven things"; insert "which How to play tips you have seen, and whether you skipped them;" after "whether the Study screen shows cards or a list;"; and "only two of those ten things" → "only two of those eleven things". Make the same change in each catalog's `about` (de "zehn"→"elf", es, fr "dix"→"onze" with **tu** forms, it "dieci"→"undici"), using each catalog's own word for the tips (the same word its `tips.kicker` uses).

- [ ] **Step 4: Translate `tips`** in `de`, `es`, `fr` (France usage, **tu**), `it`. Use each catalog's existing football vocabulary and screen names (read its `picker`, `ladder` and `study` sections first: "Study" is "Effectif" in fr, "Rosa" in it, the Kader view in de). Headings in sentence case; the style capitalises.

- [ ] **Step 5: Run the i18n tests**

Run: `npx vitest run i18n`
Expected: the catalogs test fails only on the About hash. Update the hash as its comment says (the failure prints the new one), then all pass.

- [ ] **Step 6: Commit**

```bash
git add i18n
git commit -m "feat(tips): the tips' text in five languages, and About counts what they store (#183)"
```

The controller then runs a fresh native-speaker review per language (Task 9) before the PR.

---

### Task 5: `TipsLayer` and `useTips`

**Files:**

- Create: `components/TipsLayer.tsx`
- Create: `components/useTips.ts`

**Interfaces:**

- Consumes: `placeTip`, `scrollDelta`, `settled`, `TipScreen`, `Box` (Task 1); `useProgress` `tipsSeen`, `tipsSkipped`, `markTipsSeen`, `skipTips`, and `useProgressHydrated` (Task 2); `tips`, `durations.tipFade`, typography and palette roles (Task 3); `t.tips` (Task 4); `useReduceMotion` (`components/useReduceMotion.ts`).
- Produces:

```ts
// components/useTips.ts
export interface Tips {
  open: boolean;
  close: () => void;
  skip: () => void;
  /** Spread on the screen's content while the tips show: Android's screen
   *  readers then reach only the tip. iOS uses the layer's own modal flag. */
  contentA11y: {
    importantForAccessibility?: 'no-hide-descendants';
    accessibilityElementsHidden?: boolean;
  };
}
export function useTips(screen: TipScreen): Tips;

// components/TipsLayer.tsx
export interface TipSpec {
  target: RefObject<View | null>;
  radius: number;
  heading: string;
  body: string;
}
export function TipsLayer(props: {
  tips: readonly TipSpec[];
  onClose: () => void;
  onSkip: () => void;
  /** Scrolls the screen by `dy` points, without animation, for a target below the fold. */
  scrollBy?: (dy: number) => void;
}): JSX.Element;
```

- [ ] **Step 1: `components/useTips.ts`**

```ts
import { useEffect, useRef, useState } from 'react';
import { shouldShowTips, type TipScreen } from '@/lib/tips';
import { useProgress, useProgressHydrated } from '@/stores/progress';

// Whether a screen opens with its How to play tips (#183). Decided once, after
// the store has hydrated, so a returning player never sees a flash of them. The
// screen is marked seen as the first tip shows: leaving mid-way never brings
// them back.
export function useTips(screen: TipScreen): Tips {
  const hydrated = useProgressHydrated();
  const [open, setOpen] = useState(false);
  const decided = useRef(false);

  useEffect(() => {
    if (!hydrated || decided.current) return;
    decided.current = true;
    const s = useProgress.getState();
    if (!shouldShowTips(screen, s.tipsSeen, s.tipsSkipped)) return;
    s.markTipsSeen(screen);
    setOpen(true);
  }, [hydrated, screen]);

  return {
    open,
    close: () => setOpen(false),
    skip: () => {
      useProgress.getState().skipTips();
      setOpen(false);
    },
    contentA11y: open
      ? { importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true }
      : {},
  };
}
```

(Declare the `Tips` interface above the function as in Interfaces.)

- [ ] **Step 2: `components/TipsLayer.tsx`.** Build it to this behaviour; the code below is the shape, adjust names to lint and types:

- Root: `View` absolutely filling the screen (`StyleSheet.absoluteFill`), `testID="tips-layer"`, `accessibilityViewIsModal`, `ref={rootRef}`.
- State: `step` (0-based), `box: Box | null` (the target in the layer's coordinates), `tipHeight: number | null`.
- **Measuring** (an effect on `step`): poll on `requestAnimationFrame`. Each frame, `rootRef.current.measureInWindow` and `tips[step].target.current.measureInWindow`; the box is target minus root origin. Accept when `settled(previous, next)` or `tips.settleCap` ms have passed since the step started. If `scrollBy` is given and `scrollDelta({ target: box, radius, screen, insets }, geometry) > 0`, call `scrollBy(delta)`, reset the previous measure and keep polling (once per step, so a scroll that cannot go further never loops). Then `setBox(box)`. Cancel the frame on cleanup. A missing target (`ref.current === null`) after the cap moves on to the next step, or closes on the last.
- `geometry`: the `tips` token is a `TipGeometry` (extra keys are fine); screen from `useWindowDimensions()`; insets from `useSafeAreaInsets()`.
- **The tip** is always rendered (so `onLayout` reports its height) with `opacity: 0` until `box` and `tipHeight` are known. `left: tips.gutter, right: tips.gutter`, `top: placement.tipTop`. Contents, gap `spacing.xs + 2`:
  - kicker `t.tips.kicker(step + 1, n)` in `typography.tipKicker`, `colors.accentLine`;
  - heading in `typography.tipHeading`, `colors.textPrimary`, `maxFontSizeMultiplier={fontScaleCap.display}`, with a ref for focus;
  - body in `typography.tipBody`, `colors.tipBody`;
  - a row, `justifyContent: 'space-between'`, `marginTop: spacing.xs`: the dots (`accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`), each `tips.dot` tall and `tips.dot` wide, the current one `tips.dotActive` wide, `radii.pill`, `textPrimary` for the current, `border` for the rest; and Next/Got it, `testID="tip-next"`, `accessibilityRole="button"`, height `sizes.minTapTarget`, `paddingHorizontal: spacing.lg + 2`, `radii.pill`, `ctaBg`, label `typography.tipButton` in `ctaText`.
  - The tip's container: `role="dialog"`, `aria-modal`, `accessibilityLabel={t.tips.spoken(step + 1, n)}`, `backgroundColor: colors.tipBacking`, `borderRadius: radii.lg`, `boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: tips.backingBlur, spreadDistance: tips.backingSpread, color: colors.tipBacking }]`.
  - Wrap it in `Animated.View` keyed by `step` with `entering={reduceMotion ? undefined : FadeIn.duration(durations.tipFade)}`.
- **Scrim, ring, arrow:** one `Svg` filling the layer, `pointerEvents="none"`, hidden from screen readers, drawn only once `box` is known:
  - `<Path d={scrimPath} fill={colors.tipScrim} fillRule="evenodd" />` where `scrimPath` is the full-screen rect `M0 0H{w}V{h}H0Z` followed by `roundedRectPath(placement.hole)` (Task 1).
  - `<Rect x y width height rx ry stroke={colors.accentLine} strokeWidth={tips.ring} fill="none" />` from `placement.ring`.
  - The arrow, a `G` translated to `placement.arrow` and mirrored with `scale(-1,1)` about its centre when `flip`: pointing up (tip below) `M10 36 C 6 24, 10 12, 24 4` and head `M13 5 L25 3 L23 15`; pointing down (tip above) `M10 4 C 6 16, 10 28, 24 36` and head `M13 35 L25 37 L23 25`; stroke `textPrimary`, width `tips.arrowStroke`, round caps and joins, no fill.
- **Tap anywhere:** a `Pressable` filling the layer, under the tip and Skip, `onPress={advance}`, hidden from screen readers (`accessibilityElementsHidden`, `importantForAccessibility="no"`), `testID="tips-catcher"`.
- **Skip tips:** `Pressable`, `testID="tips-skip"`, `accessibilityRole="button"`, absolute `top: insets.top + spacing.xs`, `left: spacing.md`, height `tips.skipHeight`, `paddingHorizontal: spacing.md`, `radii.pill`, `surfaceRaised` fill, `borderWidths.hairline` in `border`, label `t.tips.skip` in `typography.tipSkip`, `textPrimary`. `onPress={onSkip}`.
- **advance:** last step → `onClose()`; else `setStep(step + 1)`, `setBox(null)`.
- **Android back:** `BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; })` while mounted.
- **Focus:** when a step becomes placed, `AccessibilityInfo.sendAccessibilityEvent(headingRef.current, 'focus')` if the ref is set (wrap in a null check).

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: clean. A literal string in JSX (other than testIDs and the SVG path data in constants outside JSX) fails lint: move path strings to module constants.

- [ ] **Step 4: Commit**

```bash
git add components/TipsLayer.tsx components/useTips.ts
git commit -m "feat(tips): the How to play layer (#183)"
```

---

### Task 6: Tips on the team picker

**Files:**

- Modify: `app/team-picker.tsx`
- Modify: `components/TeamRow.tsx` (accept `ref?: Ref<View>`, passed to its `Pressable`; React 19 passes `ref` as a prop)

**Interfaces:**

- Consumes: `useTips`, `TipsLayer`, `TipSpec` (Task 5); `t.tips.picker` (Task 4); `radii` tokens.

- [ ] **Step 1: Targets.** Wrap `<KindTabs …/>` and the pill `ScrollView` in one `View` with `ref={switchRef}`, `collapsable={false}` and `style={{ gap: spacing.md + 2 }}` (the header's own gap, so the layout does not move). Give the first row its ref: the first starred row when `starred.length > 0`, else the first club row (`filter` is `club` when the tips open). Pass it through `row(item, card, ref?)` to `TeamRow`'s `ref`.
- [ ] **Step 2: The layer.** `const tips = useTips('picker');` After the rail, `{tips.open && <TipsLayer tips={[{ target: switchRef, radius: radii.xl, ...t.tips.picker.switch }, { target: firstRowRef, radius: radii.lg, ...t.tips.picker.pick }]} onClose={tips.close} onSkip={tips.skip} scrollBy={(dy) => scrollRef.current?.scrollTo({ y: scrollY.get() + dy, animated: false })} />}`. Spread `tips.contentA11y` on the `Animated.ScrollView` and on the rail's `Animated.View`.
- [ ] **Step 3: Check**: `npm run typecheck && npm run lint`, then `npx expo start --web`, open `/team-picker` in a fresh private window (empty storage) and confirm both tips, the ring on the tabs and pills, then on the first row; a reload shows none.
- [ ] **Step 4: Commit** `feat(tips): How to play on the team picker (#183)`.

---

### Task 7: Tips on Difficulty

**Files:**

- Modify: `app/team/[squadId]/difficulty.tsx`
- Modify: `components/LadderHero.tsx` (prop `starRef?: Ref<View>` on the star's `Pressable`)
- Modify: `components/LadderCard.tsx` (prop `playRef?: Ref<View>` on Play's `Pressable`)

- [ ] **Step 1:** Wrap the screen's `ScrollView` in a root `View` (`flex: 1`, `colors.background`); the `ScrollView` keeps its content and gets `ref={scrollRef}`, `onScroll` storing `contentOffset.y` in a ref, `scrollEventThrottle={16}`, and `{...tips.contentA11y}`.
- [ ] **Step 2:** Refs: `starRef` into `LadderHero`, `playRef` into the focused `LadderCard`, `studyRef` on the Study `Pressable`.
- [ ] **Step 3:** `const tips = useTips('difficulty');` and after the `ScrollView`: `{tips.open && <TipsLayer tips={[{ target: playRef, radius: radii.pill, ...t.tips.difficulty.start }, { target: starRef, radius: radii.pill, ...t.tips.difficulty.star }, { target: studyRef, radius: radii.pill, ...t.tips.difficulty.study }]} onClose={tips.close} onSkip={tips.skip} scrollBy={(dy) => scrollRef.current?.scrollTo({ y: offset.current + dy, animated: false })} />}`.
- [ ] **Step 4: Check**: typecheck, lint; on web at 360 × 640, the third tip scrolls Study into view and the tip sits above it.
- [ ] **Step 5: Commit** `feat(tips): How to play on Difficulty (#183)`.

---

### Task 8: Tips on Study

**Files:**

- Modify: `app/team/[squadId]/study.tsx`

- [ ] **Step 1:** `hideRef` on the Hide names `Pressable`. Inside the filters `ScrollView`, wrap the `FilterPill`s in `<View ref={filtersRef} collapsable={false} style={styles.filterRow}>` with `filterRow: { flexDirection: 'row', gap: spacing.xs - 2 }`, and drop `gap` from `styles.filters` (keep its padding), so nothing moves.
- [ ] **Step 2:** `const tips = useTips('study');` Spread `tips.contentA11y` on the top bar, header, filter `ScrollView` and `FlatList`. After the `FlatList`: `{tips.open && <TipsLayer tips={[{ target: hideRef, radius: radii.pill, ...t.tips.study.hide }, { target: filtersRef, radius: radii.pill, ...t.tips.study.positions }]} onClose={tips.close} onSkip={tips.skip} />}`.
- [ ] **Step 3: Check**: typecheck, lint, web.
- [ ] **Step 4: Commit** `feat(tips): How to play on Study (#183)`.

---

### Task 9: Screens, docs and review (controller)

**Files:**

- Modify: `scripts/capture-screens.mjs`, `design/SCREENS.md`, `design/screens/*`

- [ ] **Step 1: Shots.** In `captureTheme`, after `01-home`, capture the tips on fresh storage: open `/team-picker`, wait for `tips-layer`, shoot `02c-team-picker-tip-1`, tap `tip-next`, shoot `02c-team-picker-tip-2`; open `/team/rma/difficulty`, shoot `04f-difficulty-tip-1`, `-2`, `-3`; open `/team/rma/study` (the study capture's squad, see `captureStudy`), shoot `05b-study-tip-1`, `-2`. Then a `seedTipsSkipped(capture)` helper (like `seedStarred`) writes `tipsSkipped: true`, so every later shot is as today. Wait out the fade (`REVEAL_MS`) before each shot.
- [ ] **Step 2:** `npm run shots`. Check the new PNGs against the canvas, in both themes, and that no existing PNG changed except by its own drift (`git diff --stat design/screens`).
- [ ] **Step 3:** `design/SCREENS.md`: a line on the How to play layer under the picker, Difficulty and Study rows, and the new files in the table.
- [ ] **Step 4: Language review.** For each of en, de, es, fr (France, tu), it: a fresh native-speaker subagent reviews `tips` and the changed About paragraph, back-translating, flagging only defects that block publication, re-dispatched fresh until "No findings". Meaning changes go to the owner.
- [ ] **Step 5: Privacy pages.** `PRIVACY_PAGES=<scratch> PRIVACY_UPDATED=<date> npx vitest run scripts/__tests__/privacy-pages.test.ts`, diff each against `git show origin/gh-pages:privacy/2/<page>`, keep the diff for the PR body. Never push `gh-pages`.
- [ ] **Step 6:** `npm run check`; commit `docs(tips): screens and SCREENS.md for How to play (#183)`.
