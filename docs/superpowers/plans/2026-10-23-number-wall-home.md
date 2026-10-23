# The number-wall Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Home with the 2.0 number wall: a drifting wall of outlined shirt numbers, one Continue button, the starred squads, and a first-run state (#181).

**Architecture:** Two pure modules carry the logic, so Vitest can test them: `lib/numberWall.ts` lays out each wall row and the drift's offset, and `lib/homeView.ts` decides between returning and first run. `components/NumberWall.tsx` draws each row as one `react-native-svg` view, because React Native text has no outline. Reanimated moves the row on the UI thread and stops it under Reduce Motion, in the background, or when Home isn't focused. `app/index.tsx` composes the top bar, the wall, the fades and the bottom block.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router, Reanimated 4, react-native-svg (new, `npx expo install`), expo-linear-gradient, Zustand, Vitest, Playwright (`npm run shots`).

**Spec:** `docs/superpowers/specs/2026-10-23-number-wall-home-design.md`. Read it before any task.

## Global Constraints

- Node 24: prefix commands with `export PATH=$HOME/.nvm/versions/node/v24.21.0/bin:$PATH;` (on Node 22 every `.ts` entry point dies).
- Guardrail 5: no hard-coded colour, spacing or font size. Colour comes from `useThemeColors()` at render, never at module scope. A new role goes in **both** palettes in `theme/tokens.ts`. Use `spacing.*` and sums of them (`spacing.xs + 2`), as the codebase does.
- Guardrail 2: a club shows its banded marker, never a crest. A nation shows its flag PNG through `Flag`.
- User-visible text lives in `i18n/en.ts`, mirrored in `de`, `es`, `fr` (France usage, `tu`) and `it`, each typed `: Messages`, with keys in the same order. Every `≤ N chars` comment is mirrored in `i18n/budgets.ts`. `npm run lint` fails a string literal in JSX in `app/` or `components/`. Put a non-text literal such as `'none'` in a module-scope const.
- A team's name always comes from `squadDisplayName(squad, language)` (`i18n/displayNames.ts`).
- Motion: everything stays under 300 ms except the wall's drift, the written exception added in Task 1.
- TypeScript strict with `noUncheckedIndexedAccess`; never weaken it.
- Open project files with the Read tool, not `cat`, so the path rules in `.claude/rules/` load.
- No new telemetry event or property, and no network call.
- Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before each commit, run `npm run typecheck && npm run lint && npm test` (with the PATH prefix) and make sure all three pass.

---

### Task 1: Tokens, palette roles and the motion exception

**Files:**

- Modify: `theme/tokens.ts`
- Modify: `.claude/rules/design-tokens.md` (Motion section)
- Create: `theme/__tests__/numberWall.test.ts`

**Interfaces:**

- Produces, in `theme/tokens.ts`:
  - `Palette.wallLine: string` (dark `#33353a`, light `#d7d8da`), `Palette.backgroundClear: string` (dark `rgba(18,20,26,0)`, light `rgba(247,247,249,0)`), `Palette.ctaLine: string` (dark `rgba(20,22,26,0.14)`, light `rgba(255,255,255,0.16)`)
  - `numberWall: { fontSize: 150; rowHeight: 129; baseline: 115; advance: Record<'0'|…|'9', number>; tracking: 4; gap: 25; stroke: 1.5; speed: 50 }`
  - `typography.homeHeadline`, `typography.homeButton`, `typography.homeMeta`, `typography.homeHint`
  - `sizes.home: { continue: 68; continueMarker: {width:34,height:23,radius:4}; play: 46; start: 60; squadMarker: {width:24,height:16,radius:3}; topFade: 54; skirt: 180 }`
  - `iconSize.starHint: 16`

- [ ] **Step 1: Write the failing test** `theme/__tests__/numberWall.test.ts`. It pins `numberWall.advance` to the font's own `hmtx` table, so swapping the font fails loudly instead of overlapping the numbers:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { numberWall } from '@/theme/tokens';

// The advance width of each character, read from the TTF's cmap (format 4) and
// hmtx tables: enough of the format to check the wall's digit widths.
function advances(file: string, chars: string): Record<string, number> {
  const b = readFileSync(file);
  const tables: Record<string, number> = {};
  for (let i = 0; i < b.readUInt16BE(4); i++) {
    const o = 12 + i * 16;
    tables[b.toString('ascii', o, o + 4)] = b.readUInt32BE(o + 8);
  }
  const { cmap, hhea, hmtx } = tables as Record<'cmap' | 'hhea' | 'hmtx', number>;
  const metrics = b.readUInt16BE(hhea + 34);
  let sub = 0;
  for (let i = 0; i < b.readUInt16BE(cmap + 2); i++) {
    const off = b.readUInt32BE(cmap + 8 + i * 8);
    if (b.readUInt16BE(cmap + off) === 4) sub = cmap + off;
  }
  const segX2 = b.readUInt16BE(sub + 6);
  const ends = sub + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const ranges = deltas + segX2;
  const glyph = (c: number) => {
    for (let i = 0; i < segX2 / 2; i++) {
      if (c > b.readUInt16BE(ends + i * 2)) continue;
      const start = b.readUInt16BE(starts + i * 2);
      if (c < start) return 0;
      const delta = b.readInt16BE(deltas + i * 2);
      const range = b.readUInt16BE(ranges + i * 2);
      if (range === 0) return (c + delta) & 0xffff;
      const g = b.readUInt16BE(ranges + i * 2 + range + (c - start) * 2);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };
  return Object.fromEntries(
    [...chars].map((ch) => [
      ch,
      b.readUInt16BE(hmtx + Math.min(glyph(ch.charCodeAt(0)), metrics - 1) * 4),
    ]),
  );
}

describe('numberWall', () => {
  it("holds Archivo ExtraCondensed Black's own digit advances", () => {
    const font = join(__dirname, '../../assets/fonts/archivo/Archivo-ExtraCondensedBlack.ttf');
    expect(numberWall.advance).toEqual(advances(font, '0123456789'));
  });
});
```

- [ ] **Step 2: Run it and check that it fails.** Run `npx vitest run theme/__tests__/numberWall.test.ts`. Expected: FAIL, because `numberWall` is not exported.

- [ ] **Step 3: Add the tokens.** In `theme/tokens.ts`:

  1. Add to the `Palette` interface, after `markerRing`:

```ts
// ---- 2.0 Home (#181) ----
/** The outline of Home's drifting shirt numbers: the canvas's 14%
 *  `textPrimary` over `background`, made opaque. */
wallLine: string;
/** `background` at no opacity: the clear end of Home's fades. A plain
 *  `transparent` would fade through black on iOS. */
backgroundClear: string;
/** The ring round a flag or marker on `ctaBg` (Home's Continue), so a
 *  white flag or club colour doesn't bleed into the button. */
ctaLine: string;
```

2. Add `wallLine: '#33353a', backgroundClear: 'rgba(18,20,26,0)', ctaLine: 'rgba(20,22,26,0.14)',` at the end of `darkRoles`, and `wallLine: '#d7d8da', backgroundClear: 'rgba(247,247,249,0)', ctaLine: 'rgba(255,255,255,0.16)',` at the end of `lightRoles`.

3. After `ladderHero`, add:

```ts
// Home's number wall (#181). Archivo ExtraCondensed Black at `fontSize`, rows
// `rowHeight` apart (the canvas's 0.86 line height); `baseline` is where a
// number sits in its row, as CSS centres the font's 878 ascent and 210 descent
// in that line. `advance` is each digit's width per 1,000 em, from the font's
// hmtx table (theme/__tests__/numberWall.test.ts reads the TTF to pin it):
// Archivo's digits are proportional. `tracking` is between a number's digits
// and `gap` between numbers, the canvas's space plus its letter spacing. The
// drift moves `speed` pt a second, ambient and endless: the Motion rule's
// written exception (.claude/rules/design-tokens.md).
export const numberWall = {
  fontSize: 150,
  rowHeight: 129,
  baseline: 115,
  advance: {
    '0': 447,
    '1': 375,
    '2': 430,
    '3': 443,
    '4': 438,
    '5': 440,
    '6': 448,
    '7': 400,
    '8': 435,
    '9': 448,
  },
  tracking: 4,
  gap: 25,
  stroke: 1.5,
  speed: 50,
} as const;
```

4. In `typography`, after `ladderStudy`, add:

```ts
  // ---- 2.0 Home (#181) ----
  // "KNOW EVERY NUMBER." over the buttons.
  homeHeadline: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 34,
    lineHeight: 34,
    letterSpacing: -0.5,
    textTransform: 'uppercase' as const,
  },
  // Continue's "CONTINUE SPAIN" and the START TRAINING pill.
  homeButton: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 17,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  // Continue's "LEVEL 2 · BEST 7/10" and its OUTDATED.
  homeMeta: {
    fontFamily: 'IBMPlexMono-SemiBold',
    fontWeight: '600' as const,
    fontSize: 11,
    textTransform: 'uppercase' as const,
  },
  // First run's "Star a team and it waits for you here."
  homeHint: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 14 },
