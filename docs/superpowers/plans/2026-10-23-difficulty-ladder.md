# The redesigned difficulty ladder: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `app/team/[squadId]/difficulty.tsx` in the 2.0 look: team hero, THE LADDER
with compact rungs and a focused card, Exam mode SOON, Study as an outline pill.

**Architecture:** Pure helpers in `lib/ladderView.ts` and `lib/stageView.ts`, unit-tested in
node, feed four new presentational components (`LadderHero`, `LadderRung`, `LadderCard`,
`ExamModeRow`). The screen composes them in a `ScrollView`. All copy lives in the five
catalogs; all sizes, type and colours are tokens.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router, expo-linear-gradient, Vitest
(node, no RN renderer), Playwright for `npm run shots`.

**Spec:** `docs/superpowers/specs/2026-10-23-difficulty-ladder-design.md`. Issue #178. Canvas
artboard: `project/Difficulty.dc.html` of https://claude.ai/artifact/9wopqyRq53dok9ZYqGPT8X
(read it with the Artifact tool, `action: "read"`, `path: "project/Difficulty.dc.html"`).

## Global Constraints

- Node 24: run `nvm use` once per shell before any `npm`/`node` command.
- No hard-coded colour, spacing or font size (guardrail 5): add a token to `theme/tokens.ts`.
  Colour comes from `useThemeColors()` at render, never a module-scope `StyleSheet` holding a
  colour. A palette role is added to both `palettes.dark` and `palettes.light`.
- Team colours come only from squad data (`squad.marker` through `bannerBands`).
- Every user-visible string is in `i18n/en.ts` and the other four catalogs (`de`, `es`,
  `fr` in France usage, `it`). A budgeted string gets a `≤ N chars` comment in `en.ts` and
  an entry in `i18n/budgets.ts`. `npm run lint` fails a hard-coded string in `app/` or
  `components/`.
- "a la escuadra" is `A_LA_ESCUADRA` from `i18n/names.ts`, never translated.
- No new animation, telemetry event, network call, dependency, npm script, `app.json` or
  `.gitignore` change.
- TypeScript strict with `noUncheckedIndexedAccess`; never weaken it.
- Open project files with the Read tool (not `cat`), so the path-scoped rules in
  `.claude/rules/` load.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before claiming a task done: `npm run typecheck && npm run lint && npm test` pass. The last
  task runs `npm run check`.

---

### Task 1: Copy: the new strings in all five catalogs, Exam mode shared

**Files:**

- Modify: `i18n/en.ts`, `i18n/de.ts`, `i18n/es.ts`, `i18n/fr.ts`, `i18n/it.ts`,
  `i18n/budgets.ts`, `app/settings.tsx` (only `t.settings.examMode` → `t.examMode`)
- Test: `i18n/__tests__/catalogs.test.ts`, `budgets.test.ts`, `translations.test.ts` (existing)

**Interfaces:**

- Produces (in `Messages`):
  - `examMode: { title: string; line: string; soon: string }` (top level, moved from
    `settings.examMode`, texts unchanged);
  - `ladder.heading: string`, `ladder.nationalTeam: string`, `ladder.cleared: string`,
    `ladder.notPlayed: string`;
  - `ladder.yourBest(correct: number, total: number): string` ("Your best · 6/10");
  - `ladder.yourBestSpoken(correct: number, total: number): string` ("Your best, 6 of 10");
  - `ladder.playLevel(level: number): string` ("Play level 3");
  - `ladder.rungCleared(title: string, correct: number, total: number): string`;
  - `ladder.rungEscuadra(title: string, correct: number, total: number): string`;
  - `ladder.levels[3]` becomes `{ title; descriptionClub; descriptionNation }`. Levels 1 and 2
    keep `{ title; description }`.
- The old keys `ladder.title`, `ladder.play`, `ladder.playAgain` and `ladder.best` stay in this
  task, because the current screen still reads them. Task 5 removes them.

- [ ] **Step 1: Move `examMode`.** In `en.ts`, cut `settings.examMode` (with its comments) and
      paste it as a top-level `examMode` key placed directly after the `settings` block. Do the
      same in `de/es/fr/it.ts`, keeping each language's existing texts. The catalogs test fails
      a key out of order, so the place must match in all five. In `i18n/budgets.ts`, rename the
      three `settings.examMode.*` entries to `examMode.*` reading `m.examMode.*`. In
      `app/settings.tsx`, replace `t.settings.examMode` with `t.examMode` (three places).

- [ ] **Step 2: Add the English copy.** In `en.ts`'s `ladder` block, after `studySquad`/`updated`,
      add the following. Then replace level 3's `description` with the two kind-specific
      descriptions.

```ts
    /** ≤ 20 chars: the label over the rungs, in mono capitals. */
    heading: 'The ladder',
    /** ≤ 16 chars: a nation's hero line, before the season, in mono capitals. */
    nationalTeam: 'National team',
    /** ≤ 14 chars: under a compact rung's score of 8 or 9, in mono capitals. */
    cleared: 'Cleared',
    /** ≤ 22 chars: the focused card's status line before a first round, in mono capitals. */
    notPlayed: 'Not played yet',
    /** ≤ 22 chars: the focused card's status line, in mono capitals. */
    yourBest: (correct: number, total: number) => `Your best · ${correct}/${total}`,
    /** Spoken, so the numbers are words: no "6/10" (read as a date). */
    yourBestSpoken: (correct: number, total: number) => `Your best, ${correct} of ${total}`,
    /** ≤ 16 chars: the focused card's button, in display capitals. */
    playLevel: (level: number) => `Play level ${level}`,
    /** A cleared compact rung, spoken. */
    rungCleared: (title: string, correct: number, total: number) =>
      `${title}, best ${correct} of ${total}, cleared`,
    /** A 10/10 compact rung, spoken. "a la escuadra" is never translated. */
    rungEscuadra: (title: string, correct: number, total: number) =>
      `${title}, best ${correct} of ${total}, ${A_LA_ESCUADRA}`,
```

