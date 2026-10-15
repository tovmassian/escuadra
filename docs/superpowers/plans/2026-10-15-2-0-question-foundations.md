# #113 part 1 — Question-screen foundations: Implementation Plan

**Issue:** [#113](https://github.com/tovmassian/escuadra/issues/113) (part 1 of 2) · **Milestone:** [v2.0.0](https://github.com/tovmassian/escuadra/milestone/5) · **Branch:** `feat/113-question-foundations`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the logic the Spotlight question screen is built on, without changing that screen yet:

- the slot model, answer-grid layout, streak and prompts (`lib/roundView.ts`)
- the stage's team-colour bands, veil and fill-or-frame decision (`lib/stageView.ts`)
- the haptics plan and the one module that plays it (`lib/hapticPlan.ts`, `lib/haptics.ts`)
- the persisted Vibration setting and its About switch

**Architecture:**

- **Why two parts.** #113 is XL, so it lands in two PRs that each leave `main` working. This one is pure logic, tested in node, plus the Vibration switch. Part 2 builds the screen on it.
- **Haptics split.** It follows the telemetry pattern: a pure, tested plan (`lib/hapticPlan.ts`), and an effectful module that is the only importer of `expo-haptics` (`lib/haptics.ts`).
- **The one visible change.** The existing answer card switches its three haptic calls to `feedback()`, so the Vibration switch works from this PR on. Android gets its native haptic constants, with a vibrator fallback below the API level each needs.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Vitest (node environment), expo-haptics 57, Zustand `persist`.

**Spec:** [`docs/superpowers/specs/2026-10-15-play-redesign-2-0-design.md`](../specs/2026-10-15-play-redesign-2-0-design.md):

- §2.2 (slots), §2.3 (grid and compact), §2.4 (prompt flow), §2.5 (streak)
- §2.6 (photo, fallback, veil), §7 (haptics), §11 (code map), §13 (tests)

The issue body carries notes from #111 and #112. One governs this plan: fill-or-frame goes by the **served** width (`stageView.servedWidth`), not the original's.

## Global Constraints

- Node 24: run `nvm use` in every new shell.
- `lib/` stays React-free. Exception: `lib/haptics.ts`, which is effectful by design, like `lib/telemetry.ts`.
- `lib/hapticPlan.ts`, `lib/roundView.ts` and `lib/stageView.ts` import no React, React Native, Expo or store module. Type-only imports are fine. Vitest (node) must load them.
- `lib/haptics.ts` is the **only** module that imports `expo-haptics` (spec §7). A test enforces it.
- Never hardcode a colour or size outside `theme/tokens.ts` (guardrail 5). A layout threshold that is logic, not style, may be a named constant in `lib/` (`FILL_MIN_WIDTH`).
- TypeScript strict with `noUncheckedIndexedAccess`; never weaken it, and avoid `!`.
- Tests stay beside the code in `lib/` and `stores/`.
- No new dependency or npm script, and no `app.json` change.
- Haptics never leave the device, so there is no privacy disclosure change (spec §7).
- Before each commit, run `npx prettier --write <every file you changed>`.
- Never write to /tmp.
- Each commit ends with a `Co-Authored-By` trailer naming the model that wrote it.

---

### Task 0: Branch and plan (controller, done)

`feat/113-question-foundations` was made from `main` (ea219e30) by `gh issue develop 113`. The controller commits this plan to it.

---

### Task 1: Slots, answer layout, streak and prompts (`lib/roundView.ts`)

**Files:**

- Modify: `lib/roundView.ts` (add only; remove nothing, since the current screen still uses the hero helpers until part 2)
- Modify: `lib/roundView.test.ts`

**Interfaces:**

- Produces:

```ts
export type SlotKey = 'NAME' | 'POS' | 'AGE' | 'CLUB' | 'NAT';
export type SlotState = 'given' | 'active' | 'pending' | 'correct' | 'wrong' | 'notAsked';
export interface Slot {
  key: SlotKey;
  state: SlotState;
  value: string;
}
export function slotStates(
  question: Question,
  result: QuestionResult,
  currentPartIndex: number,
  kind: Squad['kind'],
  level: Level,
): Slot[];
export interface AnswerLayout {
  columns: 2 | 4;
  tileHeight: number;
}
export function isCompact(usableHeight: number): boolean;
export function answerLayout(part: QuestionPart, compact: boolean): AnswerLayout;
export function streak(results: QuestionResult[], currentIndex: number): number;
export function promptText(part: QuestionPart, memberNo: number, verdict: boolean | null): string;
export function partCounter(question: Question, currentPartIndex: number): string | null;
export type TileVerdict =
  'idle' | 'correct-picked' | 'correct-unpicked' | 'incorrect-picked' | 'incorrect-other';
export function tileVerdict(
  part: QuestionPart,
  answeredIndex: number | null,
  index: number,
): TileVerdict;
export function positionLabel(position: Position): string;
```

- [ ] **Step 1: Write the failing tests**

Append to `lib/roundView.test.ts`. Extend its imports: add `slotStates, answerLayout, isCompact, streak, promptText, partCounter, tileVerdict, positionLabel` to the `./roundView` import, and `sizes` to the `@/theme/tokens` import.

```ts
// ---- Spotlight (2.0) -------------------------------------------------------

function spotQuestion(overrides: Partial<Question> = {}): Question {
  return {
    playerId: 'ferran',
    playerName: 'Ferran Torres',
    memberNo: 7,
    age: 26,
    position: 'FW',
    affiliation: 'Barcelona',
    parts: [{ kind: 'name', options: ['A', 'Ferran Torres', 'B', 'C'], correctIndex: 1 }],
    ...overrides,
  };
}

const L2_PARTS: QuestionPart[] = [
  { kind: 'name', options: ['A', 'Ferran Torres', 'B', 'C'], correctIndex: 1 },
  { kind: 'position', options: ['GK', 'DF', 'MF', 'FW'], correctIndex: 3 },
];
const L3_NATION_PARTS: QuestionPart[] = [
  { kind: 'name', options: ['A', 'B', 'Ferran Torres', 'C', 'D', 'E'], correctIndex: 2 },
  { kind: 'position', options: ['GK', 'DF', 'MF', 'FW'], correctIndex: 3 },
  { kind: 'club', options: ['Arsenal', 'Barcelona', 'Celta', 'Getafe'], correctIndex: 1 },
];

function scoredResult(q: Question, picks: number[], correct: boolean | null): QuestionResult {
  return {
    question: q,
    parts: q.parts.map((p, i) => {
      const pick = picks[i];
      return pick === undefined ? null : { pickedIndex: pick, correct: pick === p.correctIndex };
    }),
    correct,
  };
}

const view = (slots: { key: string; state: string; value: string }[]) =>
  slots.map((s) => `${s.key}:${s.state}:${s.value}`);

describe('slotStates', () => {
  it('level 1 asks the name and prints position, age and club as clues', () => {
    const q = spotQuestion();
    expect(view(slotStates(q, scoredResult(q, [], null), 0, 'nation', 1))).toEqual([
      'NAME:active:Ferran Torres',
      'POS:given:FW',
      'AGE:given:26',
      'CLUB:given:Barcelona',
    ]);
  });

  it('a club squad prints nationality, not club', () => {
    const q = spotQuestion({ affiliation: 'Spain' });
    expect(slotStates(q, scoredResult(q, [], null), 0, 'club', 1).map((s) => s.key)).toEqual([
      'NAME',
      'POS',
      'AGE',
      'NAT',
    ]);
  });

  it('drops AGE when the player has no birth date', () => {
    const q = spotQuestion({ age: null });
    expect(slotStates(q, scoredResult(q, [], null), 0, 'nation', 1).map((s) => s.key)).toEqual([
      'NAME',
      'POS',
      'CLUB',
    ]);
  });

  it('level 2: position is pending until the name is answered, then active', () => {
    const q = spotQuestion({ parts: L2_PARTS });
    expect(view(slotStates(q, scoredResult(q, [], null), 0, 'nation', 2)).slice(0, 2)).toEqual([
      'NAME:active:Ferran Torres',
      'POS:pending:FW',
    ]);
    expect(view(slotStates(q, scoredResult(q, [1], null), 1, 'nation', 2)).slice(0, 2)).toEqual([
      'NAME:correct:Ferran Torres',
      'POS:active:FW',
    ]);
  });

  it('level 3 asks name, position and club, and has no AGE slot', () => {
    const q = spotQuestion({ parts: L3_NATION_PARTS });
    expect(view(slotStates(q, scoredResult(q, [], null), 0, 'nation', 3))).toEqual([
      'NAME:active:Ferran Torres',
      'POS:pending:FW',
      'CLUB:pending:Barcelona',
    ]);
  });

  // Invariant 7: asking stops at the first wrong part; the rest show the
  // right value, muted, never a verdict they did not earn (invariant 8).
  it('after a wrong name, later slots are not asked and show the right value', () => {
    const q = spotQuestion({ parts: L3_NATION_PARTS });
    expect(view(slotStates(q, scoredResult(q, [0], false), 0, 'nation', 3))).toEqual([
      'NAME:wrong:Ferran Torres',
      'POS:notAsked:FW',
      'CLUB:notAsked:Barcelona',
    ]);
  });

  it('a wrong last part is wrong, the earlier right ones stay correct', () => {
    const q = spotQuestion({ parts: L3_NATION_PARTS });
    expect(view(slotStates(q, scoredResult(q, [2, 3, 0], false), 2, 'nation', 3))).toEqual([
      'NAME:correct:Ferran Torres',
      'POS:correct:FW',
      'CLUB:wrong:Barcelona',
    ]);
  });

  it('never marks a slot correct that was not answered right', () => {
    const q = spotQuestion({ parts: L2_PARTS });
    const states = slotStates(q, scoredResult(q, [0], false), 0, 'nation', 2).map((s) => s.state);
    expect(states).not.toContain('correct');
  });
});

describe('isCompact and answerLayout', () => {
  it('goes compact below the threshold', () => {
    expect(isCompact(sizes.compactBelow - 1)).toBe(true);
    expect(isCompact(sizes.compactBelow)).toBe(false);
  });

  it('lays names, clubs and nationalities in two columns, positions in four', () => {
    const name4: QuestionPart = { kind: 'name', options: ['a', 'b', 'c', 'd'], correctIndex: 0 };
    const name6: QuestionPart = {
      kind: 'name',
      options: ['a', 'b', 'c', 'd', 'e', 'f'],
      correctIndex: 0,
    };
    const pos: QuestionPart = {
      kind: 'position',
      options: ['GK', 'DF', 'MF', 'FW'],
      correctIndex: 0,
    };
    const nat: QuestionPart = {
      kind: 'nationality',
      options: ['a', 'b', 'c', 'd'],
      correctIndex: 0,
    };
    expect(answerLayout(name4, false)).toEqual({
      columns: 2,
      tileHeight: sizes.answerTile.names4.normal,
    });
    expect(answerLayout(name6, true)).toEqual({
      columns: 2,
      tileHeight: sizes.answerTile.names6.compact,
    });
    expect(answerLayout(pos, false)).toEqual({
      columns: 4,
      tileHeight: sizes.answerTile.positions.normal,
    });
    expect(answerLayout(nat, true)).toEqual({
      columns: 2,
      tileHeight: sizes.answerTile.names4.compact,
    });
  });
});

describe('streak', () => {
  it('counts correct answers in a row up to the current question', () => {
    expect(streak([result(true), result(true), result(null)], 2)).toBe(2);
  });

  it('includes the current question once it is answered right', () => {
    expect(streak([result(true), result(true), result(true)], 2)).toBe(3);
  });

  it('resets on a miss, including a miss on the current question', () => {
    expect(streak([result(true), result(false), result(true), result(null)], 3)).toBe(1);
    expect(streak([result(true), result(true), result(false)], 2)).toBe(0);
  });

  it('is zero at the start of a round', () => {
    expect(streak([result(null), result(null)], 0)).toBe(0);
  });
});

describe('promptText and partCounter', () => {
  it('asks each part in its own words', () => {
    expect(promptText(L3_NATION_PARTS[0] as QuestionPart, 7, null)).toBe('Who wears 7?');
    expect(promptText(L3_NATION_PARTS[1] as QuestionPart, 7, null)).toBe('Position?');
    expect(promptText(L3_NATION_PARTS[2] as QuestionPart, 7, null)).toBe('Which club?');
    expect(promptText({ kind: 'nationality', options: ['a'], correctIndex: 0 }, 7, null)).toBe(
      'Nationality?',
    );
  });

  it('reads the verdict once the question is scored', () => {
    expect(promptText(L3_NATION_PARTS[0] as QuestionPart, 7, true)).toBe('Correct');
    expect(promptText(L3_NATION_PARTS[0] as QuestionPart, 7, false)).toBe('Missed');
  });

  it('counts parts only on multi-part questions', () => {
    expect(partCounter(spotQuestion(), 0)).toBeNull();
    expect(partCounter(spotQuestion({ parts: L3_NATION_PARTS }), 1)).toBe('2/3');
  });
});

describe('tileVerdict', () => {
  const part: QuestionPart = { kind: 'name', options: ['a', 'b', 'c', 'd'], correctIndex: 1 };
  it('is idle until answered', () => {
    expect(tileVerdict(part, null, 1)).toBe('idle');
  });
  it('separates the right pick, the right answer missed, the wrong pick and the rest', () => {
    expect(tileVerdict(part, 1, 1)).toBe('correct-picked');
    expect(tileVerdict(part, 2, 1)).toBe('correct-unpicked');
    expect(tileVerdict(part, 2, 2)).toBe('incorrect-picked');
    expect(tileVerdict(part, 2, 3)).toBe('incorrect-other');
  });
});

describe('positionLabel', () => {
  it('names each position for the tile beneath its code', () => {
    expect(['GK', 'DF', 'MF', 'FW'].map((p) => positionLabel(p as 'GK'))).toEqual([
      'Keeper',
      'Defender',
      'Midfield',
      'Forward',
    ]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run lib/roundView.test.ts`
Expected: FAIL. The new exports don't exist (`slotStates is not a function` and so on). The existing tests still pass.

- [ ] **Step 3: Implement**

In `lib/roundView.ts`:

1. Change the header imports to:

```ts
import type { Level, Question, QuestionPart } from '@/lib/questionEngine';
import type { QuestionResult } from '@/stores/session';
import type { Position, Squad } from '@/types/squad';
import {
  heroCardMinSize,
  heroCardSize,
  heroFitHeight,
  heroNumberSize,
  heroTab,
  sizes,
} from '@/theme/tokens';
```

2. Append:

```ts
// ---- Spotlight question screen (2.0, spec §2) ------------------------------

export type SlotKey = 'NAME' | 'POS' | 'AGE' | 'CLUB' | 'NAT';

/**
 * - `given`: a clue, printed.
 * - `active`: the part asked now.
 * - `pending`: asked later.
 * - `correct` / `wrong`: answered, both showing the right value.
 * - `notAsked`: asking stopped at an earlier wrong part (invariant 7). It shows
 *   the right value, muted, and never a verdict it did not earn (invariant 8).
 */
export type SlotState = 'given' | 'active' | 'pending' | 'correct' | 'wrong' | 'notAsked';

export interface Slot {
  key: SlotKey;
  state: SlotState;
  /** The true value. A chip shows it in every state but `active` (`?`) and
   *  `pending` (`—`). */
  value: string;
}

const PART_SLOT: Record<QuestionPart['kind'], SlotKey> = {
  name: 'NAME',
  position: 'POS',
  nationality: 'NAT',
  club: 'CLUB',
};

/**
 * The chips under the shirt number, which spell out the player (spec §2.2).
 * A clue is printed; an asked part is a slot that fills in as it is answered.
 * Level 3 has no AGE, and AGE drops out when the player has no birth date.
 */
export function slotStates(
  question: Question,
  result: QuestionResult,
  currentPartIndex: number,
  kind: Squad['kind'],
  level: Level,
): Slot[] {
  const affiliation: SlotKey = kind === 'club' ? 'NAT' : 'CLUB';
  const values: Record<SlotKey, string | null> = {
    NAME: question.playerName,
    POS: question.position,
    AGE: level === 3 || question.age === null ? null : String(question.age),
    CLUB: question.affiliation,
    NAT: question.affiliation,
  };
  const asked = question.parts.map((part) => PART_SLOT[part.kind]);
  const scored = result.correct !== null;

  const slots: Slot[] = [];
  for (const key of ['NAME', 'POS', 'AGE', affiliation] as const) {
    const value = values[key];
    if (value === null) continue;
    const partIndex = asked.indexOf(key);
    if (partIndex === -1) {
      slots.push({ key, state: 'given', value });
      continue;
    }
    const answer = result.parts[partIndex];
    const state: SlotState = answer
      ? answer.correct
        ? 'correct'
        : 'wrong'
      : scored
        ? 'notAsked'
        : partIndex === currentPartIndex
          ? 'active'
          : 'pending';
    slots.push({ key, state, value });
  }
  return slots;
}

export interface AnswerLayout {
  columns: 2 | 4;
  tileHeight: number;
}

/** Compact below this usable height (window minus safe-area insets), spec §2.3. */
export function isCompact(usableHeight: number): boolean {
  return usableHeight < sizes.compactBelow;
}

/** Two columns for names, clubs and nationalities; four for positions. */
export function answerLayout(part: QuestionPart, compact: boolean): AnswerLayout {
  const size = compact ? 'compact' : 'normal';
  if (part.kind === 'position') return { columns: 4, tileHeight: sizes.answerTile.positions[size] };
  const grid = part.options.length > 4 ? sizes.answerTile.names6 : sizes.answerTile.names4;
  return { columns: 2, tileHeight: grid[size] };
}

/**
 * Correct answers in a row, up to and including the current question once it
 * is scored (spec §2.5). A miss resets it.
 */
export function streak(results: QuestionResult[], currentIndex: number): number {
  let count = 0;
  for (let i = currentIndex; i >= 0; i--) {
    const correct = results[i]?.correct ?? null;
    if (correct === null && i === currentIndex) continue;
    if (correct !== true) break;
    count++;
  }
  return count;
}

/** The prompt row's words: the part's question, or the verdict once scored. */
export function promptText(part: QuestionPart, memberNo: number, verdict: boolean | null): string {
  if (verdict !== null) return verdict ? 'Correct' : 'Missed';
  switch (part.kind) {
    case 'name':
      return `Who wears ${memberNo}?`;
    case 'position':
      return 'Position?';
    case 'club':
      return 'Which club?';
    case 'nationality':
      return 'Nationality?';
  }
}

/** "2/3" beside the prompt on a multi-part question; null on level 1. The
 *  session leaves `currentPartIndex` on the last part answered, so it is the
 *  part on screen in every state. */
export function partCounter(question: Question, currentPartIndex: number): string | null {
  const total = question.parts.length;
  return total > 1 ? `${currentPartIndex + 1}/${total}` : null;
}

/**
 * Five tile states, not four. "You picked the right answer" and "you picked
 * wrong, here is the right one" carry visibly different weight, so they are
 * not merged.
 */
export type TileVerdict =
  'idle' | 'correct-picked' | 'correct-unpicked' | 'incorrect-picked' | 'incorrect-other';

export function tileVerdict(
  part: QuestionPart,
  answeredIndex: number | null,
  index: number,
): TileVerdict {
  if (answeredIndex === null) return 'idle';
  if (index === part.correctIndex)
    return index === answeredIndex ? 'correct-picked' : 'correct-unpicked';
  return index === answeredIndex ? 'incorrect-picked' : 'incorrect-other';
}

const POSITION_LABELS: Record<Position, string> = {
  GK: 'Keeper',
  DF: 'Defender',
  MF: 'Midfield',
  FW: 'Forward',
};

/** The word under a position tile's code. */
export function positionLabel(position: Position): string {
  return POSITION_LABELS[position];
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `npx vitest run lib/roundView.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx prettier --write lib/roundView.ts lib/roundView.test.ts
git add lib/roundView.ts lib/roundView.test.ts
git commit -m "feat(play): slots, answer layout, streak and prompts for the 2.0 question screen

Co-Authored-By: <your model>"
```

---

### Task 2: Stage bands, veil and fill-or-frame (`lib/stageView.ts`)

**Files:**

- Create: `lib/stageView.ts`
- Create: `lib/stageView.test.ts`
- Modify: `components/TeamMarker.tsx` (its banner path uses `bannerBands`)

**Interfaces:**

- Consumes: `relativeLuminance` and `contrastRatio` from `lib/contrast.ts`; `palettes`, `stage` and `ThemeName` from `theme/tokens`; `PhotoCredit` and `TeamMarker` from `types/squad`.
- Produces:

```ts
export interface Band {
  color: string;
  weight: number;
}
export function bannerBands(marker: TeamMarker): Band[];
export function stageVeil(bands: readonly Band[], theme: ThemeName): number;
export function servedWidth(photo: PhotoCredit): number;
export const FILL_MIN_WIDTH = 720;
export type PhotoLayout = 'fill' | 'frame';
export function photoLayout(photo: PhotoCredit): PhotoLayout;
```

- [ ] **Step 1: Write the failing tests**

Create `lib/stageView.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { bannerBands, FILL_MIN_WIDTH, photoLayout, servedWidth, stageVeil } from './stageView';
import { palettes, stage } from '@/theme/tokens';
import type { PhotoCredit, Squad } from '@/types/squad';

const squad = (file: string) =>
  JSON.parse(
    readFileSync(path.join(import.meta.dirname, '..', 'data', 'squads', file), 'utf8'),
  ) as Squad;

/** sRGB blend of `ink` over `hex` at `alpha`, as the veil paints it. */
function veiled(hex: string, ink: string, alpha: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) => Math.round(ch(hex, i) * (1 - alpha) + ch(ink, i) * alpha))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

