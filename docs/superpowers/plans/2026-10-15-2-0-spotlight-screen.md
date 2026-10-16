# #113 part 2 — The Spotlight question screen: Implementation Plan

**Issue:** [#113](https://github.com/tovmassian/escuadra/issues/113) (part 2 of 2; closes it) · **Milestone:** [v2.0.0](https://github.com/tovmassian/escuadra/milestone/5) · **Branch:** `feat/113-spotlight-screen`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the question screen with the 2.0 Spotlight design (spec §2):

- the player's photo, or the team's colours, fills the top of the screen;
- the shirt number, slot chips, prompt, answer grid and footer sit in the thumb zone;
- a correct answer moves on by itself, and a miss waits;
- a streak chip, motion and haptics.

One layout serves all three levels, and fits 360×640 without scrolling.

**Architecture:**

- **Logic is already on `main`** (part 1, #120): `lib/roundView.ts` has slots, layout, streak and prompts; `lib/stageView.ts` has bands, veil and fill-or-frame; `lib/haptics.ts` has `feedback()`.
- **This plan adds:**
  - the colour, type and motion tokens the boards need;
  - four more pure helpers;
  - nine presentational components and one hook;
  - the screen rewrite, which also prefetches the round's photos and drives auto-advance;
  - removal of the old hero screen's parts;
  - the doc, guardrail and About-text updates.
- **Testing:** components have no unit tests, since Vitest has no RN renderer. They are verified by typecheck, lint, the web build and a fit check.

**Tech Stack:** React Native 0.86, Expo SDK 57 (expo-image, expo-linear-gradient, expo-status-bar), Reanimated 4.5 (shared values, layout animations, `Keyframe`, `useReducedMotion`), TypeScript strict, Vitest.

**Spec:** [`docs/superpowers/specs/2026-10-15-play-redesign-2-0-design.md`](../specs/2026-10-15-play-redesign-2-0-design.md):

- §2 (screen): §2.1 layout, §2.2 slots, §2.3 fit, §2.4 flow, §2.5 streak, §2.6 stage, §2.7 credit
- §6 (mid-round motion) and §7 (haptics)
- §9 (round prefetch), §10.1 (About photo text)
- §11 (code map), §12 (docs) and §13 (behaviour)

**Design source:** `SpotProto.dc.html` on the canvas (<https://claude.ai/artifact/2P5prLsh9wAsGSkkD4MtwY>). Its values are transcribed into the tokens below, so you don't need to open it.

**Issue notes that bind this plan** (all in #113's body):

- Archivo styles carry no `fontWeight`.
- `onStageMuted` is for the ground; text over the photo uses `onPhoto` / `onPhotoMuted`.
- `sizes.segment.question`.
- Fill-or-frame goes by the served width (`photoLayout` already does this).

## Global Constraints

- Node 24: run `nvm use` in every new shell.
- **Guardrail 5.**
  - Never hardcode a colour, spacing value, size or duration. Everything comes from `theme/tokens.ts`.
  - Colour comes from `useThemeColors()` at render time, never a module-scope capture.
  - A `StyleSheet.create` at module scope may hold only colour-free layout.
- **Motion.**
  - Every animation stays within 300 ms; `durations.autoAdvance` is a pause, not an animation.
  - With Reduce Motion (`useReducedMotion()`) nothing shakes, bounces, slides or scales: colour and opacity only, `durations.transition`.
- **Haptics:** only through `feedback()` from `@/lib/haptics` (a test enforces this).
- **Answers are taps, never text input** (guardrail 3).
- **Photo credit:** `PhotoCreditLine`, under the footer action for the whole question. Never the Commons file name in visible text or a label (guardrail 1).
- **No crests, badges or logos** (guardrail 2). Team identity is the marker's bands. Flags appear only at 22×15 (answers) and 18×12 (NAT chip).
- **In-round banner rule:** `TeamMarker variant="banner"` in the top bar.
- **Invariants 7, 8 and 9 hold:**
  - asking stops at the first wrong part;
  - a slot or tile never shows a verdict it did not earn;
  - the progress bar counts questions.
- **No new dependency or npm script, and no `app.json` change.** The screen uses only installed packages.
- **New typography for Inter-Bold or a bold Archivo cut sets no `fontWeight`:** Android draws the system font otherwise (#117).
- `lib/` helpers stay React-free and tested; tests sit beside the code in `lib/` and `theme/`.
- TypeScript strict with `noUncheckedIndexedAccess`; never weaken it, and avoid `!`.
- **Privacy text:** this PR changes when photos load (a round's ten at once), so About's "Player photos" text changes in this PR (guardrail 4). `gh-pages` `privacy.html` follows with the release.
- **Before each commit:**
  - run `npx prettier --write` on the changed files, then `npm run typecheck` and `npm run lint`;
  - run `npx vitest run` once.
- **Never write to /tmp.** Use the SDD workspace the controller names.
- Each commit ends with a `Co-Authored-By` line naming the model that wrote it.

## Decisions made in planning (flag them in the PR)

1. **Auto-advance timing.** The next bar fills over `durations.autoAdvance`, starting when the question is scored. The round moves on when the bar is full, so the spec's "moves on after 1,200 ms" holds; the motion table's 300 ms bar delay is dropped.
2. **Accessibility over the board.**
   - Light-theme green text on its washes (`nextText`, `stageSuccessText`) is `#24702f`. The board's `#2f8f3e` gives about 3.4:1.
   - Light muted chip text and chip labels (`chipPendingText`, `onStageMuted`) are `#5f636a`, about 5:1 on the chip. The board's `#686c73` gives about 4.35:1.
3. **No icon library.**
   - The close × and the flame are drawn from Views, as `SearchField` draws its glyphs.
   - The "Got it — next" button has no arrow.
   - Light tiles have a border and no shadow.
4. **Round prefetch lives in the screen, not the store.** `stores/session.ts` stays free of I/O. A pure `roundPhotoUrls` feeds an effect that runs when a round starts.
5. **Fit is verified on the web build** at 360×600 and 375×647. Those are the spec's 360×640 and 375×667 minus their safe-area insets; web has no insets.

---

### Task 0: Branch and plan (controller, done)

`feat/113-spotlight-screen` was made from `main` (c6e76264) and pushed. The controller commits this plan.

---

### Task 1: Tokens for the stage UI

**Files:**

- Modify: `theme/tokens.ts`
- Modify: `theme/tokens.test.ts`

**Interfaces:**

- **Produces, on `Palette`:**
  - shared: `photoTrack`, `photoSuccess`, `photoError`, `stageShimmer`, `stageShimmerEdge`
  - per theme: `onStage`, `chipBg`, `chipLine`, `chipPendingLine`, `chipPendingText`, `tileSub`, `stageSuccessText`, `stageSuccessBg`, `stageErrorLine`, `stageErrorBg`, `stageErrorText`, `stageAnswerBg`, `flagRing`, `nextLine`, `nextBg`, `nextText`, `nextFill`
- **Produces, in `stage`:** `focal`, `frame`, `frameDim`, `missDim`, `shimmer`
- **Produces:**
  - `sizes.corner.question.ball`, `sizes.minTapTarget`, `sizes.topBar`, `sizes.slotChipHeight`
  - `radii.xs`
  - `iconSize.closeGlyph`, `iconSize.flameGlyph`
  - `opacity.tileAfterCorrect`, `opacity.tileAfterMiss`
  - `durations.partOut`, `durations.partStagger`, `durations.tileStagger`
  - new exports `spotlightMotion` and `spotlightCues`
  - `typography.bodyStrong`, `typography.slotValue`, `typography.topBarTeam`, `typography.tileSubLabel`

- [ ] **Step 1: Write the failing tests**

In `theme/tokens.test.ts`:

1. Add `spotlightCues, spotlightMotion` to the `./tokens` import.
2. Add these five to the shared-roles list in the `spotlight stage` describe: `'photoTrack', 'photoSuccess', 'photoError', 'stageShimmer', 'stageShimmerEdge'`.
3. Append:

```ts
describe('spotlight screen text contrast', () => {
  // Opaque text roles on the stage's ground, held to AA (4.5:1) against the
  // theme's background. Translucent roles composite at render time and are
  // checked on the design board instead.
  const TEXT_ROLES = [
    'onStage',
    'chipPendingText',
    'onStageMuted',
    'stageSuccessText',
    'stageErrorText',
    'nextText',
    'tileSub',
  ] as const;

  it('reaches 4.5:1 on the ground wherever the role is opaque', () => {
    (['dark', 'light'] as const).forEach((name) => {
      const p = palettes[name];
      for (const role of TEXT_ROLES) {
        const value = p[role];
        if (!value.startsWith('#')) continue;
        expect(contrastRatio(value, p.background), `${name}.${role}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});

describe('spotlight motion', () => {
  it('cues every mid-round moment within the 300 ms budget', () => {
    for (const [cue, ms] of Object.entries(spotlightCues)) {
      expect(ms, cue).toBeGreaterThanOrEqual(0);
      expect(ms, cue).toBeLessThanOrEqual(300);
    }
  });

  it('keeps scales near 1 and distances small', () => {
    for (const key of ['pressScale', 'streakOutScale', 'ballStartScale'] as const) {
      expect(spotlightMotion[key], key).toBeLessThan(1);
    }
    for (const key of ['popScale', 'answerPopScale', 'pulseScale', 'streakPopScale'] as const) {
      expect(spotlightMotion[key], key).toBeGreaterThan(1);
      expect(spotlightMotion[key], key).toBeLessThanOrEqual(1.2);
    }
  });
});
```

Run: `npx vitest run theme/tokens.test.ts`. Expected: FAIL. The new exports and roles don't exist yet.

- [ ] **Step 2: Add the palette roles**

In `interface Palette`, after `accentLine: string;`:

```ts
// ---- 2.0 question screen (spec §2), from the design board ----
/** Progress segments over the photo: future, right, wrong. */
photoTrack: string;
photoSuccess: string;
photoError: string;
/** The loading shimmer's highlight and its transparent edges. */
stageShimmer: string;
stageShimmerEdge: string;
/** Text on the stage's ground: the shirt number, the prompt, the active
 *  slot's "?". */
onStage: string;
/** Slot chips: fill, outline, and a pending slot's dashed outline and text
 *  (also a not-asked slot's value). */
chipBg: string;
chipLine: string;
chipPendingLine: string;
chipPendingText: string;
/** The word under a position tile's code. */
tileSub: string;
/** Verdicts on the stage: a right slot's text and a right pick's fill; a
 *  wrong pick's outline, fill and text; the right answer's fill after a
 *  miss. */
stageSuccessText: string;
stageSuccessBg: string;
stageErrorLine: string;
stageErrorBg: string;
stageErrorText: string;
stageAnswerBg: string;
/** The hairline around a flag on the stage. */
flagRing: string;
/** The auto-next bar: outline, fill, label and the progress inside it. */
nextLine: string;
nextBg: string;
nextText: string;
nextFill: string;
```

In `sharedRoles`, after `veilInk: '#0c0d12',`:

```ts
  photoTrack: 'rgba(255,255,255,0.28)',
  photoSuccess: '#61bd67',
  photoError: '#f05653',
  stageShimmer: 'rgba(255,255,255,0.26)',
  stageShimmerEdge: 'rgba(255,255,255,0)',
```

In `darkRoles`, after `accentLine: sharedRoles.brandSoft,`:

```ts
  onStage: '#ffffff',
  chipBg: 'rgba(255,255,255,0.1)',
  chipLine: 'rgba(255,255,255,0.16)',
  chipPendingLine: 'rgba(255,255,255,0.3)',
  chipPendingText: 'rgba(255,255,255,0.6)',
  tileSub: 'rgba(255,255,255,0.66)',
  stageSuccessText: '#8fe095',
  stageSuccessBg: 'rgba(97,189,103,0.22)',
  stageErrorLine: 'rgba(240,86,83,0.55)',
  stageErrorBg: 'rgba(240,86,83,0.14)',
  stageErrorText: '#e9827f',
  stageAnswerBg: 'rgba(18,20,26,0.6)',
  flagRing: 'rgba(255,255,255,0.14)',
  nextLine: 'rgba(97,189,103,0.5)',
  nextBg: 'rgba(97,189,103,0.12)',
  nextText: '#9be0a0',
  nextFill: 'rgba(97,189,103,0.2)',
```

In `lightRoles`, change `onStageMuted: '#686c73',` to `onStageMuted: '#5f636a', // 5:1 on a chip (the board's #686c73 is 4.35)`, and after `accentLine: sharedRoles.accent,` add:

```ts
  onStage: '#14161a',
  chipBg: 'rgba(20,22,26,0.06)',
  chipLine: 'rgba(20,22,26,0.12)',
  chipPendingLine: 'rgba(20,22,26,0.28)',
  chipPendingText: '#5f636a',
  tileSub: '#686c73',
  // The board's #2f8f3e gives ~3.4:1 on its own green washes; this holds 5:1.
  stageSuccessText: '#24702f',
  stageSuccessBg: 'rgba(47,143,62,0.12)',
  stageErrorLine: 'rgba(194,57,52,0.45)',
  stageErrorBg: 'rgba(194,57,52,0.08)',
  stageErrorText: '#b0413c',
  stageAnswerBg: '#ffffff',
  flagRing: 'rgba(20,22,26,0.14)',
  nextLine: 'rgba(47,143,62,0.45)',
  nextBg: 'rgba(47,143,62,0.08)',
  nextText: '#24702f',
  nextFill: 'rgba(47,143,62,0.14)',
```

- [ ] **Step 3: Extend `stage`**

Replace `export const stage = { veil: { dark: 0.42, light: 0.12 }, } as const;` with:

```ts
export const stage = {
  veil: { dark: 0.42, light: 0.12 },
  // Where a filled photo is anchored: faces sit high in a portrait.
  focal: { top: '14%', left: '50%' },
  // A framed photo (original under 720 px wide): whole, at 3:4, in the
  // upper stage, over its own copy filled and darkened by `frameDim`.
  frame: { bottom: '30%', height: '84%', aspect: 3 / 4 },
  frameDim: 0.55,
  // How much the photo dims on a miss (spec §6).
  missDim: 0.1,
  // The loading shimmer: a diagonal band (spec §2.6).
  shimmer: { locations: [0.3, 0.48, 0.66], start: { x: 0, y: 0.35 }, end: { x: 1, y: 0.65 } },
} as const;
```

- [ ] **Step 4: Typography, sizes, radii, icons, opacity, durations, motion**

**`typography`.** After `tileCode`, add the following. They set no `fontWeight` on bold faces, per #117.

```ts
  // ---- 2.0 question screen: Inter faces chosen by family, no weight ----
  // A picked or revealed right answer on a tile.
  bodyStrong: { fontFamily: 'Inter-Bold', fontSize: 17 },
  // A slot chip's value.
  slotValue: { fontFamily: 'Inter-Bold', fontSize: 13 },
  // The team name in the question's top bar.
  topBarTeam: { fontFamily: 'Inter-Bold', fontSize: 14 },
  // The word under a position tile's code ("Keeper").
  tileSubLabel: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 10.5 },
```

**`sizes`.**

1. Change the corner line to:

```ts
  corner: { question: { arm: 24, bar: 6, ball: 10 }, results: { arm: 40, bar: 10 } },
```

2. Add, after `avatar: 46,`:

```ts
  // Apple's minimum tap target; smaller drawn controls take hitSlop to reach it.
  minTapTarget: 44,
  // The question's top bar, and the glass pills in it (score).
  topBar: { height: 52, pill: 32, pillMinWidth: 52 },
  slotChipHeight: 30,
```

**`radii`.** Add `xs: 2, // progress segments` before `sm: 8,`.

**`iconSize`.** Add:

```ts
  closeGlyph: 14, // the question's close ×, two crossed bars
  flameGlyph: 12, // the streak chip's flame
```

**`opacity`.** Add:

```ts
  tileAfterCorrect: 0.5, // other tiles once the pick was right (spec §6)
  tileAfterMiss: 0.35, // other tiles after a miss
```

**`durations`.** Add these three directly before `autoAdvance: 1200,`. The pause stays last, and all three are within 300 ms.

```ts
  partOut: 120, // the old part's tiles fading out
  partStagger: 20, // between tiles rising in for the next part
  tileStagger: 25, // between tiles rising in for the next question
```

**New exports,** after `durations`:

```ts
// Distances (pt) and scales of the question screen's motion (spec §6).
export const spotlightMotion = {
  pressScale: 0.97,
  popScale: 1.04,
  answerPopScale: 1.03,
  pulseScale: 1.06,
  streakPopScale: 1.15,
  streakOutScale: 0.8,
  ballStartScale: 0.6,
  shake: 6,
  rise: 8,
  numberRise: 12,
  slide: 16,
  ballDrop: 10,
} as const;

// When each beat starts after a verdict (ms, spec §6), so the screen reads as
// one gesture: tile, then slot, then ball, then streak.
export const spotlightCues = {
  slot: 60,
  ball: 80,
  streak: 120,
  missAnswer: 60,
  missDim: 100,
  missStreak: 120,
  missCta: 140,
} as const;
```

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run theme design && npm run typecheck`. Expected: PASS. `design/handoff.test.ts` covers the new exports automatically.

```bash
npx prettier --write theme/tokens.ts theme/tokens.test.ts
git add theme/tokens.ts theme/tokens.test.ts
git commit -m "feat(theme): tokens for the 2.0 question screen — stage roles, motion, cues

Light-theme green text and muted chip text are darkened to hold AA on
their washes; the board's values fall short.

Co-Authored-By: <your model>"
```

---

### Task 2: Four pure helpers

**Files:**

- Modify: `lib/roundView.ts` and `lib/roundView.test.ts` (`footerMode`, `streakMilestone`, `slotSpoken`)
- Modify: `lib/photos.ts` and `lib/photos.test.ts` (`roundPhotoUrls`)

**Interfaces:**

```ts
export type FooterMode = 'waiting' | 'autoNext' | 'next' | 'gotIt';
export function footerMode(verdict: boolean | null, screenReader: boolean): FooterMode;
export function streakMilestone(previous: number, current: number): boolean;
export function slotSpoken(slot: Slot): string;
// lib/photos.ts
export function roundPhotoUrls(
  questions: readonly { playerId: string }[],
  playerById: (id: string) => Player | undefined,
): string[];
```

- [ ] **Step 1: Write the failing tests**

Append to `lib/roundView.test.ts`, and extend its `./roundView` import with `footerMode, streakMilestone, slotSpoken`:

```ts
describe('footerMode', () => {
  it('waits for an answer, then moves on by itself or waits on a miss', () => {
    expect(footerMode(null, false)).toBe('waiting');
    expect(footerMode(true, false)).toBe('autoNext');
    expect(footerMode(false, false)).toBe('gotIt');
  });

  // Spec §2.4: no auto-advance while a screen reader is on.
  it('never moves on by itself with a screen reader on', () => {
    expect(footerMode(true, true)).toBe('next');
    expect(footerMode(false, true)).toBe('gotIt');
  });
});

describe('streakMilestone', () => {
  it('fires when the streak reaches 5 or 10', () => {
    expect(streakMilestone(4, 5)).toBe(true);
    expect(streakMilestone(9, 10)).toBe(true);
  });

  it('stays quiet otherwise, and on a re-render at the same count', () => {
    expect(streakMilestone(5, 5)).toBe(false);
    expect(streakMilestone(5, 6)).toBe(false);
    expect(streakMilestone(5, 0)).toBe(false);
    expect(streakMilestone(3, 4)).toBe(false);
  });
});

describe('slotSpoken', () => {
  it('names a settled slot with its value', () => {
    expect(slotSpoken({ key: 'POS', state: 'given', value: 'FW' })).toBe('Position: FW');
    expect(slotSpoken({ key: 'NAME', state: 'correct', value: 'Pedri' })).toBe(
      'Name: Pedri, right',
    );
    expect(slotSpoken({ key: 'CLUB', state: 'wrong', value: 'Barcelona' })).toBe(
      'Club: Barcelona, the right answer',
    );
    expect(slotSpoken({ key: 'NAT', state: 'notAsked', value: 'Spain' })).toBe(
      'Nationality: Spain, not asked',
    );
  });

  // Guardrail: a screen reader must not read out the answer being asked.
  it('never speaks a value for a slot still being asked', () => {
    expect(slotSpoken({ key: 'NAME', state: 'active', value: null })).toBe('Name: being asked');
    expect(slotSpoken({ key: 'POS', state: 'pending', value: null })).toBe('Position: asked next');
  });
});
```

Append to `lib/photos.test.ts`, and add `roundPhotoUrls` to its `@/lib/photos` import:

```ts
describe('roundPhotoUrls', () => {
  const withPhoto = (id: string, url: string): Player => ({
    ...player(credit),
    id,
    photo: { ...credit, url },
  });

  it("lists each question's photo once, in question order, skipping players without one", () => {
    const players = new Map<string, Player>([
      ['a', withPhoto('a', 'https://upload.wikimedia.org/a.jpg')],
      ['b', player(null)],
      ['c', withPhoto('c', 'https://upload.wikimedia.org/c.jpg')],
    ]);
    expect(
      roundPhotoUrls(
        [
          { playerId: 'c' },
          { playerId: 'b' },
          { playerId: 'a' },
          { playerId: 'c' },
          { playerId: 'x' },
        ],
        (id) => players.get(id),
      ),
    ).toEqual(['https://upload.wikimedia.org/c.jpg', 'https://upload.wikimedia.org/a.jpg']);
  });
});
```

`player` and `credit` already exist at the top of `lib/photos.test.ts`. If `player`'s signature differs, adapt the helper; keep the assertion.

Run: `npx vitest run lib/roundView.test.ts lib/photos.test.ts`. Expected: FAIL, because the exports don't exist.

- [ ] **Step 2: Implement**

Append to `lib/roundView.ts`:

```ts
/**
 * What the footer offers (spec §2.4):
 * - waiting for a tap;
 * - after a right answer, the bar that moves on by itself;
 * - after a miss, a button that waits.
 *
 * With a screen reader on, a right answer gets a plain Next button: the round
 * never moves on by itself then.
 */
export type FooterMode = 'waiting' | 'autoNext' | 'next' | 'gotIt';

export function footerMode(verdict: boolean | null, screenReader: boolean): FooterMode {
  if (verdict === null) return 'waiting';
  if (verdict === false) return 'gotIt';
  return screenReader ? 'next' : 'autoNext';
}

/** The streak haptic's moment: the count just reached 5 or 10 (spec §7). */
export function streakMilestone(previous: number, current: number): boolean {
  return current !== previous && (current === 5 || current === 10);
}

const SLOT_NAMES: Record<SlotKey, string> = {
  NAME: 'Name',
  POS: 'Position',
  AGE: 'Age',
  CLUB: 'Club',
  NAT: 'Nationality',
};

/** A slot chip's screen-reader label. A slot still being asked carries no
 *  value, so its label cannot read out the answer. */
export function slotSpoken(slot: Slot): string {
  const name = SLOT_NAMES[slot.key];
  switch (slot.state) {
    case 'active':
      return `${name}: being asked`;
    case 'pending':
      return `${name}: asked next`;
    case 'correct':
      return `${name}: ${slot.value ?? ''}, right`;
    case 'wrong':
      return `${name}: ${slot.value ?? ''}, the right answer`;
    case 'notAsked':
      return `${name}: ${slot.value ?? ''}, not asked`;
    case 'given':
      return `${name}: ${slot.value ?? ''}`;
  }
}
```

Append to `lib/photos.ts`:

```ts
/**
 * Every photo a round will show, once each, in question order. The screen
 * prefetches them all when the round starts (spec §9), so a question never
 * waits on its photo. A player with no photo, or not found, is skipped.
 */
export function roundPhotoUrls(
  questions: readonly { playerId: string }[],
  playerById: (id: string) => Player | undefined,
): string[] {
  const urls: string[] = [];
  for (const { playerId } of questions) {
    const url = photoFor(playerById(playerId))?.url;
    if (url !== undefined && !urls.includes(url)) urls.push(url);
  }
  return urls;
}
```

- [ ] **Step 3: Verify and commit**

Run: `npx vitest run lib && npm run typecheck`. Expected: PASS.

```bash
npx prettier --write lib/roundView.ts lib/roundView.test.ts lib/photos.ts lib/photos.test.ts
git add lib/roundView.ts lib/roundView.test.ts lib/photos.ts lib/photos.test.ts
git commit -m "feat(play): footer mode, streak milestone, slot labels and round photo list

Co-Authored-By: <your model>"
```

---

### Task 3: The top bar and the hero's parts

**Files:**

- Create: `components/RoundProgress.tsx`
- Create: `components/GlassCloseButton.tsx`
- Create: `components/StreakChip.tsx`
- Create: `components/SlotChip.tsx`
- Create: `components/EscuadraCorner.tsx`

**Interfaces:**

```ts
RoundProgress({ outcomes }: { outcomes: DotOutcome[] })
GlassCloseButton({ label, onPress }: { label: string; onPress: () => void })
StreakChip({ count }: { count: number })            // the screen mounts it from 2
SlotChip({ slot }: { slot: Slot })
export type CornerState = 'asking' | 'correct' | 'wrong';
EscuadraCorner({ state }: { state: CornerState })   // absolute, top-right of its parent
```

There are no unit tests (no RN renderer). Verification is `npm run typecheck`, `npm run lint`, and Task 6's web run.

- [ ] **Step 1: `components/RoundProgress.tsx`**

```tsx
import { StyleSheet, View } from 'react-native';
import type { DotOutcome } from '@/lib/roundView';
import { radii, sizes, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Stories-style progress over the photo (spec §2.1), one segment per question:
// - past: its verdict;
// - current: white until answered, then its verdict;
// - future: a faint track.
// Invariant 9: it counts questions, not parts.
export function RoundProgress({ outcomes }: { outcomes: DotOutcome[] }) {
  const colors = useThemeColors();
  const fill: Record<DotOutcome, string> = {
    correct: colors.photoSuccess,
    wrong: colors.photoError,
    current: colors.onPhoto,
    future: colors.photoTrack,
  };
  const answered = outcomes.filter((o) => o === 'correct' || o === 'wrong').length;
  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel="Round progress"
      accessibilityValue={{ min: 0, max: outcomes.length, now: answered }}
    >
      {outcomes.map((outcome, i) => (
        <View key={i} style={[styles.segment, { backgroundColor: fill[outcome] }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  segment: { flex: 1, height: sizes.segment.question, borderRadius: radii.xs },
});
```

- [ ] **Step 2: `components/GlassCloseButton.tsx`**

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { borderWidths, iconSize, opacity, sizes } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// The round glass button over the photo that leaves the round (spec §2.1).
// Drawn at 36 pt; hitSlop brings the tap target to the 44 pt minimum. The ×
// is two crossed bars, as SearchField draws its glyphs.
export function GlassCloseButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useThemeColors();
  const size = sizes.glassButton;
  const glyph = iconSize.closeGlyph;
  const slop = (sizes.minTapTarget - size) / 2;
  const styles = StyleSheet.create({
    button: {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: borderWidths.hairline,
      borderColor: colors.glassLine,
      backgroundColor: colors.glass,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glyph: { width: glyph, height: glyph },
    bar: {
      position: 'absolute',
      top: glyph / 2 - borderWidths.thick,
      left: 0,
      width: glyph,
      height: borderWidths.thick * 2,
      borderRadius: borderWidths.thick,
      backgroundColor: colors.onPhoto,
    },
  });
  return (
    <Pressable
      testID="question-close"
      onPress={onPress}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, pressed && { opacity: opacity.settled }]}
    >
      <View style={styles.glyph}>
        <View style={[styles.bar, { transform: [{ rotate: '45deg' }] }]} />
        <View style={[styles.bar, { transform: [{ rotate: '-45deg' }] }]} />
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 3: `components/StreakChip.tsx`**

```tsx
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  Keyframe,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  borderWidths,
  durations,
  iconSize,
  radii,
  sizes,
  spacing,
  spotlightCues,
  spotlightMotion,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// The streak (spec §2.5): correct answers in a row, shown from 2. It pops when
// it grows. A miss unmounts it, and its exit shrinks and fades it. Heat is
// brand, never a verdict colour: it only ever means the streak.
const exit = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: spotlightMotion.streakOutScale }] },
})
  .duration(durations.transition)
  .delay(spotlightCues.missStreak);

export function StreakChip({ count }: { count: number }) {
  const colors = useThemeColors();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    const half = durations.reveal / 2;
    scale.value = withDelay(
      spotlightCues.streak,
      withSequence(
        withTiming(spotlightMotion.streakPopScale, { duration: half }),
        withTiming(1, { duration: half }),
      ),
    );
  }, [count, reduced, scale]);

  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const flame = iconSize.flameGlyph;
  const styles = StyleSheet.create({
    chip: {
      height: sizes.topBar.pill,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxs,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      borderWidth: borderWidths.hairline,
      borderColor: colors.heatLine,
      backgroundColor: colors.heatBg,
    },
    // A teardrop: a square, fully rounded but for one corner, turned so the
    // sharp corner points up.
    flame: {
      width: flame,
      height: flame,
      borderRadius: flame / 2,
      borderTopRightRadius: 0,
      backgroundColor: colors.heat,
      transform: [{ rotate: '-45deg' }],
    },
    count: { ...typography.statMonoSmall, color: colors.heatText },
  });

  return (
    <Animated.View
      style={[styles.chip, pop]}
      entering={FadeIn.duration(durations.transition)}
      exiting={reduced ? FadeOut.duration(durations.transition) : exit}
      accessible
      accessibilityLabel={`Streak: ${count} in a row`}
    >
      <View style={styles.flame} />
      <Animated.Text
        key={count}
        entering={reduced ? undefined : FadeIn.duration(durations.reveal)}
        style={styles.count}
      >
        {count}
      </Animated.Text>
    </Animated.View>
  );
}
```

- [ ] **Step 4: `components/SlotChip.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Flag } from './Flag';
import { flagFor } from '@/lib/flags';
import { slotSpoken, type Slot, type SlotState } from '@/lib/roundView';
import {
  borderWidths,
  durations,
  radii,
  sizes,
  spacing,
  spotlightCues,
  spotlightMotion,
  typography,
  type Palette,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

function look(colors: Palette, state: SlotState): { line: string; text: string; dashed: boolean } {
  switch (state) {
    case 'active':
      return { line: colors.accentLine, text: colors.onStage, dashed: false };
    case 'pending':
      return { line: colors.chipPendingLine, text: colors.chipPendingText, dashed: true };
    case 'correct':
      return { line: colors.success, text: colors.stageSuccessText, dashed: false };
    case 'wrong':
      return { line: colors.error, text: colors.onStage, dashed: false };
    case 'notAsked':
      return { line: colors.chipLine, text: colors.chipPendingText, dashed: false };
    case 'given':
      return { line: colors.chipLine, text: colors.onStage, dashed: false };
  }
}

// One chip under the shirt number (spec §2.2).
// - A clue prints its value.
// - An asked part shows `?` while asked and `—` while it waits; it fills in
//   once answered (green outline when right; the right value with a red
//   outline when wrong).
// - After a miss, the later parts show their value, muted.
// A slot being asked carries no value at all (`slotStates`), so nothing here
// can show or speak the answer early.
export function SlotChip({ slot }: { slot: Slot }) {
  const colors = useThemeColors();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const previous = useRef(slot.state);

  // The next part's outline pulses as it becomes active (spec §6).
  useEffect(() => {
    const from = previous.current;
    previous.current = slot.state;
    if (reduced || slot.state !== 'active' || from === 'active') return;
    const half = durations.pulse / 2;
    scale.value = withSequence(
      withTiming(spotlightMotion.pulseScale, { duration: half }),
      withTiming(1, { duration: half }),
    );
  }, [slot.state, reduced, scale]);

  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const { line, text, dashed } = look(colors, slot.state);
  const shown = slot.value ?? (slot.state === 'active' ? '?' : '—');
  const flag = slot.key === 'NAT' && slot.value !== null ? flagFor(slot.value) : null;
  const settled = slot.state === 'correct' || slot.state === 'wrong';
  const styles = StyleSheet.create({
    chip: {
      height: sizes.slotChipHeight,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      borderWidth: borderWidths.thick,
      borderStyle: dashed ? 'dashed' : 'solid',
      borderColor: line,
      backgroundColor: colors.chipBg,
    },
    label: { ...typography.captionEyebrow, color: colors.onStageMuted },
    value: { ...typography.slotValue, color: text },
  });

  return (
    <Animated.View style={[styles.chip, pulse]} accessible accessibilityLabel={slotSpoken(slot)}>
      <Text style={styles.label}>{slot.key}</Text>
      {flag ? <Flag code={flag} size="inline" label={slot.value ?? ''} /> : null}
      <Animated.Text
        key={`${slot.state}:${shown}`}
        entering={
          settled
            ? FadeIn.duration(durations.reveal).delay(reduced ? 0 : spotlightCues.slot)
            : undefined
        }
        style={styles.value}
        numberOfLines={1}
      >
        {shown}
      </Animated.Text>
    </Animated.View>
  );
}
```

- [ ] **Step 5: `components/EscuadraCorner.tsx`**

```tsx
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  celebrationEasingCurves,
  durations,
  sizes,
  spotlightCues,
  spotlightMotion,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

export type CornerState = 'asking' | 'correct' | 'wrong';

// The escuadra corner at the shirt number's top right (spec §2.1, §6).
// - Asking: accent.
// - Right answer: green, and the ball drops into the corner.
// - Miss: red, and the ball hits the post and bounces out.
// Reduce Motion keeps the colours and shows the ball without movement.
export function EscuadraCorner({ state }: { state: CornerState }) {
  const colors = useThemeColors();
  const reduced = useReducedMotion();
  const { arm, bar, ball } = sizes.corner.question;
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const shown = useSharedValue(0);

  useEffect(() => {
    if (state === 'asking') {
      x.value = 0;
      y.value = 0;
      scale.value = 1;
      shown.value = 0;
      return;
    }
    if (reduced) {
      x.value = 0;
      y.value = 0;
      scale.value = 1;
      shown.value = state === 'correct' ? withTiming(1, { duration: durations.transition }) : 0;
      return;
    }
    const drop = spotlightMotion.ballDrop;
    if (state === 'correct') {
      const strike = Easing.bezier(...celebrationEasingCurves.strike);
      x.value = 0;
      y.value = -drop;
      scale.value = spotlightMotion.ballStartScale;
      shown.value = 0;
      y.value = withDelay(
        spotlightCues.ball,
        withTiming(0, { duration: durations.ballDrop, easing: strike }),
      );
      scale.value = withDelay(
        spotlightCues.ball,
        withTiming(1, { duration: durations.ballDrop, easing: strike }),
      );
      shown.value = withDelay(
        spotlightCues.ball,
        withTiming(1, { duration: durations.ballDrop / 2 }),
      );
      return;
    }
    // A miss: down onto the post, then off it, down and to the left, gone.
    const half = durations.ballBounce / 2;
    x.value = 0;
    y.value = -drop;
    scale.value = 1;
    shown.value = 1;
    y.value = withSequence(
      withTiming(0, { duration: half }),
      withTiming(drop * 2, { duration: half }),
    );
    x.value = withSequence(
      withTiming(0, { duration: half }),
      withTiming(-drop * 2, { duration: half }),
    );
    shown.value = withSequence(
      withTiming(1, { duration: half }),
      withTiming(0, { duration: half }),
    );
  }, [state, reduced, x, y, scale, shown]);

  const ballStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));
  const frame =
    state === 'correct' ? colors.success : state === 'wrong' ? colors.error : colors.accentLine;
  const styles = StyleSheet.create({
    corner: { position: 'absolute', top: 0, right: 0, width: arm, height: arm },
    crossbar: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: arm,
      height: bar,
      backgroundColor: frame,
    },
    post: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: bar,
      height: arm,
      backgroundColor: frame,
    },
    ball: {
      position: 'absolute',
      top: bar,
      right: bar + (arm - bar - ball) / 2,
      width: ball,
      height: ball,
      borderRadius: ball / 2,
      backgroundColor: state === 'wrong' ? colors.error : colors.success,
    },
  });

  return (
    <View
      pointerEvents="none"
      style={styles.corner}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.crossbar} />
      <View style={styles.post} />
      <Animated.View style={[styles.ball, ballStyle]} />
    </View>
  );
}
```

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck && npm run lint`. Expected: both pass. Nothing renders these components until Task 6.