```

5. In `sizes`, after `rungNumberColumn`, add:

```ts
  // Home (#181): Continue's least height, its flag or marker and its play
  // circle; START TRAINING's height; a starred team's flag or marker in its
  // round button; how far the top fade reaches past the wall's top edge, and
  // the height of the skirt that fades the wall out above the buttons.
  home: {
    continue: 68,
    continueMarker: { width: 34, height: 23, radius: 4 },
    play: 46,
    start: 60,
    squadMarker: { width: 24, height: 16, radius: 3 },
    topFade: 54,
    skirt: 180,
  },
```

6. In `iconSize`, after `outdatedNote`, add `starHint: 16, // the star before Home's first-run hint (#181)`.

- [ ] **Step 4: Run the test and check that it passes.** Run `npx vitest run theme/__tests__/numberWall.test.ts`. Expected: PASS.

- [ ] **Step 5: Write the motion exception.** In `.claude/rules/design-tokens.md`'s Motion section, after the sentence ending `…a shimmer's loop period rather than an animation.`, add the paragraph below. Then add `` `numberWall.speed`, the wall's drift, is not timed and is not in `durations` (#181). `` to the comment above `durations` in `theme/tokens.ts`.

```md
Home's number wall (#181) drifts, slow and endless, at `numberWall.speed`. It is ambient, not a
transition, so it is the rule's written exception (owner approved, 2026-10-22). It stands still
under Reduce Motion, and stops while the app is in the background or Home is not the focused
screen. Nothing else may loop on screen.
```

- [ ] **Step 6: Run the checks.** Run `npm run typecheck && npm run lint && npm test`. Expected: all pass. `theme/__tests__/tokens.test.ts` checks that the palettes match, and it should still pass.

- [ ] **Step 7: Commit**

```bash
git add theme/tokens.ts theme/__tests__/numberWall.test.ts .claude/rules/design-tokens.md
git commit -m "feat(home): tokens for the number wall, and its motion exception (#181)"
```

---

### Task 2: The wall's layout (`lib/numberWall.ts`)

**Files:**

- Create: `lib/numberWall.ts`
- Test: `lib/__tests__/numberWall.test.ts`

**Interfaces:**

- Consumes: `numberWall` from `@/theme/tokens` (Task 1).
- Produces:
  - `type WallFill = 'primary' | 'mark'`
  - `interface WallRowSpec { from: number; to: number; filled: Readonly<Partial<Record<number, WallFill>>>; direction: 'left' | 'right'; phase: number }`
  - `const WALL_ROWS: readonly WallRowSpec[]` (four rows)
  - `interface WallItem { n: number; x: number; fill: WallFill | null }`
  - `interface WallRowLayout { items: WallItem[]; loopWidth: number; width: number }`
  - `numberWidth(n: number): number`
  - `layoutRow(row: WallRowSpec, viewport: number): WallRowLayout`
  - `rowOffset(progress: number, loopWidth: number, phase: number, direction: 'left' | 'right'): number`, a Reanimated worklet

- [ ] **Step 1: Write the failing tests** `lib/__tests__/numberWall.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { WALL_ROWS, layoutRow, numberWidth, rowOffset, type WallRowSpec } from '@/lib/numberWall';
import { numberWall } from '@/theme/tokens';

const em = numberWall.fontSize / 1000;
const row: WallRowSpec = { from: 1, to: 3, filled: { 2: 'mark' }, direction: 'left', phase: 0 };

describe('numberWidth', () => {
  it('is a digit’s advance at the wall’s size', () => {
    expect(numberWidth(7)).toBeCloseTo(400 * em);
  });

  it('adds the tracking between digits', () => {
    expect(numberWidth(10)).toBeCloseTo((375 + 447) * em + numberWall.tracking);
  });
});

describe('layoutRow', () => {
  const loop = numberWidth(1) + numberWidth(2) + numberWidth(3) + 3 * numberWall.gap;

  it('loops once through the row’s numbers, each followed by the gap', () => {
    expect(layoutRow(row, 390).loopWidth).toBeCloseTo(loop);
  });

  it('places each number after the last one and its gap, starting at 0', () => {
    const [a, b, c, d] = layoutRow(row, 390).items;
    expect(a).toEqual({ n: 1, x: 0, fill: null });
    expect(b?.x).toBeCloseTo(numberWidth(1) + numberWall.gap);
    expect(c?.n).toBe(3);
    expect(d?.n).toBe(1);
    expect(d?.x).toBeCloseTo(loop);
  });

  it('fills only the row’s filled numbers, every time they come round', () => {
    const filled = layoutRow(row, 390).items.filter((i) => i.fill !== null);
    expect(filled.length).toBeGreaterThan(1);
    expect(filled.every((i) => i.n === 2 && i.fill === 'mark')).toBe(true);
  });

  it('draws one loop plus the viewport, so every offset of the loop is covered', () => {
    const layout = layoutRow(row, 390);
    expect(layout.width).toBeGreaterThanOrEqual(layout.loopWidth + 390);
    const last = layout.items[layout.items.length - 1];
    expect(last && last.x).toBeLessThan(layout.loopWidth + 390);
  });
});

describe('rowOffset', () => {
  it('starts a row at its phase', () => {
    expect(rowOffset(0, 1000, 60, 'left')).toBeCloseTo(-60);
  });

  it('moves a left row left as the loop runs, wrapping back to where it began', () => {
    expect(rowOffset(0.5, 1000, 0, 'left')).toBeCloseTo(-500);
    expect(rowOffset(1, 1000, 60, 'left')).toBeCloseTo(rowOffset(0, 1000, 60, 'left'));
  });

  it('moves a right row right', () => {
    const a = rowOffset(0.2, 1000, 0, 'right');
    const b = rowOffset(0.3, 1000, 0, 'right');
    expect(b).toBeGreaterThan(a);
    expect(rowOffset(1, 1000, 30, 'right')).toBeCloseTo(rowOffset(0, 1000, 30, 'right'));
  });

  it('never leaves the loop: an offset is always in (-loop, 0]', () => {
    for (const p of [0, 0.1, 0.5, 0.99, 1]) {
      for (const dir of ['left', 'right'] as const) {
        const x = rowOffset(p, 1000, 140, dir);
        expect(x).toBeLessThanOrEqual(0);
        expect(x).toBeGreaterThan(-1000);
      }
    }
  });
});