Level 3 becomes:

```ts
      3: {
        title: 'Full Profile',
        /** A club squad's third part is the player's nationality. */
        descriptionClub: 'Name from 6 options, then position, then nationality.',
        /** A nation squad's third part is the player's club. */
        descriptionNation: 'Name from 6 options, then position, then club.',
      },
```

Import `A_LA_ESCUADRA` from `./names` if `en.ts` does not already import it. Check how the
other catalogs interpolate `ESCUADRA`, and do the same.

- [ ] **Step 3: Add the budgets.** In `i18n/budgets.ts`, after the `ladder.studySquad` entry:

```ts
  { budget: 20, texts: { 'ladder.heading': (m) => m.ladder.heading } },
  { budget: 16, texts: { 'ladder.nationalTeam': (m) => m.ladder.nationalTeam } },
  { budget: 14, texts: { 'ladder.cleared': (m) => m.ladder.cleared } },
  {
    budget: 22,
    texts: {
      'ladder.notPlayed': (m) => m.ladder.notPlayed,
      'ladder.yourBest': (m) => m.ladder.yourBest(10, 10),
    },
  },
  { budget: 16, texts: { 'ladder.playLevel': (m) => m.ladder.playLevel(3) } },
```

- [ ] **Step 4: Run the i18n tests and watch them fail.** Run
      `npx vitest run i18n` and expect type and catalog failures for `de/es/fr/it`.

- [ ] **Step 5: Translate.** Add the same keys, in the same order, to `de.ts`, `es.ts`, `fr.ts`
      (France usage) and `it.ts`. Match each catalog's existing vocabulary:
  - read how each one already translates `ladder.levels.*`, `unlockHint` ("Level" in German,
    per the comment in `de.ts`), `study.players` and `picker.*`;
  - keep "best" consistent with `rungBest`;
  - make "Cleared" the word the Results screen uses for a pass, if it has one (grep the catalog
    for the results verdict);
  - for level 3, the nation variant ends with the catalog's word for club and the club variant
    with its word for nationality (see `slots.CLUB`/`slots.NAT`).

  Stay inside each budget. Run `npx vitest run i18n` until it passes.

- [ ] **Step 6: Typecheck, lint, test.**
      Run `npm run typecheck && npm run lint && npm test`. Expect no errors. The screen still
      reads `levels[3].description`: change that read in `app/team/[squadId]/difficulty.tsx` to
      `row.level === 3 ? (squad.kind === 'club' ? copy.descriptionClub : copy.descriptionNation) : copy.description`.
      If TypeScript cannot narrow it, use `'description' in copy`. Task 5 replaces this.

- [ ] **Step 7: Commit.**
      `git commit -am "feat(i18n): the redesigned ladder's copy, Exam mode shared (#178)"`

### Task 2: The ladder view model

**Files:**

- Modify: `lib/ladderView.ts`, `lib/pickerView.ts` (export `leagueName`)
- Test: `lib/__tests__/ladderView.test.ts`

**Interfaces:**

- Consumes: Task 1's `Messages` keys.
- Produces, from `lib/ladderView.ts`:

```ts
export function heroLine(
  squad: Pick<Squad, 'kind' | 'season' | 'members'>,
  league: League | undefined,
  messages: Messages,
): string;
export function levelDescription(level: Level, kind: Squad['kind'], messages: Messages): string;
export type RungTag = 'escuadra' | 'cleared';
export function rungTag(best: { correct: number; total: number }): RungTag; // escuadra iff correct === total
export function statusLine(row: LadderRow, messages: Messages): { text: string; spoken: string };
export function playLevelLabel(level: Level, messages: Messages): string;
export function rungAccessibilityLabel(row: LadderRow, title: string, messages: Messages): string; // updated
export function squadLeague(squadId: string): League | undefined; // in lib/squads.ts
```

- Produces, from `lib/pickerView.ts`: `export function leagueName(league: League): string`
  (`LEAGUE_NAMES[league]`). `leagueLabel` uses it.
- Removes: `playLabel` and its tests.

- [ ] **Step 1: Write the failing tests.** Append to `lib/__tests__/ladderView.test.ts`.
      Update the import list, and delete the `playLabel` describe block.