```bash
npx prettier --write components/RoundProgress.tsx components/GlassCloseButton.tsx components/StreakChip.tsx components/SlotChip.tsx components/EscuadraCorner.tsx
git add components/RoundProgress.tsx components/GlassCloseButton.tsx components/StreakChip.tsx components/SlotChip.tsx components/EscuadraCorner.tsx
git commit -m "feat(play): top bar and hero parts — progress, close, streak, slot chip, escuadra corner

Co-Authored-By: <your model>"
```

---

### Task 4: Answer tiles and the grid

**Files:**

- Create: `components/AnswerTile.tsx`
- Create: `components/AnswerGrid.tsx`

**Interfaces:**

```ts
AnswerTile(props: { label: string; sub?: string; flag?: FlagCode | null; verdict: TileVerdict; pickedRight: boolean; height: number; onPress: () => void })
AnswerGrid(props: { part: QuestionPart; gridKey: string; answeredIndex: number | null; layout: AnswerLayout; stagger: number; onAnswer: (index: number) => void })
```

- [ ] **Step 1: `components/AnswerTile.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { EscuadraMark } from './EscuadraMark';
import { Flag } from './Flag';
import type { FlagCode } from '@/assets/flags/generated';
import { feedback } from '@/lib/haptics';
import type { TileVerdict } from '@/lib/roundView';
import {
  borderWidths,
  durations,
  iconSize,
  opacity,
  radii,
  spacing,
  spotlightCues,
  spotlightMotion,
  typography,
  type Palette,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface AnswerTileProps {
  label: string;
  /** Under a position tile's code: "Keeper", "Defender"… */
  sub?: string;
  /** Nationality tiles only (22×15). */
  flag?: FlagCode | null;
  verdict: TileVerdict;
  /** Whether this part's pick was right. After a right pick the other tiles
   *  fade to 50 %, after a miss to 35 % (spec §6). */
  pickedRight: boolean;
  height: number;
  onPress: () => void;
}

function look(colors: Palette, verdict: TileVerdict) {
  switch (verdict) {
    case 'correct-picked':
      return {
        bg: colors.stageSuccessBg,
        line: colors.success,
        width: borderWidths.emphasis,
        text: colors.textPrimary,
      };
    case 'correct-unpicked':
      return {
        bg: colors.stageAnswerBg,
        line: colors.success,
        width: borderWidths.emphasis,
        text: colors.textPrimary,
      };
    case 'incorrect-picked':
      return {
        bg: colors.stageErrorBg,
        line: colors.stageErrorLine,
        width: borderWidths.hairline,
        text: colors.stageErrorText,
      };
    case 'incorrect-other':
    case 'idle':
      return {
        bg: colors.tile,
        line: colors.tileLine,
        width: borderWidths.hairline,
        text: colors.textPrimary,
      };
  }
}

const SPOKEN: Record<TileVerdict, string> = {
  idle: '',
  'correct-picked': ', correct',
  'correct-unpicked': ', the right answer',
  'incorrect-picked': ', your pick, wrong',
  'incorrect-other': '',
};

// One answer (spec §2.3, §2.4, §6). It keeps today's five verdicts. The
// effects:
// - a press scales it slightly, with a light haptic;
// - a right pick fills green and pops;
// - a wrong pick turns red and shakes;
// - after a miss, the right answer pops with an ANSWER tag;
// - the rest fade.
// It plays the correct and wrong haptics itself, so every part at every
// level gets them. Reduce Motion keeps colour and opacity only.
export function AnswerTile({
  label,
  sub,
  flag,
  verdict,
  pickedRight,
  height,
  onPress,
}: AnswerTileProps) {
  const colors = useThemeColors();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const shift = useSharedValue(0);
  const fade = useSharedValue(1);
  const previous = useRef(verdict);
  const answered = verdict !== 'idle';

  useEffect(() => {
    const from = previous.current;
    previous.current = verdict;
    const target =
      verdict === 'incorrect-other'
        ? pickedRight
          ? opacity.tileAfterCorrect
          : opacity.tileAfterMiss
        : 1;
    fade.value = withTiming(target, {
      duration: reduced ? durations.transition : durations.reveal,
    });
    if (from !== 'idle' || verdict === 'idle') return;
    if (verdict === 'correct-picked') feedback('correct');
    if (verdict === 'incorrect-picked') feedback('wrong');
    if (reduced) return;
    if (verdict === 'correct-picked') {
      scale.value = withSequence(
        withTiming(spotlightMotion.popScale, {
          duration: durations.pop,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(1, { duration: durations.popSettle, easing: Easing.inOut(Easing.quad) }),
      );
    } else if (verdict === 'correct-unpicked') {
      scale.value = withDelay(
        spotlightCues.missAnswer,
        withSequence(
          withTiming(spotlightMotion.answerPopScale, { duration: durations.pop }),
          withTiming(1, { duration: durations.popSettle }),
        ),
      );
    } else if (verdict === 'incorrect-picked') {
      // Three swings of ±6 pt in the shake's 240 ms.
      const swing = durations.shake / 6;
      const { shake } = spotlightMotion;
      shift.value = withSequence(
        withTiming(shake, { duration: swing }),
        withTiming(-shake, { duration: swing }),
        withTiming(shake, { duration: swing }),
        withTiming(-shake, { duration: swing }),
        withTiming(shake, { duration: swing }),
        withTiming(0, { duration: swing }),
      );
    }
  }, [verdict, pickedRight, reduced, scale, shift, fade]);

  const motion = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: scale.value }, { translateX: shift.value }],
  }));
  const tone = look(colors, verdict);
  const isPosition = sub !== undefined;
  const strong = verdict === 'correct-picked' || verdict === 'correct-unpicked';
  const styles = StyleSheet.create({
    cell: { flex: 1 },
    tile: {
      height,
      borderRadius: radii.lg,
      borderWidth: tone.width,
      borderColor: tone.line,
      backgroundColor: tone.bg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: isPosition ? 'center' : 'space-between',
      gap: spacing.xs,
      paddingLeft: isPosition ? spacing.xs : spacing.md,
      paddingRight: isPosition ? spacing.xs : spacing.sm,
    },
    position: { alignItems: 'center', gap: spacing.xxs },
    code: { ...typography.tileCode, color: tone.text },
    sub: { ...typography.tileSubLabel, color: colors.tileSub },
    textBlock: { flex: 1, minWidth: 0 },
    tag: { ...typography.captionEyebrow, color: colors.success },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    label: {
      ...(strong ? typography.bodyStrong : typography.body),
      color: tone.text,
      flexShrink: 1,
    },
    cross: { width: iconSize.markSmall, height: iconSize.markSmall },
    bar: {
      position: 'absolute',
      top: iconSize.markSmall / 2 - borderWidths.thick,
      left: 0,
      width: iconSize.markSmall,
      height: borderWidths.thick * 2,
      borderRadius: borderWidths.thick,
      backgroundColor: colors.error,
    },
  });

  return (
    <Animated.View style={[styles.cell, motion]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          if (answered) return;
          feedback('tap');
          if (!reduced)
            scale.value = withTiming(spotlightMotion.pressScale, { duration: durations.press });
        }}
        onPressOut={() => {
          if (!reduced && !answered) scale.value = withTiming(1, { duration: durations.press });
        }}
        disabled={answered}
        accessibilityRole="button"
        accessibilityState={{ disabled: answered }}
        accessibilityLabel={`${label}${sub ? `, ${sub}` : ''}${SPOKEN[verdict]}`}
        style={styles.tile}
      >
        {isPosition ? (
          <View style={styles.position}>
            <Text style={styles.code}>{label}</Text>
            <Text style={styles.sub}>{sub}</Text>
          </View>
        ) : (
          <View style={styles.textBlock}>
            {verdict === 'correct-unpicked' ? (
              <Animated.Text
                entering={FadeIn.duration(durations.transition).delay(
                  reduced ? 0 : spotlightCues.missAnswer,
                )}
                style={styles.tag}
              >
                Answer
              </Animated.Text>
            ) : null}
            <View style={styles.labelRow}>
              {flag ? <Flag code={flag} size="marker" label={label} /> : null}
              <Text style={styles.label} numberOfLines={2}>
                {label}
              </Text>
            </View>
          </View>
        )}
        {verdict === 'correct-picked' && !isPosition ? (
          <EscuadraMark size={iconSize.markLarge} color={colors.success} />
        ) : null}
        {verdict === 'incorrect-picked' && !isPosition ? (
          <View style={styles.cross}>
            <View style={[styles.bar, { transform: [{ rotate: '45deg' }] }]} />
            <View style={[styles.bar, { transform: [{ rotate: '-45deg' }] }]} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}
```