describe('WALL_ROWS', () => {
  it('shows every shirt number from 1 to 26 between its four rows', () => {
    const shown = new Set(WALL_ROWS.flatMap((r) => range(r.from, r.to)));
    expect([...shown].sort((a, b) => a - b)).toEqual(range(1, 26));
  });

  it('alternates direction, row by row', () => {
    expect(WALL_ROWS.map((r) => r.direction)).toEqual(['left', 'right', 'left', 'right']);
  });

  it('fills 7 and 19 in the primary ink and 10 in the mark’s, as the canvas does', () => {
    expect(WALL_ROWS.map((r) => r.filled)).toEqual([
      { 7: 'primary' },
      { 10: 'mark' },
      {},
      { 19: 'primary' },
    ]);
  });
});

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
```

- [ ] **Step 2: Run them and check that they fail.** Run `npx vitest run lib/__tests__/numberWall.test.ts`. Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement** `lib/numberWall.ts`:

```ts
// Home's number wall (#181): where each shirt number sits in its row, and how
// far a row has drifted. Pure, so Vitest can hold the loop to its seams; the
// drawing is components/NumberWall.tsx.
import { numberWall } from '@/theme/tokens';

/** A filled number's ink: `textPrimary` or `mark`. */
export type WallFill = 'primary' | 'mark';

export interface WallRowSpec {
  /** The row loops through `from`…`to`. */
  from: number;
  to: number;
  filled: Readonly<Partial<Record<number, WallFill>>>;
  direction: 'left' | 'right';
  /** How far into its loop the row starts, in pt, so the rows don't line up. */
  phase: number;
}

// Ten numbers a row rather than the canvas's 26: a drawn row costs memory in
// proportion to its width (spec, How the wall is drawn). Between them the rows
// still show every number from 1 to 26, and the filled ones and the starting
// offsets are the canvas's.
export const WALL_ROWS: readonly WallRowSpec[] = [
  { from: 1, to: 10, filled: { 7: 'primary' }, direction: 'left', phase: 0 },
  { from: 5, to: 14, filled: { 10: 'mark' }, direction: 'right', phase: 60 },
  { from: 15, to: 24, filled: {}, direction: 'left', phase: 140 },
  { from: 17, to: 26, filled: { 19: 'primary' }, direction: 'right', phase: 30 },
];

export interface WallItem {
  n: number;
  /** The number's left edge in its row, pt. */
  x: number;
  fill: WallFill | null;
}

export interface WallRowLayout {
  items: WallItem[];
  /** One pass through the row's numbers, each with its gap: the drift's period. */
  loopWidth: number;
  /** The drawn row: a loop plus a viewport, so any offset in the loop is covered. */
  width: number;
}

/** A number's drawn width: its digits' advances plus the tracking between them. */
export function numberWidth(n: number): number {
  const digits = String(n).split('') as (keyof typeof numberWall.advance)[];
  const advance = digits.reduce((sum, d) => sum + numberWall.advance[d], 0);
  return (advance * numberWall.fontSize) / 1000 + (digits.length - 1) * numberWall.tracking;
}

export function layoutRow(row: WallRowSpec, viewport: number): WallRowLayout {
  const count = row.to - row.from + 1;
  const numberAt = (i: number) => row.from + (i % count);
  let loopWidth = 0;
  for (let i = 0; i < count; i++) loopWidth += numberWidth(numberAt(i)) + numberWall.gap;

  const items: WallItem[] = [];
  let x = 0;
  for (let i = 0; x < loopWidth + viewport; i++) {
    const n = numberAt(i);
    items.push({ n, x, fill: row.filled[n] ?? null });
    x += numberWidth(n) + numberWall.gap;
  }
  return { items, loopWidth, width: x };
}

/** A row's translateX at `progress` (0 to 1) through its loop. The content
 *  repeats every `loopWidth`, so 0 and 1 are the same frame. */
export function rowOffset(
  progress: number,
  loopWidth: number,
  phase: number,
  direction: 'left' | 'right',
): number {
  'worklet';
  const travelled = direction === 'left' ? progress : 1 - progress;
  return -((phase + travelled * loopWidth) % loopWidth);
}
```

- [ ] **Step 4: Run the tests and check that they pass.** Run `npx vitest run lib/__tests__/numberWall.test.ts`. Expected: PASS. If `rowOffset(1, …, 'right')` returns `-0`, change `toBeCloseTo` nothing: `-0` is close to `0`.

- [ ] **Step 5: Commit**

```bash
git add lib/numberWall.ts lib/__tests__/numberWall.test.ts
git commit -m "feat(home): lay out the number wall's rows and their drift (#181)"
```

---

### Task 3: Home's view model and its text

**Files:**

- Create: `lib/homeView.ts`
- Modify: `lib/starred.ts`
- Test: `lib/__tests__/homeView.test.ts`, `lib/__tests__/starred.test.ts`
- Modify: `i18n/en.ts`, `i18n/de.ts`, `i18n/es.ts`, `i18n/fr.ts`, `i18n/it.ts`, `i18n/budgets.ts`

**Interfaces:**

- Consumes: `BestScore`, `isOutdated` (`lib/bestScore.ts`); `scoreKey`, `ROUND_LENGTH` (`lib/scoring.ts`); `Messages` (`i18n/en.ts`); `SquadManifestEntry` (`types/squad.ts`).
- Produces:
  - `starredTeams(starred: readonly string[], squads: readonly SquadManifestEntry[]): SquadManifestEntry[]` in `lib/starred.ts`
  - In `lib/homeView.ts`:
    - `interface HomeContinue { squad: SquadManifestEntry; level: number; best: { score: number; outdated: boolean } | undefined }`
    - `type HomeView = { kind: 'loading' } | { kind: 'returning'; continue: HomeContinue; starred: SquadManifestEntry[] } | { kind: 'firstRun'; starred: SquadManifestEntry[] }`
    - `homeView(input: { hydrated: boolean; lastPlayed: { squadId: string; level: number } | null; bestScores: Record<string, BestScore>; starred: readonly string[]; squads: readonly SquadManifestEntry[] }): HomeView`
    - `continueMeta(c: HomeContinue, messages: Messages): string`
    - `continueSpoken(name: string, c: HomeContinue, messages: Messages): string`
  - Catalog keys in `home`: `headline: string`, `continueTeam: (team: string) => string`, `allTeams: string`, `starHint: string`. `home.browseAllTeams` is removed in Task 5, not here, because the old Home still reads it.

- [ ] **Step 1: Write the failing tests.** Add to `lib/__tests__/starred.test.ts`. Extend the existing import to `import { starredOfKind, starredTeams, toggleStarred } from '@/lib/starred';`:

```ts
describe('starredTeams', () => {
  it('keeps both kinds, newest first, and drops ids that have left the data', () => {
    expect(starredTeams(['armenia', 'gone', 'arsenal'], squads).map((s) => s.id)).toEqual([
      'armenia',
      'arsenal',
    ]);
  });
});
```

Create `lib/__tests__/homeView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { continueMeta, continueSpoken, homeView, type HomeContinue } from '@/lib/homeView';
import type { SquadManifestEntry } from '@/types/squad';

function entry(id: string, lastUpdated = '2026-10-01'): SquadManifestEntry {
  return { id, kind: 'nation', name: id, lastUpdated } as SquadManifestEntry;
}

const squads = [entry('esp'), entry('arm'), entry('rma')];
const base = { hydrated: true, lastPlayed: null, bestScores: {}, starred: [], squads };