```ts
describe('the ladder a player sees (#178 Test)', () => {
  // One club squad and one nation squad; scoreKey is `${squadId}:${level}`.
  for (const id of ['rma', 'arm']) {
    it(`${id}: a newcomer has level 1 open and focused, 2 and 3 locked`, () => {
      const rows = ladderRows(id, {});
      expect(rows.map((r) => r.status)).toEqual(['unlocked', 'locked', 'locked']);
      expect(focusedLevel(rows)).toBe(1);
    });

    it(`${id}: part way up, cleared rungs below the focused level`, () => {
      const rows = ladderRows(id, { [`${id}:1`]: 10, [`${id}:2`]: 8, [`${id}:3`]: 6 });
      expect(rows.map((r) => r.status)).toEqual(['cleared', 'cleared', 'unlocked']);
      expect(focusedLevel(rows)).toBe(3);
      expect(rows.map((r) => r.best && rungTag(r.best))).toEqual([
        'escuadra',
        'cleared',
        'cleared',
      ]);
    });

    it(`${id}: all three cleared, level 3 focused for a replay`, () => {
      const rows = ladderRows(id, { [`${id}:1`]: 9, [`${id}:2`]: 10, [`${id}:3`]: 8 });
      expect(rows.every((r) => r.status === 'cleared')).toBe(true);
      expect(focusedLevel(rows)).toBe(3);
    });
  }
});

describe('heroLine', () => {
  const members = Array.from({ length: 26 }, () => ({}) as never);
  it('reads national team, season and count for a nation', () => {
    expect(heroLine({ kind: 'nation', season: '2026', members }, undefined, en)).toBe(
      'National team · 2026 · 26 players',
    );
  });
  it('reads the league for a club', () => {
    expect(heroLine({ kind: 'club', season: '2025-26', members }, 'premier-league', en)).toBe(
      'Premier League · 2025-26 · 26 players',
    );
  });
  it('reads UCL for a club with no big-five league', () => {
    expect(heroLine({ kind: 'club', season: '2025-26', members }, 'ucl', en)).toBe(
      'UCL · 2025-26 · 26 players',
    );
  });
  it('leaves the league out when a club has none', () => {
    expect(heroLine({ kind: 'club', season: '2025-26', members }, undefined, en)).toBe(
      '2025-26 · 26 players',
    );
  });
});

describe('levelDescription', () => {
  it('ends level 3 with club for a nation squad', () => {
    expect(levelDescription(3, 'nation', en)).toBe(en.ladder.levels[3].descriptionNation);
    expect(levelDescription(3, 'nation', en)).toMatch(/club\.$/);
  });
  it('ends level 3 with nationality for a club squad', () => {
    expect(levelDescription(3, 'club', en)).toMatch(/nationality\.$/);
  });
  it('is the same for both kinds below level 3', () => {
    expect(levelDescription(1, 'club', en)).toBe(levelDescription(1, 'nation', en));
    expect(levelDescription(2, 'club', en)).toBe(en.ladder.levels[2].description);
  });
});

describe('rungTag', () => {
  it('is escuadra at 10/10', () => expect(rungTag({ correct: 10, total: 10 })).toBe('escuadra'));
  it('is cleared at 9 and 8', () => {
    expect(rungTag({ correct: 9, total: 10 })).toBe('cleared');
    expect(rungTag({ correct: 8, total: 10 })).toBe('cleared');
  });
});

describe('statusLine', () => {
  it('reads not played yet with no best', () => {
    expect(statusLine({ level: 1, status: 'unlocked' }, en)).toEqual({
      text: 'Not played yet',
      spoken: 'Not played yet',
    });
  });
  it('reads the best, written and spoken', () => {
    const row = { level: 3, status: 'unlocked', best: { correct: 6, total: 10 } } as const;
    expect(statusLine(row, en)).toEqual({ text: 'Your best · 6/10', spoken: 'Your best, 6 of 10' });
  });
});

describe('playLevelLabel', () => {
  it('names the level', () => expect(playLevelLabel(2, en)).toBe('Play level 2'));
});
```

Replace the existing `rungAccessibilityLabel` cleared test with:

```ts
it('announces a cleared rung with its best score and cleared', () => {
  const row = { level: 1, status: 'cleared', best: { correct: 8, total: 10 } } as const;
  expect(rungAccessibilityLabel(row, 'Name from Number', en)).toBe(
    'Name from Number, best 8 of 10, cleared',
  );
});

it('announces a 10/10 rung as a la escuadra', () => {
  const row = { level: 1, status: 'cleared', best: { correct: 10, total: 10 } } as const;
  expect(rungAccessibilityLabel(row, 'Name from Number', en)).toBe(
    'Name from Number, best 10 of 10, a la escuadra',
  );
});
```

Keep the locked and unlocked tests. An unlocked rung that has a best keeps `rungBest`.

- [ ] **Step 2: Run them and watch them fail.**
      Run `npx vitest run lib/__tests__/ladderView.test.ts`. Expect failures on the missing
      exports.

- [ ] **Step 3: Implement.** In `lib/pickerView.ts`, add
      `export function leagueName(league: League): string { return LEAGUE_NAMES[league]; }` and
      make `leagueLabel` call it. In `lib/squads.ts`, add:

```ts
/** A club's league, from the picker's manifest; undefined for a nation. */
export function squadLeague(id: string): League | undefined {
  return listSquads().find((s) => s.id === id)?.league;
}
```

In `lib/ladderView.ts` (it may import `lib/pickerView.ts`; both are React-free):

