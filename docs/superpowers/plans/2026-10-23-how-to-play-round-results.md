# How to play on the round and Results (#184) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** #183's How to play layer, now on the first question of each level's first round and on the first Results.

**Architecture:** `lib/tips.ts` gains the new screens and a pure choice of Results' tips. `useTips` takes a `ready` flag; `TipsLayer` takes an optional kicker and spoken name for a single tip. The question screen and Results hand the layer refs to their targets, as #183's screens do.

**Tech Stack:** Expo SDK 57, React Native 0.86, react-native-svg, Reanimated 4, Zustand persist, Vitest (node).

**Spec:** `docs/superpowers/specs/2026-10-23-how-to-play-tips-design.md`, the whole file, and its section **The round and Results (#184)** above all. Canvas: the **How to play** page of https://claude.ai/artifact/9wopqyRq53dok9ZYqGPT8X (`CoachPlay`, `CoachParts`, `CoachResults`).

## Global Constraints

- Node 24 (`nvm use`). `npm run check` before a task is reported done, with its real output.
- No hard-coded colour, spacing or font size (guardrail 5): tokens only, colour from `useThemeColors()` inside components.
- Every user-visible string in `i18n/en.ts`, read with `useT()`; each short label carries a `≤ N chars` budget mirrored in `i18n/budgets.ts`; heading ≤ 32 (may wrap), body ≤ 120, as in #183.
- The issue's copy wins over the canvas's ("…help you find the player", "…then the club").
- Animations under 300 ms; `resultsTimeline.tips` (1,200 ms) is a pause, not an animation.
- Nothing new leaves the device. No About change.
- `tips.contentA11y` never goes on a view that contains `TipsLayer`; the layer renders last in the screen's root.
- Don't touch `package.json`, `app.json`, `eas.json`, `.gitignore`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, and carry `(#184)`.

---

### Task 1: Screens, Results' choice of tips, `ready`, and the single-tip kicker

**Files:**

- Modify: `lib/tips.ts`, `lib/__tests__/tips.test.ts`
- Modify: `components/useTips.ts`, `components/TipsLayer.tsx`
- Modify: `theme/tokens.ts` (`resultsTimeline.tips`)

**Interfaces:**

- Produces:
  - `type TipScreen = 'picker' | 'difficulty' | 'study' | 'question-1' | 'question-2' | 'question-3' | 'results'`
  - `type ResultsTip = 'missed' | 'again' | 'next'`
  - `resultsTips(input: { missed: number; passed: boolean; hasNextLevel: boolean }): ResultsTip[]`
  - `useTips(screen: TipScreen, ready?: boolean): Tips` (default `true`; decides once when hydrated and ready)
  - `TipsLayer` props gain `kicker?: string` and `spoken?: string`: when given, they replace the step kicker and spoken name, and with one tip the step dots are hidden.
  - `resultsTimeline.tips: t(1200)`

- [ ] **Step 1: Failing tests** (append to `lib/__tests__/tips.test.ts`, import `resultsTips`)

```ts
describe('resultsTips', () => {
  it('after a fail: the misses, then again', () => {
    expect(resultsTips({ missed: 6, passed: false, hasNextLevel: true })).toEqual([
      'missed',
      'again',
    ]);
  });
  it('after a pass with a next level: the misses, then next', () => {
    expect(resultsTips({ missed: 2, passed: true, hasNextLevel: true })).toEqual([
      'missed',
      'next',
    ]);
  });
  it('leaves the misses out when nothing was missed', () => {
    expect(resultsTips({ missed: 0, passed: true, hasNextLevel: true })).toEqual(['next']);
  });
  it('leaves the second out after passing the last level', () => {
    expect(resultsTips({ missed: 1, passed: true, hasNextLevel: false })).toEqual(['missed']);
  });
  it('is empty for a 10/10 at the last level', () => {
    expect(resultsTips({ missed: 0, passed: true, hasNextLevel: false })).toEqual([]);
  });
});

describe('shouldShowTips, the round and Results', () => {
  it('counts each level apart', () => {
    expect(shouldShowTips('question-2', ['question-1'], false)).toBe(true);
    expect(shouldShowTips('question-1', ['question-1'], false)).toBe(false);
    expect(shouldShowTips('results', [], true)).toBe(false);
  });
});
```

- [ ] **Step 2:** `npx vitest run lib/__tests__/tips.test.ts`: fails (no `resultsTips`, type error on the new screens).
- [ ] **Step 3: Implement in `lib/tips.ts`**

```ts
export type TipScreen =
  'picker' | 'difficulty' | 'study' | 'question-1' | 'question-2' | 'question-3' | 'results';

/** Results' tips (#184): the misses, then what to do next. */
export type ResultsTip = 'missed' | 'again' | 'next';

/** Which of Results' tips have something to point at: no misses on a 10/10,
 *  and no next level after passing the last one. */
export function resultsTips({
  missed,
  passed,
  hasNextLevel,
}: {
  missed: number;
  passed: boolean;
  hasNextLevel: boolean;
}): ResultsTip[] {
  const tips: ResultsTip[] = [];
  if (missed > 0) tips.push('missed');
  if (!passed) tips.push('again');
  else if (hasNextLevel) tips.push('next');
  return tips;
}
```

- [ ] **Step 4: `useTips(screen, ready = true)`**: decide only when `hydrated && ready`; nothing else changes. Update its header comment in one line ("and, for the round and Results, once the screen says it is ready (#184)").
- [ ] **Step 5: `TipsLayer`**: add `kicker?: string` and `spoken?: string` to the props. Where it renders `t.tips.kicker(step + 1, n)` and `t.tips.spoken(step + 1, n)` (kicker text, its label, the dialog's label), use the given ones when present. Hide the dots row when `n === 1`. One line in the header comment.
- [ ] **Step 6: Token**: in `resultsTimeline`, after `reviewPrompt`, add:

```ts
  // How to play's tips on a first Results (#184) wait this long, until the
  // celebration is over (by 1,200 ms, as above). A pause, not an animation.
  tips: t(1200),
```

- [ ] **Step 7:** `npx vitest run lib theme`, `npm run typecheck`, `npm run lint`. Commit `feat(tips): the round's and Results' screens, and a single tip's kicker (#184)`.

---

### Task 2: Text in five languages

**Files:** `i18n/en.ts`, `i18n/budgets.ts`, `i18n/de.ts`, `i18n/es.ts`, `i18n/fr.ts`, `i18n/it.ts`

**Interfaces:**

- Produces, in `t.tips`, after `study`:
  - `kickerLevel(level: number): string` ≤ 22, "How to play · Level 2"; `spokenLevel(level: number): string`, "How to play, level 2";
  - `question.clues` `{ heading, body, bodyClub }`, `question.answer`, `question.level2`, `question.level3`;
  - `results.missed`, `results.again`, `results.next`; each `{ heading, body }`.

- [ ] **Step 1: English** (in `en.tips`, after `study`, keeping #183's budget comment style; `kickerLevel` sits with `kicker`, `spokenLevel` with `spoken`):

```ts
    question: {
      clues: {
        heading: 'A number, some clues',
        body: 'The shirt number is the question. Position, age and club help you find the player.',
        /** A club squad's clues are position, age and nationality. */
        bodyClub:
          'The shirt number is the question. Position, age and nationality help you find the player.',
      },
      answer: {
        heading: 'Tap who wears it',
        body: 'A right answer moves on by itself. A miss shows who it was and waits for you.',
      },
      level2: {
        heading: 'Two parts now',
        body: 'Name first, then the position. It only counts if both are right.',
      },
      level3: {
        heading: 'Three parts',
        body: 'Name, position, then the club. In a club squad, the nationality instead.',
      },
    },
    results: {
      missed: {
        heading: 'The ones to learn',
        body: 'Every miss, with who it was and what you picked. Swipe for all.',
      },
      again: {
        heading: 'Again, or study',
        body: 'Score 8/10 to unlock the next level. Retry now, or study the squad first.',
      },
      next: { heading: 'On to the next', body: 'Play the next level, or study the squad first.' },
    },
```

`kickerLevel: (level: number) => \`How to play · Level ${level}\`` with `/** ≤ 22 chars: over a level's single tip, in mono capitals. */`, and `spokenLevel: (level: number) => \`How to play, level ${level}\``.

- [ ] **Step 2: Budgets**: `tips.kickerLevel` (measured at 3) in a ≤ 22 group in its file position; every new heading joins the existing ≤ 32 group and every new body (with `bodyClub`) the ≤ 120 group. If the existing groups' comment sits over `picker`, keep the new keys inside its scope or add a matching comment, so the budgets test's order check passes.
- [ ] **Step 3: Translate** in de, es, fr (France, tu), it, reusing each catalog's words for the round (the part names, "level", the slot chip names, Results' buttons: read `round`, `results`, `ladder`, `study`).
- [ ] **Step 4:** `npx vitest run i18n`, `npm run typecheck`, `npm run lint`. Commit `feat(tips): the round's and Results' tips in five languages (#184)`.

The controller then runs a fresh native-speaker review per language until clean.

---

### Task 3: Tips on the question screen

**Files:** `app/play/[squadId]/[level]/index.tsx`

- [ ] **Step 1: Refs.** `heroRef` on a `View` (`collapsable={false}`) wrapping the number and the slots inside the hero, keeping its `gap` (move `gap: spacing.sm` from `hero` onto the wrapper, or give the wrapper the same gap) so nothing moves. `slotsRef` on the slots `View`. `answersRef` on a `View` (`collapsable={false}`) wrapping `<AnswerGrid>`.
- [ ] **Step 2: When.** Above the early `return null`:

```ts
const firstQuestion =
  session.phase === 'playing' &&
  session.squadId === squadId &&
  session.level === level &&
  session.currentIndex === 0 &&
  session.currentPartIndex === 0 &&
  session.results[0]?.parts.length === 0;
const tips = useTips(`question-${level}` as TipScreen, firstQuestion);
```

(Check `QuestionResult`'s shape in `stores/session.ts`: "nothing answered yet" must be exactly that. Adjust the expression to the real field, keep the meaning.)

- [ ] **Step 3: The tips.**
  - Level 1: `[{ target: heroRef, radius: radii.xl, heading: t.tips.question.clues.heading, body: squad.kind === 'club' ? t.tips.question.clues.bodyClub : t.tips.question.clues.body }, { target: answersRef, radius: radii.xl, ...t.tips.question.answer }]`.
  - Level 2: `[{ target: slotsRef, radius: radii.lg, ...t.tips.question.level2 }]` with `kicker={t.tips.kickerLevel(2)}` `spoken={t.tips.spokenLevel(2)}`.
  - Level 3: the same with `level3` and 3.
  - Render `{tips.open && <TipsLayer … onClose={tips.close} onSkip={tips.skip} onShown={tips.onShown} />}` after `ShotOverlay`, last in the root. Spread `tips.contentA11y` on `styles.column`'s `View`.
- [ ] **Step 4: Check on web** (`npx expo start --web`, fresh storage): `/play/esp/1?seed=20260821`, `/play/esp/2?seed=20260821`, `/play/bar/3?seed=20260821` at 390 × 844 and 360 × 640, dark and light. The rings land on the number and clues, the answers, and the slot chips; a tap anywhere moves on; nothing is answered behind; after Got it the round plays as before; a second round at that level shows no tips. Screenshots to the scratchpad, viewed with Read.
- [ ] **Step 5:** typecheck, lint, format. Commit `feat(tips): How to play on each level's first question (#184)`.

---

### Task 4: Tips on Results

**Files:** `app/play/[squadId]/[level]/results.tsx`

- [ ] **Step 1: Ready.** A `celebrated` state set by a `setTimeout(…, resultsTimeline.tips)` in an effect on mount (cleared on unmount). `const tips = useTips('results', celebrated);` above the early return.
- [ ] **Step 2: Targets.** `missedRef` on the `MissedCards` section's root (pass a `ref` prop through `MissedCards` to its section `View`; React 19 takes `ref` as a prop). `actionsRef` on the `styles.actions` `View`.
- [ ] **Step 3: The tips.** `resultsTips({ missed: missed.length, passed: tier !== 'fail', hasNextLevel: level < MAX_LEVEL })` mapped to specs: `missed` → `missedRef`, `radii.xl`, `t.tips.results.missed`; `again` → `actionsRef`, `radii.xl`, `t.tips.results.again`; `next` → `actionsRef`, `radii.xl`, `t.tips.results.next`. Render the layer only when `tips.open && specs.length > 0`, last inside the fragment's top level (after the `ShareSheet`), so it covers the screen.
- [ ] **Step 4: Scroll.** Give the `ScrollView` a ref and track its `contentOffset.y` in a ref (`onScroll`, `scrollEventThrottle={16}`); `scrollBy={(dy) => scrollRef.current?.scrollTo({ y: Math.max(0, offset.current + dy), animated: false })}`. Spread `tips.contentA11y` on the `ScrollView`.
- [ ] **Step 5: Rating.** In the `useFocusEffect` that waits to ask for a review, return early while `tips.open`, and add `tips.open` to its deps, so the wait starts again when the tips close. One clause in its comment.
- [ ] **Step 6: Check on web**: a first round failed (`/play/esp/1`, wrong answers) and, on fresh storage, one passed; tip 1 rings the cards, tip 2 the actions, with the right copy; at 360 × 640 the actions scroll into view; a later Results shows no tips. Screenshots viewed with Read.
- [ ] **Step 7:** typecheck, lint, format. Commit `feat(tips): How to play on the first Results (#184)`.

---

### Task 5: Screens and SCREENS.md

**Files:** `scripts/capture-screens.mjs`, `design/SCREENS.md`, `design/screens/*`

- [ ] **Step 1:** In the design-profile tips block, before `seedTipsSkipped`, capture: `06b-question-l1-tip-1`, `06b-question-l1-tip-2` (`/play/esp/1?seed=${SEED}`), `07b-question-l2-tip` (`/play/esp/2?seed=${SEED}`), `08b-question-l3-tip` (`/play/esp/3?seed=${SEED}`). For Results, seed `tipsSeen` with every screen but `results` (a `seedTips(capture, { seen, skipped })` helper written like `seedStarred`), then run the existing failed-round flow and shoot `09b-results-tip-1` and `09b-results-tip-2`; reseed and run the passed-round flow for `09c-results-tip-pass` (its second tip). Then `seedTipsSkipped` as now. Each `-light` too.
- [ ] **Step 2:** `npm run shots`; no existing PNG may change. View the new ones with Read.
- [ ] **Step 3:** `design/SCREENS.md`: the layer on the question and Results rows; the new files in the table.
- [ ] **Step 4:** `npm run check`. Commit `docs(tips): screens for How to play on the round and Results (#184)`.