describe('bannerBands', () => {
  it("keeps a marker's bands and weights, whatever its orientation", () => {
    expect(bannerBands(squad('nation/esp.json').marker)).toEqual([
      { color: '#AA151B', weight: 1 },
      { color: '#F1BF00', weight: 2 },
      { color: '#AA151B', weight: 1 },
    ]);
  });

  it('turns a sole band with an overlay into edge, middle, edge', () => {
    expect(bannerBands(squad('nation/jpn.json').marker)).toEqual([
      { color: '#FFFFFF', weight: 1 },
      { color: '#BC002D', weight: 1 },
      { color: '#FFFFFF', weight: 1 },
    ]);
  });
});

describe('stageVeil', () => {
  for (const theme of ['dark', 'light'] as const) {
    it(`never goes below the ${theme} floor`, () => {
      expect(stageVeil([{ color: '#12141a', weight: 1 }], theme)).toBe(stage.veil[theme]);
    });

    // Spec §2.6: Real Madrid's white must still carry the top bar.
    it(`gives white text 3:1 on Real Madrid's white, ${theme}`, () => {
      const bands = bannerBands(squad('club/la-liga/rma.json').marker);
      const alpha = stageVeil(bands, theme);
      const ink = palettes[theme].veilInk;
      expect(contrastRatio('#ffffff', veiled('#ffffff', ink, alpha))).toBeGreaterThanOrEqual(3);
      expect(alpha).toBeGreaterThan(stage.veil[theme]);
    });

    it(`raises the veil no further than it must, ${theme}`, () => {
      const bands = bannerBands(squad('nation/esp.json').marker);
      const alpha = stageVeil(bands, theme);
      const ink = palettes[theme].veilInk;
      if (alpha > stage.veil[theme]) {
        expect(contrastRatio('#ffffff', veiled('#F1BF00', ink, alpha - 0.01))).toBeLessThan(3);
      }
      expect(contrastRatio('#ffffff', veiled('#F1BF00', ink, alpha))).toBeGreaterThanOrEqual(3);
    });
  }
});