```ts
/** The hero's mono line: "National team · 2026 · 26 players", or the club's
 *  league in place of "National team". Capitals come from the style. */
export function heroLine(
  squad: Pick<Squad, 'kind' | 'season' | 'members'>,
  league: League | undefined,
  messages: Messages,
): string {
  const lead =
    squad.kind === 'nation' ? messages.ladder.nationalTeam : league ? leagueName(league) : null;
  return [lead, squad.season, messages.study.players(squad.members.length)]
    .filter((part): part is string => part !== null)
    .join(' · ');
}

/** What a level asks. Level 3's last part is the club for a nation squad and
 *  the nationality for a club squad. */
export function levelDescription(level: Level, kind: Squad['kind'], messages: Messages): string {
  if (level === 3) {
    const l3 = messages.ladder.levels[3];
    return kind === 'club' ? l3.descriptionClub : l3.descriptionNation;
  }
  return messages.ladder.levels[level].description;
}

/** A compact rung is always cleared or locked; a cleared one is tagged
 *  a la escuadra at full marks. */
export type RungTag = 'escuadra' | 'cleared';
export function rungTag(best: { correct: number; total: number }): RungTag {
  return best.correct === best.total ? 'escuadra' : 'cleared';
}

/** The focused card's status line, as shown and as spoken. */
export function statusLine(row: LadderRow, messages: Messages): { text: string; spoken: string } {
  if (!row.best) return { text: messages.ladder.notPlayed, spoken: messages.ladder.notPlayed };
  const { correct, total } = row.best;
  return {
    text: messages.ladder.yourBest(correct, total),
    spoken: messages.ladder.yourBestSpoken(correct, total),
  };
}

export function playLevelLabel(level: Level, messages: Messages): string {
  return messages.ladder.playLevel(level);
}
```

In `rungAccessibilityLabel`, for a row with `best` and `status === 'cleared'`, return
`rungEscuadra` or `rungCleared` by `rungTag`. Otherwise keep `rungBest`. Delete `playLabel`.
TypeScript may not narrow `messages.ladder.levels[level].description` for `level: 1 | 2`.
If so, narrow with `level === 1 ? levels[1].description : levels[2].description`.

- [ ] **Step 4: Run and see them pass.** Run `npx vitest run lib`. Then run
      `npm run typecheck`: the screen imports `playLabel` through `DifficultyCard`, so switch
      `components/DifficultyCard.tsx` to `playLevelLabel(row.level, t)` for now. Task 5 deletes
      it.

- [ ] **Step 5: Commit.**
      `git commit -am "feat(ladder): the view model for the redesigned ladder (#178)"`

### Task 3: The hero's veil

**Files:**

- Modify: `lib/stageView.ts`, `theme/tokens.ts`
- Test: `lib/__tests__/stageView.test.ts`

**Interfaces:**

- Produces:
  - `export const ladderHero = { veilFloor: { dark: 0.4, light: 0.5 } } as const` in
    `theme/tokens.ts`, beside `stage`;
  - `export function heroTextAlpha(bands: readonly Band[], theme: ThemeName): number` in
    `lib/stageView.ts`. It returns the least alpha, in hundredths, never below
    `ladderHero.veilFloor[theme]`, at which the palette's `background` laid over every band
    gives `textSecondary` at least 4.5:1 and `textPrimary` at least 3:1.

- [ ] **Step 1: Write the failing tests** in `lib/__tests__/stageView.test.ts`. Reuse the
      file's `veiled` and `squad` helpers.

```ts
describe('heroTextAlpha', () => {
  for (const theme of ['dark', 'light'] as const) {
    const { background, textPrimary, textSecondary } = palettes[theme];
    const holds = (band: string, alpha: number) => {
      const ground = veiled(band, background, alpha);
      return contrastRatio(textSecondary, ground) >= 4.5 && contrastRatio(textPrimary, ground) >= 3;
    };

    it(`never goes below the ${theme} floor`, () => {
      expect(heroTextAlpha([{ color: background, weight: 1 }], theme)).toBe(
        ladderHero.veilFloor[theme],
      );
    });

    for (const band of ['#ffffff', '#000000', '#d90012', '#0033a0', '#f2a800']) {
      it(`keeps the hero's text readable over ${band}, ${theme}`, () => {
        expect(holds(band, heroTextAlpha([{ color: band, weight: 1 }], theme))).toBe(true);
      });
    }

    it(`answers for the worst band of several, ${theme}`, () => {
      const bands = bannerBands(squad('club/la-liga/rma.json').marker);
      const alpha = heroTextAlpha([...bands, { color: '#000000', weight: 1 }], theme);
      expect(holds('#000000', alpha) && holds('#ffffff', alpha)).toBe(true);
    });

    it(`raises the veil no further than it must, ${theme}`, () => {
      const band = theme === 'dark' ? '#ffffff' : '#000000';
      const alpha = heroTextAlpha([{ color: band, weight: 1 }], theme);
      if (alpha > ladderHero.veilFloor[theme]) expect(holds(band, alpha - 0.01)).toBe(false);
    });
  }
});
```

Check the file's `veiled(hex, ink, alpha)` argument order before using it. The test above
assumes `veiled(band, ink, alpha)`. If `rma.json` sits at another path, use the path the
existing `stageVeil` test uses.

- [ ] **Step 2: Run and watch them fail.** Run `npx vitest run lib/__tests__/stageView.test.ts`.

- [ ] **Step 3: Implement.** In `theme/tokens.ts`, after `stage`:

```ts
// The Difficulty hero (#178): the squad's bands under a wash of the palette's
// `background`. The floor is the wash behind the top bar; `heroTextAlpha` in
// lib/stageView.ts raises it, behind the name and the mono line, until
// `textSecondary` holds 4.5:1 and `textPrimary` 3:1 on every band.
export const ladderHero = {
  veilFloor: { dark: 0.4, light: 0.5 },
} as const;
```

In `lib/stageView.ts`, beside `stageVeil`, reusing its `veiled` helper:

```ts
/**
 * How strongly the Difficulty hero's wash of `background` covers the team's
 * bands behind the name and the mono line: the least, in hundredths and never
 * below `ladderHero.veilFloor`, at which `textSecondary` holds 4.5:1 and
 * `textPrimary` 3:1 over every band.
 */
