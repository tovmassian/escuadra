# Turn 2 — screen re-pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the six-screen design re-pass from `docs/superpowers/specs/2026-08-22-turn-2-screen-repass.md`, plus a player-id filter on Study.

**Architecture:** Each screen change extracts its decision logic into a pure, unit-testable module under `lib/`, and leaves the React Native component as a thin renderer over that module's output. This is not stylistic preference — the project's Vitest setup has **no React Native renderer**, so logic that lives inside a component cannot be tested at all. Every existing test targets `lib/`, `stores/`, or `theme/`.

**Tech Stack:** Expo SDK 54 (pinned), React Native, expo-router, Zustand 5, Vitest.

## Global Constraints

Every task's requirements implicitly include this section. Copied from `CLAUDE.md` and the spec.

- **Never hardcode a colour, spacing value, or font size.** Everything comes from `theme/tokens.ts`. If a token is missing, add it to the token file rather than inlining a value. Team identity colour is real-world content and is exempt.
- **No club crests, badges, logos, or shield shapes. Ever.** Teams are identified by text and a `TeamMarker` banded rectangle. National flags are the one carve-out.
- **No text input anywhere. No keyboard.** Every answer is a tap.
- **No auth, no accounts, no analytics SDKs, no network calls.** v0 is fully offline.
- **Every animation stays under 300ms.** Use `durations.*`.
- **`lib/questionEngine.ts` stays pure** — no React, no store imports, no I/O. Do not modify it in this plan.
- **Two stores only.** `stores/progress.ts` persisted; `stores/session.ts` ephemeral. A half-finished round must not survive an app restart — do not add persistence to `session.ts`.
- **TypeScript is strict, including `noUncheckedIndexedAccess`.** Do not weaken it, and do not use `any` or a non-null assertion (`!`) to silence an index access — check for `undefined` explicitly instead.
- **The product is called Escuadra.** "Squad Trainer", "Squad Game", "Squad Quiz" are stale — fix them on sight.
- **No new npm dependencies.** Do not add `react-native-svg` or anything else.
- **Do not modify** `metro.config.js`, `scripts/capture-screens.mjs`, `data/`, or `assets/`.
- **Level-3 nationality and club options stay text only.** Do not add markers to them.
- Run `npm run check` (typecheck + lint + prettier + vitest) and confirm green before every commit.

## Invariants the re-pass must not break

From `design/SCREENS.md`. A change that violates one of these is wrong even if it looks better.

6. Question parts must stay **scrollable** — later parts became unreachable without it.
7. On levels 2 and 3, asking **stops once a part is answered wrong**.
8. Per-part verdicts show the **real** result; a part must never show a green check it did not earn.
9. **No partial credit.** The progress bar counts questions, not parts, so all three levels read 1..10 and the bar does not move mid-question.
10. Results screen CTAs differ by pass/fail and by whether the level ceiling is reached.

## Already true — do not "fix" these

- `heroCardSize[3]` is already `108` and `heroNumberSize[3]` is already `52` in `theme/tokens.ts`. The re-pass describes the level-3 hero "shrinking to 108" as though it were a change; it is not. Leave both alone.
- The question parts are already inside a `ScrollView` (invariant 6) and already stop on a wrong part (invariant 7, in `stores/session.ts#answerPart`). Do not re-implement either.

## File structure

| File                                     | Responsibility                                                 | Task       |
| ---------------------------------------- | -------------------------------------------------------------- | ---------- |
| `lib/roundView.ts` (new)                 | Pure play-screen view model: progress outcomes, part-rail rows | 1, 5       |
| `lib/roundView.test.ts` (new)            | Tests for the above                                            | 1, 5       |
| `lib/ladderView.ts` (new)                | Pure difficulty-ladder model: status + unlock hint per level   | 2          |
| `lib/ladderView.test.ts` (new)           | Tests for the above                                            | 2          |
| `lib/pickerView.ts` (new)                | Pure team-picker row model: highest level + best score         | 3          |
| `lib/pickerView.test.ts` (new)           | Tests for the above                                            | 3          |
| `lib/studyView.ts` (new)                 | Pure roster filtering, by position and by player id            | 6          |
| `lib/studyView.test.ts` (new)            | Tests for the above                                            | 6          |
| `lib/resultsView.ts` (new)               | Pure results model: action order, labels, flawless detection   | 7, 8       |
| `lib/resultsView.test.ts` (new)          | Tests for the above                                            | 7, 8       |
| `components/ProgressDots.tsx`            | One dash per question, coloured by outcome                     | 1          |
| `components/DifficultyRow.tsx`           | Ladder rung; accent follows playable status, locked shows hint | 2          |
| `components/TeamRow.tsx`                 | Picker row with progress sub-line                              | 3          |
| `components/Wordmark.tsx`                | Lockup; gains `showTrail` and `stacked`                        | 4          |
| `components/VerdictGlyph.tsx` (new)      | The mark used as a correct/incorrect glyph                     | 5          |
| `components/PartRail.tsx` (new)          | The question screen's per-part verdict rail                    | 5          |
| `app/index.tsx`                          | Home; lockup promoted to optical centre                        | 4          |
| `app/team-picker.tsx`                    | Passes progress to `TeamRow`                                   | 3          |
| `app/team/[squadId]/difficulty.tsx`      | Consumes `ladderView`; rungs close up                          | 2          |
| `app/team/[squadId]/study.tsx`           | Accepts a `?players=` filter                                   | 6          |
| `app/play/[squadId]/[level]/index.tsx`   | Outcome bar, part rail, team marker                            | 1, 5       |
| `app/play/[squadId]/[level]/results.tsx` | Study-These-N primary; a la escuadra variant                   | 7, 8       |
| `theme/tokens.ts`                        | New size tokens; `teamUnderline` removed                       | 3, 4, 5, 8 |

---

### Task 1: Progress bar coloured by outcome

The bar renders ten identical dashes separated only by opacity, so a player cannot see which questions they got wrong. Colour each dash by its real outcome.

**This is the only change level 1 receives.** The 220px hero with the 104px number is the strongest thing in the app; do not touch it.

Invariant 9 governs: the bar counts **questions**, not parts. A question stays `current` until its last part resolves, so a level-3 question must not advance the bar three times.

**Files:**

- Create: `lib/roundView.ts`
- Create: `lib/roundView.test.ts`
- Modify: `components/ProgressDots.tsx`
- Modify: `app/play/[squadId]/[level]/index.tsx`

**Interfaces:**

- Consumes: `QuestionResult` from `@/stores/session`, shape `{ question, parts, correct: boolean | null }`.
- Produces: `export type DotOutcome = 'correct' | 'wrong' | 'current' | 'future'` and `export function progressOutcomes(results: QuestionResult[], currentIndex: number): DotOutcome[]`, both from `lib/roundView.ts`. Task 5 adds further exports to the same file.

- [ ] **Step 1: Write the failing test**

Create `lib/roundView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { progressOutcomes } from './roundView';
import type { QuestionResult } from '@/stores/session';

// These helpers only read `.correct`, so a minimal stub keeps the tests
// readable — building real Question objects would obscure what is asserted.
function result(correct: boolean | null): QuestionResult {
  return { question: { parts: [] } as unknown as QuestionResult['question'], parts: [], correct };
}

describe('progressOutcomes', () => {
  it('marks answered questions by their real outcome', () => {
    const outcomes = progressOutcomes([result(true), result(false), result(null)], 2);
    expect(outcomes[0]).toBe('correct');
    expect(outcomes[1]).toBe('wrong');
  });

  it('marks the current question as current even though it is unanswered', () => {
    expect(progressOutcomes([result(true), result(null), result(null)], 1)[1]).toBe('current');
  });

  it('marks questions after the current one as future', () => {
    expect(progressOutcomes([result(true), result(null), result(null)], 1)[2]).toBe('future');
  });

  it('keeps the current question current while its parts are still being answered', () => {
    // Invariant 9: no partial credit, so the bar must not advance mid-question.
    expect(progressOutcomes([result(null), result(null)], 0)[0]).toBe('current');
  });

  it('returns one outcome per question', () => {
    expect(progressOutcomes([result(true), result(null), result(null)], 1)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/roundView.test.ts`
