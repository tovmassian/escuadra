# Reset progress (#197) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three ways to erase what Escuadra keeps on the phone: start one team over (Difficulty), clear all scores and reset Escuadra (Settings, Your data), each confirmed in a sheet.

**Architecture:** Pure helpers in `lib/reset.ts` (unit-tested) count and filter best scores. `stores/progress.ts` gains `resetSquad` and `factoryReset` beside the existing `reset()`, all built from one `INITIAL` data object so a factory reset cannot miss a field. One presentational `ResetSheet` draws all three confirmations. Difficulty pins Study and the source line to the bottom with a round eraser button beside Study; Settings gains a YOUR DATA section.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router, expo-image 57 (`Image.clearDiskCache`, `Image.clearMemoryCache`), expo-crypto, expo-linear-gradient, Zustand 5 with AsyncStorage persist, Vitest (node env).

**Spec:** `docs/superpowers/specs/2026-10-23-reset-progress-design.md`. Read it first. Canvas: https://claude.ai/artifact/G6hYVuKXgqiQ1qxUbN5oCh (six artboards, dark only).

## Global Constraints

- Node 24: `nvm use` once per shell. The worktree needs its own `npm ci` before the first test run. Run `npm run check` before reporting a task done; report its real output.
- No hard-coded colour, spacing or font size (guardrail 5): every value from `theme/tokens.ts`, colour from `useThemeColors()` inside the component, never a module-scope `StyleSheet` with colours. A new palette role goes in both `palettes.dark` and `palettes.light`.
- Every user-visible string in `i18n/en.ts`, read with `useT()`; `npm run lint` fails a literal in `app/` or `components/` JSX. A `≤ N chars` comment in `en.ts` is mirrored in `i18n/budgets.ts`, in file order.
- Translations follow France usage for `fr`; each new or changed translation gets a fresh native-speaker review until clean.
- TypeScript strict with `noUncheckedIndexedAccess`; never loosen it.
- Tests live in a `__tests__/` folder beside the code. No React Native renderer: components are checked by `npm run shots` and on a device, logic by Vitest.
- Animations under 300 ms; the sheet uses `Sheet`'s own timing.
- Nothing new leaves the device: no telemetry event or property, no network call. A reset sends nothing.
- Never touch `package.json`, `app.json`, `eas.json` or `.gitignore`.
- Owner decisions, fixed: Start over keeps `lastPlayed` and the star; a reset never turns usage statistics back on; `reviewAskedVersion` survives every reset; Reset Escuadra clears `tipsSeen` and `tipsSkipped`, so every How to play shows again.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, conventional prefix, `(#197)` in the subject.

---

### Task 1: Pure reset helpers

**Files:**

- Create: `lib/reset.ts`
- Test: `lib/__tests__/reset.test.ts`

**Interfaces:**

- Consumes: `BestScore` from `lib/bestScore.ts` (`{ score: number; squadUpdated: string }`); score keys are `${squadId}:${level}` (`scoreKey` in `lib/scoring.ts`).
- Produces (used by Tasks 2, 7, 8):
  - `withoutSquad(bestScores: Record<string, BestScore>, squadId: string): Record<string, BestScore>`
  - `squadScores(bestScores: Record<string, BestScore>, squadId: string): { level: number; score: number }[]` (ascending level)
  - `scoreSummary(bestScores: Record<string, BestScore>): { scores: number; teams: number }`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/__tests__/reset.test.ts
import { describe, expect, it } from 'vitest';
import { scoreSummary, squadScores, withoutSquad } from '@/lib/reset';

const at = (score: number) => ({ score, squadUpdated: '2026-10-01' });
const bests = {
  'arm:1': at(10),
  'arm:3': at(6),
  'arm:2': at(8),
  'ars:1': at(7),
  'arsenal-women:1': at(5),
};

describe('withoutSquad', () => {
  it("drops one squad's scores and keeps every other squad's", () => {
    expect(withoutSquad(bests, 'arm')).toEqual({
      'ars:1': at(7),
      'arsenal-women:1': at(5),
    });
  });

  it('matches the whole id, not a prefix of another', () => {
    expect(Object.keys(withoutSquad(bests, 'ars'))).toEqual([
      'arm:1',
      'arm:3',
      'arm:2',
      'arsenal-women:1',
    ]);
  });

  it('returns the same object when the squad has no scores', () => {
    expect(withoutSquad(bests, 'esp')).toBe(bests);
  });
});

describe('squadScores', () => {
  it("lists a squad's bests by level", () => {
    expect(squadScores(bests, 'arm')).toEqual([
      { level: 1, score: 10 },
      { level: 2, score: 8 },
      { level: 3, score: 6 },
    ]);
  });

  it('is empty for a squad never played', () => {
    expect(squadScores(bests, 'esp')).toEqual([]);
  });
});

