# Design ↔ App Loop, Turn 0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the repo so the Claude Design project can run a six-screen visual re-pass against reality — brand tokens, the 2a mark, per-nation flag data, a `design/` handoff folder, and a scripted screenshot capture.

**Architecture:** The repo is the source of truth. `theme/` holds the real definitions; `design/` is a thin re-export surface plus prose and captured PNGs, pushed to the design project via `DesignSync`. The 2a mark is axis-aligned rectangles and one circle, so it renders in plain React Native `<View>`s — no `react-native-svg`. Flags are declarative band geometry, not assets or emoji, so they render identically on web and iOS.

**Tech Stack:** Expo SDK 54 (pinned), React Native 0.81, expo-router, Zustand, Vitest, Playwright (new, dev-only), expo-linear-gradient (new).

## Global Constraints

Copied verbatim from `docs/superpowers/specs/2026-08-21-design-app-loop-design.md` and `CLAUDE.md`. Every task's requirements implicitly include this section.

- **Do not upgrade the Expo SDK.** `package.json` is pinned to what App Store Expo Go supports. Expo Go on a physical iPhone is the only way this app runs.
- **Read the versioned Expo docs** at https://docs.expo.dev/versions/v54.0.0/ — not `latest`, which describes SDK 57+ APIs this project cannot use.
- **Never hardcode a colour, spacing value, or font size.** Everything comes from `theme/tokens.ts`. If a token is missing, add it to the token file. Team identity colour is content, not a design choice, and is exempt.
- **No club crests, badges, logos, or shield shapes. Ever.** National flags are not covered by this rule — the rationale is trademark exposure, which flags do not carry.
- **No text input anywhere. No keyboard.** Taps only.
- **No auth, no accounts, no analytics SDKs, no network calls.** v0 is fully offline.
- **Every animation stays under 300ms.**
- **The product is called Escuadra.** "Squad Trainer", "Squad Game", "Squad Quiz" are stale — fix on sight.
- **TypeScript is strict, including `noUncheckedIndexedAccess`.** Do not weaken it to make an error go away.
- **`lib/questionEngine.ts` stays pure.** No React, no store imports, no I/O.
- Run `npm run check` (typecheck + lint + prettier + vitest) before reporting any task complete.

---

### Task 1: Brand tokens, Inter 800, and gradient rendering

Adds the mark's palette and gradients to the token contract, the ExtraBold weight the wordmark needs, and the one dependency that lets React Native draw a gradient at all. Also widens the Vitest include glob so `theme/` and `design/` tests run — later tasks depend on that.

**Files:**

- Modify: `theme/tokens.ts` (add to `colors`; add new `gradients` export)
- Modify: `theme/fonts.ts` (add Inter 800)
- Modify: `vitest.config.ts` (widen `include`)
- Modify: `package.json` (add `expo-linear-gradient`)
- Create: `components/BrandGradient.tsx`
- Test: `theme/tokens.test.ts`

**Interfaces:**

- Consumes: nothing (first task).
- Produces:
  - `colors.brandBright`, `colors.brandDeep`, `colors.brandSoft`, `colors.brandLift`, `colors.brandPlateTop`, `colors.brandPlateBottom` — all `string`.
  - `gradients` — `Record<'mark' | 'markSoft' | 'plate', { colors: readonly string[]; start: {x:number;y:number}; end: {x:number;y:number} }>`.
  - `typography.wordmark` — for Task 3.
  - `fontAssets['Inter-ExtraBold']`.
  - `<BrandGradient gradient={...} style={...}>{children}</BrandGradient>` — for Task 3.

- [ ] **Step 1: Install the gradient package**

`expo install` picks the version matching SDK 54 rather than the latest, which would break Expo Go.

```bash
npx expo install expo-linear-gradient
```

Expected: `package.json` gains `"expo-linear-gradient": "~15.0.x"`. If it resolves to a version outside `~15.x`, stop — that signals an SDK mismatch, and the Expo Go constraint is at risk.

- [ ] **Step 2: Write the failing token test**

Create `theme/tokens.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { colors, gradients, typography } from './tokens';

const HEX = /^#[0-9a-fA-F]{6}$/;

describe('brand tokens', () => {
  it('every brand colour is a full-length hex', () => {
    for (const key of [
      'brandBright',
      'brandDeep',
      'brandSoft',
      'brandLift',
      'brandPlateTop',
      'brandPlateBottom',
    ] as const) {
      expect(colors[key], key).toMatch(HEX);
    }
  });

  it('every gradient has at least two stops, all valid hex', () => {
    for (const [name, g] of Object.entries(gradients)) {
      expect(g.colors.length, name).toBeGreaterThanOrEqual(2);
      for (const stop of g.colors) expect(stop, name).toMatch(HEX);
    }
  });

  it('every gradient start and end is inside the unit square', () => {
    for (const [name, g] of Object.entries(gradients)) {
      for (const p of [g.start, g.end]) {
        expect(p.x, name).toBeGreaterThanOrEqual(0);
        expect(p.x, name).toBeLessThanOrEqual(1);
        expect(p.y, name).toBeGreaterThanOrEqual(0);
        expect(p.y, name).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the wordmark uses the ExtraBold family', () => {
    expect(typography.wordmark.fontFamily).toBe('Inter-ExtraBold');
  });
});
```

- [ ] **Step 3: Widen the Vitest include glob**

In `vitest.config.ts`, replace the `include` line:

```ts
    include: [
      'lib/**/*.test.ts',
      'stores/**/*.test.ts',
      'theme/**/*.test.ts',
      'design/**/*.test.ts',
    ],
```

Also update the comment directly above `export default` to stay accurate:

```ts
// lib/ and stores/ hold pure logic worth unit-testing (per CLAUDE.md,
// lib/questionEngine.ts in particular must stay React-free and testable).
// theme/ and design/ are plain data — tokens, mark geometry, handoff
// re-exports — and are tested for internal consistency only. Screens and
// components are verified on-device instead: no RN test renderer is
// configured here on purpose.
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
npx vitest run theme/tokens.test.ts
```

Expected: FAIL — `gradients` is not exported from `./tokens`.

- [ ] **Step 5: Add the brand colours**

In `theme/tokens.ts`, inside the `colors` object, immediately after the `errorTextDim` entry and before the closing `} as const;`:

```ts
  // Brand palette — the Escuadra mark's own colours, from the 2a design
  // direction. These are design tokens, not team-identity content: the mark
  // belongs to the app's design system, unlike a club's real colours.
  brandBright: '#5b63d6',
  brandDeep: '#2f3585',
  brandSoft: '#8f97ea',
  brandLift: '#6d76e6',
  // The icon plate's gradient ends. Distinct from the mark's own stops —
  // the plate sits behind the mark, so it runs deeper.
  brandPlateTop: '#4a52c4',
  brandPlateBottom: '#252a6b',
```

- [ ] **Step 6: Add the gradients export**

In `theme/tokens.ts`, immediately after the `colors` object's closing `} as const;`:

```ts
// Gradient stops for the Escuadra mark and its icon plate. React Native
// cannot paint a gradient from a plain View, so these are declarative data
// consumed by <BrandGradient>, which wraps expo-linear-gradient.
//
// `start`/`end` are unit-square coordinates. The design source specified the
// plate as CSS `linear-gradient(140deg, ...)`; 140deg points down and to the
// right, which is {x:0,y:0} → {x:0.64,y:1} here.
export const gradients = {
  mark: {
    colors: [colors.brandBright, colors.brandDeep],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  markSoft: {
    colors: [colors.accent, colors.brandLift],
    start: { x: 0, y: 1 },
    end: { x: 1, y: 0 },
  },
  plate: {
    colors: [colors.brandPlateTop, colors.brandPlateBottom],
    start: { x: 0, y: 0 },
    end: { x: 0.64, y: 1 },
  },
} as const;

export type GradientName = keyof typeof gradients;
```

- [ ] **Step 7: Add the wordmark type token**

In `theme/tokens.ts`, inside the `typography` object, after the `chipLabel` entry:

```ts
  // The wordmark's "escuadra" lockup. ExtraBold at -0.02em, per the 2a
  // design source. The only place Inter 800 is used.
  wordmark: {
    fontFamily: 'Inter-ExtraBold',
    fontWeight: '800' as const,
    fontSize: 23,
    letterSpacing: -0.46,
  },
```

- [ ] **Step 8: Add the Inter 800 font asset**

In `theme/fonts.ts`, add the import alongside the existing Inter imports (keep alphabetical-by-weight order, so after `Inter_700Bold`):

```ts
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
```

And in the `fontAssets` object, after the `'Inter-Bold'` entry:

```ts
  'Inter-ExtraBold': Inter_800ExtraBold,
```

Note the existing file header comment already explains why these are imported from per-weight subpaths rather than the package root — do not change that pattern; the root barrel costs ~6 MB of unused fonts.

- [ ] **Step 9: Run the test to verify it passes**

```bash
npx vitest run theme/tokens.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 10: Create the gradient component**

Create `components/BrandGradient.tsx`:

```tsx
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { gradients, type GradientName } from '@/theme/tokens';

interface BrandGradientProps {
  gradient: GradientName;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

// The only place a gradient is painted. Gradient stops live in
// `theme/tokens.ts` as data; this is the renderer that gives them somewhere
// to land, since a plain View cannot paint one.
//
// No consumer until the icon plate lands in Turn 2. It is built now, with the
// tokens, so the dependency resolves and typechecks against the pinned SDK
// before anything is built on top of it. That is not the same as proving it
// paints correctly in Expo Go — that check happens when the icon plate first
// renders it.
export function BrandGradient({ gradient, style, children }: BrandGradientProps) {
  const g = gradients[gradient];
  return (
    <LinearGradient colors={g.colors} start={g.start} end={g.end} style={style}>
      {children}
    </LinearGradient>
  );
}
```

- [ ] **Step 11: Run the full check**

```bash
npm run check
```

Expected: typecheck clean, lint clean, prettier clean, all Vitest suites pass.

If `LinearGradient`'s `colors` prop rejects the readonly tuple under strict mode, widen at the call site with `colors={[...g.colors] as [string, string]}` rather than loosening the token types — the tokens being `as const` is deliberate.

- [ ] **Step 12: Commit**

```bash
git add theme/tokens.ts theme/tokens.test.ts theme/fonts.ts vitest.config.ts components/BrandGradient.tsx package.json package-lock.json
git commit -m "feat(brand): add mark palette, gradient tokens and Inter 800"
```

---

### Task 2: The 2a mark

Transcribes the chosen logo direction into geometry data plus a component. The geometry test guards the property that makes 2a cheap — a clean single-colour silhouette — so a later tweak that breaks it fails loudly.

**Files:**

- Create: `theme/brand.ts`
- Create: `components/EscuadraMark.tsx`
- Test: `theme/brand.test.ts`

**Interfaces:**

- Consumes: `colors` from Task 1.
- Produces:
  - `MARK_VIEWBOX: 64`
  - `markGeometry: { crossbar: Rect; post: Rect; ball: { cx: number; cy: number; r: number }; trail: readonly { x: number; y: number; size: number; opacity: number }[] }` where `Rect = { x: number; y: number; w: number; h: number }`
  - `<EscuadraMark size={number} color={string} showTrail?={boolean} />` — for Task 3 and Task 5.

- [ ] **Step 1: Write the failing geometry test**

Create `theme/brand.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MARK_VIEWBOX, markGeometry } from './brand';