export function heroTextAlpha(bands: readonly Band[], theme: ThemeName): number {
  const { background, textPrimary, textSecondary } = palettes[theme];
  const holds = (alpha: number) =>
    bands.every((band) => {
      const ground = veiled(band.color, background, alpha);
      return contrastRatio(textSecondary, ground) >= 4.5 && contrastRatio(textPrimary, ground) >= 3;
    });
  let hundredths = Math.round(ladderHero.veilFloor[theme] * 100);
  while (hundredths < 100 && !holds(hundredths / 100)) hundredths++;
  return hundredths / 100;
}
```

- [ ] **Step 4: Run and see them pass.** Run `npx vitest run lib theme`.

- [ ] **Step 5: Commit.**
      `git commit -am "feat(ladder): the hero's veil keeps its text readable on any bands (#178)"`

### Task 4: The ladder's components

**Files:**

- Create: `components/LadderHero.tsx`, `components/LadderRung.tsx`,
  `components/LadderCard.tsx`, `components/ExamModeRow.tsx`
- Modify:
  - `components/ActionGlyphs.tsx` (add `PlayGlyph`);
  - `components/LockGlyph.tsx` (take `color` and `ground` props);
  - `components/RoundBackButton.tsx` (a `glass` option);
  - `theme/tokens.ts` (the tokens below).
- Test: none rendered (Vitest has no RN renderer). Run typecheck and lint; Task 6's shots show
  the result.

**Interfaces:**

- Consumes: Task 2 (`heroLine`, `levelDescription`, `rungTag`, `statusLine`,
  `playLevelLabel`, `rungAccessibilityLabel`, `unlockHint`, `LadderRow`) and Task 3
  (`heroTextAlpha`, `ladderHero`).
- Produces:

```tsx
<LadderHero squad={Squad} league={League | undefined} onBack={() => void} />
<LadderRung row={LadderRow /* cleared or locked */} title={string} onPress?={() => void} />
<LadderCard row={LadderRow} title={string} description={string} onPlay={() => void} />
<ExamModeRow />
<RoundBackButton onPress label glass? />   // glass: `glass` fill, `glassLine` ring, `onPhoto` chevron
<PlayGlyph color={string} />               // a right-pointing solid triangle, iconSize.play
<LockGlyph size={number} color={string} ground={string} />
```

**Tokens to add to `theme/tokens.ts`.** Values are the canvas's. Read the file's conventions
first: typography entries use no `fontWeight` on a Bold or Archivo face.

```ts
// typography, in the 2.0 section near `displayTitle`:
heroName: { fontFamily: 'Archivo-SemiExpandedExtraBold', fontSize: 36, lineHeight: 38, letterSpacing: -0.6, textTransform: 'uppercase' as const },
rungNumber: { fontFamily: 'Archivo-ExtraCondensedBlack', fontSize: 54, lineHeight: 56 },
cardNumber: { fontFamily: 'Archivo-ExtraCondensedBlack', fontSize: 96, lineHeight: 96 },
rungTitle: { fontFamily: 'Inter-Bold', fontSize: 16 },
rungScore: { fontFamily: 'Archivo-ExtraCondensedBlack', fontSize: 30, lineHeight: 32 },
rungScoreTail: { fontFamily: 'Archivo-ExtraCondensedBlack', fontSize: 17 },
cardStatus: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' as const },
cardTitle: { fontFamily: 'Archivo-SemiExpandedExtraBold', fontSize: 22, lineHeight: 24, textTransform: 'uppercase' as const },
cardDescription: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 14, lineHeight: 20 },
ladderPlay: { fontFamily: 'Archivo-SemiExpandedExtraBold', fontSize: 16, letterSpacing: 0.5, textTransform: 'uppercase' as const },
ladderStudy: { fontFamily: 'Archivo-SemiExpandedExtraBold', fontSize: 15, letterSpacing: 0.5, textTransform: 'uppercase' as const },
// radii:
rung: 22, // the ladder's compact rungs and Exam mode
ladderCard: 26, // the focused rung
// sizes:
corner: { ..., ladder: { arm: 20, bar: 5 } }, // the focused card's escuadra corner
ladderPill: 56, // Play and Study on Difficulty
// iconSize: play: 14, ladderLock: 14
```

The rung's tag ("A LA ESCUADRA", "CLEARED", "SCORE 8/10 ON L1") uses the existing
`typography.soonChip` (mono 10, capitals). The hero's mono line uses `typography.monoCaption`.
The exam row's title uses `typography.settingsLabel`, and its line `secondarySmall`. Spacing
comes from `spacing`:

- canvas 14/16 → `spacing.sm + 2`/`spacing.md` (this file already writes `spacing.xs - 2`
  style sums);
- 12 → `spacing.sm`;
- 18 → `spacing.md + 2`;
- 20 → `spacing.lg`.

Borders come from `borderWidths`: 1.5 → `thick`, hairline → `hairline`.

- [ ] **Step 1: `RoundBackButton` glass.** Add an optional `glass?: boolean`. When set, fill
      with `colors.glass`, ring with `colors.glassLine`, and draw the chevron in
      `colors.onPhoto`. Update the header comment ("…; over the Difficulty hero, glass").

- [ ] **Step 2: `PlayGlyph`** in `ActionGlyphs.tsx`: a solid right-pointing triangle drawn as
      a zero-size View with borders (`borderLeftWidth` = the triangle's width in `color`,
      transparent top and bottom borders of half its height), inside an `iconSize.play` box,
      centred. Add a one-line doc comment as its neighbours have.

- [ ] **Step 3: `LockGlyph` props.** Replace its two reads of `colors.textMuted` with a
      `color` prop, and its two reads of `colors.surface` (the keyhole) with a `ground` prop.
      Update its comment: the keyhole is cut in the colour of whatever it sits on. Drop
      `useThemeColors` from it.

- [ ] **Step 4: `LadderHero`.** It renders, in order:
  - A root `View` whose `paddingTop` is `insets.top` (`useSafeAreaInsets`), with
    `overflow: 'hidden'`.
  - **Bands,** `StyleSheet.absoluteFill`, `flexDirection: 'row'`, one `View` per
    `bannerBands(squad.marker)` band with `flex: band.weight`. This is the same drawing as
    `SpotlightStage`. Hidden from screen readers (`accessibilityElementsHidden`,
    `importantForAccessibility="no-hide-descendants"`, `pointerEvents="none"`).
  - **The top bar,** height `sizes.roundButton`, space-between:
    `<RoundBackButton glass label={t.common.back} onPress={onBack} testID="difficulty-back" />`,
    and an empty `View` of `sizes.roundButton` square. Comment it: `{/* The star's slot (#179). */}`.
    Behind it, as an absolute-fill `LinearGradient` from `expo-linear-gradient`, the
    colours are
    `[withAlpha(colors.background, ladderHero.veilFloor[theme]), withAlpha(colors.background, textAlpha)]`,
    where `textAlpha = heroTextAlpha(bands, useThemeName())`. It extends up behind the safe
    area: give the bar a negative `marginTop: -insets.top` and a `paddingTop: insets.top`,
    or put the gradient on a wrapper that includes the inset. Pick one and comment it.
  - **The identity block,** with padding `spacing.lg` horizontal, `spacing.md` top and
    `spacing.sm + 2` bottom, and gap `spacing.xs`. Behind it is an absolute-fill
    `LinearGradient`,
    `[withAlpha(colors.background, textAlpha), colors.background]`. In it:
    - A row (gap `spacing.sm`, `alignItems: 'center'`): a nation shows
      `<Flag code={flagFor(squad.id)} size="picker" label="" />`, check how `TeamRow` finds
      a nation's flag code and do the same; a club, or a nation with no flag, shows
      `<TeamMarker marker={squad.marker} variant="picker" />`. The marker is wrapped
      hidden from screen readers. Then
      `<Text style={heroName, color: textPrimary, flexShrink: 1} accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap.display}>`
      `{squadDisplayName(squad, language)}`.
    - `<Text style={monoCaption, color: textSecondary}>{heroLine(squad, league, t)}</Text>`.
  - Comment the component in the file's style: what it is (spec §1), and why the veil is
    computed (Real Madrid's white).

- [ ] **Step 5: `LadderRung`.** A `Pressable` row (`flexDirection: 'row'`,
      `alignItems: 'center'`, gap `spacing.sm + 2`, padding `spacing.sm + 2` vertical and
      `spacing.md` horizontal, `radii.rung`, `borderWidths.hairline` in `colors.hairline`).
  - **Cleared:** fill `colors.surface`, `onPress`, `accessibilityRole="button"`, and
    `accessibilityLabel={rungAccessibilityLabel(row, title, t)}`. It shows the level number
    (`rungNumber`, `textPrimary`, a fixed width of `spacing.xxl + 2` so the titles align), the
    title (`rungTitle`, `flex: 1`, `numberOfLines={2}`), and the score block (column,
    `alignItems: 'flex-end'`, gap `spacing.xxs - 1`):
    - `<Text>` `rungScore` holding `{correct}` and a nested `<Text style={rungScoreTail}>/{total}</Text>`;
    - the tag in `soonChip`.
    - At 10/10 (`rungTag === 'escuadra'`), the score, tail and tag are `successText` and the
      tag is `A_LA_ESCUADRA`.
    - Otherwise the score is `textPrimary`, the tail `textMuted`, the tag `successText` and
      `t.ladder.cleared`.
    - Pressed: `opacity.settled`.
  - **Locked:** no fill, not pressable (`disabled`), and every text in `textMuted`. In place
    of the score: a row (gap `spacing.xs - 2`) of
    `<LockGlyph size={iconSize.ladderLock} color={colors.textMuted} ground={colors.background} />`
    and `<Text style={soonChip}>{unlockHint(row.level, t)}</Text>`. Use
    `accessibilityLabel={rungAccessibilityLabel(...)}` and
    `accessibilityState={{ disabled: true }}`.
  - The number and the score are `maxFontSizeMultiplier={fontScaleCap.display}`.

- [ ] **Step 6: `LadderCard`.** A `View` (`colors.surface`, `borderWidths.thick` in
      `colors.accentLine`, `radii.ladderCard`, padding `spacing.md + 2`, gap `spacing.md + 2`).
  - **A top row,** `alignItems: 'flex-start'`, gap `spacing.md`.
    - **The number box,** `paddingRight: corner.arm + spacing.xxs / 2`. In it:
      `<Text style={cardNumber}>{row.level}</Text>`, hidden from screen readers. Beside it,
      the corner: an absolute `View` at `right: 0`, `top: spacing.xxs`, `corner.arm` square,
      `borderTopWidth` and `borderRightWidth` of `corner.bar` in `accentLine`, also hidden.
    - **The text column** (`flex: 1`, gap `spacing.xs`, `paddingTop: spacing.xxs`):
      - the status (`cardStatus`, `accentLine`), with
        `accessibilityLabel={statusLine(row, t).spoken}`;
      - the title (`cardTitle`, `textPrimary`, `accessibilityRole="header"`);
      - the description (`cardDescription`, `textSecondary`).
  - **The Play pill,** a `Pressable` (`testID={\`play-level-${row.level}\`}`, height
`sizes.ladderPill`, `radii.pill`, `colors.ctaBg`, centred row, gap `spacing.xs + 2`):
`<PlayGlyph color={colors.ctaText} />` and the label (`ladderPlay`, `ctaText`). Its
`accessibilityRole="button"`and`accessibilityLabel={playLevelLabel(row.level, t)}`. Pressed: `opacity.settled`. Use a
`minHeight`, not a `height`, so large text grows it.