- [ ] **Step 2: `components/AnswerGrid.tsx`**

```tsx
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Keyframe, useReducedMotion } from 'react-native-reanimated';
import { AnswerTile } from './AnswerTile';
import type { FlagCode } from '@/assets/flags/generated';
import { flagFor } from '@/lib/flags';
import type { QuestionPart } from '@/lib/questionEngine';
import { positionLabel, tileVerdict, type AnswerLayout } from '@/lib/roundView';
import { durations, spacing, spotlightMotion } from '@/theme/tokens';

interface AnswerGridProps {
  part: QuestionPart;
  /** Changes per question and part, so the grid remounts. The old tiles fade
   *  out and the new ones rise in, one after another (spec §6). */
  gridKey: string;
  answeredIndex: number | null;
  layout: AnswerLayout;
  /** Delay between tiles rising in: `durations.tileStagger` for a new
   *  question, `durations.partStagger` for the next part. */
  stagger: number;
  onAnswer: (index: number) => void;
}

interface TileModel {
  index: number;
  label: string;
  sub: string | undefined;
  flag: FlagCode | null | undefined;
}

function rising(reduced: boolean, delay: number) {
  if (reduced) return FadeIn.duration(durations.transition);
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: spotlightMotion.rise }] },
    100: { opacity: 1, transform: [{ translateY: 0 }] },
  })
    .duration(durations.transition)
    .delay(delay);
}

// The answers, as a grid (spec §2.3): two columns for names, clubs and
// nationalities, four for positions. Its height is fixed by `answerLayout`.
export function AnswerGrid({
  part,
  gridKey,
  answeredIndex,
  layout,
  stagger,
  onAnswer,
}: AnswerGridProps) {
  const reduced = useReducedMotion();
  const tiles: TileModel[] =
    part.kind === 'position'
      ? part.options.map((option, index) => ({
          index,
          label: option,
          sub: positionLabel(option),
          flag: undefined,
        }))
      : part.options.map((option, index) => ({
          index,
          label: option,
          sub: undefined,
          flag: part.kind === 'nationality' ? flagFor(option) : undefined,
        }));
  const rows: TileModel[][] = [];
  for (const tile of tiles) {
    const r = Math.floor(tile.index / layout.columns);
    (rows[r] ??= []).push(tile);
  }
  const pickedRight = answeredIndex === part.correctIndex;

  return (
    <Animated.View key={gridKey} exiting={FadeOut.duration(durations.partOut)} style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((tile) => (
            <Animated.View
              key={tile.label}
              style={styles.cell}
              entering={rising(reduced, tile.index * stagger)}
            >
              <AnswerTile
                label={tile.label}
                sub={tile.sub}
                flag={tile.flag}
                verdict={tileVerdict(part, answeredIndex, tile.index)}
                pickedRight={pickedRight}
                height={layout.tileHeight}
                onPress={() => onAnswer(tile.index)}
              />
            </Animated.View>
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.xs },
  cell: { flex: 1 },
});
```

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck && npm run lint && npx vitest run lib/hapticPlan.test.ts`. Expected: all pass. The importer guard must still see only `lib/haptics.ts`.

```bash
npx prettier --write components/AnswerTile.tsx components/AnswerGrid.tsx
git add components/AnswerTile.tsx components/AnswerGrid.tsx
git commit -m "feat(play): answer tiles and grid — five verdicts, pop, shake, fade, haptics on every part