describe('homeView', () => {
  it('waits for the store to hydrate', () => {
    expect(homeView({ ...base, hydrated: false })).toEqual({ kind: 'loading' });
  });

  it('is first run with nothing played', () => {
    expect(homeView(base)).toEqual({ kind: 'firstRun', starred: [] });
  });

  it('is first run when the last team has left the data', () => {
    expect(homeView({ ...base, lastPlayed: { squadId: 'gone', level: 2 } }).kind).toBe('firstRun');
  });

  it('keeps the starred teams on first run', () => {
    const view = homeView({ ...base, starred: ['arm'] });
    expect(view.kind === 'firstRun' && view.starred.map((s) => s.id)).toEqual(['arm']);
  });

  it('continues the last team at its level, with that level’s best', () => {
    const view = homeView({
      ...base,
      lastPlayed: { squadId: 'esp', level: 2 },
      bestScores: { 'esp:2': { score: 7, squadUpdated: '2026-10-01' } },
      starred: ['rma', 'gone', 'esp'],
    });
    expect(view.kind).toBe('returning');
    if (view.kind !== 'returning') return;
    expect(view.continue.squad.id).toBe('esp');
    expect(view.continue.level).toBe(2);
    expect(view.continue.best).toEqual({ score: 7, outdated: false });
    expect(view.starred.map((s) => s.id)).toEqual(['rma', 'esp']);
  });

  it('marks the best outdated when the squad has been updated since', () => {
    const view = homeView({
      ...base,
      lastPlayed: { squadId: 'esp', level: 1 },
      bestScores: { 'esp:1': { score: 9, squadUpdated: '2026-01-01' } },
    });
    expect(view.kind === 'returning' && view.continue.best).toEqual({ score: 9, outdated: true });
  });

  it('has no best for a level started but never finished', () => {
    const view = homeView({ ...base, lastPlayed: { squadId: 'esp', level: 3 } });
    expect(view.kind === 'returning' && view.continue.best).toBeUndefined();
  });
});

describe('Continue’s text', () => {
  const squad = entry('esp');
  const played: HomeContinue = { squad, level: 2, best: { score: 7, outdated: false } };

  it('shows the level and best in the meta line', () => {
    expect(continueMeta(played, en)).toBe('LEVEL 2 · BEST 7/10');
    expect(continueMeta({ squad, level: 3, best: undefined }, en)).toBe('LEVEL 3');
  });

  it('is spoken as the picker reads a row', () => {
    expect(continueSpoken('Spain', played, en)).toBe('Continue Spain, Level 2, best 7 of 10');
    expect(continueSpoken('Spain', { ...played, best: { score: 7, outdated: true } }, en)).toBe(
      'Continue Spain, Level 2, best 7 of 10, outdated',
    );
    expect(continueSpoken('Spain', { squad, level: 1, best: undefined }, en)).toBe(
      'Continue Spain, Level 1',
    );
  });
});
```

- [ ] **Step 2: Run them and check that they fail.** Run `npx vitest run lib/__tests__/homeView.test.ts lib/__tests__/starred.test.ts`. Expected: FAIL, because the module and export are missing.

- [ ] **Step 3: Add `starredTeams`** to the end of `lib/starred.ts`:

```ts
/** Every starred team, both kinds, newest first: Home's row of round buttons
 *  (#181). A starred id that has left the data is dropped, as above. */
export function starredTeams(
  starred: readonly string[],
  squads: readonly SquadManifestEntry[],
): SquadManifestEntry[] {
  const byId = new Map(squads.map((s) => [s.id, s]));
  return starred.flatMap((id) => {
    const squad = byId.get(id);
    return squad === undefined ? [] : [squad];
  });
}
```

Change `starredOfKind`'s `squads` parameter to `readonly SquadManifestEntry[]` only if the typecheck needs it.

- [ ] **Step 4: Add the catalog keys.** In `i18n/en.ts` `home`, after `browseAllTeams`, add:

```ts
    /** ≤ 24 chars: the headline over the buttons, in display capitals; it may wrap. */
    headline: 'Know every number.',
    /** ≤ 24 chars with "Spain": Continue, in display capitals; it may wrap to two lines. */
    continueTeam: (team: string) => `Continue ${team}`,
    /** ≤ 18 chars: the link to the team picker, beside the starred teams. */
    allTeams: 'All teams',
    /** ≤ 52 chars: first run's hint under Start Training, beside a star. */
    starHint: 'Star a team and it waits for you here.',
```

In `i18n/budgets.ts`, after the `home.browseAllTeams` line, add:

```ts
  { budget: 24, texts: { 'home.headline': (m) => m.home.headline } },
  { budget: 24, texts: { 'home.continueTeam': (m) => m.home.continueTeam('Spain') } },
  { budget: 18, texts: { 'home.allTeams': (m) => m.home.allTeams } },
  { budget: 52, texts: { 'home.starHint': (m) => m.home.starHint } },
```

Add the same four keys, in the same place and order, to each catalog. These are drafts; native speakers review them after Task 6. Keep each catalog's voice: `du` in de, `tú` in es, `tu` in fr, `tu` in it:

- `de.ts`: `headline: 'Kenne jede Nummer.'`, `continueTeam: (team: string) => \`Weiter mit ${team}\``, `allTeams: 'Alle Teams'`, `starHint: 'Markiere ein Team, dann wartet es hier auf dich.'`
- `es.ts`: `headline: 'Conoce cada dorsal.'`, `continueTeam: (team: string) => \`Seguir con ${team}\``, `allTeams: 'Todos los equipos'`, `starHint: 'Marca un equipo con la estrella y te esperará aquí.'`
- `fr.ts`: `headline: 'Connais chaque numéro.'`, `continueTeam: (team: string) => \`Continuer : ${team}\``, `allTeams: 'Toutes les équipes'`, `starHint: 'Ajoute une équipe en favori, elle t’attendra ici.'`. In France usage the colon takes a space before it. Write it as a narrow no-break space (U+202F) if the other fr strings in the catalog do; check `fr.ts`'s existing `' : '` usages and match them.
- `it.ts`: `headline: 'Conosci ogni numero.'`, `continueTeam: (team: string) => \`Continua con ${team}\``, `allTeams: 'Tutte le squadre'`, `starHint: 'Metti la stella a una squadra: ti aspetta qui.'`

- [ ] **Step 5: Implement** `lib/homeView.ts`:

```ts
// Home's view model (#181): returning or first run, and Continue's text. Pure,
// so the screen stays layout and these rules stay testable.
import type { Messages } from '@/i18n/en';
import { isOutdated, type BestScore } from '@/lib/bestScore';
import { ROUND_LENGTH, scoreKey } from '@/lib/scoring';
import { starredTeams } from '@/lib/starred';
import type { SquadManifestEntry } from '@/types/squad';

export interface HomeContinue {
  squad: SquadManifestEntry;
  level: number;
  /** That level's best, if a round of it has finished. */
  best: { score: number; outdated: boolean } | undefined;
}

export type HomeView =
  | { kind: 'loading' }
  | { kind: 'returning'; continue: HomeContinue; starred: SquadManifestEntry[] }
  | { kind: 'firstRun'; starred: SquadManifestEntry[] };

export function homeView(input: {
  hydrated: boolean;
  lastPlayed: { squadId: string; level: number } | null;
  bestScores: Record<string, BestScore>;
  starred: readonly string[];
  squads: readonly SquadManifestEntry[];
}): HomeView {
  if (!input.hydrated) return { kind: 'loading' };
  const starred = starredTeams(input.starred, input.squads);
  const last = input.lastPlayed;
  // A last team that has left the data is first run again: there is nothing to continue.
  const squad = last === null ? undefined : input.squads.find((s) => s.id === last.squadId);
  if (last === null || squad === undefined) return { kind: 'firstRun', starred };
  const best = input.bestScores[scoreKey(squad.id, last.level)];
  return {
    kind: 'returning',
    continue: {
      squad,
      level: last.level,
      best:
        best === undefined
          ? undefined
          : { score: best.score, outdated: isOutdated(best, squad.lastUpdated) },
    },
    starred,
  };
}

/** "LEVEL 2 · BEST 7/10"; the screen adds the OUTDATED mark after it. */
export function continueMeta(c: HomeContinue, messages: Messages): string {
  return messages.home.continueMeta(c.level, c.best?.score, ROUND_LENGTH);
}

/** Continue as one spoken button, read the way a picker row is. */
export function continueSpoken(name: string, c: HomeContinue, messages: Messages): string {
  const progress =
    c.best === undefined
      ? messages.common.level(c.level)
      : c.best.outdated
        ? messages.picker.bestOutdatedSpoken(c.level, c.best.score, ROUND_LENGTH)
        : messages.picker.bestSpoken(c.level, c.best.score, ROUND_LENGTH);
  return `${messages.home.continueTeam(name)}, ${progress}`;
}
```

- [ ] **Step 6: Run the tests and check that they pass.** Run `npx vitest run lib/__tests__/homeView.test.ts lib/__tests__/starred.test.ts i18n`. Expected: PASS, including `catalogs`, `budgets` and `translations`. If a budget fails in one language, shorten that translation; never raise the budget to fit.

- [ ] **Step 7: Commit**

```bash
git add lib/homeView.ts lib/starred.ts lib/__tests__/homeView.test.ts lib/__tests__/starred.test.ts i18n/
git commit -m "feat(home): Home's view model and its text in five languages (#181)"
```

---

### Task 4: react-native-svg and the `NumberWall` component

**Files:**

- Modify: `package.json`, `package-lock.json` (through `npx expo install`)
- Create: `components/NumberWall.tsx`, `components/useAppActive.ts`
- Modify: `lib/licences.generated.ts` (through `npm run gen:licences`)

**Interfaces:**

- Consumes: `WALL_ROWS`, `layoutRow`, `rowOffset` (Task 2); `numberWall`, `typography`, `Palette.wallLine` (Task 1).
- Produces: `NumberWall({ top }: { top: number })`, which fills the screen's width from `top` down, four rows tall, absolutely positioned; and `useAppActive(): boolean`.

- [ ] **Step 1: Install.** Run `npx expo install react-native-svg`. Expected: it adds `"react-native-svg": "15.15.4"` (the SDK 57 pin from `expo/bundledNativeModules.json`) to `dependencies`. Never use `npm install` with a caret.

- [ ] **Step 2: Write `components/useAppActive.ts`:**

```ts
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** True while the app is in the foreground. The wall's drift stops otherwise (#181). */
export function useAppActive(): boolean {
  const [active, setActive] = useState(() => AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}
```

- [ ] **Step 3: Write `components/NumberWall.tsx`:**

```tsx
import { useIsFocused } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Text as SvgText } from 'react-native-svg';
import { useAppActive } from './useAppActive';
import { WALL_ROWS, layoutRow, rowOffset, type WallRowSpec } from '@/lib/numberWall';
import { numberWall, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// SVG paint values, not text: kept out of the JSX for the hard-coded-string lint.
const NO_PAINT = 'none';

// Home's number wall (#181): four rows of shirt numbers drifting in alternate
// directions behind the headline. React Native text has no outline, so each
// row is one SVG of outlined numbers, drawn once and moved on the UI thread.
// Decorative: hidden from screen readers and from touches. The drift is the
// Motion rule's written exception; it stands still under Reduce Motion, and
// stops while the app is in the background or Home isn't the focused screen.
export function NumberWall({ top }: { top: number }) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const active = useAppActive();
  const running = !reduced && focused && active;

  return (
    <View
      style={[styles.wall, { top }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {WALL_ROWS.map((row) => (
        <WallRow key={row.from} row={row} viewport={width} running={running} />
      ))}
    </View>
  );
}

function WallRow({
  row,
  viewport,
  running,
}: {
  row: WallRowSpec;
  viewport: number;
  running: boolean;
}) {
  const colors = useThemeColors();
  const layout = useMemo(() => layoutRow(row, viewport), [row, viewport]);
  const progress = useSharedValue(0);
  const { loopWidth } = layout;

  useEffect(() => {
    if (!running) {
      cancelAnimation(progress);
      return;
    }
    // Resume where it stopped: finish this loop, then loop from 0 for ever.
    const period = (loopWidth / numberWall.speed) * 1000;
    const linear = { easing: Easing.linear };
    progress.value = withSequence(
      withTiming(1, { ...linear, duration: (1 - progress.value) * period }),
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { ...linear, duration: period }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(progress);
  }, [running, loopWidth, progress]);

  const drift = useAnimatedStyle(() => ({
    transform: [{ translateX: rowOffset(progress.value, loopWidth, row.phase, row.direction) }],
  }));

  const fills = { primary: colors.textPrimary, mark: colors.mark } as const;
  return (
    <Animated.View style={[{ width: layout.width, height: numberWall.rowHeight }, drift]}>
      <Svg width={layout.width} height={numberWall.rowHeight}>
        {layout.items.map((item) => (
          <SvgText
            key={item.x}
            x={item.x}
            y={numberWall.baseline}
            fontFamily={typography.shirtNumber.fontFamily}
            fontSize={numberWall.fontSize}
            letterSpacing={numberWall.tracking}
            fill={item.fill === null ? NO_PAINT : fills[item.fill]}
            stroke={item.fill === null ? colors.wallLine : NO_PAINT}
            strokeWidth={numberWall.stroke}
          >
            {String(item.n)}
          </SvgText>
        ))}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wall: { position: 'absolute', left: 0, right: 0, overflow: 'hidden', pointerEvents: 'none' },
});
```

`typography.shirtNumber.fontFamily` is `'Archivo-ExtraCondensedBlack'`, the face the wall is set in. If `npm run lint` flags `fill` or `stroke` as a shown prop, add `'fill'`, `'stroke'` to `SILENT_PROPS` in `eslint.config.js`. They are paint, never shown as text. If the hook-deps lint flags `row.phase`/`row.direction` inside `useAnimatedStyle`, read them into locals first, as `loopWidth` is.

- [ ] **Step 4: Regenerate the licence notices.** Run `npm run gen:licences`. Expected: `lib/licences.generated.ts` gains react-native-svg (MIT) only when the bundle uses it. Nothing imports `NumberWall` until Task 5, so this step may change nothing. Task 5 reruns it. If the generator refuses a licence, stop and report: widening the allowlist is the owner's decision.