- [ ] **Step 7: `ExamModeRow`.** One `View accessible` (row, gap `spacing.sm + 2`, padding
      `spacing.md`, `radii.rung`, `borderWidths.thick` `borderStyle: 'dashed'` in
      `colors.border`). It holds:
  - `<ClockGlyph color={colors.textMuted} />` (from `SettingsGlyphs`);
  - a column (`flex: 1`, gap `spacing.xxs - 1`) of `t.examMode.title` (`settingsLabel`,
    `textSecondary`) and `t.examMode.line` (`secondarySmall`, `textMuted`);
  - the SOON chip, styled exactly as `app/settings.tsx`'s `soon`/`soonLabel`.

  Settings and Difficulty now both draw the chip. Extract it as `components/SoonChip.tsx`,
  use it in both, and delete the two styles from `settings.tsx`.

  Comment: "Exam mode is a placeholder for the standalone feature beside the ladder, not a
  fourth level."

- [ ] **Step 8: Verify.** Run `npm run typecheck && npm run lint && npm test`. Lint fails a
      hard-coded string: every text comes from `t`, `A_LA_ESCUADRA` or a number.

- [ ] **Step 9: Commit.**
      `git commit -am "feat(ladder): hero, rungs, card and Exam mode components (#178)"`
      (`git add` the new files first.)