// The 2a mark's value is a clean silhouette in a single colour: the ball must
// not collide with either bar, or the shape muddies when everything is one
// fill (the monochrome Android layer, a tinted mark on a coloured plate).
// These tests pin that property so a later nudge to the geometry fails here
// rather than silently degrading the icon.
describe('Escuadra mark geometry', () => {
  const { crossbar, post, ball, trail } = markGeometry;

  it('keeps every shape inside the viewBox', () => {
    expect(crossbar.x + crossbar.w).toBeLessThanOrEqual(MARK_VIEWBOX);
    expect(crossbar.y + crossbar.h).toBeLessThanOrEqual(MARK_VIEWBOX);
    expect(post.x + post.w).toBeLessThanOrEqual(MARK_VIEWBOX);
    expect(post.y + post.h).toBeLessThanOrEqual(MARK_VIEWBOX);
    expect(ball.cx + ball.r).toBeLessThanOrEqual(MARK_VIEWBOX);
    expect(ball.cy + ball.r).toBeLessThanOrEqual(MARK_VIEWBOX);
    expect(ball.cx - ball.r).toBeGreaterThanOrEqual(0);
    expect(ball.cy - ball.r).toBeGreaterThanOrEqual(0);
    for (const t of trail) {
      expect(t.x + t.size).toBeLessThanOrEqual(MARK_VIEWBOX);
      expect(t.y + t.size).toBeLessThanOrEqual(MARK_VIEWBOX);
    }
  });

  it('leaves a gap between the ball and the crossbar', () => {
    const crossbarBottom = crossbar.y + crossbar.h;
    const ballTop = ball.cy - ball.r;
    expect(ballTop).toBeGreaterThan(crossbarBottom);
  });

  it('keeps the ball tangent to the post rather than overlapping it', () => {
    const ballRight = ball.cx + ball.r;
    expect(ballRight).toBeLessThanOrEqual(post.x);
  });

  it('forms a right angle: the post starts where the crossbar ends', () => {
    expect(post.x + post.w).toBe(crossbar.x + crossbar.w);
    expect(post.y).toBe(crossbar.y);
  });

  it('fades the trail progressively', () => {
    for (let i = 1; i < trail.length; i++) {
      const prev = trail[i - 1];
      const curr = trail[i];
      if (!prev || !curr) throw new Error('trail entries must exist');
      expect(curr.opacity).toBeLessThan(prev.opacity);
      expect(curr.size).toBeLessThan(prev.size);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run theme/brand.test.ts
```

Expected: FAIL — cannot resolve `./brand`.

- [ ] **Step 3: Write the geometry**

Create `theme/brand.ts`:

```ts
// The Escuadra mark — direction "2a / La Escuadra" from the Claude Design
// logo iteration. A right angle opening down-left with the ball nested inside
// it: the goal frame's top corner, the escuadra a perfect shot finds.
//
// Coordinates are in a 64-unit grid, transcribed from the design source.
// Consumers scale by `size / MARK_VIEWBOX`. Deliberately axis-aligned
// rectangles plus one circle, so the mark renders in plain React Native
// <View>s — no react-native-svg, no Metro SVG transformer.
//
// The trail is part of the full lockup only. Icon plates drop it: at 29px
// the two squares close up into noise.

export const MARK_VIEWBOX = 64;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const markGeometry = {
  crossbar: { x: 14, y: 10, w: 40, h: 10 } as Rect,
  post: { x: 44, y: 10, w: 10, h: 40 } as Rect,
  ball: { cx: 35, cy: 31, r: 9 },
  trail: [
    { x: 16, y: 44, size: 7, opacity: 0.55 },
    { x: 5, y: 53, size: 5, opacity: 0.3 },
  ],
} as const;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run theme/brand.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Write the mark component**

Create `components/EscuadraMark.tsx`:

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MARK_VIEWBOX, markGeometry } from '@/theme/brand';

interface EscuadraMarkProps {
  /** Rendered edge length in dp. The mark is square. */
  size: number;
  /** Fill for every element. Single-colour by design. */
  color: string;
  /** The two trailing squares. Off by default — icon plates drop them. */
  showTrail?: boolean;
}

// Renders the 2a mark from `theme/brand.ts` geometry using plain Views. Every
// value is derived by scaling the 64-unit grid, so nothing here is a
// hardcoded size and the mark stays crisp at any dimension.
export function EscuadraMark({ size, color, showTrail = false }: EscuadraMarkProps) {
  const u = size / MARK_VIEWBOX;
  const { crossbar, post, ball, trail } = markGeometry;

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <View
        style={{
          position: 'absolute',
          left: crossbar.x * u,
          top: crossbar.y * u,
          width: crossbar.w * u,
          height: crossbar.h * u,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: post.x * u,
          top: post.y * u,
          width: post.w * u,
          height: post.h * u,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: (ball.cx - ball.r) * u,
          top: (ball.cy - ball.r) * u,
          width: ball.r * 2 * u,
          height: ball.r * 2 * u,
          borderRadius: ball.r * u,
          backgroundColor: color,
        }}
      />
      {showTrail &&
        trail.map((t) => (
          <View
            key={`${t.x}-${t.y}`}
            style={{
              position: 'absolute',
              left: t.x * u,
              top: t.y * u,
              width: t.size * u,
              height: t.size * u,
              backgroundColor: color,
              opacity: t.opacity,
            }}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative' },
});
```

- [ ] **Step 6: Run the full check**

```bash
npm run check
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add theme/brand.ts theme/brand.test.ts components/EscuadraMark.tsx
git commit -m "feat(brand): add the 2a mark geometry and renderer"
```

---

### Task 3: The wordmark, on the home screen

Replaces the plain `ESCUADRA` eyebrow string with the real lockup — the mark beside the word in Inter 800, as specified by the design source.

**Files:**

- Create: `components/Wordmark.tsx`
- Modify: `app/index.tsx` (the `eyebrow` Text and its style)

**Interfaces:**

- Consumes: `<EscuadraMark>` (Task 2), `typography.wordmark` and `colors.brandSoft` (Task 1).
- Produces: `<Wordmark size?={number} />` — used on Home now, and available to the results screen in a later turn.

- [ ] **Step 1: Write the wordmark component**

Create `components/Wordmark.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EscuadraMark } from './EscuadraMark';
import { colors, sizes, spacing, typography } from '@/theme/tokens';

interface WordmarkProps {
  /** Mark edge length in dp. Defaults to the token-defined lockup size. */
  size?: number;
}

// The horizontal lockup: mark, then the name set lowercase in Inter 800.
// Lowercase is deliberate and comes from the design source — the old
// uppercase ESCUADRA eyebrow predates the logo iteration.
export function Wordmark({ size = sizes.wordmarkMark }: WordmarkProps) {
  return (
    <View style={styles.root} accessibilityRole="header" accessibilityLabel="Escuadra">
      <EscuadraMark size={size} color={colors.brandSoft} />
      <Text style={styles.word}>escuadra</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  word: { ...typography.wordmark, color: colors.textPrimary },
});
```

- [ ] **Step 2: Add the lockup size token**

In `theme/tokens.ts`, inside the `sizes` object, after the `teamDot` entry:

```ts
  // Escuadra wordmark's mark, matching the 30px mark beside 23px type in the
  // design source's lockup.
  wordmarkMark: 30,
```

- [ ] **Step 3: Swap the home screen eyebrow for the lockup**

In `app/index.tsx`, add the import alongside the existing `Button` import:

```tsx
import { Wordmark } from '@/components/Wordmark';
```

Replace this line:

```tsx
<Text style={styles.eyebrow}>ESCUADRA</Text>
```

with:

```tsx
<Wordmark />
```

Then delete the now-unused `eyebrow` entry from the `StyleSheet.create` block at the bottom of the file. `noUnusedLocals` will not catch an orphaned style key, so this is a manual removal — leaving it behind is dead code.

- [ ] **Step 4: Run the full check**

```bash
npm run check
```

Expected: all green. If lint reports `Text` as unused in `app/index.tsx`, keep it — the file uses `Text` elsewhere for the title and subtitle. If it genuinely became unused, remove it from the import.

- [ ] **Step 5: Verify on device**

```bash
npx expo start -c
```

Scan the QR with the iPhone Camera and open in Expo Go. Confirm the home screen shows the mark and lowercase "escuadra", and that the word renders in ExtraBold rather than falling back to the system face. A visibly lighter weight means Inter 800 did not load — recheck the Task 1 Step 8 import path.

- [ ] **Step 6: Commit**

```bash
git add components/Wordmark.tsx theme/tokens.ts app/index.tsx
git commit -m "feat(brand): replace the home eyebrow with the Escuadra wordmark"
```

---

### Task 4: Per-nation flag data

Adds the `flag` field to the type, the six nation squads, and the picker manifest. Flags need their own field because the existing colour fields are **kit** colours: Japan is `#000B8C` (blue kit) against a white-and-red flag, Armenia `#B70000/#FFFFFF` against a red/blue/orange tricolour.

**Files:**

- Modify: `types/squad.ts` (add `Flag`; add `flag?` to `Squad` and `SquadManifestEntry`)
- Modify: `data/index.json` (six nation entries)
- Modify: `data/squads/{arg,arm,bra,esp,fra,jpn}.json`
- Modify: `.claude/skills/squad-updater/SKILL.md`
- Test: `lib/squads.test.ts` (extend the existing suite)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `Flag` interface, and `flag?: Flag` readable from both `listSquads()` entries and `getSquad(id)`.

- [ ] **Step 1: Write the failing data-integrity tests**

In `lib/squads.test.ts`, add `getSquad` to the existing import:

```ts
import { getRoster, getSquad, listSquads } from './squads';
```

Then add this block inside the existing `describe(manifest.name, ...)`, after the `kind`-conditional block:

```ts
if (manifest.kind === 'nation') {
  it('has flag geometry on both the manifest and the squad file', () => {
    expect(manifest.flag, 'manifest entry').toBeDefined();
    expect(getSquad(manifest.id)?.flag, 'squad file').toBeDefined();
  });

  it('has a flag whose bands are valid hex', () => {
    const flag = manifest.flag;
    if (!flag) throw new Error('flag must be defined');
    expect(flag.bands.length).toBeGreaterThan(0);
    for (const band of flag.bands) expect(band).toMatch(/^#[0-9a-fA-F]{6}$/);
    if (flag.overlay) expect(flag.overlay.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('has band weights matching the band count, when weights are given', () => {
    const flag = manifest.flag;
    if (!flag) throw new Error('flag must be defined');
    if (flag.weights) expect(flag.weights.length).toBe(flag.bands.length);
  });

  it('agrees between the manifest and the squad file', () => {
    expect(getSquad(manifest.id)?.flag).toEqual(manifest.flag);
  });
} else {
  it('carries no flag — flags identify nations only', () => {
    expect(manifest.flag).toBeUndefined();
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run lib/squads.test.ts
```

Expected: FAIL — `Property 'flag' does not exist on type 'SquadManifestEntry'`, and the nation assertions report `undefined`.

- [ ] **Step 3: Add the Flag type**

In `types/squad.ts`, immediately before `export interface Squad`:

```ts
/** A nation's flag as declarative geometry rather than an asset.
 *
 *  Deliberately not the Unicode regional-indicator emoji (🇦🇷): that depends
 *  on an OS flag-emoji font, and Windows ships none — the Playwright capture
 *  step of the design loop runs on Windows Chrome and would hand the design
 *  side "AR" instead of a flag. Geometry renders identically everywhere.
 *
 *  National emblems and coats of arms are omitted. Spain without its arms is
 *  the civil flag; Argentina without the sun and Brazil without the celestial
 *  globe stay unambiguous at this size, and omitting them keeps the marker
 *  consistent with the app's geometric language. */
export interface Flag {
  /** Band fills, in draw order: top-to-bottom for `horizontal`,
   *  left-to-right for `vertical`. A single-entry array is a plain field. */
  bands: string[];
  orientation: 'horizontal' | 'vertical';
  /** Relative band sizes. Omit for equal bands. Spain is [1, 2, 1]. */
  weights?: number[];
  /** A centred device over the field — Japan's disc, Brazil's diamond. */
  overlay?: { shape: 'disc' | 'diamond'; color: string };
}
```

- [ ] **Step 4: Add `flag` to both squad shapes**

In `types/squad.ts`, add to `Squad`, immediately after the `verified` line:

```ts
  /** Nation squads only. Clubs are identified by colour alone, per the
   *  "no crests, ever" constraint. */
  flag?: Flag;
```

And to `SquadManifestEntry`, after its `verified` line:

```ts
  /** Nation squads only — mirrors the squad file's `flag`, since the picker
   *  never imports full squad JSON. Kept in sync by lib/squads.test.ts. */
  flag?: Flag;
```

- [ ] **Step 5: Add the flag data**

These are the six nations currently in the repo. Values are the official flag colours — **hand-check each one before committing**; unlike shirt numbers they are stable and trivially verifiable, so they do not inherit the `verified: false` caveat.

Add the matching `"flag"` object after the `"verified"` field in each of `data/squads/{arg,arm,bra,esp,fra,jpn}.json`, **and** in the corresponding entry of `data/index.json`. The two must be byte-identical — the test in Step 1 compares them.

Argentina — `arg`:

```json
"flag": {
  "bands": ["#75AADB", "#FFFFFF", "#75AADB"],
  "orientation": "horizontal"
}
```

Armenia — `arm`:

```json
"flag": {
  "bands": ["#D90012", "#0033A0", "#F2A800"],
  "orientation": "horizontal"
}
```

Brazil — `bra`:

```json
"flag": {
  "bands": ["#009739"],
  "orientation": "horizontal",
  "overlay": { "shape": "diamond", "color": "#FFDF00" }
}
```

Spain — `esp`:

```json
"flag": {
  "bands": ["#AA151B", "#F1BF00", "#AA151B"],
  "orientation": "horizontal",
  "weights": [1, 2, 1]
}
```

France — `fra`:

```json
"flag": {
  "bands": ["#0055A4", "#FFFFFF", "#EF4135"],
  "orientation": "vertical"
}
```

Japan — `jpn`:

```json
"flag": {
  "bands": ["#FFFFFF"],
  "orientation": "horizontal",
  "overlay": { "shape": "disc", "color": "#BC002D" }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npx vitest run lib/squads.test.ts
```

Expected: PASS. Every nation reports four new passing tests; every club reports the "carries no flag" test.

- [ ] **Step 7: Teach the squad-updater skill about the field**

In `.claude/skills/squad-updater/SKILL.md`, add to the section describing the squad file's fields:

```markdown
- `flag` — **nation squads only.** Declarative band geometry, not an asset and
  not an emoji: `{ bands: string[], orientation: 'horizontal' | 'vertical',
weights?: number[], overlay?: { shape: 'disc' | 'diamond', color: string } }`.
  Bands run top-to-bottom for `horizontal`, left-to-right for `vertical`.
  Omit `weights` for equal bands. National emblems and coats of arms are
  omitted by design — use the plain field. The same object must be copied into
  the matching `data/index.json` entry; `lib/squads.test.ts` compares them.
  Hand-check flag colours against a real source rather than generating them.
```

- [ ] **Step 8: Run the full check**

```bash
npm run check
```

Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add types/squad.ts data/index.json data/squads lib/squads.test.ts .claude/skills/squad-updater/SKILL.md
git commit -m "feat(data): add per-nation flag geometry to squads and manifest"
```

---

### Task 5: The team identity marker

Replaces `TeamRow`'s flat single-colour dot. Clubs get both their colours where they genuinely have two — Barcelona, Inter, PSG and Real Madrid already carry correct second colours that nothing renders. Nations get their flag, at a larger size so it is legible.

**Files:**

- Create: `components/TeamIdentityDot.tsx`
- Modify: `components/TeamRow.tsx`
- Modify: `app/team-picker.tsx` (pass the new props)
- Modify: `theme/tokens.ts` (marker sizes)

**Interfaces:**

- Consumes: `Flag` (Task 4).
- Produces: `<TeamIdentityDot kind={'club'|'nation'} primaryColor={string} secondaryColor={string} flag?={Flag} />`.

- [ ] **Step 1: Add the marker size tokens**

In `theme/tokens.ts`, inside `sizes`, replacing the existing `teamDot: 10,` line:

```ts
  teamDot: 10,
  // A flag needs more area than a colour swatch to read at all, so the nation
  // marker is larger than the club dot and rectangular rather than round.
  teamFlag: { width: 22, height: 15 },
  teamFlagRadius: 2,
  // Japan's disc and Brazil's diamond, as a fraction of the flag's height.
  teamFlagOverlayScale: 0.6,
```

- [ ] **Step 2: Write the marker component**

Create `components/TeamIdentityDot.tsx`:

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Flag } from '@/types/squad';
import { colors, radii, sizes } from '@/theme/tokens';

interface TeamIdentityDotProps {
  kind: 'club' | 'nation';
  primaryColor: string;
  secondaryColor: string;
  flag?: Flag;
}

// A team's only visual identity marker, per the "no crests, ever" constraint.
// Clubs are colour: one flat dot, or a split dot where the club genuinely has
// two colours (Barcelona, Inter, PSG). Nations are their flag, drawn from
// band geometry — never an emoji, which depends on an OS font Windows lacks.
export function TeamIdentityDot({
  kind,
  primaryColor,
  secondaryColor,
  flag,
}: TeamIdentityDotProps) {
  if (kind === 'nation' && flag) return <FlagMarker flag={flag} />;

  const primary = primaryColor || colors.textMuted;
  const secondary = secondaryColor || primary;
  const isTwoTone = secondary.toLowerCase() !== primary.toLowerCase();

  if (!isTwoTone) return <View style={[styles.dot, { backgroundColor: primary }]} />;

  return (
    <View style={styles.dot}>
      <View style={[styles.dotHalf, { backgroundColor: primary }]} />
      <View style={[styles.dotHalf, { backgroundColor: secondary }]} />
    </View>
  );
}

function FlagMarker({ flag }: { flag: Flag }) {
  const weights = flag.weights ?? flag.bands.map(() => 1);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const overlaySize = sizes.teamFlag.height * sizes.teamFlagOverlayScale;

  return (
    <View
      style={[styles.flag, { flexDirection: flag.orientation === 'horizontal' ? 'column' : 'row' }]}
    >
      {flag.bands.map((band, i) => (
        <View
          key={`${band}-${i}`}
          style={{ flex: (weights[i] ?? 1) / total, backgroundColor: band }}
        />
      ))}
      {flag.overlay && (
        <View style={styles.overlayWrap} pointerEvents="none">
          <View
            style={{
              width: overlaySize,
              height: overlaySize,
              backgroundColor: flag.overlay.color,
              borderRadius: flag.overlay.shape === 'disc' ? overlaySize / 2 : 0,
              transform: flag.overlay.shape === 'diamond' ? [{ rotate: '45deg' }] : undefined,
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: sizes.teamDot,
    height: sizes.teamDot,
    borderRadius: radii.pill,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  dotHalf: { flex: 1 },
  flag: {
    width: sizes.teamFlag.width,
    height: sizes.teamFlag.height,
    borderRadius: sizes.teamFlagRadius,
    overflow: 'hidden',
  },
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 3: Rewire TeamRow**

In `components/TeamRow.tsx`, replace the import block's first two lines and the props interface, then the dot. Full replacements:

Add to the imports:

```tsx
import { TeamIdentityDot } from './TeamIdentityDot';
import type { Flag } from '@/types/squad';
```

Replace the props interface:

```tsx
interface TeamRowProps {
  name: string;
  kind: 'club' | 'nation';
  primaryColor: string;
  secondaryColor: string;
  flag?: Flag;
  best: { correct: number; total: number } | null;
  onPress: () => void;
}
```

Replace the header comment's last sentence — it currently claims the dot is the identity marker — with:

```tsx
// Left edge (marker + name) stays put; name truncates with an ellipsis. Right
// edge is a fixed-width score pill, so both edges stay clean regardless of
// name length — the identity marker is the team's only visual identifier,
// per the "no crests, ever" constraint.
```

Replace the component signature and the dot:

```tsx
export function TeamRow({
  name,
  kind,
  primaryColor,
  secondaryColor,
  flag,
  best,
  onPress,
}: TeamRowProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.row}>
      <TeamIdentityDot
        kind={kind}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        flag={flag}
      />
```

Then delete the now-unused `dot` entry from the `StyleSheet.create` block, and drop `colors` from the tokens import if nothing else in the file uses it (the `name` and `chevron` styles do, so it stays).

- [ ] **Step 4: Pass the new props from the picker**

In `app/team-picker.tsx`, replace the `<TeamRow ... />` in `renderItem`:

```tsx
<TeamRow
  name={item.name}
  kind={item.kind}
  primaryColor={item.primaryColor}
  secondaryColor={item.secondaryColor}
  flag={item.flag}
  best={bestFor(item.id)}
  onPress={() =>
    router.push({ pathname: '/team/[squadId]/difficulty', params: { squadId: item.id } })
  }
/>
```

- [ ] **Step 5: Run the full check**

```bash
npm run check
```

Expected: all green. A `Property 'flag' does not exist` error here means Task 4 Step 4 was not applied.

- [ ] **Step 6: Verify on device**

```bash
npx expo start -c
```

Open the team picker. On **Clubs**, confirm Barcelona, Inter and PSG show split dots and Arsenal shows a solid one (its second colour is white, but it is genuinely two-tone — confirm the split reads as intentional and not as a rendering artefact; if white-on-dark looks like a bug, raise it rather than silently special-casing). On **National Teams**, confirm six legible flags — France vertical, Japan a red disc on white, Brazil a yellow diamond on green, Spain with a double-height yellow band.

- [ ] **Step 7: Commit**

```bash
git add components/TeamIdentityDot.tsx components/TeamRow.tsx app/team-picker.tsx theme/tokens.ts
git commit -m "feat(picker): show club two-tone dots and nation flags in the team row"
```

---

### Task 6: The `design/` handoff folder

The single surface pushed to the Claude Design project. Tokens and geometry are **re-exports, never copies** — a copy would drift, which is the exact failure this whole design exists to prevent, so a test pins it.

**Files:**

- Create: `design/tokens.ts`
- Create: `design/brand.ts`
- Create: `design/SCREENS.md`
- Create: `design/screens/.gitkeep`
- Modify: `.gitignore` (nothing — captured PNGs are committed on purpose; see Step 4)
- Test: `design/handoff.test.ts`

**Interfaces:**

- Consumes: `theme/tokens.ts` (Task 1), `theme/brand.ts` (Task 2).
- Produces: the folder that Turn 1 uploads via `DesignSync`.

- [ ] **Step 1: Write the failing re-export test**

Create `design/handoff.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as designBrand from './brand';
import * as designTokens from './tokens';
import * as themeBrand from '@/theme/brand';
import * as themeTokens from '@/theme/tokens';

// The handoff folder must re-export, never copy. A copy drifts from the app
// the moment either side changes, which is the precise failure the design
// loop exists to prevent — so identity is asserted, not just equality.
describe('design handoff surface', () => {
  it('re-exports the very same token objects', () => {
    expect(designTokens.colors).toBe(themeTokens.colors);
    expect(designTokens.typography).toBe(themeTokens.typography);
    expect(designTokens.spacing).toBe(themeTokens.spacing);
    expect(designTokens.gradients).toBe(themeTokens.gradients);
  });

  it('re-exports the very same mark geometry', () => {
    expect(designBrand.markGeometry).toBe(themeBrand.markGeometry);
    expect(designBrand.MARK_VIEWBOX).toBe(themeBrand.MARK_VIEWBOX);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run design/handoff.test.ts
```

Expected: FAIL — cannot resolve `./tokens`.

- [ ] **Step 3: Create the re-export files**

`design/tokens.ts`:

```ts
// Handoff surface for the Claude Design project. A re-export, never a copy:
// theme/tokens.ts is the single definition, and design/handoff.test.ts pins
// object identity so this cannot quietly become a duplicate.
export * from '@/theme/tokens';
```

`design/brand.ts`:

```ts
// Handoff surface for the Claude Design project — the Escuadra mark's
// geometry. A re-export, never a copy. See design/tokens.ts.
export * from '@/theme/brand';
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run design/handoff.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Write `design/SCREENS.md`**

This is the load-bearing artefact: the invariants are what stop a six-screen re-pass silently undoing fixes discovered on a physical iPhone. Create `design/SCREENS.md`:

```markdown
# Escuadra — screens, as they are today

This folder is the handoff surface between the Escuadra app and its Claude
Design project. **The repo is the source of truth.** This file is regenerated
from the app, not edited to describe an intention.

`tokens.ts` and `brand.ts` re-export the app's real definitions — they are not
copies. `screens/*.png` are captured from the running app by `npm run shots`.

## About the screenshots

They are **web-rendered, not device truth.** `react-native-web` is close but
not identical to iOS:

- Safe-area insets are zero on web, so top and bottom padding reads
  differently than on an iPhone.
- Font hinting and rendering differ.
- Haptics are a no-op and the splash screen does not exist.

Good enough to judge structure and hierarchy. **Not** good enough to judge
exact spacing from. Whether this fidelity is sufficient is an open assumption
being tested on this iteration.

## Invariants

**Anything not on this list is open for redesign. Everything on it must
survive.** Each entry says what the behaviour is and why it exists, so a
deliberate constraint is distinguishable from an accident.

1. **No player photographs in v0** — but photos become the primary element in
   v1, so the question screen keeps a hero slot that a square portrait can drop
   into without a redesign. It currently holds a large shirt number.
2. **No club crests, badges, logos or shield shapes. Ever.** Trademark
   exposure. Clubs are identified by text and colour alone. National flags are
   not covered by this rule — flags carry no trademark — and are used
   deliberately as the nation identity marker.
3. **No text input anywhere. No keyboard.** Every answer is a tap: option cards
   and chip selectors are the entire input vocabulary. Typing player names on a
   phone is the worst possible version of this app.
4. **Never hardcode a colour, spacing value or font size** — everything comes
   from the tokens in `tokens.ts`. Team identity colour is real-world fact
   about a specific club or nation, not a design choice, and is exempt.
5. **Every animation stays under 300ms.** The app is played in fast repetitive
   bursts; slow transitions become infuriating by question six.
6. **Question parts must stay scrollable.** Without it, later parts on levels 2
   and 3 became physically unreachable on a phone.
7. **On levels 2 and 3, asking stops once a part is answered wrong.** The
   question is already lost; continuing to ask wastes the player's time.
8. **Per-part verdicts show the real result.** A part must never show a green
   check it did not earn — an earlier version did, and it made the feedback
   untrustworthy, which is fatal for a study tool.
9. **No partial credit.** A level-2 or level-3 question is one scored unit,
   correct only when every part is right. The progress bar counts questions,
   not parts, so all three levels read 1..10.
10. **Results screen CTAs differ** by pass/fail and by whether the level
    ceiling has been reached.

## Screens

Six screens. Route, file, and what it does.

| #   | Route                             | File                                     | Purpose                                                                                                  |
| --- | --------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | `/`                               | `app/index.tsx`                          | Home. Wordmark, continue-card for the last played team, Start Training.                                  |
| 2   | `/team-picker`                    | `app/team-picker.tsx`                    | Team picker, segmented into Clubs and National Teams, best score per team.                               |
| 3   | `/team/[squadId]/difficulty`      | `app/team/[squadId]/difficulty.tsx`      | The three-level difficulty ladder, plus the Study entry point.                                           |
| 4   | `/team/[squadId]/study`           | `app/team/[squadId]/study.tsx`           | Browsable full squad — number, name, position, club or nationality.                                      |
| 5   | `/play/[squadId]/[level]`         | `app/play/[squadId]/[level]/index.tsx`   | A question. Hero slot, stat chips, answer options, and on L2/L3 the position and club/nationality parts. |
| 6   | `/play/[squadId]/[level]/results` | `app/play/[squadId]/[level]/results.tsx` | Score, the players missed, and pass/fail-aware CTAs.                                                     |

## Captures

| File                                 | Screen                      |
| ------------------------------------ | --------------------------- |
| `screens/01-home.png`                | Home                        |
| `screens/02-team-picker-clubs.png`   | Team picker, Clubs          |
| `screens/03-team-picker-nations.png` | Team picker, National Teams |
| `screens/04-difficulty.png`          | Difficulty ladder           |
| `screens/05-study.png`               | Study                       |
| `screens/06-question-l1.png`         | Question, level 1           |
| `screens/07-question-l3.png`         | Question, level 3           |
| `screens/08-results.png`             | Results                     |

## Vocabulary

_Escuadra_ means the squad, and _a la escuadra_ means a shot into the top
corner of the goal — the perfect strike. A flawless round is **a la escuadra**;
use that term rather than "perfect score". The product is called **Escuadra**;
"Squad Trainer", "Squad Game" and "Squad Quiz" are stale names that predate it.
```

- [ ] **Step 6: Create the screens directory**

```bash
mkdir -p design/screens && touch design/screens/.gitkeep
```

Captured PNGs are committed deliberately: they are the record of what the design side was shown on a given turn, so a later disagreement can be settled against the actual image rather than memory.

- [ ] **Step 7: Run the full check**

```bash
npm run check
```

Expected: all green. Prettier will reformat `SCREENS.md` tables — let it, then re-stage.

- [ ] **Step 8: Commit**

```bash
git add design/
git commit -m "feat(design): add the design handoff folder with screen invariants"
```

---

### Task 7: Deterministic rounds via a seed parameter

`stores/session.ts:61` seeds rounds with `Date.now()`, so every capture run would produce a different round and the design side could never diff one turn against the next. A route parameter fixes that, and is independently useful for reproducing a specific round when chasing a bug.

**Files:**

- Modify: `stores/session.ts` (`startRound` signature)
- Modify: `app/play/[squadId]/[level]/index.tsx` (read and forward the param)
- Test: `stores/session.test.ts` (extend)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `startRound(squad, roster, level, seed?: number)` — Task 8 drives it via `?seed=`.

- [ ] **Step 1: Write the failing determinism test**

Add to the existing `describe('session store', ...)` block in `stores/session.test.ts`. The file already has a module-level `squad` constant and a `roster()` helper, and a `beforeEach` that calls `reset()` — reuse all three rather than adding parallel fixtures.

```ts
it('produces an identical round for the same explicit seed', () => {
  useSession.getState().startRound(squad, roster(), 1, 4242);
  const first = JSON.stringify(useSession.getState().questions);

  useSession.getState().reset();
  useSession.getState().startRound(squad, roster(), 1, 4242);
  const second = JSON.stringify(useSession.getState().questions);

  expect(second).toEqual(first);
});

it('produces a different round for a different seed', () => {
  useSession.getState().startRound(squad, roster(), 1, 1);
  const a = useSession
    .getState()
    .questions.map((q) => q.playerId)
    .join(',');

  useSession.getState().reset();
  useSession.getState().startRound(squad, roster(), 1, 2);
  const b = useSession
    .getState()
    .questions.map((q) => q.playerId)
    .join(',');

  expect(b).not.toEqual(a);
});
```

The first test stringifies the whole question array on purpose: the seed drives distractor selection and option order as well as which players are asked, so comparing only `playerId` would let a shuffle regression through. `Question` has a flat `playerId` field — there is no `answer` object.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run stores/session.test.ts
```

Expected: FAIL — `startRound` accepts 3 arguments, not 4.

- [ ] **Step 3: Thread the seed through the store**

In `stores/session.ts`, add the optional parameter to `startRound`'s type declaration in the store's interface:

```ts
  startRound: (squad: Squad, roster: RosterEntry[], level: Level, seed?: number) => void;
```

And in the implementation, replace line 61's `buildRound` call:

```ts
const questions = buildRound({ squad, roster, level, seed: seed ?? Date.now() });
```

updating the enclosing function signature to accept `seed?: number`.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run stores/session.test.ts
```

Expected: PASS.

- [ ] **Step 5: Read the seed from the route**

In `app/play/[squadId]/[level]/index.tsx`, widen the params type:

```tsx
const {
  squadId,
  level: levelParam,
  seed: seedParam,
} = useLocalSearchParams<{
  squadId: string;
  level: string;
  seed?: string;
}>();
const level = Number(levelParam) as Level;
// Optional `?seed=` makes a round reproducible — used by the design-loop
// screenshot capture, and handy for reproducing a specific round by hand.
const seed = seedParam === undefined ? undefined : Number(seedParam);
```

And forward it in the bootstrapping effect, replacing the `session.startRound` call:

```tsx
session.startRound(squad, roster, level, Number.isFinite(seed) ? seed : undefined);
```

Add `seedParam` to that effect's dependency array alongside `squadId` and `level`.

- [ ] **Step 6: Run the full check**

```bash
npm run check
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add stores/session.ts stores/session.test.ts "app/play/[squadId]/[level]/index.tsx"
git commit -m "feat(play): accept an optional seed param for reproducible rounds"
```

---

### Task 8: The screenshot capture script

Closes the app → design direction. Boots the web build, walks all six screens, and writes PNGs into `design/screens/`.

**Files:**

- Create: `scripts/capture-screens.mjs`
- Modify: `package.json` (add `shots` script, Playwright devDep)
- Modify: `components/AnswerOption.tsx`, `components/Button.tsx` (add `testID`)

**Interfaces:**

- Consumes: the `?seed=` param from Task 7; `design/screens/` from Task 6.
- Produces: `npm run shots`.

- [ ] **Step 1: Install Playwright**

Chromium alone, not all three browsers — the download is large and only one is needed.

```bash
npm i -D playwright && npx playwright install chromium
```

- [ ] **Step 2: Add stable hooks to the two components the script clicks**

React Native Web maps `testID` to `data-testid`. Without it the script would select by player name, which changes with the round.

In `components/AnswerOption.tsx`, add `testID="answer-option"` to the root `Pressable`.

In `components/Button.tsx`, add `testID="app-button"` to the root `Pressable`.

Do not add `testID` anywhere else — these are the only two the capture script drives.

- [ ] **Step 3: Write the capture script**

Create `scripts/capture-screens.mjs`:

```js
// Captures the six Escuadra screens from the web build into design/screens/,
// for the Claude Design handoff. See design/SCREENS.md.
//
// These are web-rendered, not device truth: safe-area insets are zero on web,
// so padding reads differently than on an iPhone. Good enough for structure
// and hierarchy, not for exact spacing.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const PORT = 8082;
const BASE = `http://localhost:${PORT}`;
const OUT = 'design/screens';
// Fixed so a round is reproducible and design can diff turn against turn.
const SEED = 20260821;
const VIEWPORT = { width: 390, height: 844 }; // iPhone 14 logical size

async function waitForServer(timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Metro did not serve ${BASE} within ${timeoutMs}ms`);
}

async function shoot(page, path, file) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  // Let fonts settle and the entry animations finish. Every animation is
  // under 300ms by constraint, so 600ms is comfortably past all of them.
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${file}` });
  console.log(`captured ${file}`);
}

const server = spawn('npx', ['expo', 'start', '--web', '--port', String(PORT)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, BROWSER: 'none', CI: '1' },
});

let browser;
try {
  await mkdir(OUT, { recursive: true });
  await waitForServer();

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });

  await shoot(page, '/', '01-home.png');
  await shoot(page, '/team-picker', '02-team-picker-clubs.png');

  await page.getByText('National Teams').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/03-team-picker-nations.png` });
  console.log('captured 03-team-picker-nations.png');

  await shoot(page, '/team/bar/difficulty', '04-difficulty.png');
  await shoot(page, '/team/bar/study', '05-study.png');
  await shoot(page, `/play/bar/1?seed=${SEED}`, '06-question-l1.png');
  await shoot(page, `/play/bar/3?seed=${SEED}`, '07-question-l3.png');

  // Results cannot be reached by URL: the session store is deliberately
  // ephemeral, so the round has to actually be played. Answer the first
  // option each time until the router lands on /results.
  await page.goto(`${BASE}/play/bar/1?seed=${SEED}`, { waitUntil: 'networkidle' });
  for (let i = 0; i < 60; i++) {
    if (page.url().includes('/results')) break;
    const next = page.getByTestId('app-button').first();
    if (await next.isVisible().catch(() => false)) {
      await next.click();
    } else {
      const option = page.getByTestId('answer-option').first();
      if (!(await option.isVisible().catch(() => false))) break;
      await option.click();
    }
    await page.waitForTimeout(250);
  }
  if (!page.url().includes('/results')) {
    throw new Error('never reached the results screen — check the testIDs from Step 2');
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/08-results.png` });
  console.log('captured 08-results.png');
} finally {
  await browser?.close();
  server.kill();
}
```

- [ ] **Step 4: Add the npm script**

In `package.json`, add to `scripts`, after `"web"`:

```json
    "shots": "node scripts/capture-screens.mjs",
```

- [ ] **Step 5: Run the capture**

```bash
npm run shots
```

Expected: eight `captured NN-*.png` lines, then the process exits. First run is slow — Metro bundles the web target from cold.

If it hangs at `waitForServer`, Metro is likely on a different port; check its banner output and align `PORT`. If the results loop throws, the `testID`s from Step 2 did not make it into the DOM — inspect with `npx playwright codegen http://localhost:8082/play/bar/1`.

- [ ] **Step 6: Eyeball every capture**

Open all eight PNGs. Confirm the nation flags render as geometry rather than blank boxes, the wordmark is ExtraBold, and no screen is a blank dark rectangle (which means the route rendered `null` — the question screen returns `null` until the session matches).

- [ ] **Step 7: Run the full check**

```bash
npm run check
```

Expected: all green. Prettier does not format `.mjs` by default here; if it complains, let it rewrite the file and re-stage.

- [ ] **Step 8: Commit**

```bash
git add scripts/capture-screens.mjs package.json package-lock.json design/screens components/AnswerOption.tsx components/Button.tsx
git commit -m "feat(design): capture the six screens into the handoff folder"
```

---

## After Turn 0

The repo is ready for **Turn 1**, which is a design-side action, not code:

1. Push `design/` to the Claude Design project (`5f2357de-33ee-4c99-afa1-94bd3f9e44d2`) via `DesignSync` — `finalize_plan`, then `write_files`. Note that project is `PROJECT_TYPE_PROJECT`, not a design system, and **write access against that type is unverified**. If `finalize_plan` rejects it, fall back to creating a design-system project with `create_project`.
2. Ask the design side for three deliverables: the PNG asset set (icon 1024, splash, favicon, and the three Android layers), the wordmark lockups, and the six-screen re-pass.
3. Tell it explicitly that the existing `uploads/Escuadra Design/assets/` bundle is stale — v1 geometry, light-background lockup, live `<text>` in Inter — and must be regenerated from the 2a mark rather than adapted.

Turn 2 gets its own plan once those deliverables exist.