const photo = (url: string, width: number): PhotoCredit => ({
  file: 'X.jpg',
  url,
  width,
  height: Math.round(width * 1.4),
  author: null,
  licence: 'CC0',
  licenceUrl: null,
});
const THUMB = (step: number) =>
  `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/${step}px-X.jpg`;
const ORIGINAL = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg';

describe('servedWidth and photoLayout', () => {
  it("reads a thumbnail's width from its URL", () => {
    expect(servedWidth(photo(THUMB(960), 3333))).toBe(960);
    expect(servedWidth(photo(THUMB(500), 859))).toBe(500);
  });

  it("uses the original's width for an unscaled original", () => {
    expect(servedWidth(photo(ORIGINAL, 722))).toBe(722);
  });

  it(`fills the stage from ${FILL_MIN_WIDTH} px served, frames anything smaller`, () => {
    expect(photoLayout(photo(THUMB(960), 3333))).toBe('fill');
    expect(photoLayout(photo(ORIGINAL, 722))).toBe('fill');
    expect(photoLayout(photo(ORIGINAL, 480))).toBe('frame');
  });

  // #112: Commons serves some 720–959 px originals at a 500 px step. The
  // served width decides, so these are framed, not stretched.
  it('frames a large original Commons served small', () => {
    expect(photoLayout(photo(THUMB(500), 859))).toBe('frame');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run lib/stageView.test.ts`
Expected: FAIL, `Failed to resolve import "./stageView"`.

- [ ] **Step 3: Implement**

Create `lib/stageView.ts`:

```ts
// Pure view-model helpers for the question screen's spotlight stage (spec
// §2.6): the team-colour fallback's bands and veil, and whether a photo fills
// the stage or is framed. No React, so it is unit-tested in node.
import { contrastRatio, relativeLuminance } from './contrast';
import { palettes, stage, type ThemeName } from '@/theme/tokens';
import type { PhotoCredit, TeamMarker } from '@/types/squad';

export interface Band {
  color: string;
  weight: number;
}

/**
 * A marker as vertical bands, under the in-round banner rule (CLAUDE.md):
 * - `orientation` is ignored.
 * - A sole band with an overlay (Japan's disc, Brazil's diamond) becomes
 *   edge/middle/edge in the overlay's colour, because the shape does not
 *   survive the banner's proportions.
 */
export function bannerBands(marker: TeamMarker): Band[] {
  const sole = marker.bands.length === 1 ? marker.bands[0] : undefined;
  if (marker.overlay && sole !== undefined) {
    return [
      { color: sole, weight: 1 },
      { color: marker.overlay.color, weight: 1 },
      { color: sole, weight: 1 },
    ];
  }
  return marker.bands.map((color, i) => ({ color, weight: marker.weights?.[i] ?? 1 }));
}

/** White text over the stage's top bar holds at least this contrast. */
const TOP_BAR_CONTRAST = 3;

function channel(hex: string, i: number): number {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
}

/** `ink` laid over `hex` at `alpha`, blended in sRGB as the screen paints it. */
function veiled(hex: string, ink: string, alpha: number): string {
  const mixed = [0, 1, 2].map((i) =>
    Math.round(channel(hex, i) * (1 - alpha) + channel(ink, i) * alpha),
  );
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * How strongly the no-photo stage's veil darkens the team's bands.
 *
 * The answer is the stronger of two things:
 * - the theme's floor (`stage.veil`);
 * - the least veil, in hundredths, that gives white text 3:1 on the lightest
 *   band. Real Madrid's white must still carry the top bar.
 */
export function stageVeil(bands: readonly Band[], theme: ThemeName): number {
  const ink = palettes[theme].veilInk;
  const floor = Math.round(stage.veil[theme] * 100);
  const lightest = bands.reduce<string | null>(
    (light, band) =>
      light === null || relativeLuminance(band.color) > relativeLuminance(light)
        ? band.color
        : light,
    null,
  );
  if (lightest === null) return floor / 100;
  let hundredths = floor;
  while (
    hundredths < 100 &&
    contrastRatio('#ffffff', veiled(lightest, ink, hundredths / 100)) < TOP_BAR_CONTRAST
  ) {
    hundredths++;
  }
  return hundredths / 100;
}

/**
 * The width actually served:
 * - for a thumbnail, its `NNNpx-` step;
 * - for an unscaled original, the original's width.
 *
 * Commons serves a few 720–959 px originals at a 500 px step (#112). The
 * served width decides the layout, so those are framed, not stretched.
 */
export function servedWidth(photo: PhotoCredit): number {
  const last = photo.url.slice(photo.url.lastIndexOf('/') + 1);
  const step = /(?:^|-)(\d+)px-/.exec(last)?.[1];
  return step === undefined ? photo.width : Math.min(Number(step), photo.width);
}

/** A photo at least this wide, as served, fills the stage (spec §2.6). */
export const FILL_MIN_WIDTH = 720;

export type PhotoLayout = 'fill' | 'frame';

/**
 * - `fill`: the photo fills the stage.
 * - `frame`: the photo is shown whole at 3:4, centred over its own copy,
 *   scaled to fill and darkened. Never stretched full-bleed.
 */
export function photoLayout(photo: PhotoCredit): PhotoLayout {
  return servedWidth(photo) >= FILL_MIN_WIDTH ? 'fill' : 'frame';
}
```

- [ ] **Step 4: Use `bannerBands` in `TeamMarker`**

In `components/TeamMarker.tsx`:

1. Import it: `import { bannerBands } from '@/lib/stageView';`
2. Replace the block from `// A shape overlay (disc/diamond) reads fine…` through the `const total = …` line with:

```tsx
// The banner always draws vertical bands, and a shape overlay becomes a
// middle band, since a disc or diamond has no room at the banner's height.
// `bannerBands` (lib/stageView.ts) owns that rule; the spotlight stage's
// team-colour fallback (spec §2.6) draws the same bands.
const banded = isBanner
  ? bannerBands(marker)
  : marker.bands.map((color, i) => ({ color, weight: marker.weights?.[i] ?? 1 }));
const bands = banded.map((b) => b.color);
const weights = banded.map((b) => b.weight);
const total = weights.reduce((sum, w) => sum + w, 0);
```

Keep the rest (`showShapeOverlay` and the render) unchanged. The default variant still draws its real overlay shape, and the banner never does.

Run: `npm run typecheck && npm run lint`
Expected: both pass. The banner renders the same bands as before. Spot-check Spain and Japan in `design/screens` after Task 5.

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run lib/stageView.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 6: Commit**

```bash
npx prettier --write lib/stageView.ts lib/stageView.test.ts components/TeamMarker.tsx
git add lib/stageView.ts lib/stageView.test.ts components/TeamMarker.tsx
git commit -m "feat(play): stage bands, veil and fill-or-frame for the spotlight stage

bannerBands now owns the in-round banner rule, used by TeamMarker and the
no-photo stage. stageVeil raises the theme's floor until white text holds
3:1 on the lightest band. photoLayout goes by the width Commons served.

Co-Authored-By: <your model>"
```

---

### Task 3: Haptics — the plan, the player, and one importer of `expo-haptics`

**Files:**

- Create: `lib/hapticPlan.ts`
- Create: `lib/hapticPlan.test.ts`
- Create: `lib/haptics.ts`
- Modify: `stores/progress.ts` (the `haptics` setting)
- Modify: `components/AnswerOption.tsx` (its three direct `expo-haptics` calls become `feedback()`)

**Interfaces:**

- Produces (`lib/hapticPlan.ts`):

```ts
export type HapticMoment =
  'tap' | 'correct' | 'wrong' | 'streak' | 'passed' | 'escuadra' | 'reveal';
export type AndroidHapticType = 'confirm' | 'reject' | 'virtual-key' | 'segment-tick';
export type HapticStep =
  | { kind: 'impact'; style: 'light' | 'medium' | 'soft'; delayMs: number }
  | { kind: 'notification'; type: 'success' | 'warning'; delayMs: number }
  | { kind: 'android'; type: AndroidHapticType; delayMs: number };
export const ANDROID_MIN_API: Record<AndroidHapticType, number>;
export function hapticPlan(moment: HapticMoment, os: string, androidApiLevel: number): HapticStep[];
```

- Produces (`lib/haptics.ts`): `export function feedback(moment: HapticMoment): void`.
- Produces (`stores/progress.ts`): `haptics: boolean` (default `true`, survives `reset()`), and `setHaptics(enabled: boolean): void`.

- [ ] **Step 1: Write the failing tests**

Create `lib/hapticPlan.test.ts`:

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANDROID_MIN_API, hapticPlan, type HapticMoment } from './hapticPlan';

const MOMENTS: HapticMoment[] = [
  'tap',
  'correct',
  'wrong',
  'streak',
  'passed',
  'escuadra',
  'reveal',
];

describe('hapticPlan on iOS (spec §7)', () => {
  it('maps each moment to its call', () => {
    expect(hapticPlan('tap', 'ios', 0)).toEqual([{ kind: 'impact', style: 'light', delayMs: 0 }]);
    expect(hapticPlan('correct', 'ios', 0)).toEqual([
      { kind: 'impact', style: 'medium', delayMs: 0 },
    ]);
    expect(hapticPlan('wrong', 'ios', 0)).toEqual([
      { kind: 'notification', type: 'warning', delayMs: 0 },
    ]);
    expect(hapticPlan('streak', 'ios', 0)).toEqual([{ kind: 'impact', style: 'soft', delayMs: 0 }]);
    expect(hapticPlan('passed', 'ios', 0)).toEqual([{ kind: 'impact', style: 'soft', delayMs: 0 }]);
    expect(hapticPlan('reveal', 'ios', 0)).toEqual([
      { kind: 'impact', style: 'light', delayMs: 0 },
    ]);
  });

  it('plays a la escuadra as a success, then two light taps 60 ms apart', () => {
    expect(hapticPlan('escuadra', 'ios', 0)).toEqual([
      { kind: 'notification', type: 'success', delayMs: 0 },
      { kind: 'impact', style: 'light', delayMs: 60 },
      { kind: 'impact', style: 'light', delayMs: 120 },
    ]);
  });
});

describe('hapticPlan on Android', () => {
  it("uses the platform's haptic constants on a current device", () => {
    const api = 34;
    expect(hapticPlan('tap', 'android', api)).toEqual([
      { kind: 'android', type: 'virtual-key', delayMs: 0 },
    ]);
    expect(hapticPlan('correct', 'android', api)).toEqual([
      { kind: 'android', type: 'confirm', delayMs: 0 },
    ]);
    expect(hapticPlan('wrong', 'android', api)).toEqual([
      { kind: 'android', type: 'reject', delayMs: 0 },
    ]);
    expect(hapticPlan('streak', 'android', api)).toEqual([
      { kind: 'android', type: 'segment-tick', delayMs: 0 },
    ]);
    expect(hapticPlan('escuadra', 'android', api)).toEqual([
      { kind: 'android', type: 'confirm', delayMs: 0 },
      { kind: 'android', type: 'segment-tick', delayMs: 60 },
      { kind: 'android', type: 'segment-tick', delayMs: 120 },
    ]);
  });

  // expo-haptics rejects a constant the device's API level lacks, so the plan
  // falls back to the iOS column's call, which goes through the vibrator.
  it("falls back to the iOS call below a constant's API level", () => {
    expect(hapticPlan('correct', 'android', ANDROID_MIN_API.confirm - 1)).toEqual(
      hapticPlan('correct', 'ios', 0),
    );
    expect(hapticPlan('streak', 'android', ANDROID_MIN_API['segment-tick'] - 1)).toEqual(
      hapticPlan('streak', 'ios', 0),
    );
    expect(hapticPlan('escuadra', 'android', 31)).toEqual([
      { kind: 'android', type: 'confirm', delayMs: 0 },
      { kind: 'impact', style: 'light', delayMs: 60 },
      { kind: 'impact', style: 'light', delayMs: 120 },
    ]);
  });

  it('keeps the tap on every API level', () => {
    expect(hapticPlan('tap', 'android', 21)).toEqual([
      { kind: 'android', type: 'virtual-key', delayMs: 0 },
    ]);
  });
});

describe('hapticPlan elsewhere', () => {
  it('does nothing on web', () => {
    for (const moment of MOMENTS) expect(hapticPlan(moment, 'web', 0)).toEqual([]);
  });
});

// Spec §7: lib/haptics.ts is the only module that imports expo-haptics, so the
// Vibration switch silences every haptic.
describe('expo-haptics importers', () => {
  const ROOT = path.join(import.meta.dirname, '..');
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sources(full);
      return /\.(ts|tsx)$/.test(name) ? [full] : [];
    });
  }

  it('is lib/haptics.ts alone', () => {
    const importers = ['app', 'components', 'lib', 'stores']
      .flatMap((dir) => sources(path.join(ROOT, dir)))
      .filter((file) => /from ['"]expo-haptics['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file));
    expect(importers).toEqual(['lib/haptics.ts']);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run lib/hapticPlan.test.ts`
Expected: FAIL, `Failed to resolve import "./hapticPlan"`.

- [ ] **Step 3: Write the plan**

Create `lib/hapticPlan.ts`:

```ts
// Which device call each feedback moment makes, per platform (spec §7). Pure,
// so it is tested in node: lib/haptics.ts plays the plan, and this file is
// what the tests pin.

export type HapticMoment =
  'tap' | 'correct' | 'wrong' | 'streak' | 'passed' | 'escuadra' | 'reveal';

export type AndroidHapticType = 'confirm' | 'reject' | 'virtual-key' | 'segment-tick';

export type HapticStep =
  | { kind: 'impact'; style: 'light' | 'medium' | 'soft'; delayMs: number }
  | { kind: 'notification'; type: 'success' | 'warning'; delayMs: number }
  | { kind: 'android'; type: AndroidHapticType; delayMs: number };

/**
 * The Android API level each constant needs (`HapticFeedbackConstants`):
 * - CONFIRM and REJECT: 30
 * - SEGMENT_TICK: 34
 * - VIRTUAL_KEY: always present
 *
 * Below the level, expo-haptics rejects the call. Android's own docs
 * recommend these constants over the vibrator API.
 */
export const ANDROID_MIN_API: Record<AndroidHapticType, number> = {
  confirm: 30,
  reject: 30,
  'virtual-key': 1,
  'segment-tick': 34,
};

/** a la escuadra's two trailing taps follow the trail, 60 ms apart. */
const TRAIL_STEP_MS = 60;

const IOS: Record<HapticMoment, HapticStep[]> = {
  tap: [{ kind: 'impact', style: 'light', delayMs: 0 }],
  correct: [{ kind: 'impact', style: 'medium', delayMs: 0 }],
  wrong: [{ kind: 'notification', type: 'warning', delayMs: 0 }],
  streak: [{ kind: 'impact', style: 'soft', delayMs: 0 }],
  passed: [{ kind: 'impact', style: 'soft', delayMs: 0 }],
  escuadra: [
    { kind: 'notification', type: 'success', delayMs: 0 },
    { kind: 'impact', style: 'light', delayMs: TRAIL_STEP_MS },
    { kind: 'impact', style: 'light', delayMs: TRAIL_STEP_MS * 2 },
  ],
  reveal: [{ kind: 'impact', style: 'light', delayMs: 0 }],
};

/** One Android constant per iOS step, in the same order. */
const ANDROID: Record<HapticMoment, AndroidHapticType[]> = {
  tap: ['virtual-key'],
  correct: ['confirm'],
  wrong: ['reject'],
  streak: ['segment-tick'],
  passed: ['confirm'],
  escuadra: ['confirm', 'segment-tick', 'segment-tick'],
  reveal: ['virtual-key'],
};

/**
 * The calls for one moment:
 * - iOS: the iOS column.
 * - Android: each step's constant where the device's API level has it,
 *   otherwise the iOS step it stands for (which plays through the vibrator).
 * - Anywhere else (web): nothing.
 */
export function hapticPlan(
  moment: HapticMoment,
  os: string,
  androidApiLevel: number,
): HapticStep[] {
  if (os === 'ios') return IOS[moment];
  if (os !== 'android') return [];
  const ios = IOS[moment];
  return ANDROID[moment].flatMap((type, i): HapticStep[] => {
    const fallback = ios[i];
    if (fallback === undefined) return [];
    return androidApiLevel >= ANDROID_MIN_API[type]
      ? [{ kind: 'android', type, delayMs: fallback.delayMs }]
      : [fallback];
  });
}
```

- [ ] **Step 4: Add the setting to the progress store**

In `stores/progress.ts`:

1. Add to `ProgressState`, after `telemetryEnabled`:

```ts
/** The About screen's Vibration switch (spec §7). Off means `lib/haptics.ts`
 *  plays nothing. On by default; survives `reset()` like the other settings. */
haptics: boolean;
```

2. Add `setHaptics: (enabled: boolean) => void;` after `setTelemetryEnabled` in the interface.
3. In the store body, add `haptics: true,` after `telemetryEnabled: true,`, and `setHaptics: (haptics) => set({ haptics }),` after `setTelemetryEnabled`.

`reset()` already clears only scores and the last-played team, so `haptics` survives it.

- [ ] **Step 5: Write the player**

Create `lib/haptics.ts`:

```ts
// The only module that imports expo-haptics (spec §7). Screens call
// `feedback(moment)`. It checks the Vibration setting, then plays the moment's
// plan (lib/hapticPlan.ts) for this platform and API level. A rejected call
// is dropped: a missed buzz is never worth an error. The iOS system setting
// and Low Power Mode still apply on top. Haptics never leave the device.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import {
  hapticPlan,
  type AndroidHapticType,
  type HapticMoment,
  type HapticStep,
} from './hapticPlan';
import { useProgress } from '@/stores/progress';

const IMPACT = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  soft: Haptics.ImpactFeedbackStyle.Soft,
} as const;

const NOTIFICATION = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
} as const;

const ANDROID: Record<AndroidHapticType, Haptics.AndroidHaptics> = {
  confirm: Haptics.AndroidHaptics.Confirm,
  reject: Haptics.AndroidHaptics.Reject,
  'virtual-key': Haptics.AndroidHaptics.Virtual_Key,
  'segment-tick': Haptics.AndroidHaptics.Segment_Tick,
};

function play(step: HapticStep): Promise<void> {
  switch (step.kind) {
    case 'impact':
      return Haptics.impactAsync(IMPACT[step.style]);
    case 'notification':
      return Haptics.notificationAsync(NOTIFICATION[step.type]);
    case 'android':
      return Haptics.performAndroidHapticsAsync(ANDROID[step.type]);
  }
}

export type { HapticMoment };

export function feedback(moment: HapticMoment): void {
  if (!useProgress.getState().haptics) return;
  const apiLevel = Platform.OS === 'android' ? Number(Platform.Version) : 0;
  for (const step of hapticPlan(moment, Platform.OS, apiLevel)) {
    const fire = () => {
      play(step).catch(() => {});
    };
    if (step.delayMs > 0) setTimeout(fire, step.delayMs);
    else fire();
  }
}
```

- [ ] **Step 6: Route the answer card through `feedback()`**

In `components/AnswerOption.tsx`:

1. Remove `import * as Haptics from 'expo-haptics';` and add `import { feedback } from '@/lib/haptics';`.
2. Replace `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);` with `feedback('correct');`.
3. Replace `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);` with `feedback('wrong');`.
4. Replace `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);` with `feedback('tap');`.

- [ ] **Step 7: Run the tests and watch them pass**

Run: `npx vitest run lib/hapticPlan.test.ts && npm run typecheck && npm run lint`
Expected: PASS, including "expo-haptics importers is lib/haptics.ts alone".

- [ ] **Step 8: Commit**

```bash
npx prettier --write lib/hapticPlan.ts lib/hapticPlan.test.ts lib/haptics.ts stores/progress.ts components/AnswerOption.tsx
git add lib/hapticPlan.ts lib/hapticPlan.test.ts lib/haptics.ts stores/progress.ts components/AnswerOption.tsx
git commit -m "feat(haptics): one haptics module, Android haptic constants and a Vibration setting