Co-Authored-By: <your model>"
```

---

### Task 5: The stage, the footer and the screen-reader hook

**Files:**

- Create: `components/SpotlightStage.tsx`
- Create: `components/QuestionFooter.tsx`
- Create: `components/useScreenReader.ts`

**Interfaces:**

```ts
SpotlightStage(props: { height: number; photo: PhotoCredit | null; marker: TeamMarker; dimmed: boolean })
QuestionFooter(props: { mode: FooterMode; compact: boolean; onNext: () => void; credit: PhotoCredit | null })
useScreenReader(): boolean
```

- [ ] **Step 1: `components/useScreenReader.ts`**

```ts
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Whether VoiceOver or TalkBack is on. The question screen never moves on
 *  by itself while it is (spec §2.4). False on web, and until the first
 *  answer arrives. */
export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (live) setOn(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return on;
}
```

- [ ] **Step 2: `components/SpotlightStage.tsx`**

```tsx
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { bannerBands, photoLayout, stageVeil } from '@/lib/stageView';
import { durations, opacity, spotlightCues, stage } from '@/theme/tokens';
import { useThemeColors, useThemeName } from '@/theme/useTheme';
import type { PhotoCredit, TeamMarker } from '@/types/squad';

interface SpotlightStageProps {
  /** The stage's height: the top 68 % (72 % compact) of the window. */
  height: number;
  photo: PhotoCredit | null;
  marker: TeamMarker;
  /** A miss dims the photo 10 % (spec §6). */
  dimmed: boolean;
}