### Task 5: The screen, and the old ladder removed

**Files:**

- Modify: `app/team/[squadId]/difficulty.tsx` (rewrite), `i18n/*.ts` and `i18n/budgets.ts`
  (remove the dead keys), `theme/tokens.ts` (remove dead tokens), `.claude/rules/team-identity.md`,
  `design/SCREENS.md`
- Delete: `components/DifficultyRow.tsx`, `components/DifficultyCard.tsx`,
  `components/LadderBadge.tsx`, `components/LadderConnector.tsx`, `components/BestPill.tsx`

**Interfaces:**

- Consumes: Tasks 1–4.

- [ ] **Step 1: Rewrite the screen.**

```tsx
export default function Difficulty() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const { squadId } = useLocalSearchParams<{ squadId: string }>();
  const bestScores = useProgress((s) => s.bestScores);
  const squad = getSquad(squadId);
  if (!squad) return null;

  const rows = ladderRows(squad.id, bestScores);
  const focused = focusedLevel(rows);
  const play = (level: Level) =>
    router.push({
      pathname: '/play/[squadId]/[level]',
      params: { squadId: squad.id, level: String(level) },
    });
  const styles = StyleSheet.create({
    /* root background, content padding/gaps, heading, study pill, updated */
  });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
    >
      <LadderHero squad={squad} league={squadLeague(squad.id)} onBack={() => router.back()} />
      <View style={styles.content}>
        <Text style={styles.heading}>{t.ladder.heading}</Text>
        {rows.map((row) => {
          const title = t.ladder.levels[row.level].title;
          return row.level === focused ? (
            <LadderCard
              key={row.level}
              row={row}
              title={title}
              description={levelDescription(row.level, squad.kind, t)}
              onPlay={() => play(row.level)}
            />
          ) : (
            <LadderRung
              key={row.level}
              row={row}
              title={title}
              onPress={row.status === 'locked' ? undefined : () => play(row.level)}
            />
          );
        })}
        <ExamModeRow />
        {/* Study pill: outline, BookGlyph, t.ladder.studySquad, testID="study" */}
        <Text style={styles.updated}>
          {t.ladder.updated(formatLastUpdated(squad.lastUpdated, t))}
        </Text>
      </View>
    </ScrollView>
  );
}
```

Hooks must run before the early return, so compute `styles` from `colors`/`insets` before
`if (!squad)`, as the current file does.

- **Content:** padding `spacing.sm - 2` top and `spacing.lg` horizontal, gap `spacing.sm`.
- **The heading:** `monoCaption` in `textMuted`, with `paddingBottom: spacing.xxs / 2`.
- **The ExamModeRow wrapper:** `marginTop: spacing.xxs + 2`.
- **The Study pill:** `marginTop: spacing.xs`, `minHeight: sizes.ladderPill`, `radii.pill`,
  `borderWidths.thick` in `colors.border`, a centred row with gap `spacing.xs + 2`. It holds
  `BookGlyph` in `textPrimary` and the label in `ladderStudy`/`textPrimary`.
  `accessibilityRole="button"`; pressed `opacity.settled`. It pushes
  `/team/[squadId]/study` as today.
- **Updated:** `secondarySmall`, `textMuted`, `textAlign: 'center'`.