lib/haptics.ts is the only importer of expo-haptics. It plays a pure,
tested plan per moment: Android's own haptic constants where the API
level has them, the vibrator otherwise. The answer card now goes through
it, so the setting silences every haptic.

Co-Authored-By: <your model>"
```

---

### Task 4: The Vibration switch on About

**Files:**

- Modify: `app/about.tsx`

**Interfaces:**

- Consumes: `haptics` and `setHaptics` from `stores/progress.ts` (Task 3).

- [ ] **Step 1: Add the switch**

In `app/about.tsx`:

1. Next to the existing telemetry selectors (`const telemetryEnabled = …` and `const setTelemetryEnabled = …`), add:

```tsx
const haptics = useProgress((s) => s.haptics);
const setHaptics = useProgress((s) => s.setHaptics);
```

2. Directly **before** the telemetry setting's `<View style={[styles.section, styles.settingRow]}>`, add a section of the same shape:

```tsx
<View style={[styles.section, styles.settingRow]}>
  <Text style={styles.settingLabel} nativeID="haptics-label">
    Vibration
  </Text>
  <Switch
    testID="haptics-toggle"
    accessibilityLabelledBy="haptics-label"
    accessibilityLabel="Vibration"
    value={haptics}
    onValueChange={setHaptics}
    trackColor={{ false: colors.surfaceRaised, true: colors.accent }}
    thumbColor={colors.thumbBg}
    ios_backgroundColor={colors.surfaceRaised}
  />