// The photo stage behind the question (spec §2.6), in layers, bottom to top:
// 1. The team's own colours, as the in-round banner's vertical bands, under
//    a veil strong enough for white text. They show while a photo loads,
//    when there is none, and offline. Never a flag image.
// 2. A diagonal shimmer while the photo loads.
// 3. The photo, cross-fading in: filled when served at least 720 px wide,
//    otherwise framed whole over its own darkened copy.
// 4. The miss dim.
// Decorative: hidden from screen readers. The credit is the footer's.
export function SpotlightStage({ height, photo, marker, dimmed }: SpotlightStageProps) {
  const colors = useThemeColors();
  const themeName = useThemeName();
  const reduced = useReducedMotion();
  const bands = bannerBands(marker);
  const veil = stageVeil(bands, themeName);
  const url = photo?.url ?? null;
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const loading = url !== null && loaded !== url && failed !== url;
  const layout = photo ? photoLayout(photo) : null;

  const dim = useSharedValue(0);
  useEffect(() => {
    dim.value = dimmed
      ? withDelay(
          reduced ? 0 : spotlightCues.missDim,
          withTiming(stage.missDim, { duration: durations.reveal }),
        )
      : 0;
  }, [dimmed, reduced, dim]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  const onLoad = () => setLoaded(url);
  const onError = () => setFailed(url);
  const styles = StyleSheet.create({
    stage: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height,
      overflow: 'hidden',
      backgroundColor: colors.background,
    },
    bands: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
    veil: { ...StyleSheet.absoluteFill, backgroundColor: colors.veilInk, opacity: veil },
    frameDim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.veilInk,
      opacity: stage.frameDim,
    },
    frameBox: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: stage.frame.bottom,
      alignItems: 'center',
      justifyContent: 'center',
    },
    frameImage: { height: stage.frame.height, aspectRatio: stage.frame.aspect },
    dim: { ...StyleSheet.absoluteFill, backgroundColor: colors.veilInk },
  });

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.stage}
    >
      <View style={styles.bands}>
        {bands.map((band, i) => (
          <View key={i} style={{ flex: band.weight, backgroundColor: band.color }} />
        ))}
      </View>
      <View style={styles.veil} />
      {loading ? <Shimmer reduced={reduced} /> : null}
      {photo && layout !== null ? (
        <Image
          source={{ uri: photo.url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={stage.focal}
          transition={durations.reveal}
          cachePolicy="disk"
          onLoad={onLoad}
          onError={onError}
        />
      ) : null}
      {photo && layout === 'frame' && loaded === photo.url ? (
        <>
          <View style={styles.frameDim} />
          <View style={styles.frameBox}>
            <Image
              source={{ uri: photo.url }}
              style={styles.frameImage}
              contentFit="contain"
              cachePolicy="disk"
            />
          </View>
        </>
      ) : null}
      <Animated.View style={[styles.dim, dimStyle]} />
    </View>
  );
}