- [ ] **Step 5: Run the checks.** Run `npm run typecheck && npm run lint && npm test`. Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components/NumberWall.tsx components/useAppActive.ts lib/licences.generated.ts eslint.config.js
git commit -m "feat(home): the drifting number wall, drawn with react-native-svg (#181)"
```

---

### Task 5: The new Home screen, and the old one's leftovers removed

**Files:**

- Modify: `app/index.tsx` (rewrite)
- Create: `components/HomeContinue.tsx`, `components/HomeSquads.tsx`
- Modify: `components/Flag.tsx`, `components/TeamMarker.tsx`, `components/Wordmark.tsx`
- Modify: `theme/tokens.ts`, `theme/__tests__/tokens.test.ts`, `.claude/rules/design-tokens.md`
- Modify: `i18n/*.ts`, `i18n/budgets.ts` (remove `home.browseAllTeams`)
- Modify: `components/EscuadraStrike.tsx` (only if `strikeTiming`'s key type changes), `components/Button.tsx` (only if `large` ends up unused)
- Modify: `lib/licences.generated.ts` (`npm run gen:licences`)

**Interfaces:**

- Consumes: everything above. Also `useProgress`, `useProgressHydrated` (`stores/progress.ts`); `useSession().startRound`; `getSquad`, `getRoster`, `listSquads` (`lib/squads.ts`); `flagFor` (`lib/flags.ts`); `squadDisplayName` (`i18n/displayNames.ts`); `StarGlyph`, `OutdatedGlyph`, `PlayGlyph` (`components/ActionGlyphs.tsx`); `GearGlyph`, `ChevronGlyph` (`components/SettingsGlyphs.tsx`).
- Produces: `FlagSize` gains `'continue' | 'squad'`; `TeamMarker`'s `variant` gains `'continue' | 'squad'` plus an optional `ringColor?: string`; `Wordmark()` takes no props.

- [ ] **Step 1: Flag and TeamMarker sizes.** In `components/Flag.tsx`:
  - Set `FlagSize = 'marker' | 'inline' | 'row' | 'picker' | 'continue' | 'squad'`.
  - Add `continue: sizes.home.continueMarker` and `squad: sizes.home.squadMarker` to `DIMENSIONS`. They hold `radius` too, and `Image` ignores it in a style object, so pass only `{ width, height }`.
  - Replace the radius logic with a per-size lookup: `picker` gets `sizes.pickerMarker.radius`, `continue` `sizes.home.continueMarker.radius`, `squad` `sizes.home.squadMarker.radius`, and anything else `sizes.teamMarkerRadius`.
  - Use `markerRing` as the default line for all three ringed sizes; Continue passes `lineColor={colors.ctaLine}`.

  In `components/TeamMarker.tsx`:
  - Set `variant: 'banner' | 'picker' | 'continue' | 'squad'`. Every non-banner variant draws in the squad's own orientation with the ring overlay.
  - Pick the dimensions from `sizes.pickerMarker`, `sizes.home.continueMarker` or `sizes.home.squadMarker`.
  - Add `ringColor?: string` (default `colors.markerRing`) for the overlay.
  - Update the doc comment on `variant` to name the two Home sizes.

- [ ] **Step 2: Wordmark.** Rewrite `components/Wordmark.tsx` as the top bar's static lockup: the mark at `sizes.wordmarkMark` in `colors.mark`, then `ESCUADRA_WORDMARK` in `typography.wordmark`, `colors.textPrimary`. Keep the `accessibilityRole="header"` and `accessibilityLabel={ESCUADRA}` on the row, and keep the existing gap. Remove the `size`, `showTrail`, `stacked` and `animate` props and the `EscuadraStrike`/`Animated` imports. In `theme/tokens.ts`:
  - set `sizes.wordmarkMark` to `28`, with the comment "The top bar's lockup on Home (#181): a 28 pt mark beside the 21 pt word.";
  - set `typography.wordmark` to `{ fontFamily: 'Archivo-SemiExpandedExtraBold', fontSize: 21, letterSpacing: -0.5 }`, with the comment "The lockup's lowercase 'escuadra', in Archivo SemiExpanded ExtraBold, as the 2.0 canvas sets it.";
  - delete `typography.wordmarkHero`;
  - in `theme/__tests__/tokens.test.ts`, change the "wordmark uses the ExtraBold family" test to expect `'Archivo-SemiExpandedExtraBold'`, and rename it "the wordmark uses Archivo SemiExpanded ExtraBold".

- [ ] **Step 3: `components/HomeContinue.tsx`:**

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OutdatedGlyph, PlayGlyph } from './ActionGlyphs';
import { Flag } from './Flag';
import { TeamMarker } from './TeamMarker';
import { useT } from '@/i18n/useT';
import { flagFor } from '@/lib/flags';
import {
  continueMeta,
  continueSpoken,
  type HomeContinue as HomeContinueData,
} from '@/lib/homeView';
import { iconSize, opacity, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Home's Continue (#181): one ctaBg pill with the team's flag or marker,
// "CONTINUE SPAIN", the level and best (and OUTDATED when it is, #180), and a
// play circle. A tap starts the round; the screen passes that in. One button
// to a screen reader, read the way a picker row is.
export function HomeContinue({
  data,
  name,
  onPress,
}: {
  data: HomeContinueData;
  name: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const t = useT();
  const flag = data.squad.kind === 'nation' ? flagFor(data.squad.name) : null;
  const styles = StyleSheet.create({
    button: {
      minHeight: sizes.home.continue,
      borderRadius: radii.pill,
      backgroundColor: colors.ctaBg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
      paddingLeft: spacing.md + 2,
      paddingRight: spacing.sm,
      paddingVertical: spacing.xs,
    },
    text: { flex: 1, minWidth: 0, gap: spacing.xxs / 2 },
    title: { ...typography.homeButton, color: colors.ctaText },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: spacing.xxs,
    },
    meta: { ...typography.homeMeta, color: colors.ctaMuted },
    play: {
      width: sizes.home.play,
      height: sizes.home.play,
      borderRadius: sizes.home.play / 2,
      backgroundColor: colors.ctaText,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <Pressable
      testID="home-continue"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={continueSpoken(name, data, t)}
      style={({ pressed }) => [styles.button, pressed && { opacity: opacity.settled }]}
    >
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {flag ? (
          <Flag code={flag} size="continue" label={name} lineColor={colors.ctaLine} />
        ) : (
          <TeamMarker marker={data.squad.marker} variant="continue" ringColor={colors.ctaLine} />
        )}
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {t.home.continueTeam(name)}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{continueMeta(data, t)}</Text>
          {data.best?.outdated && (
            <>
              <Text style={styles.meta}>·</Text>
              <OutdatedGlyph color={colors.ctaMuted} size={iconSize.outdated} />
              <Text style={styles.meta}>{t.common.outdated}</Text>
            </>
          )}
        </View>
      </View>
      <View style={styles.play}>
        <PlayGlyph color={colors.ctaBg} />
      </View>
    </Pressable>
  );
}
```

The `·` is a literal with no letters, so the lint allows it; the meta line already uses `·`. If the lint still flags it, put it in a module-scope `const SEPARATOR = '·'`.

- [ ] **Step 4: `components/HomeSquads.tsx`:**

```tsx
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Flag } from './Flag';
import { ChevronGlyph } from './SettingsGlyphs';
import { TeamMarker } from './TeamMarker';
import { squadDisplayName } from '@/i18n/displayNames';
import { useLanguage, useT } from '@/i18n/useT';
import { flagFor } from '@/lib/flags';
import type { SquadManifestEntry } from '@/types/squad';
import { borderWidths, opacity, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Home's row under the main button (#181): the starred teams as round buttons,
// newest first, each spoken by its name and opening its Difficulty; they scroll
// sideways when they don't fit. "All teams ›" to the picker sits on the right,
// always.
export function HomeSquads({
  squads,
  onOpen,
  onAllTeams,
}: {
  squads: readonly SquadManifestEntry[];
  onOpen: (squadId: string) => void;
  onAllTeams: () => void;
}) {
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: sizes.minTapTarget,
    },
    squads: { flex: 1 },
    squadsContent: { gap: spacing.xxs + 2 },
    squad: {
      width: sizes.roundButton,
      height: sizes.roundButton,
      borderRadius: sizes.roundButton / 2,
      backgroundColor: colors.surface,
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    allTeams: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxs,
      minHeight: sizes.minTapTarget,
      marginLeft: 'auto',
    },
    allTeamsLabel: { ...typography.rowTitle, color: colors.textSecondary },
  });

  return (
    <View style={styles.row}>
      {squads.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.squads}
          contentContainerStyle={styles.squadsContent}
        >
          {squads.map((squad) => {
            const name = squadDisplayName(squad, language);
            const flag = squad.kind === 'nation' ? flagFor(squad.name) : null;
            return (
              <Pressable
                key={squad.id}
                testID={`home-squad-${squad.id}`}
                onPress={() => onOpen(squad.id)}
                accessibilityRole="button"
                accessibilityLabel={name}
                style={({ pressed }) => [styles.squad, pressed && { opacity: opacity.settled }]}
              >
                <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  {flag ? (
                    <Flag code={flag} size="squad" label={name} />
                  ) : (
                    <TeamMarker marker={squad.marker} variant="squad" />
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <Pressable
        testID="home-all-teams"
        onPress={onAllTeams}
        accessibilityRole="button"
        accessibilityLabel={t.home.allTeams}
        style={({ pressed }) => [styles.allTeams, pressed && { opacity: opacity.settled }]}
      >
        <Text style={styles.allTeamsLabel}>{t.home.allTeams}</Text>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <ChevronGlyph color={colors.textSecondary} />
        </View>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 5: Rewrite `app/index.tsx`:**

```tsx
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StarGlyph } from '@/components/ActionGlyphs';
import { HomeContinue } from '@/components/HomeContinue';
import { HomeSquads } from '@/components/HomeSquads';
import { NumberWall } from '@/components/NumberWall';
import { GearGlyph } from '@/components/SettingsGlyphs';
import { Wordmark } from '@/components/Wordmark';
import { squadDisplayName } from '@/i18n/displayNames';
import { useLanguage, useT } from '@/i18n/useT';
import { homeView } from '@/lib/homeView';
import { getRoster, getSquad, listSquads } from '@/lib/squads';
import { useProgress, useProgressHydrated } from '@/stores/progress';
import { useSession } from '@/stores/session';
import { borderWidths, iconSize, opacity, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Home (#181): the number wall drifting behind "KNOW EVERY NUMBER.", then
// Continue and the starred squads for a returning player, or START TRAINING
// and the star hint on first run. Spec:
// docs/superpowers/specs/2026-10-23-number-wall-home-design.md.
export default function Home() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  const hydrated = useProgressHydrated();
  const lastPlayed = useProgress((s) => s.lastPlayed);
  const bestScores = useProgress((s) => s.bestScores);
  const starred = useProgress((s) => s.starredSquads);
  const setLastPlayed = useProgress((s) => s.setLastPlayed);
  const startRound = useSession((s) => s.startRound);

  const view = homeView({ hydrated, lastPlayed, bestScores, starred, squads: listSquads() });
  const wallTop = insets.top + sizes.roundButton;
  const topFade = wallTop + sizes.home.topFade;

  const openPicker = () => router.push('/team-picker');
  const openSquad = (squadId: string) =>
    router.push({ pathname: '/team/[squadId]/difficulty', params: { squadId } });
  // Continue starts the round at the last-played level, as Start Training did.
  const continueRound = (squadId: string, level: number) => {
    const squad = getSquad(squadId);
    if (squad === undefined) return;
    startRound(squad, getRoster(squad.id), level as 1 | 2 | 3);
    setLastPlayed(squad.id, level);
    router.push({
      pathname: '/play/[squadId]/[level]',
      params: { squadId: squad.id, level: String(level) },
    });
  };

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    topFade: { position: 'absolute', left: 0, right: 0, top: 0, height: topFade },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: sizes.roundButton,
      marginTop: insets.top,
      paddingHorizontal: spacing.lg,
    },
    gear: {
      width: sizes.roundButton,
      height: sizes.roundButton,
      borderRadius: sizes.roundButton / 2,
      backgroundColor: colors.surface,
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    spacer: { flex: 1 },
    skirt: { height: sizes.home.skirt },
    block: {
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingBottom: insets.bottom + spacing.xl,
      gap: spacing.md,
    },
    headline: { ...typography.homeHeadline, color: colors.textPrimary, marginBottom: spacing.xxs },
    start: {
      minHeight: sizes.home.start,
      borderRadius: radii.pill,
      backgroundColor: colors.ctaBg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    startLabel: { ...typography.homeButton, color: colors.ctaText, textAlign: 'center' },
    hint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      minHeight: sizes.minTapTarget,
    },
    hintText: { ...typography.homeHint, color: colors.textMuted, flexShrink: 1 },
  });

  return (
    <View style={styles.root}>
      <NumberWall top={wallTop} />
      <LinearGradient
        colors={[colors.background, colors.background, colors.backgroundClear]}
        locations={[0, insets.top / topFade, 1]}
        style={styles.topFade}
        pointerEvents="none"
      />

      <View style={styles.topBar}>
        <Wordmark />
        <Pressable
          testID="home-settings"
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel={t.home.settings}
          style={({ pressed }) => [styles.gear, pressed && { opacity: opacity.settled }]}
        >
          <GearGlyph color={colors.textPrimary} ground={colors.surface} />
        </Pressable>
      </View>

      <View style={styles.spacer} />

      <LinearGradient
        colors={[colors.backgroundClear, colors.background]}
        style={styles.skirt}
        pointerEvents="none"
      />
      <View style={styles.block}>
        <Text style={styles.headline}>{t.home.headline}</Text>

        {view.kind === 'returning' && (
          <HomeContinue
            data={view.continue}
            name={squadDisplayName(view.continue.squad, language)}
            onPress={() => continueRound(view.continue.squad.id, view.continue.level)}
          />
        )}
        {view.kind === 'firstRun' && (
          <Pressable
            testID="home-start"
            onPress={openPicker}
            accessibilityRole="button"
            accessibilityLabel={t.home.startTraining}
            style={({ pressed }) => [styles.start, pressed && { opacity: opacity.settled }]}
          >
            <Text style={styles.startLabel}>{t.home.startTraining}</Text>
          </Pressable>
        )}

        {view.kind === 'returning' || (view.kind === 'firstRun' && view.starred.length > 0) ? (
          <HomeSquads squads={view.starred} onOpen={openSquad} onAllTeams={openPicker} />
        ) : view.kind === 'firstRun' ? (
          <View style={styles.hint}>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <StarGlyph color={colors.textMuted} filled={false} size={iconSize.starHint} />
            </View>
            <Text style={styles.hintText}>{t.home.starHint}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
```

Notes:

- `LinearGradient`'s `pointerEvents` prop may be deprecated in RN 0.86. If the typecheck or a warning complains, move it into the style (`pointerEvents: 'none'`), as `NumberWall` does.
- Check the gaps against the canvas: 20 pt from the headline to the button, 16 pt from the button to the row. With `gap: spacing.md` and `marginBottom: spacing.xxs` on the headline, that is 20 and 16.
- If a first-run player with starred teams sees "All teams ›" next to START TRAINING, that is intended: spec, decision 3.

- [ ] **Step 6: Remove what only the old Home used.** Run:

  `git grep -n -E "homeCascade|celebrationRiseDuration|strikeTiming\.home|wordmarkMarkHero|wordmarkHero|teamDot|chevronLarge|controlHeightLarge|browseAllTeams|large[ =}]" -- app components lib theme design scripts i18n`

  For each hit:
  - Delete `homeCascade`, `celebrationRiseDuration` and the `home` entry of `strikeTiming`. Narrow `strikeTiming`'s type to `Record<'excellent' | 'passed', StrikeTiming>` and update its comment, which mentions `home`.
  - Delete `sizes.teamDot`, `iconSize.chevronLarge` and `typography.wordmarkHero` if nothing else reads them.
  - Keep `sizes.wordmarkMarkHero`: `app/store/feature-graphic.tsx` uses it. Change its comment to "The feature graphic's large mark (`app/store/feature-graphic.tsx`)."
  - Delete `home.browseAllTeams` from all five catalogs and its line in `i18n/budgets.ts`.
  - If `Button`'s `large` prop now has no caller, delete it and `sizes.controlHeightLarge` along with its comment line ("Home's 'Start Training' is the one 56px control…"). Otherwise keep it.
  - Update the comments in `theme/tokens.ts` that mention the home lockup: above `durations` ("The round-over celebration and the home lockup are the one carve-out") and the celebration header ("and the once-per-launch home lockup"). Make them say the round-over celebration only.
  - In `.claude/rules/design-tokens.md`, change "The round-over celebration and the home lockup are the one carve-out: their timelines (`strikeTiming`, `resultsTimeline`, `homeCascade` in `theme/tokens.ts`) may run past 300 ms." to "The round-over celebration is the other carve-out: its timelines (`strikeTiming`, `resultsTimeline` in `theme/tokens.ts`) may run past 300 ms."
  - In `scripts/capture-screens.mjs`, the `SETTLE_MS` comment names Home's letter cascade as the long pole. Task 6 rewrites it, so leave it here.

- [ ] **Step 7: Regenerate the licence notices.** Run `npm run gen:licences`. Expected: `lib/licences.generated.ts` now lists react-native-svg, because `app/index.tsx` imports it through `NumberWall`. If it refuses a licence, stop and report.

- [ ] **Step 8: Run the checks.** Run `npm run typecheck && npm run lint && npm test`. Expected: all pass. Fix any test that pinned a removed token. Change the test's expectation only where the token is genuinely gone, never to hide a regression.

- [ ] **Step 9: Look at it.** Run `npx expo start --web --port 8099` in the background, open `http://localhost:8099/` with Playwright, or `npm run shots` in Task 6, and confirm the first-run Home renders: the wall, the headline, START TRAINING and the hint. If the SVG numbers render in a fallback font on web, `fontFamily` must match the name expo-font registers: `'Archivo-ExtraCondensedBlack'`, the key in `theme/fonts.ts`. Stop the server afterwards.

- [ ] **Step 10: Commit**

```bash
git add -A app components theme i18n lib .claude/rules/design-tokens.md
git commit -m "feat(home): the number-wall Home with Continue and Your squads (#181)"
```

---

### Task 6: Screenshots and SCREENS.md

**Files:**

- Modify: `scripts/capture-screens.mjs`
- Modify: `design/SCREENS.md`
- Regenerate: `design/screens/*.png`

**Interfaces:**

- Consumes: the Home's testIDs `home-continue`, `home-start`, `home-all-teams`, `home-squad-<id>`, `home-settings`.

- [ ] **Step 1: Add a `seedLastPlayed` helper** beside `seedStarred` in `scripts/capture-screens.mjs`:

```js
/**
 * Set the last team and level a round was started for, as Home's Continue
 * reads it (#181). Like `seedBestScores`, it writes localStorage only, for the
 * next `capture.open` to rehydrate.
 */