</View>
```

There is no privacy text: haptics never leave the device (spec §7, §10).

- [ ] **Step 2: Verify and commit**

```bash
npx prettier --write app/about.tsx
npm run typecheck && npm run lint
git add app/about.tsx
git commit -m "feat(about): Vibration switch, on by default

Co-Authored-By: <your model>"
```

---

### Task 5: Screens and full check

- [ ] **Step 1: Capture.** Run `npm run shots` (long timeout; it loads photos from Wikimedia).
- [ ] **Step 2: Inspect.**
  - `git status --short design/screens`.
  - `01a-about.png` and `01a-about-light.png` may change, if the new switch is within the captured viewport.
  - Captures with the in-round banner (`06-`, `07-`, `08-` question screens) must look identical, apart from pixel noise in photos. `TeamMarker`'s refactor must not move a band.
  - Compare one question capture against `git show HEAD:<path>`, saving the old one under the SDD workspace, never /tmp. Report any other difference instead of committing it.
- [ ] **Step 3: Full check.** Run `npm run check`. Expected: it passes. Quote the tail.
- [ ] **Step 4: Commit** any changed PNGs: `chore(design): regenerate screens for the Vibration switch`, plus the trailer. If none changed, say so and skip.

The controller opens the PR. Part 2 (the screen) gets its own plan.