// A soft diagonal band sweeping across while the photo loads. With Reduce
// Motion it holds still, faint.
function Shimmer({ reduced }: { reduced: boolean }) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(-1);
  useEffect(() => {
    if (reduced) return;
    sweep.value = withRepeat(
      withTiming(1, { duration: durations.skeleton, easing: Easing.inOut(Easing.quad) }),
      -1,
    );
  }, [reduced, sweep]);
  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: sweep.value * width }] }));
  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View
        style={[StyleSheet.absoluteFill, reduced ? { opacity: opacity.faded } : moving]}
      >
        <LinearGradient
          colors={[colors.stageShimmerEdge, colors.stageShimmer, colors.stageShimmerEdge]}
          locations={stage.shimmer.locations}
          start={stage.shimmer.start}
          end={stage.shimmer.end}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}
```

`stage.focal` holds percent strings. If expo-image's `contentPosition` type rejects the `as const` literal object, pass `{ top: stage.focal.top, left: stage.focal.left }`. Do not cast it away.

- [ ] **Step 3: `components/QuestionFooter.tsx`**

```tsx
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  Keyframe,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PhotoCreditLine } from './PhotoCreditLine';
import type { FooterMode } from '@/lib/roundView';
import {
  borderWidths,
  durations,
  opacity,
  radii,
  sizes,
  spacing,
  spotlightCues,
  spotlightMotion,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import type { PhotoCredit } from '@/types/squad';

interface QuestionFooterProps {
  mode: FooterMode;
  compact: boolean;
  onNext: () => void;
  /** The current question's photo credit, shown for the whole question
   *  (spec §2.7, guardrail 1). */
  credit: PhotoCredit | null;
}

function risingCta(reduced: boolean) {
  if (reduced) return FadeIn.duration(durations.transition);
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: spotlightMotion.rise }] },
    100: { opacity: 1, transform: [{ translateY: 0 }] },
  })
    .duration(durations.toggle)
    .delay(spotlightCues.missCta);
}

// Under the answers (spec §2.1, §2.4):
// - before a tap, a quiet "Tap your answer";
// - after a miss, "Got it — next", which waits;
// - after a right answer, a bar that fills and moves on by itself (tap to
//   skip), or a plain "Next question" with a screen reader on.
// Then the photo credit, always.
export function QuestionFooter({ mode, compact, onNext, credit }: QuestionFooterProps) {
  const colors = useThemeColors();
  const reduced = useReducedMotion();
  const height = compact ? sizes.cta.compact : sizes.cta.normal;
  const styles = StyleSheet.create({
    footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    hint: { height, alignItems: 'center', justifyContent: 'center' },
    hintText: { ...typography.secondary, color: colors.textMuted },
    cta: {
      height,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.ctaBg,
    },
    ctaText: { ...typography.ctaLabel, color: colors.ctaText },
  });

  return (
    <View style={styles.footer}>
      {mode === 'waiting' ? (
        <View style={styles.hint}>
          <Text style={styles.hintText}>Tap your answer</Text>
        </View>
      ) : null}
      {mode === 'gotIt' || mode === 'next' ? (
        <Animated.View
          entering={mode === 'gotIt' ? risingCta(reduced) : FadeIn.duration(durations.transition)}
        >
          <Pressable
            testID="question-next"
            onPress={onNext}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && { opacity: opacity.settled }]}
          >
            <Text style={styles.ctaText}>
              {mode === 'gotIt' ? 'Got it — next' : 'Next question'}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
      {mode === 'autoNext' ? <NextBar height={height} onNext={onNext} /> : null}
      <PhotoCreditLine credit={credit} />
    </View>
  );
}