describe('scoreSummary', () => {
  it('counts scores and the teams they belong to', () => {
    expect(scoreSummary(bests)).toEqual({ scores: 5, teams: 3 });
  });

  it('is zero with nothing played', () => {
    expect(scoreSummary({})).toEqual({ scores: 0, teams: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/__tests__/reset.test.ts`
Expected: FAIL, cannot resolve `@/lib/reset`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/reset.ts
import type { BestScore } from './bestScore';

// Reset progress (#197): the pure part of the three resets. A best score's key
// is `${squadId}:${level}` (`scoreKey`), so a squad's keys are the ones whose
// id, up to the last colon, is that squad's.

function squadOf(key: string): string {
  return key.slice(0, key.lastIndexOf(':'));
}

/** Every best score but `squadId`'s; the same object when it has none. */
export function withoutSquad(
  bestScores: Record<string, BestScore>,
  squadId: string,
): Record<string, BestScore> {
  const kept = Object.entries(bestScores).filter(([key]) => squadOf(key) !== squadId);
  return kept.length === Object.keys(bestScores).length ? bestScores : Object.fromEntries(kept);
}

/** `squadId`'s bests, level by level: the Start over sheet's "L1 10 · L2 8". */
export function squadScores(
  bestScores: Record<string, BestScore>,
  squadId: string,
): { level: number; score: number }[] {
  return Object.entries(bestScores)
    .filter(([key]) => squadOf(key) === squadId)
    .map(([key, best]) => ({
      level: Number(key.slice(key.lastIndexOf(':') + 1)),
      score: best.score,
    }))
    .sort((a, b) => a.level - b.level);
}

/** How many bests there are, and over how many teams: Clear all's count. */
export function scoreSummary(bestScores: Record<string, BestScore>): {
  scores: number;
  teams: number;
} {
  const keys = Object.keys(bestScores);
  return { scores: keys.length, teams: new Set(keys.map(squadOf)).size };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/__tests__/reset.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/reset.ts lib/__tests__/reset.test.ts
git commit -m "feat(progress): count and filter best scores for the resets (#197)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The store's three resets

**Files:**

- Modify: `stores/progress.ts`
- Modify: `.claude/rules/stores.md` (one line)
- Test: `stores/__tests__/progress.test.ts`

**Interfaces:**

- Consumes: `withoutSquad` (Task 1).
- Produces (used by Tasks 7, 8):
  - `resetSquad: (squadId: string) => void`: drops that squad's best scores; `lastPlayed`, the star and the tips state stay.
  - `reset: () => void`: unchanged (clears `bestScores` and `lastPlayed`).
  - `factoryReset: (installId: string) => void`: every data field back to its initial value except `telemetryEnabled` and `reviewAskedVersion`; `installId` becomes the given one.

- [ ] **Step 1: Write the failing tests** (append to `stores/__tests__/progress.test.ts`)

```ts
describe('resets (#197)', () => {
  const at = (score: number) => ({ score, squadUpdated: '2026-10-01' });

  it('resetSquad drops one squad and keeps Continue, the star and the tips', () => {
    useProgress.setState({
      bestScores: { 'arm:1': at(10), 'arm:2': at(8), 'esp:1': at(7) },
      lastPlayed: { squadId: 'arm', level: 2 },
      starredSquads: ['arm'],
      tipsSeen: ['difficulty'],
      tipsSkipped: true,
    });
    useProgress.getState().resetSquad('arm');
    const s = useProgress.getState();
    expect(s.bestScores).toEqual({ 'esp:1': at(7) });
    expect(s.lastPlayed).toEqual({ squadId: 'arm', level: 2 });
    expect(s.starredSquads).toEqual(['arm']);
    expect(s.tipsSeen).toEqual(['difficulty']);
    expect(s.tipsSkipped).toBe(true);
  });

  it('reset clears every score and Continue, and keeps the rest', () => {
    useProgress.setState({
      bestScores: { 'arm:1': at(10) },
      lastPlayed: { squadId: 'arm', level: 1 },
      starredSquads: ['arm'],
      tipsSkipped: true,
    });
    useProgress.getState().reset();
    const s = useProgress.getState();
    expect(s.bestScores).toEqual({});
    expect(s.lastPlayed).toBeNull();
    expect(s.starredSquads).toEqual(['arm']);
    expect(s.tipsSkipped).toBe(true);
  });

  it.each([true, false])(
    'factoryReset returns everything to first launch but keeps usage statistics %s',
    (telemetryEnabled) => {
      useProgress.setState({
        bestScores: { 'arm:1': at(10) },
        lastPlayed: { squadId: 'arm', level: 1 },
        themePreference: 'light',
        languagePreference: 'fr',
        installId: 'old-id',
        telemetryEnabled,
        haptics: false,
        studyView: 'list',
        reviewAskedVersion: '2.0.0',
        starredSquads: ['arm', 'esp'],
        tipsSeen: ['picker', 'results'],
        tipsSkipped: true,
      });
      useProgress.getState().factoryReset('new-id');
      const s = useProgress.getState();
      const initial = useProgress.getInitialState();
      expect(s.telemetryEnabled).toBe(telemetryEnabled);
      expect(s.reviewAskedVersion).toBe('2.0.0');
      expect(s.installId).toBe('new-id');
      for (const key of [
        'bestScores',
        'lastPlayed',
        'themePreference',
        'languagePreference',
        'haptics',
        'studyView',
        'starredSquads',
        'tipsSeen',
        'tipsSkipped',
      ] as const) {
        expect(s[key], key).toEqual(initial[key]);
      }
    },
  );

  it('factoryReset leaves no data field unhandled', () => {
    // A field added to the store later must be reset or kept on purpose: this
    // lists every data field, so a new one fails here until it is placed.
    const data = Object.entries(useProgress.getInitialState())
      .filter(([, value]) => typeof value !== 'function')
      .map(([key]) => key)
      .sort();
    expect(data).toEqual(
      [
        'bestScores',
        'haptics',
        'installId',
        'languagePreference',
        'lastPlayed',
        'reviewAskedVersion',
        'starredSquads',
        'studyView',
        'telemetryEnabled',
        'themePreference',
        'tipsSeen',
        'tipsSkipped',
      ].sort(),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run stores/__tests__/progress.test.ts`
Expected: FAIL, `resetSquad is not a function` and `factoryReset is not a function`.

- [ ] **Step 3: Implement in `stores/progress.ts`**

1. Import: `import { withoutSquad } from '@/lib/reset';`
2. In `ProgressState`, beside `reset`, add:

```ts
  /** Start one team over (#197): that squad's best scores only. Continue,
   *  the star and the tips stay, so Home offers the team again at level 1. */
  resetSquad: (squadId: string) => void;
  /** Reset Escuadra (#197): every field back to first launch, except the
   *  usage statistics choice, which a reset never turns back on, and
   *  `reviewAskedVersion`, so a reset earns no second rating prompt.
   *  `installId` is replaced by the one given. */
  factoryReset: (installId: string) => void;
```

3. Above `useProgress`, lift the data fields' initial values into one object, and spread it in the store, so `factoryReset` and first launch cannot drift apart:

```ts
type ProgressData = {
  [
    K in keyof ProgressState as ProgressState[K] extends (...args: never[]) => unknown ? never : K
  ]: ProgressState[K];
};

/** First launch. `factoryReset` returns to it. */
const INITIAL: ProgressData = {
  bestScores: {},
  lastPlayed: null,
  themePreference: 'system',
  languagePreference: 'system',
  installId: null,
  telemetryEnabled: true,
  haptics: true,
  studyView: 'grid',
  reviewAskedVersion: null,
  starredSquads: [],
  tipsSeen: [],
  tipsSkipped: false,
};
```

Replace the twelve literal fields at the top of the store's initializer with `...INITIAL,`.

4. Beside `reset`, add:

```ts
      resetSquad: (squadId) => set((s) => ({ bestScores: withoutSquad(s.bestScores, squadId) })),
      factoryReset: (installId) =>
        set((s) => ({
          ...INITIAL,
          installId,
          telemetryEnabled: s.telemetryEnabled,
          reviewAskedVersion: s.reviewAskedVersion,
        })),
```

5. Update `reset()`'s neighbours' doc comments only where they now mislead: the "survives `reset()`" notes stay true; add nothing else.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run stores/__tests__/progress.test.ts`
Expected: PASS, the four new tests with the existing ones.

- [ ] **Step 5: Keep the stores rule true**

In `.claude/rules/stores.md`, after the first bullet, add:

```md
- Three resets (#197): `resetSquad` drops one squad's scores, `reset()` clears every score
  and Continue, `factoryReset` returns every field to `INITIAL` but the usage statistics
  choice and `reviewAskedVersion`. A new field joins `INITIAL`, and
  `stores/__tests__/progress.test.ts` fails until it does.
```

- [ ] **Step 6: Commit**

```bash
git add stores/progress.ts stores/__tests__/progress.test.ts .claude/rules/stores.md
git commit -m "feat(progress): start one team over, and reset to first launch (#197)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Telemetry follows a new identifier

A factory reset stores a new `installId`, but `lib/telemetry.ts` builds its TelemetryDeck client once, with the identifier it first saw, so signals would keep the old one until the app restarts. About says the session code is new each time the app starts, so the fix must not start a new session mid-run.

**Files:**

- Modify: `lib/telemetry.ts`
- Read first: `node_modules/@telemetrydeck/sdk` (its `TelemetryDeck` class: is `clientUser` a public, assignable property?), `lib/__tests__/telemetrySdk.test.ts`.

**Interfaces:**

- Consumes: `useProgress.getState().installId` (already read in `track`).
- Produces: nothing new; `track()` behaves the same.

- [ ] **Step 1: Read the SDK.** Confirm in the installed `@telemetrydeck/sdk` source that `clientUser` is a public field read when each signal is built (not hashed once in the constructor). Note what you find in the commit message.

- [ ] **Step 2: Implement.** If `clientUser` is read per signal, keep the one client and point it at the current identifier:

```ts
function clientFor(installId: string): TelemetryDeck {
  if (!client) {
    client = new TelemetryDeck({/* unchanged options */});
  }
  // Reset Escuadra (#197) replaces the identifier mid-run; the same client, so
  // the session code stays the one this launch began with.
  client.clientUser = installId;
  return client;
}
```

If it is hashed once in the constructor, instead keep the client's identifier in a module variable and rebuild the client when it differs, passing the old client's `sessionID` to the new one if the SDK's options accept it; if they do not, stop and report to the controller (it becomes a question for the owner, since About promises one session code per launch).

- [ ] **Step 3: Verify.** Run: `npx vitest run lib/__tests__/telemetrySdk.test.ts lib/__tests__/telemetryEvents.test.ts`
      Expected: PASS, unchanged (the request's shape does not change).

- [ ] **Step 4: Commit**

```bash
git add lib/telemetry.ts
git commit -m "fix(telemetry): signals follow the identifier a reset gives (#197)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Tokens and the eraser glyph

**Files:**

- Modify: `theme/tokens.ts` (`Palette`, `darkRoles`, `lightRoles`, `iconSize`, and `sizes` if a fade height is missing)
- Modify: `components/ActionGlyphs.tsx`
- Test: `theme/__tests__/tokens.test.ts`

**Interfaces:**

- Produces (used by Tasks 7, 8):
  - `Palette.dangerOn: string`: text on an `error` fill. Dark `#12141a`, light `#ffffff`.
  - `iconSize.eraserGlyph = 18` (the size of `retryGlyph`, its neighbour on Results' pattern).
  - `sizes.ladderFooterFade`: the fade's height over Difficulty's pinned footer. Use `spacing.xl` if that token exists as a number, written as a new `sizes` entry so the screen names its purpose.
  - `EraserGlyph({ color }: { color: string })` in `components/ActionGlyphs.tsx`.

- [ ] **Step 1: Write the failing test** (in `theme/__tests__/tokens.test.ts`, beside "error reaches 4.5:1 on background")

```ts
it('dangerOn reaches 4.5:1 on an error fill, in both themes (#197)', () => {
  for (const [name, p] of Object.entries(palettes)) {
    expect(contrastRatio(p.dangerOn, p.error), `${name}.dangerOn`).toBeGreaterThanOrEqual(4.5);
  }
});

it('error, as a row label, reaches 4.5:1 on surface, in both themes (#197)', () => {
  for (const [name, p] of Object.entries(palettes)) {
    expect(contrastRatio(p.error, p.surface), `${name}.error`).toBeGreaterThanOrEqual(4.5);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run theme/__tests__/tokens.test.ts`
Expected: FAIL to typecheck at runtime: `p.dangerOn` is `undefined` (contrastRatio throws or returns NaN). If the `error` on `surface` check fails too, stop and report: a row label colour then needs a new role, which is the controller's call.

- [ ] **Step 3: Add the tokens**

In `Palette`, after `ctaLine`:

```ts
// ---- Reset progress (#197) ----
/** Text on an `error` fill: a reset sheet's confirm button. */
dangerOn: string;
```

`darkRoles`: `dangerOn: '#12141a',` and `lightRoles`: `dangerOn: '#ffffff',`, each after `ctaLine`. In `iconSize`, after `retryGlyph`: `eraserGlyph: 18, // Difficulty's Start over and Settings' Clear all scores (#197)`. Add `sizes.ladderFooterFade` as described.

- [ ] **Step 4: Draw `EraserGlyph`** in `components/ActionGlyphs.tsx`, after `RetryGlyph`, from Views like its neighbours:

```tsx
/** Eraser (#197): Start over and Clear all scores. A block leaning 45°, its
 *  rubber end filled, on a baseline. Not `RetryGlyph`, which means replay. */
export function EraserGlyph({ color }: { color: string }) {
  const s = iconSize.eraserGlyph;
  const w = borderWidths.thick + borderWidths.hairline / 2;
  const blockW = s * 0.42;
  const blockH = s * 0.74;
  const styles = StyleSheet.create({
    box: { width: s, height: s },
    block: {
      position: 'absolute',
      left: (s - blockW) / 2,
      top: (s - blockH) / 2 - w,
      width: blockW,
      height: blockH,
      borderRadius: radii.xs,
      borderWidth: w,
      borderColor: color,
      overflow: 'hidden',
      transform: [{ rotate: '45deg' }],
    },
    rubber: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: blockH * 0.36,
      backgroundColor: color,
    },
    base: {
      position: 'absolute',
      left: s * 0.08,
      right: s * 0.08,
      bottom: 0,
      height: w,
      borderRadius: w / 2,
      backgroundColor: color,
    },
  });
  return (
    <View style={styles.box}>
      <View style={styles.block}>
        <View style={styles.rubber} />
      </View>
      <View style={styles.base} />
    </View>
  );
}
```

Use the smallest existing `radii` key for the block's corner (check `radii` in `theme/tokens.ts`; if none fits, add `radii.glyph` with a comment rather than inline a number). Import `radii` if the file does not already.

- [ ] **Step 5: Run the tests and typecheck**

Run: `npx vitest run theme/__tests__/tokens.test.ts && npm run typecheck`
Expected: PASS; no type errors (both palettes implement `dangerOn`).

- [ ] **Step 6: Commit**

```bash
git add theme/tokens.ts theme/__tests__/tokens.test.ts components/ActionGlyphs.tsx
git commit -m "feat(progress): a danger role, and an eraser for Start over (#197)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The resets' text, in five languages

**Files:**

- Modify: `i18n/en.ts`, `i18n/budgets.ts`, `i18n/de.ts`, `i18n/es.ts`, `i18n/fr.ts`, `i18n/it.ts`
- Test: the existing `i18n/__tests__/catalogs.test.ts`, `budgets.test.ts`, `translations.test.ts`

**Interfaces:**

- Produces (used by Tasks 6–8), every catalog the same shape:
  - `settings.sections.yourData` (≤ 16): `'Your data'`, after `about` in `sections`.
  - `ladder.startOver(team: string)`: `` `Start ${team} over` ``: the eraser's spoken name. No budget (never shown).
  - A new top-level `reset` group, after `examMode`:

```ts
  reset: {
    /** ≤ 16 chars: a sheet's list heading, in IBM Plex Mono capitals. */
    clears: 'Clears',
    /** ≤ 16 chars: a sheet's list heading, in IBM Plex Mono capitals. */
    keeps: 'Keeps',
    team: {
      /** ≤ 32 chars with "Spain": the sheet's title. */
      title: (team: string) => `Start ${team} over?`,
      /** The line under it; wraps. */
      line: (team: string) => `${team} goes back to unplayed, as if you had never opened it.`,
      /** ≤ 20 chars: the Clears row's label. */
      bestScores: 'Best scores',
      /** ≤ 8 chars: one level's best in that row, in mono: "L1 10". */
      levelScore: (level: number, score: number) => `L${level} ${score}`,
      /** ≤ 56 chars: the Keeps line, when the team is starred. */
      keepsStar: 'Your star, so the team stays in Your squads.',
      /** ≤ 20 chars: the confirm button, in Archivo capitals. */
      confirm: 'Start over',
    },
    all: {
      /** ≤ 24 chars: the Settings row, and the sheet's title without "?". */
      row: 'Clear all scores',
      /** ≤ 56 chars: the line under the row. */
      note: 'Every team back to unplayed. Settings stay.',
      /** ≤ 24 chars: the sheet's title. */
      title: 'Clear all scores?',
      /** The line under it; wraps. */
      line: 'Every team goes back to unplayed. You start the ladders again from level 1.',
      /** ≤ 20 chars: the Clears row's count, in mono: "14 · 5 teams". */
      count: (scores: number, teams: number) =>
        `${scores} · ${teams} ${teams === 1 ? 'team' : 'teams'}`,
      /** ≤ 56 chars: the Keeps line. */
      keepsLine: 'Your starred teams and every setting.',
      /** ≤ 22 chars with 99: the confirm button, in Archivo capitals. */
      confirm: (count: number) => (count === 1 ? 'Clear 1 score' : `Clear ${count} scores`),
    },
    app: {
      /** ≤ 24 chars: the Settings row, and the confirm button. */
      row: `Reset ${ESCUADRA}`,
      /** ≤ 56 chars: the line under the row. */
      note: 'Everything back to how it was on first launch.',
      /** ≤ 24 chars: the sheet's title. */
      title: `Reset ${ESCUADRA}?`,
      /** The line under it; wraps. */
      line: `Everything ${ESCUADRA} keeps on this phone goes back to how it was on first launch.`,
      /** ≤ 40 chars each: the Clears list. */
      scores: 'Scores and Continue',
      starred: 'Starred teams',
      preferences: 'Language, appearance, vibration, Study view',
      tips: 'How to play tips, shown again',
      photos: 'Cached player photos',
      /** The Keeps line; wraps. */
      keepsLine: 'Your usage statistics choice. Its random identifier is replaced with a new one.',
    },
  },
```

`preferences` is 43 characters: give that one leaf its own `≤ 48 chars` comment, and keep the others at 40.

- [ ] **Step 1: Add the English text and its budgets.** Write the keys above into `i18n/en.ts`. Mirror every `≤ N chars` comment into `i18n/budgets.ts`, in file order, measuring functions at their longest realistic call (`title('Spain')`, `levelScore(3, 10)`, `count(99, 12)`, `confirm(99)`).

- [ ] **Step 2: Run the catalog tests to see the four catalogs fail**

Run: `npx vitest run i18n/__tests__`
Expected: FAIL, de/es/fr/it missing `reset`, `settings.sections.yourData` and `ladder.startOver` (and typecheck errors, since each is typed `: Messages`).

- [ ] **Step 3: Translate.** Add the same keys to `de.ts`, `es.ts`, `fr.ts` (France usage) and `it.ts`, in English's order, with natural plurals in `count` and `confirm`. Keep `ESCUADRA` from `i18n/names.ts`, never translated. Within each budget.

- [ ] **Step 4: Run the catalog tests**

Run: `npx vitest run i18n/__tests__ && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add i18n/
git commit -m "feat(progress): the resets' text in five languages (#197)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

The controller then sends each language's new strings to a fresh native-speaker reviewer (one subagent per language, France usage for fr), fixes what they find in a follow-up commit, and repeats until each says clean. A change of meaning goes to the owner.

---

### Task 6: About says Settings can erase it

**Files:**

- Modify: `i18n/en.ts`, `i18n/de.ts`, `i18n/es.ts`, `i18n/fr.ts`, `i18n/it.ts` (each `about`'s "What is stored on your device" second paragraph)
- Modify: `i18n/__tests__/catalogs.test.ts` (the About hash, after the translations)

**Interfaces:** none; text only.

- [ ] **Step 1: The English sentence.** In `en.about`'s "What is stored on your device", the paragraph that begins `` `This data lives in the app's own private storage. `` (around `i18n/en.ts:572`): after "Deleting the app deletes all of it from your device, along with any cached photos." insert:

```
You can also erase it in Settings, under Your data: one team's scores, all your scores, or, with Reset ${ESCUADRA}, everything listed above and any cached photos, except your choice about usage statistics and the app version that last asked for a rating. A reset gives usage statistics a new random identifier.
```

- [ ] **Step 2: Run the hash test to see it fail**

Run: `npx vitest run i18n/__tests__/catalogs.test.ts -t "pins the English About"`
Expected: FAIL, the hash differs from `d012d3a943ce3355`.

- [ ] **Step 3: Translate the sentence** into de, es, fr (France usage) and it, at the same place in each catalog's paragraph, matching how that catalog already words "usage statistics" (its `USAGE_STATISTICS` name, as About uses it), "Settings" and "Your data" (as Task 5 translated `settings.sections.yourData`).

- [ ] **Step 4: Update the hash.** Replace `'d012d3a943ce3355'` with the value the failing test printed, then run: `npx vitest run i18n/__tests__`
      Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add i18n/
git commit -m "docs(about): Settings can erase what the app stores (#197)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

The controller sends the new sentence in all four languages to fresh native-speaker reviewers, with the English and the paragraph around it, until each is clean; a change of meaning goes to the owner. Then it regenerates the privacy pages outside the repo (Task 9).

---

### Task 7: `ResetSheet` and Difficulty's Start over

**Files:**

- Create: `components/ResetSheet.tsx`
- Modify: `app/team/[squadId]/difficulty.tsx`

**Interfaces:**

- Consumes: `Sheet` (`components/Sheet.tsx`: `visible`, `onClose`, `title`, `testID`, `children`); `squadScores` (Task 1); `resetSquad` (Task 2); `EraserGlyph`, `dangerOn`, `iconSize.eraserGlyph`, `sizes.ladderFooterFade` (Task 4); `t.reset.*`, `t.ladder.startOver` (Task 5); `squadDisplayName` (`i18n/displayNames.ts`).
- Produces (used by Task 8):

```ts
export interface ResetSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Names the sheet `<testID>-sheet`, its close `<testID>-close`, its button `<testID>-confirm`. */
  testID: string;
  title: string;
  line: string;
  /** The Clears list: a label, and a mono value on the right when there is one. */
  clears: readonly { label: string; value?: string }[];
  /** The Keeps line; none when nothing worth saying is kept. */
  keeps?: string;
  confirmLabel: string;
  onConfirm: () => void;
}
export function ResetSheet(props: ResetSheetProps): JSX.Element;
```

- [ ] **Step 1: Write `components/ResetSheet.tsx`.** A `Sheet` holding, `spacing.md` apart:
  - `line` in `typography.secondary`, `textSecondary`.
  - The **Clears** heading (`t.reset.clears`, `typography.monoCaption`, `textMuted`, `accessibilityRole="header"`), then one card (`surfaceRaised`, `radii.md`, rows divided by a `hairline` in `surface`): each row the label in `typography.settingsLabel`/`textPrimary` and, when present, the value in `typography.statMonoTiny`/`textSecondary`, right-aligned.
  - When `keeps` is set: the **Keeps** heading the same way, then `keeps` in `typography.secondarySmall`/`textSecondary`.
  - The confirm button: `minHeight: sizes.cta.normal`, `radii.pill`, `backgroundColor: colors.error`, label in `typography.ctaLabel` with `color: colors.dangerOn`, `accessibilityRole="button"`, `testID={`${testID}-confirm`}`. It calls `onConfirm` then `onClose`.
  - No separate Cancel: the sheet's ×, the backdrop and Android back close it (decision recorded in the PR).
  - Styles inside the component from `useThemeColors()`, as `Sheet` does.

- [ ] **Step 2: Pin Study and the source line, and add the eraser.** In `app/team/[squadId]/difficulty.tsx`:
  - Move the Study `Pressable` and the `updated` `Text` out of the `ScrollView` into a footer `View` after it, inside `root`: `paddingHorizontal: spacing.lg`, `paddingTop: spacing.xs`, `paddingBottom: insets.bottom + spacing.sm`, `gap: spacing.xs`, `backgroundColor: colors.background`.
  - Over the footer's top edge, a `LinearGradient` (`expo-linear-gradient`, as Home's fades use it) from `colors.backgroundClear` to `colors.background`, `position: 'absolute'`, `left: 0`, `right: 0`, `bottom: '100%'`, `height: sizes.ladderFooterFade`, `pointerEvents="none"`.
  - The ScrollView's `contentContainerStyle.paddingBottom` becomes `spacing.lg` (the footer now holds the inset).
  - In the footer, Study and the eraser share a row (`flexDirection: 'row'`, `gap: spacing.sm`): Study keeps its `studyRef`, `testID="study"`, label and glyph, with `flex: 1` (drop its `marginTop`). The eraser, only when `squadScores(bestScores, squad.id).length > 0`: a `Pressable`, `testID="difficulty-start-over"`, `accessibilityRole="button"`, `accessibilityLabel={t.ladder.startOver(name)}`, a circle `width = height = sizes.ladderPill`, `borderRadius: sizes.ladderPill / 2`, `borderWidth: borderWidths.thick`, `borderColor: colors.border`, centred `EraserGlyph` in `colors.textPrimary`. `name` is `squadDisplayName(squad, language)` with `language` from `useLanguage()`.
  - The third tip keeps `target: studyRef`; leave `scrollBy` as it is.

- [ ] **Step 3: The Start over sheet.** State `const [startOver, setStartOver] = useState(false)`; the eraser opens it. After the `TipsLayer` block:

```tsx
<ResetSheet
  visible={startOver}
  onClose={() => setStartOver(false)}
  testID="start-over"
  title={t.reset.team.title(name)}
  line={t.reset.team.line(name)}
  clears={[
    {
      label: t.reset.team.bestScores,
      value: scores.map((s) => t.reset.team.levelScore(s.level, s.score)).join(' · '),
    },
  ]}
  keeps={starred ? t.reset.team.keepsStar : undefined}
  confirmLabel={t.reset.team.confirm}
  onConfirm={() => resetSquad(squad.id)}
/>
```

where `scores = squadScores(bestScores, squad.id)` and `resetSquad = useProgress((s) => s.resetSquad)` (hooks above the early `return null`, as the existing ones are). After confirming, the ladder re-renders unplayed and the eraser disappears with the scores.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: clean. Then `npx expo start --web`, open `/team/arm/difficulty` with a seeded score (or play one round), and check: the footer stays put while the ladder scrolls under its fade; the eraser shows only with a score; the sheet lists the levels; Start over clears them; Home still offers Continue for that team at level 1.

- [ ] **Step 5: Commit**

```bash
git add components/ResetSheet.tsx "app/team/[squadId]/difficulty.tsx"
git commit -m "feat(progress): start one team over, from beside Study (#197)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Settings, Your data

**Files:**

- Modify: `app/settings.tsx`

**Interfaces:**

- Consumes: `ResetSheet` (Task 7); `scoreSummary` (Task 1); `reset`, `factoryReset` (Task 2); `EraserGlyph` (Task 4); `EscuadraMark` (already imported); `t.reset.*`, `t.settings.sections.yourData` (Task 5); `Image` from `expo-image`; `* as Crypto` from `expo-crypto` (as `app/_layout.tsx` imports it).

- [ ] **Step 1: The section.** After the ABOUT `SettingsSection` and before the footer:

```tsx
<SettingsSection label={t.settings.sections.yourData}>
  <SettingsRow
    testID="settings-clear-scores"
    icon={<EraserGlyph color={summary.scores > 0 ? glyph : colors.textMuted} />}
    label={t.reset.all.row}
    note={t.reset.all.note}
    muted={summary.scores === 0}
    onPress={summary.scores > 0 ? () => setSheet('scores') : undefined}
    accessory={summary.scores > 0 ? <Text style={styles.value}>{summary.scores}</Text> : undefined}
    danger
  />
  <SettingsRow
    last
    testID="settings-reset"
    icon={<EscuadraMark size={g.footerMark} color={glyph} />}
    label={t.reset.app.row}
    note={t.reset.app.note}
    onPress={() => setSheet('app')}
    danger
  />
</SettingsSection>
```

with `const summary = scoreSummary(useProgress((s) => s.bestScores));` and `const [sheet, setSheet] = useState<'scores' | 'app' | null>(null);`.

- [ ] **Step 2: A `danger` row.** In `components/SettingsSection.tsx`, add an optional `danger?: boolean` prop to `SettingsRow`: when set and not `muted`, the label's colour is `colors.error`; nothing else changes. Document it in the props comment.

- [ ] **Step 3: The two sheets**, after `LanguageSheet`:

```tsx
      <ResetSheet
        visible={sheet === 'scores'}
        onClose={() => setSheet(null)}
        testID="clear-scores"
        title={t.reset.all.title}
        line={t.reset.all.line}
        clears={[{ label: t.reset.team.bestScores, value: t.reset.all.count(summary.scores, summary.teams) }]}
        keeps={t.reset.all.keepsLine}
        confirmLabel={t.reset.all.confirm(summary.scores)}
        onConfirm={reset}
      />
      <ResetSheet
        visible={sheet === 'app'}
        onClose={() => setSheet(null)}
        testID="reset-app"
        title={t.reset.app.title}
        line={t.reset.app.line}
        clears={[
          { label: t.reset.app.scores, value: summary.scores > 0 ? String(summary.scores) : undefined },
          { label: t.reset.app.starred, value: starredCount > 0 ? String(starredCount) : undefined },
          { label: t.reset.app.preferences },
          { label: t.reset.app.tips },
          { label: t.reset.app.photos },
        ]}
        keeps={t.reset.app.keepsLine}
        confirmLabel={t.reset.app.row}
        onConfirm={resetApp}
      />
```

`reset = useProgress((s) => s.reset)`, `starredCount = useProgress((s) => s.starredSquads.length)`, and:

```ts
// Reset Escuadra (#197): the photo caches, then the store, then Home. A cache
// that fails to clear is not worth stopping the reset for.
const resetApp = () => {
  void Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]).catch(() => {});
  useProgress.getState().factoryReset(Crypto.randomUUID());
  router.dismissTo('/');
};
```

Check `router.dismissTo` and `Image.clearDiskCache`/`clearMemoryCache` against the SDK 57 docs (https://docs.expo.dev/versions/v57.0.0/sdk/router/ and …/sdk/image/) before relying on them; on web `clearDiskCache` may resolve `false`, which is fine.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: clean. Then on web: with scores, Clear all shows the count and clears them (Home shows Start Training); with none, the row is muted and does nothing. Set French, dark theme, star two teams, skip the tips, then Reset Escuadra: Home returns in the phone's language and theme, nothing starred, and the picker shows its How to play tips again. Usage statistics stays as it was.

- [ ] **Step 5: Commit**

```bash
git add app/settings.tsx components/SettingsSection.tsx
git commit -m "feat(progress): Settings, Your data: clear all scores, or reset Escuadra (#197)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Screens, privacy pages, review and PR (controller)

- [ ] **Step 1: Screens.** In `scripts/capture-screens.mjs`, in `captureTheme`:
  - After the `04b-difficulty-nation` shot (Armenia has seeded scores, so the eraser shows): `await capture.tapId('difficulty-start-over', { wait: SHEET_MS }); await capture.shoot('04g-difficulty-start-over');`
  - After the seeded shots (scores exist), open `/settings`, scroll to the end as `01c-settings-end` does, shoot `01g-settings-your-data`, then `tapId('settings-clear-scores', { wait: SHEET_MS })` → `01h-settings-clear-scores`; reopen `/settings`, scroll, `tapId('settings-reset', …)` → `01i-settings-reset`. (`01e` and `01f` are Home's.) Never tap a confirm.
  - Run `npm run shots`; describe the new files and the changed Difficulty footer in `design/SCREENS.md`.
- [ ] **Step 2: Reviews.** Dispatch a code reviewer over the branch diff against the spec; fix what holds up. Confirm every language review from Tasks 5 and 6 ended clean.
- [ ] **Step 3: Privacy pages.** Regenerate `privacy/2/` outside the repo (`scripts/privacy-pages.ts`), and keep the diff for the PR body. Do not push `gh-pages`.
- [ ] **Step 4: `npm run check`**, and keep its output for the PR.
- [ ] **Step 5: PR.** Push `feat/197-reset-progress`, open a PR with `Closes #197`: what changed, the decisions (no Cancel, the Settings icons, telemetry following the new identifier), the About sentence in five languages, the privacy page diff, `npm run check`'s output, and a device checklist:
  - Start over on a played team: the ladder is fresh, the eraser goes, Home offers Continue at level 1, the star stays.
  - Clear all: Home shows Start Training; stars and settings stay.
  - Reset Escuadra with statistics off: they stay off; language, theme, vibration, Study view and stars return to defaults; every screen's How to play shows again; photos load fresh.
  - The footer on a small phone (360 × 640) and with the largest text: Study and the eraser stay whole.
  - Screen readers (for #187 on merge): the eraser reads "Start Armenia over, button"; each sheet's title, list and confirm read in order.
