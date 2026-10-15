# #111 — 2.0 tokens, Archivo, contrast fixes: Implementation Plan

**Issue:** [#111](https://github.com/tovmassian/escuadra/issues/111) · **Milestone:** [v2.0.0](https://github.com/tovmassian/escuadra/milestone/5) · **Branch:** `feat/111-tokens-archivo`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the 2.0 Spotlight design tokens: two `textMuted` contrast fixes, the new colour roles, the stage gradient and veil, the new sizes, radii and durations, and Archivo as a third typeface. Nothing on screen uses the new tokens yet.

**Architecture:** Everything is data in `theme/tokens.ts`, consumed later by issues 3–5. The one new module is a pure WCAG contrast helper (`lib/contrast.ts`). The token tests and, in issue 3, `stageVeil` in `lib/stageView.ts` both use it. Archivo ships as three static `.ttf` instances cut once from the variable font with fontTools, committed under `assets/fonts/archivo/` and loaded at runtime by `useFonts` like Inter and IBM Plex Mono.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Vitest (node environment), expo-font `useFonts`, fontTools 4.67.0 (a throwaway venv, never a repo dependency), Playwright (already a devDependency) for one web check.

**Spec:** [`docs/superpowers/specs/2026-10-15-play-redesign-2-0-design.md`](../specs/2026-10-15-play-redesign-2-0-design.md). This plan is §14 delivery item 1. It also covers the §8 tokens and type, and §12's small fix to the stale flag-size comment. Design source: the canvas at <https://claude.ai/artifact/2P5prLsh9wAsGSkkD4MtwY>, boards "Brand step 1", "C · Prototype", "C · Results" and "C · Study". Line heights and letter spacing below come from those boards where the spec gives none.

## Global Constraints

- Node 24: run `nvm use` in every new shell before any `npm` command.
- Every colour role goes in **both** palettes (`Palette` makes a missing one a compile error). A colour value is lowercase `#rrggbb` or `rgba(r,g,b,a)` with no spaces, which is what `theme/tokens.test.ts`'s `COLOR` regex accepts.
- Never hardcode a colour, spacing value or font size outside `theme/tokens.ts` (CLAUDE.md guardrail 5).
- Every animation duration is ≤ 300 ms. The exceptions are `durations.skeleton` (a shimmer's loop period) and `durations.autoAdvance` (a pause, spec §2.4).
- No new npm dependency, npm script, `.gitignore` line or `app.json` change in this issue. fontTools runs from a venv in a temp directory and is never added to the repo.
- `theme/` and `lib/` keep their tests beside the code (`theme/tokens.test.ts`, `lib/*.test.ts`). Do not move them to `__tests__/` in this issue.
- Do **not** remove `heroCardSize`, `heroNumberSize`, `heroFitHeight`, `heroCardMinSize`, `heroTab`, `typography.heroNumber` or `typography.scoreHero`. Their consumers (`HeroCard`, `fitHeroCard`, the results screen) go in issues 3 and 4, and the tokens go with them.
- The product is **Escuadra**.
- Run `npm run check` before calling the work done, and quote its real output.
- Commits use the repo's conventional style (`feat(theme): …`) and end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Deviations from the spec (flag these in the PR)

1. **ExtraCondensed is cut at `wdth=62.5`, not `62`.** Archivo's STAT table names ExtraCondensed at 62.5, and `--update-name-table` refuses a width with no STAT entry (`ValueError: Cannot find Axis Values {'wdth': 62.0}`). Without that flag all three instances keep the variable font's default names (`Archivo SemiBold` / `Archivo-SemiBold`). iOS's font manager then rejects the second and third file as already registered, and `useFonts` falls back silently. 62.5 is 0.8 % wider than 62, which is invisible at any size.
2. **`stageGradients`, not `gradients.stage`.** `gradients` holds theme-independent brand ramps. `BrandGradient` indexes it by `GradientName`, and its test requires hex stops. The stage gradient differs by theme and needs translucent stops, so it is its own `Record<ThemeName, StageGradient>`, read as `stageGradients[useThemeName()]` at render time.
3. **Four names the spec implies but does not spell out:**
   - `veilInk` (`#0c0d12`, the board's veil colour): `stage.veil` is a strength, so it needs a colour to apply.
   - `heatText` (`#ffc27a`): §8's "text `#ffc27a`".
   - `accentLine`: §8's "accent ink for outlines".
   - `sizes.compactBelow` (700): §2.3's compact threshold.
4. **Compact type sizes are separate entries** (`shirtNumberCompact`, `promptCompact`) rather than size maps. Every `typography` entry stays a complete text style that can be spread.
5. **Known gap, not fixed here:** the new dark `textMuted` reaches 5.36:1 on `background` and 4.92:1 on `surface`, but only 4.30:1 on `surfaceRaised`. The test pins `background` and `surface`, the two grounds muted text sits on today. Note it for the screens that put muted text on a raised surface.

## File map

| File                                   | What changes                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/contrast.ts` (new)                | `relativeLuminance(hex)`, `contrastRatio(a, b)`: pure WCAG 2 maths                                                                         |
| `lib/contrast.test.ts` (new)           | Its tests                                                                                                                                  |
| `theme/tokens.ts`                      | `textMuted` ×2, the flag comment, 13 new `Palette` roles, `stageGradients`, `stage`, sizes, `radii.sheet`, durations, Archivo `typography` |
| `theme/tokens.test.ts`                 | Contrast, stage, motion-budget, sizes and type tests                                                                                       |
| `theme/fonts.ts`                       | Registers the three Archivo files                                                                                                          |
| `assets/fonts/archivo/*.ttf` (new, 3)  | The static instances                                                                                                                       |
| `assets/fonts/archivo/OFL.txt` (new)   | Licence, copied unchanged                                                                                                                  |
| `assets/fonts/archivo/README.md` (new) | Source, commit, hash and the exact commands                                                                                                |
| `docs/license.md`                      | Archivo row and the Modified Version note                                                                                                  |
| `app/about.tsx`                        | The "Flags and fonts" sentence names Archivo                                                                                               |
| `design/screens/*.png`                 | Regenerated: muted text changed on every screen                                                                                            |

`design/tokens.ts` needs no edit: `export *` carries the new exports, and `design/handoff.test.ts` proves they are the same objects.

---

### Task 0: Branch and commit the spec

**Files:**

- Add: `docs/superpowers/specs/2026-10-15-play-redesign-2-0-design.md` (untracked on `main` today)
- Add: `docs/superpowers/plans/2026-10-15-2-0-tokens-archivo.md` (this file)

- [x] **Step 1: Branch**

Done on 2026-10-15: `gh issue develop 111 --name feat/111-tokens-archivo --base main --checkout` made the branch from `main`, linked to #111. Work on it directly. If a worktree is used instead, check this branch out there and copy both files above into it at the same paths: they are untracked until Step 2, so a fresh worktree does not have them.

- [ ] **Step 2: Commit the spec and this plan**

```bash
git add docs/superpowers/specs/2026-10-15-play-redesign-2-0-design.md docs/superpowers/plans/2026-10-15-2-0-tokens-archivo.md
git commit -m "docs(2.0): Spotlight play redesign spec and the issue-1 plan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Contrast helper and the `textMuted` fixes

**Files:**

- Create: `lib/contrast.ts`
- Create: `lib/contrast.test.ts`
- Modify: `theme/tokens.ts` (`darkRoles.textMuted`, `lightRoles.textMuted`, the flag comment in `sizes`)
- Modify: `theme/tokens.test.ts`

**Interfaces:**

- Produces: `relativeLuminance(hex: string): number` (0–1) and `contrastRatio(a: string, b: string): number` (1–21, order-independent). Both accept `#rrggbb` in either case and throw on anything else. Issue 3's `stageVeil` uses them.

- [ ] **Step 1: Write the failing helper tests**

Create `lib/contrast.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast';

describe('relativeLuminance', () => {
  it('runs from black to white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });

  // Squad files carry upper-case team colours ('#AA151B').
  it('accepts upper-case hex', () => {
    expect(relativeLuminance('#FFC400')).toBe(relativeLuminance('#ffc400'));
  });

  it('refuses anything but #rrggbb', () => {
    for (const bad of ['#fff', 'ffffff', '#12141', 'rgba(0,0,0,1)', '']) {
      expect(() => relativeLuminance(bad), bad).toThrow();
    }
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black on white and 1:1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#3e45a3', '#3e45a3')).toBe(1);
  });

  it('does not depend on order', () => {
    expect(contrastRatio('#868b91', '#12141a')).toBe(contrastRatio('#12141a', '#868b91'));
  });

  // #767676 on white is the classic pair that just passes AA.
  it('matches the WCAG reference grey', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.542, 3);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/contrast.test.ts`
Expected: FAIL, `Failed to resolve import "./contrast"`.

- [ ] **Step 3: Implement the helper**

Create `lib/contrast.ts`:

```ts
// WCAG 2 contrast between two opaque sRGB colours. Pure, so the token tests
// can hold text to AA and `stageVeil` (lib/stageView.ts) can keep white text
// legible on a team's real colours.

const HEX6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function channel(byte: string): number {
  const s = parseInt(byte, 16) / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#rrggbb` colour: 0 for black, 1 for white. */
export function relativeLuminance(hex: string): number {
  const match = HEX6.exec(hex);
  if (!match) throw new Error(`relativeLuminance: expected #rrggbb, got "${hex}"`);
  const [, r = '', g = '', b = ''] = match;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio of two `#rrggbb` colours, from 1 to 21. Order does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run lib/contrast.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the failing `textMuted` test**

In `theme/tokens.test.ts`, add the import as the file's second line:

```ts
import { contrastRatio } from '@/lib/contrast';
```

Append to the end of the file:

```ts
describe('text contrast', () => {
  // AA for body text. `textMuted` carries captions, stat labels and the photo
  // credit, so it is held to the body-copy bar on the grounds it sits on.
  it('textMuted reaches 4.5:1 on background and surface, in both themes', () => {
    (['dark', 'light'] as const).forEach((name) => {
      const p = palettes[name];
      for (const ground of ['background', 'surface'] as const) {
        expect(
          contrastRatio(p.textMuted, p[ground]),
          `${name}.textMuted on ${ground}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run theme/tokens.test.ts`
Expected: FAIL. `dark.textMuted on background` is about 4.31 and `light.textMuted on background` about 3.03, both below 4.5.

- [ ] **Step 7: Change both `textMuted` values**

In `theme/tokens.ts`, `darkRoles`:

```ts
  textMuted: '#767b80',
```

becomes

```ts
  // 5.4:1 on the ground (was #767b80, 4.3:1, under AA).
  textMuted: '#868b91',
```

In `lightRoles`:

```ts
  textMuted: '#8b8f96',
```

becomes

```ts
  // 4.9:1 on the ground (was #8b8f96, 3.0:1).
  textMuted: '#686c73',
```

- [ ] **Step 8: Fix the stale flag comment (spec §12)**

In `theme/tokens.ts`, inside `sizes`, replace:

```ts
// a club row in the picker keep identical metrics. Source images are
// 70x46, so `flagMarker` at @3x is a near-exact 1:1 — there is no headroom
// above these sizes.
```

with:

```ts
// a club row in the picker keep identical metrics. Source images are 160 px
// wide (160x107 for a 3:2 flag), so `flagMarker` at @3x (66 px) leaves about
// 2.4x headroom — see assets/flags/README.md.
```

- [ ] **Step 9: Run the tests and watch them pass**

Run: `npx vitest run theme lib/contrast.test.ts`
Expected: PASS, every test in `theme/` plus the 6 contrast tests.

- [ ] **Step 10: Commit**

```bash
git add lib/contrast.ts lib/contrast.test.ts theme/tokens.ts theme/tokens.test.ts
git commit -m "feat(theme): textMuted reaches AA in both themes

A pure WCAG contrast helper in lib/contrast.ts pins it. Also corrects the
flag-size comment: the PNGs are 160 px wide, not 70.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: New colour roles, the stage gradient and the veil

**Files:**

- Modify: `theme/tokens.ts` (`Palette`, `sharedRoles`, `darkRoles`, `lightRoles`; new `StageGradient`, `stageGradients`, `stage`)
- Modify: `theme/tokens.test.ts`

**Interfaces:**

- Produces, on `Palette` (both themes):
  - Shared: `heat`, `heatBg`, `heatLine`, `heatText`, `glass`, `glassLine`, `veilInk`.
  - Per theme: `tile`, `tileLine`, `onStageMuted`, `ctaBg`, `ctaText`, `accentLine`.
- Produces: `interface StageGradient { colors: readonly [string, string, ...string[]]; locations: readonly [number, number, ...number[]] }`. The tuple types are what `expo-linear-gradient`'s `colors` and `locations` props require.
- Produces: `stageGradients: Record<ThemeName, StageGradient>` (vertical, top to bottom, locations as fractions of the **window** height).
- Produces: `stage.veil: { dark: 0.42; light: 0.12 }`, the floor of the `veilInk` wash over no-photo bands.

- [ ] **Step 1: Write the failing tests**

In `theme/tokens.test.ts`, change the import line

```ts
import { gradients, palettes, typography } from './tokens';
```

to

```ts
import { gradients, palettes, stage, stageGradients, typography } from './tokens';
```

Append to the end of the file. `COLOR` is declared earlier in the file, so these tests must come after it:

```ts
describe('spotlight stage', () => {
  // These sit on the player photo, which looks the same in either theme.
  it('shares the photo-side roles between themes', () => {
    for (const role of [
      'heat',
      'heatBg',
      'heatLine',
      'heatText',
      'glass',
      'glassLine',
      'veilInk',
    ] as const) {
      expect(palettes.light[role], role).toBe(palettes.dark[role]);
    }
  });

  it('gives each theme a stage gradient that ends in its own ground', () => {
    (['dark', 'light'] as const).forEach((name) => {
      const g = stageGradients[name];
      expect(g.locations.length, name).toBe(g.colors.length);
      g.colors.forEach((c) => expect(c, name).toMatch(COLOR));
      g.locations.forEach((at, i) => {
        expect(at, `${name}[${i}]`).toBeGreaterThanOrEqual(0);
        expect(at, `${name}[${i}]`).toBeLessThanOrEqual(1);
        if (i > 0) expect(at, `${name}[${i}]`).toBeGreaterThan(g.locations[i - 1] ?? 1);
      });
      expect(g.colors.at(-1), name).toBe(palettes[name].background);
    });
  });

  it('veils the no-photo bands harder on dark than on light', () => {
    for (const name of ['dark', 'light'] as const) {
      expect(stage.veil[name], name).toBeGreaterThan(0);
      expect(stage.veil[name], name).toBeLessThan(1);
    }
    expect(stage.veil.dark).toBeGreaterThan(stage.veil.light);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run theme/tokens.test.ts`
Expected: the stage-gradient and veil tests FAIL (`Cannot read properties of undefined`). The shared-roles test passes vacuously at runtime (`undefined` is `undefined`), so the typecheck is what catches it. Run `npm run typecheck`. Expected: errors that `stage` and `stageGradients` are not exported and that `'heat'` and the other roles are not keys of `Palette`.

- [ ] **Step 3: Add the roles to `Palette`**

In `theme/tokens.ts`, inside `interface Palette`, after `brandPlateBottom: string;`, add:

```ts
// ---- The 2.0 spotlight stage (spec §8). Most of these sit on the player
// photo, which looks the same in either theme, so they are shared.
/** The streak chip: its flame, wash, outline and count. Brand, never a
 *  verdict colour — it only ever means the streak. */
heat: string;
heatBg: string;
heatLine: string;
heatText: string;
/** Translucent glass for controls over the photo (the close button). */
glass: string;
glassLine: string;
/** The ink of the veil over a no-photo stage's team-colour bands. Its
 *  strength is `stage.veil`, raised by `stageVeil` where a band is light. */
veilInk: string;
/** Answer tiles on the stage's ground. */
tile: string;
tileLine: string;
/** Secondary text on the stage: "Level n", slot labels. */
onStageMuted: string;
/** The stage's main button ("Got it — next") and its label. */
ctaBg: string;
ctaText: string;
/** Accent as a line: the active slot's outline. `accent` is too dark to
 *  read as a thin line on the dark ground, so dark uses `brandSoft`. */
accentLine: string;
```

- [ ] **Step 4: Fill in the values**

In `sharedRoles`, after `brandPlateBottom: '#252a6b',`, add:

```ts
  // The 2.0 stage's photo-side roles, shared because the photo does not
  // change with the theme.
  heat: '#ffaa3c',
  heatBg: 'rgba(255,170,60,0.2)',
  heatLine: 'rgba(255,170,60,0.5)',
  heatText: '#ffc27a',
  glass: 'rgba(15,17,23,0.42)',
  glassLine: 'rgba(255,255,255,0.18)',
  veilInk: '#0c0d12',
```

In `darkRoles`, after `errorTextDim: '#a15a58',`, add:

```ts
  tile: 'rgba(255,255,255,0.08)',
  tileLine: 'rgba(255,255,255,0.16)',
  onStageMuted: 'rgba(255,255,255,0.62)',
  ctaBg: '#f3f5f7',
  ctaText: '#12141a',
  accentLine: sharedRoles.brandSoft,
```

In `lightRoles`, after `errorTextDim: '#b3625d',`, add:

```ts
  tile: '#ffffff',
  tileLine: '#dcdfe4',
  onStageMuted: '#686c73',
  ctaBg: '#14161a',
  ctaText: '#ffffff',
  accentLine: sharedRoles.accent,
```

- [ ] **Step 5: Add `stageGradients` and `stage`**

In `theme/tokens.ts`, directly after the line `export type GradientName = keyof typeof gradients;`, add:

```ts
/** A vertical gradient for `expo-linear-gradient`: `colors[i]` sits at
 *  `locations[i]`, a fraction of the painted view's height from the top. */
export interface StageGradient {
  colors: readonly [string, string, ...string[]];
  locations: readonly [number, number, ...number[]];
}

// The question screen's stage (spec §2.1), painted over the whole window —
// so locations are fractions of the window, not of the photo — above the
// photo and under every control. A near-black scrim under the status and top
// bars, clear through the face, then a fall into the ground the answers sit
// on. The scrim is the same ink in both themes because it always sits on a
// photo; the ground ends in the palette's own background. Per theme, so not
// in `gradients`: read it as `stageGradients[useThemeName()]` at render,
// never captured at module scope.
export const stageGradients: Record<ThemeName, StageGradient> = {
  dark: {
    colors: [
      'rgba(10,11,15,0.6)',
      'rgba(10,11,15,0)',
      'rgba(18,20,26,0)',
      'rgba(18,20,26,0.88)',
      '#12141a',
    ],
    locations: [0, 0.2, 0.34, 0.62, 0.74],
  },
  light: {
    colors: [
      'rgba(10,11,15,0.55)',
      'rgba(10,11,15,0)',
      'rgba(247,247,249,0)',
      'rgba(247,247,249,0.94)',
      '#f7f7f9',
    ],
    locations: [0, 0.2, 0.3, 0.48, 0.56],
  },
};

// The no-photo stage (spec §2.6): the squad's marker bands under a wash of
// `veilInk` at this opacity, per theme. A floor, not the final value —
// `stageVeil` in lib/stageView.ts raises it until white text holds 3:1 on the
// lightest band (Real Madrid's white still has to carry the top bar).
export const stage = {
  veil: { dark: 0.42, light: 0.12 },
} as const;
```

- [ ] **Step 6: Run the tests and the typecheck and watch them pass**

Run: `npx vitest run theme design && npm run typecheck`
Expected: PASS. `palettes` "expose identical key sets" and "hold a well-formed colour in every role" also pass with the 13 new roles, and `design/handoff.test.ts` passes with the two new exports.

- [ ] **Step 7: Commit**

```bash
git add theme/tokens.ts theme/tokens.test.ts
git commit -m "feat(theme): 2.0 stage colour roles, stage gradient and veil

heat, glass, tile, onStageMuted, cta and accentLine in both palettes;
stageGradients per theme (not in gradients, which are theme-free brand
ramps); stage.veil as the floor stageVeil will raise.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sizes, radii and durations

**Files:**

- Modify: `theme/tokens.ts` (`durations` and its comment, `sizes`, `radii`)
- Modify: `theme/tokens.test.ts`

**Interfaces:**

- Produces in `sizes`:
  - `compactBelow: 700`
  - `stage: { ratio: 0.68; ratioCompact: 0.72 }`
  - `segment: 3`
  - `corner: { question: { arm: 24; bar: 6 }; results: { arm: 40; bar: 10 } }`
  - `answerTile: { names4, names6, positions }`, each `{ normal: number; compact: number }`
  - `cta: { normal: 52; compact: 48 }`
  - `glassButton: 36`
  - `playerCard: { studyHeight: 218; results: { width: 140; height: 184 } }`
  - `avatar: 46`
- Produces: `radii.sheet: 28`.
- Produces in `durations`: `shake: 240`, `ballDrop: 220`, `ballBounce: 260`, `pulse: 200`, `segmentFill: 120`, `segmentStagger: 40`, `sheet: 240`, `autoAdvance: 1200`.

- [ ] **Step 1: Write the failing tests**

In `theme/tokens.test.ts`, extend the import to:

```ts
import { durations, gradients, palettes, sizes, stage, stageGradients, typography } from './tokens';
```

Append to the end of the file:

```ts
describe('motion budget', () => {
  // Not animations: a shimmer's loop period, and the pause after a correct
  // answer before the round moves on (spec §2.4).
  const NOT_ANIMATIONS = new Set(['skeleton', 'autoAdvance']);
  const animations = Object.entries(durations).filter(([name]) => !NOT_ANIMATIONS.has(name));

  it('keeps every mid-round animation within 300 ms', () => {
    for (const [name, ms] of animations) expect(ms, name).toBeLessThanOrEqual(300);
  });

  it('waits longer after a correct answer than any animation runs', () => {
    expect(durations.autoAdvance).toBeGreaterThan(Math.max(...animations.map(([, ms]) => ms)));
  });
});

describe('spotlight sizes', () => {
  it('gives the photo more of a short screen, not less', () => {
    expect(sizes.stage.ratioCompact).toBeGreaterThan(sizes.stage.ratio);
    expect(sizes.stage.ratioCompact).toBeLessThan(1);
  });

  it('shrinks every answer tile and the main button when compact', () => {
    for (const [grid, h] of Object.entries(sizes.answerTile)) {
      expect(h.compact, grid).toBeLessThan(h.normal);
    }
    expect(sizes.cta.compact).toBeLessThan(sizes.cta.normal);
  });

  // Apple's minimum tap target. The 36 pt glass button gets there with
  // hitSlop at its call site, so it is not checked here.
  it('keeps every answer tile and the main button at least 44 pt tall', () => {
    for (const [grid, h] of Object.entries(sizes.answerTile)) {
      expect(h.compact, grid).toBeGreaterThanOrEqual(44);
    }
    expect(sizes.cta.compact).toBeGreaterThanOrEqual(44);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run theme/tokens.test.ts`
Expected: FAIL. `durations.autoAdvance` is undefined, and `sizes.stage` and `sizes.answerTile` are undefined.

- [ ] **Step 3: Add the durations and reword their comment**

In `theme/tokens.ts`, replace the whole `durations` block and its comment:

```ts
// All under 300ms, per CLAUDE.md's motion rule — this is the mid-round
// budget. The round-over celebration and the home lockup are the one
// carve-out from that rule; see `strikeTiming`/`celebrationCascade` below.
export const durations = {
  press: 100,
  reveal: 180,
  pop: 100,
  popSettle: 120,
  transition: 150,
  collapse: 200,
  toggle: 160,
  skeleton: 900,
} as const;
```

with:

```ts
// All within 300ms, per CLAUDE.md's motion rule — this is the mid-round
// budget. Two entries are not animations and sit outside it: `skeleton` is a
// shimmer's loop period, and `autoAdvance` is the pause after a correct
// answer before the round moves on by itself (spec §2.4; a tap skips it, and
// it never runs with a screen reader on). The round-over celebration and the
// home lockup are the one carve-out from the rule; see
// `strikeTiming`/`celebrationCascade` below.
export const durations = {
  press: 100,
  reveal: 180,
  pop: 100,
  popSettle: 120,
  transition: 150,
  collapse: 200,
  toggle: 160,
  skeleton: 900,
  // ---- 2.0 spotlight (spec §6) ----
  shake: 240, // a missed tile, three swings
  ballDrop: 220, // the ball into the corner on a correct answer
  ballBounce: 260, // the ball off the post on a miss
  pulse: 200, // the next slot's outline
  segmentFill: 120, // one results-strip segment
  segmentStagger: 40, // between results-strip segments
  sheet: 240, // the share sheet sliding up
  autoAdvance: 1200,
} as const;
```

- [ ] **Step 4: Add the sizes**

In `theme/tokens.ts`, inside `sizes`, replace:

```ts
  // The results screen's expanded photo-credit list scrolls past this.
  photoCreditsMaxHeight: 200,
} as const;
```

with:

```ts
  // The results screen's expanded photo-credit list scrolls past this.
  photoCreditsMaxHeight: 200,
  // ---- 2.0 spotlight screens (spec §2, §3, §5, §8) ----
  // The question screen goes compact below this usable height (window minus
  // safe-area insets). It replaces `heroFitHeight` when the hero goes.
  compactBelow: 700,
  // The share of the window the photo stage fills, normal and compact.
  stage: { ratio: 0.68, ratioCompact: 0.72 },
  // One segment of the round's Stories-style progress bar.
  segment: 3,
  // The escuadra corner beside a number: arm length and bar thickness.
  corner: { question: { arm: 24, bar: 6 }, results: { arm: 40, bar: 10 } },
  // Answer tile heights per grid (spec §2.3).
  answerTile: {
    names4: { normal: 58, compact: 52 }, // 2 x 2
    names6: { normal: 54, compact: 48 }, // 2 x 3, level 3
    positions: { normal: 64, compact: 56 }, // 1 x 4
  },
  // The stage's main button.
  cta: { normal: 52, compact: 48 },
  // Round glass controls over the photo. Below the 44pt tap minimum on
  // purpose: give it hitSlop where it is used.
  glassButton: 36,
  // Study's grid card (its width comes from the column) and Results' missed
  // player card.
  playerCard: { studyHeight: 218, results: { width: 140, height: 184 } },
  // Study's list-view avatar.
  avatar: 46,
} as const;
```

- [ ] **Step 5: Add the sheet radius**

In `theme/tokens.ts`, in `radii`, after `xl: 24,` add:

```ts
  sheet: 28, // the share sheet's top corners
```

- [ ] **Step 6: Run the tests and the typecheck and watch them pass**

Run: `npx vitest run theme design && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add theme/tokens.ts theme/tokens.test.ts
git commit -m "feat(theme): 2.0 sizes, sheet radius and motion durations

autoAdvance is the one pause outside the 300 ms rule; a test now holds
every other duration to it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Archivo — the three cuts, registration and type styles

**Files:**

- Create: `assets/fonts/archivo/Archivo-ExtraCondensedBlack.ttf`, `Archivo-SemiExpandedExtraBold.ttf`, `Archivo-Black.ttf`
- Create: `assets/fonts/archivo/OFL.txt`, `assets/fonts/archivo/README.md`
- Modify: `theme/fonts.ts`
- Modify: `theme/tokens.ts` (`typography`, and a type-only import)
- Modify: `theme/tokens.test.ts`
- Modify: `docs/license.md`
- Modify: `app/about.tsx`

**Interfaces:**

- Consumes: `FontFamily` from `theme/fonts.ts` (`keyof typeof fontAssets`).
- Produces: font families `'Archivo-ExtraCondensedBlack'`, `'Archivo-SemiExpandedExtraBold'`, `'Archivo-Black'`.
- Produces in `typography`: `shirtNumber`, `shirtNumberCompact`, `scoreDisplay`, `cardNumber`, `prompt`, `promptCompact`, `titleDisplay`, `ctaLabel`, `tileCode`.
- Produces: `typography` checked by `satisfies Record<string, { fontFamily: FontFamily }>`. A style naming an unregistered font is now a compile error instead of a silent system-font fallback.

- [ ] **Step 1: Make an unregistered font family a compile error**

In `theme/tokens.ts`, after the header comment (line 2), add:

```ts
import type { FontFamily } from './fonts';
```

It is type-only, so Vitest never loads `fonts.ts` and its `.ttf` requires. Then change the end of the `typography` object from

```ts
    textTransform: 'uppercase' as const,
  },
} as const;

// 1.5px is the option-card default; 2px marks the emphasised "correct,
```

to

```ts
    textTransform: 'uppercase' as const,
  },
} as const satisfies Record<string, { fontFamily: FontFamily }>;

// 1.5px is the option-card default; 2px marks the emphasised "correct,
```

Run: `npm run typecheck`
Expected: PASS. Every existing family is registered.

- [ ] **Step 2: Add the Archivo styles (this fails the typecheck)**

In `theme/tokens.ts`, inside `typography`, after the closing `},` of `captionEyebrow` and before the `} as const satisfies` line, add:

```ts
  // ---- Archivo, the 2.0 display face ----
  // Static cuts of the variable font, one file per width, since React Native
  // cannot set a variable font's width axis: see assets/fonts/archivo/. React
  // Native takes lineHeight in points, so the design's ratios are resolved
  // here: 0.78 of the size for the shirt number, 0.8 for the score, 0.9 for
  // card numbers, 1.05 for titles.
  shirtNumber: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontWeight: '900' as const,
    fontSize: 152,
    lineHeight: 119,
    letterSpacing: -3,
  },
  shirtNumberCompact: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontWeight: '900' as const,
    fontSize: 112,
    lineHeight: 87,
    letterSpacing: -3,
  },
  // Results' score; its "/10" is set smaller beside it.
  scoreDisplay: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontWeight: '900' as const,
    fontSize: 150,
    lineHeight: 120,
    letterSpacing: -4,
  },
  // The shirt number on a player card (Results, Study).
  cardNumber: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontWeight: '900' as const,
    fontSize: 44,
    lineHeight: 40,
  },
  // "Who wears 7?", "Position?", "Correct" / "Missed".
  prompt: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontWeight: '800' as const,
    fontSize: 26,
    lineHeight: 26,
    textTransform: 'uppercase' as const,
  },
  promptCompact: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontWeight: '800' as const,
    fontSize: 22,
    lineHeight: 22,
    textTransform: 'uppercase' as const,
  },
  // Results' tier title ("Level 2 cleared").
  titleDisplay: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontWeight: '800' as const,
    fontSize: 25,
    lineHeight: 26,
    textTransform: 'uppercase' as const,
  },
  // The stage's main button label.
  ctaLabel: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontWeight: '800' as const,
    fontSize: 16,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  // The position code on a position tile ("GK").
  tileCode: {
    fontFamily: 'Archivo-Black',
    fontWeight: '900' as const,
    fontSize: 22,
    lineHeight: 22,
  },
```

Run: `npm run typecheck`
Expected: FAIL with errors like `Type '"Archivo-ExtraCondensedBlack"' is not assignable to type '"Inter-Medium" | "Inter-SemiBold" | …'`, one per new entry.

- [ ] **Step 3: Cut the three instances**

Work in a temp directory, never in the repo. Run this from the repo root (or the worktree root) so `REPO` points at it:

```bash
REPO=$(git rev-parse --show-toplevel)
WORK=$(mktemp -d) && cd "$WORK"
python3 -m venv ft && ft/bin/pip install -q fonttools==4.67.0
SHA=6c70c829f09ea345d3590406693220ea35c6553f
curl -sSL -o "Archivo[wdth,wght].ttf" "https://github.com/google/fonts/raw/$SHA/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf"
curl -sSL -o OFL.txt "https://raw.githubusercontent.com/google/fonts/$SHA/ofl/archivo/OFL.txt"
shasum -a 256 "Archivo[wdth,wght].ttf" OFL.txt
```

Expected hashes:

```
0e094a7d3c7c4c25cf1310c4b30014f1dae9332220b1c2c88f4fa996f0b05053  Archivo[wdth,wght].ttf
108b4e57c9c796d3d38d0428ca7ee39de47ad93187302718d9b2d8864b9b716b  OFL.txt
```

Stop if either differs. Then cut the instances. Write the three commands out in full: zsh does not word-split a variable into arguments.

```bash
ft/bin/fonttools varLib.instancer "Archivo[wdth,wght].ttf" wdth=62.5 wght=900 --update-name-table -q -o Archivo-ExtraCondensedBlack.ttf
ft/bin/fonttools varLib.instancer "Archivo[wdth,wght].ttf" wdth=112.5 wght=800 --update-name-table -q -o Archivo-SemiExpandedExtraBold.ttf
ft/bin/fonttools varLib.instancer "Archivo[wdth,wght].ttf" wdth=100 wght=900 --update-name-table -q -o Archivo-Black.ttf
```

Check that each file is static, has its own PostScript name and still carries the licence:

```bash
ft/bin/python - <<'EOF'
from fontTools.ttLib import TTFont
seen = set()
for cut in ("ExtraCondensedBlack", "SemiExpandedExtraBold", "Black"):
    f = TTFont(f"Archivo-{cut}.ttf"); n = f["name"]
    ps = n.getDebugName(6)
    assert "fvar" not in f, cut
    assert ps not in seen, f"duplicate PostScript name {ps}"
    assert "Open Font License" in (n.getDebugName(13) or ""), cut
    seen.add(ps)
    print(cut, "|", n.getDebugName(4), "|", ps, "| weight", f["OS/2"].usWeightClass, "| width", f["OS/2"].usWidthClass)
EOF
```

Expected output, exactly:

```
ExtraCondensedBlack | Archivo ExtraCondensed Black | ArchivoRoman-ExtraCondensedBlack | weight 900 | width 2
SemiExpandedExtraBold | Archivo SemiExpanded ExtraBold | ArchivoRoman-SemiExpandedExtraBold | weight 800 | width 6
Black | Archivo Black | ArchivoRoman-Black | weight 900 | width 5
```

Copy them into the repo (about 120 KB each):

```bash
mkdir -p "$REPO/assets/fonts/archivo"
cp Archivo-ExtraCondensedBlack.ttf Archivo-SemiExpandedExtraBold.ttf Archivo-Black.ttf OFL.txt "$REPO/assets/fonts/archivo/"
cd "$REPO"
```

- [ ] **Step 4: Write the README**

Create `assets/fonts/archivo/README.md`:

````md
# Archivo

Three static cuts of Archivo, the display face of the 2.0 play screens.
Registered in `theme/fonts.ts`; the type styles that use them are in
`theme/tokens.ts` (`typography`).

| file                                | cut                    | axes                  | used for                                |
| ----------------------------------- | ---------------------- | --------------------- | --------------------------------------- |
| `Archivo-ExtraCondensedBlack.ttf`   | ExtraCondensed Black   | `wdth=62.5 wght=900`  | shirt numbers, the results score, cards |
| `Archivo-SemiExpandedExtraBold.ttf` | SemiExpanded ExtraBold | `wdth=112.5 wght=800` | prompts, results titles, button labels  |
| `Archivo-Black.ttf`                 | Black                  | `wdth=100 wght=900`   | position codes on answer tiles          |

## Why static cuts

`@expo-google-fonts/archivo` ships normal width only, and React Native cannot
set a variable font's width axis. So each width is its own file, cut once
from the variable font.

## Licence

SIL Open Font License 1.1: `OFL.txt` beside these files, copied unchanged
from the source. Copyright 2020 The Archivo Project Authors
(https://github.com/Omnibus-Type/Archivo).

A cut is a Modified Version under the OFL. That is allowed, and it may keep
the name Archivo, because Archivo declares no Reserved Font Name (its
copyright line would say so). The cuts stay under the OFL, and each file's
name table still carries the copyright notice and the licence. See
`docs/license.md`.

## Source

- [`google/fonts`](https://github.com/google/fonts) at commit
  `6c70c829f09ea345d3590406693220ea35c6553f` ("Archivo: Version 2.001
  added"), file `ofl/archivo/Archivo[wdth,wght].ttf`, Version 2.001,
  SHA-256 `0e094a7d3c7c4c25cf1310c4b30014f1dae9332220b1c2c88f4fa996f0b05053`.
- Cut with fontTools 4.67.0.

ExtraCondensed is `wdth=62.5`, the width the font's STAT table names, not
the axis floor of 62. `--update-name-table` needs a named width, and it is
what gives each file its own family and PostScript name
(`ArchivoRoman-ExtraCondensedBlack` and so on). Without it all three keep
the variable font's default `Archivo-SemiBold`, and iOS rejects a second font
registered under a PostScript name it already holds.

## Regenerating

```bash
python3 -m venv ft && ft/bin/pip install fonttools==4.67.0
SHA=6c70c829f09ea345d3590406693220ea35c6553f
curl -sSL -o "Archivo[wdth,wght].ttf" "https://github.com/google/fonts/raw/$SHA/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf"
curl -sSL -o OFL.txt "https://raw.githubusercontent.com/google/fonts/$SHA/ofl/archivo/OFL.txt"
shasum -a 256 "Archivo[wdth,wght].ttf"   # must match the hash above
ft/bin/fonttools varLib.instancer "Archivo[wdth,wght].ttf" wdth=62.5 wght=900 --update-name-table -o Archivo-ExtraCondensedBlack.ttf
ft/bin/fonttools varLib.instancer "Archivo[wdth,wght].ttf" wdth=112.5 wght=800 --update-name-table -o Archivo-SemiExpandedExtraBold.ttf
ft/bin/fonttools varLib.instancer "Archivo[wdth,wght].ttf" wdth=100 wght=900 --update-name-table -o Archivo-Black.ttf
```

The output is not byte-for-byte reproducible: fontTools stamps the save time
into each file's `head` table. The source hash is what pins it.
````

- [ ] **Step 5: Register the fonts**

In `theme/fonts.ts`, replace the header comment and object with:

```ts
// Maps the family names used in `theme/tokens.ts` onto the actual font assets.
// Loaded at runtime via `useFonts` because Expo Go cannot use the expo-font
// config plugin (that path requires a prebuild).
//
// Import from the per-weight subpath, never the package root. The root barrel
// `require()`s every weight and italic, and Metro cannot tree-shake those away
// — it costs ~6 MB of unused fonts in the bundle.
//
// Archivo is not an @expo-google-fonts package: that ships normal width only,
// so its three cuts are static instances committed to assets/fonts/archivo/
// (see the README there).
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { IBMPlexMono_700Bold } from '@expo-google-fonts/ibm-plex-mono/700Bold';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';

export const fontAssets = {
  'Inter-Medium': Inter_500Medium,
  'Inter-SemiBold': Inter_600SemiBold,
  'Inter-Bold': Inter_700Bold,
  'Inter-ExtraBold': Inter_800ExtraBold,
  'IBMPlexMono-SemiBold': IBMPlexMono_600SemiBold,
  'IBMPlexMono-Bold': IBMPlexMono_700Bold,
  'Archivo-ExtraCondensedBlack': require('../assets/fonts/archivo/Archivo-ExtraCondensedBlack.ttf'),
  'Archivo-SemiExpandedExtraBold': require('../assets/fonts/archivo/Archivo-SemiExpandedExtraBold.ttf'),
  'Archivo-Black': require('../assets/fonts/archivo/Archivo-Black.ttf'),
} as const;

export type FontFamily = keyof typeof fontAssets;
```

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Add a type test**

In `theme/tokens.test.ts`, append:

```ts
describe('Archivo display type', () => {
  it('sets each compact style smaller, in the same face', () => {
    const pairs = [
      [typography.shirtNumber, typography.shirtNumberCompact],
      [typography.prompt, typography.promptCompact],
    ] as const;
    for (const [normal, compact] of pairs) {
      expect(compact.fontFamily).toBe(normal.fontFamily);
      expect(compact.fontSize).toBeLessThan(normal.fontSize);
    }
  });
});
```

Run: `npx vitest run theme design`
Expected: PASS.

- [ ] **Step 7: Credit Archivo in `docs/license.md`**

In the "What Escuadra ships" table, after the row

```md
| Inter, IBM Plex Mono | SIL Open Font License 1.1 | `@expo-google-fonts/*` in `package.json` |
```

add

```md
| Archivo (three static cuts) | SIL Open Font License 1.1 | `assets/fonts/archivo/README.md` |
```

Replace the sentence

```md
The OFL lets the app
bundle the fonts, provided their copyright notice and licence travel with them,
which they do inside each font file.
```

with

```md
The OFL lets the app
bundle the fonts, provided their copyright notice and licence travel with them,
which they do inside each font file. Archivo's cuts are generated from its
variable font, which makes them a Modified Version under the OFL: allowed, and
under the Archivo name, because Archivo declares no Reserved Font Name. They
stay under the OFL, with `OFL.txt` beside them.
```

- [ ] **Step 8: Credit Archivo on the About screen**

In `app/about.tsx`, replace:

```tsx
            Flag images are from flagpedia.net and are in the public domain. The Inter and IBM Plex
            Mono typefaces are used under the SIL Open Font License 1.1.
```

with:

```tsx
            Flag images are from flagpedia.net and are in the public domain. The Inter, IBM Plex
            Mono and Archivo typefaces are used under the SIL Open Font License 1.1.
```

`gh-pages` `privacy.html` carries no credits section today (it has no "credit" or "flagpedia" text), so nothing else changes. Say in the PR that this line changed, so the pending About-to-`privacy.html` port takes the current wording.

- [ ] **Step 9: Format**

Run: `npx prettier --write docs/license.md assets/fonts/archivo/README.md theme/tokens.ts theme/tokens.test.ts theme/fonts.ts app/about.tsx`
Then: `npm run lint`
Expected: lint passes with no errors.

- [ ] **Step 10: Check the fonts actually load (web)**

The typecheck proves the families are registered, not that the files load. Start the web build and ask the browser:

```bash
node --input-type=module -e "
import { chromium } from 'playwright';
import { startExpoWeb, waitForServer, killServerTree } from './scripts/dev-server.mjs';
const server = startExpoWeb(8085);
try {
  await waitForServer('http://localhost:8085');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8085/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const loaded = await page.evaluate(async () => {
    const families = ['Archivo-ExtraCondensedBlack', 'Archivo-SemiExpandedExtraBold', 'Archivo-Black'];
    const out = {};
    for (const f of families) out[f] = (await document.fonts.load('40px \"' + f + '\"')).length > 0;
    return out;
  });
  console.log(JSON.stringify(loaded));
  await browser.close();
} finally {
  killServerTree(server);
}
"
```

Expected: a line, among Expo's own output, reading `{"Archivo-ExtraCondensedBlack":true,"Archivo-SemiExpandedExtraBold":true,"Archivo-Black":true}`. A `false` means that file did not load: check its `require` path in `theme/fonts.ts`.

iOS and Android registration can only be checked on a device or simulator. Put it in the PR's test plan as a manual check: on a dev build, the splash clears and `useFonts` reports no `fontError`.

- [ ] **Step 11: Commit**

```bash
git add assets/fonts/archivo theme/fonts.ts theme/tokens.ts theme/tokens.test.ts docs/license.md app/about.tsx
git commit -m "feat(theme): Archivo display face — three static cuts and 2.0 type styles

ExtraCondensed Black, SemiExpanded ExtraBold and Black, cut once from
google/fonts' variable Archivo with fontTools (README records the commit,
hash and commands). typography now fails to compile if a style names a
font that is not registered. Credited in docs/license.md and About.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Regenerate the design screens and verify

`textMuted` shows on every screen, and the About text changed, so `design/screens/` is stale (CLAUDE.md: regenerate after any change to a screen). The store captures (`shots:store`, `shots:play`, `gen:play-assets`) are gitignored and are made for the 2.0 listing in issue 6, per the spec. Don't run them here.

**Files:**

- Modify: `design/screens/*.png`

- [ ] **Step 1: Capture**

Run: `npm run shots`
Expected: it finishes without error and rewrites `design/screens/`. It loads player photos from Wikimedia, so it needs a network connection.

- [ ] **Step 2: Inspect the diff**

Run: `git status --short design/screens`
Expected: most PNGs are modified, since muted text is on nearly every screen. Open `design/screens/01a-about.png` and check that the "Flags and fonts" paragraph names Archivo. Open `design/screens/01-home-light.png` and check that the muted text is visibly darker than before (`git show HEAD:design/screens/01-home-light.png > /tmp/before.png` gives the old one). Nothing else should look different: no layout shift, no font change. Archivo is not used on any screen yet.

- [ ] **Step 3: Run the full check**

Run: `npm run check`
Expected: typecheck, lint, `format:check`, every Vitest suite, `squadctl registry check`, `gen:squads` and `gen:flags` all pass, and the final `git diff --exit-code` prints nothing. Copy the actual tail of the output into the PR description.

- [ ] **Step 4: Commit**

```bash
git add design/screens
git commit -m "chore(design): regenerate screens for the textMuted contrast fix

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Hand off**

Use superpowers:finishing-a-development-branch. The PR description lists:

- the five deviations above;
- the `npm run check` output;
- the manual device check from Task 4, Step 10;
- the About font line, for the `privacy.html` port.

It starts with `Closes #111` and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