// Fills over `durations.autoAdvance`. The screen moves on when it is full;
// a tap moves on now.
function NextBar({ height, onNext }: { height: number; onNext: () => void }) {
  const colors = useThemeColors();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: durations.autoAdvance, easing: Easing.linear });
  }, [progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as `${number}%` }));
  const styles = StyleSheet.create({
    bar: {
      height,
      borderRadius: radii.pill,
      borderWidth: borderWidths.hairline,
      borderColor: colors.nextLine,
      backgroundColor: colors.nextBg,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    fill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.nextFill },
    label: { ...typography.rowTitle, color: colors.nextText },
  });
  return (
    <Pressable
      testID="question-next"
      onPress={onNext}
      accessibilityRole="button"
      accessibilityLabel="Next question"
      accessibilityHint="Moves on by itself in a moment"
      style={styles.bar}
    >
      <Animated.View style={[styles.fill, fill]} />
      <Text style={styles.label}>Next question · tap to skip</Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck && npm run lint`. Expected: pass.

```bash
npx prettier --write components/SpotlightStage.tsx components/QuestionFooter.tsx components/useScreenReader.ts
git add components/SpotlightStage.tsx components/QuestionFooter.tsx components/useScreenReader.ts
git commit -m "feat(play): spotlight stage, question footer and the screen-reader hook

Co-Authored-By: <your model>"
```

---

### Task 6: The screen

**Files:**

- Rewrite: `app/play/[squadId]/[level]/index.tsx`
- Modify: `scripts/capture-screens.mjs` (the answer flow's "next" control)

**Interfaces:**

- **Consumes:**
  - Task 3: `RoundProgress`, `GlassCloseButton`, `StreakChip`, `SlotChip`, `EscuadraCorner`, `CornerState`
  - Task 4: `AnswerGrid`
  - Task 5: `SpotlightStage`, `QuestionFooter`, `useScreenReader`
  - Task 2: `footerMode`, `streakMilestone`, `roundPhotoUrls`
  - part 1: `slotStates`, `answerLayout`, `isCompact`, `streak`, `promptText`, `partCounter`, `progressOutcomes`

- [ ] **Step 1: Rewrite the screen**

Replace the whole of `app/play/[squadId]/[level]/index.tsx` with:

```tsx
import { AnswerGrid } from '@/components/AnswerGrid';
import { EscuadraCorner, type CornerState } from '@/components/EscuadraCorner';
import { GlassCloseButton } from '@/components/GlassCloseButton';
import { QuestionFooter } from '@/components/QuestionFooter';
import { RoundProgress } from '@/components/RoundProgress';
import { SlotChip } from '@/components/SlotChip';
import { SpotlightStage } from '@/components/SpotlightStage';
import { StreakChip } from '@/components/StreakChip';
import { TeamMarker } from '@/components/TeamMarker';
import { useScreenReader } from '@/components/useScreenReader';
import { feedback } from '@/lib/haptics';
import { photoFor, roundPhotoUrls } from '@/lib/photos';
import type { Level } from '@/lib/questionEngine';
import { isFlawless } from '@/lib/resultsView';
import {
  answerLayout,
  footerMode,
  isCompact,
  partCounter,
  progressOutcomes,
  promptText,
  slotStates,
  streak,
  streakMilestone,
} from '@/lib/roundView';
import { getPlayer, getRoster, getSquad } from '@/lib/squads';
import { track } from '@/lib/telemetry';
import { useProgress } from '@/stores/progress';
import { selectScore, useSession } from '@/stores/session';
import {
  borderWidths,
  durations,
  radii,
  sizes,
  spacing,
  spotlightMotion,
  stageGradients,
  typography,
} from '@/theme/tokens';
import { useThemeColors, useThemeName } from '@/theme/useTheme';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Keyframe, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';

// The Spotlight question screen (spec §2). Its layers, back to front:
// - the photo stage;
// - the stage gradient over the whole window;
// - a column: progress, top bar, and, in a scroll, the hero (number, corner,
//   slots), the prompt, the answers and the footer.
// The scroll is bottom-aligned, so it never moves when everything fits (every
// level at 360×640). It only scrolls at large text sizes (SCREENS.md
// invariant 6).
export default function Question() {
  const insets = useSafeAreaInsets();
  // The provider's frame, not `useWindowDimensions`: on edge-to-edge Android
  // the window's treatment of the system bars varies by OS version.
  const frame = useSafeAreaFrame();
  const colors = useThemeColors();
  const themeName = useThemeName();
  const reduced = useReducedMotion();
  const screenReader = useScreenReader();
  const {
    squadId,
    level: levelParam,
    seed: seedParam,
  } = useLocalSearchParams<{ squadId: string; level: string; seed?: string }>();
  const level = Number(levelParam) as Level;
  // Optional `?seed=` makes a round reproducible, for the screenshot capture.
  const seed = seedParam === undefined ? undefined : Number(seedParam);
  const compact = isCompact(frame.height - insets.top - insets.bottom);
  const stageHeight = Math.round(
    frame.height * (compact ? sizes.stage.ratioCompact : sizes.stage.ratio),
  );

  const session = useSession();
  const setLastPlayed = useProgress((s) => s.setLastPlayed);
  const recordScore = useProgress((s) => s.recordScore);
  const squad = getSquad(squadId);

  useEffect(() => {
    if (!squad) return;
    if (session.squadId !== squadId || session.level !== level || session.phase === 'idle') {
      session.startRound(
        squad,
        getRoster(squadId),
        level,
        Number.isFinite(seed) ? seed : undefined,
      );
      track('round.started', { kind: squad.kind, level });
    }
    setLastPlayed(squadId, level);
    // Only when the route target changes: starting a round mutates `session`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squadId, level, seedParam]);

  useEffect(() => {
    if (session.phase === 'complete' && session.squadId === squadId && session.level === level) {
      const score = selectScore(session.results);
      recordScore(squadId, level, score.correct);
      if (squad) {
        track('round.completed', {
          kind: squad.kind,
          level,
          score: score.correct,
          aLaEscuadra: isFlawless(score.correct, score.attempted),
        });
      }
      router.replace({
        pathname: '/play/[squadId]/[level]/results',
        params: { squadId, level: levelParam },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase]);

  // A round's photos are fetched when it starts (spec §9), so no question
  // waits on its photo. The result is ignored: it is false as soon as one
  // fails, and a failure only means the team colours show a moment longer.
  useEffect(() => {
    if (session.squadId !== squadId || session.questions.length === 0) return;
    const urls = roundPhotoUrls(session.questions, getPlayer);
    if (urls.length > 0) Image.prefetch(urls, { cachePolicy: 'disk' }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.questions]);

  const verdict = session.results[session.currentIndex]?.correct ?? null;

  // A right answer moves on after `durations.autoAdvance`; a miss waits for
  // its button; with a screen reader on nothing moves on by itself (§2.4).
  useEffect(() => {
    if (verdict !== true || screenReader) return;
    const timer = setTimeout(() => useSession.getState().advanceQuestion(), durations.autoAdvance);
    return () => clearTimeout(timer);
  }, [verdict, screenReader, session.currentIndex]);

  const currentStreak = streak(session.results, session.currentIndex);
  const previousStreak = useRef(currentStreak);
  useEffect(() => {
    if (streakMilestone(previousStreak.current, currentStreak)) feedback('streak');
    previousStreak.current = currentStreak;
  }, [currentStreak]);

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    column: { flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom },
    topBar: {
      height: sizes.topBar.height,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    team: { flex: 1, minWidth: 0, gap: spacing.xxs },
    teamName: { ...typography.topBarTeam, color: colors.onPhoto },
    teamSub: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    level: { ...typography.filterLabel, color: colors.onPhotoMuted },
    scorePill: {
      height: sizes.topBar.pill,
      minWidth: sizes.topBar.pillMinWidth,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      borderWidth: borderWidths.hairline,
      borderColor: colors.glassLine,
      backgroundColor: colors.glass,
      alignItems: 'center',
      justifyContent: 'center',
    },
    score: { ...typography.statMonoSmall, color: colors.onPhoto },
    scroll: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'flex-end', paddingBottom: spacing.xxs },
    hero: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    numberWrap: {
      alignSelf: 'flex-start',
      paddingRight: sizes.corner.question.arm + sizes.corner.question.bar,
    },
    number: {
      ...(compact ? typography.shirtNumberCompact : typography.shirtNumber),
      color: colors.onStage,
    },
    slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    promptRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    counter: { ...typography.statMonoTiny, color: colors.onStageMuted },
  });

  if (
    !squad ||
    session.phase !== 'playing' ||
    session.squadId !== squadId ||
    session.level !== level
  )
    return null;

  const question = session.questions[session.currentIndex];
  const result = session.results[session.currentIndex];
  if (!question || !result) return null;
  const part = question.parts[session.currentPartIndex];
  if (!part) return null;

  const score = selectScore(session.results);
  const photo = photoFor(getPlayer(question.playerId));
  const slots = slotStates(question, result, session.currentPartIndex, squad.kind, level);
  const answeredIndex = result.parts[session.currentPartIndex]?.pickedIndex ?? null;
  const counter = partCounter(question, session.currentPartIndex);
  const corner: CornerState = verdict === true ? 'correct' : verdict === false ? 'wrong' : 'asking';
  const promptColor =
    verdict === true ? colors.success : verdict === false ? colors.error : colors.onStage;

  const exit = () => {
    session.reset();
    router.back();
  };
  const next = () => session.advanceQuestion();

  const heroEntering = reduced
    ? FadeIn.duration(durations.transition)
    : new Keyframe({
        0: { opacity: 0, transform: [{ translateY: spotlightMotion.numberRise }] },
        100: { opacity: 1, transform: [{ translateY: 0 }] },
      }).duration(durations.transition);
  const heroExiting = reduced
    ? FadeOut.duration(durations.transition)
    : new Keyframe({
        0: { opacity: 1, transform: [{ translateX: 0 }] },
        100: { opacity: 0, transform: [{ translateX: -spotlightMotion.slide }] },
      }).duration(durations.transition);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SpotlightStage
        height={stageHeight}
        photo={photo}
        marker={squad.marker}
        dimmed={verdict === false}
      />
      <LinearGradient
        colors={stageGradients[themeName].colors}
        locations={stageGradients[themeName].locations}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.column}>
        <RoundProgress outcomes={progressOutcomes(session.results, session.currentIndex)} />
        <View style={styles.topBar}>
          <GlassCloseButton label="Leave the round" onPress={exit} />
          <View style={styles.team}>
            <Text style={styles.teamName} numberOfLines={1}>
              {squad.name}
            </Text>
            <View style={styles.teamSub}>
              <TeamMarker marker={squad.marker} variant="banner" />
              <Text style={styles.level}>Level {level}</Text>
            </View>
          </View>
          {currentStreak >= 2 ? <StreakChip count={currentStreak} /> : null}
          <View
            style={styles.scorePill}
            accessible
            accessibilityLabel={`Score: ${score.correct} of ${score.attempted}`}
          >
            <Text style={styles.score}>
              {score.correct}/{score.attempted}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            key={session.currentIndex}
            entering={heroEntering}
            exiting={heroExiting}
            style={styles.hero}
          >
            <View style={styles.numberWrap}>
              <Text style={styles.number} accessibilityLabel={`Shirt number ${question.memberNo}`}>
                {question.memberNo}
              </Text>
              <EscuadraCorner state={corner} />
            </View>
            <View style={styles.slots}>
              {slots.map((slot) => (
                <SlotChip key={slot.key} slot={slot} />
              ))}
            </View>
          </Animated.View>

          <View style={styles.promptRow}>
            <Text
              style={[
                compact ? typography.promptCompact : typography.prompt,
                { color: promptColor },
              ]}
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
            >
              {promptText(part, question.memberNo, verdict)}
            </Text>
            {counter ? <Text style={styles.counter}>{counter}</Text> : null}
          </View>

          <AnswerGrid
            part={part}
            gridKey={`${session.currentIndex}:${session.currentPartIndex}`}
            answeredIndex={answeredIndex}
            layout={answerLayout(part, compact)}
            stagger={session.currentPartIndex === 0 ? durations.tileStagger : durations.partStagger}
            onAnswer={(pickedIndex) => session.answerPart(pickedIndex)}
          />

          <QuestionFooter
            mode={footerMode(verdict, screenReader)}
            compact={compact}
            onNext={next}
            credit={photo}
          />
        </ScrollView>
      </View>
    </View>
  );
}
```

The previous file's `QuestionPartView`, `verdictForOption` and `OptionVerdict` go with the rewrite.

- [ ] **Step 2: Update the screenshot script's answer flow**

In `scripts/capture-screens.mjs`:

1. **Add `tapNext`.** After the `tapPrimaryButton` method, add:

```js
    /**
     * Tap the question's "next" control: the auto-next bar after a right
     * answer, or "Got it — next" after a miss. The bar moves on by itself
     * after `durations.autoAdvance` (1,200 ms), so callers tap within it.
     */
    async tapNext({ wait = REVEAL_MS } = {}) {
      capture.assertLive();
      await page.getByTestId('question-next').click();
      await page.waitForTimeout(wait);
    },
```

2. **Use it in `captureResults`.** Replace the loop body

```js
await capture.tap(label);
await capture.tapPrimaryButton();
```

with

```js
// Short wait: a right answer moves on by itself after 1,200 ms, so the
// next control is tapped well within it.
await capture.tap(label, { wait: TAP_TO_NEXT_MS });
await capture.tapNext();
```

3. **Add the constant,** after `const SWAP_MS = 400;`:

```js
// Between an answer and tapping its "next" control. Well inside the question
// screen's 1,200 ms auto-advance, so the tap always lands on this question.
const TAP_TO_NEXT_MS = 250;
```

4. **Update the comments.** The comment above `captureResults` mentions the disabled "Select an answer" placeholder and Continue. Make it say: each question is one answer tap plus its next control.

`tapPrimaryButton` stays: other captures may use it. If nothing uses it any more, remove it.

- [ ] **Step 3: Run it on the web**

```bash
npx expo start --web --port 8086
```

Run this in the background, and open `/play/esp/1?seed=20260821`, `/play/esp/3?seed=20260821` and `/play/bar/3?seed=20260832` with Playwright. Check, at least:

- the photo stage, gradient, top bar, slots, prompt, grid and footer render;
- tapping a wrong answer shows red, then "Got it — next";
- tapping a right answer auto-advances after about 1.2 s;
- on L3, the parts advance in place, and the slots fill.

Write any helper script in the SDD workspace, never /tmp.

- [ ] **Step 4: The fit check**

The spec requires every level and part to fit without scrolling at 360×640 (insets 24/16) and 375×667 (20/0). Web has no insets, so check at **360×600** and **375×647**.

Write a Playwright script in the SDD workspace that, for each of those viewports, opens:

- `/play/esp/1?seed=20260821` (4 names);
- `/play/esp/3?seed=20260821`: 6 names, then tap `Ferran Torres` for positions, then tap `FW` for clubs;
- `/play/bar/3?seed=20260832`: tap `Lamine Yamal`, then `FW`, for nationalities.

At each state, find every element whose computed `overflow-y` is `auto` or `scroll` and assert `scrollHeight - clientHeight <= 1`. Also assert the `question-next` control or the "Tap your answer" text is fully inside the viewport.

Record the script and its output in your report. If anything overflows, report it with the measured overflow; do not resize tokens yourself.

- [ ] **Step 5: Verify and commit**

```bash
npx prettier --write "app/play/[squadId]/[level]/index.tsx" scripts/capture-screens.mjs
npm run typecheck && npm run lint && npx vitest run
git add "app/play/[squadId]/[level]/index.tsx" scripts/capture-screens.mjs
git commit -m "feat(play): the Spotlight question screen

The photo fills the top; number, slots, prompt, answers and footer sit in
the thumb zone. A right answer moves on after 1.2 s (never with a screen
reader on); a miss waits. The round's ten photos load when it starts.

Co-Authored-By: <your model>"
```

---

### Task 7: Remove the old hero screen's parts

**Files:**

- Delete:
  - `components/HeroCard.tsx`, `components/HeroTabFillet.tsx`
  - `components/PartRail.tsx`, `components/CompletedPartPill.tsx`
  - `components/ProgressDots.tsx`, `components/StatChip.tsx`
  - `components/AnswerOption.tsx`, `components/ChipOption.tsx`
  - `components/ScorePill.tsx`, `components/Skeleton.tsx`, but only for each file that nothing else imports (check with grep first)
- Modify: `lib/roundView.ts` (remove `fitHeroCard`, `HeroCardFit`, `heroTabMetrics`, `HeroTabMetrics`, `partRailRows`, `PartRailRow`, `PartState`, and the `partLabel` helper if unused) and `lib/roundView.test.ts`
- Modify: `stores/session.test.ts` (it uses `partRailRows`)
- Modify: `theme/tokens.ts`. Remove:
  - `heroCardSize`, `heroNumberSize`, `heroFitHeight`, `heroCardMinSize`, `heroTab`
  - `typography.heroNumber`
  - `sizes.progressDot`, `opacity.dotPast`, `opacity.dotFuture`
  - any other token whose last user was a deleted file (grep each)

  `typography.scoreHero` stays: Results uses it until #114.

- [ ] **Step 1: Find the dead code**

For each file and export above, run `grep -rn "<name>" app components lib stores theme scripts design types`. Delete only what nothing outside the deleted set imports.

`stores/session.test.ts`'s `partRailRows` assertions protect invariants 7 and 8 at the store level. Rewrite them to assert the same facts through `slotStates`, so the invariant tests survive:

- after a wrong part, the later slots are `notAsked`;
- no slot is `correct` unless it was answered right.

- [ ] **Step 2: Verify and commit**

Run: `npm run typecheck && npm run lint && npx vitest run`. Expected: all pass, with fewer tests (the deleted helpers' tests go with them), and the invariant tests ported.

```bash
git add -A components lib stores theme
git commit -m "refactor(play): remove the hero question screen's components, helpers and tokens

Co-Authored-By: <your model>"
```

Run `git status` before `git add -A`, and stage only the intended deletions and edits.

---

### Task 8: About text, guardrails, SCREENS.md and screenshots

**Files:**

- Modify: `app/about.tsx` (the "Player photos" paragraphs)
- Modify: `CLAUDE.md` (guardrail 1)
- Modify: `design/SCREENS.md` (invariants 1 and 6, screen 6, the question captures' descriptions)
- Regenerate: `design/screens/*.png`

- [ ] **Step 1: About, "Player photos" (spec §10.1, guardrail 4)**

The first paragraph becomes the following. Keep the file's JSX entities (`&apos;`) and wrapping.

> Escuadra does not ship player photos. They are loaded from Wikimedia Commons, run by the Wikimedia Foundation: the ten photos for a round when the round starts. Like any website, Wikimedia receives your device's IP address and the details of each request, including which photos were asked for, and so which players are in your round. Escuadra sends nothing else to Wikimedia, and Wikimedia's own privacy policy applies to what it receives.

#115 will add Study's clause.

In the second paragraph, "shows the shirt number instead of a photo" becomes "shows the team's colours and the shirt number instead of a photo".

- [ ] **Step 2: CLAUDE.md guardrail 1**

Replace the sentence "A photo fills the question hero and the shirt number moves to a corner tab; with no photo, or until it loads, the number card shows." with:

> The photo fills the top of the question screen behind the shirt number; with no photo, or while it loads, the team's colours and the number show.

Change nothing else in the guardrail.

- [ ] **Step 3: `design/SCREENS.md`**

- **Invariant 1:** "Player photos fill the top of the question screen, behind the shirt number…". With no photo, the team's colours and the number show. Keep the credit sentence: muted text under the action button, always visible, and listed on Results.
- **Invariant 6** becomes: "**Every part fits without scrolling at 360×640.** A scroll remains for large text sizes, so no option is ever out of reach."
- **Screen 6's purpose:** "A question. The photo (or the team's colours) fills the top; the shirt number with the escuadra corner, the slot chips that spell out the player, the prompt, a grid of answers and the footer sit in the thumb zone. A right answer moves on by itself; a miss waits."
- **The Captures section:** update the descriptions of `06-question-l1`, `07-question-l2`, `08-question-l3` and `08-question-l3-nationality` so they describe the new screen.

- [ ] **Step 4: Capture and check**

Run `npm run shots` with a long timeout. Expected:

- it exits 0;
- the 8 question captures change;
- the Results captures may change too, since their round is now played through the new screen;
- nothing else changes.

View `06-question-l1.png`, `07-question-l2.png`, `08-question-l3-nationality-light.png` and one Results capture with the Read tool. Describe in the report what each shows.

Then run `npm run check`. Expected: it passes.

- [ ] **Step 5: Commit**

```bash
npx prettier --write app/about.tsx CLAUDE.md design/SCREENS.md
git add app/about.tsx CLAUDE.md design/SCREENS.md design/screens
git commit -m "docs(play): About photo text, guardrail 1 and SCREENS.md for the Spotlight screen; regenerate screens

Co-Authored-By: <your model>"
```

The controller opens the PR, with `Closes #113`.