async function seedLastPlayed(capture, squadId, level) {
  await capture.page.evaluate(
    ([id, lvl]) => {
      const key = 'escuadra-progress';
      let stored = null;
      try {
        stored = JSON.parse(localStorage.getItem(key) ?? 'null');
      } catch {
        stored = null;
      }
      const next = stored ?? { state: {}, version: 1 };
      next.state = { ...next.state, lastPlayed: { squadId: id, level: lvl } };
      localStorage.setItem(key, JSON.stringify(next));
    },
    [squadId, level],
  );
}
```

- [ ] **Step 2: Hold the wall still for Home's shots.** Add a helper:

```js
/**
 * Open Home with Reduce Motion emulated, so the number wall (#181) stands at its
 * starting offsets and the PNG diffs cleanly; then restore motion for the
 * shots after it. Reanimated reads the setting as the page loads, and
 * `capture.open` reloads the page.
 */
async function openHomeStill(capture) {
  await capture.page.emulateMedia({ reducedMotion: 'reduce' });
  await capture.open('/');
  await capture.page.emulateMedia({ reducedMotion: 'no-preference' });
}
```

Replace `await capture.open('/');` before `capture.shoot('01-home')` with `await openHomeStill(capture);`. `01-home` is first run, since nothing is seeded yet.

- [ ] **Step 3: Add the two returning shots** after `capture.shoot('03d-team-picker-nations-starred');`. At that point the store holds Armenia's outdated scores, Liverpool's current ones, and the starred `['arm', 'esp', 'rma', 'ars']`:

```js
// Home (#181), returning: Liverpool to continue at level 3 (8/10, current),
// and the four teams starred above. Then Armenia, whose level-3 best is
// outdated, with nothing starred, so the row is "All teams" alone. The
// rounds below write their own last-played, so nothing later sees these.
await seedLastPlayed(capture, 'liv', 3);
await openHomeStill(capture);
await capture.shoot('01e-home-returning');
await seedLastPlayed(capture, 'arm', 3);
await seedStarred(capture, []);
await openHomeStill(capture);
await capture.shoot('01f-home-outdated');
```

Then rewrite the `SETTLE_MS` comment, which named Home's letter cascade as the long pole: "The Results cascade (strip, strike, card rise) is the long pole." Keep the value 2200.

- [ ] **Step 4: Capture.** Run `npm run shots`. Expected: it ends without errors and rewrites `design/screens/`. Read the six Home PNGs (`01-home`, `01e-home-returning`, `01f-home-outdated`, each also `-light`) with the Read tool and compare them with the canvas's Home artboard:
  - the outlined wall with 7, 10 and 19 filled, fading out above the headline;
  - the top bar;
  - Continue with Liverpool's red marker and "LEVEL 3 · BEST 8/10";
  - four round buttons, then All teams;
  - Armenia's flag with "· ⏱ OUTDATED";
  - first run's START TRAINING and the hint.

  In light, the pills are dark. Fix anything off in Task 5's files and re-run. Check `git status` too: only Home's PNGs, and any screen whose pixels really changed, should differ. If many unrelated PNGs differ by anti-aliasing noise, discard those changes with `git checkout -- <file>`.

- [ ] **Step 5: Update `design/SCREENS.md`.**
  - Rewrite the `/` row in the screens table: "Home (#181). The number wall: four rows of outlined shirt numbers drifting in alternate directions (still under Reduce Motion), under the top bar's mark, wordmark and Settings gear. 'KNOW EVERY NUMBER.', then for a returning player Continue (flag or marker, CONTINUE {TEAM}, LEVEL n · BEST x/10 with OUTDATED when it is, a play circle; it starts the round) and a row of starred teams as round buttons with All teams ›; on first run START TRAINING to the picker and the star hint."
  - Add `screens/01e-home-returning.png` ("Home, returning: Liverpool to continue, four starred teams") and `screens/01f-home-outdated.png` ("Home, returning with an outdated best and nothing starred") to the captures table, beside `01-home`.
  - Change `01-home`'s line to "Home, first run".
  - Match the light-variant naming the file already uses.

- [ ] **Step 6: Run the checks.** Run `npm run check`. Expected: it passes. Save its full output for the PR.

- [ ] **Step 7: Commit**

```bash
git add scripts/capture-screens.mjs design/
git commit -m "docs(design): Home's screens, first run, returning and outdated (#181)"
```