Expected: FAIL — `Failed to resolve import "./roundView"`.

- [ ] **Step 3: Write the implementation**

Create `lib/roundView.ts`:

```ts
// Pure view-model helpers for the play screen. No React and no store values —
// only types — so this stays unit-testable, since the project's Vitest setup
// has no React Native renderer.
import type { QuestionResult } from '@/stores/session';

export type DotOutcome = 'correct' | 'wrong' | 'current' | 'future';

/**
 * One outcome per question, for the progress bar.
 *
 * Invariant 9: the bar counts questions, not parts. A question stays
 * `current` until its last part resolves, so a level-3 question does not
 * advance the bar three times.
 */
export function progressOutcomes(results: QuestionResult[], currentIndex: number): DotOutcome[] {
  return results.map((r, i) => {
    if (r.correct === true) return 'correct';
    if (r.correct === false) return 'wrong';
    return i === currentIndex ? 'current' : 'future';
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/roundView.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Render the outcomes**

Replace the whole of `components/ProgressDots.tsx`:

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { DotOutcome } from '@/lib/roundView';
import { colors, opacity, radii, sizes, spacing } from '@/theme/tokens';

interface ProgressDotsProps {
  /** One entry per question, in order. */
  outcomes: DotOutcome[];
}

// A dash per question, coloured by what actually happened to it — ten
// identical dashes told the player nothing about their round.
export function ProgressDots({ outcomes }: ProgressDotsProps) {
  return (
    <View style={styles.row}>
      {outcomes.map((outcome, i) => (
        <View key={i} style={[styles.dot, dotStyle(outcome)]} />
      ))}
    </View>
  );
}

function dotStyle(outcome: DotOutcome) {
  switch (outcome) {
    case 'correct':
      return { backgroundColor: colors.success, opacity: opacity.dotPast };
    case 'wrong':
      return { backgroundColor: colors.error, opacity: opacity.dotPast };
    case 'current':
      return { backgroundColor: colors.accent, opacity: 1 };
    case 'future':
      return { backgroundColor: colors.border, opacity: opacity.dotFuture };
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xxs + 1 },
  dot: { flex: 1, height: sizes.progressDot, borderRadius: radii.sm - 5 },
});
```

- [ ] **Step 6: Update the play screen call site**

In `app/play/[squadId]/[level]/index.tsx`, add to the imports:

```tsx
import { progressOutcomes } from '@/lib/roundView';
```

Replace the `<ProgressDots ... />` line with:

```tsx
<ProgressDots outcomes={progressOutcomes(session.results, session.currentIndex)} />
```

- [ ] **Step 7: Verify**

Run: `npm run check`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add lib/roundView.ts lib/roundView.test.ts components/ProgressDots.tsx "app/play/[squadId]/[level]/index.tsx"
git commit -m "feat(play): colour the progress bar by question outcome"
```

---

### Task 2: Difficulty ladder — accent the playable rung

Two hierarchy inversions in the captured screen, both real bugs:

1. `components/DifficultyRow.tsx` applies `cardEmphasis` when `level === 3` **regardless of status**, so the locked Full Profile row wears the accent border while the unlocked, playable row wears none. The ladder points at the rung you cannot reach.
2. `app/team/[squadId]/difficulty.tsx` sets `rows: { flex: 1 }` and `DifficultyRow` sets `row: { flex: 1 }`, so the three rungs stretch to fill the screen with roughly 300px of dead connector between them — three unrelated cards, not a ladder.

Each locked row should also state its unlock condition rather than leaving the padlock to imply it.

**Files:**

- Create: `lib/ladderView.ts`
- Create: `lib/ladderView.test.ts`
- Modify: `components/DifficultyRow.tsx`
- Modify: `app/team/[squadId]/difficulty.tsx`

**Interfaces:**

- Consumes: `scoreKey` from `@/stores/progress`; `Level` from `@/lib/questionEngine`.
- Produces: `export type DifficultyStatus = 'best' | 'unlocked' | 'locked'`, `export interface LadderRow { level: Level; status: DifficultyStatus; best?: { correct: number; total: number }; unlockHint?: string }`, and `export function ladderRows(squadId: string, bestScores: Record<string, number>, completedLevels: Record<string, true>): LadderRow[]` — all from `lib/ladderView.ts`.

**Dependency direction matters here.** `DifficultyStatus` currently lives in `components/DifficultyRow.tsx`. Move it to `lib/ladderView.ts` and have the component import it from there, not the reverse. A `lib/` module must never import from `components/`: the Vitest run has no React Native renderer, so pulling a `.tsx` file into a `lib` test risks loading `react-native` and failing. Inverting the dependency removes the risk entirely rather than relying on `import type` erasure.

- [ ] **Step 1: Write the failing test**

Create `lib/ladderView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ladderRows } from './ladderView';