Keep a short file comment: what the screen shows, and that the star (#179) and OUTDATED
(#180) are later steps.

- [ ] **Step 2: Delete the old ladder.** Delete the five components. `grep -rn` for each name
      and for `LockGlyph`'s old callers, and fix any reference left, including comments in
      `EscuadraStrike.tsx`, `VerdictGlyph.tsx` and `SearchField.tsx` that name a deleted
      component; reword them to name what still exists. Remove `ladder.title`, `ladder.play`,
      `ladder.playAgain` and `ladder.best` from all five catalogs, with their `budgets.ts`
      entries. `grep -n` `theme/tokens.ts` for tokens now unused, and remove them: likely
      `sizes.ladderBadge*`, `ladderConnector*`, `bestPill*` and `iconSize.lockGlyphRatio`.
      For each candidate, `grep -rn "<name>" app components lib theme design scripts` must
      show no use left.

- [ ] **Step 3: Rules and handoff text.**
  - In `.claude/rules/team-identity.md`, under "The in-round banner", add one sentence: the
    Difficulty hero (`LadderHero`) draws the same vertical bands, full bleed under a veil,
    through `bannerBands`.
  - In `design/SCREENS.md`, replace row 4's description with: "Difficulty. The team's bands
    full bleed under a veil, with back, the flag or marker, the name, and a mono line (league
    or NATIONAL TEAM · season · players). THE LADDER: cleared levels compact with their best
    (A LA ESCUADRA at 10/10, else CLEARED), the focused level a card with the escuadra corner,
    its best or NOT PLAYED YET, the description and PLAY LEVEL n, locked levels with SCORE
    8/10 ON Ln. Exam mode, SOON. Study as an outline pill, then Updated … · Wikipedia."
  - Task 6 adds the new screenshot rows.

- [ ] **Step 4: Verify.** Run `npm run typecheck && npm run lint && npm test`.
      Run `npx prettier --check .`, and fix anything with `npx prettier --write <file>`.

- [ ] **Step 5: Commit.** Stage the deletions (`git add -A app components i18n theme design .claude`), then
      `git commit -m "feat(difficulty): the redesigned ladder screen (#178)"`

### Task 6: Screenshots for the three ladder states

**Files:**

- Modify: `scripts/capture-screens.mjs`, `design/SCREENS.md`
- Regenerate: `design/screens/*.png` (`npm run shots`)

- [ ] **Step 1: Seed helper.** In `scripts/capture-screens.mjs`, add a
      `seedBestScores(capture, scores)` beside the existing `addInitScript` seeding. It merges
      `scores` into `escuadra-progress`'s `state.bestScores` in `localStorage`, through
      `capture.page.evaluate`. Read how the store persists (`stores/progress.ts`, the
      `bestScores` key, `scoreKey` in `lib/scoring.ts` → `${squadId}:${level}`) and match it.
      The next `capture.open` reloads the page and rehydrates.

- [ ] **Step 2: Capture.** After `04-difficulty` (Real Madrid, newcomer):

```js
await seedBestScores(capture, { 'arm:1': 10, 'arm:2': 8, 'arm:3': 6 });
await capture.open('/team/arm/difficulty');
await capture.shoot('04b-difficulty-nation');

await seedBestScores(capture, { 'liv:1': 10, 'liv:2': 9, 'liv:3': 8 });
await capture.open('/team/liv/difficulty');
await capture.shoot('04c-difficulty-cleared');
```

Confirm `liv` exists (`ls data/squads/club/premier-league`). If not, use another
Premier League club that no other capture uses. `arm` must exist in `data/squads/nation/`.
The seeded squads are not used by any later capture, so the rounds and results shots are
unaffected.

- [ ] **Step 3: Run `npm run shots`.** Read `scripts/capture-screens.mjs`'s header for how it
      starts the web build. Check the new and changed PNGs with the Read tool (it shows
      images):
  - `04-difficulty`, `04b-difficulty-nation` and `04c-difficulty-cleared`, each dark and
    light;
  - `01c-settings*` (the SOON chip moved).

  Compare against the canvas, and fix any real defect in the components before going on:
  clipped 96 pt numbers, an unreadable hero, a wrong colour.

- [ ] **Step 4: SCREENS.md rows.** Add rows after `screens/04-difficulty.png`:
      `screens/04b-difficulty-nation.png` "Difficulty, a nation part way up (L3 focused)", and
      `screens/04c-difficulty-cleared.png` "Difficulty, a club with every level cleared".
      Change 04's label to "Difficulty ladder, a newcomer (club)". Match how the table lists
      the light variants.

- [ ] **Step 5: Commit.**
      `git add scripts/capture-screens.mjs design && git commit -m "chore(design): Difficulty screens for a newcomer, part way and cleared (#178)"`

### Task 7: Native-speaker review of the new copy

Run by the controller, not an implementer subagent.

- [ ] **Step 1:** For each of `de`, `es`, `fr` (France usage) and `it`, dispatch a fresh
      native-speaker reviewer subagent. Give it:
  - the English source and the translation of every key Task 1 added;
  - the budgets;
  - where each text shows (a mono capitals label, a button, a spoken label);
  - the catalog's existing terms for "level", "best", "club", "nationality", "squad" and "team".

  Ask for a verdict, clean or a list of fixes, and for any fix that would change the meaning.

- [ ] **Step 2:** Apply the fixes, then run `npx vitest run i18n`. Re-review with a new fresh
      reviewer until clean. A change of meaning goes to the owner instead.

- [ ] **Step 3: Commit.** `git commit -am "fix(i18n): native-speaker review of the ladder copy (#178)"`
      (only if anything changed).

### Finish

- [ ] Run `npm run check`, and keep its output for the PR.
- [ ] Push `feat/178-difficulty-ladder`. Open the PR with `Closes #178`, the calls made, the
      `npm run check` output, the screens, and a device checklist for **Still works**. Tick the
      DoD items that were verified.