describe('ladderRows', () => {
  it('unlocks level 1 with no history at all', () => {
    expect(ladderRows('bar', {}, {})[0]?.status).toBe('unlocked');
  });

  it('locks levels 2 and 3 with no history at all', () => {
    const rows = ladderRows('bar', {}, {});
    expect(rows[1]?.status).toBe('locked');
    expect(rows[2]?.status).toBe('locked');
  });

  it('unlocks level 2 once level 1 is completed, even with a zero score', () => {
    // A legitimate 0/10 must still unlock — this is why `completedLevels`
    // exists separately from `bestScores`.
    expect(ladderRows('bar', { 'bar:1': 0 }, { 'bar:1': true })[1]?.status).toBe('unlocked');
  });

  it('reports a level with a recorded score as best, carrying the score', () => {
    const row = ladderRows('bar', { 'bar:1': 7 }, { 'bar:1': true })[0];
    expect(row?.status).toBe('best');
    expect(row?.best).toEqual({ correct: 7, total: 10 });
  });

  it('gives each locked level a hint naming the level that unlocks it', () => {
    const rows = ladderRows('bar', {}, {});
    expect(rows[1]?.unlockHint).toBe('Clear L1');
    expect(rows[2]?.unlockHint).toBe('Clear L2');
  });

  it('gives unlocked and best levels no unlock hint', () => {
    const rows = ladderRows('bar', { 'bar:1': 7 }, { 'bar:1': true });
    expect(rows[0]?.unlockHint).toBeUndefined();
    expect(rows[1]?.unlockHint).toBeUndefined();
  });

  it('does not leak progress between squads', () => {
    const rows = ladderRows('rma', { 'bar:1': 9 }, { 'bar:1': true });
    expect(rows[0]?.status).toBe('unlocked');
    expect(rows[1]?.status).toBe('locked');
  });

  it('returns exactly three rows in level order', () => {
    expect(ladderRows('bar', {}, {}).map((r) => r.level)).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/ladderView.test.ts`
Expected: FAIL — `Failed to resolve import "./ladderView"`.

- [ ] **Step 3: Write the implementation**

Create `lib/ladderView.ts`:

```ts
// Pure difficulty-ladder model. Kept out of the screen so the unlock rules
// are unit-testable — the project's Vitest setup has no RN renderer, so this
// file must never import from `components/`.
import type { Level } from '@/lib/questionEngine';
import { scoreKey } from '@/stores/progress';

const LEVELS: Level[] = [1, 2, 3];
const ROUND_LENGTH = 10;

export type DifficultyStatus = 'best' | 'unlocked' | 'locked';

export interface LadderRow {
  level: Level;
  status: DifficultyStatus;
  best?: { correct: number; total: number };
  /** Present only when locked — states what clears the gate, so the padlock
   *  is not left to imply it. */
  unlockHint?: string;
}

export function ladderRows(
  squadId: string,
  bestScores: Record<string, number>,
  completedLevels: Record<string, true>,
): LadderRow[] {
  return LEVELS.map((level) => {
    const best = bestScores[scoreKey(squadId, level)];
    // `completedLevels`, not `bestScores`, so a legitimate 0/10 round still
    // unlocks the next level.
    const prevCompleted = level === 1 || completedLevels[scoreKey(squadId, level - 1)] === true;

    if (best !== undefined) {
      return { level, status: 'best', best: { correct: best, total: ROUND_LENGTH } };
    }
    if (prevCompleted) return { level, status: 'unlocked' };
    return { level, status: 'locked', unlockHint: `Clear L${level - 1}` };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/ladderView.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Move the accent onto the playable rung**

In `components/DifficultyRow.tsx`:

Delete the local `export type DifficultyStatus = ...` line and re-export the one that now lives in the lib module, so existing importers keep working:

```tsx
import { type DifficultyStatus } from '@/lib/ladderView';

export type { DifficultyStatus };
```

Add `unlockHint` to `DifficultyRowProps`, after `bestScore`:

```tsx
  bestScore?: { correct: number; total: number };
  /** Locked rows only — states what clears the gate. */
  unlockHint?: string;
  onPress?: () => void;
```

Add it to the destructured parameters, after `bestScore,`:

```tsx
  unlockHint,
```

Replace the card `View`'s style array so the accent follows playability rather than level:

```tsx
      <View style={[styles.card, status === 'unlocked' && styles.cardEmphasis]}>
```

In the header row, add the locked hint after the existing best pill:

```tsx
{
  locked && unlockHint && <Text style={styles.unlockHint}>{unlockHint}</Text>;
}
```

Remove `flex: 1` from `row` so a rung is only as tall as its card:

```tsx
  row: { flexDirection: 'row', gap: spacing.sm + 2, alignItems: 'center' },
```

Delete the now-unused `cardRaised` rule. Replace `cardEmphasis` and add `unlockHint`:

```tsx
  cardEmphasis: {
    borderWidth: borderWidths.thick,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceRaised,
  },
  unlockHint: { ...typography.captionEyebrow, color: colors.textMuted, flexShrink: 0 },
```

Add `borderWidths` to the `@/theme/tokens` import.

- [ ] **Step 6: Close the rungs up and consume ladderRows**

In `app/team/[squadId]/difficulty.tsx`, replace the `LEVELS` constant with copy-only data:

```tsx
const LEVEL_COPY: Record<Level, { title: string; description: string }> = {
  1: {
    title: 'Name from Number',
    description: 'Given a shirt number, pick the player from 4 options.',
  },
  2: {
    title: 'Name + Position',
    description: 'Pick the name, then the position — GK, DF, MF, or FW.',
  },
  3: {
    title: 'Full Profile',
    description: 'Name from 6 options, then position, then club or nationality.',
  },
};
```

Add the import:

```tsx
import { ladderRows } from '@/lib/ladderView';
```

Change the `DifficultyRow` import to drop the now-unused status type, and drop `scoreKey` from the progress import:

```tsx
import { DifficultyRow } from '@/components/DifficultyRow';
import { useProgress } from '@/stores/progress';
```

Replace the whole `.map()` block inside `styles.rows` with:

```tsx
{
  ladderRows(squad.id, bestScores, completedLevels).map((row) => {
    const copy = LEVEL_COPY[row.level];
    return (
      <DifficultyRow
        key={row.level}
        level={row.level}
        title={copy.title}
        description={copy.description}
        status={row.status}
        bestScore={row.best}
        unlockHint={row.unlockHint}
        onPress={
          row.status === 'locked'
            ? undefined
            : () =>
                router.push({
                  pathname: '/play/[squadId]/[level]',
                  params: { squadId: squad.id, level: String(row.level) },
                })
        }
      />
    );
  });
}
```

Immediately after the closing `</View>` of `styles.ladder`, add a spacer so the Study button stays pinned to the bottom:

```tsx
<View style={styles.spacer} />
```

In the stylesheet, replace `ladder` and `rows`, and add `spacer`:

```tsx
  ladder: { position: 'relative' },
  rows: { gap: spacing.md },
  spacer: { flex: 1 },
```

- [ ] **Step 7: Fix the connector span**

The connector is absolutely positioned with `top: spacing.xl, bottom: spacing.xxxl`, which was tuned for a full-height ladder. Now that the ladder is only as tall as its rungs, change the `connector` style's offsets so the line spans the badge column rather than trailing past it:

```tsx
  connector: {
    position: 'absolute',
    left: sizes.difficultyConnectorOffset,
    top: spacing.xl,
    bottom: spacing.xl,
  },
```

- [ ] **Step 8: Verify**

Run: `npm run check`
Expected: green.

- [ ] **Step 9: Commit**

```bash
git add lib/ladderView.ts lib/ladderView.test.ts components/DifficultyRow.tsx "app/team/[squadId]/difficulty.tsx"
git commit -m "fix(difficulty): accent the playable rung and close the ladder up"
```

---

### Task 3: Team picker rows carry progress

Every row shows one em-dash pill, so eleven rows say nothing eleven times. The row is the only place progress can live, so it earns its height: highest level played and best score as a mono sub-line, turning `colors.success` once the team has been cleared, with the row growing 56 → 64 to hold two lines.

"Cleared" means some level was passed at the same 8/10 ratio the results screen uses. A team played but never passed shows its score in the muted colour.

**Files:**

- Create: `lib/pickerView.ts`
- Create: `lib/pickerView.test.ts`
- Modify: `components/TeamRow.tsx`
- Modify: `components/ScorePill.tsx` (only if its `row` variant becomes dead)
- Modify: `app/team-picker.tsx`
- Modify: `theme/tokens.ts`

**Interfaces:**

- Consumes: `scoreKey` from `@/stores/progress`.
- Produces: `export interface TeamProgress { level: number; correct: number; total: number; cleared: boolean }` and `export function teamProgress(squadId: string, bestScores: Record<string, number>): TeamProgress | null` from `lib/pickerView.ts`.

- [ ] **Step 1: Write the failing test**

Create `lib/pickerView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { teamProgress } from './pickerView';

describe('teamProgress', () => {
  it('returns null for a team that has never been played', () => {
    expect(teamProgress('bar', {})).toBeNull();
  });

  it('reports the only played level', () => {
    expect(teamProgress('bar', { 'bar:1': 7 })).toEqual({
      level: 1,
      correct: 7,
      total: 10,
      cleared: false,
    });
  });

  it('reports the highest level played, not the highest score', () => {
    // Level 3 is the meaningful progress marker even though level 1 scored higher.
    const progress = teamProgress('bar', { 'bar:1': 10, 'bar:3': 4 });
    expect(progress?.level).toBe(3);
    expect(progress?.correct).toBe(4);
  });

  it('marks a team cleared once a level is passed at 8/10', () => {
    expect(teamProgress('bar', { 'bar:1': 8 })?.cleared).toBe(true);
  });

  it('does not mark a team cleared below the pass ratio', () => {
    expect(teamProgress('bar', { 'bar:1': 7 })?.cleared).toBe(false);
  });

  it('marks cleared from any level, not only the highest played', () => {
    // Passed L1, then started L2 and did badly — the team is still cleared.
    expect(teamProgress('bar', { 'bar:1': 9, 'bar:2': 2 })?.cleared).toBe(true);
  });

  it('does not leak progress between squads', () => {
    expect(teamProgress('rma', { 'bar:1': 9 })).toBeNull();
  });

  it('treats a legitimate zero score as played', () => {
    expect(teamProgress('bar', { 'bar:1': 0 })).toEqual({
      level: 1,
      correct: 0,
      total: 10,
      cleared: false,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/pickerView.test.ts`
Expected: FAIL — `Failed to resolve import "./pickerView"`.

- [ ] **Step 3: Write the implementation**

Create `lib/pickerView.ts`:

```ts
// Pure team-picker row model. Kept out of the screen so it is unit-testable.
import { scoreKey } from '@/stores/progress';

const LEVELS = [1, 2, 3] as const;
const ROUND_LENGTH = 10;
/** Matches the results screen's pass threshold. */
const PASS_RATIO = 0.8;

export interface TeamProgress {
  /** Highest level the team has a recorded score for. */
  level: number;
  correct: number;
  total: number;
  /** True once any level was passed — not only the highest one played. */
  cleared: boolean;
}

export function teamProgress(
  squadId: string,
  bestScores: Record<string, number>,
): TeamProgress | null {
  let highest: { level: number; correct: number } | null = null;
  let cleared = false;

  for (const level of LEVELS) {
    const score = bestScores[scoreKey(squadId, level)];
    if (score === undefined) continue;
    if (score / ROUND_LENGTH >= PASS_RATIO) cleared = true;
    if (highest === null || level > highest.level) highest = { level, correct: score };
  }

  if (highest === null) return null;
  return { level: highest.level, correct: highest.correct, total: ROUND_LENGTH, cleared };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/pickerView.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Add the taller row token**

In `theme/tokens.ts`, inside `sizes`, immediately after `rowHeight: 56,`:

```ts
  // Team-picker rows carry a progress sub-line, so they need a second line of
  // height. Plain single-line rows keep `rowHeight`.
  rowHeightTall: 64,
```

- [ ] **Step 6: Render the sub-line**

Replace the whole of `components/TeamRow.tsx`:

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TeamMarker } from './TeamMarker';
import type { TeamProgress } from '@/lib/pickerView';
import type { TeamMarker as TeamMarkerData } from '@/types/squad';
import { colors, iconSize, sizes, spacing, typography } from '@/theme/tokens';

interface TeamRowProps {
  name: string;
  marker: TeamMarkerData;
  progress: TeamProgress | null;
  onPress: () => void;
}

// Left edge (marker + name) stays put; the name truncates with an ellipsis.
// The row is the only place per-team progress can live, so it carries a mono
// sub-line rather than a right-hand pill that read the same on every row. The
// identity marker is the team's only visual identifier, per the "no crests,
// ever" constraint.
export function TeamRow({ name, marker, progress, onPress }: TeamRowProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.row}>
      <TeamMarker marker={marker} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.meta, progress?.cleared === true && styles.metaCleared]}>
          {progress === null
            ? 'NOT PLAYED'
            : `LEVEL ${progress.level} · BEST ${progress.correct}/${progress.total}`}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: sizes.rowHeightTall,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  text: { flex: 1, minWidth: 0 },
  name: { ...typography.rowTitle, color: colors.textPrimary },
  meta: { ...typography.statMonoTiny, color: colors.textMuted, marginTop: spacing.xxs - 1 },
  metaCleared: { color: colors.success },
  chevron: { fontSize: iconSize.chevron, color: colors.border },
});
```

- [ ] **Step 7: Update the picker**

In `app/team-picker.tsx`, add the import:

```tsx
import { teamProgress } from '@/lib/pickerView';
```

Delete the entire `bestFor` helper, and replace `renderItem` with:

```tsx
        renderItem={({ item }) => (
          <TeamRow
            name={item.name}
            marker={item.marker}
            progress={hydrated ? teamProgress(item.id, bestScores) : null}
            onPress={() =>
              router.push({ pathname: '/team/[squadId]/difficulty', params: { squadId: item.id } })
            }
          />
        )}
```

- [ ] **Step 8: Remove ScorePill's row variant if it is now dead**

Run: `grep -rn "ScorePill" --include=*.tsx app components`

The play screen still uses `variant="header"`, so keep the component. If no `variant="row"` usage remains, delete the `row` branch and the `empty` prop from `components/ScorePill.tsx`, along with any styles only that branch used.

- [ ] **Step 9: Verify**

Run: `npm run check`
Expected: green.

- [ ] **Step 10: Commit**

```bash
git add lib/pickerView.ts lib/pickerView.test.ts components/TeamRow.tsx components/ScorePill.tsx app/team-picker.tsx theme/tokens.ts
git commit -m "feat(picker): give each team row its level and best score"
```

---

### Task 4: Home — promote the lockup to the optical centre

The captured Home screen is roughly 70% empty: the wordmark sits in a top-left eyebrow slot and everything else is bottom-pinned. Promote the full lockup — **with the trail, which is its only legitimate home** — to the optical centre, so the dead band becomes the brand moment. This is the one screen with room for the mark at 86px, where the geometry actually reads.

This task has no pure logic and therefore no unit test. It is verified by the screenshot in Task 9.

**Files:**

- Modify: `theme/tokens.ts`
- Modify: `components/Wordmark.tsx`
- Modify: `app/index.tsx`

**Interfaces:**

- Consumes: `EscuadraMark` from `@/components/EscuadraMark`, props `{ size: number; color: string; showTrail?: boolean }`.
- Produces: `Wordmark` gains optional `showTrail?: boolean` and `stacked?: boolean`.

- [ ] **Step 1: Add the hero mark size token**

In `theme/tokens.ts`, inside `sizes`, immediately after `wordmarkMark: 30,`:

```ts
  // Home's centred lockup. The mark only reads its right angle at this size,
  // which is why the trail is shown here and nowhere else.
  wordmarkMarkHero: 86,
```

- [ ] **Step 2: Let the Wordmark stack and show its trail**

Replace the whole of `components/Wordmark.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EscuadraMark } from './EscuadraMark';
import { colors, sizes, spacing, typography } from '@/theme/tokens';

interface WordmarkProps {
  /** Mark edge length in dp. Defaults to the token-defined lockup size. */
  size?: number;
  /** The two trailing squares. Home's centred lockup only. */
  showTrail?: boolean;
  /** Mark above the word rather than beside it. */
  stacked?: boolean;
}

// The lockup: mark, then the name set lowercase in Inter 800. Lowercase is
// deliberate and comes from the design source — the old uppercase ESCUADRA
// eyebrow predates the logo iteration.
export function Wordmark({
  size = sizes.wordmarkMark,
  showTrail = false,
  stacked = false,
}: WordmarkProps) {
  return (
    <View
      style={[styles.root, stacked && styles.stacked]}
      accessibilityRole="header"
      accessibilityLabel="Escuadra"
    >
      <EscuadraMark size={size} color={colors.brandSoft} showTrail={showTrail} />
      <Text style={[styles.word, stacked && styles.wordStacked]}>escuadra</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stacked: { flexDirection: 'column', gap: spacing.md },
  word: { ...typography.wordmark, color: colors.textPrimary },
  wordStacked: { fontSize: typography.screenTitle.fontSize },
});
```

- [ ] **Step 3: Centre the lockup on Home**

In `app/index.tsx`, replace the `<Wordmark />` element and the `<View style={styles.spacer} />` that follows it with:

```tsx
<View style={styles.brandBlock}>
  <Wordmark size={sizes.wordmarkMarkHero} showTrail stacked />
</View>
```

Delete the `<Text style={styles.title}>Ready to train?</Text>` and `<Text style={styles.subtitle}>...</Text>` elements. The lockup is now the screen's headline; keeping both gives the screen two competing titles.

In the stylesheet, delete `spacer`, `title`, and `subtitle`, and add:

```tsx
  brandBlock: { flex: 1, alignItems: 'center', justifyContent: 'center' },
```

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: green. Lint will flag any import or style that became unused — delete them rather than suppressing the rule.

- [ ] **Step 5: Commit**

```bash
git add theme/tokens.ts components/Wordmark.tsx app/index.tsx
git commit -m "feat(home): promote the full lockup to the optical centre"
```

---

### Task 5: Question screen — part rail, real team marker, mark verdict glyphs

Three changes to the level-2/3 question screen, plus the removal of a dead token.

1. **Part rail.** A bare `1 · NAME` label is the only sign the question has parts, so the player cannot see how many remain. The level-3 hero is already 108px (`heroCardSize[3]`), leaving a wide empty column beside it. Move a part rail into that column: one row per part, answered parts showing the mark as a real verdict alongside the answer, the current part accented, unreached parts at `opacity.faded`.
2. **Team identity.** The 2px `primaryColor` rule under the team name becomes the real `TeamMarker`. It must be the marker, not a banded line: `orientation` is horizontal for five of the six nations, and Japan and Brazil carry overlays — at 2px tall Armenia's three bands are 0.67px each and Japan's disc is 1.2px, which would collapse Japan into a plain white line indistinguishable from Real Madrid's. At 15px tall every orientation and both overlays survive, and the play screen introduces no new identity shape.
3. **Verdict glyphs.** `AnswerOption` and `CompletedPartPill` render `✓` (U+2713) and `✕` (U+2715), which depend on a glyph Inter may not carry, causing silent font fallback. Replace them with the mark, which is already the app's own geometry.

`sizes.teamUnderline` then has no consumer and comes out of tokens.

**Invariants that bind this task.** The rail must show only verdicts that were actually earned (8), must not reveal parts that will never be asked after a wrong answer (7), must not advance the progress bar mid-question (9), and the options must stay inside the existing `ScrollView` while the rail and the CTA stay pinned outside it (6).

**Files:**

- Modify: `lib/roundView.ts`
- Modify: `lib/roundView.test.ts`
- Create: `components/VerdictGlyph.tsx`
- Create: `components/PartRail.tsx`
- Modify: `components/AnswerOption.tsx`
- Modify: `components/CompletedPartPill.tsx`
- Modify: `app/play/[squadId]/[level]/index.tsx`
- Modify: `theme/tokens.ts`

**Interfaces:**

- Consumes: `progressOutcomes` and `DotOutcome` from `lib/roundView.ts` (Task 1); `Question`, `QuestionPart` from `@/lib/questionEngine`; `QuestionResult` from `@/stores/session`; `TeamMarker` component from `@/components/TeamMarker`; `EscuadraMark` from `@/components/EscuadraMark`.
- Produces: `export type PartState = 'answered-correct' | 'answered-wrong' | 'current' | 'upcoming'`, `export interface PartRailRow { label: string; state: PartState; answer: string | null }`, and `export function partRailRows(question: Question, result: QuestionResult, currentPartIndex: number): PartRailRow[]` from `lib/roundView.ts`. `VerdictGlyph` takes `{ correct: boolean; size?: number }`.

- [ ] **Step 1: Write the failing tests**

Append to `lib/roundView.test.ts`, keeping the existing `progressOutcomes` block and the `result` helper.

**Merge the imports rather than adding a second import statement from the same module.** The file already has `import { progressOutcomes } from './roundView';` and `import type { QuestionResult } from '@/stores/session';` — extend those two lines instead of duplicating them, or lint will fail on `no-duplicate-imports`. The finished import block should read:

```ts
import { describe, expect, it } from 'vitest';
import { partRailRows, progressOutcomes } from './roundView';
import type { Question, QuestionPart } from '@/lib/questionEngine';
import type { AnsweredPart, QuestionResult } from '@/stores/session';
```

The new test content:

```ts
function namePart(): QuestionPart {
  return { kind: 'name', options: ['Bernal', 'Gavi', 'Pedri', 'Olmo'], correctIndex: 0 };
}
function positionPart(): QuestionPart {
  return { kind: 'position', options: ['GK', 'DF', 'MF', 'FW'], correctIndex: 2 };
}
function nationalityPart(): QuestionPart {
  return { kind: 'nationality', options: ['Spain', 'Brazil', 'Poland'], correctIndex: 0 };
}

function question(parts: QuestionPart[]): Question {
  return {
    playerId: 'p1',
    playerName: 'Bernal',
    memberNo: 22,
    age: 18,
    position: 'MF',
    affiliation: 'Spain',
    parts,
  };
}

function answered(pickedIndex: number, correct: boolean): AnsweredPart {
  return { pickedIndex, correct };
}

describe('partRailRows', () => {
  const q = question([namePart(), positionPart(), nationalityPart()]);

  it('labels each part by its kind', () => {
    const rows = partRailRows(q, { question: q, parts: [null, null, null], correct: null }, 0);
    expect(rows.map((r) => r.label)).toEqual(['NAME', 'POSITION', 'NATIONALITY']);
  });

  it('labels the third part CLUB on a nation squad question', () => {
    const nq = question([
      namePart(),
      positionPart(),
      { kind: 'club', options: ['Barcelona'], correctIndex: 0 },
    ]);
    const rows = partRailRows(nq, { question: nq, parts: [null, null, null], correct: null }, 0);
    expect(rows[2]?.label).toBe('CLUB');
  });

  it('marks the active part current and later parts upcoming', () => {
    const rows = partRailRows(q, { question: q, parts: [null, null, null], correct: null }, 0);
    expect(rows[0]?.state).toBe('current');
    expect(rows[1]?.state).toBe('upcoming');
    expect(rows[2]?.state).toBe('upcoming');
  });

  it('shows an earned correct verdict with the answer that was given', () => {
    const rows = partRailRows(
      q,
      { question: q, parts: [answered(0, true), null, null], correct: null },
      1,
    );
    expect(rows[0]?.state).toBe('answered-correct');
    expect(rows[0]?.answer).toBe('Bernal');
  });

  it('shows a wrong verdict with the answer the player actually picked', () => {
    // Invariant 8: never a green check that was not earned, and the rail
    // must report what the player chose, not the correct option.
    const rows = partRailRows(
      q,
      { question: q, parts: [answered(1, false), null, null], correct: false },
      0,
    );
    expect(rows[0]?.state).toBe('answered-wrong');
    expect(rows[0]?.answer).toBe('Gavi');
  });

  it('leaves unanswered parts without an answer string', () => {
    const rows = partRailRows(q, { question: q, parts: [null, null, null], correct: null }, 0);
    expect(rows[1]?.answer).toBeNull();
  });

  it('keeps parts after a wrong answer upcoming rather than current', () => {
    // Invariant 7: asking stops on a wrong part, so nothing downstream is
    // active — the rail must not accent a part that will never be asked.
    const rows = partRailRows(
      q,
      { question: q, parts: [answered(1, false), null, null], correct: false },
      0,
    );
    expect(rows[1]?.state).toBe('upcoming');
    expect(rows[2]?.state).toBe('upcoming');
  });

  it('returns one row per part', () => {
    const single = question([namePart()]);
    const rows = partRailRows(single, { question: single, parts: [null], correct: null }, 0);
    expect(rows).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/roundView.test.ts`
Expected: FAIL — `partRailRows is not a function` (or an export error).

- [ ] **Step 3: Implement partRailRows**

Append to `lib/roundView.ts`:

```ts
import type { Question, QuestionPart } from '@/lib/questionEngine';

export type PartState = 'answered-correct' | 'answered-wrong' | 'current' | 'upcoming';

export interface PartRailRow {
  label: string;
  state: PartState;
  /** The option the player actually picked, or null while unanswered. */
  answer: string | null;
}

function partLabel(part: QuestionPart): string {
  switch (part.kind) {
    case 'name':
      return 'NAME';
    case 'position':
      return 'POSITION';
    case 'nationality':
      return 'NATIONALITY';
    case 'club':
      return 'CLUB';
  }
}

/**
 * One row per part of the current question.
 *
 * Invariant 8: a row shows a verdict only where one was actually earned, and
 * reports the option the player picked rather than the correct one.
 *
 * Invariant 7: asking stops on a wrong part, so a part that has not been
 * answered is `current` only when it is genuinely the active index —
 * everything else is `upcoming`, never accented.
 */
export function partRailRows(
  question: Question,
  result: QuestionResult,
  currentPartIndex: number,
): PartRailRow[] {
  return question.parts.map((part, i) => {
    const answeredPart = result.parts[i];
    const label = partLabel(part);

    if (answeredPart) {
      return {
        label,
        state: answeredPart.correct ? 'answered-correct' : 'answered-wrong',
        answer: part.options[answeredPart.pickedIndex] ?? null,
      };
    }
    return { label, state: i === currentPartIndex ? 'current' : 'upcoming', answer: null };
  });
}
```

Note: `result.correct === false` already implies asking stopped, and every later part has `null` in `result.parts`, so the `currentPartIndex` comparison alone gives the right answer without a special case. Do not add one.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/roundView.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Build the verdict glyph**

Create `components/VerdictGlyph.tsx`:

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { EscuadraMark } from './EscuadraMark';
import { colors, iconSize, opacity } from '@/theme/tokens';

interface VerdictGlyphProps {
  correct: boolean;
  /** Edge length in dp. Defaults to the token-defined verdict size. */
  size?: number;
}

// The app's own mark, used as the correct/incorrect glyph. Replaces the
// U+2713 / U+2715 dingbats, which depend on a glyph Inter may not carry and
// so fall back silently to another font.
export function VerdictGlyph({ correct, size = iconSize.markLarge }: VerdictGlyphProps) {
  return (
    <View style={[styles.root, !correct && styles.incorrect]}>
      <EscuadraMark size={size} color={correct ? colors.success : colors.errorTextDim} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  // A wrong verdict reads quieter than a right one, so the correct answer
  // stays the loudest thing on screen.
  incorrect: { opacity: opacity.dimmed },
});
```

- [ ] **Step 6: Build the part rail**

Create `components/PartRail.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VerdictGlyph } from './VerdictGlyph';
import type { PartRailRow } from '@/lib/roundView';
import { colors, iconSize, opacity, radii, spacing, typography } from '@/theme/tokens';

interface PartRailProps {
  rows: PartRailRow[];
}

// One row per part of the current question, so the player can see how many
// parts remain and what they have already banked. Answered parts carry the
// mark as a real verdict — never a check that was not earned (invariant 8).
export function PartRail({ rows }: PartRailProps) {
  return (
    <View style={styles.root}>
      {rows.map((row, i) => (
        <View key={i} style={[styles.row, row.state === 'upcoming' && styles.rowUpcoming]}>
          {row.state === 'answered-correct' || row.state === 'answered-wrong' ? (
            <VerdictGlyph correct={row.state === 'answered-correct'} />
          ) : (
            <View style={[styles.bullet, row.state === 'current' && styles.bulletCurrent]} />
          )}
          <Text style={[styles.label, row.state === 'current' && styles.labelCurrent]}>
            {row.label}
          </Text>
          {row.answer !== null && (
            <Text style={styles.answer} numberOfLines={1}>
              {row.answer}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, gap: spacing.xs - 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 1 },
  rowUpcoming: { opacity: opacity.faded },
  bullet: {
    width: iconSize.markLarge,
    height: iconSize.markLarge,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bulletCurrent: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { ...typography.captionEyebrow, color: colors.textMuted },
  labelCurrent: { color: colors.textPrimary },
  answer: {
    ...typography.secondarySmall,
    color: colors.textSecondary,
    marginLeft: 'auto',
    flexShrink: 1,
  },
});
```

- [ ] **Step 7: Swap the dingbats for the mark**

In `components/AnswerOption.tsx`, replace each `<Text ...>✓</Text>` and `<Text ...>✕</Text>` with the glyph, keeping the surrounding layout untouched:

```tsx
<VerdictGlyph correct />
```

and

```tsx
<VerdictGlyph correct={false} size={iconSize.markSmall} />
```

Add the import:

```tsx
import { VerdictGlyph } from './VerdictGlyph';
```

Delete any style rule that existed only to size or colour the removed `<Text>` glyphs, and drop now-unused token imports.

In `components/CompletedPartPill.tsx`, replace its `✓` the same way with `<VerdictGlyph correct={correct} />`, so a pill that was answered wrongly no longer shows a check — this is invariant 8, and the current component shows a check regardless.

- [ ] **Step 8: Put the rail and the marker on the play screen**

In `app/play/[squadId]/[level]/index.tsx`:

Add the imports:

```tsx
import { PartRail } from '@/components/PartRail';
import { TeamMarker } from '@/components/TeamMarker';
import { partRailRows, progressOutcomes } from '@/lib/roundView';
```

Replace the team label block in the header, dropping the coloured rule:

```tsx
<View style={styles.teamLabel}>
  <Text style={styles.teamName}>{squad.name}</Text>
  <TeamMarker marker={squad.marker} />
</View>
```

Replace the whole `heroBlock` `Animated.View` so the hero and the rail sit side by side on levels 2 and 3. Level 1 has a single part, so it gets no rail and keeps its full-width hero and stat chips exactly as they are. Level 2 keeps its stat chips too, stacked under the rail in the same column.

Use this block verbatim — it is the only version:

```tsx
<Animated.View
  key={session.currentIndex}
  entering={FadeIn.duration(durations.transition)}
  exiting={FadeOut.duration(durations.transition)}
  style={[styles.heroBlock, level > 1 && styles.heroBlockSplit]}
>
  <HeroCard level={level} shirtNumber={question.memberNo} />
  {level > 1 ? (
    <View style={styles.railColumn}>
      <PartRail rows={partRailRows(question, result, session.currentPartIndex)} />
      {statChips.length > 0 && (
        <View style={styles.chipRow}>
          {statChips.map((c) => (
            <StatChip key={c.label} label={c.label} value={c.value} />
          ))}
        </View>
      )}
    </View>
  ) : (
    statChips.length > 0 && (
      <View style={styles.chipRow}>
        {statChips.map((c) => (
          <StatChip key={c.label} label={c.label} value={c.value} />
        ))}
      </View>
    )
  )}
</Animated.View>
```

Delete the `partLabel` function and every `<Text style={styles.partLabel}>` element from `QuestionPartView` — the rail now carries those labels, and leaving both duplicates them.

In the stylesheet: delete the `underline` and `partLabel` rules, and add:

```tsx
  heroBlockSplit: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg },
  railColumn: { flex: 1, minWidth: 0, gap: spacing.sm },
```

Confirm the `ScrollView` wrapping `question.parts` is untouched — invariant 6 depends on it.

- [ ] **Step 9: Remove the dead token**

In `theme/tokens.ts`, delete the `teamUnderline: { width: 28, height: 2 },` line from `sizes`.

Run: `grep -rn "teamUnderline" --include=*.ts --include=*.tsx .` (excluding `node_modules`)
Expected: no matches. If any remain, the play screen edit was incomplete.

- [ ] **Step 10: Verify**

Run: `npm run check`
Expected: green.

- [ ] **Step 11: Commit**

```bash
git add lib/roundView.ts lib/roundView.test.ts components/VerdictGlyph.tsx components/PartRail.tsx components/AnswerOption.tsx components/CompletedPartPill.tsx "app/play/[squadId]/[level]/index.tsx" theme/tokens.ts
git commit -m "feat(play): add the part rail, real team marker and mark verdicts"
```

---

### Task 6: Study accepts a player-id filter

`Study These N` on the results screen needs somewhere to land. Study gains an optional `players` route param carrying a comma-separated list of player ids; when present, only those players are listed and the position filter row is hidden, because filtering a three-player list by position is noise.

Unfiltered Study is unchanged.

**Files:**

- Create: `lib/studyView.ts`
- Create: `lib/studyView.test.ts`
- Modify: `app/team/[squadId]/study.tsx`

**Interfaces:**

- Consumes: `RosterEntry` from `@/types/squad`, shape `{ player: Player; member: SquadMember }`; `Position` from `@/types/squad`.
- Produces: `export function parsePlayerIds(param: string | undefined): string[] | null` and `export function studyRows(roster: RosterEntry[], positionFilter: 'ALL' | Position, playerIds: string[] | null): RosterEntry[]` from `lib/studyView.ts`.

- [ ] **Step 1: Write the failing test**

Create `lib/studyView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parsePlayerIds, studyRows } from './studyView';
import type { RosterEntry } from '@/types/squad';

function entry(id: string, no: number, position: 'GK' | 'DF' | 'MF' | 'FW'): RosterEntry {
  return {
    player: {
      id,
      name: id,
      birth: '2000-01-01',
      position,
      nationality: 'Spain',
      photo: null,
    },
    member: { playerId: id, no },
  } as RosterEntry;
}

const roster: RosterEntry[] = [entry('c', 9, 'FW'), entry('a', 1, 'GK'), entry('b', 4, 'DF')];

describe('parsePlayerIds', () => {
  it('returns null when the param is absent', () => {
    expect(parsePlayerIds(undefined)).toBeNull();
  });

  it('returns null for an empty string, so an empty param is not a filter to nothing', () => {
    expect(parsePlayerIds('')).toBeNull();
  });

  it('splits a comma-separated list', () => {
    expect(parsePlayerIds('a,b')).toEqual(['a', 'b']);
  });

  it('trims whitespace and drops empty entries', () => {
    expect(parsePlayerIds('a, ,b,')).toEqual(['a', 'b']);
  });
});

describe('studyRows', () => {
  it('sorts by shirt number when unfiltered', () => {
    expect(studyRows(roster, 'ALL', null).map((r) => r.member.no)).toEqual([1, 4, 9]);
  });

  it('filters by position', () => {
    expect(studyRows(roster, 'GK', null).map((r) => r.player.id)).toEqual(['a']);
  });

  it('filters to the given player ids', () => {
    expect(studyRows(roster, 'ALL', ['c', 'a']).map((r) => r.player.id)).toEqual(['a', 'c']);
  });

  it('keeps shirt-number order when filtering by id, not the order of the id list', () => {
    expect(studyRows(roster, 'ALL', ['c', 'a']).map((r) => r.member.no)).toEqual([1, 9]);
  });

  it('ignores ids that are not in this squad', () => {
    expect(studyRows(roster, 'ALL', ['a', 'zzz']).map((r) => r.player.id)).toEqual(['a']);
  });

  it('returns an empty list when no id matches', () => {
    expect(studyRows(roster, 'ALL', ['zzz'])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/studyView.test.ts`
Expected: FAIL — `Failed to resolve import "./studyView"`.

- [ ] **Step 3: Write the implementation**

Create `lib/studyView.ts`:

```ts
// Pure Study-screen filtering. Kept out of the screen so it is unit-testable.
import type { Position, RosterEntry } from '@/types/squad';

/**
 * The `?players=` route param as a list of ids, or null when absent.
 *
 * An empty or whitespace-only param yields null rather than an empty list:
 * a malformed link should show the full squad, not an empty screen.
 */
export function parsePlayerIds(param: string | undefined): string[] | null {
  if (param === undefined) return null;
  const ids = param
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  return ids.length > 0 ? ids : null;
}

/** Rows to show, always in shirt-number order. */
export function studyRows(
  roster: RosterEntry[],
  positionFilter: 'ALL' | Position,
  playerIds: string[] | null,
): RosterEntry[] {
  const wanted = playerIds === null ? null : new Set(playerIds);
  return roster
    .filter((r) => (wanted === null ? true : wanted.has(r.player.id)))
    .filter((r) => positionFilter === 'ALL' || r.player.position === positionFilter)
    .sort((a, b) => a.member.no - b.member.no);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/studyView.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Wire the param into the screen**

In `app/team/[squadId]/study.tsx`:

Read the new param:

```tsx
const { squadId, players } = useLocalSearchParams<{ squadId: string; players?: string }>();
```

Add the import:

```tsx
import { parsePlayerIds, studyRows } from '@/lib/studyView';
```

Replace the `rows` computation:

```tsx
const playerIds = parsePlayerIds(players);
const rows = studyRows(roster, filter, playerIds);
```

Hide the position filters when a player-id filter is active, and title the screen for what it is showing:

```tsx
<Text style={styles.title}>{playerIds === null ? 'Full Squad' : 'Missed Players'}</Text>;

{
  playerIds === null && (
    <View style={styles.filters}>
      {FILTERS.map((f) => (
        <FilterPill key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />
      ))}
    </View>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npm run check`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add lib/studyView.ts lib/studyView.test.ts "app/team/[squadId]/study.tsx"
git commit -m "feat(study): accept a player-id filter so a missed list can land"
```

---

### Task 7: Results — the missed list gets the primary action

"Time to get back in the study screen" names a route, not an action, and the primary CTA then sends the player to retry the round they just failed. For a study tool the missed list **is** the result, so the primary action follows it: `Study These N` opens Study filtered to exactly those players, and Retry demotes to secondary.

Invariant 10 still governs: the CTA set varies by pass/fail and by whether the level ceiling is reached. Passing still offers the next level as primary — a player who passed does not need to study.

**Files:**

- Create: `lib/resultsView.ts`
- Create: `lib/resultsView.test.ts`
- Modify: `app/play/[squadId]/[level]/results.tsx`

**Interfaces:**

- Consumes: `Level` from `@/lib/questionEngine`.
- Produces: `export type ActionId = 'nextLevel' | 'retry' | 'studyMissed' | 'study' | 'chooseTeam'` and `export function actionOrder(opts: { passed: boolean; hasNextLevel: boolean; missedCount: number }): ActionId[]` from `lib/resultsView.ts`. Task 8 adds `isFlawless` to the same file.

- [ ] **Step 1: Write the failing test**

Create `lib/resultsView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { actionOrder } from './resultsView';

describe('actionOrder', () => {
  it('offers the next level first when the player passed below the ceiling', () => {
    const actions = actionOrder({ passed: true, hasNextLevel: true, missedCount: 2 });
    expect(actions[0]).toBe('nextLevel');
  });

  it('offers a new team first when the player passed at the ceiling', () => {
    // Invariant 10: nothing to advance to, so do not dangle a next level.
    const actions = actionOrder({ passed: true, hasNextLevel: false, missedCount: 1 });
    expect(actions[0]).toBe('chooseTeam');
    expect(actions).not.toContain('nextLevel');
  });

  it('offers studying the missed players first when the player failed', () => {
    const actions = actionOrder({ passed: false, hasNextLevel: true, missedCount: 3 });
    expect(actions[0]).toBe('studyMissed');
  });

  it('falls back to retry as primary when the player failed but missed nothing', () => {
    // Defensive: a 0-attempted round has no missed list to study.
    const actions = actionOrder({ passed: false, hasNextLevel: true, missedCount: 0 });
    expect(actions[0]).toBe('retry');
    expect(actions).not.toContain('studyMissed');
  });

  it('never offers studyMissed when there are no missed players', () => {
    const actions = actionOrder({ passed: true, hasNextLevel: true, missedCount: 0 });
    expect(actions).not.toContain('studyMissed');
  });

  it('always offers a way to leave for another team', () => {
    for (const passed of [true, false]) {
      for (const hasNextLevel of [true, false]) {
        expect(actionOrder({ passed, hasNextLevel, missedCount: 2 })).toContain('chooseTeam');
      }
    }
  });

  it('never repeats an action', () => {
    const actions = actionOrder({ passed: false, hasNextLevel: true, missedCount: 3 });
    expect(new Set(actions).size).toBe(actions.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/resultsView.test.ts`
Expected: FAIL — `Failed to resolve import "./resultsView"`.

- [ ] **Step 3: Write the implementation**

Create `lib/resultsView.ts`:

```ts
// Pure results-screen model. Kept out of the screen so invariant 10's rules
// are unit-testable.

export type ActionId = 'nextLevel' | 'retry' | 'studyMissed' | 'study' | 'chooseTeam';

/**
 * Ordered actions for the results screen, primary first.
 *
 * Invariant 10: the set varies by pass/fail and by whether the level ceiling
 * is reached. Passing below the ceiling advances; passing at the ceiling has
 * nowhere to advance to, so it points at a new team. Failing puts the missed
 * list first — for a study tool the misses are the result, and retrying the
 * round you just failed teaches nothing.
 */
export function actionOrder(opts: {
  passed: boolean;
  hasNextLevel: boolean;
  missedCount: number;
}): ActionId[] {
  const { passed, hasNextLevel, missedCount } = opts;

  const primary: ActionId = passed
    ? hasNextLevel
      ? 'nextLevel'
      : 'chooseTeam'
    : missedCount > 0
      ? 'studyMissed'
      : 'retry';

  const rest: ActionId[] = (['studyMissed', 'retry', 'study', 'chooseTeam'] as const).filter(
    (id) => id !== primary && (id !== 'studyMissed' || missedCount > 0),
  );

  return [primary, ...rest];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/resultsView.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Wire it into the screen**

In `app/play/[squadId]/[level]/results.tsx`:

Delete the local `ActionId` type and the local `actionOrder` function entirely, and import the shared ones:

```tsx
import { actionOrder, type ActionId } from '@/lib/resultsView';
```

Replace the `actions` computation:

```tsx
const actions = actionOrder({ passed, hasNextLevel, missedCount: missed.length });
```

Add the missed-study handler alongside the existing ones:

```tsx
const studyMissed = () => {
  router.push({
    pathname: '/team/[squadId]/study',
    params: { squadId, players: missed.map((r) => r.question.playerId).join(',') },
  });
};
```

Add both entries to the handler and label maps:

```tsx
    studyMissed,
```

```tsx
    studyMissed: `Study These ${missed.length}`,
```

Change the failing verdict sentence so it stops naming a route:

```tsx
if (ratio >= 0.5) return 'Solid — a few names to brush up on.';
return 'These are the ones to learn.';
```

- [ ] **Step 6: Verify**

Run: `npm run check`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add lib/resultsView.ts lib/resultsView.test.ts "app/play/[squadId]/[level]/results.tsx"
git commit -m "feat(results): make studying the missed players the primary action"
```

---

### Task 8: Results — the a la escuadra screen

`design/SCREENS.md`'s vocabulary section names the flawless round and the app never once says it. The product is named for this. On a 10/10 round the mark becomes the content: the ball lands in the angle in `colors.success` with the trail behind it, one 220ms travel — the only place the trail animates.

With no missed list there is no payload, so the whole screen is the reward.

Motion budget: `durations.pop` (100) + `durations.popSettle` (120) = 220ms, inside the 300ms cap.

**Files:**

- Modify: `lib/resultsView.ts`
- Modify: `lib/resultsView.test.ts`
- Modify: `app/play/[squadId]/[level]/results.tsx`
- Modify: `theme/tokens.ts`

**Interfaces:**

- Consumes: `actionOrder`, `ActionId` from `lib/resultsView.ts` (Task 7); `EscuadraMark` from `@/components/EscuadraMark`.
- Produces: `export function isFlawless(correct: number, attempted: number): boolean` from `lib/resultsView.ts`.

- [ ] **Step 1: Write the failing test**

Append to `lib/resultsView.test.ts`. **Merge the import** — extend the existing `import { actionOrder } from './resultsView';` line to `import { actionOrder, isFlawless } from './resultsView';` rather than adding a second import statement, which lint rejects as a duplicate.

```ts
describe('isFlawless', () => {
  it('is true for a full round with every question correct', () => {
    expect(isFlawless(10, 10)).toBe(true);
  });

  it('is false when a single question was missed', () => {
    expect(isFlawless(9, 10)).toBe(false);
  });

  it('is false for a round with nothing attempted', () => {
    // 0/0 is vacuously "all correct" — guard against celebrating an empty round.
    expect(isFlawless(0, 0)).toBe(false);
  });

  it('is true for a short but complete round', () => {
    expect(isFlawless(3, 3)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/resultsView.test.ts`
Expected: FAIL — `isFlawless is not a function`.

- [ ] **Step 3: Implement isFlawless**

Append to `lib/resultsView.ts`:

```ts
/**
 * A la escuadra — the flawless round the product is named for.
 *
 * A round with nothing attempted is not flawless: 0/0 is vacuously perfect
 * and must not trigger the celebration.
 */
export function isFlawless(correct: number, attempted: number): boolean {
  return attempted > 0 && correct === attempted;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/resultsView.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Add the celebration mark token**

In `theme/tokens.ts`, inside `sizes`, immediately after `wordmarkMarkHero: 86,`:

```ts
  // The a la escuadra celebration mark. Larger than Home's lockup because on
  // this screen the mark is the entire content.
  celebrationMark: 120,
```

- [ ] **Step 6: Render the flawless variant**

In `app/play/[squadId]/[level]/results.tsx`, add the imports:

```tsx
import Animated, { FadeIn } from 'react-native-reanimated';
import { EscuadraMark } from '@/components/EscuadraMark';
import { actionOrder, isFlawless, type ActionId } from '@/lib/resultsView';
import { colors, durations, radii, sizes, spacing, typography } from '@/theme/tokens';
```

After `const missed = selectMissed(session.results);`, add:

```tsx
const flawless = isFlawless(score.correct, score.attempted);
```

Replace the `styles.summary` block and the missed-list block with a conditional. When flawless, the summary becomes the whole screen:

```tsx
{
  flawless ? (
    <Animated.View
      entering={FadeIn.duration(durations.pop + durations.popSettle)}
      style={styles.flawless}
    >
      <EscuadraMark size={sizes.celebrationMark} color={colors.success} showTrail />
      <Text style={styles.flawlessScore}>
        {score.correct}/{score.attempted}
      </Text>
      <Text style={styles.flawlessTitle}>a la escuadra</Text>
      <Text style={styles.verdict}>
        {squad.name}, level {level}. Nothing missed.
      </Text>
    </Animated.View>
  ) : (
    <>
      <View style={styles.summary}>
        <Text style={styles.eyebrow}>
          {squad.name.toUpperCase()} · LEVEL {level} · ROUND COMPLETE
        </Text>
        <Text style={styles.score}>
          {score.correct}/{score.attempted}
        </Text>
        <Text style={styles.verdict}>{verdictSentence(score.correct, score.attempted)}</Text>
      </View>

      {missed.length > 0 && (
        <>
          <Text style={styles.missedLabel}>MISSED · {missed.length} PLAYERS</Text>
          <FlatList
            data={missed}
            keyExtractor={(r) => r.question.playerId}
            contentContainerStyle={styles.missedList}
            renderItem={({ item }) => <MissedCard result={item} />}
          />
        </>
      )}
    </>
  );
}
```

Add to the stylesheet:

```tsx
  flawless: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  flawlessScore: { ...typography.scoreHero, color: colors.success, marginTop: spacing.lg },
  flawlessTitle: { ...typography.screenTitle, color: colors.textPrimary, fontStyle: 'italic' },
```

The existing `actionOrder` call already handles the CTAs correctly: a flawless round is a passing round, so it offers the next level, or a new team at the ceiling. Do not special-case it.

- [ ] **Step 7: Verify**

Run: `npm run check`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add lib/resultsView.ts lib/resultsView.test.ts "app/play/[squadId]/[level]/results.tsx" theme/tokens.ts
git commit -m "feat(results): add the a la escuadra screen for a flawless round"
```

---

### Task 9: Refresh the design handoff and verify on device

The whole point of `design/` is that it cannot drift from the app. Seven screens changed, so the captured screenshots are now stale and the design side would work from a wrong picture on the next turn.

**Files:**

- Modify: `design/screens/*.png` (regenerated, not hand-edited)
- Modify: `design/SCREENS.md` if any described structure changed

- [ ] **Step 1: Recapture**

Run: `npm run shots`
Expected: eight PNGs written to `design/screens/`, no page errors. The capture script fails fast on a page error; if it does, the client JS is broken and the screenshots would be server-rendered only — fix that before proceeding.

- [ ] **Step 2: Look at every capture**

Open each of the eight PNGs and confirm against the spec:

- `01-home` — lockup centred with the trail, no competing "Ready to train?" title
- `02-team-picker-clubs` — every row shows `LEVEL n · BEST n/10` or `NOT PLAYED`, no em-dash pills; markers unchanged
- `03-team-picker-nations` — flags unchanged from before this plan
- `04-difficulty` — accent on the **playable** rung, rungs close together, locked rows show `Clear L1` / `Clear L2`
- `05-study` — unchanged
- `06-question-l1` — hero and number unchanged; only the progress bar differs
- `07-question-l3` — part rail beside the hero, real team marker under the team name
- `08-results` — `Study These N` as the primary button

If any is wrong, fix the code and recapture. Do not commit a capture that does not match.

- [ ] **Step 3: Update SCREENS.md**

Where `design/SCREENS.md` describes a screen's structure that this plan changed, update the prose. Do not touch the invariants — none of them changed.

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add design/
git commit -m "docs(design): recapture the handoff screens after the re-pass"
```

- [ ] **Step 6: Hand off for device testing**

The web captures cannot confirm spacing — `design/SCREENS.md` says so explicitly, and the re-pass's own "mark fuses below 40px" claim was reasoned from a 2× web render. Report to the human partner that the screens need checking on a physical iPhone via Expo Go, naming specifically:

- whether the part rail is legible beside the 108px hero at level 3
- whether the centred Home lockup reads at 86px
- whether the difficulty ladder's rungs are now too tight rather than too loose
